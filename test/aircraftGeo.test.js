import { describe, it, expect } from 'vitest';
import { geoToLocal } from '../src/effects/AircraftLayer.js';
import { FLIGHT_DEFAULTS, EARTH_VIEW_DEFAULTS } from '../src/utils/constants.js';

describe('geoToLocal — lat/lon/alt -> earth-local position', () => {
  it('maps (0,0) to +X on the equator at surface radius', () => {
    const p = geoToLocal(0, 0, 100, 0);
    expect(p.x).toBeCloseTo(100, 5);
    expect(p.y).toBeCloseTo(0, 5);
    expect(p.z).toBeCloseTo(0, 5);
  });

  it('maps the north pole to +Y', () => {
    const p = geoToLocal(90, 0, 100, 0);
    expect(p.y).toBeCloseTo(100, 5);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(0, 5);
  });

  it('lifts by the altitude offset above the surface', () => {
    const p = geoToLocal(0, 0, 100, 5);
    expect(p.x).toBeCloseTo(105, 5);
  });

  it('keeps every mapped point on the sphere of radius+alt', () => {
    const r = 100;
    const p = geoToLocal(37.5, -122.3, r, 2);
    expect(p.length()).toBeCloseTo(r + 2, 4);
  });
});

describe('FLIGHT_DEFAULTS.altitudeScale — realistic cruise altitude stays close to the surface', () => {
  it('a real-world cruise altitude (30k-45k ft) offsets well under earthRadius, not hundreds of units out', () => {
    const r = EARTH_VIEW_DEFAULTS.earthRadius;
    for (const cruiseFt of [30000, 35000, 40000, 45000]) {
      const offset = cruiseFt * FLIGHT_DEFAULTS.altitudeScale;
      // Regression guard: the previous scale (0.02) put a 35k ft airliner at
      // +700 units — 7x earthRadius out in space. This keeps markers within a
      // small band above the surface (a schematic, not physically true, scale
      // like the rest of this app's Earth-local visuals).
      expect(offset).toBeLessThan(r * 0.15);
      expect(offset).toBeGreaterThan(0);
    }
  });
});
