import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  CometTail,
  TAIL_POINTS,
  TAIL_MAX_LENGTH,
  tailAxis,
  tailIntensity,
} from './CometTail.js';
import { PLANET_DATA } from '../planets/planetData.js';
import { OrbitalMechanics } from '../planets/OrbitalMechanics.js';

// vitest's CWD is the project root (same trick as aurora.test.js).
const SOURCE = readFileSync('src/effects/CometTail.js', 'utf-8');

const HALLEY = PLANET_DATA.halley;
const PERIHELION = HALLEY.distanceDisplay * (1 - HALLEY.eccentricity);
const APHELION = HALLEY.distanceDisplay * (1 + HALLEY.eccentricity);

/** Sample n positions spread over one full Halley period. */
function orbitSamples(n = 64) {
  return Array.from({ length: n }, (_, i) => {
    const { x, y, z } = OrbitalMechanics.calculatePosition(HALLEY, (i / n) * HALLEY.orbitalPeriod);
    return new THREE.Vector3(x, y, z);
  });
}

/** Body of a class method, for asserting on what the hot path is allowed to do. */
function methodBody(src, signature) {
  const start = src.indexOf(signature);
  expect(start, `method not found: ${signature}`).toBeGreaterThan(-1);
  const end = src.indexOf('\n  }\n', start);
  return src.slice(start, end);
}

describe('tailAxis — always anti-sunward (REQ-EVT-102, AC-EVT-102)', () => {
  const out = new THREE.Vector3();

  it('points from the sun to the comet, never back along the path travelled', () => {
    const sun = new THREE.Vector3(0, 0, 0);
    for (const pos of orbitSamples()) {
      const expected = pos.clone().sub(sun).normalize();
      expect(tailAxis(pos, sun, out).dot(expected)).toBeGreaterThan(0.999);
    }
  });

  it('tracks the sun rather than the origin when the sun is displaced', () => {
    // Proves the axis is normalize(comet - sun), not just normalize(comet):
    // with a displaced sun the two answers differ.
    const sun = new THREE.Vector3(120, -40, 60);
    for (const pos of orbitSamples(16)) {
      const expected = pos.clone().sub(sun).normalize();
      expect(tailAxis(pos, sun, out).dot(expected)).toBeGreaterThan(0.999);
    }
  });

  it('returns a unit vector', () => {
    for (const pos of orbitSamples(16)) {
      expect(tailAxis(pos, new THREE.Vector3(), out).length()).toBeCloseTo(1, 6);
    }
  });

  it('writes into the caller buffer instead of allocating', () => {
    const scratch = new THREE.Vector3();
    expect(tailAxis(new THREE.Vector3(1, 2, 3), new THREE.Vector3(), scratch)).toBe(scratch);
  });
});

describe('tailIntensity — grows toward perihelion (REQ-EVT-102, AC-EVT-102)', () => {
  it('is strictly greater at perihelion than at aphelion', () => {
    expect(tailIntensity(PERIHELION, PERIHELION))
      .toBeGreaterThan(tailIntensity(APHELION, PERIHELION));
  });

  it('rises monotonically as the comet falls inward', () => {
    let previous = -Infinity;
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const r = APHELION + ((PERIHELION - APHELION) * i) / steps;
      const intensity = tailIntensity(r, PERIHELION);
      expect(intensity, `r=${r}`).toBeGreaterThan(previous);
      previous = intensity;
    }
  });

  it('saturates at 1 at perihelion and stays within [0,1] everywhere', () => {
    expect(tailIntensity(PERIHELION, PERIHELION)).toBeCloseTo(1, 6);
    for (const r of [PERIHELION * 0.5, PERIHELION, APHELION, APHELION * 10]) {
      const intensity = tailIntensity(r, PERIHELION);
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    }
  });
});

describe('CometTail point cloud', () => {
  let tail;
  beforeEach(() => {
    tail = new CometTail(HALLEY);
  });

  it('allocates its full point budget once at construction (AC-EVT-104)', () => {
    const attribute = tail.points.geometry.attributes.position;
    expect(attribute.count).toBe(TAIL_POINTS);
    expect(attribute.array).toHaveLength(TAIL_POINTS * 3);
  });

  it('renders additively without writing depth, like the other effects', () => {
    const material = tail.points.material;
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(true);
  });

  it('lays every point on the anti-sunward side of the nucleus', () => {
    const sun = new THREE.Vector3();
    const comet = new THREE.Vector3(PERIHELION, 0, 0);
    tail.update(comet, sun);

    const axis = tailAxis(comet, sun, new THREE.Vector3());
    const positions = tail.points.geometry.attributes.position.array;
    for (let i = 0; i < TAIL_POINTS; i++) {
      const along =
        positions[i * 3] * axis.x + positions[i * 3 + 1] * axis.y + positions[i * 3 + 2] * axis.z;
      expect(along, `point ${i} is on the sunward side`).toBeGreaterThanOrEqual(0);
    }
  });

  it('streams the tail out to its full length at perihelion', () => {
    const sun = new THREE.Vector3();
    const comet = new THREE.Vector3(PERIHELION, 0, 0);
    tail.update(comet, sun);

    const axis = tailAxis(comet, sun, new THREE.Vector3());
    const positions = tail.points.geometry.attributes.position.array;
    let furthest = 0;
    for (let i = 0; i < TAIL_POINTS; i++) {
      furthest = Math.max(
        furthest,
        positions[i * 3] * axis.x + positions[i * 3 + 1] * axis.y + positions[i * 3 + 2] * axis.z
      );
    }
    expect(furthest).toBeGreaterThan(TAIL_MAX_LENGTH * 0.9);
    expect(furthest).toBeLessThanOrEqual(TAIL_MAX_LENGTH);
  });

  it('shrinks the tail toward aphelion', () => {
    const sun = new THREE.Vector3();
    const reach = (r) => {
      const comet = new THREE.Vector3(r, 0, 0);
      tail.update(comet, sun);
      const positions = tail.points.geometry.attributes.position.array;
      let furthest = 0;
      for (let i = 0; i < TAIL_POINTS; i++) furthest = Math.max(furthest, positions[i * 3]);
      return furthest;
    };
    expect(reach(APHELION)).toBeLessThan(reach(PERIHELION) * 0.1);
  });

  it('follows the nucleus so the cloud is drawn where the comet is', () => {
    const comet = new THREE.Vector3(0, 0, PERIHELION);
    tail.update(comet, new THREE.Vector3());
    expect(tail.points.position.distanceTo(comet)).toBeCloseTo(0, 6);
  });

  it('is a tail, not a trail: the shape depends only on the current position', () => {
    const sun = new THREE.Vector3();
    const here = new THREE.Vector3(PERIHELION, 0, 0);
    const elsewhere = new THREE.Vector3(0, 0, -APHELION);

    tail.update(here, sun);
    const fromHere = Float32Array.from(tail.points.geometry.attributes.position.array);

    tail.update(elsewhere, sun);
    tail.update(here, sun);
    const afterDetour = tail.points.geometry.attributes.position.array;

    expect(Array.from(afterDetour)).toEqual(Array.from(fromHere));
  });
});

describe('CometTail per-frame budget (REQ-EVT-104, AC-EVT-104)', () => {
  it('keeps writing into the same buffer instead of rebuilding geometry', () => {
    const tail = new CometTail(HALLEY);
    const geometry = tail.points.geometry;
    const attribute = geometry.attributes.position;
    const buffer = attribute.array;

    for (let i = 0; i < 50; i++) {
      const r = PERIHELION + ((APHELION - PERIHELION) * i) / 50;
      tail.update(new THREE.Vector3(r, 0, 0), new THREE.Vector3());
    }

    expect(tail.points.geometry).toBe(geometry);
    expect(geometry.attributes.position).toBe(attribute);
    expect(geometry.attributes.position.array).toBe(buffer);
    expect(buffer).toHaveLength(TAIL_POINTS * 3);
  });

  it('flags the buffer for upload each frame', () => {
    // three.js exposes `needsUpdate` as a write-only setter that bumps
    // `version`, so the version counter is the only readable evidence that the
    // new positions will actually reach the GPU.
    const tail = new CometTail(HALLEY);
    const attribute = tail.points.geometry.attributes.position;
    const before = attribute.version;
    tail.update(new THREE.Vector3(PERIHELION, 0, 0), new THREE.Vector3());
    expect(attribute.version).toBe(before + 1);
  });

  it('allocates nothing in the update path', () => {
    // The buffer-identity test above proves the geometry is not rebuilt, but it
    // cannot see a scratch `new THREE.Vector3()` created per call. This can:
    // every vector the hot path touches must be hoisted to module or instance
    // scope, so `update` contains no construction at all.
    expect(methodBody(SOURCE, '  update(')).not.toMatch(/\bnew\b/);
  });
});
