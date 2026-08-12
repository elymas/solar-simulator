import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  ASTEROID_BELT,
  KUIPER_BELT,
  REDUCED_INSTANCE_FRACTION,
  Belt,
  createSolarBelts,
  generateBeltInstances,
} from './Belts.js';
import { PLANET_DATA } from '../planets/planetData.js';

// vitest's CWD is the project root (same trick as CometTail.test.js).
const SOURCE = readFileSync('src/effects/Belts.js', 'utf-8');

/** Body of a class method, for asserting on what the hot path is allowed to do. */
function methodBody(src, signature) {
  const start = src.indexOf(signature);
  expect(start, `method not found: ${signature}`).toBeGreaterThan(-1);
  const end = src.indexOf('\n  }\n', start);
  return src.slice(start, end);
}

/** Annulus area of a belt band — the denominator of its instance density. */
function bandArea({ innerRadius, outerRadius }) {
  return Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius);
}

const minOf = (a) => a.reduce((m, v) => Math.min(m, v), Infinity);
const maxOf = (a) => a.reduce((m, v) => Math.max(m, v), -Infinity);

/** Every instance's distance from the sun, read back out of the baked matrices. */
function instanceDistances(belt) {
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  return Array.from({ length: belt.mesh.count }, (_, i) => {
    belt.mesh.getMatrixAt(i, m);
    m.decompose(p, q, s);
    return p.length();
  });
}

describe('asteroid belt generator (REQ-EVT-201, AC-EVT-201)', () => {
  const belt = generateBeltInstances(ASTEROID_BELT);

  it('generates an instance count inside the specified 2,000-3,000 envelope', () => {
    expect(belt.count).toBeGreaterThanOrEqual(2000);
    expect(belt.count).toBeLessThanOrEqual(3000);
    expect(belt.radius).toHaveLength(belt.count);
    expect(belt.angle).toHaveLength(belt.count);
    expect(belt.drift).toHaveLength(belt.count);
  });

  it('keeps every rock inside the 320-430 band', () => {
    expect(minOf(belt.radius)).toBeGreaterThanOrEqual(320);
    expect(maxOf(belt.radius)).toBeLessThanOrEqual(430);
  });

  it('sits strictly between Mars and Jupiter, touching neither orbit', () => {
    expect(minOf(belt.radius)).toBeGreaterThan(PLANET_DATA.mars.distanceDisplay);
    expect(maxOf(belt.radius)).toBeLessThan(PLANET_DATA.jupiter.distanceDisplay);
  });

  it('spreads the rocks all the way around the ring', () => {
    expect(minOf(belt.angle)).toBeLessThan(0.1);
    expect(maxOf(belt.angle)).toBeGreaterThan(Math.PI * 2 - 0.1);
  });

  it('jitters rocks vertically within the configured half-thickness', () => {
    expect(maxOf(belt.height)).toBeGreaterThan(0);
    expect(minOf(belt.height)).toBeLessThan(0);
    expect(maxOf(belt.height)).toBeLessThanOrEqual(ASTEROID_BELT.thickness);
    expect(minOf(belt.height)).toBeGreaterThanOrEqual(-ASTEROID_BELT.thickness);
  });

  it('tilts individual orbits within the configured inclination spread', () => {
    expect(maxOf(belt.inclination)).toBeGreaterThan(0);
    expect(minOf(belt.inclination)).toBeLessThan(0);
    expect(maxOf(belt.inclination)).toBeLessThanOrEqual(ASTEROID_BELT.maxInclination);
    expect(minOf(belt.inclination)).toBeGreaterThanOrEqual(-ASTEROID_BELT.maxInclination);
  });

  it('gives every rock a non-zero drift rate', () => {
    expect(minOf(belt.drift)).toBeGreaterThan(0);
  });

  it('shears the ring: inner rocks orbit faster than outer ones', () => {
    // Kepler's third law across the band, so the field never looks like one
    // rigid disc rotating on the spot.
    let slowest = Infinity;
    let fastest = -Infinity;
    let innermost = Infinity;
    let outermost = -Infinity;
    for (let i = 0; i < belt.count; i++) {
      if (belt.radius[i] < innermost) { innermost = belt.radius[i]; fastest = belt.drift[i]; }
      if (belt.radius[i] > outermost) { outermost = belt.radius[i]; slowest = belt.drift[i]; }
    }
    expect(fastest).toBeGreaterThan(slowest);
  });

  it('varies rock size within the configured scale range', () => {
    expect(minOf(belt.scale)).toBeGreaterThanOrEqual(ASTEROID_BELT.minScale);
    expect(maxOf(belt.scale)).toBeLessThanOrEqual(ASTEROID_BELT.maxScale);
    expect(maxOf(belt.scale)).toBeGreaterThan(minOf(belt.scale));
  });
});

describe('Kuiper belt generator (REQ-EVT-202, AC-EVT-202)', () => {
  const kuiper = generateBeltInstances(KUIPER_BELT);
  const asteroid = generateBeltInstances(ASTEROID_BELT);

  it('generates an instance count inside the specified 1,000-1,500 envelope', () => {
    expect(kuiper.count).toBeGreaterThanOrEqual(1000);
    expect(kuiper.count).toBeLessThanOrEqual(1500);
  });

  it('keeps every rock inside the 900-1,250 band, beyond Neptune', () => {
    expect(minOf(kuiper.radius)).toBeGreaterThanOrEqual(900);
    expect(maxOf(kuiper.radius)).toBeLessThanOrEqual(1250);
    expect(minOf(kuiper.radius)).toBeGreaterThan(PLANET_DATA.neptune.distanceDisplay);
  });

  it('is sparser than the asteroid belt (instances per unit of band area)', () => {
    // Computed from the configs rather than pinned to a literal, so the
    // relationship stays enforced if either count is ever retuned.
    const kuiperDensity = kuiper.count / bandArea(KUIPER_BELT);
    const asteroidDensity = asteroid.count / bandArea(ASTEROID_BELT);
    expect(kuiperDensity).toBeLessThan(asteroidDensity);
  });

  it('is vertically thicker than the asteroid belt', () => {
    expect(KUIPER_BELT.thickness).toBeGreaterThan(ASTEROID_BELT.thickness);
    expect(maxOf(kuiper.height)).toBeGreaterThan(maxOf(asteroid.height));
  });

  it('drifts more slowly than the asteroid belt, every rock of it', () => {
    expect(maxOf(kuiper.drift)).toBeLessThan(minOf(asteroid.drift));
  });
});

describe('belt generation is deterministic (REQ-EVT-206, AC-EVT-206)', () => {
  it('produces identical transforms from the same seed across independent runs', () => {
    const a = generateBeltInstances(ASTEROID_BELT);
    const b = generateBeltInstances(ASTEROID_BELT);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('produces a different layout from a different seed', () => {
    const a = generateBeltInstances({ ...ASTEROID_BELT, seed: 1 });
    const b = generateBeltInstances({ ...ASTEROID_BELT, seed: 2 });
    expect(a.count).toBe(b.count);
    expect(Array.from(a.angle)).not.toEqual(Array.from(b.angle));
    expect(Array.from(a.radius)).not.toEqual(Array.from(b.radius));
  });

  it('needs no renderer: the generator is pure data', () => {
    expect(generateBeltInstances(KUIPER_BELT).radius).toBeInstanceOf(Float32Array);
  });
});

describe('Belt render body (REQ-EVT-201, REQ-EVT-202)', () => {
  it('draws the whole field as one InstancedMesh', () => {
    const belt = new Belt(ASTEROID_BELT);
    expect(belt.mesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(belt.mesh.count).toBe(ASTEROID_BELT.count);
    expect(belt.mesh.name).toBe(ASTEROID_BELT.name);
  });

  it('uses a low-poly rock of at most 80 triangles', () => {
    const belt = new Belt(ASTEROID_BELT);
    const position = belt.mesh.geometry.attributes.position;
    const triangles = belt.mesh.geometry.index
      ? belt.mesh.geometry.index.count / 3
      : position.count / 3;
    expect(triangles).toBeLessThanOrEqual(80);
  });

  it('lights the rocks with the same standard material as every other body', () => {
    const belt = new Belt(ASTEROID_BELT);
    expect(belt.mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it('places every rock inside its band', () => {
    const belt = new Belt(KUIPER_BELT);
    const distances = instanceDistances(belt);
    expect(minOf(distances)).toBeGreaterThan(KUIPER_BELT.innerRadius - KUIPER_BELT.thickness - 1);
    expect(maxOf(distances)).toBeLessThan(KUIPER_BELT.outerRadius + KUIPER_BELT.thickness + 1);
  });

  it('bakes per-instance scale and rotation variety into the matrices', () => {
    const belt = new Belt(ASTEROID_BELT);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const scales = new Set();
    const spins = new Set();
    for (let i = 0; i < 200; i++) {
      belt.mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      scales.add(s.x.toFixed(4));
      spins.add(`${q.x.toFixed(4)},${q.y.toFixed(4)},${q.z.toFixed(4)}`);
    }
    expect(scales.size).toBeGreaterThan(100);
    expect(spins.size).toBeGreaterThan(100);
  });

  it('creates both belts for the solar view', () => {
    const belts = createSolarBelts();
    expect(belts.map((b) => b.mesh.name)).toEqual([ASTEROID_BELT.name, KUIPER_BELT.name]);
  });
});

describe('Belt drift (REQ-EVT-201)', () => {
  /** Positions of every instance at the current matrix state. */
  const snapshot = (belt) => Float32Array.from(belt.mesh.instanceMatrix.array);

  it('advances rocks around the ring as simulation time passes', () => {
    const belt = new Belt(ASTEROID_BELT);
    const before = snapshot(belt);
    for (let f = 0; f < 4; f++) belt.update(500 * (f + 1));
    expect(Array.from(snapshot(belt))).not.toEqual(Array.from(before));
  });

  it('refreshes a quarter of the field per frame, the whole field every four', () => {
    const belt = new Belt(ASTEROID_BELT);
    const before = snapshot(belt);
    const moved = (after) => {
      let n = 0;
      for (let i = 0; i < belt.mesh.count; i++) {
        // Element 12 of a column-major Matrix4 is translation x.
        if (after[i * 16 + 12] !== before[i * 16 + 12]) n += 1;
      }
      return n;
    };

    belt.update(500);
    const oneFrame = moved(snapshot(belt));
    expect(oneFrame).toBeGreaterThan(belt.mesh.count * 0.2);
    expect(oneFrame).toBeLessThan(belt.mesh.count * 0.3);

    for (let f = 1; f < 4; f++) belt.update(500);
    expect(moved(snapshot(belt))).toBe(belt.mesh.count);
  });

  it('positions from absolute sim time, so the cadence never accumulates error', () => {
    const stepped = new Belt(ASTEROID_BELT);
    for (let f = 0; f < 8; f++) stepped.update(1000);
    const jumped = new Belt(ASTEROID_BELT);
    for (let f = 0; f < 4; f++) jumped.update(1000);
    expect(Array.from(snapshot(stepped))).toEqual(Array.from(snapshot(jumped)));
  });

  it('keeps rocks inside the band no matter how far time runs', () => {
    const belt = new Belt(ASTEROID_BELT);
    for (let f = 0; f < 8; f++) belt.update(1e6);
    const distances = instanceDistances(belt);
    expect(minOf(distances)).toBeGreaterThan(ASTEROID_BELT.innerRadius - ASTEROID_BELT.thickness - 1);
    expect(maxOf(distances)).toBeLessThan(ASTEROID_BELT.outerRadius + ASTEROID_BELT.thickness + 1);
  });
});

// SPEC-EVENTS-001 REQ-EVT-204 / AC-EVT-204. InstancedMesh.count is free to
// change, so the buffers are pre-sized at the full count once and shedding just
// draws fewer of them. Nothing is rebuilt, which is what makes the step cheap
// enough to take and give back repeatedly.
describe('Belt instance shedding (REQ-EVT-204)', () => {
  it('sheds at least half the instances', () => {
    const belt = new Belt(ASTEROID_BELT);
    belt.setReduced(true);
    expect(belt.mesh.count).toBeLessThanOrEqual(ASTEROID_BELT.count * 0.5);
    expect(belt.mesh.count).toBeGreaterThan(0);
    expect(REDUCED_INSTANCE_FRACTION).toBeLessThanOrEqual(0.5);
  });

  it('restores the full field', () => {
    const belt = new Belt(KUIPER_BELT);
    belt.setReduced(true);
    belt.setReduced(false);
    expect(belt.mesh.count).toBe(KUIPER_BELT.count);
  });

  it('rebuilds no geometry on either shed or restore', () => {
    const belt = new Belt(ASTEROID_BELT);
    const { geometry, instanceMatrix } = belt.mesh;
    const buffer = instanceMatrix.array;

    belt.setReduced(true);
    belt.setReduced(false);
    belt.setReduced(true);

    expect(belt.mesh.geometry).toBe(geometry);
    expect(belt.mesh.instanceMatrix).toBe(instanceMatrix);
    expect(belt.mesh.instanceMatrix.array).toBe(buffer);
    // Still sized for the full field, ready to be drawn again for free.
    expect(buffer).toHaveLength(ASTEROID_BELT.count * 16);
  });

  it('keeps drifting the rocks that are still drawn', () => {
    const belt = new Belt(ASTEROID_BELT);
    belt.setReduced(true);
    const before = Float32Array.from(belt.mesh.instanceMatrix.array);
    for (let f = 0; f < 4; f++) belt.update(2000);
    const after = belt.mesh.instanceMatrix.array;
    expect(after[12]).not.toBe(before[12]);
  });

  it('spends no time on instances it is no longer drawing', () => {
    const belt = new Belt(ASTEROID_BELT);
    belt.setReduced(true);
    const active = belt.mesh.count;
    const before = Float32Array.from(belt.mesh.instanceMatrix.array);
    for (let f = 0; f < 4; f++) belt.update(2000);
    const after = belt.mesh.instanceMatrix.array;

    for (let i = active; i < ASTEROID_BELT.count; i++) {
      expect(after[i * 16 + 12], `shed instance ${i} was still written`).toBe(before[i * 16 + 12]);
    }
  });

  it('draws restored instances at the current time, not where they were shed', () => {
    const belt = new Belt(ASTEROID_BELT);
    belt.setReduced(true);
    for (let f = 0; f < 4; f++) belt.update(2000);
    belt.setReduced(false);
    const stale = Float32Array.from(belt.mesh.instanceMatrix.array);
    for (let f = 0; f < 4; f++) belt.update(2000);

    const last = ASTEROID_BELT.count - 1;
    expect(belt.mesh.instanceMatrix.array[last * 16 + 12]).not.toBe(stale[last * 16 + 12]);
  });
});

describe('Belt per-frame budget (SPEC-EVENTS-001 §5 zero-GC steady state)', () => {
  it('keeps writing into the transform buffer allocated at construction', () => {
    const belt = new Belt(ASTEROID_BELT);
    const attribute = belt.mesh.instanceMatrix;
    const buffer = attribute.array;

    for (let f = 0; f < 40; f++) belt.update(f * 100);

    expect(belt.mesh.instanceMatrix).toBe(attribute);
    expect(belt.mesh.instanceMatrix.array).toBe(buffer);
    expect(buffer).toHaveLength(ASTEROID_BELT.count * 16);
  });

  it('flags the transforms for upload each frame', () => {
    const belt = new Belt(ASTEROID_BELT);
    const before = belt.mesh.instanceMatrix.version;
    belt.update(100);
    expect(belt.mesh.instanceMatrix.version).toBe(before + 1);
  });

  it('allocates nothing in the update path', () => {
    // Same discipline as CometTail: every vector/matrix the hot path touches is
    // hoisted, so neither method may contain a construction at all.
    expect(methodBody(SOURCE, '  update(simTime')).not.toMatch(/\bnew\b/);
    expect(methodBody(SOURCE, '  _writeInstance(')).not.toMatch(/\bnew\b/);
  });
});
