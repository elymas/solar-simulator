import * as THREE from 'three';

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
    r * Math.cos(la) * Math.sin(lo)
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
   */
  constructor({ maxInstances = 500, earthRadius = 100, altitudeScale = 0.02 } = {}) {
    this._max = maxInstances;
    this._earthRadius = earthRadius;
    this._altScale = altitudeScale;

    const geo = new THREE.ConeGeometry(1.4, 5, 6);
    geo.rotateX(Math.PI / 2); // cone tip points +Z (heading forward) instead of +Y
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxInstances);
    this.mesh.name = 'aircraftInstances';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._scale = new THREE.Vector3(1, 1, 1);
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
