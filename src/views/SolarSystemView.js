import * as THREE from 'three';
import { PlanetFactory } from '../planets/PlanetFactory.js';
import { InfoPanel } from '../ui/InfoPanel.js';
import { TimeControls } from '../ui/TimeControls.js';
import { PlanetList } from '../ui/PlanetList.js';
import { PlanetStrip } from '../ui/PlanetStrip.js';
import { InteractionManager } from '../controls/InteractionManager.js';
import { init as initTts, speakBody, cancel as cancelSpeech } from '../audio/tts.js';

/**
 * SolarSystemView wraps the original solar-system app behind the frozen View
 * interface. It owns the solar scene/camera/controls/lighting (via SceneManager),
 * the planet factory, all overlay UI, picking, the simulation clock/speed, and the
 * camera focus/reset animation that used to live in main.js's god-loop.
 *
 * It also OWNS the shared render core (its SceneManager constructs the one
 * WebGLRenderer + EffectComposer), which ViewManager borrows via getRenderCore()
 * and lends to EarthView — so only one WebGL context ever exists (REQ-385).
 */
export class SolarSystemView {
  /**
   * @param {Object} opts
   * @param {Object} opts.sceneManager - SceneManager (owns renderer/composer/scene/camera/controls).
   * @param {Object} [opts.planetFactory] - Defaults to a real PlanetFactory on the solar scene.
   * @param {Function} [opts.createInfoPanel]
   * @param {Function} [opts.createPlanetList]
   * @param {Function} [opts.createPlanetStrip]
   * @param {Function} [opts.createTimeControls]
   * @param {Function} [opts.createInteraction]
   * @param {Window} [opts.win]
   */
  constructor({
    sceneManager,
    planetFactory,
    createInfoPanel = () => new InfoPanel(),
    createPlanetList = () => new PlanetList(),
    createPlanetStrip = () => new PlanetStrip(),
    createTimeControls = (api) => new TimeControls(api),
    createInteraction = (sm, pf) => new InteractionManager(sm.camera, sm.scene, sm.renderer, pf),
    win = typeof window !== 'undefined' ? window : undefined,
  } = {}) {
    this.sceneManager = sceneManager;
    this.planetFactory = planetFactory || new PlanetFactory(sceneManager.scene, sceneManager);
    this._createInfoPanel = createInfoPanel;
    this._createPlanetList = createPlanetList;
    this._createPlanetStrip = createPlanetStrip;
    this._createTimeControls = createTimeControls;
    this._createInteraction = createInteraction;
    this._win = win;

    this._simTime = 0;
    this._timeSpeed = 1;
    this._isPlaying = true;
    this._focusedKey = null;
    // Inactive until onEnter — so a #/earth deep-link, whose solar UI still builds
    // when textures finish loading, keeps that UI hidden behind the Earth view.
    this._active = false;
    this._ui = null;
    this._onEarthSelect = null;

    // Replaces the old window.__solarSim global — the sim API now travels by
    // constructor injection into TimeControls, not a global (grep-confirmed unused).
    this.simApi = {
      sceneManager: this.sceneManager,
      planetFactory: this.planetFactory,
      getSimTime: () => this._simTime,
      setSimTime: (t) => { this._simTime = t; },
      setTimeSpeed: (s) => { this._timeSpeed = s; },
      getTimeSpeed: () => this._timeSpeed,
      togglePlay: () => { this._isPlaying = !this._isPlaying; },
      isPlaying: () => this._isPlaying,
    };

    // Loading callbacks (wired by main.js to the LoadingScreen).
    this.onLoadProgress = null;
    this.onLoadComplete = null;
    if (this.planetFactory) {
      this.planetFactory.onLoadProgress = (loaded, total) => this.onLoadProgress && this.onLoadProgress(loaded, total);
      this.planetFactory.onLoadComplete = () => {
        this.buildUI();
        if (this.onLoadComplete) this.onLoadComplete();
      };
    }
  }

  /**
   * Register the callback ViewManager uses to begin a transition into EARTH.
   * @param {Function} fn
   */
  setEarthSelectHandler(fn) {
    this._onEarthSelect = fn;
  }

  /**
   * Build the overlay UI + picking once textures have loaded. Idempotent.
   */
  buildUI() {
    if (this._ui) return;
    // Binds the speech backend and restores the persisted mute state. Speaking
    // still only ever happens from a tap, so this starts no audio by itself.
    initTts();
    const infoPanel = this._createInfoPanel();
    const planetList = this._createPlanetList();
    const planetStrip = this._createPlanetStrip();
    const timeControls = this._createTimeControls(this.simApi);
    const interaction = this._createInteraction(this.sceneManager, this.planetFactory);

    planetList.onSelect = (key) => this._select(key);
    // The mobile strip is a third mouth on the same selection path — a strip tap
    // must be indistinguishable from a sidebar click or a 3D tap (REQ-MOB-303).
    planetStrip.onSelect = (key) => this._select(key);
    interaction.onSelect = (key) => this._select(key);
    interaction.onDeselect = () => this._deselect();
    infoPanel.onClose = () => this._deselect();

    this._ui = { infoPanel, planetList, planetStrip, timeControls, interaction };
    this._bindKeys();
    if (!this._active) {
      // A #/earth deep-link builds this UI (textures finish loading) while
      // EarthView is the active view. Hiding the DOM panels isn't enough —
      // the freshly constructed InteractionManager/OrbitControls both default
      // to enabled, so without this they keep raycasting/orbiting the dormant
      // solar camera on every pointer move over the shared canvas, surfacing
      // tooltips (Sun, background stars, ...) for a scene the user can't see.
      this._setUiVisible(false);
      interaction.enabled = false;
      if (this.sceneManager.controls) this.sceneManager.controls.enabled = false;
    }
  }

  /**
   * Wire the solar-view keyboard shortcuts, guarded so they only act while this
   * view is active (EarthView owns input in the EARTH state).
   */
  _bindKeys() {
    if (!this._win || this._keysBound) return;
    this._keysBound = true;
    this._win.addEventListener('keydown', (e) => {
      if (!this._active) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.simApi.togglePlay();
        this._ui.timeControls.updatePlayButton();
      } else if (e.code === 'KeyR' || e.code === 'Escape') {
        this._deselect();
      } else if (e.code === 'Home') {
        e.preventDefault();
        this._simTime = 0;
        this._ui.timeControls.updateDate(0);
      }
    });
  }

  /**
   * Select a body. Earth is special: it opens the dedicated Earth view (REQ-310)
   * rather than merely focusing the camera. Every other body focuses as before.
   * @param {string} key
   */
  _select(key) {
    if (key === 'earth' && this._onEarthSelect) {
      this._onEarthSelect();
      return;
    }
    const planet = this.planetFactory.planets[key];
    if (!planet) return;
    // Both callers of _select are tap handlers, so this is a user-gesture call
    // stack — which is what lets iOS start speech at all (spec A-104). Narrate
    // the body the panel resolved, so moons/stars read their own facts.
    speakBody(this._ui.infoPanel.show(key, planet.data));
    this._ui.planetList.setActive(key);
    this._ui.planetStrip.setActive(key);
    this._ui.interaction.selectedPlanet = key;
    this._focusedKey = key;
    this.sceneManager.focusPlanet(planet.mesh.position, planet.data.displayRadius);
    this.planetFactory.onFocus(key);
  }

  /**
   * Return to the overview: hide the panel, clear selection, reset the camera.
   */
  _deselect() {
    if (!this._ui) return;
    cancelSpeech();
    this._ui.infoPanel.hide();
    this._ui.planetList.clearActive();
    this._ui.planetStrip.clearActive();
    this._ui.interaction.selectedPlanet = null;
    this._focusedKey = null;
    this.sceneManager.resetCamera();
    this.planetFactory.onDefocus();
  }

  /**
   * Toggle overlay visibility as a block.
   * @param {boolean} visible
   */
  _setUiVisible(visible) {
    if (!this._ui) return;
    const d = visible ? '' : 'none';
    const { infoPanel, planetList, planetStrip, timeControls } = this._ui;
    if (infoPanel.el) infoPanel.el.style.display = d;
    if (planetList.el) planetList.el.style.display = d;
    if (planetList._toggleBtn) planetList._toggleBtn.style.display = d;
    if (planetStrip.el) planetStrip.el.style.display = d;
    if (timeControls.el) timeControls.el.style.display = d;
  }

  // --- frozen View interface (ANCHOR: SPEC-EARTH-002 depends on this shape) ---

  // @MX:ANCHOR: [AUTO] mount(renderer, composer) — frozen View interface. Solar
  // already owns the render core, so this is identity; EarthView's mount stores
  // the borrowed core. Interface parity is what SPEC-EARTH-002 builds against.
  // @MX:REASON: [AUTO] Both views must expose an identical lifecycle so the two
  // concrete views are interchangeable behind ViewManager's dispatch.
  mount() {}

  unmount() {}

  /**
   * @param {string|null} fromState - Prior state; a return from EARTH restores the overview camera.
   */
  onEnter(fromState) {
    this._active = true;
    this._setUiVisible(true);
    if (this._ui) this._ui.interaction.enabled = true;
    if (this.sceneManager.controls) this.sceneManager.controls.enabled = true;
    if (fromState === 'EARTH') this.sceneManager.resetCamera();
  }

  onExit() {
    this._active = false;
    this._setUiVisible(false);
    if (this._ui) this._ui.interaction.enabled = false;
    if (this.sceneManager.controls) this.sceneManager.controls.enabled = false;
    if (this.sceneManager.setHoveredObject) this.sceneManager.setHoveredObject(null);
  }

  /**
   * @param {number} delta - Frame delta in seconds.
   */
  update(delta) {
    if (this._isPlaying) {
      this._simTime += delta * this._timeSpeed;
      this.planetFactory.update(this._simTime, delta);
    }

    if (this._focusedKey) {
      const planet = this.planetFactory.planets[this._focusedKey];
      if (planet) {
        if (planet.pivot) {
          const worldPos = new THREE.Vector3();
          planet.mesh.getWorldPosition(worldPos);
          this.sceneManager.controls.target.copy(worldPos);
        } else {
          this.sceneManager.controls.target.copy(planet.mesh.position);
        }
      }
    }

    this.sceneManager.stepCamera(delta);
    this.sceneManager.controls.update();
    if (this._ui && this._ui.timeControls) this._ui.timeControls.updateDate(this._simTime);
  }

  /**
   * @returns {{scene: THREE.Scene, camera: THREE.Camera}}
   */
  getScenePass() {
    return { scene: this.sceneManager.scene, camera: this.sceneManager.camera };
  }

  onResize() {
    // Solar camera aspect is handled by the shared renderCore.resize (== SceneManager.resize).
  }

  /**
   * The shared render core (renderer/composer/passes/perf/render) ViewManager drives.
   * @returns {Object}
   */
  getRenderCore() {
    return this.sceneManager;
  }

  dispose() {
    if (this._ui && this._ui.interaction) this._ui.interaction.dispose();
    this.sceneManager.dispose();
  }
}
