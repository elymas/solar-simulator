import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { EarthRig } from '../src/earth/EarthRig.js';
import { EARTH_RIG, EARTH_VIEW_DEFAULTS } from '../src/utils/constants.js';

// A loader that returns bare texture stand-ins so no real image decode happens.
const stubLoader = () => ({ load: () => ({}) });

describe('Moon orbital parameters (E7, REQ-330 numeric tolerances)', () => {
  it('orbital period is 27.32 days within +/-5%', () => {
    const p = EARTH_RIG.moonOrbitalPeriodDays;
    expect(p).toBeGreaterThanOrEqual(27.32 * 0.95);
    expect(p).toBeLessThanOrEqual(27.32 * 1.05);
  });

  it('orbital inclination is 5.14 degrees within +/-0.5 degrees', () => {
    const i = EARTH_RIG.moonInclinationDeg;
    expect(i).toBeGreaterThanOrEqual(5.14 - 0.5);
    expect(i).toBeLessThanOrEqual(5.14 + 0.5);
  });
});

describe('EarthRig construction (E7)', () => {
  let rig;
  beforeEach(() => {
    rig = new EarthRig({ textureLoader: stubLoader() });
  });

  it('applies the moon inclination to the orbit plane', () => {
    expect(rig.moonOrbit.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(EARTH_RIG.moonInclinationDeg), 6);
  });

  it('places the moon at the schematic orbit distance', () => {
    expect(rig.moon.position.x).toBe(EARTH_RIG.moonDistance);
  });

  it('builds a lit earth sphere at the earth-local radius', () => {
    expect(rig.earth.material.isMeshStandardMaterial).toBe(true);
    expect(rig.earth.geometry.parameters.radius).toBe(EARTH_VIEW_DEFAULTS.earthRadius);
  });

  it('wires the terminator via onBeforeCompile with sun-direction + night-map uniforms', () => {
    expect(typeof rig.earth.material.onBeforeCompile).toBe('function');
    const uniforms = rig.earth.material.userData.terminatorUniforms;
    expect(uniforms.uSunDirection.value).toBeInstanceOf(THREE.Vector3);
    expect(uniforms.uNightMap).toBeDefined();

    // The patch injects the uniforms + a world-normal varying into the shader.
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <dithering_fragment>' };
    rig.earth.material.onBeforeCompile(shader);
    expect(shader.uniforms.uSunDirection).toBe(uniforms.uSunDirection);
    expect(shader.fragmentShader).toContain('uNightMap');
    expect(shader.vertexShader).toContain('vEarthWorldNormal');
  });
});

describe('EarthRig update (E7)', () => {
  it('advances earth spin and moon orbit over time', () => {
    const rig = new EarthRig({ textureLoader: stubLoader() });
    const earth0 = rig.earth.rotation.y;
    const moon0 = rig.moonPivot.rotation.y;
    rig.update(1, 1); // 1 second at 1 day/sec
    expect(rig.earth.rotation.y).toBeGreaterThan(earth0);
    expect(rig.moonPivot.rotation.y).toBeGreaterThan(moon0);
  });

  it('completes one moon orbit in ~27.32 sim days (2*PI rotation)', () => {
    const rig = new EarthRig({ textureLoader: stubLoader() });
    rig.update(EARTH_RIG.moonOrbitalPeriodDays, 1); // advance a full period in days
    expect(rig.moonPivot.rotation.y).toBeCloseTo(2 * Math.PI, 5);
  });
});
