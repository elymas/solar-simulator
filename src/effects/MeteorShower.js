import * as THREE from 'three';
import { showerIntensity } from '../utils/meteorData.js';
import { nightSideVisibility } from './AuroraEffect.js';
import { METEOR_DEFAULTS } from '../utils/constants.js';

// Rejection-sampling bound for the night-side spawn point search (A.3): a
// bounded retry count, not a guaranteed hit, so a spawn tick can legitimately
// find nothing (e.g. the whole upper dome briefly sun-facing) and skip.
const NIGHT_SPAWN_ATTEMPTS = 6;
const MIN_ELEVATION_RAD = THREE.MathUtils.degToRad(10);
const MAX_ELEVATION_RAD = THREE.MathUtils.degToRad(80);

/**
 * One pooled slot: a THREE.Line whose 2 endpoints (head/tail) and opacity are
 * mutated in place every frame. Geometry/material/color are built ONCE here;
 * nothing below this function ever creates a new one (REQ-E3-103 pool discipline).
 */
function buildStreak() {
  const positions = new Float32Array(6); // 2 points x xyz
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Head-bright -> tail-fade color gradient (plan.md A.3), fixed once; only
  // position (per-frame motion) and opacity (per-lifetime fade) mutate after this.
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0.15, 0.35, 0.6], 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geometry, material);
  line.name = 'meteorStreak';
  line.visible = false;
  line.frustumCulled = false; // position moves every frame; a stale culled box would flicker
  return {
    line,
    positions,
    material,
    active: false,
    life: 0,
    lifetime: 0,
    head: new THREE.Vector3(),
    dir: new THREE.Vector3(),
  };
}

/**
 * Fixed pre-allocated pool of short additive shooting-star streaks (REQ-E3-103),
 * mirroring AuroraEffect's mount/unmount + fixed-budget discipline. Pool size is
 * fixed at construction (12 full-tier / 6 constrained, REQ-E3-106); slots recycle
 * in place — the pool never grows and no per-frame geometry/vector is allocated.
 *
 * @MX:NOTE: [AUTO] Couples to the Earth degrade ladder as the 'meteors' step
 * (EARTH_DEGRADE_STEPS, performance.js): SceneManager calls setVisible(false) on
 * sustained over-budget frames, immediately after aurora sheds (REQ-E3-106).
 */
export class MeteorShower {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.poolSize]
   * @param {number} [opts.earthRadius]
   * @param {THREE.Vector3} [opts.sunDirection]
   * @param {Window} [opts.win] - injected for matchMedia (REQ-E3-105).
   */
  constructor({ poolSize = METEOR_DEFAULTS.poolSizeFull, earthRadius = 100, sunDirection, win } = {}) {
    this._earthRadius = earthRadius;
    this._sunDir = (sunDirection || new THREE.Vector3(1, 0, 0.35)).clone().normalize();
    const w = win || (typeof window !== 'undefined' ? window : undefined);
    this._reducedMotionMQ = w && w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;

    this.group = new THREE.Group();
    this.group.name = 'meteorShower';
    this._pool = Array.from({ length: poolSize }, () => {
      const slot = buildStreak();
      this.group.add(slot.line);
      return slot;
    });

    this._visible = true;
    this._spawnCredit = 0;
    this._spawnDir = new THREE.Vector3(); // scratch: reused every _spawn() call
  }

  /**
   * @param {number} dt - frame delta in seconds.
   * @param {number} simDay - shared sim clock day (meteorData.js ordinal input).
   */
  update(dt, simDay) {
    if (!this._visible) return; // degrade-shed (REQ-E3-106): skip all work, not just render
    if (this._reducedMotionMQ && this._reducedMotionMQ.matches) return; // REQ-E3-105
    this._advance(dt);

    const intensity = showerIntensity(simDay);
    if (intensity <= 0) return; // no active shower: zero spawns
    this._spawnCredit += dt * METEOR_DEFAULTS.baseSpawnRate * intensity;
    while (this._spawnCredit >= 1) {
      this._spawnCredit -= 1;
      this._spawn();
    }
  }

  /**
   * @MX:WARN: [AUTO] Per-frame hot path — mutate slot.head/positions/opacity in
   * place ONLY. Never `new THREE.Vector3()` or reallocate the position/color
   * Float32Arrays here; that would defeat the fixed-pool budget (REQ-E3-103).
   * @MX:REASON: [AUTO] This runs once per active streak every frame while a
   * shower is on screen; a careless allocation here reintroduces the GC churn
   * the pre-allocated pool exists to avoid (mirrors AuroraEffect/AircraftLayer).
   */
  _advance(dt) {
    for (const slot of this._pool) {
      if (!slot.active) continue;
      slot.life += dt;
      if (slot.life >= slot.lifetime) {
        slot.active = false;
        slot.line.visible = false;
        continue;
      }
      slot.head.addScaledVector(slot.dir, METEOR_DEFAULTS.speed * dt);
      slot.material.opacity = 1 - slot.life / slot.lifetime;
      const p = slot.positions;
      p[0] = slot.head.x; p[1] = slot.head.y; p[2] = slot.head.z;
      p[3] = slot.head.x - slot.dir.x * METEOR_DEFAULTS.length;
      p[4] = slot.head.y - slot.dir.y * METEOR_DEFAULTS.length;
      p[5] = slot.head.z - slot.dir.z * METEOR_DEFAULTS.length;
      slot.line.geometry.attributes.position.needsUpdate = true;
    }
  }

  /** Activate one free pooled slot at a random night-side upper-dome point. */
  _spawn() {
    const slot = this._pool.find((s) => !s.active);
    if (!slot) return; // pool saturated this instant; never grows (REQ-E3-103)
    if (!this._pickNightSidePoint(this._spawnDir)) return; // day side every attempt; skip

    const altitude = METEOR_DEFAULTS.altitudeMin
      + Math.random() * (METEOR_DEFAULTS.altitudeMax - METEOR_DEFAULTS.altitudeMin);
    slot.head.copy(this._spawnDir).multiplyScalar(this._earthRadius + altitude);

    // Tangential travel direction so the streak skims the sky dome rather than
    // radiating straight out from Earth's center.
    slot.dir.set(-this._spawnDir.z, 0, this._spawnDir.x);
    if (slot.dir.lengthSq() < 1e-6) slot.dir.set(1, 0, 0); // near-vertical spawn guard
    slot.dir.normalize();

    slot.life = 0;
    slot.lifetime = METEOR_DEFAULTS.lifetimeMinSec
      + Math.random() * (METEOR_DEFAULTS.lifetimeMaxSec - METEOR_DEFAULTS.lifetimeMinSec);
    slot.active = true;
    slot.line.visible = true;
  }

  /**
   * Random point on the night-side upper dome (REQ-E3-103), reusing AuroraEffect's
   * sun-direction dot test rather than inventing a second day/night derivation.
   * Rejection-samples a bounded number of attempts; returns false (no spawn this
   * cycle) if every attempt landed on the sun-facing hemisphere.
   * @param {THREE.Vector3} target - mutated in place, unit length.
   * @returns {boolean}
   */
  _pickNightSidePoint(target) {
    for (let i = 0; i < NIGHT_SPAWN_ATTEMPTS; i++) {
      const az = Math.random() * Math.PI * 2;
      const el = MIN_ELEVATION_RAD + Math.random() * (MAX_ELEVATION_RAD - MIN_ELEVATION_RAD);
      const cosEl = Math.cos(el);
      target.set(cosEl * Math.cos(az), Math.sin(el), cosEl * Math.sin(az));
      if (nightSideVisibility(target, this._sunDir) > 0) return true;
    }
    return false;
  }

  /**
   * @param {boolean} v - false hides the pool AND stops spawning/animating it
   *   (degrade shed, REQ-E3-106); true restores both.
   */
  setVisible(v) {
    this._visible = v;
    this.group.visible = v;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
