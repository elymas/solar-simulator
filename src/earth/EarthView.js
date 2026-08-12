import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH_VIEW_DEFAULTS, EARTH_CONTROLS_DEFAULTS, FLIGHT_DEFAULTS, METEOR_DEFAULTS } from '../utils/constants.js';
import { EarthRig } from './EarthRig.js';
import { EarthHUD } from './EarthHUD.js';
import { EclipseRig } from '../effects/EclipseRig.js';
import { AuroraEffect, selectAuroraTier } from '../effects/AuroraEffect.js';
import { MeteorShower } from '../effects/MeteorShower.js';
import { AircraftLayer } from '../effects/AircraftLayer.js';
import { FlightDataService, FLIGHT_STATE } from '../data/FlightDataService.js';
import { detectEclipsesInRange, findNextEclipse } from '../utils/eclipseData.js';
import { detectShowerEntries, isShowerActive } from '../utils/meteorData.js';
import { ISSMarker, ISS_FACTS } from './ISSMarker.js';
import { speak } from '../audio/tts.js';
import { STR } from '../ui/strings.js';
import { TOUCH_TAP_MAX_DRAG_PX } from '../controls/InteractionManager.js';
import { emitPlayEvent } from '../play/playEvents.js';

// Sun direction shared between the rig terminator and this view's key light so the
// lit hemisphere and the day/night blend agree.
const SUN_DIRECTION = new THREE.Vector3(1, 0, 0.35).normalize();

// issPosition (issOrbit.js) takes elapsed SIMULATION minutes; the shared clock
// (_simApi.getSimTime()) reports elapsed SIMULATION days (SIM_EPOCH_MS convention).
const MINUTES_PER_SIM_DAY = 24 * 60;

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
   * @param {Function} [opts.meteorFactory]
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
    meteorFactory,
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
    this._meteorFactory = meteorFactory
      || (() => new MeteorShower({
        poolSize: isLowEnd ? METEOR_DEFAULTS.poolSizeConstrained : METEOR_DEFAULTS.poolSizeFull,
        earthRadius: EARTH_VIEW_DEFAULTS.earthRadius,
        sunDirection: SUN_DIRECTION,
      }));
    this._flightServiceFactory = flightServiceFactory || (() => new FlightDataService({}));

    this.scene = new THREE.Scene();
    // No starfield mesh here (unlike SolarSystemView), so empty pixels would
    // otherwise fall back to the shared renderer's clear color — which is
    // tuned bright for the solar view's starfield and washes this view's
    // night sky into flat gray. Pin it to true black (0 survives any
    // exposure/tone-mapping multiplier unchanged).
    this.scene.background = new THREE.Color(0x000000);
    this._initCamera();
    this._initLighting();

    // F5/F6/F7 mount points — empty groups that later simulations populate. This
    // SPEC ships the hooks only (REQ-350/360); SPEC-EARTH-002 owns the contents.
    this.aircraftLayer = new THREE.Group(); this.aircraftLayer.name = 'aircraftLayer';
    this.eclipseLayer = new THREE.Group(); this.eclipseLayer.name = 'eclipseLayer';
    this.auroraLayer = new THREE.Group(); this.auroraLayer.name = 'auroraLayer';
    this.issLayer = new THREE.Group(); this.issLayer.name = 'issLayer';
    this.meteorLayer = new THREE.Group(); this.meteorLayer.name = 'meteorLayer';
    this.scene.add(this.aircraftLayer, this.eclipseLayer, this.auroraLayer, this.issLayer, this.meteorLayer);

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
    this._meteors = null;
    this._flightService = null;
    this._prevSimDay = 0;
    this._auroraVisible = true;
    this._auroraShed = false;
    this._eclipseEnabled = true;

    // F8 — meteor-shower HUD notice (SPEC-EARTH-003 REQ-E3-104). id of the
    // shower currently "noticed" (armed only once per continuous active
    // window); null means the gate is open for the next entry.
    this._noticedShowerId = null;

    // F11 — ISS (SPEC-EARTH-003). Defaults ON: one cheap marker, unlike the
    // opt-in aircraft poll. _issRaycaster/_issPointer are reused every tap, not
    // reallocated (same discipline as the position-update path).
    this._issMarker = null;
    this._issVisible = true;
    this._issRaycaster = new THREE.Raycaster();
    this._issPointer = new THREE.Vector2();
    this._issClickHandler = null;
    this._issPointerDownPos = null;
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
    // @MX:NOTE: [AUTO] The ISS marker is the only tappable target in this view —
    // no PlanetFactory-bound InteractionManager exists here, so a small dedicated
    // click listener drives its raycast instead of reusing that (planet-only) class.
    if (renderer && renderer.domElement && typeof renderer.domElement.addEventListener === 'function' && !this._issClickHandler) {
      this._issPointerDownHandler = (e) => this._onCanvasPointerDown(e);
      this._issClickHandler = (e) => this._onCanvasClick(e);
      this._issDomElement = renderer.domElement;
      renderer.domElement.addEventListener('pointerdown', this._issPointerDownHandler);
      renderer.domElement.addEventListener('click', this._issClickHandler);
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

    // F8 — meteor shower streak pool (SPEC-EARTH-003 REQ-E3-103/106).
    this._meteors = this._meteorFactory();
    this.meteorLayer.add(this._meteors.group);

    // F11 — ISS: a single small emissive marker (REQ-E3-201/202).
    this._issMarker = new ISSMarker();
    this.issLayer.add(this._issMarker.object3d);
    this._applyISSVisible();

    this._wireHudControls();
    this._hud.setSpeedDisplay(this._daysPerSecond);
    this._hud.setEclipseEnabled(this._eclipseEnabled);
    this._hud.setISSEnabled(this._issVisible);
    this._prevSimDay = this._simApi ? this._simApi.getSimTime() : 0;
    // REQ-E3-104: the Earth view opening DURING an active shower is itself a
    // notice trigger, independent of the frame-to-frame crossing detection below
    // (which only fires on a prevDay-inactive -> currDay-active transition and
    // would never see this one, since _prevSimDay above is set to "now").
    this._noticeActiveShower(isShowerActive(this._prevSimDay));
    this._built = true;
  }

  /**
   * Wire the SPEC-EARTH-002 HUD controls to their handlers.
   */
  _wireHudControls() {
    this._hud.onToggleAircraft = () => this._toggleAircraft();
    this._hud.onSelectEclipse = (eclipse) => this._jumpToEclipse(eclipse);
    this._hud.onFindNextEclipse = () => this._findNextEclipse();
    this._hud.onToggleEclipse = () => this._toggleEclipse();
    this._hud.onToggleAurora = () => this._toggleAurora();
    this._hud.onToggleISS = () => this._toggleISS();
    this._hud.onSpeedChange = (v) => { this._daysPerSecond = v; };
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
    this._showEclipse(eclipse);
  }

  /** Fast-forward to the next eclipse within the bounded window (REQ-540). */
  _findNextEclipse() {
    if (!this._simApi) return;
    const next = findNextEclipse(this._simApi.getSimTime());
    if (next) this._jumpToEclipse(next);
  }

  /**
   * Show the diorama for an eclipse plus its HUD explanation — the single path
   * both manual (select/find-next) and automatic (_detectEclipses) triggers
   * route through, so the on/off toggle only has to be checked in one place.
   * @param {{type: string, name: string, date: string}} eclipse
   */
  _showEclipse(eclipse) {
    if (!this._eclipseEnabled) return;
    if (this._eclipseRig) this._eclipseRig.show(eclipse);
    if (this._hud) this._hud.setEclipseInfo(eclipse);
  }

  /** Toggle the eclipse diorama simulation on/off (leaves time navigation intact). */
  _toggleEclipse() {
    this._eclipseEnabled = !this._eclipseEnabled;
    if (!this._eclipseEnabled) {
      if (this._eclipseRig) this._eclipseRig.hide();
      if (this._hud) this._hud.setEclipseInfo(null);
    }
    if (this._hud) this._hud.setEclipseEnabled(this._eclipseEnabled);
  }

  _toggleAurora() {
    this._auroraVisible = !this._auroraVisible;
    this._applyAuroraVisible();
    if (this._hud) this._hud.setAuroraEnabled(this._auroraVisible);
  }

  _applyAuroraVisible() {
    if (this._aurora) this._aurora.setVisible(this._auroraVisible && !this._auroraShed);
  }

  _toggleISS() {
    this._issVisible = !this._issVisible;
    this._applyISSVisible();
    if (this._hud) this._hud.setISSEnabled(this._issVisible);
  }

  _applyISSVisible() {
    if (this._issMarker) this._issMarker.setVisible(this._issVisible);
  }

  /**
   * Record where the pointer went down, so _onCanvasClick can tell an orbit-drag
   * release apart from a real tap (InteractionManager._onPointerDown precedent).
   * @param {{clientX: number, clientY: number}} event
   */
  _onCanvasPointerDown(event) {
    this._issPointerDownPos = { x: event.clientX, y: event.clientY };
  }

  /**
   * Raycast a canvas click against the ISS marker (REQ-E3-203). Gated on
   * _issVisible so toggling the layer OFF also drops it from the effective
   * raycast target set — a tap at the marker's former position hits nothing.
   * Also gated on drag distance (TOUCH_TAP_MAX_DRAG_PX, shared with
   * InteractionManager) so an orbit-drag that happens to release over the
   * marker is not misread as a tap.
   * @param {{clientX: number, clientY: number, target: *}} event
   */
  _onCanvasClick(event) {
    if (!this._issMarker || !this._issVisible) return;
    if (this.renderer && event.target !== this.renderer.domElement) return;
    if (this._issPointerDownPos) {
      const dx = event.clientX - this._issPointerDownPos.x;
      const dy = event.clientY - this._issPointerDownPos.y;
      this._issPointerDownPos = null;
      if (Math.hypot(dx, dy) > TOUCH_TAP_MAX_DRAG_PX) return;
    }
    const w = this._win ? this._win.innerWidth : 1;
    const h = this._win ? this._win.innerHeight : 1;
    this._issPointer.set((event.clientX / w) * 2 - 1, -(event.clientY / h) * 2 + 1);
    // The render loop normally keeps these matrices current every frame; force
    // it here too so a click landing outside that cadence still raycasts against
    // the marker's CURRENT position, not a stale (pre-move) one.
    this.camera.updateMatrixWorld();
    this._issMarker.object3d.updateMatrixWorld(true);
    this._issRaycaster.setFromCamera(this._issPointer, this.camera);
    if (this._issRaycaster.intersectObject(this._issMarker.object3d, false).length > 0) this._selectISS();
  }

  /** Present the ISS's Korean facts in the HUD and speak the mandated first one. */
  _selectISS() {
    if (this._hud) this._hud.showISSFacts(ISS_FACTS.factsKo);
    speak(ISS_FACTS.factsKo[0]);
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
   * Shed/restore the meteor pool under frame-budget pressure (REQ-E3-106), the
   * degrade step right after aurora. Mirrors setAuroraShed; unlike aurora there
   * is no separate manual HUD toggle to combine with.
   * @param {boolean} shed
   */
  setMeteorsShed(shed) {
    if (this._meteors) this._meteors.setVisible(!shed);
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
    // Play-event seam (SPEC-PLAY-001 plan §A.3): the "지구 구경을 해 보세요!"
    // mission listens for this.
    emitPlayEvent('view-enter', { view: 'EARTH' });
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
    this._detectShowers();
    this._detectEclipses();
    // Single, unconditional owner of the (prevDay, currDay] window close: both
    // detectors above may bail early (no simApi, no _eclipseRig) without ever
    // reaching their own prevSimDay write, so the advance must not live inside
    // either of them (see _detectShowers's docstring).
    if (this._simApi) this._prevSimDay = this._simApi.getSimTime();
    this._updateAircraft(delta);
    const simDay = this._simApi ? this._simApi.getSimTime() : 0;
    if (this._issMarker) {
      this._issMarker.update(simDay * MINUTES_PER_SIM_DAY);
    }
    if (this._aurora) this._aurora.update(delta);
    if (this._meteors) this._meteors.update(delta, simDay);
    if (this._eclipseRig) this._eclipseRig.update(delta);
    if (this.controls) this.controls.update();
  }

  /**
   * Range-test the sim-time span this frame covered against the shower table
   * (REQ-E3-102/104) — mirrors _detectEclipses's half-open crossing detection.
   * Both detectors read the SAME (this._prevSimDay, curr] window this frame;
   * update() advances this._prevSimDay to curr exactly once, after both
   * detectors have run, regardless of which one (if either) bailed early —
   * that single shared advance is also what keeps every shower's own re-arm
   * state correct (see @MX:NOTE below): no per-shower bookkeeping is needed
   * here beyond it.
   */
  _detectShowers() {
    if (!this._simApi) return;
    const curr = this._simApi.getSimTime();
    if (curr === this._prevSimDay) return;
    const entries = detectShowerEntries(this._prevSimDay, curr);
    if (entries.length > 0) {
      // @MX:NOTE: [AUTO] entries only answers "was a boundary crossed this
      // frame" (REQ-E3-102) — a returned shower can already be over by `curr`
      // (its whole window fell inside one frame, e.g. a huge or multi-year
      // delta), so entries itself is never announced directly. What is
      // actually in the sky right now is isShowerActive(curr), so that
      // (possibly null, meaning nothing is announced) is what gets noticed,
      // uniformly for the single- and multi-shower case alike.
      // @MX:REASON: [AUTO] Announcing a shower that already ended would be a
      // new defect. isShowerActive(curr) is the same fan_in-4 predicate every
      // other "is a shower active" check routes through (see its own
      // @MX:ANCHOR), so this stays consistent with _build/showerIntensity.
      // _noticeActiveShower still bounds this to at most one notice per
      // continuous active window (AC-E3-104): it no-ops on null and dedupes
      // by id, so the other showers in `entries` are silently skipped here —
      // this._prevSimDay advances to `curr` right after both detectors run,
      // so each of THEIR crossings is still detected correctly and exactly
      // once on whichever future frame the calendar genuinely reaches it.
      this._noticeActiveShower(isShowerActive(curr));
    } else if (!isShowerActive(curr)) {
      // @MX:NOTE: [AUTO] Re-arm gate (REQ-E3-104 "not until exited and
      // re-entered"): no shower is active right now, so drop the "already
      // noticed" id — the next crossing (or view re-open) may notice again.
      this._noticedShowerId = null;
    }
  }

  /**
   * Show + speak the meteor-shower notice, but at most once per continuous
   * active window (REQ-E3-104), regardless of which trigger asked — a clock
   * crossing (_detectShowers) or the Earth view opening mid-shower (_build).
   * @param {{id:string,koreanName:string}|null} shower
   */
  _noticeActiveShower(shower) {
    if (!shower) { this._noticedShowerId = null; return; }
    if (shower.id === this._noticedShowerId) return;
    this._noticedShowerId = shower.id;
    const text = STR.earthMeteorNotice(shower.koreanName);
    if (this._hud) this._hud.setMeteorNotice(text);
    speak(text);
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
    if (hits.length) this._showEclipse(hits[hits.length - 1]);
  }

  /**
   * Dead-reckon + repaint aircraft instances, and refresh the "updated Xs ago" readout.
   * @param {number} delta
   */
  _updateAircraft(delta) {
    // Aircraft positions are computed in the Earth's body-fixed (un-rotated) frame
    // (REQ-420 geoToLocal), but this.aircraftLayer sits in scene space, a sibling
    // of the rig — not a child of the spinning earth mesh. Without this sync the
    // globe rotates under a frozen aircraft layer. Match the earth mesh's current
    // orientation (axial tilt + spin) every frame so markers track the surface.
    if (this._rig && this._rig.earth) this.aircraftLayer.quaternion.copy(this._rig.earth.quaternion);
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
    if (this._meteors) {
      this.meteorLayer.remove(this._meteors.group);
      this._meteors.dispose();
    }
    if (this._issMarker) {
      this.issLayer.remove(this._issMarker.object3d);
      this._issMarker.dispose();
    }
    if (this._hud) this._hud.dispose();
    this._rig = null;
    this._hud = null;
    this._aircraftLayer = null;
    this._eclipseRig = null;
    this._aurora = null;
    this._meteors = null;
    this._issMarker = null;
    this._flightService = null;
    this._built = false;
  }

  dispose() {
    this._disposeAssets();
    if (this.controls && this.controls.dispose) this.controls.dispose();
    if (this._issClickHandler && this._issDomElement && this._issDomElement.removeEventListener) {
      this._issDomElement.removeEventListener('click', this._issClickHandler);
      this._issDomElement.removeEventListener('pointerdown', this._issPointerDownHandler);
    }
  }
}
