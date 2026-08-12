import * as THREE from 'three';
import { TEXTURE_MAP } from '../utils/constants.js';

// The 3D half of the size comparison (SPEC-PLAY-001 REQ-PLAY-101/102).
//
// WHY ORTHOGRAPHIC. The claim being drawn is a WIDTH claim — "지구 109개를
// 나란히 놓으면 태양 폭이에요!" is only true on screen if 109 little Earths
// really do span exactly one Sun. A perspective camera makes the near end of
// that row wider than the far end, so the picture would stop matching the
// sentence the moment it gained depth. Orthographic keeps the 2D lineup's one
// honest property while the spheres pick up light, shading and real texture.
//
// WHY A SECOND CONTEXT, BRIEFLY. SPEC-EARTH-002 REQ-385 keeps exactly one
// WebGLRenderer for the app's views, and this does not join them: it builds its
// own renderer when the overlay opens and disposes it on close, so the extra
// context exists only while the child is looking at it. The main scene, the
// selection and the main camera are never touched — that is REQ-PLAY-103, and it
// now holds by construction here rather than by the old "this class is all DOM".

/** World width of the big body, and therefore of the whole unit row. */
export const LANE_WIDTH = 10;

/** Breathing room around the lineup, as a fraction of LANE_WIDTH. */
const MARGIN = 0.1;

/** Vertical gap between the big body and the unit row below it. */
const ROW_GAP = 0.08 * LANE_WIDTH;

/** Sphere tessellation. The unit row can hold 120 of these, so keep it cheap. */
const BIG_SEGMENTS = 48;
const UNIT_SEGMENTS = 16;

const AUTO_SPIN_RATE = 0.18; // radians/second

/**
 * Stack the lineup: the big body on top, the unit row directly beneath it, both
 * spanning exactly LANE_WIDTH and both centred on x = 0.
 *
 * STACKED, NOT SIDE BY SIDE. The sentence is "지구 109개를 나란히 놓으면 태양
 * 폭이에요" — a claim that two widths are EQUAL. Two things can only be seen to
 * be the same width when one sits above the other; laid end to end they just make
 * one wider thing, and the child has nothing to compare. This is the property the
 * 2D disc rows had, and it is the reason the scene is orthographic.
 *
 * Pure — no THREE objects, no GPU. This is the geometry the picture has to obey,
 * so it is testable without a canvas.
 * @param {number} ratio - big.radius / small.radius
 * @param {number} count - unit bodies to lay down (may end in .5)
 * @returns {{bigRadius:number, unitRadius:number, bigCenter:{x:number,y:number}, unitCenters:Array<{x:number,y:number}>, unitCentersX:number[], halfUnit:boolean, width:number, height:number}}
 */
export function layoutLineup(ratio, count) {
  const bigRadius = LANE_WIDTH / 2;
  const unitDiameter = LANE_WIDTH / ratio;
  const unitRadius = unitDiameter / 2;
  const whole = Math.floor(count);
  const halfUnit = count % 1 !== 0;

  const rowY = -(bigRadius + ROW_GAP + unitRadius);
  const left = -LANE_WIDTH / 2;

  const unitCenters = [];
  for (let i = 0; i < whole; i += 1) {
    unitCenters.push({ x: left + unitDiameter * i + unitRadius, y: rowY });
  }
  // The half body keeps a full slot's start but half its width, so the row's
  // total span stays unitDiameter * count — the number the sentence claims.
  if (halfUnit) unitCenters.push({ x: left + unitDiameter * whole + unitRadius / 2, y: rowY });

  return {
    bigRadius,
    unitRadius,
    bigCenter: { x: 0, y: 0 },
    unitCenters,
    unitCentersX: unitCenters.map((c) => c.x),
    halfUnit,
    width: LANE_WIDTH,
    height: bigRadius * 2 + ROW_GAP + unitDiameter,
  };
}

/**
 * A self-contained orthographic scene showing one comparison row.
 * Created when the overlay opens, disposed when it closes.
 */
export class SizeCompareScene {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {boolean} [opts.reducedMotion] - REQ-PLAY-104: still, not spinning.
   * @param {Function} [opts.createRenderer] - Injected for tests (no WebGL in jsdom).
   * @param {THREE.TextureLoader} [opts.textureLoader]
   */
  constructor({ canvas, reducedMotion = false, createRenderer, textureLoader } = {}) {
    this.canvas = canvas;
    this.reducedMotion = Boolean(reducedMotion);
    this._loader = textureLoader || new THREE.TextureLoader();
    this._disposed = false;
    this._raf = null;
    this._lastMs = 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.set(0, 0, 100);

    // Key light from the front-left so a sphere reads as a sphere; the ambient
    // floor keeps the dark side legible for a child rather than dramatic.
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
   * Build the lineup for one comparison row.
   * @param {{big: Object, small: Object, ratio: number, count: number}} row
   */
  show(row) {
    this._clearGroup();
    const layout = layoutLineup(row.ratio, row.count);
    this.layout = layout;

    this._group.add(
      this._sphere(row.big, layout.bigRadius, layout.bigCenter, BIG_SEGMENTS),
    );

    // One mesh per unit rather than an InstancedMesh: the row tops out at
    // MAX_COUNT (120) low-poly spheres, which is nothing next to the belts, and
    // individual meshes keep the half-body case a plain scale rather than a
    // special instanced path.
    for (let i = 0; i < layout.unitCenters.length; i += 1) {
      const isHalf = layout.halfUnit && i === layout.unitCenters.length - 1;
      const mesh = this._sphere(row.small, layout.unitRadius, layout.unitCenters[i], UNIT_SEGMENTS);
      // A literal half body: scaled on X only, so it still spans half a slot and
      // the row's total width keeps matching the count.
      if (isHalf) mesh.scale.x = 0.5;
      this._group.add(mesh);
    }

    // Centre the stack vertically; it is already centred on x = 0 by layout.
    this._group.position.y = (layout.bigRadius * 2 + ROW_GAP + layout.unitRadius * 2) / 2 - layout.bigRadius;
    this.resize();
    if (!this.reducedMotion) this.start();
    else this.renderFrame();
  }

  _sphere(body, radius, center, segments) {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(body.color),
      roughness: 0.95,
      metalness: 0,
    });
    // Texture is an ENHANCEMENT, never a requirement: it arrives asynchronously
    // and simply replaces the flat colour when it does, so a slow network (or a
    // body with no texture at all) still shows a correctly-sized sphere.
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
        () => {}, // missing texture: keep the colour, say nothing
      );
    }
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), material);
    mesh.position.set(center.x, center.y, 0);
    this._spin.push(mesh);
    return mesh;
  }

  /**
   * Fit the orthographic frustum to the lineup and the canvas aspect. Called on
   * every show and every resize, so rotating a phone reframes rather than crops.
   */
  resize() {
    if (!this.layout) return;
    const width = this.canvas.clientWidth || this.canvas.width || 1;
    const height = this.canvas.clientHeight || this.canvas.height || 1;
    this.renderer.setSize(width, height, false);

    const margin = LANE_WIDTH * MARGIN;
    const halfWidth = this.layout.width / 2 + margin;
    const halfHeight = this.layout.height / 2 + margin;
    // Fit BOTH axes: whichever needs more room decides the zoom, so the lineup is
    // never cropped on a narrow phone.
    const aspect = width / height;
    const half = Math.max(halfWidth / aspect, halfHeight);

    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.updateProjectionMatrix();
    this.renderFrame();
  }

  /** Draw exactly one frame. */
  renderFrame() {
    if (this._disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this._raf != null || this._disposed) return;
    this._lastMs = 0;
    const tick = (ms) => {
      if (this._disposed) return;
      const dt = this._lastMs ? Math.min(0.1, (ms - this._lastMs) / 1000) : 0;
      this._lastMs = ms;
      for (const mesh of this._spin) mesh.rotation.y += AUTO_SPIN_RATE * dt;
      this.renderFrame();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
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
    }
    this._spin = [];
  }

  dispose() {
    this.stop();
    this._disposed = true;
    this._clearGroup();
    for (const texture of this._textures) texture.dispose();
    this._textures = [];
    // Frees the GPU context. The overlay builds a fresh one next time it opens,
    // which is what keeps the app back at one live context while it is closed.
    this.renderer.dispose();
  }
}
