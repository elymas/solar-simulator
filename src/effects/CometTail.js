import * as THREE from 'three';

// Anti-sunward comet tail (SPEC-EVENTS-001 REQ-EVT-102, REQ-EVT-104).
//
// This is a TAIL, not a trail: it is rebuilt every frame from the comet's
// current position and the sun's, and it never reads where the comet has been.
// Solar wind blows the coma directly away from the sun, so near aphelion the
// comet genuinely recedes tail-first — a position-history ribbon would draw the
// opposite and teach the wrong thing.
//
// Budget is fixed at construction (REQ-EVT-104): one Float32Array, one
// BufferGeometry, one draw call, forever. `update` only writes numbers.

/** Points in the cloud. One draw call regardless, so this is a fill-rate knob. */
export const TAIL_POINTS = 400;

/**
 * Tail reach in display units at perihelion. Halley's perihelion sits at 23
 * display units, inside Mercury's 80, so a 150-unit tail sweeps visibly past
 * the inner planets at the moment the pass happens. Purely a display choice —
 * the real tail's length has no meaningful mapping onto this symbolic scale.
 */
export const TAIL_MAX_LENGTH = 150;

/** Half-width of the cone at the tail tip, display units at perihelion. */
export const TAIL_MAX_WIDTH = 14;

/** Additive peak alpha; 400 overlapping points blow out past this. */
const TAIL_PEAK_OPACITY = 0.55;

/** Pale ion-tail blue. */
const TAIL_COLOR = 0x9fd8ff;

// --- pure helpers (unit-tested; no WebGL) ---

/**
 * Unit vector pointing directly away from the sun, which is the direction the
 * solar wind pushes the coma. Writes into `out` so the per-frame path can hand
 * it a hoisted scratch vector instead of allocating.
 * @param {THREE.Vector3} cometPos
 * @param {THREE.Vector3} sunPos
 * @param {THREE.Vector3} out - Required: callers own the allocation.
 * @returns {THREE.Vector3} `out`, normalized.
 */
export function tailAxis(cometPos, sunPos, out) {
  return out.subVectors(cometPos, sunPos).normalize();
}

/**
 * Tail strength from perihelion proximity, 0..1. A comet only grows a tail when
 * the sun is close enough to sublimate its ice, so this is q/r clamped: 1 at
 * perihelion, and at Halley's aphelion (1377) it falls to 23/1377 = 0.017,
 * which is the tail all but vanishing. That fade is correct, not a bug.
 * @param {number} r - Current distance from the sun, display units.
 * @param {number} perihelion - q = a(1-e), display units.
 * @returns {number} 0..1
 */
export function tailIntensity(r, perihelion) {
  if (!(r > 0)) return 1;
  return Math.min(1, perihelion / r);
}

// --- per-frame scratch, hoisted so `update` never constructs anything ---

const _axis = new THREE.Vector3();
const _basisRef = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();

export class CometTail {
  /**
   * @param {Object} data - Comet body data (distanceDisplay, eccentricity).
   */
  constructor(data) {
    this._perihelion = data.distanceDisplay * (1 - data.eccentricity);

    // Fixed layout, generated once. `_along` is each point's fraction of the
    // full tail length; squaring the uniform ramp packs points toward the
    // nucleus, so additive blending renders a bright coma fading to a wisp.
    // `_lateral` is a point in the unit disc, applied in the plane
    // perpendicular to the axis and scaled by `_along` to open a cone.
    this._along = new Float32Array(TAIL_POINTS);
    this._lateral = new Float32Array(TAIL_POINTS * 2);
    for (let i = 0; i < TAIL_POINTS; i++) {
      const u = (i + 0.5) / TAIL_POINTS;
      this._along[i] = u * u;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random());
      this._lateral[i * 2] = radius * Math.cos(angle);
      this._lateral[i * 2 + 1] = radius * Math.sin(angle);
    }

    // The one allocation of the whole effect (REQ-EVT-104).
    this._positions = new Float32Array(TAIL_POINTS * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));

    const material = new THREE.PointsMaterial({
      color: TAIL_COLOR,
      size: 3,
      sizeAttenuation: true,
      transparent: true,
      opacity: TAIL_PEAK_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.name = 'cometTail';
    // Positions are nucleus-relative and the cloud is re-laid every frame, so
    // the geometry's bounding sphere is permanently stale. Culling off is
    // cheaper and more correct than recomputing it 60 times a second.
    this.points.frustumCulled = false;
  }

  /**
   * Re-lay the cloud for this frame. Writes only: no geometry, array or vector
   * is constructed here (REQ-EVT-104), which the CometTail.test.js source-text
   * assertion enforces.
   * @param {THREE.Vector3} cometPos - Nucleus world position.
   * @param {THREE.Vector3} sunPos - Sun world position.
   */
  update(cometPos, sunPos) {
    tailAxis(cometPos, sunPos, _axis);
    const intensity = tailIntensity(cometPos.distanceTo(sunPos), this._perihelion);
    const length = TAIL_MAX_LENGTH * intensity;
    const width = TAIL_MAX_WIDTH * intensity;

    // Any two vectors perpendicular to the axis will do; the cloud is
    // rotationally symmetric, so the basis only has to be well-conditioned.
    _basisRef.set(0, 1, 0);
    if (Math.abs(_axis.y) > 0.9) _basisRef.set(1, 0, 0);
    _u.crossVectors(_axis, _basisRef).normalize();
    _v.crossVectors(_axis, _u).normalize();

    for (let i = 0; i < TAIL_POINTS; i++) {
      const t = this._along[i];
      const reach = t * length;
      const spreadU = this._lateral[i * 2] * t * width;
      const spreadV = this._lateral[i * 2 + 1] * t * width;
      this._positions[i * 3] = _axis.x * reach + _u.x * spreadU + _v.x * spreadV;
      this._positions[i * 3 + 1] = _axis.y * reach + _u.y * spreadU + _v.y * spreadV;
      this._positions[i * 3 + 2] = _axis.z * reach + _u.z * spreadU + _v.z * spreadV;
    }

    this.points.position.copy(cometPos);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.material.opacity = TAIL_PEAK_OPACITY * intensity;
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.points.visible = visible;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
