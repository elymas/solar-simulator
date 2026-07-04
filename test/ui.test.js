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
