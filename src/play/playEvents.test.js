import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emitPlayEvent, onPlayEvent, resetPlayEvents } from './playEvents.js';
import { createMissionEngine, MISSION_CATALOG } from './missions.js';
import { createStickerStore } from './stickers.js';

function fakeStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) };
}

describe('playEvents (SPEC-PLAY-001 plan §4 seam)', () => {
  beforeEach(() => resetPlayEvents());

  describe('subscription', () => {
    it('delivers an emitted event to every subscriber', () => {
      const a = vi.fn();
      const b = vi.fn();
      onPlayEvent(a);
      onPlayEvent(b);

      emitPlayEvent('select', { body: 'saturn' });

      expect(a).toHaveBeenCalledTimes(1);
      expect(a).toHaveBeenCalledWith({ type: 'select', body: 'saturn' });
      expect(b).toHaveBeenCalledWith({ type: 'select', body: 'saturn' });
    });

    it('emits a bare event when there is no payload', () => {
      const seen = vi.fn();
      onPlayEvent(seen);
      emitPlayEvent('rocket-arrived');
      expect(seen).toHaveBeenCalledWith({ type: 'rocket-arrived' });
    });

    it('unsubscribes without leaking — no call after the returned disposer runs', () => {
      const seen = vi.fn();
      const off = onPlayEvent(seen);

      emitPlayEvent('select', { body: 'mars' });
      off();
      emitPlayEvent('select', { body: 'mars' });
      off(); // idempotent

      expect(seen).toHaveBeenCalledTimes(1);
    });

    it('registers a subscriber once, however many times it is passed in', () => {
      const seen = vi.fn();
      onPlayEvent(seen);
      onPlayEvent(seen);
      emitPlayEvent('view-enter', { view: 'EARTH' });
      expect(seen).toHaveBeenCalledTimes(1);
    });

    it('ignores a non-function subscriber instead of throwing at a child', () => {
      expect(() => onPlayEvent(null)).not.toThrow();
      expect(() => emitPlayEvent('select', { body: 'mars' })).not.toThrow();
    });

    it('keeps delivering after one subscriber throws', () => {
      const later = vi.fn();
      onPlayEvent(() => {
        throw new Error('a UI subscriber blew up');
      });
      onPlayEvent(later);

      expect(() => emitPlayEvent('select', { body: 'saturn' })).not.toThrow();
      expect(later).toHaveBeenCalledTimes(1);
    });
  });

  // The whole point of the seam: M1's engine already reads these four shapes
  // (plan.md §A.3). If the emitter drifts, missions silently stop completing.
  describe('vocabulary matches the mission engine (plan.md §A.3)', () => {
    let engine;
    let completed;

    beforeEach(() => {
      const store = createStickerStore({ storage: fakeStorage() });
      // Pin the catalog rather than the day's rotation so the contract test does
      // not depend on which three missions a date happens to draw.
      engine = createMissionEngine({
        store,
        date: '2026-08-12',
        catalog: MISSION_CATALOG,
        count: MISSION_CATALOG.length,
      });
      completed = [];
      onPlayEvent((event) => {
        for (const mission of engine.handleEvent(event)) completed.push(mission.id);
      });
    });

    it('select → a select-predicate mission', () => {
      emitPlayEvent('select', { body: 'saturn' });
      expect(completed).toContain('find-rings');
    });

    it('view-enter → a view-predicate mission', () => {
      emitPlayEvent('view-enter', { view: 'EARTH' });
      expect(completed).toContain('earth-view');
    });

    it('rocket-arrived → an action-predicate mission', () => {
      emitPlayEvent('rocket-arrived', { body: 'mars' });
      expect(completed).toContain('rocket-any');
    });

    it('size-compare → a body-qualified action-predicate mission', () => {
      emitPlayEvent('size-compare', { body: 'sun' });
      expect(completed).toContain('compare-sun');
    });

    it('leaves the day alone for an event nothing subscribes a predicate to', () => {
      emitPlayEvent('size-compare', { body: 'mars' });
      emitPlayEvent('nonsense', { body: 'saturn' });
      expect(completed).toEqual([]);
    });
  });

  describe('purity', () => {
    it('imports nothing — no DOM, no three.js, no data tables', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/play/playEvents.js'), 'utf8');
      expect(source).not.toMatch(/^import /m);
      expect(source).not.toMatch(/\b(document|window|three)\b/);
    });
  });
});
