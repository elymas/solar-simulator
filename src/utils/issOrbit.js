import { ISS_DEFAULTS, EARTH_VIEW_DEFAULTS } from './constants.js';

const DEG_TO_RAD = Math.PI / 180;

// @MX:NOTE: [AUTO] A-405 (SPEC-EARTH-003): this is an honest symbolic circular
// orbit, not real ISS tracking — no TLE, no precession, no J2 perturbation. It
// exists so a 5-year-old sees a marker sweep the globe on a plausible period and
// inclination, not to be mistaken for live tracking data (REQ-E3-204).
/**
 * Pure ISS position propagation. Same simTimeMinutes always yields the same
 * {x,y,z} in earth-local scene units — no module-level state, no wall-clock read.
 * @param {number} simTimeMinutes - Elapsed SIMULATION time in minutes.
 * @returns {{x: number, y: number, z: number}}
 */
export function issPosition(simTimeMinutes) {
  const { orbitalPeriodMinutes, inclinationDeg, altitudeOffset } = ISS_DEFAULTS;
  const radius = EARTH_VIEW_DEFAULTS.earthRadius + altitudeOffset;
  const angle = (simTimeMinutes / orbitalPeriodMinutes) * 2 * Math.PI;

  // Circle in the equatorial (x-z) plane, then tilted inclinationDeg around the
  // x-axis — same convention as EarthRig's moonOrbit.rotation.x, where y is the
  // earth-local polar axis. This tilt step is the one non-obvious line: it turns
  // a flat equatorial circle into the inclined orbital plane by rotating the
  // z-component into y (elevation) and a foreshortened z.
  const inclinationRad = inclinationDeg * DEG_TO_RAD;
  const zOrbit = radius * Math.sin(angle);
  return {
    x: radius * Math.cos(angle),
    y: zOrbit * Math.sin(inclinationRad),
    z: zOrbit * Math.cos(inclinationRad),
  };
}
