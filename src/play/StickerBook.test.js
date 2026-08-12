// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StickerBook } from './StickerBook.js';
import { MISSION_CATALOG, createMissionEngine, missionsForDate } from './missions.js';
import { createStickerStore, PLAY_STATE_KEY } from './stickers.js';
import { STR } from '../ui/strings.js';

const DATE = '2026-08-12';

/** A localStorage-shaped fake; jsdom under vitest exposes no real one. */
function fakeStorage(seed = new Map()) {
  return {
    map: seed,
    getItem: (k) => seed.get(k) ?? null,
    setItem: (k, v) => seed.set(k, String(v)),
  };
}

function build({ storage = fakeStorage(), date = DATE } = {}) {
  const store = createStickerStore({ storage });
  let engine = createMissionEngine({ store, date });
  const book = new StickerBook({ getEngine: () => engine, store });
  return { book, store, engine, storage, setEngine: (e) => { engine = e; } };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('sticker book access (plan §B — a place the child chooses to visit)', () => {
  it('starts closed: completion never pops it open', () => {
    const { book } = build();
    expect(book.isOpen).toBe(false);
    expect(book.el.hidden).toBe(true);
  });

  it('offers a real button of at least 44px near the existing chrome', () => {
    const { book } = build();
    expect(book.toggleBtn.tagName).toBe('BUTTON');
    expect(document.body.contains(book.toggleBtn)).toBe(true);
    const style = getComputedStyle(book.toggleBtn);
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(44);
    expect(parseFloat(style.height)).toBeGreaterThanOrEqual(44);
    expect(book.toggleBtn.getAttribute('aria-label')).toBe(STR.playStickerBookOpen);
  });

  it('opens and closes from the toggle, and closes on Escape', () => {
    const { book } = build();
    book.toggleBtn.click();
    expect(book.isOpen).toBe(true);
    expect(book.el.hidden).toBe(false);

    book.toggleBtn.click();
    expect(book.isOpen).toBe(false);

    book.toggleBtn.click();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(book.isOpen).toBe(false);
  });

  it('labels the close button in Korean and sizes it for a thumb', () => {
    const { book } = build();
    const close = book.el.querySelector('.sticker-book-close');
    expect(close.getAttribute('aria-label')).toBe(STR.playClose);
    expect(parseFloat(getComputedStyle(close).minWidth)).toBeGreaterThanOrEqual(44);
    expect(parseFloat(getComputedStyle(close).minHeight)).toBeGreaterThanOrEqual(44);
  });

  it('hides with the rest of the solar chrome on a view switch', () => {
    const { book } = build();
    book.open();

    book.setVisible(false);

    expect(book.toggleBtn.style.display).toBe('none');
    expect(book.isOpen).toBe(false);
  });
});

describe('sticker grid (REQ-PLAY-403, AC-PLAY-403)', () => {
  it('shows one tile per catalog sticker, all locked at first', () => {
    const { book } = build();
    book.open();

    const tiles = book.el.querySelectorAll('.sticker-tile');
    expect(tiles).toHaveLength(MISSION_CATALOG.length);
    expect(book.el.querySelectorAll('.sticker-tile--locked')).toHaveLength(MISSION_CATALOG.length);
  });

  it('counts earned vivid vs locked silhouettes correctly', () => {
    const { book, store } = build();
    store.awardSticker('rings');
    store.awardSticker('rocket');
    book.open();

    const earned = book.el.querySelectorAll('.sticker-tile:not(.sticker-tile--locked)');
    expect(earned).toHaveLength(2);
    expect([...earned].map((t) => t.dataset.sticker).sort()).toEqual(['rings', 'rocket']);
    expect(book.el.querySelectorAll('.sticker-tile--locked')).toHaveLength(
      MISSION_CATALOG.length - 2
    );
  });

  it('renders the earned sticker vividly and the locked ones faded', () => {
    const { book, store } = build();
    store.awardSticker('rings');
    book.open();

    const opacity = (sel) => parseFloat(getComputedStyle(book.el.querySelector(sel)).opacity);
    expect(opacity('.sticker-tile:not(.sticker-tile--locked)')).toBe(1);
    expect(opacity('.sticker-tile--locked')).toBeLessThan(1);
  });

  it('survives a reload: award, persist, re-open from fresh storage (round-trip)', () => {
    const storage = fakeStorage();
    const first = build({ storage });
    first.engine.handleEvent({ type: 'select', body: 'saturn' });
    first.book.dispose();

    expect(storage.map.has(PLAY_STATE_KEY)).toBe(true);

    // A brand new store + engine + book over the same storage — a fresh visit.
    const second = build({ storage });
    second.book.open();

    const earned = [...second.book.el.querySelectorAll('.sticker-tile:not(.sticker-tile--locked)')];
    expect(earned.map((t) => t.dataset.sticker)).toEqual(['rings']);
  });

  it('labels every tile in Korean, locked ones saying so', () => {
    const { book, store } = build();
    store.awardSticker('rings');
    book.open();

    const rings = book.el.querySelector('[data-sticker="rings"]');
    const locked = book.el.querySelector('.sticker-tile--locked');
    expect(rings.getAttribute('aria-label')).toBe('고리가 있는 행성을 찾아보세요!');
    expect(locked.getAttribute('aria-label')).toMatch(/아직 못 받았어요/);
    expect(rings.getAttribute('role')).toBe('img');
  });
});

describe('mission HUD (REQ-PLAY-401/403)', () => {
  it("surfaces today's three missions by promptKo", () => {
    const { book } = build();
    book.open();

    const prompts = [...book.el.querySelectorAll('.sticker-mission')].map((li) =>
      li.textContent.trim()
    );
    const expected = missionsForDate(DATE).map((m) => `${m.emoji} ${m.promptKo}`);
    expect(prompts).toEqual(expected);
  });

  it('marks a completed mission done without hiding it', () => {
    const { book, engine } = build();
    const [first] = missionsForDate(DATE);
    engine.handleEvent(eventFor(first));
    book.open();

    const done = book.el.querySelectorAll('.sticker-mission--done');
    expect(done).toHaveLength(1);
    expect(done[0].textContent).toContain(first.promptKo);
    expect(book.el.querySelectorAll('.sticker-mission')).toHaveLength(3);
  });

  it('shows the day-complete state only once all three are done', () => {
    const { book, engine } = build();
    const missions = missionsForDate(DATE);

    book.open();
    const complete = book.el.querySelector('.sticker-day-complete');
    expect(complete.hidden).toBe(true);
    expect(complete.textContent).toBe(STR.playDayComplete);

    for (const mission of missions) engine.handleEvent(eventFor(mission));
    book.refresh();

    expect(book.el.querySelector('.sticker-day-complete').hidden).toBe(false);
  });

  it('badges the toggle with the day progress so the button is worth tapping', () => {
    const { book, engine } = build();
    expect(book.toggleBtn.querySelector('.sticker-badge').textContent).toBe('0/3');

    engine.handleEvent(eventFor(missionsForDate(DATE)[0]));
    book.refresh();

    expect(book.toggleBtn.querySelector('.sticker-badge').textContent).toBe('1/3');
  });

  it('re-reads the engine on every refresh, so a midnight rollover lands', () => {
    const { book, store, setEngine } = build();
    setEngine(createMissionEngine({ store, date: '2026-08-13' }));
    book.refresh();

    const prompts = [...book.el.querySelectorAll('.sticker-mission')].map((li) =>
      li.textContent.trim()
    );
    expect(prompts).toEqual(missionsForDate('2026-08-13').map((m) => `${m.emoji} ${m.promptKo}`));
  });
});

describe('hostile storage (spec §5 persistence)', () => {
  it('renders normally with no storage at all', () => {
    const store = createStickerStore({ storage: null });
    const engine = createMissionEngine({ store, date: DATE });
    const book = new StickerBook({ getEngine: () => engine, store });

    engine.handleEvent(eventFor(missionsForDate(DATE)[0]));
    book.open();

    expect(book.el.querySelectorAll('.sticker-tile')).toHaveLength(MISSION_CATALOG.length);
    expect(book.el.querySelectorAll('.sticker-mission--done')).toHaveLength(1);
  });
});

describe('teardown', () => {
  it('removes both surfaces and stops listening', () => {
    const { book } = build();
    book.open();
    book.dispose();

    expect(document.querySelector('.sticker-book')).toBeNull();
    expect(document.querySelector('.sticker-toggle')).toBeNull();
    // No throw from a stray key after teardown.
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  });
});

/** Build the play event that completes a catalog mission, whatever its predicate. */
function eventFor(mission) {
  const p = mission.predicate;
  if (p.type === 'select') return { type: 'select', body: p.bodies[0] };
  if (p.type === 'view') return { type: 'view-enter', view: p.view };
  return { type: p.action, body: p.body };
}

describe('the helper the tests lean on', () => {
  it('completes every catalog predicate type', () => {
    const store = createStickerStore({ storage: null });
    const engine = createMissionEngine({ store, date: DATE, catalog: MISSION_CATALOG, count: 99 });
    for (const mission of MISSION_CATALOG) {
      expect(engine.handleEvent(eventFor(mission)).map((m) => m.id), mission.id).toContain(
        mission.id
      );
    }
    vi.clearAllMocks();
  });
});
