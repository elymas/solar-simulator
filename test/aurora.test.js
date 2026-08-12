import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { selectAuroraTier, nightSideVisibility, poleAxis, AuroraEffect } from '../src/effects/AuroraEffect.js';
import { AURORA_DEFAULTS } from '../src/utils/constants.js';

// vitest's CWD is the project root, so this resolves the same way regardless
// of import.meta.url's scheme (which vitest's module transform can rewrite).
const AURORA_SOURCE = readFileSync('src/effects/AuroraEffect.js', 'utf-8');

// SPEC-MOBILE-001 REQ-MOB-201/202 retired the user-agent render gate: a phone is
// no longer assumed slow, and quality comes from measured signals via
// decideQualityTier. The aurora was the one effect left behind on the old gate,
// so every iPhone — including a flagship that boots the 'full' tier — was handed
// the billboard fallback. Found on a real device, where the fallback did not read
// as an aurora at all.
describe('selectAuroraTier — capability, never user agent (REQ-MOB-201/202)', () => {
  it('gives a phone the same shader curtain a desktop gets', () => {
    expect(selectAuroraTier({ isLowEnd: false })).toBe('shader');
  });

  it('sheds the aurora entirely on a constrained device rather than faking it', () => {
    // 'none', not a static sprite: the sprite was a square billboard the size of
    // the globe, so it occluded Earth instead of decorating it. The frame-budget
    // ladder already sheds 'aurora' first under load (EARTH_DEGRADE_STEPS), which
    // is the real safety net — a broken stand-in is worse than no aurora.
    expect(selectAuroraTier({ isLowEnd: true })).toBe('none');
  });

  it('ignores the user agent even when one is passed', () => {
    expect(selectAuroraTier({ isMobile: true, isLowEnd: false })).toBe('shader');
  });
});

describe('nightSideVisibility — night-side only (REQ-620)', () => {
  const sun = new THREE.Vector3(1, 0, 0);
  it('is fully visible where the surface faces away from the sun', () => {
    expect(nightSideVisibility(new THREE.Vector3(-1, 0, 0), sun)).toBeCloseTo(1, 6);
  });
  it('is invisible on the sun-facing (day) side', () => {
    expect(nightSideVisibility(new THREE.Vector3(1, 0, 0), sun)).toBeCloseTo(0, 6);
  });
  it('is invisible at the terminator (perpendicular)', () => {
    expect(nightSideVisibility(new THREE.Vector3(0, 1, 0), sun)).toBeCloseTo(0, 6);
  });
});

describe('poleAxis — axial-tilt aligned (23.44 deg), matches EarthRig', () => {
  const tilt = 23.44;
  it('is a unit vector tilted off +Y by the axial tilt', () => {
    const n = poleAxis(tilt, true);
    expect(n.length()).toBeCloseTo(1, 6);
    expect(n.y).toBeCloseTo(Math.cos(THREE.MathUtils.degToRad(tilt)), 6);
  });
  it('south pole is the exact negation of north', () => {
    const n = poleAxis(tilt, true);
    const s = poleAxis(tilt, false);
    expect(s.x).toBeCloseTo(-n.x, 6);
    expect(s.y).toBeCloseTo(-n.y, 6);
    expect(s.z).toBeCloseTo(-n.z, 6);
  });
});

describe('AuroraEffect curtain geometry — follows Earth surface curvature (bug fix)', () => {
  const earthRadius = 100;
  const effect = new AuroraEffect({ tier: 'shader', earthRadius });
  const geometry = effect.group.children[0].geometry;
  const position = geometry.getAttribute('position');
  const segments = AURORA_DEFAULTS.curtainSegments;
  const heightSegments = 8;
  const rows = heightSegments + 1;
  const cols = segments + 1;

  function vertexDistance(vi) {
    const x = position.getX(vi);
    const y = position.getY(vi);
    const z = position.getZ(vi);
    return Math.sqrt(x * x + y * y + z * z);
  }

  // Note: position is stored in a Float32Array (single precision), so
  // ~1e-3 absolute tolerance at this radius is precision noise, not error.
  it('sits base-ring vertices (t=0) exactly on Earth\'s surface, at every sampled angle', () => {
    for (let i = 0; i < cols; i += 8) {
      const vi = 0 * cols + i; // j=0 row
      expect(vertexDistance(vi)).toBeCloseTo(earthRadius, 3);
    }
  });

  it('sits top-ring vertices (t=1) at earthRadius + AURORA_DEFAULTS.height', () => {
    const topRow = heightSegments;
    for (let i = 0; i < cols; i += 8) {
      const vi = topRow * cols + i;
      expect(vertexDistance(vi)).toBeCloseTo(earthRadius + AURORA_DEFAULTS.height, 3);
    }
  });

  it('never places a vertex inside the globe (regression guard for the clipping bug)', () => {
    for (let vi = 0; vi < rows * cols; vi++) {
      expect(vertexDistance(vi)).toBeGreaterThanOrEqual(earthRadius - 1e-3);
    }
  });

  it('builds a closed, fully-indexed triangle grid of the expected size', () => {
    const index = geometry.getIndex();
    const expectedTriangles = segments * heightSegments * 2;
    expect(index.count / 3).toBe(expectedTriangles);
    for (let k = 0; k < index.count; k++) {
      expect(index.getX(k)).toBeGreaterThanOrEqual(0);
      expect(index.getX(k)).toBeLessThan(rows * cols);
    }
  });
});

describe('AuroraEffect fragment shader — vUp clamp (black-box render bug fix)', () => {
  // Root-caused on real WebGL hardware, not reproducible in jsdom (no real GPU
  // rasterizer): perspective-correct interpolation of the vUp varying can hand
  // the fragment stage a value a hair outside [0,1] (float rounding at the
  // seam/edges). pow() with a non-integer exponent is undefined for a negative
  // base -- the undefined result was NaN, and bloom's blur convolution smeared
  // that NaN across every neighboring pixel, rendering the whole curtain as a
  // solid black block. This is a static-source guard (the only kind vitest/jsdom
  // can run) that the clamp isn't accidentally removed later; the actual visual
  // regression was verified by hand in a live browser, not by this test.
  it('clamps vUp to [0,1] before it reaches pow() in the fragment shader', () => {
    const fragBlock = AURORA_SOURCE.slice(AURORA_SOURCE.indexOf('const FRAG'));
    expect(fragBlock).toMatch(/clamp\(\s*vUp\s*,\s*0\.0\s*,\s*1\.0\s*\)/);
    // The clamped variable, not raw vUp, must be what feeds pow().
    expect(fragBlock).toMatch(/pow\(\s*vUpC\s*,/);
  });
});
