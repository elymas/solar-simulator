// Size-comparison lineup (SPEC-PLAY-001 REQ-PLAY-101..104).
//
// The lineup is now DRAWN IN 3D (SizeCompareScene) inside a DOM overlay that
// still owns the chrome: the backdrop, the spoken fact, the close button and the
// accessible labels. The 2D disc row it replaces is described in git history.
//
// What did NOT change is the claim being made. The row IS the width claim: the
// big body spans LANE_WIDTH and each unit spans LANE_WIDTH / ratio, so laying
// `count` of them side by side spans the big body exactly. That is why the scene
// is orthographic — a perspective camera would widen the near end of the row and
// the picture would stop matching the sentence. One geometry still serves both
// REQ-PLAY-101 (count fact) and REQ-PLAY-102 (true relative diameters).
//
// REQ-PLAY-103 (opening this touches neither the main scene, the selection nor
// the camera) used to hold because the class was all DOM. It now holds because
// SizeCompareScene builds its OWN renderer/scene/camera and disposes them on
// close — it never reaches for the shared render core.

import { PLANET_DATA } from '../planets/planetData.js';
import { STR } from '../ui/strings.js';
import { speak as ttsSpeak } from '../audio/tts.js';
import { emitPlayEvent } from './playEvents.js';
import { SizeCompareScene, LANE_WIDTH } from './SizeCompareScene.js';

export { LANE_WIDTH };

// @MX:NOTE: [AUTO] The countability budget, not a taste knob. At LANE_WIDTH_PX a
// row of 120 discs is ~2.2 px each — already the floor of "a child can see there
// are lots". Sun/Earth (109) is the flagship lineup and must stay inside it;
// Betelgeuse/Sun (886) and Earth/Deimos (1028) cannot be drawn as a countable row
// at any lane width, so those rows are dropped rather than faked.
export const MAX_COUNT = 120;

/** Reference bodies, in the order a child should meet them: home first. */
const REFERENCES = ['earth', 'sun'];

/** SPEC-KIDS-001 §8.1 rule 3: a spoken number may not drift past ±10% of truth. */
const COUNT_TOLERANCE = 0.1;

const DEFAULT_COLOR = '#8899aa';

// @MX:NOTE: [AUTO] Ratios come from `radius` — the REAL radius in km — and never
// from `displayRadius`, which is a symbolic scene unit chosen so Mercury stays
// visible next to the Sun. Reading the wrong field would silently turn an honest
// 109:1 into whatever looked good in the 3D view (REQ-PLAY-102).
/**
 * Every comparison row for a body, largest-first inside each row.
 * @param {string} key
 * @param {Object} data - Resolved body data (planet, moon or star).
 * @returns {Array<{big: Object, small: Object, ratio: number, count: number, factKo: string}>}
 */
export function comparisonRows(key, data) {
  const self = toEntry(key, data);
  if (!self) return [];

  const rows = [];
  for (const referenceKey of REFERENCES) {
    if (referenceKey === key) continue; // Earth never lines up against itself
    const reference = toEntry(referenceKey, PLANET_DATA[referenceKey]);
    if (!reference) continue;

    const [big, small] = self.radius >= reference.radius ? [self, reference] : [reference, self];
    const ratio = big.radius / small.radius;
    // Halves, not whole bodies: Earth/Mercury is 2.61, and "3개" would be 15%
    // off — past §8.1's ±10% window. "2개 반" is 4% off and is the wording the
    // hand-authored sizeComparisonKo for Mercury already uses.
    const count = Math.round(ratio * 2) / 2;
    if (count > MAX_COUNT) continue;
    // A count no half can state honestly is not spoken at all. Nearest-half
    // error is 0.25/ratio, so this only bites in the narrow 1.25–2.5 band —
    // where Sirius A (1.71 suns) lands. Its lineup is dropped rather than
    // rounded to a lie; the InfoPanel's authored "1.7배쯤" fact still tells the
    // child the truth in the place that nuance belongs.
    if (count > 1 && Math.abs(count / ratio - 1) > COUNT_TOLERANCE) continue;

    rows.push({ big, small, ratio, count, factKo: countFact(big, small, count) });
  }
  return rows;
}

/**
 * Whether the "크기 비교" entry point should be offered — data-driven, never a
 * hardcoded list (acceptance §3): a body with no real diameter, or none whose
 * lineup is countable, simply has no comparison to show.
 * @param {string} key
 * @param {Object} data
 * @returns {boolean}
 */
export function canCompareSize(key, data) {
  return comparisonRows(key, data).length > 0;
}

function toEntry(key, data) {
  if (!data || typeof data.radius !== 'number' || !(data.radius > 0)) return null;
  return {
    key,
    nameKo: data.nameKo || data.name || key,
    color: hexColor(data.color),
    radius: data.radius,
  };
}

function hexColor(color) {
  return typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : DEFAULT_COLOR;
}

// A rounded count of 1 would read "지구 1개를 나란히 놓으면 금성 폭이에요!" — true,
// useless, and confusing at five. Near-equal pairs get their own wording instead.
function countFact(big, small, count) {
  return count <= 1
    ? STR.playCompareSame(big.nameKo, small.nameKo)
    : STR.playCompareCount(small.nameKo, countPhrase(count), big.nameKo);
}

// The object particle rides along because it differs between the two forms:
// 개 ends on a vowel (개를), 반 on a consonant (반을).
function countPhrase(count) {
  const whole = Math.floor(count);
  return count % 1 ? `${whole}개 반을` : `${count}개를`;
}

let stylesInjected = false;

// @MX:ANCHOR: [AUTO] The "크기 비교" surface. InfoPanel's button opens it through
// SolarSystemView; the mission engine learns of it through the emitted event.
// @MX:SPEC: [AUTO] SPEC-PLAY-001 REQ-PLAY-101/103
// @MX:REASON: [AUTO] REQ-PLAY-103 requires the 3D scene, the selection and the
// camera to be untouched by opening and closing this. That holds because the
// whole class is DOM — a future variant that reached for the renderer here would
// break the guarantee silently, so the boundary lives at this entry point.
export class SizeCompare {
  /**
   * @param {Object} [opts]
   * @param {Function} [opts.speak] - TTS channel (shared mute lives in tts.js).
   * @param {Function} [opts.emit] - Play-event emitter.
   * @param {boolean} [opts.reducedMotion] - REQ-PLAY-104: instant layout.
   * @param {Document} [opts.doc]
   */
  constructor({
    speak = ttsSpeak,
    emit = emitPlayEvent,
    reducedMotion = false,
    doc = document,
    createScene = (opts) => new SizeCompareScene(opts),
    win = typeof window !== 'undefined' ? window : null,
  } = {}) {
    this.speak = speak;
    this.emit = emit;
    this.reducedMotion = Boolean(reducedMotion);
    this.doc = doc;
    this._createScene = createScene;
    this._win = win;
    this._open = false;
    this._scenes = [];
    this._canvases = [];

    injectStyles(doc);
    this._build();
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    this.doc.addEventListener('keydown', this._onKeyDown);
    // Rotating a phone changes the canvas box, and an orthographic frustum fitted
    // to the old box would crop the lineup — the one thing this picture may not do.
    this._onResize = () => { for (const scene of this._scenes) scene.resize(); };
    if (this._win) this._win.addEventListener('resize', this._onResize);
  }

  get isOpen() {
    return this._open;
  }

  /**
   * Show the lineup for a body and speak its count fact once.
   * @param {string} key
   * @param {Object} data - Resolved body data.
   * @returns {boolean} false when the body has nothing comparable to show
   */
  open(key, data) {
    const rows = comparisonRows(key, data);
    if (!rows.length) return false;

    this.rows = rows;
    // Reset before rendering: _renderRow appends to this, and a second open()
    // would otherwise hand _startScenes the previous opening's dead canvases.
    this._canvases = [];
    this._panel.replaceChildren(this._closeBtn, ...rows.map((row) => this._renderRow(row)));
    this.doc.body.appendChild(this.el);
    this._open = true;
    // Strictly after the overlay is in the document: the scene sizes its frustum
    // from the canvas's laid-out box, which is 0x0 until then.
    this._startScenes(rows);

    // The fact is spoken before the event so that, on the one body where opening
    // also completes a mission (compare-sun), the praise lands last and the
    // reward is what the child actually hears — the fact stays on screen in big
    // type and one more tap replays it.
    this.speak(rows[0].factKo);
    this.emit('size-compare', { body: key });
    return true;
  }

  /** Restore the prior UI state: the overlay leaves, nothing else is touched. */
  close() {
    if (!this._open) return;
    this._open = false;
    // Before the overlay leaves the DOM: disposing frees the GPU context, which
    // is what puts the app back to a single live WebGL context between openings.
    this._stopScenes();
    this.el.remove();
  }

  dispose() {
    this.close();
    this.doc.removeEventListener('keydown', this._onKeyDown);
    if (this._win) this._win.removeEventListener('resize', this._onResize);
  }

  /**
   * Build one 3D lineup per comparison row.
   *
   * A failure here must not cost the child the fact: the overlay's text, close
   * button and speech are already live, so a scene that cannot start (no WebGL,
   * a lost context, a headless test environment) is skipped and the panel stays
   * usable as a text card.
   * @param {Array} rows
   */
  _startScenes(rows) {
    this._scenes = [];
    for (let i = 0; i < rows.length; i += 1) {
      const canvas = this._canvases[i];
      if (!canvas) continue;
      try {
        const scene = this._createScene({ canvas, reducedMotion: this.reducedMotion });
        scene.show(rows[i]);
        this._scenes.push(scene);
      } catch {
        // Leave the row as its text; nothing else in the overlay depends on it.
      }
    }
  }

  _stopScenes() {
    for (const scene of this._scenes) scene.dispose();
    this._scenes = [];
  }

  _build() {
    const doc = this.doc;
    this.el = doc.createElement('div');
    // The animation class is the ONLY difference reduced motion makes; content
    // is built by the same code path, so it cannot drift (AC-PLAY-104).
    this.el.className = `sizecompare${this.reducedMotion ? '' : ' sizecompare--animated'}`;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', STR.playCompareTitle);
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    this._panel = doc.createElement('div');
    this._panel.className = 'sizecompare-panel';
    this._panel.addEventListener('click', (e) => e.stopPropagation());

    this._closeBtn = doc.createElement('button');
    this._closeBtn.className = 'sizecompare-close';
    this._closeBtn.textContent = '×';
    this._closeBtn.setAttribute('aria-label', STR.playClose);
    this._closeBtn.addEventListener('click', () => this.close());

    this.el.appendChild(this._panel);
  }

  _renderRow({ big, small, count, factKo }) {
    const doc = this.doc;
    const row = doc.createElement('div');
    row.className = 'sizecompare-row';

    const fact = doc.createElement('p');
    fact.className = 'sizecompare-fact';
    fact.textContent = factKo;

    const canvas = doc.createElement('canvas');
    canvas.className = 'sizecompare-canvas';
    // The picture is decorative: everything it says is in the fact above it and
    // in the names below, both of which a screen reader already reads.
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.big = big.key;
    canvas.dataset.small = small.key;
    canvas.dataset.count = String(count);
    this._canvases.push(canvas);

    // Names stay in the DOM rather than becoming 3D labels: they are the
    // accessible reading of the picture, and text in a canvas is invisible to
    // assistive tech (REQ-KIDS-105).
    const legend = doc.createElement('div');
    legend.className = 'sizecompare-legend';
    legend.append(name(doc, big.nameKo), name(doc, small.nameKo));

    row.append(fact, canvas, legend);
    return row;
  }
}

function name(doc, text) {
  const el = doc.createElement('span');
  el.className = 'sizecompare-name';
  el.textContent = text;
  return el;
}

function injectStyles(doc) {
  if (stylesInjected && doc === document) return;
  stylesInjected = true;
  const style = doc.createElement('style');
  style.textContent = `
    .sizecompare {
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
    /* Absent under prefers-reduced-motion (REQ-PLAY-104): the layout is then
       instant and every other rule below is identical. */
    .sizecompare--animated .sizecompare-panel {
      animation: sizecompare-in 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
    @keyframes sizecompare-in {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: none; }
    }
    .sizecompare-panel {
      position: relative;
      /* Wide enough for the unit row to be countable. The Sun lineup lays 109
         Earths across this width; at the old 340px each was ~3px and the row read
         as a dotted line. This is the same "countability budget" MAX_COUNT is
         chosen against — the two have to agree or the cap stops meaning anything. */
      max-width: 720px;
      width: 100%;
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid rgba(22, 199, 255, 0.2);
      border-radius: 16px;
      padding: 56px 24px 24px;
    }
    .sizecompare-close {
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
    .sizecompare-row + .sizecompare-row {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    /* The count fact is the point of the screen, so it is the biggest type on
       it (REQ-PLAY-101 "rendered large"). */
    .sizecompare-fact {
      font-size: 26px;
      line-height: 1.4;
      font-weight: 700;
      color: #16c7ff;
      margin: 0 0 20px 0;
    }
    /* The lineup's own aspect is wide-and-short (one body plus a row beside it),
       so the canvas is given a wide box and the orthographic frustum fits itself
       to whatever that box actually measures. */
    .sizecompare-canvas {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      max-height: 40vh;
      touch-action: none;
    }
    .sizecompare-legend {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
    }
    .sizecompare-name {
      font-size: 15px;
      color: #b0b0b0;
      flex-shrink: 0;
    }
  `;
  doc.head.appendChild(style);
}
