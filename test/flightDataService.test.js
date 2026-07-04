import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FlightDataService,
  FLIGHT_STATE,
  validateAircraft,
  deadReckon,
} from '../src/data/FlightDataService.js';

// A fake scheduler that records (fn, delay) without real time so backoff delays
// can be asserted exactly and flushed on demand.
function makeScheduler() {
  let seq = 1;
  const tasks = new Map();
  return {
    setTimeout: (fn, delay) => {
      const id = seq++;
      tasks.set(id, { fn, delay });
      return id;
    },
    clearTimeout: (id) => tasks.delete(id),
    pending: () => [...tasks.values()],
    lastDelay: () => {
      const v = [...tasks.values()];
      return v.length ? v[v.length - 1].delay : null;
    },
    flush: async () => {
      const v = [...tasks.values()];
      tasks.clear();
      for (const t of v) await t.fn();
    },
  };
}

function okResponse(ac) {
  return { ok: true, status: 200, json: async () => ({ ac }) };
}

function makeService(overrides = {}) {
  const scheduler = overrides.scheduler || makeScheduler();
  const nav = overrides.nav || { onLine: true };
  const fetchFn = overrides.fetchFn || vi.fn(async () => okResponse([]));
  const svc = new FlightDataService({
    fetchFn,
    setTimeout: scheduler.setTimeout,
    clearTimeout: scheduler.clearTimeout,
    navigator: nav,
    now: overrides.now || (() => 1000),
    pollIntervalMs: 12000,
    backoffStartMs: 30000,
    backoffMaxMs: 300000,
    maxInstances: 3,
  });
  return { svc, scheduler, fetchFn, nav };
}

describe('validateAircraft — trust boundary clamp (REQ-460 boundary, NFR)', () => {
  it('clamps out-of-range coordinates and fills numeric fallbacks', () => {
    const a = validateAircraft({ hex: 'abc', lat: 200, lon: -400, alt_baro: 'ground', track: 720, gs: -5 });
    expect(a.lat).toBe(90);
    expect(a.lon).toBe(-180);
    expect(a.alt).toBe(0); // 'ground' -> 0
    expect(a.track).toBe(0); // 720 wraps/clamps to a sane heading
    expect(a.gs).toBe(0); // negative speed floored
  });

  it('rejects records without usable numeric lat/lon', () => {
    expect(validateAircraft({ hex: 'x', lat: 'NaN', lon: 5 })).toBeNull();
    expect(validateAircraft({ hex: 'x' })).toBeNull();
    expect(validateAircraft(null)).toBeNull();
  });

  it('passes a clean record through unchanged', () => {
    const a = validateAircraft({ hex: 'd1', lat: 51.5, lon: -0.1, alt_baro: 35000, track: 270, gs: 450 });
    expect(a).toMatchObject({ hex: 'd1', lat: 51.5, lon: -0.1, alt: 35000, track: 270, gs: 450 });
  });
});

describe('deadReckon — motion between polls', () => {
  it('advances position along the heading by ground speed over dt', () => {
    // Due north (track 0) at 3600 knots for 1s = 1 nm north ~ 1/60 deg lat.
    const next = deadReckon({ lat: 0, lon: 0, track: 0, gs: 3600 }, 1);
    expect(next.lat).toBeCloseTo(1 / 60, 4);
    expect(next.lon).toBeCloseTo(0, 6);
  });

  it('moves east for a 90-degree track', () => {
    const next = deadReckon({ lat: 0, lon: 0, track: 90, gs: 3600 }, 1);
    expect(next.lon).toBeGreaterThan(0);
    expect(next.lat).toBeCloseTo(0, 5);
  });
});

describe('FlightDataService state machine (REQ-480)', () => {
  let s;
  beforeEach(() => { s = makeService(); });

  it('starts OFF (opt-in) and transitions to LOADING then LIVE on success', async () => {
    expect(s.svc.state).toBe(FLIGHT_STATE.OFF);
    const p = s.svc.start();
    expect(s.svc.state).toBe(FLIGHT_STATE.LOADING);
    await p;
    expect(s.svc.state).toBe(FLIGHT_STATE.LIVE);
  });

  it('LIVE with zero aircraft is a valid empty sky, distinct from an error (REQ-490)', async () => {
    await s.svc.start();
    expect(s.svc.state).toBe(FLIGHT_STATE.LIVE);
    expect(s.svc.getAircraft()).toEqual([]);
    expect(s.svc.count).toBe(0);
  });

  it('caps rendered instances defensively', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ hex: `h${i}`, lat: 1, lon: 1, alt_baro: 1000, track: 0, gs: 100 }));
    const { svc } = makeService({ fetchFn: vi.fn(async () => okResponse(many)) });
    await svc.start();
    expect(svc.getAircraft().length).toBe(3); // maxInstances
  });
});

describe('FlightDataService failure handling (REQ-430/440/470)', () => {
  it('HTTP 429 -> RATE_LIMITED and schedules backoff at >= 30s, doubling on repeats', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 429 }));
    const { svc, scheduler } = makeService({ fetchFn });
    await svc.start();
    expect(svc.state).toBe(FLIGHT_STATE.RATE_LIMITED);
    expect(scheduler.lastDelay()).toBe(30000);
    await scheduler.flush(); // second failure
    expect(scheduler.lastDelay()).toBe(60000);
    await scheduler.flush(); // third
    expect(scheduler.lastDelay()).toBe(120000);
  });

  it('network/CORS error -> OFFLINE, keeps other features alive, backs off (no fast retry)', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('CORS'); });
    const { svc, scheduler } = makeService({ fetchFn });
    await svc.start();
    expect(svc.state).toBe(FLIGHT_STATE.OFFLINE);
    expect(scheduler.lastDelay()).toBeGreaterThanOrEqual(30000);
  });

  it('a successful poll after failure resets the interval back to the normal cadence', async () => {
    let calls = 0;
    const fetchFn = vi.fn(async () => (++calls === 1 ? { ok: false, status: 429 } : okResponse([])));
    const { svc, scheduler } = makeService({ fetchFn });
    await svc.start();
    expect(scheduler.lastDelay()).toBe(30000);
    await scheduler.flush(); // now succeeds
    expect(svc.state).toBe(FLIGHT_STATE.LIVE);
    expect(scheduler.lastDelay()).toBe(12000);
  });
});

describe('FlightDataService offline short-circuit (REQ-440)', () => {
  it('makes ZERO requests and sets OFFLINE immediately with no retry loop when navigator is offline', async () => {
    const fetchFn = vi.fn(async () => okResponse([]));
    const { svc, scheduler } = makeService({ fetchFn, nav: { onLine: false } });
    await svc.start();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(svc.state).toBe(FLIGHT_STATE.OFFLINE);
    expect(scheduler.pending()).toEqual([]); // no retry loop scheduled
  });
});

describe('FlightDataService lifecycle — no timer leak on stop (WARN guard, REQ-355)', () => {
  it('stop() clears the pending timer and goes OFF', async () => {
    const { svc, scheduler } = makeService();
    await svc.start();
    expect(scheduler.pending().length).toBe(1);
    svc.stop();
    expect(scheduler.pending()).toEqual([]);
    expect(svc.state).toBe(FLIGHT_STATE.OFF);
  });

  it('a poll resolving AFTER stop() does not mutate state or reschedule (dispose mid-flight)', async () => {
    let resolve;
    const fetchFn = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { svc, scheduler } = makeService({ fetchFn });
    const p = svc.start();
    svc.stop(); // disposed while the fetch is still in flight
    resolve(okResponse([{ hex: 'late', lat: 1, lon: 1, alt_baro: 1, track: 0, gs: 1 }]));
    await p;
    expect(svc.state).toBe(FLIGHT_STATE.OFF);
    expect(scheduler.pending()).toEqual([]);
    expect(svc.getAircraft()).toEqual([]);
  });
});
