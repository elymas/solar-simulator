// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PLANET_DATA, STAR_DATA } from '../planets/planetData.js';
import { PlanetStrip } from './PlanetStrip.js';
import { PlanetList } from './PlanetList.js';
import { STR } from './strings.js';

// iPhone 17 Pro portrait — the primary device of SPEC-MOBILE-001 §1.1.
const PHONE_WIDTH = 402;
// Anything past the 768px breakpoint, including the same phone in landscape (874pt).
const WIDE_WIDTH = 1280;

const setViewport = (px) => { window.innerWidth = px; };

// Register a synthetic body, run the assertion, and always take it back out —
// PLANET_DATA is a shared module singleton.
const withRegistryBody = (key, data, fn) => {
  PLANET_DATA[key] = data;
  try {
    fn();
  } finally {
    delete PLANET_DATA[key];
  }
};

const styleSheets = () => [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('\n');

beforeEach(() => setViewport(PHONE_WIDTH));

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  setViewport(1024); // jsdom's default
});

describe('PlanetStrip viewport gating (REQ-MOB-301/304, AC-MOB-301/304)', () => {
  it('mounts into the document at <=768px', () => {
    const strip = new PlanetStrip();
    expect(strip.el.isConnected).toBe(true);
    expect(document.querySelector('.planet-strip')).toBe(strip.el);
  });

  it('stays out of the DOM entirely at >768px', () => {
    setViewport(WIDE_WIDTH);
    const strip = new PlanetStrip();
    // AC-MOB-304's first branch: absent from the DOM. Nothing is rendered, so
    // the "display:none with zero listeners" alternative does not apply.
    expect(strip.el.isConnected).toBe(false);
    expect(document.querySelector('.planet-strip')).toBeNull();
    expect(document.querySelector('.planet-strip-item')).toBeNull();
  });

  it('unmounts on rotation into landscape and comes back in portrait', () => {
    const strip = new PlanetStrip();
    expect(strip.el.isConnected).toBe(true);

    setViewport(WIDE_WIDTH);
    window.dispatchEvent(new Event('resize'));
    expect(strip.el.isConnected).toBe(false);

    setViewport(PHONE_WIDTH);
    window.dispatchEvent(new Event('resize'));
    expect(strip.el.isConnected).toBe(true);
  });

  it('sits above the TimeControls bar, clearing it plus the home indicator', () => {
    new PlanetStrip();
    // jsdom has no layout engine, so "above TimeControls" cannot be a geometric
    // assertion. What is checkable is the declared offset: it must clear the
    // mobile TimeControls bar (44px control button + 10px padding either side)
    // and stay additive with the safe-area inset.
    const match = styleSheets().match(
      /\.planet-strip\s*\{[^}]*bottom:\s*calc\((\d+)px \+ env\(safe-area-inset-bottom, 0px\)\)/,
    );
    expect(match, 'strip declares an env()-additive bottom offset').not.toBeNull();
    expect(Number(match[1])).toBeGreaterThanOrEqual(64);
  });

  it('leaves the sidebar auto-hidden at phone width (the strip replaces it)', () => {
    new PlanetStrip();
    const list = new PlanetList();
    expect(list.el.classList.contains('auto-hidden')).toBe(true);
  });
});

describe('PlanetStrip item content (REQ-MOB-302, AC-MOB-302)', () => {
  let strip;
  beforeEach(() => { strip = new PlanetStrip(); });

  it('shows the body emoji and its Korean name', () => {
    const btn = strip._buttons.saturn;
    expect(btn.querySelector('.planet-strip-token').textContent).toBe(PLANET_DATA.saturn.emoji);
    expect(btn.querySelector('.planet-strip-name').textContent).toBe(PLANET_DATA.saturn.nameKo);
  });

  it('falls back to a colour dot when the body carries no emoji', () => {
    withRegistryBody('__plain', { name: 'Plain', nameKo: '민무늬', color: 0x16c7ff }, () => {
      const token = new PlanetStrip()._buttons.__plain.querySelector('.planet-strip-token');
      expect(token.classList.contains('planet-strip-dot')).toBe(true);
      expect(token.style.background).toBe('rgb(22, 199, 255)');
      expect(token.textContent).toBe('');
    });
  });

  it('falls back to the English name when nameKo is absent', () => {
    withRegistryBody('__nameless', { name: 'Nameless', emoji: '🛰️' }, () => {
      const btn = new PlanetStrip()._buttons.__nameless;
      expect(btn.querySelector('.planet-strip-name').textContent).toBe('Nameless');
    });
  });

  it('gives every item a >=48px square target', () => {
    const cs = getComputedStyle(strip._buttons.mars);
    expect(parseFloat(cs.minWidth)).toBeGreaterThanOrEqual(48);
    expect(parseFloat(cs.minHeight)).toBeGreaterThanOrEqual(48);
  });

  it('renders items as real buttons with a Korean aria-label', () => {
    const btn = strip._buttons.mars;
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-label')).toBe(STR.stripSelect(PLANET_DATA.mars.nameKo));
  });

  it('scrolls horizontally rather than wrapping', () => {
    const css = styleSheets();
    expect(css).toMatch(/\.planet-strip\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.planet-strip-item\s*\{[^}]*flex:\s*0 0 auto/);
  });
});

describe('PlanetStrip selection sync (REQ-MOB-303, AC-MOB-303)', () => {
  let strip;
  beforeEach(() => {
    strip = new PlanetStrip();
    // jsdom implements no scrollIntoView, so each item under test gets a spy.
    for (const btn of Object.values(strip._buttons)) btn.scrollIntoView = vi.fn();
  });

  it('tapping an item reports the body key through onSelect', () => {
    let selected = null;
    strip.onSelect = (key) => { selected = key; };
    strip._buttons.saturn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected).toBe('saturn');
  });

  it('highlights the item and centres it when selection arrives from elsewhere', () => {
    strip.setActive('neptune');
    const btn = strip._buttons.neptune;
    expect(btn.classList.contains('active')).toBe(true);
    expect(btn.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'center' });
  });

  it('moves the highlight rather than accumulating it', () => {
    strip.setActive('neptune');
    strip.setActive('mars');
    expect(strip._buttons.neptune.classList.contains('active')).toBe(false);
    expect(strip._buttons.mars.classList.contains('active')).toBe(true);
  });

  it('clearActive drops the highlight', () => {
    strip.setActive('mars');
    strip.clearActive();
    expect(strip._buttons.mars.classList.contains('active')).toBe(false);
  });

  it('clears the highlight without scrolling when a moon is picked in 3D', () => {
    strip.setActive('mars');
    expect(() => strip.setActive('phobos')).not.toThrow();
    expect(strip._buttons.phobos).toBeUndefined();
    expect(strip._buttons.mars.classList.contains('active')).toBe(false);
    expect(strip._buttons.mars.scrollIntoView).toHaveBeenCalledTimes(1); // only the mars select
  });
});

describe('PlanetStrip is registry-driven (REQ-MOB-305, AC-MOB-305)', () => {
  it('renders exactly the top-level registry bodies, in registry order', () => {
    const strip = new PlanetStrip();
    const rendered = [...strip.el.querySelectorAll('.planet-strip-item')].map((b) => b.dataset.key);
    expect(rendered).toEqual([...Object.keys(PLANET_DATA), ...Object.keys(STAR_DATA)]);
  });

  it('excludes moons — the strip lists top-level bodies only (spec.md §6)', () => {
    const strip = new PlanetStrip();
    expect(strip._buttons.moon).toBeUndefined();
    expect(strip._buttons.io).toBeUndefined();
  });

  it('picks up a body added to the registry with no strip code change', () => {
    withRegistryBody('__comet', { name: 'Test Comet', nameKo: '시험 혜성', emoji: '☄️', color: 0xffffff }, () => {
      const btn = new PlanetStrip()._buttons.__comet;
      expect(btn).toBeDefined();
      expect(btn.querySelector('.planet-strip-token').textContent).toBe('☄️');
      expect(btn.querySelector('.planet-strip-name').textContent).toBe('시험 혜성');
    });
  });
});
