// Sticker inventory + daily mission completion persistence (SPEC-PLAY-001 M1).
//
// One namespaced key holds ONE JSON blob (plan.md §B: "Single JSON blob under one
// namespaced key"). Key choice: 'solar.play' — sibling of KIDS-001's 'solar.muted',
// and deliberately NOT 'solar.play.state' so the whole play layer keeps a single
// storage entry as it grows. Stickers and per-date completions live together so
// corrupt-state recovery is exactly one read/parse/validate/reset path.
//
// Every path degrades to session memory rather than throwing: a blocked or full
// localStorage must cost the child their sticker history, never the app.

export const PLAY_STATE_KEY = 'solar.play';

const EMPTY = () => ({ stickers: [], done: {} });

// @MX:ANCHOR: [AUTO] The only reader/writer of PLAY_STATE_KEY. Mission engine,
// sticker book and mission HUD all persist through the store this returns.
// @MX:SPEC: [AUTO] SPEC-PLAY-001 REQ-PLAY-403
// @MX:REASON: [AUTO] fan_in >= 3 (missions engine + StickerBook + mission HUD in
// later milestones). A second writer touching the key directly would break the
// single-blob invariant that makes the defensive reset one code path.
/**
 * Build a play-state store over an injectable storage backend.
 * @param {{storage?: {getItem: Function, setItem: Function} | null}} [options]
 *   `undefined` uses the browser localStorage; `null` forces session memory.
 */
export function createStickerStore({ storage = readGlobalStorage() } = {}) {
  const state = load(storage);

  function persist() {
    try {
      storage?.setItem(PLAY_STATE_KEY, JSON.stringify(state));
    } catch {
      // Quota, private browsing, disabled storage: the in-memory `state` stays
      // authoritative for this session (acceptance.md §3 documented degradation).
    }
  }

  return {
    /** @returns {string[]} earned sticker ids, in award order */
    stickers: () => [...state.stickers],
    hasSticker: (id) => state.stickers.includes(id),
    /** @returns {boolean} true only on the FIRST award — the award-once invariant */
    awardSticker(id) {
      if (!id || state.stickers.includes(id)) return false;
      state.stickers.push(id);
      persist();
      return true;
    },
    /** @param {string} date - 'YYYY-MM-DD' real calendar date */
    completedOn: (date) => [...(state.done[date] ?? [])],
    /** @returns {boolean} true only on the first completion of that mission that day */
    markCompleted(date, missionId) {
      if (!date || !missionId) return false;
      const list = state.done[date] ?? (state.done[date] = []);
      if (list.includes(missionId)) return false;
      list.push(missionId);
      persist();
      return true;
    },
  };
}

// @MX:NOTE: [AUTO] Defensive parse. Absent key, malformed JSON, a non-object blob
// and wrong field types all collapse to the same empty inventory — silently, since
// a console warning would surface a storage detail to a 5-year-old's parent as if
// the app were broken.
function load(storage) {
  let raw = null;
  try {
    raw = storage?.getItem(PLAY_STATE_KEY) ?? null;
  } catch {
    return EMPTY();
  }
  if (!raw) return EMPTY();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY();
  }
  if (!isPlainObject(parsed)) return EMPTY();

  const stickers = parsed.stickers;
  const done = parsed.done;
  if (!Array.isArray(stickers) || !stickers.every((s) => typeof s === 'string')) return EMPTY();
  if (!isPlainObject(done)) return EMPTY();

  const cleanDone = {};
  for (const [date, list] of Object.entries(done)) {
    if (!Array.isArray(list) || !list.every((id) => typeof id === 'string')) return EMPTY();
    cleanDone[date] = [...list];
  }
  return { stickers: [...stickers], done: cleanDone };
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Reading the global is itself a trust boundary: `localStorage` throws
// SecurityError on an opaque origin before any getItem guard can run (same
// reasoning as tts.js).
function readGlobalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
