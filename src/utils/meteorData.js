import { SIM_EPOCH_MS } from './constants.js';

const DAY_MS = 86400000;

// A-401: showers recur every sim year on the same calendar (month, day); the
// real-world ±1 day drift across years (leap-year wobble) is an accepted
// simplification. Unlike eclipseData.js's ECLIPSE_TABLE (real cataloged
// instants, not periodic), a shower is a periodic calendar predicate — no
// per-year table to regenerate.

// Fixed non-leap reference year used only to turn a (month, day) pair into a
// comparable ordinal (1..365). Only relative day offsets matter, so the year
// itself is arbitrary; Feb 29 in an actual leap year rolls into ordinal ~Mar 1
// (same accepted A-401 simplification).
const REF_YEAR = 2001;
const ORDINAL_YEAR_DAYS = 365;

/** (month 1-12, day 1-31) -> ordinal day-of-year (1..365) in the fixed reference year. */
function ordinalOf(month, day) {
  return Math.round((Date.UTC(REF_YEAR, month - 1, day) - Date.UTC(REF_YEAR, 0, 1)) / DAY_MS) + 1;
}

/** sim-day number -> ordinal day-of-year, via the shared SIM_EPOCH anchor. */
function simDayOrdinal(simDay) {
  const d = new Date(SIM_EPOCH_MS + simDay * DAY_MS);
  return ordinalOf(d.getUTCMonth() + 1, d.getUTCDate());
}

// @MX:NOTE: [AUTO] Wrap-aware range membership: when start > end (Quadrantids
// Dec 28 -> Jan 12), the range crosses Dec 31, so membership is "outside the
// gap" (code >= start OR code <= end) rather than a normal [start, end] test.
// @MX:REASON: A plain start<=code<=end test would incorrectly reject every
// date in a year-wrapping range; this is the single comparison every export
// below routes through, so getting it wrong breaks activity/intensity/entry
// detection identically.
function inRange(code, start, end) {
  return start <= end ? code >= start && code <= end : code >= start || code <= end;
}

function showerActiveAt(shower, simDay) {
  return inRange(simDayOrdinal(simDay), shower.start, shower.end);
}

/** Forward distance in days from ordinal `a` to ordinal `b`, wrapping the year. */
function forwardDist(a, b) {
  return (b - a + ORDINAL_YEAR_DAYS) % ORDINAL_YEAR_DAYS;
}

/**
 * Continuous ordinal for sub-day intensity interpolation ONLY — folds the
 * fractional part of simDay (SIM_EPOCH_MS is midnight UTC, so this is exactly
 * the elapsed fraction of the calendar day) into simDayOrdinal's integer
 * result. Activity (showerActiveAt/isShowerActive) and the day-quantized
 * boundary scan in detectShowerEntries must keep using the plain integer
 * simDayOrdinal — that scan's exactness depends on activity changing only at
 * a day boundary, which making it continuous would break.
 */
function preciseOrdinal(simDay) {
  return simDayOrdinal(simDay) + (simDay - Math.floor(simDay));
}

/** Piecewise-linear 0 -> 1 -> 0 across [shower.start, shower.peak, shower.end]. */
function intensityOf(shower, code) {
  const { start, peak, end } = shower;
  const toPeak = forwardDist(start, peak);
  const fromStart = forwardDist(start, code);
  if (fromStart <= toPeak) {
    return toPeak === 0 ? 1 : fromStart / toPeak;
  }
  // +1: `end` is the last ACTIVE ordinal and it's active for a full 24h (activity
  // stays day-quantized), so the taper must span that whole day too — not stop
  // at its midnight, which used to leave the entire final day at 0.
  const peakToEnd = forwardDist(peak, end) + 1;
  const fromPeak = forwardDist(peak, code);
  // Guard only, not a real trigger: with the +1 above, fromPeak never actually
  // reaches peakToEnd while the shower is active (isShowerActive gates every
  // caller to code < end+1), so this floor should never fire in practice.
  return Math.max(0, 1 - fromPeak / peakToEnd);
}

// Reference data per spec.md §1.3. koreanName deliberately excludes the "자리"
// constellation suffix (canonical, byte-exact). Quadrantids' start > end is the
// explicit wrap encoding (AC-E3-101) rather than a special case at call sites.
const RAW_SHOWERS = [
  { id: 'quadrantids', koreanName: '사분의 유성우', startMD: [12, 28], endMD: [1, 12], peakMD: [1, 3] },
  { id: 'lyrids', koreanName: '거문고 유성우', startMD: [4, 14], endMD: [4, 30], peakMD: [4, 22] },
  { id: 'perseids', koreanName: '페르세우스 유성우', startMD: [7, 17], endMD: [8, 24], peakMD: [8, 12] },
  { id: 'geminids', koreanName: '쌍둥이 유성우', startMD: [12, 4], endMD: [12, 17], peakMD: [12, 14] },
];

export const SHOWER_TABLE = RAW_SHOWERS.map(({ id, koreanName, startMD, endMD, peakMD }) => ({
  id,
  koreanName,
  start: ordinalOf(...startMD),
  end: ordinalOf(...endMD),
  peak: ordinalOf(...peakMD),
}));

// @MX:ANCHOR: [AUTO] fan_in 4 (showerIntensity here, plus EarthView._build and two
// call sites in EarthView._detectShowers) — the single predicate every "is a shower
// active" check in the app routes through.
// @MX:REASON: [AUTO] Changing what counts as active here silently changes the HUD
// notice trigger (REQ-E3-104), the streak spawn gate (REQ-E3-103), and the intensity
// taper (REQ-E3-102) all at once.
/**
 * The shower active at `simDay`, or null. Table ranges do not overlap, so a
 * single match (not a list) is the correct and simplest shape for callers.
 * @param {number} simDay
 * @returns {{id:string,koreanName:string,start:number,end:number,peak:number}|null}
 */
export function isShowerActive(simDay) {
  return SHOWER_TABLE.find((s) => showerActiveAt(s, simDay)) || null;
}

/**
 * Intensity of whichever shower is active at `simDay` (0 if none), 0..1,
 * exactly 1.0 on the peak date, tapering linearly to 0 at both range edges.
 * @param {number} simDay
 * @returns {number}
 */
export function showerIntensity(simDay) {
  const shower = isShowerActive(simDay);
  return shower ? intensityOf(shower, preciseOrdinal(simDay)) : 0;
}

const SIM_YEAR_DAYS = 365.25;

/**
 * Showers newly entered during the half-open sim-time window (prevDay, currDay],
 * wrap-aware and immune to step size — mirrors the range-test philosophy of
 * eclipseData.detectEclipsesInRange (REQ-E3-102).
 *
 * @MX:NOTE: [AUTO] Multi-year fast-forward rule (plan.md A.1): once the frame
 * spans >= 1 full sim year, every periodic shower has necessarily crossed into
 * its annual range at least once, so each is reported EXACTLY once instead of
 * re-deriving every yearly crossing — this caps notice spam after a 500x jump.
 * @MX:REASON: without this cap, a multi-year jump would need to walk each
 * shower's every yearly occurrence inside the span; the periodicity guarantee
 * makes that walk unnecessary for a one-shot notice.
 *
 * Backward time (currDay < prevDay, from a reset or preset jump) fires
 * nothing. There is no detection state to unwind — activity is a pure
 * function of simDay, so the next forward call re-derives entries correctly
 * (silent re-arm).
 *
 * @param {number} prevDay
 * @param {number} currDay
 * @returns {Array<{id:string,koreanName:string,start:number,end:number,peak:number}>}
 */
export function detectShowerEntries(prevDay, currDay) {
  if (currDay <= prevDay) return [];
  if (currDay - prevDay >= SIM_YEAR_DAYS) return SHOWER_TABLE.slice();

  // Activity is quantized to whole calendar days (simDayOrdinal drops sub-day
  // precision), so it can only change AT a day boundary — walking every
  // boundary the (prevDay, currDay] span crosses makes sampling exact instead
  // of a two-point approximation that can miss a shower whose entire window
  // (shortest: Geminids, 13 days) falls strictly between the two endpoints.
  const entered = [];
  const seen = new Set();
  const noteEntries = (from, to) => {
    for (const shower of SHOWER_TABLE) {
      if (!seen.has(shower.id) && !showerActiveAt(shower, from) && showerActiveAt(shower, to)) {
        seen.add(shower.id);
        entered.push(shower);
      }
    }
  };

  let sample = prevDay;
  for (let boundary = Math.floor(prevDay) + 1; boundary <= currDay; boundary++) {
    noteEntries(sample, boundary);
    sample = boundary;
  }
  noteEntries(sample, currDay);
  return entered;
}
