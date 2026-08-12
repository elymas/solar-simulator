import * as THREE from 'three';

// Asteroid and Kuiper belts (SPEC-EVENTS-001 REQ-EVT-201, 202, 206).
//
// Each belt is one InstancedMesh: one draw call for a few thousand rocks. The
// layout comes from a seeded pure function, so the same sky renders on every
// visit and the bounds are testable without a renderer (REQ-EVT-206).
//
// Same budget discipline as CometTail: every buffer is allocated once at
// construction and `update` only writes numbers into it.

/**
 * Deterministic PRNG. Chosen over `Math.random()` because the belt has to look
 * the same on every visit, and over a dependency because it is six lines.
 * @param {number} seed
 * @returns {() => number} Successive values in [0, 1).
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The asteroid belt: 320-430 display units, strictly inside the gap between
 * Mars (300) and Jupiter (450). `meanPeriodDays` is the real main-belt orbital
 * period (~4.6 years), which the sim clock counts in days, so the field drifts
 * at an honest rate rather than a chosen one.
 */
export const ASTEROID_BELT = {
  name: 'asteroidBelt',
  count: 2600,
  innerRadius: 320,
  outerRadius: 430,
  thickness: 8, // half-height of the vertical scatter, display units
  maxInclination: 0.07, // radians of per-rock orbital tilt
  meanPeriodDays: 1680,
  minScale: 0.35,
  maxScale: 1.4,
  rockRadius: 1.6,
  color: 0x8b7d6b,
  seed: 0x51ce20a5,
};

/**
 * The Kuiper belt: 900-1,250 display units, beyond Neptune (850). Sparser,
 * thicker and far slower than the asteroid belt — its ~292-year period is what
 * makes it look frozen next to the inner field.
 */
export const KUIPER_BELT = {
  name: 'kuiperBelt',
  count: 1200,
  innerRadius: 900,
  outerRadius: 1250,
  thickness: 45,
  maxInclination: 0.22,
  meanPeriodDays: 106700,
  minScale: 0.6,
  maxScale: 2.4,
  rockRadius: 2.6,
  color: 0x9fb8c8,
  seed: 0x4b19e7b3,
};

// @MX:NOTE: [AUTO] Only 1/N of the instances have their matrix recomposed each
// frame, so the field fully refreshes every N frames. At these angular speeds
// the staggering is invisible, and it cuts the per-frame matrix work to a
// quarter. Raising this saves more CPU but starts to show as visible stepping.
const DRIFT_CADENCE = 4;

/**
 * Lay out one belt. Pure and seeded: the same config always yields the same
 * field, and nothing here touches a renderer (REQ-EVT-206).
 *
 * Radii are drawn uniformly by AREA (r = sqrt of a lerp between the squared
 * bounds), not uniformly in r — otherwise the inner edge of the ring comes out
 * visibly denser than the outer one.
 *
 * Drift follows Kepler's third law across the band, so inner rocks lap outer
 * ones and the ring shears instead of turning like a solid disc.
 *
 * @param {typeof ASTEROID_BELT} config
 * @returns {{count: number, radius: Float32Array, angle: Float32Array,
 *   height: Float32Array, inclination: Float32Array, scale: Float32Array,
 *   spin: Float32Array, drift: Float32Array}} Struct of arrays, consumed
 *   directly by Belt as its once-allocated transform source.
 */
export function generateBeltInstances(config) {
  const { count, innerRadius, outerRadius, thickness, maxInclination, meanPeriodDays } = config;
  const random = mulberry32(config.seed);

  const radius = new Float32Array(count);
  const angle = new Float32Array(count);
  const height = new Float32Array(count);
  const inclination = new Float32Array(count);
  const scale = new Float32Array(count);
  const spin = new Float32Array(count * 4);
  const drift = new Float32Array(count);

  const rIn2 = innerRadius * innerRadius;
  const rOut2 = outerRadius * outerRadius;
  const midRadius = (innerRadius + outerRadius) / 2;
  const meanAngularSpeed = (Math.PI * 2) / meanPeriodDays;

  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();

  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(rIn2 + random() * (rOut2 - rIn2));
    radius[i] = r;
    angle[i] = random() * Math.PI * 2;
    height[i] = (random() * 2 - 1) * thickness;
    inclination[i] = (random() * 2 - 1) * maxInclination;
    scale[i] = config.minScale + random() * (config.maxScale - config.minScale);
    drift[i] = meanAngularSpeed * Math.pow(midRadius / r, 1.5);

    // Baked to a quaternion here so the per-frame path never runs setFromEuler.
    euler.set(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2);
    quaternion.setFromEuler(euler);
    spin[i * 4] = quaternion.x;
    spin[i * 4 + 1] = quaternion.y;
    spin[i * 4 + 2] = quaternion.z;
    spin[i * 4 + 3] = quaternion.w;
  }

  return { count, radius, angle, height, inclination, scale, spin, drift };
}

// --- per-frame scratch, hoisted so the write path never constructs anything ---

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

export class Belt {
  /**
   * @param {typeof ASTEROID_BELT} config
   */
  constructor(config) {
    this.config = config;
    this._data = generateBeltInstances(config);
    this._frame = 0;

    // detail 0 => a 20-triangle icosahedron. Flat shading turns those 20 faces
    // into readable facets, which reads as "rock" at a fraction of the cost of
    // actual geometry. Standard material so the rocks are lit by the same sun
    // as everything else in the scene.
    const geometry = new THREE.IcosahedronGeometry(config.rockRadius, 0);
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, config.count);
    this.mesh.name = config.name;
    for (let i = 0; i < config.count; i++) this._writeInstance(i, 0);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Recompose one rock's transform for the given simulation time. Positions are
   * derived from ABSOLUTE sim time rather than integrated per frame, so the
   * staggered cadence below can never accumulate drift error between the
   * quarters — and a paused, rewound or fast-forwarded clock stays consistent.
   * @param {number} i - Instance index.
   * @param {number} simTime - Simulation time in days.
   */
  _writeInstance(i, simTime) {
    const d = this._data;
    const r = d.radius[i];
    const a = d.angle[i] + d.drift[i] * simTime;
    const inc = d.inclination[i];
    const inPlane = r * Math.sin(a);
    _pos.set(r * Math.cos(a), inPlane * Math.sin(inc) + d.height[i], inPlane * Math.cos(inc));
    _quat.set(d.spin[i * 4], d.spin[i * 4 + 1], d.spin[i * 4 + 2], d.spin[i * 4 + 3]);
    _scale.setScalar(d.scale[i]);
    _matrix.compose(_pos, _quat, _scale);
    this.mesh.setMatrixAt(i, _matrix);
  }

  /**
   * Advance the field. Only every DRIFT_CADENCE-th rock is rewritten per call,
   * rotating which quarter that is, so the whole belt refreshes every four
   * frames at a quarter of the per-frame cost.
   * @param {number} simTime - Simulation time in days.
   */
  update(simTime) {
    const active = this.mesh.count;
    for (let i = this._frame; i < active; i += DRIFT_CADENCE) this._writeInstance(i, simTime);
    this._frame = (this._frame + 1) % DRIFT_CADENCE;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.mesh.visible = visible;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}

/**
 * Both solar-view belts, in sun-outward order.
 * @returns {Belt[]}
 */
export function createSolarBelts() {
  return [new Belt(ASTEROID_BELT), new Belt(KUIPER_BELT)];
}
