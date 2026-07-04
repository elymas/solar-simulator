import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH_VIEW_DEFAULTS, EARTH_CONTROLS_DEFAULTS } from '../utils/constants.js';
import { EarthRig } from './EarthRig.js';
import { EarthHUD } from './EarthHUD.js';

// Sun direction shared between the rig terminator and this view's key light so the
// lit hemisphere and the day/night blend agree.
const SUN_DIRECTION = new THREE.Vector3(1, 0, 0.35).normalize();

/**
 * EarthView is the dedicated single-planet view. It owns its own Scene, an
 * earth-local-scale camera + OrbitControls, lighting, the EarthRig (built lazily
 * on first entry), the EarthHUD, and empty F5/F6/F7 mount points that
 * SPEC-EARTH-002 attaches to. It never constructs a renderer/composer — it borrows
 * the shared ones via mount() (REQ-385).
 */
export class EarthView {
  /**
   * @param {Object} [opts]
   * @param {boolean} [opts.isMobile] - Drives the exit-time dispose policy (REQ-355).
   * @param {Function} [opts.controlsFactory] - (camera, domElement) => controls.
   * @param {Function} [opts.rigFactory] - () => EarthRig-like ({ group, update, dispose }).
   * @param {THREE.TextureLoader} [opts.textureLoader]
   * @param {Window} [opts.win]
   */
  constructor({ isMobile = false, controlsFactory, rigFactory, textureLoader, win } = {}) {
    this.isMobile = isMobile;
    this._win = win || (typeof window !== 'undefined' ? window : undefined);
    this._controlsFactory = controlsFactory || ((camera, dom) => new OrbitControls(camera, dom));
    this._rigFactory = rigFactory || (() => new EarthRig({ textureLoader, renderer: this.renderer }));

    this.scene = new THREE.Scene();
    this._initCamera();
    this._initLighting();

    // F5/F6/F7 mount points — empty groups that later simulations populate. This
    // SPEC ships the hooks only (REQ-350/360); SPEC-EARTH-002 owns the contents.
    this.aircraftLayer = new THREE.Group(); this.aircraftLayer.name = 'aircraftLayer';
    this.eclipseLayer = new THREE.Group(); this.eclipseLayer.name = 'eclipseLayer';
    this.auroraLayer = new THREE.Group(); this.auroraLayer.name = 'auroraLayer';
    this.scene.add(this.aircraftLayer, this.eclipseLayer, this.auroraLayer);

    this._built = false;
    this._rig = null;
    this._hud = null;
    this._onExitRequest = null;
    this.onStopPolling = null; // SPEC-EARTH-002 F5 data service registers here.
    this._daysPerSecond = 1;
  }

  _initCamera() {
    const { fov, near, far, position } = EARTH_VIEW_DEFAULTS;
    const aspect = this._win ? this._win.innerWidth / this._win.innerHeight : 16 / 9;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(0, 0, 0);
  }

  _initLighting() {
    this.scene.add(new THREE.AmbientLight(0x404050, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.copy(SUN_DIRECTION).multiplyScalar(1000);
    this.scene.add(key);
  }

  // --- frozen View interface (ANCHOR: SPEC-EARTH-002 depends on this shape) ---

  // @MX:ANCHOR: [AUTO] mount(renderer, composer) — receives the SHARED render core.
  // EarthView must never build its own renderer/composer (REQ-385); it only needs
  // the renderer's canvas to attach its OrbitControls.
  // @MX:REASON: [AUTO] A second WebGLRenderer would create a second WebGL context —
  // wasteful and a context-loss risk the whole view architecture exists to avoid.
  mount(renderer, composer) {
    this.renderer = renderer;
    this.composer = composer;
    if (renderer && renderer.domElement && !this.controls) {
      this.controls = this._controlsFactory(this.camera, renderer.domElement);
      if (this.controls) {
        const c = EARTH_CONTROLS_DEFAULTS;
        this.controls.enableDamping = c.enableDamping;
        this.controls.dampingFactor = c.dampingFactor;
        this.controls.minDistance = c.minDistance;
        this.controls.maxDistance = c.maxDistance;
        this.controls.enabled = false;
      }
    }
  }

  unmount() {
    this.renderer = null;
    this.composer = null;
  }

  /**
   * Lazily build the heavy Earth rig + HUD on first entry (zero cost until the
   * user actually opens the Earth view). Rebuilds after a mobile-exit dispose.
   */
  _build() {
    if (this._built) return;
    this._rig = this._rigFactory();
    this.scene.add(this._rig.group);
    this._hud = new EarthHUD();
    this._hud.onBack = () => this._onExitRequest && this._onExitRequest();
    this._hud.hide();
    this._built = true;
  }

  /**
   * @param {string|null} _fromState
   */
  onEnter(_fromState) {
    this._build();
    if (this._hud) this._hud.show();
    if (this.controls) this.controls.enabled = true;
  }

  onExit() {
    if (this._hud) this._hud.hide();
    if (this.controls) this.controls.enabled = false;
    this.stopPolling();
    // REQ-355: reclaim VRAM on mobile; desktop keeps the rig resident for instant re-entry.
    if (this.isMobile) this._disposeAssets();
  }

  /**
   * @param {number} delta - Frame delta in seconds.
   */
  update(delta) {
    if (this._rig) this._rig.update(delta, this._daysPerSecond);
    if (this.controls) this.controls.update();
  }

  /**
   * @returns {{scene: THREE.Scene, camera: THREE.Camera}}
   */
  getScenePass() {
    return { scene: this.scene, camera: this.camera };
  }

  /**
   * @param {number} width
   * @param {number} height
   */
  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Register the callback ViewManager uses to leave the Earth view (back button /
   * Escape / browser back all route here).
   * @param {Function} fn
   */
  setExitRequestHandler(fn) {
    this._onExitRequest = fn;
    if (this._hud) this._hud.onBack = () => fn();
  }

  /**
   * Stop any F5 flight-data polling. No polling exists in this SPEC — this is the
   * hook SPEC-EARTH-002's data service will register a real stopper on (REQ-355).
   */
  stopPolling() {
    this._pollStopped = true;
    if (this.onStopPolling) this.onStopPolling();
  }

  /**
   * Dispose the Earth rig + HUD and reset so the next entry rebuilds them.
   */
  _disposeAssets() {
    if (this._rig) {
      this.scene.remove(this._rig.group);
      this._rig.dispose();
    }
    if (this._hud) this._hud.dispose();
    this._rig = null;
    this._hud = null;
    this._built = false;
  }

  dispose() {
    this._disposeAssets();
    if (this.controls && this.controls.dispose) this.controls.dispose();
  }
}
