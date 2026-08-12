import { FLIGHT_DEFAULTS } from '../utils/constants.js';

export const FLIGHT_STATE = {
  OFF: 'OFF',
  LOADING: 'LOADING',
  LIVE: 'LIVE',
  RATE_LIMITED: 'RATE_LIMITED',
  OFFLINE: 'OFFLINE',
};

const KNOT_DEG_PER_SEC = 1 / 60 / 3600; // 1 knot = 1 nm/h = (1/60) deg lat per hour
const LERP_RATE = 0.5; // per-second convergence of dead-reckoned pos toward a fresh poll

/**
 * Clamp/validate one raw ADS-B record BEFORE it can reach any matrix/render path.
 * External aircraft coordinates are untrusted input (WebGL trust boundary): a bad
 * payload must never throw in the render loop. Returns a sanitized record or null.
 * @param {*} raw
 * @returns {{hex:string,lat:number,lon:number,alt:number,track:number,gs:number}|null}
 */
export function validateAircraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const altRaw = Number(raw.alt_baro);
  const alt = Number.isFinite(altRaw) ? Math.max(0, altRaw) : 0; // 'ground'/NaN -> 0
  const trackRaw = Number(raw.track);
  const track = Number.isFinite(trackRaw) ? ((trackRaw % 360) + 360) % 360 : 0;
  const gsRaw = Number(raw.gs);
  const gs = Number.isFinite(gsRaw) ? Math.max(0, gsRaw) : 0;

  return {
    hex: String(raw.hex ?? raw.flight ?? ''),
    lat: Math.max(-90, Math.min(90, lat)),
    lon: Math.max(-180, Math.min(180, lon)),
    alt,
    track,
    gs,
  };
}

/**
 * Advance a lat/lon forward along its heading by ground speed over dt seconds
 * (flat local dead-reckoning between polls). Returns new { lat, lon }.
 * ponytail: flat approximation, fine over a 12s poll gap; upgrade to great-circle
 * only if flights near the poles visibly drift.
 * @param {{lat:number,lon:number,track:number,gs:number}} ac
 * @param {number} dt - Seconds.
 * @returns {{lat:number,lon:number}}
 */
export function deadReckon(ac, dt) {
  const distDeg = ac.gs * KNOT_DEG_PER_SEC * dt; // degrees of latitude equivalent
  const rad = (ac.track * Math.PI) / 180;
  const dLat = distDeg * Math.cos(rad);
  const cosLat = Math.max(1e-6, Math.cos((ac.lat * Math.PI) / 180));
  const dLon = (distDeg * Math.sin(rad)) / cosLat;
  return { lat: ac.lat + dLat, lon: ac.lon + dLon };
}

/**
 * FlightDataService polls the aircraft snapshot published by .github/workflows/
 * flights.yml (adsb.fi data, force-pushed to the `flight-data` branch and served
 * by raw.githubusercontent.com, which is the only leg of this that sends a CORS
 * header). The payload keeps adsb.fi's own `{ ac: [...] }` shape, plus a `now`
 * timestamp that dates the snapshot. This service exposes an explicit state machine (OFF/LOADING/LIVE/RATE_LIMITED/OFFLINE) plus a
 * validated, capped, dead-reckoned aircraft list. All I/O (fetch/timers/navigator/clock)
 * is injected so the polling, backoff, offline short-circuit, and validation logic are
 * unit-testable with no real network or WebGL.
 */
export class FlightDataService {
  /**
   * @param {Object} [opts]
   * @param {Function} [opts.fetchFn]
   * @param {Function} [opts.setTimeout]
   * @param {Function} [opts.clearTimeout]
   * @param {Object} [opts.navigator] - Needs `onLine`.
   * @param {Function} [opts.now] - () => epoch ms.
   */
  constructor({
    fetchFn,
    setTimeout: st,
    clearTimeout: ct,
    navigator: nav,
    now,
    snapshotUrl = FLIGHT_DEFAULTS.snapshotUrl,
    pollIntervalMs = FLIGHT_DEFAULTS.pollIntervalMs,
    backoffStartMs = FLIGHT_DEFAULTS.backoffStartMs,
    backoffMaxMs = FLIGHT_DEFAULTS.backoffMaxMs,
    maxInstances = FLIGHT_DEFAULTS.maxInstances,
  } = {}) {
    this._fetch = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this._setTimeout = st || ((fn, ms) => setTimeout(fn, ms));
    this._clearTimeout = ct || ((id) => clearTimeout(id));
    this._nav = nav || (typeof navigator !== 'undefined' ? navigator : { onLine: true });
    this._now = now || (() => Date.now());
    this._url = snapshotUrl;
    this.pollIntervalMs = pollIntervalMs;
    this.backoffStartMs = backoffStartMs;
    this.backoffMaxMs = backoffMaxMs;
    this.maxInstances = maxInstances;

    this.state = FLIGHT_STATE.OFF;
    this.count = 0;
    this.lastUpdatedAt = 0;
    this._aircraft = new Map();
    this._backoffMs = 0;
    this._timerId = null;
    this._running = false;
    this._generation = 0;
    this._onState = null;
  }

  /**
   * Register a state-change callback (HUD status). Fired on every transition.
   * @param {Function} cb - (state) => void
   */
  onState(cb) {
    this._onState = cb;
  }

  _setState(state) {
    if (this.state === state) return;
    this.state = state;
    if (this._onState) this._onState(state);
  }

  /** Begin polling (opt-in). Returns the first poll's promise for deterministic tests. */
  start() {
    if (this._running) return Promise.resolve();
    this._running = true;
    this._generation += 1;
    this._backoffMs = 0;
    this._setState(FLIGHT_STATE.LOADING);
    return this._poll();
  }

  // @MX:WARN: [AUTO] stop() MUST clear the pending timer and invalidate any in-flight
  // poll — otherwise a poll resolving after EarthView is disposed mid-flight would
  // reschedule the loop and leak a timer that keeps hitting a shared community API.
  // @MX:REASON: [AUTO] EarthView.onExit()/dispose calls this via the onStopPolling hook;
  // a leaked interval polling the snapshot after the view is gone is both a battery/
  // bandwidth drain and a use-after-dispose on torn-down render state.
  stop() {
    this._running = false;
    this._generation += 1; // invalidate any in-flight poll's continuation
    if (this._timerId != null) {
      this._clearTimeout(this._timerId);
      this._timerId = null;
    }
    this._aircraft.clear();
    this.count = 0;
    this._setState(FLIGHT_STATE.OFF);
  }

  async _poll() {
    const gen = this._generation;
    if (!this._running) return;

    // Offline: zero requests, immediate OFFLINE, NO retry loop (REQ-440).
    if (this._nav && this._nav.onLine === false) {
      this._setState(FLIGHT_STATE.OFFLINE);
      return;
    }

    try {
      // Vary the URL once a minute: raw.githubusercontent caches for 300 s, and a
      // sticky CDN copy would otherwise outlive several producer runs.
      const res = await this._fetch(`${this._url}?t=${Math.floor(this._now() / 60000)}`);
      if (this._disposed(gen)) return;
      if (res && res.status === 429) return this._onFailure(FLIGHT_STATE.RATE_LIMITED);
      if (!res || !res.ok) return this._onFailure(FLIGHT_STATE.OFFLINE);

      const data = await res.json();
      if (this._disposed(gen)) return;
      this._applyAircraft(Array.isArray(data && data.ac) ? data.ac : []);
      // Trust the snapshot's own timestamp over the fetch clock. The file can be
      // minutes old, and the HUD's "N seconds ago" must say so instead of
      // resetting to zero every poll.
      const stamped = Number(data && data.now);
      this.lastUpdatedAt = Number.isFinite(stamped) && stamped > 0 ? stamped : this._now();
      this._backoffMs = 0;
      this._setState(FLIGHT_STATE.LIVE);
      this._scheduleNext(this.pollIntervalMs);
    } catch {
      if (this._disposed(gen)) return;
      this._onFailure(FLIGHT_STATE.OFFLINE);
    }
  }

  _disposed(gen) {
    return !this._running || gen !== this._generation;
  }

  _onFailure(state) {
    this._setState(state);
    this._backoffMs = this._backoffMs ? Math.min(this._backoffMs * 2, this.backoffMaxMs) : this.backoffStartMs;
    this._scheduleNext(this._backoffMs);
  }

  _scheduleNext(delay) {
    if (!this._running) return;
    this._timerId = this._setTimeout(() => this._poll(), delay);
  }

  /**
   * Replace the tracked set from a fresh poll, preserving the displayed position of
   * still-present aircraft as the dead-reckon target (lerp toward it — no teleport).
   * @param {Array} raw
   */
  _applyAircraft(raw) {
    const next = new Map();
    for (const rec of raw) {
      const a = validateAircraft(rec);
      if (!a) continue;
      const prev = this._aircraft.get(a.hex);
      next.set(a.hex, {
        ...a,
        // keep the last displayed position as current; steer it toward the fresh target.
        lat: prev ? prev.lat : a.lat,
        lon: prev ? prev.lon : a.lon,
        tLat: a.lat,
        tLon: a.lon,
      });
      if (next.size >= this.maxInstances) break;
    }
    this._aircraft = next;
    this.count = next.size;
  }

  /**
   * Advance dead-reckoning and lerp toward the last polled target each frame.
   * @param {number} dt - Seconds.
   */
  tick(dt) {
    if (this.state !== FLIGHT_STATE.LIVE && this.state !== FLIGHT_STATE.RATE_LIMITED) return;
    const k = Math.min(1, dt * LERP_RATE);
    for (const ac of this._aircraft.values()) {
      const dr = deadReckon(ac, dt);
      ac.lat = dr.lat + (ac.tLat - dr.lat) * k;
      ac.lon = dr.lon + (ac.tLon - dr.lon) * k;
    }
  }

  /** @returns {Array<{hex:string,lat:number,lon:number,alt:number,track:number,gs:number}>} */
  getAircraft() {
    return [...this._aircraft.values()].map((a) => ({
      hex: a.hex, lat: a.lat, lon: a.lon, alt: a.alt, track: a.track, gs: a.gs,
    }));
  }
}
