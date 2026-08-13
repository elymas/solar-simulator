import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
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

// The globe a marker must land ON is a THREE.SphereGeometry carrying an
// equirectangular texture (EarthRig._buildEarth). So the only definition of
// "correct" here is that geoToLocal agrees with THAT geometry's own uv->position
// convention — not with any hand-derived spherical formula. These tests read the
// convention straight out of the geometry rather than restating it, which is why
// they catch a sign error the surrounding suite missed: every pre-existing case
// sampled either lon=0 or a pole, and both are fixed points of a longitude flip.
describe('geoToLocal agrees with the Earth sphere it draws onto (REQ-420)', () => {
  const R = 100;
  const geo = new THREE.SphereGeometry(R, 96, 96);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');

  /** Equirectangular lat/lon for a vertex's uv, in degrees. */
  const lonOf = (i) => (uv.getX(i) - 0.5) * 360;
  const latOf = (i) => (uv.getY(i) - 0.5) * 180;

  it('places a vertex where that vertex\'s own uv says it should be', () => {
    // Stride across the whole buffer so both hemispheres and all four
    // longitude quadrants are covered, not just one lucky band.
    for (let i = 0; i < pos.count; i += 331) {
      const lat = latOf(i);
      const lon = lonOf(i);
      // Skip the poles: every longitude collapses to the same point there, so
      // they cannot witness a longitude error.
      if (Math.abs(lat) > 89) continue;
      const p = geoToLocal(lat, lon, R, 0);
      expect(p.x, `lat=${lat.toFixed(1)} lon=${lon.toFixed(1)} x`).toBeCloseTo(pos.getX(i), 3);
      expect(p.y, `lat=${lat.toFixed(1)} lon=${lon.toFixed(1)} y`).toBeCloseTo(pos.getY(i), 3);
      expect(p.z, `lat=${lat.toFixed(1)} lon=${lon.toFixed(1)} z`).toBeCloseTo(pos.getZ(i), 3);
    }
  });

  it('puts Seoul in the eastern hemisphere, not its mirror image in the Pacific', () => {
    // The regression this file exists for: a flipped longitude drew Seoul's
    // traffic at 126.9°W — off Baja California, which is where the first
    // real-device screenshot found it. The snapshot is worldwide now, so the
    // coordinates are a sample point rather than the query centre; the mirror
    // bug they catch is the same one.
    const SEOUL = { lat: 37.5, lon: 126.9 };
    const seoul = geoToLocal(SEOUL.lat, SEOUL.lon, R, 0);
    const mirror = geoToLocal(SEOUL.lat, -SEOUL.lon, R, 0);
    expect(seoul.z).not.toBeCloseTo(mirror.z, 1);

    // Nearest sphere vertex must carry an EASTERN longitude in its uv.
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const d = seoul.distanceToSquared(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      if (d < bestD) { bestD = d; best = i; }
    }
    // Eastern hemisphere is the claim under test; the exact value can only land
    // within one longitude segment (360/96 = 3.75 deg) of the query point.
    expect(lonOf(best)).toBeGreaterThan(0);
    expect(Math.abs(lonOf(best) - SEOUL.lon)).toBeLessThan(360 / 96);
  });
});

describe('FLIGHT_DEFAULTS.markerScale — aircraft read as aircraft, not as continents', () => {
  it('keeps a marker small against the airspace it must resolve inside', () => {
    // A busy metro area's traffic sits inside roughly a 250 nm circle (~463 km,
    // ~7.3 units at this earthRadius). A marker whose wingspan fills that circle
    // turns a whole city's arrivals into one blob — the second half of the
    // real-device "aircraft all in one spot" report. The snapshot went worldwide
    // but the readability floor is unchanged, so the yardstick stays local.
    const METRO_RADIUS_NM = 250;
    const WINGSPAN_UNITS = 6 * FLIGHT_DEFAULTS.markerScale;
    const queryRadiusUnits = (METRO_RADIUS_NM * 1.852) / 6371 * EARTH_VIEW_DEFAULTS.earthRadius;
    expect(WINGSPAN_UNITS).toBeLessThan(queryRadiusUnits / 4);
    expect(WINGSPAN_UNITS).toBeGreaterThan(0.2); // still visible to a child
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
