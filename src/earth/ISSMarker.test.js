import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ISSMarker, ISS_FACTS } from './ISSMarker.js';
import { issPosition } from '../utils/issOrbit.js';

// spec.md §8.1 rule 1 — same budget planetData.facts.test.js enforces for every
// other body; this SPEC's own file asserts it for the ISS (out of that file's ownership).
const MAX_FACT_CHARS = 45;

describe('ISS_FACTS (SPEC-EARTH-003 REQ-E3-203, SPEC-KIDS-001 §10.1 frozen shape)', () => {
  it('carries the mandated first fact and the KIDS-001 body shape', () => {
    expect(ISS_FACTS.factsKo[0]).toBe('우주인이 사는 우주 정거장이에요!');
    expect(ISS_FACTS.nameKo).toBeTruthy();
    expect(ISS_FACTS.emoji).toBeTruthy();
    expect(ISS_FACTS.sizeComparisonKo).toBeTruthy();
  });

  it('gives exactly 3 non-empty Korean facts (REQ-KIDS-301 shape)', () => {
    expect(ISS_FACTS.factsKo).toHaveLength(3);
    for (const fact of ISS_FACTS.factsKo) {
      expect(fact.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps every fact and the size comparison within the 45-character budget (spec.md §8.1 rule 1)', () => {
    for (const fact of [...ISS_FACTS.factsKo, ISS_FACTS.sizeComparisonKo]) {
      expect([...fact].length, fact).toBeLessThanOrEqual(MAX_FACT_CHARS);
    }
  });
});

describe('ISSMarker (SPEC-EARTH-003 REQ-E3-201/202)', () => {
  it('exposes a raycastable Object3D', () => {
    const marker = new ISSMarker();
    expect(marker.object3d.isObject3D).toBe(true);
  });

  it('tracks issPosition for a given sim time, reusing the same instance in place', () => {
    const marker = new ISSMarker();
    const sameInstance = marker.object3d;
    marker.update(37);
    const expected = issPosition(37);
    expect(marker.object3d.position.x).toBeCloseTo(expected.x, 9);
    expect(marker.object3d.position.y).toBeCloseTo(expected.y, 9);
    expect(marker.object3d.position.z).toBeCloseTo(expected.z, 9);
    expect(marker.object3d).toBe(sameInstance); // no per-frame rebuild
  });

  it('defaults visible and toggles on setVisible', () => {
    const marker = new ISSMarker();
    expect(marker.object3d.visible).toBe(true);
    marker.setVisible(false);
    expect(marker.object3d.visible).toBe(false);
    marker.setVisible(true);
    expect(marker.object3d.visible).toBe(true);
  });

  it('disposes without throwing', () => {
    const marker = new ISSMarker();
    expect(() => marker.dispose()).not.toThrow();
  });

  it('never touches the network (REQ-E3-204): no fetch/XHR/URL literal in the module source', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ISSMarker.js'), 'utf8');
    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).toMatch(/A-405|REQ-E3-204/);
  });
});
