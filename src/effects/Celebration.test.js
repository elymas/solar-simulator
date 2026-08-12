import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { Celebration, SPARKLE, TWINKLE, POOL_SIZE, VARIANTS } from './Celebration.js';

function setup({ reducedMotion = false } = {}) {
  const scene = new THREE.Scene();
  const sounds = { [SPARKLE]: vi.fn(), [TWINKLE]: vi.fn() };
  const celebration = new Celebration({ scene, reducedMotion, sounds });
  return { scene, sounds, celebration };
}

/** Run the pool forward past the longest particle life. */
function runToRest(celebration) {
  for (let i = 0; i < 200; i += 1) celebration.update(0.05);
}

describe('Celebration (REQ-PLAY-301/302/304/305)', () => {
  let scene;
  let sounds;
  let celebration;

  beforeEach(() => {
    ({ scene, sounds, celebration } = setup());
  });

  describe('the pool itself (AC-PLAY-305)', () => {
    it('mounts exactly one fixed-size object into the scene', () => {
      expect(scene.children).toHaveLength(1);
      const points = scene.children[0];
      expect(points.geometry.getAttribute('position').count).toBe(POOL_SIZE);
      expect(points.visible, 'idle costs nothing until a burst').toBe(false);
    });

    it('allocates once and never again across 10 bursts', () => {
      const points = scene.children[0];
      const positions = points.geometry.getAttribute('position').array;
      const colors = points.geometry.getAttribute('color').array;
      const allocationsAfterFirst = (() => {
        celebration.burst(new THREE.Vector3(0, 0, 0), SPARKLE, 5);
        return celebration.allocations;
      })();

      for (let i = 0; i < 9; i += 1) {
        celebration.burst(new THREE.Vector3(i * 10, 0, 0), SPARKLE, 5);
        celebration.update(0.016);
      }

      expect(celebration.allocations).toBe(allocationsAfterFirst);
      expect(scene.children, 'no second pool object appears').toHaveLength(1);
      expect(points.geometry.getAttribute('position').array).toBe(positions);
      expect(points.geometry.getAttribute('color').array).toBe(colors);
    });

    it('keeps every variant inside the ≤200 particles/burst budget (plan §F)', () => {
      for (const variant of Object.values(VARIANTS)) {
        expect(variant.count).toBeLessThanOrEqual(200);
      }
      expect(POOL_SIZE).toBeLessThanOrEqual(200);
    });

    it('serves two rapid arrivals without exhausting the pool (acceptance §3)', () => {
      const first = celebration.burst(new THREE.Vector3(0, 0, 0), SPARKLE, 5);
      const second = celebration.burst(new THREE.Vector3(50, 0, 0), SPARKLE, 5);

      expect(first.particles).toBeGreaterThan(0);
      expect(second.particles, 'the second burst is as full as the first').toBe(first.particles);
      expect(celebration.activeCount).toBeLessThanOrEqual(POOL_SIZE);
      expect(celebration.allocations).toBe(1);
    });

    it('auto-returns particles to the pool when their life runs out', () => {
      celebration.burst(new THREE.Vector3(0, 0, 0), SPARKLE, 5);
      expect(celebration.activeCount).toBeGreaterThan(0);

      runToRest(celebration);

      expect(celebration.activeCount).toBe(0);
      expect(scene.children[0].visible).toBe(false);
    });

    it('stays calm when updated with nothing alive', () => {
      expect(() => celebration.update(0.016)).not.toThrow();
      expect(celebration.activeCount).toBe(0);
    });
  });

  describe('the two variants (REQ-PLAY-301/302)', () => {
    it('bursts sparkles with the arrival chime at the body', () => {
      const at = new THREE.Vector3(120, 0, -40);
      const result = celebration.burst(at, SPARKLE, 8);

      expect(result.variant).toBe(SPARKLE);
      expect(result.particles).toBeGreaterThan(0);
      expect(sounds[SPARKLE]).toHaveBeenCalledTimes(1);
      expect(sounds[TWINKLE]).not.toHaveBeenCalled();

      const positions = scene.children[0].geometry.getAttribute('position');
      const spawned = new THREE.Vector3().fromBufferAttribute(positions, 0);
      expect(spawned.distanceTo(at)).toBeLessThanOrEqual(8 * 2);
    });

    it('gives a star its own effect id and its own sound', () => {
      const result = celebration.burst(new THREE.Vector3(0, 0, 0), TWINKLE, 4);

      expect(result.variant).toBe(TWINKLE);
      expect(result.variant).not.toBe(SPARKLE);
      expect(sounds[TWINKLE]).toHaveBeenCalledTimes(1);
      expect(sounds[SPARKLE]).not.toHaveBeenCalled();
    });

    it('ignores an unknown variant instead of throwing', () => {
      expect(celebration.burst(new THREE.Vector3(), 'confetti', 4)).toBeNull();
      expect(celebration.activeCount).toBe(0);
    });
  });

  describe('reduced motion (REQ-PLAY-304, AC-PLAY-304)', () => {
    it('emits zero particles', () => {
      const quiet = setup({ reducedMotion: true });
      const result = quiet.celebration.burst(new THREE.Vector3(), SPARKLE, 5);

      expect(result.particles).toBe(0);
      expect(quiet.celebration.activeCount).toBe(0);
      expect(quiet.scene.children[0].visible).toBe(false);
    });

    it('still plays the chime', () => {
      const quiet = setup({ reducedMotion: true });
      quiet.celebration.burst(new THREE.Vector3(), SPARKLE, 5);
      quiet.celebration.burst(new THREE.Vector3(), TWINKLE, 5);

      expect(quiet.sounds[SPARKLE]).toHaveBeenCalledTimes(1);
      expect(quiet.sounds[TWINKLE]).toHaveBeenCalledTimes(1);
    });

    it('cannot shake the camera — it never receives one', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/effects/Celebration.js'), 'utf8');
      expect(source).not.toMatch(/camera/i);
      expect(source).not.toMatch(/shake/i);
    });
  });

  describe('disposal', () => {
    it('unmounts and frees its GPU resources', () => {
      const points = scene.children[0];
      const geometry = vi.spyOn(points.geometry, 'dispose');
      const material = vi.spyOn(points.material, 'dispose');

      celebration.dispose();

      expect(scene.children).toHaveLength(0);
      expect(geometry).toHaveBeenCalled();
      expect(material).toHaveBeenCalled();
    });

    it('goes inert after disposal', () => {
      celebration.dispose();
      expect(celebration.burst(new THREE.Vector3(), SPARKLE, 5)).toBeNull();
      expect(() => celebration.update(0.016)).not.toThrow();
    });
  });
});
