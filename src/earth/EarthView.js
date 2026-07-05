import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH_VIEW_DEFAULTS, EARTH_CONTROLS_DEFAULTS, FLIGHT_DEFAULTS } from '../utils/constants.js';
import { EarthRig } from './EarthRig.js';
import { EarthHUD } from './EarthHUD.js';
import { EclipseRig } from '../effects/EclipseRig.js';
import { AuroraEffect, selectAuroraTier } from '../effects/AuroraEffect.js';
import { AircraftLayer } from '../effects/AircraftLayer.js';
import { FlightDataService, FLIGHT_STATE } from '../data/FlightDataService.js';
import { detectEclipsesInRange, findNextEclipse } from '../utils/eclipseData.js';

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
   * @param {Object} [opts.simApi] - Shared sim clock (get/setSimTime, get/setTimeSpeed,
   *   isPlaying). EarthView reads AND advances it while active so both views share ONE
   *   clock (SPEC-EARTH-002 TASK-F6-0) — never a second time system.
   * @param {boolean} [opts.isLowEnd] - Low-end heuristic (SIM-001), selects aurora tier.
   * @param {Function} [opts.eclipseRigFactory]
   * @param {Function} [opts.auroraFactory]
   * @param {Function} [opts.flightServiceFactory]
   */
  constructor({
    isMobile = false,
    isLowEnd = false,
    controlsFactory,
    rigFactory,
    textureLoader,
    win,
    simApi,
    eclipseRigFactory,
    auroraFactory,
    flightServiceFactory,
  } = {}) {
    this.isMobile = isMobile;
    this.isLowEnd = isLowEnd;
    this._simApi = simApi || null;
    this._win = win || (typeof window !== 'undefined' ? window : undefined);
    this._controlsFactory = controlsFactory || ((camera, dom) => new OrbitControls(camera, dom));
    this._rigFactory = rigFactory || (() => new EarthRig({ textureLoader, renderer: this.renderer }));
    this._eclipseRigFactory = eclipseRigFactory
      || (() => new EclipseRig({ earthRadius: EARTH_VIEW_DEFAULTS.earthRadius }));
    this._auroraFactory = auroraFactory
      || (() => new AuroraEffect({
        tier: selectAuroraTier({ isMobile, isLowEnd }),
        earthRadius: EARTH_VIEW_DEFAULTS.earthRadius,
        sunDirection: SUN_DIRECTION,
      }));
    this._flightServiceFactory = flightServiceFactory || (() => new FlightDataService({}));

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
    this.onStopPolling = null; // external listeners may also hook exit-time poll stop.
    this._daysPerSecond = EARTH_VIEW_DEFAULTS.rotationSpeedDefault;

    // F5/F6/F7 runtime (built lazily in _build).
    this._aircraftLayer = null;
    this._eclipseRig = null;
    this._aurora = null;
    this._flightService = null;
    this._prevSimDay = 0;
    this._auroraVisible = true;
    this._auroraShed = false;
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

    // F5 — aircraft: an InstancedMesh fed by the injected/real data service.
    this._aircraftLayer = new AircraftLayer({
      earthRadius: EARTH_VIEW_DEFAULTS.earthRadius,
      maxInstances: FLIGHT_DEFAULTS.maxInstances,
      altitudeScale: FLIGHT_DEFAULTS.altitudeScale,
    });
    this.aircraftLayer.add(this._aircraftLayer.object3d);
    this._flightService = this._flightServiceFactory();
    this._flightService.onState((state) => this._refreshFlightHud(state));

    // F6 — eclipse shadow diorama.
    this._eclipseRig = this._eclipseRigFactory();
    this.eclipseLayer.add(this._eclipseRig.group);

    // F7 — aurora curtain / billboard.
    this._aurora = this._auroraFactory();
    this.auroraLayer.add(this._aurora.group);
    this._applyAuroraVisible();

    this._wireHudControls();
    this._prevSimDay = this._simApi ? this._simApi.getSimTime() : 0;
    this._built = true;
  }

  /**
   * Wire the SPEC-EARTH-002 HUD controls to their handlers.
   */
  _wireHudControls() {
    this._hud.onToggleAircraft = () => this._toggleAircraft();
    this._hud.onSelectEclipse = (eclipse) => this._jumpToEclipse(eclipse);
    this._hud.onFindNextEclipse = () => this._findNextEclipse();
    this._hud.onToggleAurora = () => this._toggleAurora();
  }

  /** Opt-in start / stop of the flight-data polling (REQ-410 opt-in). */
  _toggleAircraft() {
    if (!this._flightService) return;
    if (this._flightService.state === FLIGHT_STATE.OFF) this._flightService.start();
    else this._flightService.stop();
  }

  /** Jump the shared clock to a preset eclipse and render it (REQ-510). */
  _jumpToEclipse(eclipse) {
    if (!eclipse) return;
    if (this._simApi) this._simApi.setSimTime(eclipse.simDay);
    this._prevSimDay = eclipse.simDay;
    if (this._eclipseRig) this._eclipseRig.show(eclipse);
  }

  /** Fast-forward to the next eclipse within the bounded window (REQ-540). */
  _findNextEclipse() {
    if (!this._simApi) return;
    const next = findNextEclipse(this._simApi.getSimTime());
    if (next) this._jumpToEclipse(next);
  }

  _toggleAurora() {
    this._auroraVisible = !this._auroraVisible;
    this._applyAuroraVisible();
    if (this._hud) this._hud.setAuroraEnabled(this._auroraVisible);
  }

  _applyAuroraVisible() {
    if (this._aurora) this._aurora.setVisible(this._auroraVisible && !this._auroraShed);
  }

  /**
   * Shed/restore the aurora under frame-budget pressure (REQ-650). Called by the
   * degradation ladder before bloom while the Earth view is active.
   * @param {boolean} shed
   */
  setAuroraShed(shed) {
    this._auroraShed = shed;
    this._applyAuroraVisible();
  }

  /**
   * Push flight-service status into the HUD's aria-live region.
   * @param {string} [state]
   */
  _refreshFlightHud(state) {
    if (!this._hud || !this._flightService) return;
    const s = state || this._flightService.state;
    const agoMs = this._flightService.lastUpdatedAt ? Date.now() - this._flightService.lastUpdatedAt : 0;
    this._hud.setFlightStatus(s, { count: this._flightService.count, updatedAgoSec: agoMs / 1000 });
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
    // Earth view always drives its own clock/rig at its own local default rate
    // (EARTH_VIEW_DEFAULTS.rotationSpeedDefault), gated only by the shared play/pause
    // flag — deliberately decoupled from the solar view's own speed slider (confirmed
    // product decision, TASK-F6-0). Play/pause still gates it to 0 when paused; the
    // speed magnitude itself never reads simApi.getTimeSpeed().
    const speed = (!this._simApi || this._simApi.isPlaying()) ? this._daysPerSecond : 0;

    if (this._simApi && speed !== 0) {
      // Advance the ONE shared clock while Earth is the active view (solar's
      // integrator is idle here); this is the same _simTime, not a second clock.
      this._simApi.setSimTime(this._simApi.getSimTime() + delta * speed);
    }

    if (this._rig) this._rig.update(delta, speed);
    this._detectEclipses();
    this._updateAircraft(delta);
    if (this._aurora) this._aurora.update(delta);
    if (this._eclipseRig) this._eclipseRig.update(delta);
    if (this.controls) this.controls.update();
  }

  /**
   * Range-test the sim-time span this frame covered against the real eclipse table —
   * immune to frame step size, so a 500x leap never skips an event (REQ-530/550).
   */
  _detectEclipses() {
    if (!this._simApi || !this._eclipseRig) return;
    const curr = this._simApi.getSimTime();
    if (curr === this._prevSimDay) return;
    const hits = detectEclipsesInRange(this._prevSimDay, curr);
    if (hits.length) this._eclipseRig.show(hits[hits.length - 1]);
    this._prevSimDay = curr;
  }

  /**
   * Dead-reckon + repaint aircraft instances, and refresh the "updated Xs ago" readout.
   * @param {number} delta
   */
  _updateAircraft(delta) {
    if (!this._flightService) return;
    this._flightService.tick(delta);
    if (this._aircraftLayer) this._aircraftLayer.update(this._flightService.getAircraft());
    if (this._flightService.state === FLIGHT_STATE.LIVE) this._refreshFlightHud();
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
    // @MX:WARN: [AUTO] MUST stop the flight service on every exit or its polling timer
    // leaks — keeps hitting the shared community API after the view is gone (REQ-355).
    // @MX:REASON: [AUTO] Exit can happen mid-flight; FlightDataService.stop() clears the
    // pending timer and invalidates any in-flight poll's continuation.
    if (this._flightService) this._flightService.stop();
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
    if (this._flightService) this._flightService.stop();
    if (this._aircraftLayer) {
      this.aircraftLayer.remove(this._aircraftLayer.object3d);
      this._aircraftLayer.dispose();
    }
    if (this._eclipseRig) {
      this.eclipseLayer.remove(this._eclipseRig.group);
      this._eclipseRig.dispose();
    }
    if (this._aurora) {
      this.auroraLayer.remove(this._aurora.group);
      this._aurora.dispose();
    }
    if (this._hud) this._hud.dispose();
    this._rig = null;
    this._hud = null;
    this._aircraftLayer = null;
    this._eclipseRig = null;
    this._aurora = null;
    this._flightService = null;
    this._built = false;
  }

  dispose() {
    this._disposeAssets();
    if (this.controls && this.controls.dispose) this.controls.dispose();
  }
}
