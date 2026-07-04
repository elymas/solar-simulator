import { describe, it, expect } from 'vitest';
import { geoToLocal } from '../src/effects/AircraftLayer.js';

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
