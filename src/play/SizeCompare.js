// Size-comparison lineup (SPEC-PLAY-001 REQ-PLAY-101..104).
//
// 2D DOM, per the resolved plan.md §A.1 decision (Option B). There is no second
// three.js scene and no extra render pass here on purpose: the count
// representation — "지구 109개를 나란히 놓으면 태양 폭이에요!" drawn as 109 little
// Earths spanning exactly one Sun-width — is what maps 1:1 to the spoken fact,
// and it survives ratios a textured mini-scene would render sub-pixel.
//
// The row IS the width claim: the big body's disc is LANE_WIDTH_PX wide and each
// unit disc is LANE_WIDTH_PX / ratio, so laying `count` of them side by side
// spans the big disc. One geometry serves both REQ-PLAY-101 (count fact) and
// REQ-PLAY-102 (true relative diameters).

import { PLANET_DATA } from '../planets/planetData.js';
import { STR } from '../ui/strings.js';
import { speak as ttsSpeak } from '../audio/tts.js';
import { emitPlayEvent } from './playEvents.js';

/** Width of the big body's disc, and therefore of the whole unit row. */
export const LANE_WIDTH_PX = 260;

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
  constructor({ speak = ttsSpeak, emit = emitPlayEvent, reducedMotion = false, doc = document } = {}) {
    this.speak = speak;
    this.emit = emit;
    this.reducedMotion = Boolean(reducedMotion);
    this.doc = doc;
    this._open = false;

    injectStyles(doc);
    this._build();
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._open) this.close();
    };
    this.doc.addEventListener('keydown', this._onKeyDown);
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

    this._panel.replaceChildren(this._closeBtn, ...rows.map((row) => this._renderRow(row)));
    this.doc.body.appendChild(this.el);
    this._open = true;

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
    this.el.remove();
  }

  dispose() {
    this.close();
    this.doc.removeEventListener('keydown', this._onKeyDown);
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

  _renderRow({ big, small, ratio, count, factKo }) {
    const doc = this.doc;
    const row = doc.createElement('div');
    row.className = 'sizecompare-row';

    const fact = doc.createElement('p');
    fact.className = 'sizecompare-fact';
    fact.textContent = factKo;

    row.append(fact, this._renderLane(big, LANE_WIDTH_PX, 'sizecompare-big'));

    // Unit discs carry the count; the name beside them is the accessible label,
    // so the strip itself is decorative.
    const units = doc.createElement('div');
    units.className = 'sizecompare-units';
    const unitWidth = LANE_WIDTH_PX / ratio;
    for (let i = 0; i < Math.floor(count); i += 1) {
      units.appendChild(disc(doc, small, unitWidth, 'sizecompare-unit'));
    }
    if (count % 1) {
      // A literal half body: half the width, full height, sliced by CSS.
      units.appendChild(
        disc(doc, small, unitWidth / 2, 'sizecompare-unit sizecompare-unit--half', unitWidth)
      );
    }
    const lane = doc.createElement('div');
    lane.className = 'sizecompare-lane';
    lane.append(units, name(doc, small.nameKo));
    row.appendChild(lane);

    return row;
  }

  _renderLane(body, width, extraClass) {
    const lane = this.doc.createElement('div');
    lane.className = 'sizecompare-lane';
    lane.append(disc(this.doc, body, width, extraClass), name(this.doc, body.nameKo));
    return lane;
  }
}

function disc(doc, body, width, extraClass, height = width) {
  const el = doc.createElement('span');
  el.className = `sizecompare-disc ${extraClass}`;
  el.dataset.body = body.key;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.background = body.color;
  return el;
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
      max-width: 340px;
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
    .sizecompare-lane {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .sizecompare-name {
      font-size: 15px;
      color: #b0b0b0;
      flex-shrink: 0;
    }
    .sizecompare-disc {
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }
    .sizecompare-unit--half {
      border-radius: 50% 0 0 50%;
    }
    /* No gap: the unit discs laid edge to edge span exactly one big disc,
       which is the "나란히 놓으면 ... 폭이에요" claim made literal. */
    .sizecompare-units {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      max-width: ${LANE_WIDTH_PX}px;
    }
  `;
  doc.head.appendChild(style);
}
