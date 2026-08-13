import { PLANET_DATA, MOON_DATA } from '../planets/planetData.js';
import { STR } from '../ui/strings.js';
import { ECLIPSE_SCALE_NOTE } from '../utils/eclipseData.js';
import { speak as ttsSpeak } from '../audio/tts.js';
import { emitPlayEvent } from './playEvents.js';
import { eligibleDestinations, travelFactKo } from './travelFacts.js';
import { RocketTripScene } from './RocketTripScene.js';

// The "로켓 발사" surface (SPEC-PLAY-001 REQ-PLAY-201..205).
//
// This replaces a flight drawn into the shared solar-system scene. The old one
// was invisible on a phone: the info panel covers the viewport there, so the
// journey played behind an opaque card and the button read as broken. This is
// the same shape 크기 비교 already had — its own overlay, its own renderer,
// disposed on close — which is also why opening it cannot disturb the main
// scene, the selection or the camera (REQ-PLAY-103's guarantee, borrowed).
//
// HONESTY. The spoken fact is still travelFacts' real mission duration, and the
// only number added here is a distance computed from planetData's own AU
// figures. The picture itself is a schematic: same-sized bodies on a dotted
// road, carrying the eclipse diagram's "그림 크기는 실제와 달라요" note so it can
// never be read as a size claim (크기 비교 owns that).

const AU_KM = 149597870.7;
const LAUNCH_SITE = 'earth';
const DEFAULT_COLOR = '#8899aa';

let stylesInjected = false;

/**
 * Resolve any launchable body to the flat entry the diagram draws. The Moon
 * lives in MOON_DATA rather than PLANET_DATA, which is also why it is the one
 * body whose distance is a fixed number rather than an orbit gap.
 * @param {string} key
 * @returns {{key:string, nameKo:string, color:string, distanceAu:number|null, distanceKm:number|null}|null}
 */
export function bodyEntry(key) {
  const planet = PLANET_DATA[key];
  const moon = (MOON_DATA[LAUNCH_SITE] || []).find((m) => m.key === key);
  const data = planet || moon;
  if (!data) return null;
  return {
    key,
    nameKo: data.nameKo || data.name || key,
    color: typeof data.color === 'number' ? `#${data.color.toString(16).padStart(6, '0')}` : DEFAULT_COLOR,
    distanceAu: typeof data.distance === 'number' ? data.distance : null,
    distanceKm: typeof data.distanceFromParent === 'number' ? data.distanceFromParent : null,
  };
}

/**
 * How far the rocket has to go, in km.
 *
 * For a body orbiting the Sun this is the gap between the two orbits — the
 * closest the two worlds ever come. It is a floor, not an average: quoting the
 * far side would make Mars sound further than Jupiter can be near, and quoting a
 * mean would be a number the child could never check against anything.
 * The Moon orbits Earth, so its distance is simply its own.
 * @param {string} key
 * @returns {number|null} null when the body has no honest single number
 */
export function tripDistanceKm(key) {
  const entry = bodyEntry(key);
  if (!entry) return null;
  if (entry.distanceKm != null) return entry.distanceKm;
  const earth = bodyEntry(LAUNCH_SITE);
  if (entry.distanceAu == null || !earth || earth.distanceAu == null) return null;
  return Math.abs(entry.distanceAu - earth.distanceAu) * AU_KM;
}

/**
 * Korean magnitude wording. Below 1억 the number reads in 만 because that is the
 * unit a Korean child hears distances in; above it, 억 with one decimal so
 * Jupiter and Eris stay different numbers instead of both rounding to "몇억".
 * @param {number} km
 * @returns {string}
 */
export function formatDistanceKo(km) {
  if (!Number.isFinite(km) || km <= 0) return '';
  if (km >= 1e8) {
    const eok = km / 1e8;
    const value = eok >= 100 ? Math.round(eok) : Math.round(eok * 10) / 10;
    return `${value}억 ${STR.playTripKm}`;
  }
  return `${Math.round(km / 1e4).toLocaleString('ko-KR')}만 ${STR.playTripKm}`;
}

/**
 * The one sentence this overlay speaks: the duration fact, then the distance.
 *
 * Spoken as ONE string rather than two speak() calls because tts.speak cancels
 * whatever is already talking — a second call would cut the first off mid-word.
 * Exported so scripts/tts-phrases.mjs can bake a recorded take of it; a phrase
 * the collector cannot see silently degrades to the device voice.
 * @param {string} key
 * @returns {string}
 */
export function tripSpeechKo(key) {
  const factKo = travelFactKo(key);
  const line = tripDistanceLineKo(key);
  if (!factKo) return line || '';
  return line ? `${factKo} ${line}` : factKo;
}

/**
 * The distance sentence, worded for how the number was derived: a moon states a
 * fixed orbit radius, a planet the closest the two orbits ever come.
 * @param {string} key
 * @returns {string}
 */
export function tripDistanceLineKo(key) {
  const entry = bodyEntry(key);
  const distance = formatDistanceKo(tripDistanceKm(key));
  if (!entry || !distance) return '';
  return entry.distanceKm != null
    ? STR.playTripDistanceFixed(distance)
    : STR.playTripDistanceNear(distance);
}

// @MX:ANCHOR: [AUTO] The "로켓 발사" surface. InfoPanel's button opens it through
// SolarSystemView; the mission engine learns of the arrival through the event.
// @MX:SPEC: [AUTO] SPEC-PLAY-001 REQ-PLAY-201/203/205
// @MX:REASON: [AUTO] The overlay must never reach for the app's renderer, scene
// or camera — that is what keeps a launch from disturbing the child's view, and
// it is the property the previous in-scene implementation could not offer.
export class RocketTrip {
  /**
   * @param {Object} [opts]
   * @param {Function} [opts.speak] - TTS channel (shared mute lives in tts.js).
   * @param {Function} [opts.emit] - Play-event emitter.
   * @param {boolean} [opts.reducedMotion]
   * @param {Document} [opts.doc]
   * @param {Function} [opts.createScene] - Injected for tests (no WebGL in jsdom).
   * @param {Window} [opts.win]
   */
  constructor({
    speak = ttsSpeak,
    emit = emitPlayEvent,
    reducedMotion = false,
    doc = document,
    createScene = (opts) => new RocketTripScene(opts),
    win = typeof window !== 'undefined' ? window : null,
  } = {}) {
    this.speak = speak;
    this.emit = emit;
    this.reducedMotion = Boolean(reducedMotion);
    this.doc = doc;
    this._createScene = createScene;
    this._win = win;
    this._open = false;
    this._scene = null;
    this._spokenKo = '';

    injectStyles(doc);
    this._build();
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    this.doc.addEventListener('keydown', this._onKeyDown);
    this._onResize = () => { if (this._scene) this._scene.resize(); };
    if (this._win) this._win.addEventListener('resize', this._onResize);
  }

  get isOpen() {
    return this._open;
  }

  /**
   * Whether the "로켓 발사" entry point should be offered. Data-driven through
   * travelFacts, so a body with no honest one-way duration offers no button.
   * @param {string} key
   * @returns {boolean}
   */
  canLaunch(key) {
    return eligibleDestinations().includes(key);
  }

  /**
   * Open the trip overlay for a destination and speak its duration fact once.
   * Named `launch` because it is the same seam the in-scene journey exposed.
   * @param {string} key
   * @returns {boolean} false when the body cannot be flown to
   */
  launch(key) {
    if (!this.canLaunch(key)) return false;
    const from = bodyEntry(LAUNCH_SITE);
    const to = bodyEntry(key);
    if (!from || !to) return false;

    const factKo = travelFactKo(key);
    this._spokenKo = tripSpeechKo(key);

    this._factEl.textContent = factKo || '';
    this._distanceEl.textContent = tripDistanceLineKo(key);
    this._fromNameEl.textContent = from.nameKo;
    this._toNameEl.textContent = to.nameKo;

    this.doc.body.appendChild(this.el);
    this._open = true;
    // Strictly after the overlay is in the document: the scene fits its frustum
    // to the canvas's laid-out box, which is 0x0 until then.
    this._startScene({ from, to, key });

    // The distance rides along with the fact: a five-year-old cannot read
    // "7,839만 킬로미터" off the screen, so the number only exists if it is said.
    if (this._spokenKo) this.speak(this._spokenKo);
    this.emit('rocket-launch', { body: key });
    return true;
  }

  /** Close and free the GPU context. `cancel` is the seam the view already calls. */
  close() {
    if (!this._open) return;
    this._open = false;
    this._stopScene();
    this.el.remove();
  }

  cancel() {
    this.close();
  }

  dispose() {
    this.close();
    this.doc.removeEventListener('keydown', this._onKeyDown);
    if (this._win) this._win.removeEventListener('resize', this._onResize);
  }

  _startScene(trip) {
    // A scene that cannot start (no WebGL, a lost context, a headless test) must
    // not cost the child the trip: the fact, the distance and the names are
    // already on screen, and the arrival still fires so missions still tick.
    try {
      this._scene = this._createScene({
        canvas: this._canvas,
        reducedMotion: this.reducedMotion,
        onArrive: () => this.emit('rocket-arrived', { body: trip.key }),
      });
      this._scene.show(trip);
    } catch {
      this._scene = null;
      this.emit('rocket-arrived', { body: trip.key });
    }
  }

  _stopScene() {
    if (!this._scene) return;
    this._scene.dispose();
    this._scene = null;
  }

  _build() {
    const doc = this.doc;
    this.el = doc.createElement('div');
    this.el.className = `rockettrip${this.reducedMotion ? '' : ' rockettrip--animated'}`;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', STR.playTripTitle);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    const panel = doc.createElement('div');
    panel.className = 'rockettrip-panel';
    panel.addEventListener('click', (e) => e.stopPropagation());

    const closeBtn = doc.createElement('button');
    closeBtn.className = 'rockettrip-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', STR.playClose);
    closeBtn.addEventListener('click', () => this.close());

    // The duration fact is the point of the screen, so it is the biggest type on
    // it — the same rule the size comparison's count fact follows.
    this._factEl = doc.createElement('p');
    this._factEl.className = 'rockettrip-fact';

    this._canvas = doc.createElement('canvas');
    this._canvas.className = 'rockettrip-canvas';
    // Decorative: everything it says is in the fact, the distance and the names,
    // all of which a screen reader already reads (REQ-KIDS-105).
    this._canvas.setAttribute('aria-hidden', 'true');

    const legend = doc.createElement('div');
    legend.className = 'rockettrip-legend';
    this._fromNameEl = doc.createElement('span');
    this._fromNameEl.className = 'rockettrip-name';
    this._toNameEl = doc.createElement('span');
    this._toNameEl.className = 'rockettrip-name';
    legend.append(this._fromNameEl, this._toNameEl);

    this._distanceEl = doc.createElement('p');
    this._distanceEl.className = 'rockettrip-distance';

    // Same idiom as the info panel's replay button: one tap hears it again,
    // which is how a child who missed a word gets it back.
    this._replayBtn = doc.createElement('button');
    this._replayBtn.className = 'rockettrip-replay';
    this._replayBtn.setAttribute('aria-label', STR.infoReplay);
    this._replayBtn.textContent = '\u{1F50A}';
    this._replayBtn.addEventListener('click', () => {
      if (this._spokenKo) this.speak(this._spokenKo);
    });

    const note = doc.createElement('p');
    note.className = 'rockettrip-note';
    note.textContent = ECLIPSE_SCALE_NOTE;

    panel.append(closeBtn, this._factEl, this._canvas, legend, this._distanceEl, this._replayBtn, note);
    this.el.appendChild(panel);
  }
}

function injectStyles(doc) {
  if (stylesInjected && doc === document) return;
  stylesInjected = true;
  const style = doc.createElement('style');
  style.id = 'rockettrip-styles';
  style.textContent = `
    .rockettrip {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(6, 8, 20, 0.88);
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
      font-family: 'Inter Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
      color: #e0e0e0;
      padding: 16px;
      overflow-y: auto;
    }
    .rockettrip--animated .rockettrip-panel {
      animation: rockettrip-in 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
    @keyframes rockettrip-in {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: none; }
    }
    .rockettrip-panel {
      position: relative;
      max-width: 720px;
      width: 100%;
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid rgba(22, 199, 255, 0.2);
      border-radius: 16px;
      padding: 56px 24px 24px;
    }
    .rockettrip-close {
      position: absolute;
      top: 8px;
      right: 8px;
      /* Kid-sized hit area, Apple HIG 44pt floor (SPEC-MOBILE-001 REQ-MOB-105). */
      min-width: 44px;
      min-height: 44px;
      background: none;
      border: none;
      color: #888;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    .rockettrip-fact {
      font-size: 26px;
      line-height: 1.4;
      font-weight: 700;
      color: #16c7ff;
      margin: 0 0 20px 0;
    }
    /* The diagram is wide and short — two bodies and the road between them — so
       the canvas is given a wide box and the frustum fits whatever it measures. */
    .rockettrip-canvas {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 6;
      max-height: 34vh;
      touch-action: none;
    }
    .rockettrip-legend {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 6px;
    }
    .rockettrip-name {
      font-size: 15px;
      color: #b0b0b0;
      flex-shrink: 0;
    }
    .rockettrip-distance {
      margin: 16px 0 0 0;
      font-size: 17px;
      color: #e0e0e0;
    }
    .rockettrip-replay {
      margin-top: 12px;
      font-size: 24px;
      background: none;
      border: 1px solid rgba(22, 199, 255, 0.4);
      border-radius: 12px;
      color: #16c7ff;
      cursor: pointer;
      /* Kid-sized hit area, Apple HIG 44pt floor (SPEC-MOBILE-001 REQ-MOB-105). */
      min-width: 56px;
      min-height: 48px;
    }
    .rockettrip-note {
      margin: 6px 0 0 0;
      font-size: 11px;
      color: #888;
      font-style: italic;
    }
  `;
  doc.head.appendChild(style);
}
