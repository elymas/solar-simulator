import { describe, it, expect } from 'vitest';
import { PLANET_DATA, MOON_DATA, STAR_DATA } from '../src/planets/planetData.js';

const DWARF_KEYS = ['ceres', 'pluto', 'eris', 'makemake', 'haumea'];

describe('planetData module loads', () => {
  it('exports the core data tables', () => {
    expect(PLANET_DATA).toBeTypeOf('object');
    expect(MOON_DATA).toBeTypeOf('object');
    expect(STAR_DATA).toBeTypeOf('object');
    expect(PLANET_DATA.earth).toBeDefined();
  });
});

describe('F1 dwarf planets (REQ-010, REQ-020, REQ-060)', () => {
  it('adds exactly the five IAU dwarf planets, all tagged category:dwarf', () => {
    const dwarfs = Object.entries(PLANET_DATA)
      .filter(([, d]) => d.category === 'dwarf')
      .map(([k]) => k);
    expect(dwarfs.sort()).toEqual([...DWARF_KEYS].sort());
  });

  it('each dwarf carries the fields the UI and orbit code need', () => {
    for (const key of DWARF_KEYS) {
      const d = PLANET_DATA[key];
      expect(d, key).toBeDefined();
      expect(d.name, key).toBeTypeOf('string');
      expect(d.nameKo, key).toBeTypeOf('string');
      expect(d.discoveryYear, key).toBeTypeOf('number');
      expect(d.distanceDisplay, key).toBeGreaterThan(0);
      expect(d.orbitalPeriod, key).toBeGreaterThan(0);
      expect(d.radius, key).toBeGreaterThan(0);
      expect(d.displayRadius, key).toBeGreaterThan(0);
      expect(d.eccentricity, key).toBeGreaterThanOrEqual(0);
      expect(d.inclination, key).toBeGreaterThanOrEqual(0);
    }
  });

  it('places Ceres in the asteroid belt between Mars and Jupiter (REQ-020)', () => {
    expect(PLANET_DATA.ceres.distanceDisplay).toBeGreaterThan(PLANET_DATA.mars.distanceDisplay);
    expect(PLANET_DATA.ceres.distanceDisplay).toBeLessThan(PLANET_DATA.jupiter.distanceDisplay);
  });

  it('places the four TNO dwarfs beyond Neptune (REQ-020)', () => {
    for (const key of ['pluto', 'eris', 'makemake', 'haumea']) {
      expect(PLANET_DATA[key].distanceDisplay, key).toBeGreaterThan(PLANET_DATA.neptune.distanceDisplay);
    }
  });

  it('reflects real eccentricity/inclination, not circularized (REQ-040)', () => {
    expect(PLANET_DATA.pluto.eccentricity).toBeCloseTo(0.248, 2);
    expect(PLANET_DATA.pluto.inclination).toBeCloseTo(17.16, 1);
    expect(PLANET_DATA.eris.eccentricity).toBeGreaterThan(0.4);
  });
});

describe('F2 major moons (REQ-110, REQ-120, REQ-160)', () => {
  it('completes the four Galilean moons of Jupiter with Callisto', () => {
    expect(MOON_DATA.jupiter.map((m) => m.key)).toEqual([
      'io', 'europa', 'ganymede', 'callisto',
    ]);
  });

  it('completes Saturn seven round moons in real orbital order (REQ-120)', () => {
    expect(MOON_DATA.saturn.map((m) => m.key)).toEqual([
      'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'iapetus',
    ]);
  });

  it('spaces every moon monotonically with a non-overlapping gap', () => {
    for (const parent of ['jupiter', 'saturn']) {
      const dists = MOON_DATA[parent].map((m) => m.distanceDisplay);
      for (let i = 1; i < dists.length; i++) {
        expect(dists[i], `${parent}[${i}]`).toBeGreaterThan(dists[i - 1]);
        expect(dists[i] - dists[i - 1], `${parent} gap ${i}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('leaves the shipped Mars/Uranus/Neptune moons byte-identical (REQ-160)', () => {
    // Snapshot guard: these arrays are out of scope for SPEC-SIM-001 and must
    // not drift when Jupiter/Saturn moons are extended.
    expect(MOON_DATA.mars).toMatchSnapshot();
    expect(MOON_DATA.uranus).toMatchSnapshot();
    expect(MOON_DATA.neptune).toMatchSnapshot();
  });
});

describe('F1 Charon satellite (REQ-050, optional)', () => {
  it('renders Charon through the existing pivot pipeline under Pluto', () => {
    expect(MOON_DATA.pluto).toBeDefined();
    expect(MOON_DATA.pluto.map((m) => m.key)).toContain('charon');
    // Pluto must exist as a parent key so the moon loop attaches Charon.
    expect(PLANET_DATA.pluto).toBeDefined();
  });
});
