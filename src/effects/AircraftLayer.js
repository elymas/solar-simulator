import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Build a small low-poly airplane silhouette (fuselage + main wings + tail
 * wings), nose pointing +Z, so instances read as "aircraft" rather than a
 * bare cone/triangle even when many overlap at low zoom.
 * @returns {THREE.BufferGeometry}
 */
function buildAircraftGeometry() {
  const fuselage = new THREE.ConeGeometry(0.5, 5, 8);
  fuselage.rotateX(Math.PI / 2); // apex (nose) points +Z instead of +Y

  const wings = new THREE.BoxGeometry(6, 0.15, 1.1);
  wings.translate(0, 0, -0.3);

  const tail = new THREE.BoxGeometry(2.2, 0.15, 0.8);
  tail.translate(0, 0, -2);

  return mergeGeometries([fuselage, wings, tail]);
}

// @MX:ANCHOR: [AUTO] The globe these markers land on is a THREE.SphereGeometry
// wearing an equirectangular texture, so THAT geometry's uv->position convention
// is the contract — not a textbook spherical formula. Three.js winds its sphere
// as z = +sin(phi) with phi = u * 2PI, and equirectangular u=0.5 is the prime
// meridian, which puts EAST longitude on -Z. Getting this sign wrong mirrors the
// whole world about the Greenwich/dateline axis, and the mirror is invisible at
// lon=0 and at either pole — the only places the original tests sampled.
// @MX:REASON: [AUTO] Any layer positioning by lat/lon (aircraft today, ground
// markers later) must share this convention or it silently draws on the wrong
// continent. Verified against the real geometry in test/aircraftGeo.test.js.
/**
 * Map geographic lat/lon (degrees) + altitude offset to an earth-local position on a
 * sphere of the given radius (y-up). Pure — unit-tested without WebGL.
 * @param {number} latDeg
 * @param {number} lonDeg
 * @param {number} radius
 * @param {number} [altOffset=0]
 * @returns {THREE.Vector3}
 */
export function geoToLocal(latDeg, lonDeg, radius, altOffset = 0) {
  const la = THREE.MathUtils.degToRad(latDeg);
  const lo = THREE.MathUtils.degToRad(lonDeg);
  const r = radius + altOffset;
  return new THREE.Vector3(
    r * Math.cos(la) * Math.cos(lo),
    r * Math.sin(la),
    -r * Math.cos(la) * Math.sin(lo)
  );
}

/**
 * AircraftLayer renders every tracked aircraft as one instance of a single
 * InstancedMesh (thousands of aircraft = one draw call). Positions come from the
 * (already validated + dead-reckoned) FlightDataService list; markers are oriented by
 * heading around the local surface normal. Instance count is capped defensively.
 */
export class AircraftLayer {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxInstances]
   * @param {number} [opts.earthRadius]
   * @param {number} [opts.altitudeScale] - baro-ft -> earth-local units.
   * @param {number} [opts.markerScale] - Uniform marker size multiplier (FLIGHT_DEFAULTS.markerScale).
   */
  constructor({ maxInstances = 500, earthRadius = 100, altitudeScale = 0.02, markerScale = 1 } = {}) {
    this._max = maxInstances;
    this._earthRadius = earthRadius;
    this._altScale = altitudeScale;

    const geo = buildAircraftGeometry();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxInstances);
    this.mesh.name = 'aircraftInstances';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._scale = new THREE.Vector3(markerScale, markerScale, markerScale);
  }

  /** @returns {THREE.InstancedMesh} */
  get object3d() {
    return this.mesh;
  }

  /**
   * Rewrite instance matrices from the current aircraft list.
   * @param {Array<{lat:number,lon:number,alt:number,track:number}>} aircraft
   */
  update(aircraft) {
    const n = Math.min(aircraft.length, this._max);
    for (let i = 0; i < n; i++) {
      const ac = aircraft[i];
      const pos = geoToLocal(ac.lat, ac.lon, this._earthRadius, ac.alt * this._altScale);
      const normal = pos.clone().normalize();
      // Align marker "up" to the surface normal, then spin by heading around it.
      this._q.setFromUnitVectors(this._up, normal);
      const headingQ = new THREE.Quaternion().setFromAxisAngle(normal, -THREE.MathUtils.degToRad(ac.track));
      this._q.premultiply(headingQ);
      this._m.compose(pos, this._q, this._scale);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
