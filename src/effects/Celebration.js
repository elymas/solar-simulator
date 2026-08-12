import * as THREE from 'three';
import { playChime, playTwinkle } from '../audio/sfx.js';

// Pooled one-shot celebration bursts (SPEC-PLAY-001 REQ-PLAY-301/302/304/305).
//
// One THREE.Points object, one geometry, one material — built in the constructor
// and never rebuilt. A "burst" writes into slots of that fixed buffer, so firing
// a hundred of them allocates exactly as much as firing one (AC-PLAY-305).
//
// REQ-PLAY-304 additionally forbids jolting the viewpoint during a celebration.
// This module simply has no access to one: nothing is injected, nothing is
// imported, and Celebration.test.js asserts that against this source file.

export const SPARKLE = 'sparkle';
export const TWINKLE = 'twinkle';

/**
 * Per-variant recipe. `count` is the particles-per-burst budget (plan §F caps it
 * at 200); `life` keeps every burst inside the ≤1s one-shot rule (spec §5).
 * `speed`/`spread` are multiples of the body's display radius, so the same burst
 * reads correctly on a 2.6-unit dwarf planet and on the 50-unit Sun.
 */
export const VARIANTS = {
  [SPARKLE]: { count: 64, life: 0.85, color: [1.0, 0.86, 0.45], speed: 1.6, spread: 0.5 },
  // Cooler, quicker, fewer — a star tap must not read as a planet arrival.
  [TWINKLE]: { count: 40, life: 0.65, color: [0.72, 0.9, 1.0], speed: 1.1, spread: 0.35 },
};

/** Fixed particle budget for the whole app. Sized for ~2 overlapping bursts. */
export const POOL_SIZE = 160;

/** Screen-space dot size. Attenuation is off so a dot on Pluto reads like a dot on the Sun. */
const POINT_PIXELS = 3;
const DRAG_PER_SECOND = 1.6;

export class Celebration {
  /**
   * @param {Object} opts
   * @param {THREE.Scene} opts.scene - Scene the pool mounts into.
   * @param {boolean} [opts.reducedMotion] - REQ-PLAY-304: emit nothing, still sound.
   * @param {Object} [opts.sounds] - variant id -> play function (injectable for tests).
   */
  constructor({ scene, reducedMotion = false, sounds } = {}) {
    this.scene = scene;
    this.reducedMotion = Boolean(reducedMotion);
    this.sounds = sounds ?? { [SPARKLE]: playChime, [TWINKLE]: playTwinkle };

    /** Bumped once per real allocation — the number AC-PLAY-305 watches. */
    this.allocations = 0;
    this._alive = 0;
    this._cursor = 0;
    this._disposed = false;

    this._positions = new Float32Array(POOL_SIZE * 3);
    this._colors = new Float32Array(POOL_SIZE * 3);
    this._velocities = new Float32Array(POOL_SIZE * 3);
    this._life = new Float32Array(POOL_SIZE);
    this._maxLife = new Float32Array(POOL_SIZE);
    this._tint = new Float32Array(POOL_SIZE * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this._colors, 3));

    const material = new THREE.PointsMaterial({
      size: POINT_PIXELS,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false; // the pool spans the whole solar system
    this.points.visible = false; // idle costs nothing
    this.points.renderOrder = 2;
    this.allocations += 1;
    if (this.scene) this.scene.add(this.points);
  }

  /** @returns {number} particles currently in flight */
  get activeCount() {
    return this._alive;
  }

  // @MX:NOTE: [AUTO] Recycling, not allocating: `_cursor` walks the fixed buffer
  // and a slot that is still alive is simply overwritten. That is what makes two
  // rapid arrivals safe (acceptance §3) — the pool cannot be exhausted because
  // there is no "out of particles" state, only an oldest particle that gives way.
  /**
   * Fire a one-shot burst at a body.
   * @param {THREE.Vector3} position - World position of the body.
   * @param {string} variant - SPARKLE | TWINKLE (the effect id).
   * @param {number} [radius] - Body display radius; scales spread and speed.
   * @returns {{variant: string, particles: number}|null} null for an unknown variant
   */
  burst(position, variant, radius = 1) {
    if (this._disposed) return null;
    const recipe = VARIANTS[variant];
    if (!recipe || !position) return null;

    // Sound is not motion: a quiet-motion household still hears the arrival.
    const play = this.sounds[variant];
    if (typeof play === 'function') play();

    if (this.reducedMotion) return { variant, particles: 0 };

    const [r, g, b] = recipe.color;
    for (let i = 0; i < recipe.count; i += 1) {
      const slot = this._cursor;
      this._cursor = (this._cursor + 1) % POOL_SIZE;
      if (this._life[slot] <= 0) this._alive += 1;

      const p = slot * 3;
      const direction = randomDirection();
      this._positions[p] = position.x + direction.x * radius * recipe.spread;
      this._positions[p + 1] = position.y + direction.y * radius * recipe.spread;
      this._positions[p + 2] = position.z + direction.z * radius * recipe.spread;

      const speed = radius * recipe.speed * (0.5 + Math.random());
      this._velocities[p] = direction.x * speed;
      this._velocities[p + 1] = direction.y * speed;
      this._velocities[p + 2] = direction.z * speed;

      this._tint[p] = r;
      this._tint[p + 1] = g;
      this._tint[p + 2] = b;
      this._colors[p] = r;
      this._colors[p + 1] = g;
      this._colors[p + 2] = b;

      this._life[slot] = recipe.life;
      this._maxLife[slot] = recipe.life;
    }

    this.points.visible = true;
    this._flush();
    return { variant, particles: recipe.count };
  }

  /**
   * Advance every live particle. Returns immediately while the pool is at rest,
   * so an idle app pays nothing for having celebrations installed.
   * @param {number} delta - Frame delta in seconds.
   */
  update(delta) {
    if (this._disposed || this._alive === 0) return;

    const drag = Math.max(0, 1 - DRAG_PER_SECOND * delta);
    for (let slot = 0; slot < POOL_SIZE; slot += 1) {
      const life = this._life[slot];
      if (life <= 0) continue;

      const p = slot * 3;
      this._positions[p] += this._velocities[p] * delta;
      this._positions[p + 1] += this._velocities[p + 1] * delta;
      this._positions[p + 2] += this._velocities[p + 2] * delta;
      this._velocities[p] *= drag;
      this._velocities[p + 1] *= drag;
      this._velocities[p + 2] *= drag;

      const remaining = life - delta;
      if (remaining <= 0) {
        // Additive blending renders black as nothing, so fading to zero IS the
        // return to the pool — no draw-range bookkeeping, no re-upload of counts.
        this._life[slot] = 0;
        this._colors[p] = 0;
        this._colors[p + 1] = 0;
        this._colors[p + 2] = 0;
        this._alive -= 1;
        continue;
      }

      this._life[slot] = remaining;
      const fade = remaining / this._maxLife[slot];
      this._colors[p] = this._tint[p] * fade;
      this._colors[p + 1] = this._tint[p + 1] * fade;
      this._colors[p + 2] = this._tint[p + 2] * fade;
    }

    this._flush();
    if (this._alive === 0) this.points.visible = false;
  }

  /** Unmount and free the GPU resources. */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this.scene) this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }

  _flush() {
    this.points.geometry.getAttribute('position').needsUpdate = true;
    this.points.geometry.getAttribute('color').needsUpdate = true;
  }
}

// Uniform-ish sphere direction. Rejection-free and cheap; the slight polar bias
// of this form is invisible in a 64-dot puff.
function randomDirection() {
  const theta = Math.random() * Math.PI * 2;
  const z = Math.random() * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: Math.cos(theta) * r, y: Math.sin(theta) * r, z };
}
