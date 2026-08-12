import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PLANET_DATA } from '../src/planets/planetData.js';
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
