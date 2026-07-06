import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PLANET_DATA } from '../src/planets/planetData.js';
import { PlanetList } from '../src/ui/PlanetList.js';
import { InfoPanel } from '../src/ui/InfoPanel.js';

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

  it('renders a "Dwarf Planets" divider', () => {
    const dividers = [...document.querySelectorAll('.planet-list-divider')].map((d) => d.textContent);
    expect(dividers).toContain('Dwarf Planets');
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

describe('InfoPanel dwarf branch (REQ-030, TASK-004)', () => {
  let panel;
  beforeEach(() => {
    panel = new InfoPanel();
  });

  it('shows the "Dwarf Planet" classification and discovery year', () => {
    panel.show('ceres', PLANET_DATA.ceres);
    const grid = panel.el.querySelector('.info-grid').textContent;
    expect(panel.el.querySelector('.planet-name').textContent).toBe('Ceres');
    expect(grid).toContain('Dwarf Planet');
    expect(grid).toContain('1801'); // discovery year
  });

  it('does not label a regular planet as a dwarf', () => {
    panel.show('mars', PLANET_DATA.mars);
    const grid = panel.el.querySelector('.info-grid').textContent;
    expect(grid).not.toContain('Dwarf Planet');
  });
});
