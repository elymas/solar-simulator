// Planetary alignment detection (SPEC-EVENTS-001 REQ-EVT-301, 302, 304).
//
// `eclipseData.js` gets its frame-step immunity from range-testing a table of
// instants: an eclipse happens AT a moment, so the detector asks "did that
// moment fall inside the interval this frame covered?". An alignment is not an
// instant — it is a STATE that holds for sim-weeks — so the same immunity takes
// the other form here: a predicate over the current longitudes, plus hysteresis
// so the answer cannot flicker at the boundary. The sweep test in
// alignment.test.js is what pins the equivalent guarantee (AC-EVT-304).
//
// Pure module: no renderer, no DOM, no clock.

/** Planets that must fall inside the window before it counts as an alignment. */
export const ALIGNMENT_MIN_PLANETS = 4;

/** Longitude window (degrees) at or below which an alignment ENTERS. */
export const ALIGNMENT_ENTER_DEG = 30;

/** Longitude window (degrees) above which an alignment EXITS. */
export const ALIGNMENT_EXIT_DEG = 40;

// @MX:NOTE: [AUTO] The 8 planets only — deliberately not `Object.keys(PLANET_DATA)`,
// which now also holds five dwarfs (category 'dwarf') and Halley (category 'comet').
// With 13 candidates instead of 8, four-within-thirty-degrees stops being rare and
// the banner stops meaning anything.
// @MX:SPEC: [AUTO] SPEC-EVENTS-001 REQ-EVT-301
export const ALIGNMENT_PLANET_KEYS = [
  'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
];

// Per-call scratch, hoisted so the frame path allocates nothing (same rule as
// Belts.js and CometTail.js). Single-threaded and never held across a yield.
const _norm = [];
const _order = [];

const normalizeDeg = (deg) => ((deg % 360) + 360) % 360;

/**
 * Find the tightest longitude window covering at least `minPlanets` bodies.
 *
 * Sorting the longitudes makes the tightest window one of the n runs of
 * `minPlanets` consecutive entries; adding a body to a run can only widen it, so
 * the tightest window covering AT LEAST N is always a window covering EXACTLY N.
 * The 0/360 seam is handled by letting a run continue past the end of the sorted
 * order with +360 added, which is the same thing as duplicating the sorted array.
 *
 * @param {ArrayLike<number>} longitudes - Heliocentric longitudes in degrees, any range.
 * @param {number} [minPlanets] - N.
 * @param {number} [maxWindowDeg] - Window at or below which `aligned` is true.
 * @param {Object} [out] - Result object to write into, so the per-frame caller
 *   allocates nothing. Its `members` array is reused as well.
 * @returns {{aligned: boolean, count: number, windowDeg: number, members: number[]}}
 *   `windowDeg` is the tightest qualifying window and is reported whether or not
 *   it qualifies — that is what the hysteresis reads. `members` holds INDICES
 *   into `longitudes`, in increasing-longitude order from the window's leading
 *   edge, and is meaningful only when `aligned` is true.
 */
export function detectAlignment(
  longitudes,
  minPlanets = ALIGNMENT_MIN_PLANETS,
  maxWindowDeg = ALIGNMENT_ENTER_DEG,
  out = null
) {
  const result = out || { aligned: false, count: 0, windowDeg: Infinity, members: [] };
  const members = result.members || (result.members = []);
  members.length = 0;

  const n = longitudes.length;
  if (minPlanets < 1 || n < minPlanets) {
    result.aligned = false;
    result.count = 0;
    result.windowDeg = Infinity;
    return result;
  }

  _norm.length = n;
  _order.length = n;
  for (let i = 0; i < n; i++) {
    _norm[i] = normalizeDeg(longitudes[i]);
    _order[i] = i;
  }
  _order.sort((a, b) => _norm[a] - _norm[b]);

  let bestStart = 0;
  let bestSpan = Infinity;
  for (let s = 0; s < n; s++) {
    const e = s + minPlanets - 1;
    const span = _norm[_order[e % n]] + (e >= n ? 360 : 0) - _norm[_order[s]];
    if (span < bestSpan) {
      bestSpan = span;
      bestStart = s;
    }
  }

  // Take the tightest run, then keep any further body that is still inside the
  // window — so five planets in a row report five members, not the first four.
  for (let k = 0; k < n; k++) {
    const pos = bestStart + k;
    const span = _norm[_order[pos % n]] + (pos >= n ? 360 : 0) - _norm[_order[bestStart]];
    if (k >= minPlanets && span > maxWindowDeg) break;
    members.push(_order[pos % n]);
  }

  result.windowDeg = bestSpan;
  result.aligned = bestSpan <= maxWindowDeg;
  result.count = members.length;
  return result;
}

/**
 * The detector plus hysteresis: one enter per formation, one exit per dispersal.
 *
 * The whole state machine is "which threshold do I ask with" — while unaligned
 * the predicate is asked at the ENTER window, while aligned at the wider EXIT
 * window. A formation hovering on the 30-degree boundary therefore answers
 * "still aligned" until it genuinely disperses past 40.
 */
export class AlignmentTracker {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.minPlanets]
   * @param {number} [opts.enterDeg]
   * @param {number} [opts.exitDeg]
   */
  constructor({
    minPlanets = ALIGNMENT_MIN_PLANETS,
    enterDeg = ALIGNMENT_ENTER_DEG,
    exitDeg = ALIGNMENT_EXIT_DEG,
  } = {}) {
    this.minPlanets = minPlanets;
    this.enterDeg = enterDeg;
    this.exitDeg = exitDeg;
    this.aligned = false;
    this.result = { aligned: false, count: 0, windowDeg: Infinity, members: [] };
  }

  /**
   * Sample the current longitudes.
   * @param {ArrayLike<number>} longitudes - Heliocentric longitudes in degrees.
   * @returns {'enter'|'exit'|null} The transition this sample crossed, if any.
   */
  update(longitudes) {
    const threshold = this.aligned ? this.exitDeg : this.enterDeg;
    const result = detectAlignment(longitudes, this.minPlanets, threshold, this.result);
    if (result.aligned === this.aligned) return null;
    this.aligned = result.aligned;
    return this.aligned ? 'enter' : 'exit';
  }
}
