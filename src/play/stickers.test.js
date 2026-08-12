import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createStickerStore, PLAY_STATE_KEY } from './stickers.js';

// A localStorage-shaped fake whose backing map is inspectable, so "one key"
// and round-trip claims are asserted against the real serialized bytes.
function createFakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// Private browsing / blocked-cookie Safari: every access throws.
function createHostileStorage() {
  return {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
    removeItem() {
      throw new Error('SecurityError');
    },
  };
}

describe('createStickerStore', () => {
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = ['log', 'info', 'warn', 'error'].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );
  });

  afterEach(() => {
    consoleSpies.forEach((s) => s.mockRestore());
  });

  function expectSilence() {
    consoleSpies.forEach((s) => expect(s).not.toHaveBeenCalled());
  }

  describe('empty start', () => {
    it('starts with no stickers when storage is empty', () => {
      const store = createStickerStore({ storage: createFakeStorage() });
      expect(store.stickers()).toEqual([]);
      expect(store.hasSticker('rings')).toBe(false);
      expect(store.completedOn('2026-08-12')).toEqual([]);
    });
  });

  describe('award-once invariant (REQ-PLAY-403/404)', () => {
    it('awards a new sticker once and reports the duplicate as not awarded', () => {
      const store = createStickerStore({ storage: createFakeStorage() });
      expect(store.awardSticker('rings')).toBe(true);
      expect(store.awardSticker('rings')).toBe(false);
      expect(store.stickers()).toEqual(['rings']);
      expect(store.hasSticker('rings')).toBe(true);
    });

    it('keeps award order stable across different stickers', () => {
      const store = createStickerStore({ storage: createFakeStorage() });
      store.awardSticker('rings');
      store.awardSticker('red');
      store.awardSticker('rings');
      expect(store.stickers()).toEqual(['rings', 'red']);
    });
  });

  describe('per-date mission completion', () => {
    it('records completion per date and dedupes', () => {
      const store = createStickerStore({ storage: createFakeStorage() });
      expect(store.markCompleted('2026-08-12', 'find-rings')).toBe(true);
      expect(store.markCompleted('2026-08-12', 'find-rings')).toBe(false);
      expect(store.completedOn('2026-08-12')).toEqual(['find-rings']);
      expect(store.completedOn('2026-08-13')).toEqual([]);
    });
  });

  describe('persistence (AC-PLAY-403)', () => {
    it('round-trips stickers and completions through a single namespaced key', () => {
      const storage = createFakeStorage();
      const first = createStickerStore({ storage });
      first.awardSticker('rings');
      first.markCompleted('2026-08-12', 'find-rings');

      expect([...storage.map.keys()]).toEqual([PLAY_STATE_KEY]);

      const reloaded = createStickerStore({ storage });
      expect(reloaded.hasSticker('rings')).toBe(true);
      expect(reloaded.completedOn('2026-08-12')).toEqual(['find-rings']);
      expectSilence();
    });
  });

  describe('defensive read (NFR persistence)', () => {
    it.each([
      ['malformed JSON', 'not json at all {{{'],
      ['a bare array', '[1,2,3]'],
      ['a number', '42'],
      ['null', 'null'],
      ['wrong field types', '{"stickers":"rings","done":7}'],
      ['non-string sticker entries', '{"stickers":[1,{"a":2}],"done":{}}'],
    ])('resets to an empty inventory for %s without throwing or logging', (_label, raw) => {
      const storage = createFakeStorage({ [PLAY_STATE_KEY]: raw });
      const store = createStickerStore({ storage });
      expect(store.stickers()).toEqual([]);
      expect(store.completedOn('2026-08-12')).toEqual([]);
      expectSilence();
    });

    it('keeps a valid blob that carries unknown extra fields', () => {
      const storage = createFakeStorage({
        [PLAY_STATE_KEY]: '{"stickers":["rings"],"done":{"2026-08-12":["find-rings"]},"future":1}',
      });
      const store = createStickerStore({ storage });
      expect(store.hasSticker('rings')).toBe(true);
      expect(store.completedOn('2026-08-12')).toEqual(['find-rings']);
    });
  });

  describe('hostile storage (private browsing degradation)', () => {
    it('falls back to session memory instead of crashing', () => {
      const store = createStickerStore({ storage: createHostileStorage() });
      expect(store.stickers()).toEqual([]);
      expect(store.awardSticker('rings')).toBe(true);
      expect(store.hasSticker('rings')).toBe(true);
      expect(store.markCompleted('2026-08-12', 'find-rings')).toBe(true);
      expect(store.completedOn('2026-08-12')).toEqual(['find-rings']);
      expectSilence();
    });

    it('starts empty again for a fresh store (documented degradation)', () => {
      const storage = createHostileStorage();
      createStickerStore({ storage }).awardSticker('rings');
      expect(createStickerStore({ storage }).hasSticker('rings')).toBe(false);
    });
  });

  describe('no storage at all', () => {
    it('works in memory when storage is explicitly absent', () => {
      const store = createStickerStore({ storage: null });
      expect(store.awardSticker('rings')).toBe(true);
      expect(store.hasSticker('rings')).toBe(true);
      expectSilence();
    });
  });
});
