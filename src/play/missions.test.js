import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MISSION_CATALOG, missionsForDate, createMissionEngine } from './missions.js';
import { createStickerStore } from './stickers.js';
import { PLANET_DATA, MOON_DATA, STAR_DATA } from '../planets/planetData.js';

const DATE = '2026-08-12';

function memoryStore() {
  return createStickerStore({ storage: null });
}

/** Every body key the catalog is allowed to reference. */
function knownBodyKeys() {
  const moonKeys = Object.values(MOON_DATA).flat().map((m) => m.key);
  return new Set([...Object.keys(PLANET_DATA), ...moonKeys, ...Object.keys(STAR_DATA)]);
}

describe('MISSION_CATALOG (REQ-PLAY-401)', () => {
  it('carries the seed missions from spec §8', () => {
    expect(MISSION_CATALOG.map((m) => m.id)).toEqual([
      'find-rings',
      'find-red',
      'find-biggest',
      'visit-moon',
      'earth-home',
      'rocket-any',
      'compare-sun',
      'earth-view',
      'find-dwarf',
      'watch-star',
    ]);
  });

  it('gives every entry id/promptKo/predicate/sticker/emoji', () => {
    for (const mission of MISSION_CATALOG) {
      expect(typeof mission.id).toBe('string');
      expect(typeof mission.promptKo).toBe('string');
      expect(typeof mission.sticker).toBe('string');
      expect(typeof mission.emoji).toBe('string');
      expect(mission.emoji.length).toBeGreaterThan(0);
      expect(['select', 'view', 'action']).toContain(mission.predicate.type);
    }
  });

  it('uses unique mission ids and unique sticker ids', () => {
    const ids = MISSION_CATALOG.map((m) => m.id);
    const stickers = MISSION_CATALOG.map((m) => m.sticker);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(stickers).size).toBe(stickers.length);
  });

  it('only references bodies that exist in planetData', () => {
    const known = knownBodyKeys();
    for (const mission of MISSION_CATALOG) {
      const bodies = [
        ...(mission.predicate.bodies ?? []),
        ...(mission.predicate.body ? [mission.predicate.body] : []),
      ];
      for (const key of bodies) {
        expect(known.has(key), `${mission.id} references unknown body "${key}"`).toBe(true);
      }
    }
  });

  it('covers every star for the watch-star mission', () => {
    const watchStar = MISSION_CATALOG.find((m) => m.id === 'watch-star');
    expect(watchStar.predicate.bodies.sort()).toEqual(Object.keys(STAR_DATA).sort());
  });

  // SPEC-KIDS-001 §8.1: <=45 Korean chars, one clause, 해요체, no English.
  it('writes every prompt to the KIDS-001 §8.1 checklist', () => {
    for (const { id, promptKo } of MISSION_CATALOG) {
      expect(promptKo.length, `${id} prompt too long`).toBeLessThanOrEqual(45);
      expect(promptKo, `${id} must invite politely (해요체)`).toMatch(/요!$/);
      expect(promptKo, `${id} must not use English`).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe('missionsForDate (REQ-PLAY-401, AC-PLAY-401)', () => {
  it('returns three missions', () => {
    expect(missionsForDate(DATE, MISSION_CATALOG)).toHaveLength(3);
  });

  it('is identical across repeated calls for the same date', () => {
    const a = missionsForDate(DATE, MISSION_CATALOG);
    const b = missionsForDate(DATE, MISSION_CATALOG);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  it('is stable across process runs (frozen snapshot, no Math.random)', () => {
    // Regenerating this snapshot means the child's daily missions changed for
    // every past date — treat a diff here as a deliberate decision, not noise.
    expect(missionsForDate('2026-08-12', MISSION_CATALOG).map((m) => m.id)).toMatchInlineSnapshot(`
      [
        "find-dwarf",
        "find-rings",
        "find-biggest",
      ]
    `);
    expect(missionsForDate('2026-08-13', MISSION_CATALOG).map((m) => m.id)).toMatchInlineSnapshot(`
      [
        "watch-star",
        "find-red",
        "compare-sun",
      ]
    `);
  });

  it('gives different dates different subsets', () => {
    const seen = new Set();
    for (let day = 1; day <= 28; day += 1) {
      const date = `2026-09-${String(day).padStart(2, '0')}`;
      seen.add(missionsForDate(date, MISSION_CATALOG).map((m) => m.id).join('|'));
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('returns catalog entries verbatim (no cloning surprises)', () => {
    expect(MISSION_CATALOG).toContain(missionsForDate(DATE, MISSION_CATALOG)[0]);
  });

  it('returns what exists when the catalog is shorter than three', () => {
    const short = MISSION_CATALOG.slice(0, 2);
    expect(missionsForDate(DATE, short)).toHaveLength(2);
    expect(missionsForDate(DATE, [])).toEqual([]);
  });
});

describe('createMissionEngine (REQ-PLAY-402/404/405)', () => {
  const catalog = MISSION_CATALOG;

  function engineWith(missionIds, store = memoryStore()) {
    return {
      store,
      engine: createMissionEngine({
        store,
        date: DATE,
        catalog: catalog.filter((m) => missionIds.includes(m.id)),
        count: missionIds.length,
      }),
    };
  }

  it('exposes today’s missions with their done state', () => {
    const { engine } = engineWith(['find-rings']);
    expect(engine.today()).toEqual([
      expect.objectContaining({ id: 'find-rings', done: false }),
    ]);
  });

  describe('predicate matching', () => {
    it('matches a select predicate on the listed body', () => {
      const { engine } = engineWith(['find-rings']);
      const matched = engine.handleEvent({ type: 'select', body: 'saturn' });
      expect(matched.map((m) => m.id)).toEqual(['find-rings']);
      expect(matched[0].awarded).toBe(true);
    });

    it('ignores a select event for a body the mission does not name', () => {
      const { engine } = engineWith(['find-rings']);
      expect(engine.handleEvent({ type: 'select', body: 'mars' })).toEqual([]);
      expect(engine.today()[0].done).toBe(false);
    });

    it('matches a view predicate on view-enter', () => {
      const { engine } = engineWith(['earth-view']);
      expect(engine.handleEvent({ type: 'view-enter', view: 'EARTH' }).map((m) => m.id)).toEqual([
        'earth-view',
      ]);
    });

    it('ignores view-enter for another view', () => {
      const { engine } = engineWith(['earth-view']);
      expect(engine.handleEvent({ type: 'view-enter', view: 'SOLAR' })).toEqual([]);
    });

    it('matches an action predicate regardless of destination when no body is pinned', () => {
      const { engine } = engineWith(['rocket-any']);
      expect(engine.handleEvent({ type: 'rocket-arrived', body: 'mars' }).map((m) => m.id)).toEqual(
        ['rocket-any']
      );
    });

    it('matches an action predicate pinned to a body only for that body', () => {
      const { engine } = engineWith(['compare-sun']);
      expect(engine.handleEvent({ type: 'size-compare', body: 'mars' })).toEqual([]);
      expect(engine.handleEvent({ type: 'size-compare', body: 'sun' }).map((m) => m.id)).toEqual([
        'compare-sun',
      ]);
    });

    it('ignores unknown, malformed and empty events without throwing', () => {
      const { engine } = engineWith(['find-rings', 'earth-view', 'rocket-any']);
      expect(engine.handleEvent({ type: 'eclipse-witnessed' })).toEqual([]);
      expect(engine.handleEvent({ type: 'select' })).toEqual([]);
      expect(engine.handleEvent({})).toEqual([]);
      expect(engine.handleEvent(null)).toEqual([]);
      expect(engine.handleEvent(undefined)).toEqual([]);
    });

    it('completes only the mission whose predicate fits, leaving the rest open', () => {
      const { engine } = engineWith(['visit-moon', 'find-rings']);
      expect(engine.handleEvent({ type: 'select', body: 'moon' }).map((m) => m.id)).toEqual([
        'visit-moon',
      ]);
      expect(engine.today().find((m) => m.id === 'find-rings').done).toBe(false);
    });
  });

  describe('award-once invariant (AC-PLAY-404)', () => {
    it('awards the sticker once and still reports the re-completion for praise', () => {
      const { engine, store } = engineWith(['find-rings']);
      const first = engine.handleEvent({ type: 'select', body: 'saturn' });
      const second = engine.handleEvent({ type: 'select', body: 'saturn' });

      expect(first[0].awarded).toBe(true);
      expect(first[0].firstToday).toBe(true);
      expect(second.map((m) => m.id)).toEqual(['find-rings']);
      expect(second[0].awarded).toBe(false);
      expect(second[0].firstToday).toBe(false);
      expect(store.stickers()).toEqual(['rings']);
    });

    it('does not re-award a sticker earned on an earlier day', () => {
      const store = memoryStore();
      store.awardSticker('rings');
      const { engine } = engineWith(['find-rings'], store);
      const matched = engine.handleEvent({ type: 'select', body: 'saturn' });
      expect(matched[0].awarded).toBe(false);
      expect(matched[0].firstToday).toBe(true);
      expect(store.stickers()).toEqual(['rings']);
    });
  });

  describe('persistence round-trip (AC-PLAY-403)', () => {
    it('restores done state for the same date from a fresh engine', () => {
      const store = memoryStore();
      engineWith(['find-rings'], store).engine.handleEvent({ type: 'select', body: 'saturn' });

      const reloaded = createMissionEngine({
        store,
        date: DATE,
        catalog: MISSION_CATALOG.filter((m) => m.id === 'find-rings'),
        count: 1,
      });
      expect(reloaded.today()[0].done).toBe(true);
      expect(reloaded.isDayComplete()).toBe(true);
    });

    it('keeps another date’s missions untouched', () => {
      const store = memoryStore();
      engineWith(['find-rings'], store).engine.handleEvent({ type: 'select', body: 'saturn' });

      const tomorrow = createMissionEngine({
        store,
        date: '2026-08-13',
        catalog: MISSION_CATALOG.filter((m) => m.id === 'find-rings'),
        count: 1,
      });
      expect(tomorrow.today()[0].done).toBe(false);
      expect(tomorrow.isDayComplete()).toBe(false);
    });
  });

  describe('daily-complete state (plan §A.4)', () => {
    it('reports the day complete only once every mission is done', () => {
      const { engine } = engineWith(['find-rings', 'find-red']);
      expect(engine.isDayComplete()).toBe(false);
      engine.handleEvent({ type: 'select', body: 'saturn' });
      expect(engine.isDayComplete()).toBe(false);
      engine.handleEvent({ type: 'select', body: 'mars' });
      expect(engine.isDayComplete()).toBe(true);
    });

    it('never re-rolls the mission set inside one date', () => {
      const store = memoryStore();
      const engine = createMissionEngine({ store, date: DATE });
      const before = engine.today().map((m) => m.id);
      engine.handleEvent({ type: 'select', body: 'saturn' });
      expect(engine.today().map((m) => m.id)).toEqual(before);
    });

    it('is empty-day-safe when the catalog has no missions', () => {
      const engine = createMissionEngine({ store: memoryStore(), date: DATE, catalog: [] });
      expect(engine.today()).toEqual([]);
      expect(engine.isDayComplete()).toBe(false);
    });
  });

  it('defaults to the full catalog and three missions a day', () => {
    const engine = createMissionEngine({ store: memoryStore(), date: DATE });
    expect(engine.today().map((m) => m.id)).toEqual(
      missionsForDate(DATE, MISSION_CATALOG).map((m) => m.id)
    );
  });
});

// AC-PLAY-405: the engine must stay unit-testable without a renderer or a page.
describe('import purity (REQ-PLAY-405, AC-PLAY-405)', () => {
  const BROWSER_GLOBALS = /\b(document|window|navigator|localStorage|HTMLElement|requestAnimationFrame)\b/;

  function collectModuleGraph(path, seen = new Map()) {
    if (seen.has(path)) return seen;
    const source = readFileSync(path, 'utf8');
    seen.set(path, source);
    const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const specifier of specifiers) {
      if (specifier.startsWith('.')) collectModuleGraph(resolve(dirname(path), specifier), seen);
      else seen.set(specifier, null); // bare specifier: recorded, not read
    }
    return seen;
  }

  const graph = collectModuleGraph(resolve(process.cwd(), 'src/play/missions.js'));

  it('imports nothing from three.js', () => {
    const bare = [...graph.entries()].filter(([, source]) => source === null).map(([id]) => id);
    expect(bare.filter((id) => id === 'three' || id.startsWith('three/'))).toEqual([]);
  });

  it('touches no DOM global anywhere in its import graph', () => {
    for (const [path, source] of graph) {
      if (source === null) continue;
      expect(BROWSER_GLOBALS.test(source), `${path} references a browser global`).toBe(false);
    }
  });

  it('reaches only the astronomical data module', () => {
    const local = [...graph.keys()].filter((p) => p.endsWith('.js')).map((p) => p.split('/').pop());
    expect(local.sort()).toEqual(['missions.js', 'planetData.js']);
  });
});
