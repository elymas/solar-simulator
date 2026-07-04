import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { selectAuroraTier, nightSideVisibility, poleAxis } from '../src/effects/AuroraEffect.js';

describe('selectAuroraTier — exactly two tiers (REQ-630/645)', () => {
  it('uses the custom shader on capable desktop', () => {
    expect(selectAuroraTier({ isMobile: false, isLowEnd: false })).toBe('shader');
  });

  it('falls back to a billboard sprite on mobile OR low-end (no intermediate tier)', () => {
    expect(selectAuroraTier({ isMobile: true, isLowEnd: false })).toBe('billboard');
    expect(selectAuroraTier({ isMobile: false, isLowEnd: true })).toBe('billboard');
    expect(selectAuroraTier({ isMobile: true, isLowEnd: true })).toBe('billboard');
  });

  it('only ever returns one of the two tiers', () => {
    const t = selectAuroraTier({ isMobile: false, isLowEnd: false });
    expect(['shader', 'billboard']).toContain(t);
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
