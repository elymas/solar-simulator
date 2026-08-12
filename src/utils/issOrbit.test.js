import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { issPosition } from './issOrbit.js';
import { ISS_DEFAULTS, EARTH_VIEW_DEFAULTS, FLIGHT_DEFAULTS } from './constants.js';

const { orbitalPeriodMinutes, inclinationDeg, altitudeOffset } = ISS_DEFAULTS;
const RADIUS = EARTH_VIEW_DEFAULTS.earthRadius + altitudeOffset;
const AIRCRAFT_MAX_ALTITUDE_UNITS = 45000 * FLIGHT_DEFAULTS.altitudeScale; // cruise ceiling, same band the SPEC references

function vectorLength(p) {
  return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
}

describe('issPosition (SPEC-EARTH-003 REQ-E3-201)', () => {
  it('is a pure function: same input always yields the same output', () => {
    expect(issPosition(37)).toEqual(issPosition(37));
  });

  it('closes the orbit: position(t) matches position(t + 92 sim-minutes) for several t', () => {
    for (const t of [0, 17.3, 45, 91.999, 250.5]) {
      const a = issPosition(t);
      const b = issPosition(t + orbitalPeriodMinutes);
      expect(b.x).toBeCloseTo(a.x, 9);
      expect(b.y).toBeCloseTo(a.y, 9);
      expect(b.z).toBeCloseTo(a.z, 9);
    }
  });

  it('holds a constant radius above the aircraft altitude band across a full orbit', () => {
    expect(altitudeOffset).toBeGreaterThan(AIRCRAFT_MAX_ALTITUDE_UNITS);
    for (let step = 0; step <= 20; step += 1) {
      const t = (orbitalPeriodMinutes * step) / 20;
      expect(vectorLength(issPosition(t))).toBeCloseTo(RADIUS, 9);
    }
  });

  it('reaches a maximum geodetic latitude of 51.6 degrees within +/-0.5 degrees, and the mirrored minimum', () => {
    let maxLat = -Infinity;
    let minLat = Infinity;
    const samples = 3600;
    for (let i = 0; i < samples; i += 1) {
      const t = (orbitalPeriodMinutes * i) / samples;
      const { y } = issPosition(t);
      const latDeg = (Math.asin(y / RADIUS) * 180) / Math.PI;
      maxLat = Math.max(maxLat, latDeg);
      minLat = Math.min(minLat, latDeg);
    }
    expect(maxLat).toBeGreaterThanOrEqual(inclinationDeg - 0.5);
    expect(maxLat).toBeLessThanOrEqual(inclinationDeg + 0.5);
    expect(minLat).toBeGreaterThanOrEqual(-inclinationDeg - 0.5);
    expect(minLat).toBeLessThanOrEqual(-inclinationDeg + 0.5);
  });

  it('moves a quarter of the circumference over a quarter period (orthogonal step, chord = radius*sqrt(2))', () => {
    const quarter = orbitalPeriodMinutes / 4;
    for (const t of [0, 10, 60]) {
      const a = issPosition(t);
      const b = issPosition(t + quarter);
      const dot = a.x * b.x + a.y * b.y + a.z * b.z;
      expect(dot).toBeCloseTo(0, 6); // quarter-turn => orthogonal position vectors
      const chord = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
      expect(chord).toBeCloseTo(RADIUS * Math.sqrt(2), 6);
    }
  });

  it('never touches the network (REQ-E3-204): no fetch/XHR/URL literal in the module source', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'issOrbit.js'), 'utf8');
    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).toMatch(/A-405/); // documents the symbolic-orbit assumption
  });
});
