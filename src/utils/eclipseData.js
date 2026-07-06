import { SIM_EPOCH_MS } from './constants.js';

const DAY_MS = 86400000;
const SIM_YEAR_DAYS = 365.25;

// @MX:NOTE: [AUTO] Real cataloged eclipses (NASA Five Millennium Canon of Solar/
// Lunar Eclipses, Espenak & Meeus, eclipse.gsfc.nasa.gov). Times are approximate
// greatest-eclipse UTC. This table — not a Keplerian alignment search — is the
// source of truth: OrbitalMechanics deliberately omits the ascending node (Ω), so a
// node-less orbit model cannot honestly produce real eclipse dates (real eclipses
// are node-crossing / Saros events). Range-testing sim time against real instants is
// both simpler and more truthful than fabricating alignments (REQ-550).
const ECLIPSES = [
  { date: '2026-08-12T17:46:00Z', type: 'solar-total', name: 'Total Solar — N. Atlantic / Iberia' },
  { date: '2026-08-28T04:13:00Z', type: 'lunar-partial', name: 'Partial Lunar' },
  { date: '2027-02-06T16:00:00Z', type: 'solar-annular', name: 'Annular Solar — S. America' },
  { date: '2027-08-02T10:07:00Z', type: 'solar-total', name: 'Total Solar — Great North African Eclipse' },
  { date: '2028-07-22T02:56:00Z', type: 'solar-total', name: 'Total Solar — Australia' },
  { date: '2028-12-31T16:52:00Z', type: 'lunar-total', name: 'Total Lunar — Blood Moon' },
  { date: '2029-06-12T04:06:00Z', type: 'solar-partial', name: 'Partial Solar' },
  { date: '2029-06-26T03:23:00Z', type: 'lunar-total', name: 'Total Lunar — Blood Moon' },
  { date: '2029-12-20T22:42:00Z', type: 'lunar-total', name: 'Total Lunar — Blood Moon' },
  { date: '2030-11-25T06:51:00Z', type: 'solar-total', name: 'Total Solar — S. Africa / Australia' },
];

/**
 * Convert a real ISO instant to sim-days from the shared epoch (constants.SIM_EPOCH).
 * @param {string} iso
 * @returns {number}
 */
export function toSimDay(iso) {
  return (Date.parse(iso) - SIM_EPOCH_MS) / DAY_MS;
}

/** @param {string} type */
export function isSolar(type) {
  return type.startsWith('solar');
}

/** @param {string} type */
export function isLunar(type) {
  return type.startsWith('lunar');
}

/** @param {string} type - True only for a total lunar eclipse (red umbra). */
export function isTotalLunar(type) {
  return type === 'lunar-total';
}

// Human-readable label + plain-language explanation per cataloged eclipse type,
// shown alongside the diorama so "what am I looking at" doesn't require prior
// astronomy knowledge.
const ECLIPSE_TYPE_INFO = {
  'solar-total': {
    label: 'Total Solar Eclipse',
    description: "The Moon fully covers the Sun's disk as seen from within its umbra (shadow cone), turning day briefly into twilight along a narrow path on Earth.",
  },
  'solar-annular': {
    label: 'Annular Solar Eclipse',
    description: 'The Moon crosses the Sun while farther from Earth in its orbit, so it looks too small to fully cover the disk — leaving a bright ring ("ring of fire") around its silhouette.',
  },
  'solar-partial': {
    label: 'Partial Solar Eclipse',
    description: "The Moon covers only part of the Sun's disk, seen from the penumbra outside the path of totality or annularity.",
  },
  'lunar-total': {
    label: 'Total Lunar Eclipse',
    description: "The Moon passes fully into Earth's umbra. Sunlight bent through Earth's atmosphere reddens it — the \"Blood Moon\".",
  },
  'lunar-partial': {
    label: 'Partial Lunar Eclipse',
    description: "Only part of the Moon passes through Earth's umbra, so a portion of its disk visibly darkens.",
  },
};

/**
 * Look up the display label + plain-language explanation for a cataloged
 * eclipse type. Falls back to the raw type string for anything unrecognized.
 * @param {string} type
 * @returns {{label: string, description: string}}
 */
export function getEclipseTypeInfo(type) {
  return ECLIPSE_TYPE_INFO[type] || { label: type, description: '' };
}

// Default HUD copy shown before any eclipse has been jumped to / detected.
export const ECLIPSE_DIAGRAM_INTRO =
  "This diorama shows how the Sun, Earth, and Moon line up during an eclipse: solar eclipses cast the Moon's shadow onto Earth, lunar eclipses cast Earth's shadow onto the Moon. Illustrative diagram — not to scale.";

// Table with sim-day precomputed, sorted ascending. Frozen provenance data.
export const ECLIPSE_TABLE = ECLIPSES
  .map((e) => ({ ...e, simDay: toSimDay(e.date) }))
  .sort((a, b) => a.simDay - b.simDay);

/**
 * Every eclipse whose instant lies in the half-open interval (lo, hi], where
 * [lo, hi] = the sim-time span the last frame covered. Half-open on the low side so
 * consecutive frames (prev of frame N == curr of frame N-1) never double-detect.
 * Immune to step size by construction: a single 500x frame may span years and still
 * catches every entry inside — no substep sampling needed (REQ-530).
 * @param {number} prevDay
 * @param {number} currDay
 * @returns {Array<{date:string,type:string,name:string,simDay:number}>}
 */
export function detectEclipsesInRange(prevDay, currDay) {
  const lo = Math.min(prevDay, currDay);
  const hi = Math.max(prevDay, currDay);
  return ECLIPSE_TABLE.filter((e) => e.simDay > lo && e.simDay <= hi);
}

/**
 * The first eclipse strictly after `nowDay`, within a bounded forward window
 * (default 5 sim-years). Simple sorted lookup, not a search loop (REQ-540).
 * @param {number} nowDay
 * @param {number} [windowDays]
 * @returns {{date:string,type:string,name:string,simDay:number}|null}
 */
export function findNextEclipse(nowDay, windowDays = 5 * SIM_YEAR_DAYS) {
  const limit = nowDay + windowDays;
  return ECLIPSE_TABLE.find((e) => e.simDay > nowDay && e.simDay <= limit) || null;
}
