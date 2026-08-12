import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PLANET_DATA } from './planetData.js';
import { OrbitalMechanics } from './OrbitalMechanics.js';
import { PlanetFactory } from './PlanetFactory.js';

// AC-EVT-101 / REQ-EVT-101. The q/Q envelope below is not a guess: it is
// a(1-e) and a(1+e) for a=700, e=0.967, and it is what a full-period sweep of
// the shipped solver actually produces. The ±5% band is the acceptance
// tolerance, not the solver's error — the solver lands on these to 1e-10.
const HALLEY_PERIHELION = 23.10;
const HALLEY_APHELION = 1376.90;
const SWEEP_SAMPLES = 2000;

/** @returns {{min:number, max:number, maxResidual:number}} */
function sweepFullPeriod(data, n = SWEEP_SAMPLES) {
  let min = Infinity;
  let max = -Infinity;
  let maxResidual = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * data.orbitalPeriod;
    const { x, y, z } = OrbitalMechanics.calculatePosition(data, t);
    const r = Math.hypot(x, y, z);
    min = Math.min(min, r);
    max = Math.max(max, r);

    // Kepler's equation residual at this sample: the solver claims
    // M = E - e*sin(E), so this must stay at zero across the whole sweep.
    const M = ((2 * Math.PI) / data.orbitalPeriod) * t;
    const E = OrbitalMechanics._solveKepler(M, data.eccentricity);
    maxResidual = Math.max(maxResidual, Math.abs(E - data.eccentricity * Math.sin(E) - M));
  }
  return { min, max, maxResidual };
}

/**
 * Worst perpendicular distance between the sampled orbit polyline and the true
 * ellipse it approximates, in display units. This is the number that decides
 * whether an orbit line reads as a curve or as a cut-off polygon.
 * @param {Object} data - Body data (distanceDisplay, eccentricity).
 * @param {number} segments - Segment count handed to generateOrbitPath.
 */
function maxPolylineDeviation(data, segments) {
  const a = data.distanceDisplay;
  const e = data.eccentricity;
  const semiLatusRectum = a * (1 - e * e);
  const pointAt = (nu) => {
    const r = semiLatusRectum / (1 + e * Math.cos(nu));
    return [r * Math.cos(nu), r * Math.sin(nu)];
  };

  let worst = 0;
  for (let i = 0; i < segments; i++) {
    const nu0 = (i / segments) * Math.PI * 2;
    const nu1 = ((i + 1) / segments) * Math.PI * 2;
    const [ax, ay] = pointAt(nu0);
    const [bx, by] = pointAt(nu1);
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    for (let k = 1; k < 40; k++) {
      const [px, py] = pointAt(nu0 + ((nu1 - nu0) * k) / 40);
      const t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      worst = Math.max(worst, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
    }
  }
  return worst;
}

describe("Halley's Comet data entry (REQ-EVT-101)", () => {
  it('joins the Keplerian body table tagged as a comet', () => {
    const halley = PLANET_DATA.halley;
    expect(halley).toBeDefined();
    expect(halley.category).toBe('comet');
    expect(halley.nameKo).toBe('핼리 혜성');
    expect(halley.emoji).toBe('☄️');
  });

  it('keeps the real orbital shape (e=0.967, retrograde i=162.3)', () => {
    expect(PLANET_DATA.halley.eccentricity).toBe(0.967);
    expect(PLANET_DATA.halley.inclination).toBe(162.3);
    // >90 deg is what "retrograde" means; the sim has no other body past 90.
    expect(PLANET_DATA.halley.inclination).toBeGreaterThan(90);
  });

  it('scales a to 700 display units and the period to 7.6 simulation years', () => {
    expect(PLANET_DATA.halley.distanceDisplay).toBe(700);
    // orbitalPeriod is Earth days everywhere in this file (Mercury 87.97), so
    // 7.6 years is 7.6 * 365.25.
    expect(PLANET_DATA.halley.orbitalPeriod).toBeCloseTo(7.6 * 365.25, 1);
  });

  it('carries the render fields the shared body pipeline needs', () => {
    const halley = PLANET_DATA.halley;
    expect(halley.displayRadius).toBeGreaterThan(0);
    expect(halley.color).toBeTypeOf('number');
  });
});

describe('Halley orbit sweep over one full period (AC-EVT-101)', () => {
  const sweep = () => sweepFullPeriod(PLANET_DATA.halley);

  it('dives to a perihelion inside Mercury and climbs past Eris at aphelion', () => {
    const { min, max } = sweep();
    expect(min).toBeGreaterThan(HALLEY_PERIHELION * 0.95);
    expect(min).toBeLessThan(HALLEY_PERIHELION * 1.05);
    expect(max).toBeGreaterThan(HALLEY_APHELION * 0.95);
    expect(max).toBeLessThan(HALLEY_APHELION * 1.05);

    // The qualitative claim the scaling comment makes, pinned numerically.
    expect(min).toBeLessThan(PLANET_DATA.mercury.distanceDisplay);
    expect(max).toBeGreaterThan(PLANET_DATA.eris.distanceDisplay);
  });

  it('keeps the Kepler solver converged at e=0.967 across the whole period', () => {
    // Characterization of the shipped 10-iteration Newton-Raphson solver: it
    // needs no high-eccentricity special case, so the spec's e=0.9 fallback
    // (assumption A-301) stays unused. If this ever fails, that fallback is
    // back on the table.
    expect(sweep().maxResidual).toBeLessThan(1e-6);
  });

  it('rises far off the ecliptic on its retrograde inclination', () => {
    let maxLatDeg = 0;
    for (let i = 0; i < 720; i++) {
      const t = (i / 720) * PLANET_DATA.halley.orbitalPeriod;
      const { x, y, z } = OrbitalMechanics.calculatePosition(PLANET_DATA.halley, t);
      maxLatDeg = Math.max(maxLatDeg, (Math.asin(Math.abs(y) / Math.hypot(x, y, z)) * 180) / Math.PI);
    }
    // sin(162.3 deg) = sin(17.7 deg): a retrograde orbit leans as far off the
    // ecliptic as its supplement, not as far as 162 deg would suggest.
    expect(maxLatDeg).toBeGreaterThan(17);
    expect(maxLatDeg).toBeLessThan(18.5);
  });
});

describe('Halley orbit line smoothness', () => {
  it('reads as a curve at the comet segment count, not at the shared default', () => {
    const halley = PLANET_DATA.halley;
    // At the 128-segment default the sampler spaces its widest chords exactly
    // at the aphelion apex, where the ellipse is sharpest (curvature radius
    // a(1-e^2) = 45 units), and cuts the tip flat by ~10 units — five nucleus
    // diameters of visible facet.
    expect(maxPolylineDeviation(halley, 128)).toBeGreaterThan(5);
    // The comet's own segment count has to bring that under one display unit.
    expect(halley.orbitSegments).toBeGreaterThan(128);
    expect(maxPolylineDeviation(halley, halley.orbitSegments)).toBeLessThan(1);
  });
});

describe('Halley mounts through the shared body pipeline', () => {
  let factory;
  beforeEach(() => {
    factory = new PlanetFactory(new THREE.Scene(), {
      renderer: { capabilities: { getMaxAnisotropy: () => 16 } },
      setHoveredObject: () => {},
    });
  });

  it('gets a nucleus mesh positioned by the shared Keplerian solver', () => {
    const nucleus = factory.planets.halley?.mesh;
    expect(nucleus).toBeDefined();
    const expected = OrbitalMechanics.calculatePosition(PLANET_DATA.halley, 0);
    expect(nucleus.position.x).toBeCloseTo(expected.x, 6);
    expect(nucleus.position.z).toBeCloseTo(expected.z, 6);
  });

  it('draws its orbit line at the comet segment count, leaving other bodies at 128', () => {
    const byName = (n) => factory.orbitLines.find((l) => l.name === n);
    expect(byName('halleyOrbit').geometry.attributes.position.count)
      .toBe(PLANET_DATA.halley.orbitSegments);
    expect(byName('earthOrbit').geometry.attributes.position.count).toBe(128);
  });

  it('moves along the orbit as simulation time advances', () => {
    const nucleus = factory.planets.halley.mesh;
    const start = nucleus.position.clone();
    factory.update(PLANET_DATA.halley.orbitalPeriod / 4, 1 / 60);
    expect(nucleus.position.distanceTo(start)).toBeGreaterThan(1);
  });
});
