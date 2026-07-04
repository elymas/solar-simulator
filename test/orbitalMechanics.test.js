import { describe, it, expect } from 'vitest';
import { OrbitalMechanics } from '../src/planets/OrbitalMechanics.js';
import { PLANET_DATA } from '../src/planets/planetData.js';

// Sample a full orbit and report distance spread + peak ecliptic latitude.
function sampleOrbit(data, n = 720) {
  let min = Infinity;
  let max = -Infinity;
  let maxLatDeg = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * data.orbitalPeriod;
    const { x, y, z } = OrbitalMechanics.calculatePosition(data, t);
    const r = Math.hypot(x, y, z);
    min = Math.min(min, r);
    max = Math.max(max, r);
    maxLatDeg = Math.max(maxLatDeg, (Math.asin(Math.abs(y) / r) * 180) / Math.PI);
  }
  return { min, max, ratio: max / min, maxLatDeg };
}

describe('OrbitalMechanics honours dwarf eccentricity & inclination (REQ-040)', () => {
  it('gives Pluto an elliptical orbit with aphelion/perihelion ratio ~1.66', () => {
    const { ratio } = sampleOrbit(PLANET_DATA.pluto);
    // (1 + e) / (1 - e) for e = 0.2488 -> ~1.66, acceptance tolerance +/-5%.
    expect(ratio).toBeGreaterThan(1.66 * 0.95);
    expect(ratio).toBeLessThan(1.66 * 1.05);
  });

  it('tilts Pluto ~17 degrees above the ecliptic', () => {
    const { maxLatDeg } = sampleOrbit(PLANET_DATA.pluto);
    expect(maxLatDeg).toBeGreaterThan(16);
    expect(maxLatDeg).toBeLessThan(18);
  });

  it('gives Eris a strongly eccentric, highly inclined orbit', () => {
    const { ratio, maxLatDeg } = sampleOrbit(PLANET_DATA.eris);
    expect(ratio).toBeGreaterThan(2); // e = 0.44 -> ~2.58
    expect(maxLatDeg).toBeGreaterThan(40);
  });

  it('keeps a zero-inclination orbit flat (Earth stays on the ecliptic)', () => {
    const { maxLatDeg } = sampleOrbit(PLANET_DATA.earth);
    expect(maxLatDeg).toBeLessThan(0.001);
  });

  it('keeps a circular orbit at constant radius (perihelion == aphelion)', () => {
    const circular = { distanceDisplay: 100, orbitalPeriod: 100, eccentricity: 0, inclination: 0 };
    const { min, max } = sampleOrbit(circular);
    expect(max - min).toBeLessThan(1e-6);
  });
});
