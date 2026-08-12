import * as THREE from 'three';
import { SPARKLE } from '../effects/Celebration.js';
import { eligibleDestinations, travelFactKo } from './travelFacts.js';
import { speak as speakText } from '../audio/tts.js';
import { emitPlayEvent } from './playEvents.js';

// Rocket journey mini-event (SPEC-PLAY-001 REQ-PLAY-201..205).
//
// HONESTY (REQ-PLAY-203): the path drawn here is a SCHEMATIC curve — a stylized
// arc chosen because it reads well to a five-year-old. It is NOT a transfer orbit.
// There is no orbital mechanics in this file and there must never be: no transfer
// geometry, no departure-time search, no impulse budget. The truth of the
// feature lives in the SPOKEN fact (travelFacts.js), which quotes real mission
// durations; the flight itself is three seconds of theatre.

/** Real-time flight envelope (plan §A.5). Independent of the simulation speed. */
export const MIN_FLIGHT_MS = 2500;
export const MAX_FLIGHT_MS = 6000;
const MS_PER_SCENE_UNIT = 3;

/** Arc height as a fraction of the trip length, so short hops still visibly arc. */
export const ARC_HEIGHT_RATIO = 0.35;

const LAUNCH_SITE = 'earth';
const TRAIL_POINTS = 40;
/** Samples along the previewed arc. Enough that the curve reads as a curve. */
const PATH_PREVIEW_POINTS = 64;
// Base silhouette. The uniform scale below is what makes it readable at any
// trip length; these are the proportions, not the size.
const ROCKET_RADIUS = 0.9;
const ROCKET_LENGTH = 2.7;

/**
 * How large the rocket should read against the trip it is crossing.
 *
 * The camera now frames the WHOLE journey, so it sits roughly a trip-length away
 * — and at that distance a fixed 2.7-unit cone is a couple of pixels. A real
 * device pass found exactly that: the rocket was flying, and looked like nothing.
 * Sizing it as a fraction of the trip keeps it equally readable to the Moon and
 * out to Eris, at the cost of it not being to scale — which it never was.
 */
export const ROCKET_TRIP_FRACTION = 0.05;
export const MIN_ROCKET_SCALE = 1;
export const MAX_ROCKET_SCALE = 14;

/**
 * Uniform rocket scale for a trip of the given length, in scene units.
 * @param {number} distance
 * @returns {number}
 */
export function rocketScaleFor(distance) {
  const wanted = (Math.max(0, distance) * ROCKET_TRIP_FRACTION) / ROCKET_LENGTH;
  return Math.min(MAX_ROCKET_SCALE, Math.max(MIN_ROCKET_SCALE, wanted));
}

/** The scene's ecliptic is the y = 0 plane; the arc is lifted along +Y. */
const UP = new THREE.Vector3(0, 1, 0);


/**
 * Quadratic bezier sample.
 * @param {THREE.Vector3} p0 - launch point
 * @param {THREE.Vector3} p1 - control point
 * @param {THREE.Vector3} p2 - destination
 * @param {number} t - 0..1
 * @param {THREE.Vector3} [out] - reused by the frame loop
 * @returns {THREE.Vector3}
 */
export function bezierPoint(p0, p1, p2, t, out = new THREE.Vector3()) {
  const u = 1 - t;
  const a = u * u;
  const b = 2 * u * t;
  const c = t * t;
  return out.set(
    a * p0.x + b * p1.x + c * p2.x,
    a * p0.y + b * p1.y + c * p2.y,
    a * p0.z + b * p1.z + c * p2.z,
  );
}

/**
 * Control point for the arc: the midpoint, lifted above the ecliptic by a
 * fraction of the trip length.
 * @param {THREE.Vector3} p0
 * @param {THREE.Vector3} p2
 * @returns {THREE.Vector3}
 */
export function controlPoint(p0, p2) {
  const height = p0.distanceTo(p2) * ARC_HEIGHT_RATIO;
  return p0.clone().add(p2).multiplyScalar(0.5).addScaledVector(UP, height);
}

/**
 * Seconds-scale flight time for a trip, floored so the Moon's short hop is still
 * readable and capped so the far dwarf planets do not bore a child (acceptance §3).
 * @param {number} distance - Scene units.
 * @returns {number} milliseconds
 */
export function flightDurationMs(distance) {
  return Math.min(MAX_FLIGHT_MS, MIN_FLIGHT_MS + Math.max(0, distance) * MS_PER_SCENE_UNIT);
}

export class RocketJourney {
  /**
   * @param {Object} opts
   * @param {THREE.Scene} opts.scene
   * @param {(key: string) => ({position: THREE.Vector3, radius: number}|null)} opts.getBody
   *   Live body lookup. Called EVERY frame for the destination — that is what
   *   makes the rocket land on a moving target.
   * @param {{burst: Function}} opts.celebration
   * @param {(text: string) => void} [opts.speak]
   * @param {(type: string, payload?: object) => void} [opts.emit]
   * @param {boolean} [opts.reducedMotion] - REQ-PLAY-205: present the arrival at once.
   * @param {() => number} [opts.now] - Wall clock; performance.now() in production.
   */
  constructor({
    scene,
    getBody,
    celebration,
    speak = speakText,
    emit = emitPlayEvent,
    reducedMotion = false,
    now = defaultNow,
  } = {}) {
    this.scene = scene;
    this.getBody = getBody;
    this.celebration = celebration;
    this.speak = speak;
    this.emit = emit;
    this.reducedMotion = Boolean(reducedMotion);
    this.now = now;

    this._destination = null;
    this._group = null;
    this._rocket = null;
    this._trail = null;
    this._path = null;
    this._trailPositions = null;
    this._p0 = new THREE.Vector3();
    this._p1 = new THREE.Vector3();
    this._at = new THREE.Vector3();
    this._ahead = new THREE.Vector3();
    this._startedAt = 0;
    this._durationMs = MIN_FLIGHT_MS;
    this._scale = MIN_ROCKET_SCALE;
    this._disposed = false;
  }

  /** @returns {string|null} the body currently being flown to */
  get destination() {
    return this._destination;
  }

  /** @returns {boolean} */
  isFlying() {
    return Boolean(this._group);
  }

  /** @returns {THREE.Vector3} the rocket's current position (zero when idle) */
  position() {
    return this._rocket ? this._rocket.position.clone() : new THREE.Vector3();
  }

  /**
   * Any planet or dwarf planet except Earth, plus the Moon. Never Earth itself,
   * never the Sun, never a star (REQ-PLAY-201). The list is derived from
   * planetData by travelFacts.js — there is exactly one eligibility table.
   * @param {string} key
   * @returns {boolean}
   */
  canLaunch(key) {
    return !this._disposed && eligibleDestinations().includes(key);
  }

  /**
   * Fly from Earth to `key`. Cancels any flight already in the air (REQ-PLAY-204).
   * @param {string} key
   * @returns {boolean} whether a journey started (or, under reduced motion, arrived)
   */
  launch(key) {
    if (!this.canLaunch(key)) return false;
    const launchPad = this.getBody?.(LAUNCH_SITE);
    const destination = this.getBody?.(key);
    if (!launchPad || !destination) return false;

    this.cancel();

    // REQ-PLAY-205: the flight IS the motion, so reduced motion removes it whole
    // and hands the child the payload — fact, voice and celebration — at once.
    if (this.reducedMotion) {
      this._arrive(key, destination);
      return true;
    }

    this._destination = key;
    this._p0.copy(launchPad.position);
    this._p1.copy(controlPoint(this._p0, destination.position));
    const tripLength = this._p0.distanceTo(destination.position);
    this._durationMs = flightDurationMs(tripLength);
    this._scale = rocketScaleFor(tripLength);
    this._startedAt = this.now();
    this._build();
    return true;
  }

  /**
   * Advance the flight. Driven by SolarSystemView.update, i.e. by the app's one
   * rAF loop — this module starts no loop and holds no timer of its own.
   */
  update() {
    if (this._disposed || !this._group) return;

    const destination = this.getBody?.(this._destination);
    if (!destination) {
      this.cancel(); // the body left the scene mid-flight
      return;
    }

    // Real elapsed milliseconds: the simulation speed slider cannot touch this.
    const t = Math.min(1, (this.now() - this._startedAt) / this._durationMs);
    // @MX:NOTE: [AUTO] P2 is re-read from the live body every frame instead of
    // being snapshotted at launch (plan §A.5). The curve therefore bends onto
    // wherever the destination has orbited to, and touchdown is exact by
    // construction — no predictive lead angle, no chase controller.
    bezierPoint(this._p0, this._p1, destination.position, t, this._at);
    this._rocket.position.copy(this._at);
    this._aimAlongPath(destination.position, t);
    this._pushTrail(this._at);

    if (t >= 1) {
      const key = this._destination;
      // Tear down BEFORE the callbacks: an arrival handler is allowed to launch
      // the next rocket, and it must not have its fresh flight swept away.
      this.cancel();
      this._arrive(key, destination);
    }
  }

  // @MX:WARN: [AUTO] Every exit from a flight funnels through cancel(). It must
  // stay the only teardown path and must leave no live reference behind.
  // @MX:SPEC: [AUTO] SPEC-PLAY-001 REQ-PLAY-204 / AC-PLAY-204
  // @MX:REASON: [AUTO] Selection changes, view switches, relaunches, a vanished
  // destination and arrival itself all land here. A partial teardown leaks a mesh
  // into the scene forever (nothing else ever removes it) or leaves `_destination`
  // set, which would let a cancelled flight still fire its arrival — a celebration
  // and a spoken fact for a body the child has already navigated away from.
  /** Cancel any flight in progress and dispose its objects. Idempotent. */
  // @MX:NOTE: [AUTO] The whole path, drawn the instant the rocket leaves.
  // Framing the journey is not enough on its own: at solar-system scale Earth and
  // Mars are a few pixels each from a camera that holds both, so "how far is it"
  // has nothing to read. This line IS the distance — it appears complete at
  // launch, and the rocket then visibly crawls along it.
  _buildPathPreview() {
    const points = [];
    const at = new THREE.Vector3();
    const destination = this.getBody?.(this._destination);
    if (!destination) return;
    for (let i = 0; i <= PATH_PREVIEW_POINTS; i += 1) {
      const t = i / PATH_PREVIEW_POINTS;
      points.push(bezierPoint(this._p0, this._p1, destination.position, t, at).clone());
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    this._path = new THREE.Line(
      geometry,
      // Dashed would need computeLineDistances plus a per-frame update; a faint
      // solid line reads the same at this scale for none of that upkeep.
      new THREE.LineBasicMaterial({
        color: 0x8fd6ff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this._path.frustumCulled = false;
    this._group.add(this._path);
  }

  cancel() {
    this._destination = null;
    this._path = null;
    if (!this._group) return;
    this.scene?.remove(this._group);
    this._group.traverse((child) => {
      child.geometry?.dispose();
      child.material?.dispose();
    });
    this._group = null;
    this._rocket = null;
    this._trail = null;
    this._trailPositions = null;
  }

  /** Cancel and refuse all further launches. */
  dispose() {
    this.cancel();
    this._disposed = true;
  }

  /** The arrival payload: celebration, the Korean travel fact, the mission event. */
  _arrive(key, destination) {
    this.celebration?.burst(destination.position.clone(), SPARKLE, destination.radius);
    const fact = travelFactKo(key);
    if (fact) this.speak?.(fact);
    this.emit?.('rocket-arrived', { body: key });
  }

  _build() {
    this._group = new THREE.Group();
    this._buildPathPreview();

    this._rocket = new THREE.Mesh(
      new THREE.ConeGeometry(ROCKET_RADIUS, ROCKET_LENGTH, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff1c9 }),
    );
    this._rocket.position.copy(this._p0);
    this._rocket.scale.setScalar(this._scale);
    this._rocket.frustumCulled = false;
    this._group.add(this._rocket);

    // Emissive trail: additive dots, newest first. The fade ramp is baked into
    // the color attribute once because index 0 is always the newest sample.
    this._trailPositions = new Float32Array(TRAIL_POINTS * 3);
    const colors = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      const fade = 1 - i / TRAIL_POINTS;
      colors[i * 3] = fade;
      colors[i * 3 + 1] = fade * 0.75;
      colors[i * 3 + 2] = fade * 0.35;
      this._trailPositions[i * 3] = this._p0.x;
      this._trailPositions[i * 3 + 1] = this._p0.y;
      this._trailPositions[i * 3 + 2] = this._p0.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this._trailPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this._trail = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 4,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this._trail.frustumCulled = false;
    this._group.add(this._trail);

    this.scene?.add(this._group);
  }

  /** Point the nose along the path (it is a cone, so +Y is the nose). */
  _aimAlongPath(livePosition, t) {
    const ahead = Math.min(1, t + 0.02);
    bezierPoint(this._p0, this._p1, livePosition, ahead, this._ahead);
    const direction = this._ahead.sub(this._at);
    if (direction.lengthSq() > 1e-9) {
      this._rocket.quaternion.setFromUnitVectors(UP, direction.normalize());
    }
  }

  _pushTrail(at) {
    const positions = this._trailPositions;
    positions.copyWithin(3, 0, positions.length - 3);
    positions[0] = at.x;
    positions[1] = at.y;
    positions[2] = at.z;
    this._trail.geometry.getAttribute('position').needsUpdate = true;
  }
}

function defaultNow() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}
