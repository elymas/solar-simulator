// Daily mission catalog, rotation and completion engine (SPEC-PLAY-001 M1).
//
// Pure logic on purpose (REQ-PLAY-405): this module imports only the astronomical
// data table, never three.js and never a browser global. Persistence arrives as an
// injected store (stickers.js) so the whole engine runs under plain vitest.
//
// Predicates are DATA, not functions (plan.md §A.3). That keeps the catalog
// serializable and lets later SPECs add mission types by EMITTING a new event —
// SPEC-EVENTS-001 alignments and SPEC-EARTH-003 showers need no engine change.

import { STAR_DATA } from '../planets/planetData.js';

/**
 * How many missions a child gets per real calendar day (plan.md §A.4).
 *
 * This is a fraction of the catalog, not a fixed number: at 5 a day the catalog
 * has to stay well above 5 or consecutive days repeat almost the same set. The
 * rotation is a seeded shuffle per date, so a catalog of N gives a child roughly
 * N/5 days before a mission can recur — missions.test.js asserts that floor.
 */
export const MISSIONS_PER_DAY = 5;

/**
 * Seed catalog (spec.md §8). Every promptKo follows the SPEC-KIDS-001 §8.1
 * checklist: one clause, 해요체, ages-5 vocabulary, no English, no fear content.
 *
 * predicate: { type: 'select', bodies: [...] }
 *          | { type: 'view', view: 'EARTH' }
 *          | { type: 'action', action: 'rocket-arrived' | 'size-compare', body? }
 */
export const MISSION_CATALOG = [
  {
    id: 'find-rings',
    promptKo: '고리가 있는 행성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['saturn'] },
    sticker: 'rings',
    emoji: '🪐',
  },
  {
    id: 'find-red',
    promptKo: '빨간 행성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['mars'] },
    sticker: 'red-planet',
    emoji: '🔴',
  },
  {
    id: 'find-biggest',
    promptKo: '가장 큰 행성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['jupiter'] },
    sticker: 'biggest',
    emoji: '🟠',
  },
  {
    id: 'visit-moon',
    promptKo: '달에 놀러 가 보세요!',
    predicate: { type: 'select', bodies: ['moon'] },
    sticker: 'moon',
    emoji: '🌕',
  },
  {
    id: 'earth-home',
    promptKo: '우리가 사는 행성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['earth'] },
    sticker: 'home',
    emoji: '🌍',
  },
  {
    id: 'rocket-any',
    promptKo: '로켓을 발사해 보세요!',
    predicate: { type: 'action', action: 'rocket-arrived' },
    sticker: 'rocket',
    emoji: '🚀',
  },
  {
    id: 'compare-sun',
    promptKo: '태양이 얼마나 큰지 비교해 보세요!',
    predicate: { type: 'action', action: 'size-compare', body: 'sun' },
    sticker: 'sun-size',
    emoji: '☀️',
  },
  {
    id: 'earth-view',
    promptKo: '지구 구경을 해 보세요!',
    predicate: { type: 'view', view: 'EARTH' },
    sticker: 'earth-view',
    emoji: '🌏',
  },
  {
    id: 'find-dwarf',
    promptKo: '명왕성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['pluto'] },
    sticker: 'pluto',
    emoji: '🤍',
  },
  {
    id: 'watch-star',
    // Every star in the sky counts, so the catalog reads the star table rather
    // than freezing a list that would silently rot when a star is added.
    promptKo: '반짝이는 별을 눌러 보세요!',
    predicate: { type: 'select', bodies: Object.keys(STAR_DATA) },
    sticker: 'star',
    emoji: '⭐',
  },

  // --- Bodies the seed catalog never sent a child to ---------------------
  // The seed set covered 5 of the 15 entries in PLANET_DATA and one moon, so a
  // child could finish a week without ever being pointed at Venus, an ice giant,
  // or anything SPEC-EVENTS-001 added. Each prompt names the trait a five-year-old
  // can actually see or has just been told, never a number to memorize.
  {
    id: 'find-hottest',
    promptKo: '가장 뜨거운 행성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['venus'] },
    sticker: 'hottest',
    emoji: '🟡',
  },
  {
    id: 'find-closest-to-sun',
    promptKo: '태양과 가장 가까운 행성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['mercury'] },
    sticker: 'closest',
    emoji: '⚪',
  },
  {
    id: 'find-tilted',
    promptKo: '누워서 도는 행성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['uranus'] },
    sticker: 'tilted',
    emoji: '🩵',
  },
  {
    id: 'find-farthest',
    promptKo: '태양에서 가장 먼 행성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['neptune'] },
    sticker: 'farthest',
    emoji: '🔵',
  },
  {
    id: 'find-sun',
    promptKo: '우리를 따뜻하게 해 주는 별을 찾아보세요!',
    predicate: { type: 'select', bodies: ['sun'] },
    sticker: 'our-star',
    emoji: '☀️',
  },
  {
    id: 'find-comet',
    // SPEC-EVENTS-001 bodies. They are selectable from the list and the strip,
    // so they are reachable missions the seed catalog simply never named.
    promptKo: '긴 꼬리를 가진 혜성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['halley'] },
    sticker: 'comet',
    emoji: '☄️',
  },
  {
    id: 'find-asteroid-belt',
    promptKo: '돌멩이가 모여 있는 띠를 찾아보세요!',
    predicate: { type: 'select', bodies: ['asteroidBelt'] },
    sticker: 'asteroid-belt',
    emoji: '🪨',
  },
  {
    id: 'find-kuiper-belt',
    promptKo: '가장 바깥에 있는 띠를 찾아보세요!',
    predicate: { type: 'select', bodies: ['kuiperBelt'] },
    sticker: 'kuiper-belt',
    emoji: '🧊',
  },
  {
    id: 'find-ice-moon',
    promptKo: '얼음으로 덮인 위성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['europa'] },
    sticker: 'ice-moon',
    emoji: '🤍',
  },
  {
    id: 'find-biggest-moon',
    promptKo: '가장 큰 위성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['ganymede'] },
    sticker: 'biggest-moon',
    emoji: '🌑',
  },
  {
    id: 'find-mars-moons',
    // Either one counts: they are a pair a child meets together, and demanding
    // the specific smaller rock would be a memory test rather than a hunt.
    promptKo: '화성의 작은 위성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['phobos', 'deimos'] },
    sticker: 'mars-moons',
    emoji: '🥔',
  },
  {
    id: 'find-titan',
    promptKo: '토성의 가장 큰 위성을 찾아보세요!',
    predicate: { type: 'select', bodies: ['titan'] },
    sticker: 'titan',
    emoji: '🟤',
  },
  {
    id: 'compare-earth',
    promptKo: '지구가 얼마나 큰지 비교해 보세요!',
    predicate: { type: 'action', action: 'size-compare', body: 'earth' },
    sticker: 'earth-size',
    emoji: '📏',
  },
  {
    id: 'rocket-moon',
    // The predicate matcher already narrows an action by body, so a destination
    // mission needs no engine change — only this entry.
    promptKo: '로켓을 타고 달에 가 보세요!',
    predicate: { type: 'action', action: 'rocket-arrived', body: 'moon' },
    sticker: 'rocket-moon',
    emoji: '🌙',
  },
  {
    id: 'rocket-mars',
    promptKo: '로켓을 타고 화성에 가 보세요!',
    predicate: { type: 'action', action: 'rocket-arrived', body: 'mars' },
    sticker: 'rocket-mars',
    emoji: '🛸',
  },
];

// @MX:ANCHOR: [AUTO] The daily rotation contract. Same date in, same missions out —
// for every call, in every process, forever.
// @MX:SPEC: [AUTO] SPEC-PLAY-001 REQ-PLAY-401 / AC-PLAY-401
// @MX:REASON: [AUTO] The mission HUD, the engine and the sticker book all read the
// day's set through here. Any nondeterminism (Math.random, Set iteration over live
// data, Date.now inside) would re-roll a child's missions mid-day and orphan the
// completion records already persisted against those ids.
/**
 * Pick the day's missions from the catalog.
 * @param {string} dateString - real calendar date, 'YYYY-MM-DD' (A-505)
 * @param {Array} [catalog]
 * @param {number} [count]
 * @returns {Array} up to `count` catalog entries; fewer if the catalog is shorter
 */
export function missionsForDate(dateString, catalog = MISSION_CATALOG, count = MISSIONS_PER_DAY) {
  return seededShuffle(catalog, String(dateString)).slice(0, count);
}

// @MX:NOTE: [AUTO] FNV-1a over the date string seeds a mulberry32 PRNG driving a
// Fisher-Yates shuffle. Both are tiny, exactly reproducible integer algorithms —
// that is the whole point: `Math.random` or a hash that varies by engine would
// break the frozen snapshot in missions.test.js.
function seededShuffle(items, seedText) {
  const random = mulberry32(fnv1a(seedText));
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// @MX:ANCHOR: [AUTO] The only place an app event turns into a completed mission.
// @MX:SPEC: [AUTO] SPEC-PLAY-001 REQ-PLAY-402/404/405
// @MX:REASON: [AUTO] Selection, view-change and rocket/size-compare call sites all
// feed handleEvent, and the mission HUD plus sticker book read today()/isDayComplete().
// Awarding anywhere else would break the award-once invariant this function owns.
/**
 * Build the mission state machine for one calendar day.
 * @param {{store: object, date: string, catalog?: Array, count?: number}} options
 *   `store` comes from stickers.js; `date` is 'YYYY-MM-DD' (the caller owns the
 *   clock, so midnight rollover is a new engine, never a mid-day re-roll).
 */
export function createMissionEngine({
  store,
  date,
  catalog = MISSION_CATALOG,
  count = MISSIONS_PER_DAY,
}) {
  const missions = missionsForDate(date, catalog, count);

  const isDone = (mission) => store.completedOn(date).includes(mission.id);

  return {
    /** @returns {Array} today's missions, each with a `done` flag for the HUD */
    today: () => missions.map((mission) => ({ ...mission, done: isDone(mission) })),

    /** @returns {boolean} the "내일 또 만나요!" state — all of today's missions done */
    isDayComplete: () => missions.length > 0 && missions.every(isDone),

    /**
     * Feed one normalized play event through the day's predicates.
     * @param {{type: string, body?: string, view?: string}} event
     * @returns {Array} matched missions, each with `awarded` (sticker newly earned)
     *   and `firstToday` (mission newly completed today). A re-completion still
     *   comes back — praise may fire — but `awarded` is false, so the inventory
     *   never gains a duplicate (REQ-PLAY-404).
     */
    handleEvent(event) {
      if (!event || typeof event.type !== 'string') return [];
      return missions.filter((mission) => matches(mission.predicate, event)).map((mission) => {
        const firstToday = store.markCompleted(date, mission.id);
        const awarded = store.awardSticker(mission.sticker);
        return { ...mission, awarded, firstToday };
      });
    },
  };
}

// Unknown predicate or event types fall through to false: a catalog written
// against a future SPEC's events must go quiet here, not throw at a child.
function matches(predicate, event) {
  if (!predicate) return false;
  switch (predicate.type) {
    case 'select':
      return event.type === 'select' && (predicate.bodies ?? []).includes(event.body);
    case 'view':
      return event.type === 'view-enter' && event.view === predicate.view;
    case 'action':
      return (
        event.type === predicate.action && (!predicate.body || event.body === predicate.body)
      );
    default:
      return false;
  }
}
