import * as THREE from 'three';
import { issPosition } from '../utils/issOrbit.js';

// @MX:NOTE: [AUTO] SPEC-KIDS-001 §10.1 frozen body shape (nameKo/emoji/factsKo/
// sizeComparisonKo), consumed identically to a planetData.js entry by the shared
// TTS/facts pattern — but the ISS is not a planetData body (REQ-E3-203), so its
// facts live beside the marker that owns them instead of in planetData.js.
// Authoring rules (spec.md §8.1): each fact <=45 Korean chars, one clause,
// 해요체, wonder-positive, no jargon beyond 별/행성/위성/왜소행성. factsKo[0] is
// mandated verbatim by SPEC-EARTH-003 REQ-E3-203.
export const ISS_FACTS = {
  name: 'ISS',
  nameKo: '국제 우주 정거장',
  emoji: '🛰️',
  factsKo: [
    '우주인이 사는 우주 정거장이에요!',
    '지구를 92분마다 한 바퀴 돌아요.',
    '여러 나라의 우주인들이 함께 살아요.',
  ],
  // sizeComparisonKo basis (spec.md §8.1 rule 5 — real dimensions, not display
  // radii, and the ISS has no planetData-style radius field to derive from): the
  // ISS main truss spans ~109m end-to-end (NASA), close to a regulation
  // soccer/football pitch length (~105-110m per FIFA).
  sizeComparisonKo: '국제 우주 정거장은 축구장 하나만큼 커요!',
};

const MARKER_SCALE = 5; // earth-local units — a small glint against earthRadius 100

// @MX:NOTE: [AUTO] A-405 (SPEC-EARTH-003): the marker's position is the honest
// symbolic circular orbit from issOrbit.js — no TLE, no live tracking, ever
// (REQ-E3-204). This module itself must never gain a fetch/XHR/URL of its own.
/**
 * A single small marker whose position each frame is the pure issPosition(simMinutes)
 * propagation (REQ-E3-201). Sprite is built once in the constructor; update() only
 * rewrites its position in place — zero per-frame allocation, matching the
 * aurora/aircraft module discipline.
 */
export class ISSMarker {
  constructor() {
    const material = new THREE.SpriteMaterial({ color: 0xfff4d6 });
    this.sprite = new THREE.Sprite(material);
    this.sprite.name = 'issMarker';
    this.sprite.scale.set(MARKER_SCALE, MARKER_SCALE, 1);
  }

  /** @returns {THREE.Sprite} the raycast target added to EarthView's issLayer. */
  get object3d() {
    return this.sprite;
  }

  /** @param {number} simMinutes - elapsed SIMULATION minutes (see issOrbit.js). */
  update(simMinutes) {
    const { x, y, z } = issPosition(simMinutes);
    this.sprite.position.set(x, y, z);
  }

  /** @param {boolean} visible */
  setVisible(visible) {
    this.sprite.visible = visible;
  }

  dispose() {
    this.sprite.material.dispose();
  }
}
