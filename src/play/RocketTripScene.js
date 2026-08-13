import * as THREE from 'three';
import { TEXTURE_MAP } from '../utils/constants.js';

// The 3D half of the rocket trip (SPEC-PLAY-001 REQ-PLAY-201..205), drawn in its
// own overlay rather than in the solar system.
//
// WHY IT LEFT THE MAIN SCENE. The flight used to be drawn into the shared scene
// and framed with the shared camera. On a phone the info panel covers the whole
// viewport, so the child tapped 로켓 발사 and saw nothing happen — the journey was
// playing behind an opaque card. Moving it into its own overlay, the way 크기 비교
// already works, makes the picture the thing you are looking at instead of the
// thing hidden behind what you are looking at.
//
// WHAT THIS PICTURE CLAIMS, AND WHAT IT DOES NOT. It claims a DISTANCE: two
// worlds, a dotted road between them, and how long a real spacecraft takes to
// drive it. It claims nothing about SIZE — both bodies are drawn the same radius,
// as symbols on a map are, because a trip diagram that also tried to be true to
// scale would draw the Moon as an invisible speck beside Earth. 크기 비교 owns the
// size claim and draws real diameters; this overlay carries the same "그림 크기는
// 실제와 달라요" note the eclipse diagram uses so the two never contradict.
//
// WHY A SECOND CONTEXT, BRIEFLY. Same bargain SizeCompareScene makes: build a
// renderer when the overlay opens, dispose it on close, never touch the app's
// main renderer, scene, camera or selection.

/** Half the world-space gap between the two bodies. */
export const LANE_HALF = 5;
/** Both bodies share one radius: this is a map symbol, not a size claim. */
export const BODY_RADIUS = 1.15;
const BODY_SEGMENTS = 40;

// Sized against BODY_RADIUS, not against reality — a to-scale rocket beside a
// planet is one pixel. A real-device pass on a 390 px phone found the first
// attempt (1.1 long) reading as a sliver on the road; this is the size at which
// a child can see it is a rocket.
const ROCKET_LENGTH = 1.7;
const ROCKET_RADIUS = 0.3;

/** One crossing, then a beat at the destination before it flies again. */
export const TRIP_MS = 3000;
const HOLD_MS = 900;

const AUTO_SPIN_RATE = 0.18; // radians/second, matching SizeCompareScene
const MARGIN = 1.2;

/**
 * Where the rocket sits at trip progress t, in world x. Pure so the flight can be
 * asserted without a canvas: it starts at the launch body's edge and stops at the
 * destination's, never inside either sphere.
 * @param {number} t - 0..1
 * @returns {number}
 */
export function rocketX(t) {
  const clamped = Math.min(1, Math.max(0, t));
  const from = -LANE_HALF + BODY_RADIUS;
  const to = LANE_HALF - BODY_RADIUS;
  return from + (to - from) * clamped;
}

/**
 * A self-contained scene: launch body on the left, destination on the right, a
 * dashed road between them and a rocket driving it.
 */
export class RocketTripScene {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {boolean} [opts.reducedMotion] - REQ-PLAY-104: a still diagram.
   * @param {Function} [opts.onArrive] - Called once, when the rocket first lands.
   * @param {Function} [opts.createRenderer] - Injected for tests (no WebGL in jsdom).
   * @param {THREE.TextureLoader} [opts.textureLoader]
   */
  constructor({ canvas, reducedMotion = false, onArrive, createRenderer, textureLoader } = {}) {
    this.canvas = canvas;
    this.reducedMotion = Boolean(reducedMotion);
    this._onArrive = onArrive;
    this._loader = textureLoader || new THREE.TextureLoader();
    this._disposed = false;
    this._raf = null;
    this._startMs = 0;
    this._arrived = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.set(0, 0, 100);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 4, 8);
    this.scene.add(key);

    this.renderer = createRenderer
      ? createRenderer(canvas)
      : new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);

    this._group = new THREE.Group();
    this.scene.add(this._group);
    this._spin = [];
    this._textures = [];
  }

  /**
   * Build the diagram for one trip.
   * @param {{from: Object, to: Object}} trip - Bodies as {key, nameKo, color}.
   */
  show(trip) {
    this._clearGroup();
    this._arrived = false;

    this._group.add(this._sphere(trip.from, -LANE_HALF));
    this._group.add(this._sphere(trip.to, LANE_HALF));
    this._group.add(this._road());

    this._rocket = this._rocketMesh();
    this._group.add(this._rocket);
    // Reduced motion parks it mid-road: the picture still says "something flies
    // between these two", it just does not move (REQ-PLAY-104).
    this._rocket.position.x = rocketX(this.reducedMotion ? 0.5 : 0);

    this.resize();
    if (this.reducedMotion) {
      this.renderFrame();
      this._arrive();
    } else {
      this.start();
    }
  }

  _sphere(body, x) {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(body.color),
      roughness: 0.95,
      metalness: 0,
    });
    // Texture is an enhancement, never a requirement — same contract as the size
    // lineup: a slow network still shows a correctly placed, correctly coloured
    // body, and a body with no texture at all is not a broken picture.
    const url = TEXTURE_MAP[body.key];
    if (url) {
      this._loader.load(
        url,
        (texture) => {
          if (this._disposed) { texture.dispose(); return; }
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;
          this._textures.push(texture);
          this.renderFrame();
        },
        undefined,
        () => {},
      );
    }
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BODY_RADIUS, BODY_SEGMENTS, BODY_SEGMENTS),
      material,
    );
    mesh.position.set(x, 0, 0);
    this._spin.push(mesh);
    return mesh;
  }

  /** The dashed road. Dashes need computeLineDistances or they render solid. */
  _road() {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(rocketX(0), 0, 0),
      new THREE.Vector3(rocketX(1), 0, 0),
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: 0x16c7ff, dashSize: 0.34, gapSize: 0.26 }),
    );
    line.computeLineDistances();
    return line;
  }

  _rocketMesh() {
    const group = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.5, metalness: 0.1 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xff6b4a, roughness: 0.6, metalness: 0 });

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(ROCKET_RADIUS, ROCKET_RADIUS, ROCKET_LENGTH * 0.6, 16),
      shell,
    );
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(ROCKET_RADIUS, ROCKET_LENGTH * 0.4, 16),
      trim,
    );
    nose.position.y = ROCKET_LENGTH * 0.5;
    group.add(body, nose);
    // Cylinders and cones are built along +Y; the road runs along +X.
    group.rotation.z = -Math.PI / 2;
    return group;
  }

  /** Fit the frustum to the diagram and the canvas box, both axes, never cropped. */
  resize() {
    const width = this.canvas.clientWidth || this.canvas.width || 1;
    const height = this.canvas.clientHeight || this.canvas.height || 1;
    this.renderer.setSize(width, height, false);

    const halfWidth = LANE_HALF + BODY_RADIUS + MARGIN;
    const halfHeight = BODY_RADIUS + MARGIN;
    const aspect = width / height;
    const half = Math.max(halfWidth / aspect, halfHeight);

    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.updateProjectionMatrix();
    this.renderFrame();
  }

  renderFrame() {
    if (this._disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this._raf != null || this._disposed) return;
    this._startMs = 0;
    const tick = (ms) => {
      if (this._disposed) return;
      if (!this._startMs) this._startMs = ms;
      const elapsed = ms - this._startMs;
      // Loop: fly, pause at the destination, fly again. A child watches a trip
      // more than once, and a one-shot animation leaves a still picture with a
      // rocket stuck to a planet.
      const cycle = elapsed % (TRIP_MS + HOLD_MS);
      const t = Math.min(1, cycle / TRIP_MS);
      if (this._rocket) this._rocket.position.x = rocketX(t);
      if (t >= 1) this._arrive();
      for (const mesh of this._spin) mesh.rotation.y += (AUTO_SPIN_RATE * 16) / 1000;
      this.renderFrame();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  /** Fire the arrival exactly once per show() — missions must not tick per lap. */
  _arrive() {
    if (this._arrived) return;
    this._arrived = true;
    if (this._onArrive) this._onArrive();
  }

  stop() {
    if (this._raf == null) return;
    cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _clearGroup() {
    for (const child of [...this._group.children]) {
      this._group.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
      for (const part of child.children || []) {
        part.geometry?.dispose();
        part.material?.dispose();
      }
    }
    this._spin = [];
    this._rocket = null;
  }

  dispose() {
    this.stop();
    this._disposed = true;
    this._clearGroup();
    for (const texture of this._textures) texture.dispose();
    this._textures = [];
    this.renderer.dispose();
  }
}
