import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PLANET_DATA, BELT_DATA } from '../src/planets/planetData.js';
import { PlanetList } from '../src/ui/PlanetList.js';
import { InfoPanel } from '../src/ui/InfoPanel.js';
import { LoadingScreen } from '../src/ui/LoadingScreen.js';
import { STR } from '../src/ui/strings.js';

const DWARF_KEYS = ['ceres', 'pluto', 'haumea', 'makemake', 'eris'];

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('PlanetList dwarf section (REQ-010 UI, TASK-004)', () => {
  let list;
  beforeEach(() => {
    list = new PlanetList();
  });

  it('renders the Korean dwarf-planet divider', () => {
    const dividers = [...document.querySelectorAll('.planet-list-divider')].map((d) => d.textContent);
    expect(dividers).toContain(STR.listDividerDwarf);
  });

  it('creates a clickable item for every dwarf planet', () => {
    for (const key of DWARF_KEYS) {
      expect(list._buttons[key], key).toBeDefined();
    }
  });
});

// SPEC-EVENTS-001 M6. The comet and the belts are only reachable from a list
// entry — the belts on purpose (REQ-EVT-203 keeps them out of the picking path).
describe('PlanetList comet and belt sections (REQ-EVT-103, REQ-EVT-205)', () => {
  let list;
  beforeEach(() => {
    list = new PlanetList();
  });

  const dividers = () => [...document.querySelectorAll('.planet-list-divider')].map((d) => d.textContent);

  it('renders the Korean comet divider with the Halley entry under it', () => {
    expect(dividers()).toContain(STR.listDividerComet);
    expect(list._buttons.halley).toBeDefined();
    expect(list._buttons.halley.textContent).toContain(PLANET_DATA.halley.nameKo);
  });

  it('renders both belt entries under their own divider', () => {
    expect(dividers()).toContain(STR.listDividerBelt);
    for (const key of Object.keys(BELT_DATA)) {
      expect(list._buttons[key], key).toBeDefined();
      expect(list._buttons[key].textContent).toContain(BELT_DATA[key].nameKo);
    }
  });

  it('reports the comet and belt keys through onSelect like any other row', () => {
    const picked = [];
    list.onSelect = (key) => picked.push(key);
    list._buttons.halley.click();
    list._buttons.asteroidBelt.click();
    list._buttons.kuiperBelt.click();
    expect(picked).toEqual(['halley', 'asteroidBelt', 'kuiperBelt']);
  });

  it('keeps the comet out of the dwarf-planet section', () => {
    const order = [...document.querySelectorAll('.planet-list-divider, .planet-list-item')];
    const cometDivider = order.findIndex((n) => n.textContent === STR.listDividerComet);
    const halley = order.indexOf(list._buttons.halley);
    const stars = order.findIndex((n) => n.textContent === STR.listDividerStars);
    expect(cometDivider).toBeLessThan(halley);
    expect(halley).toBeLessThan(stars);
  });
});

describe('PlanetList moon group collapse/expand (default collapsed)', () => {
  let list;
  beforeEach(() => {
    list = new PlanetList();
  });

  it('starts every moon group collapsed and hides the moon buttons', () => {
    expect(list._moonGroups.earth.group.classList.contains('collapsed')).toBe(true);
    expect(list._buttons.moon.closest('.moon-group')).toBe(list._moonGroups.earth.group);
  });

  it('caret click expands the group and toggles it back on a second click', () => {
    const { group, caret } = list._moonGroups.mars;
    caret.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(group.classList.contains('collapsed')).toBe(false);
    expect(caret.classList.contains('expanded')).toBe(true);

    caret.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(group.classList.contains('collapsed')).toBe(true);
  });

  it('caret click does not select/focus the planet (event does not bubble to the row)', () => {
    let selected = null;
    list.onSelect = (key) => { selected = key; };
    list._moonGroups.mars.caret.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected).toBeNull();
  });

  it('setActive on a moon auto-expands its still-collapsed parent group', () => {
    expect(list._moonGroups.jupiter.group.classList.contains('collapsed')).toBe(true);
    list.setActive('io');
    expect(list._moonGroups.jupiter.group.classList.contains('collapsed')).toBe(false);
    expect(list._buttons.io.classList.contains('active')).toBe(true);
  });
});

describe('LoadingScreen Korean chrome (REQ-KIDS-103)', () => {
  it('renders the Korean title, subtitle and progress text', () => {
    const screen = new LoadingScreen();
    expect(screen.el.querySelector('.loading-title').textContent).toBe(STR.loadingTitle);
    expect(screen.el.querySelector('.loading-subtitle').textContent).toBe(STR.loadingSubtitle);

    screen.updateProgress(30, 100);
    expect(screen.el.querySelector('#loading-text').textContent).toBe(STR.loadingProgress(30));
  });
});

describe('PlanetList Korean-primary labels (REQ-KIDS-101, AC-KIDS-101)', () => {
  let list;
  beforeEach(() => {
    list = new PlanetList();
  });

  const ko = (key) => list._buttons[key].querySelector('.planet-item-name-ko');
  const en = (key) => list._buttons[key].querySelector('.planet-item-name');
  const size = (el) => parseFloat(getComputedStyle(el).fontSize);

  it('renders nameKo before the English label in DOM order', () => {
    expect(ko('mars').textContent).toBe(PLANET_DATA.mars.nameKo);
    expect(en('mars').textContent).toBe('Mars');
    expect(ko('mars').nextElementSibling).toBe(en('mars'));
  });

  it('renders nameKo strictly larger than the English secondary', () => {
    expect(size(ko('mars'))).toBeGreaterThan(size(en('mars')));
  });

  it('keeps Korean dominant on indented moon rows too', () => {
    expect(size(ko('io'))).toBeGreaterThan(size(en('io')));
  });

  it('renders the Korean label for every star', () => {
    for (const key of ['siriusA', 'betelgeuse']) {
      expect(ko(key).textContent, key).toBeTruthy();
    }
  });

  it('omits the secondary label when it would duplicate the primary', () => {
    const container = document.createElement('div');
    list._addListItem(container, 'twin', { name: 'Vega', nameKo: 'Vega', color: 0xffffff }, false);

    const btn = container.querySelector('.planet-list-item');
    expect(btn.querySelector('.planet-item-name-ko').textContent).toBe('Vega');
    expect(btn.querySelector('.planet-item-name')).toBeNull();
    expect(btn.textContent).toBe('Vega');
  });

  it('falls back to the English name as the primary label when nameKo is absent', () => {
    const container = document.createElement('div');
    list._addListItem(container, 'nameless', { name: 'Foo', color: 0xffffff }, false);

    const btn = container.querySelector('.planet-list-item');
    expect(btn.querySelector('.planet-item-name-ko').textContent).toBe('Foo');
    expect(btn.querySelector('.planet-item-name')).toBeNull();
  });
});

describe('PlanetList safe-area inset (REQ-PWA-103)', () => {
  it('adds a safe-area-inset-left margin to the panel, additive to the base left offset', () => {
    new PlanetList();
    const styleText = document.head.querySelector('style').textContent;
    expect(styleText).toContain('left: calc(16px + env(safe-area-inset-left, 0px));');
  });

  it('adds safe-area-inset-top/left margins to the toggle button', () => {
    new PlanetList();
    const styleText = document.head.querySelector('style').textContent;
    expect(styleText).toContain('top: calc(16px + env(safe-area-inset-top, 0px));');
    expect(styleText).toContain('left: calc(16px + env(safe-area-inset-left, 0px));');
  });
});

describe('PlanetList kid-sized tap targets (REQ-MOB-105, AC-MOB-105)', () => {
  // jsdom has no layout engine — offsetHeight/clientWidth are always 0 — but it
  // DOES cascade class rules from an injected <style> into getComputedStyle
  // (the nameKo font-size test above relies on the same mechanism). Sizes are
  // therefore declared as explicit min-height/width floors so the target is a
  // real computed value here, not a style-text string match.
  const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]);

  let list;
  beforeEach(() => {
    list = new PlanetList();
  });

  it('gives every top-level row a >=48px height floor', () => {
    for (const key of ['sun', 'mars', 'pluto', 'siriusA']) {
      expect(px(list._buttons[key], 'minHeight'), key).toBeGreaterThanOrEqual(48);
    }
  });

  it('gives indented moon rows the same >=48px floor', () => {
    expect(px(list._buttons.io, 'minHeight')).toBeGreaterThanOrEqual(48);
  });

  it('widens the moon-group caret to a >=32px hit area', () => {
    const { caret } = list._moonGroups.jupiter;
    expect(px(caret, 'width')).toBeGreaterThanOrEqual(32);
    expect(px(caret, 'minHeight')).toBeGreaterThanOrEqual(32);
  });

  it('gives the sidebar toggle button a >=44x44 hit area', () => {
    expect(px(list._toggleBtn, 'width')).toBeGreaterThanOrEqual(44);
    expect(px(list._toggleBtn, 'height')).toBeGreaterThanOrEqual(44);
  });
});

describe('index.html mobile media query carries the kid-sized floor (AC-MOB-105)', () => {
  // index.html's <style> is never loaded into jsdom, so its @media (max-width:768px)
  // block is unreachable through getComputedStyle. It is asserted as file text —
  // the one target below that cannot be a computed-value check.
  // Read from the project root (vitest's cwd); import.meta.url is an http://
  // URL under the vite-served jsdom environment, so it cannot be used here.
  const html = readFileSync('index.html', 'utf8');
  const planetListBlock = html.slice(
    html.indexOf('/* Responsive: Planet List */'),
    html.indexOf('/* Responsive: Earth HUD'),
  );

  it('declares the >=48px row floor inside the <=768px planet-list block', () => {
    expect(planetListBlock).toMatch(/\.planet-list-item\s*\{[^}]*min-height:\s*48px/);
  });

  it('anchors the reopened planet-list to the measured bar height, not a constant', () => {
    // The list auto-hides at <=768px but the toggle button reopens it there, so
    // its bottom offset is reachable on a phone and must clear the same
    // two-row-capable TimeControls bar the strip clears (REQ-MOB-301).
    expect(planetListBlock).toMatch(
      /\.planet-list\s*\{[^}]*bottom:\s*var\(--time-controls-h, calc\(\d+px \+ env\(safe-area-inset-bottom, 0px\)\)\)/,
    );
  });
});

describe('InfoPanel dwarf branch (REQ-030, TASK-004)', () => {
  let panel;
  beforeEach(() => {
    panel = new InfoPanel();
  });

  it('shows the "왜소행성" classification and discovery year', () => {
    panel.show('ceres', PLANET_DATA.ceres);
    const grid = panel.el.querySelector('.info-grid').textContent;
    expect(panel.el.querySelector('.planet-name').textContent).toBe('Ceres');
    expect(grid).toContain(STR.infoValueDwarfPlanet);
    expect(grid).toContain('1801'); // discovery year
  });

  it('does not label a regular planet as a dwarf', () => {
    panel.show('mars', PLANET_DATA.mars);
    const grid = panel.el.querySelector('.info-grid').textContent;
    expect(grid).not.toContain(STR.infoValueDwarfPlanet);
  });
});

describe('InfoPanel belt branch (REQ-EVT-205)', () => {
  let panel;
  beforeEach(() => {
    panel = new InfoPanel();
  });

  it('reads a belt out as a band rather than as a sphere', () => {
    panel.show('asteroidBelt', BELT_DATA.asteroidBelt);
    const grid = panel.el.querySelector('.info-grid').textContent;
    expect(panel.el.querySelector('.planet-name-ko').textContent).toBe('소행성대');
    expect(grid).toContain(STR.infoValueBelt);
    expect(grid).toContain('2.2 ~ 3.2 AU');
    // A band has no diameter, no spin and no tilt — the generic branch would
    // print NaN km for all three.
    expect(grid).not.toContain('NaN');
    expect(grid).not.toContain(STR.infoDiameter);
  });

  it('shows the kid facts a belt selection speaks', () => {
    const data = panel.show('kuiperBelt', BELT_DATA.kuiperBelt);
    expect(data).toBe(BELT_DATA.kuiperBelt);
    const facts = [...panel.el.querySelectorAll('.kid-fact')].map((li) => li.textContent);
    expect(facts).toEqual(BELT_DATA.kuiperBelt.factsKo);
    expect(panel.el.querySelector('.kid-emoji').textContent).toBe(BELT_DATA.kuiperBelt.emoji);
  });
});
