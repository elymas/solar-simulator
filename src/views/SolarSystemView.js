import * as THREE from 'three';
import { PlanetFactory } from '../planets/PlanetFactory.js';
import { InfoPanel } from '../ui/InfoPanel.js';
import { TimeControls } from '../ui/TimeControls.js';
import { PlanetList } from '../ui/PlanetList.js';
import { PlanetStrip } from '../ui/PlanetStrip.js';
import { InteractionManager } from '../controls/InteractionManager.js';
import { EventBanner } from '../ui/EventBanner.js';
import { createSolarBelts } from '../effects/Belts.js';
import { AlignmentTracker, ALIGNMENT_PLANET_KEYS } from '../utils/alignment.js';
import { BELT_DATA } from '../planets/planetData.js';
import { STR } from '../ui/strings.js';
import { init as initTts, speak, speakBody, cancel as cancelSpeech } from '../audio/tts.js';
import { init as initSfx, unlockAudio, playFanfare } from '../audio/sfx.js';
import { Celebration, SPARKLE, TWINKLE } from '../effects/Celebration.js';
import { RocketTrip } from '../play/RocketTrip.js';
import { SizeCompare } from '../play/SizeCompare.js';
import { StickerBook } from '../play/StickerBook.js';
import { createMissionEngine } from '../play/missions.js';
import { createStickerStore } from '../play/stickers.js';
import { emitPlayEvent, onPlayEvent } from '../play/playEvents.js';

const RAD_TO_DEG = 180 / Math.PI;


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
   * @param {Function} [opts.createBelts]
   * @param {Function} [opts.createEventBanner]
   * @param {Function} [opts.getDate] - Real calendar clock for the daily missions (A-505).
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
    createBelts = () => createSolarBelts(),
    createEventBanner = () => new EventBanner(),
    createCelebration = (opts) => new Celebration(opts),
    createRocket = (opts) => new RocketTrip(opts),
    getDate = () => new Date(),
    win = typeof window !== 'undefined' ? window : undefined,
  } = {}) {
    this.sceneManager = sceneManager;
    this.planetFactory = planetFactory || new PlanetFactory(sceneManager.scene, sceneManager);
    this._createInfoPanel = createInfoPanel;
    this._createPlanetList = createPlanetList;
    this._createPlanetStrip = createPlanetStrip;
    this._createTimeControls = createTimeControls;
    this._createInteraction = createInteraction;
    this._createEventBanner = createEventBanner;
    this._createCelebration = createCelebration;
    this._createRocket = createRocket;
    this._getDate = getDate;
    this._win = win;

    // Play layer (SPEC-PLAY-001 M3/M4/M5), built with the UI in buildUI().
    this._celebration = null;
    this._praise = null;
    this._rocket = null;
    this._sizeCompare = null;
    this._stickerBook = null;
    this._store = null;
    this._missions = null;
    this._missionDate = null;
    this._unsubscribePlay = null;

    // Alignment detection state (REQ-EVT-304). Both the longitude buffer and the
    // tracker's result object are allocated once, so the per-frame path writes
    // numbers into existing memory and allocates nothing — the same rule the
    // comet tail and the belts follow.
    this._alignment = new AlignmentTracker();
    this._longitudes = new Float64Array(ALIGNMENT_PLANET_KEYS.length);

    // Belts are scene contents, so they mount here rather than in SceneManager,
    // which owns only the render core. They are deliberately NOT registered in
    // planetFactory.planets: that registry is what InteractionManager builds its
    // raycast target set from, and keeping a few thousand rocks out of it is how
    // REQ-EVT-203 is satisfied — by construction, not by a filter.
    this.belts = createBelts();
    for (const belt of this.belts) sceneManager.scene.add(belt.mesh);
    // A constrained-tier device (SPEC-MOBILE-001) never gets the full field at
    // all — it boots where the degrader would have taken it anyway (REQ-EVT-204).
    if (sceneManager.qualityTier === 'constrained') this.setBeltsShed(true);
    sceneManager.onBeltsShed = (shed) => this.setBeltsShed(shed);

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
   * Thin the belts out under frame-budget pressure, or fill them back in
   * (REQ-EVT-204). This is a draw-range change only: it touches no camera, no
   * selection and no geometry, so it is safe to fire at any moment — including
   * while a body is focused and the camera is following it.
   * @param {boolean} shed
   */
  setBeltsShed(shed) {
    for (const belt of this.belts) belt.setReduced(shed);
  }

  /**
   * Build the overlay UI + picking once textures have loaded. Idempotent.
   */
  buildUI() {
    if (this._ui) return;
    // Binds the speech backend and restores the persisted mute state. Speaking
    // still only ever happens from a tap, so this starts no audio by itself.
    initTts();
    // Strictly after initTts: sfx delegates its mute question to tts.js, whose
    // module default is "unmuted" until init() has read the persisted setting.
    // Priming the effects channel first would let the very first celebration
    // sound in a household that had already turned "소리" off.
    initSfx();
    const infoPanel = this._createInfoPanel();
    const planetList = this._createPlanetList();
    const planetStrip = this._createPlanetStrip();
    const timeControls = this._createTimeControls(this.simApi);
    const interaction = this._createInteraction(this.sceneManager, this.planetFactory);
    const eventBanner = this._createEventBanner();

    planetList.onSelect = (key) => this._select(key);
    // The mobile strip is a third mouth on the same selection path — a strip tap
    // must be indistinguishable from a sidebar click or a 3D tap (REQ-MOB-303).
    planetStrip.onSelect = (key) => this._select(key);
    interaction.onSelect = (key) => this._select(key);
    interaction.onDeselect = () => this._deselect();
    infoPanel.onClose = () => this._deselect();

    this._ui = { infoPanel, planetList, planetStrip, timeControls, interaction, eventBanner };
    this._buildPlayLayer();

    // Both entry points run inside a real tap, so unlocking here is what lets
    // iOS start the comparison's narration and the rocket's arrival sound.
    infoPanel.onCompare = (key, data) => {
      unlockAudio();
      this._sizeCompare.open(key, data);
    };
    infoPanel.onRocket = (key) => {
      unlockAudio();
      this.launchRocket(key);
    };
    infoPanel.canLaunch = (key) => this.canLaunchRocket(key);

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
   * Build the play layer (SPEC-PLAY-001): the pooled celebration and the rocket,
   * plus the camera-arrival subscription that fires the celebration.
   */
  _buildPlayLayer() {
    const reducedMotion = this._prefersReducedMotion();
    const scene = this.sceneManager.scene;
    this._celebration = this._createCelebration({ scene, reducedMotion });
    // The praise pool is deliberately SILENT: its sound is playFanfare(), fired
    // from _celebratePraise so the reward is heard even when there is no body on
    // screen to sparkle at. Letting the burst own it (as the arrival celebration
    // does) would mean a mission completed from the Earth view made no sound.
    this._praise = new Celebration({ scene, reducedMotion, sounds: {} });
    // The trip is an overlay now, so it needs no scene, no body lookup and no
    // celebration pool: arrival sparkle still fires, through the camera-arrival
    // subscription below, when _frameAfterArrival settles on the destination.
    this._rocket = this._createRocket({ reducedMotion });
    this.sceneManager.onFocusArrive = () => this._onFocusArrive();

    this._sizeCompare = new SizeCompare({ reducedMotion });
    this._store = createStickerStore();
    this._stickerBook = new StickerBook({
      getEngine: () => this._missionEngine(),
      store: this._store,
    });
    this._unsubscribePlay = onPlayEvent((event) => this._onPlayEvent(event));
  }

  // @MX:NOTE: [AUTO] The mission engine freezes its date at construction, so the
  // rollover is handled by REPLACING it, not by mutating it. Resolving lazily per
  // event is also what makes acceptance §3 true for free: an event fired at
  // 23:59:59 is judged by yesterday's mission set, one at 00:00:00 by today's.
  /**
   * The engine for the child's current real calendar day (A-505).
   * @returns {Object}
   */
  _missionEngine() {
    const date = localDateString(this._getDate());
    if (!this._missions || this._missionDate !== date) {
      this._missionDate = date;
      this._missions = createMissionEngine({ store: this._store, date });
    }
    return this._missions;
  }

  /**
   * Feed one normalized play event to the day's missions (REQ-PLAY-402).
   * @param {{type: string}} event
   */
  _onPlayEvent(event) {
    // Before the mission gate below: the camera has to come back from the
    // journey framing whether or not this arrival happened to tick a mission.
    if (event.type === 'rocket-arrived') this._frameAfterArrival(event.body);
    const matched = this._missionEngine().handleEvent(event);
    // A re-completion still comes back matched, but nothing changed: the sticker
    // was already earned and the day already ticked. Praise MAY fire there
    // (AC-PLAY-404); firing it on every later tap of the same planet would turn
    // the reward into wallpaper, so the completion moment stays the once-a-day one.
    if (!matched.some((mission) => mission.firstToday)) return;
    this._stickerBook.refresh();
    // The completing body travels IN the event (`select`/`rocket-arrived`/
    // `size-compare` all carry one), which is what keeps the sparkle honest:
    // reading `_focusedKey` here instead made the burst depend on statements that
    // run after the emit, so it landed on the PREVIOUS pick — or nowhere at all on
    // the first tap of a session.
    this._celebratePraise(event.body);
  }

  /**
   * The reward: one fanfare, one spoken praise, one sparkle burst (REQ-PLAY-404).
   * Fires once per completion moment however many missions matched the event.
   * @param {string} [bodyKey] - The body that completed the mission. Bodyless
   *   completions (`view-enter`) fall back to whatever is focused; a body that is
   *   not in the scene sparkles nowhere, and the fanfare still plays.
   */
  _celebratePraise(bodyKey = this._focusedKey) {
    playFanfare();
    speak(STR.playPraise);
    const target = bodyKey ? this._getBody(bodyKey) : null;
    if (target) this._praise.burst(target.position, SPARKLE, target.radius);
  }

  /**
   * Same idiom as ViewManager's transition check, injectable window for tests.
   * @returns {boolean}
   */
  _prefersReducedMotion() {
    return !!(this._win && this._win.matchMedia && this._win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /**
   * Live world position + display radius of a body, or null when the scene has
   * no such body. The rocket calls this every frame for its destination.
   * @param {string} key
   * @returns {{position: THREE.Vector3, radius: number}|null}
   */
  _getBody(key) {
    const planet = this.planetFactory.planets[key];
    if (!planet) return null;
    // World, not local: moons hang off an orbiting pivot.
    const position = planet.mesh.getWorldPosition(new THREE.Vector3());
    return { position, radius: planet.data.displayRadius };
  }

  /**
   * The camera finished flying to the selected body (REQ-PLAY-301/302): one
   * burst, one sound, at wherever the body has drifted to by now.
   */
  _onFocusArrive() {
    if (!this._focusedKey || !this._celebration) return;
    const target = this._getBody(this._focusedKey);
    if (!target) return;
    const isStar = Boolean(this.planetFactory.planets[this._focusedKey].isStar);
    this._celebration.burst(target.position, isStar ? TWINKLE : SPARKLE, target.radius);
  }

  /**
   * Whether the "로켓 발사" entry point should be offered for a body.
   * @param {string} key
   * @returns {boolean}
   */
  canLaunchRocket(key) {
    return Boolean(this._rocket && this._rocket.canLaunch(key));
  }

  /**
   * Launch the rocket journey to a body (REQ-PLAY-201). The entry-point button
   * calls this; the view owns the scene, clock and cancel seams.
   * @param {string} key
   * @returns {boolean}
   */
  // @MX:NOTE: [AUTO] No camera move here any more. The journey used to be drawn
  // into this scene and framed with this camera, which a phone's full-screen info
  // panel hid completely — the button read as doing nothing. The trip now opens
  // its own overlay, so the view's only job is to hand the destination over.
  launchRocket(key) {
    return Boolean(this._rocket && this._rocket.launch(key));
  }

  /**
   * Settle the camera back onto the body the rocket just reached, so the trip
   * ends looking at the destination rather than at empty space.
   * @param {string} key
   */
  _frameAfterArrival(key) {
    const planet = this.planetFactory.planets[key];
    if (!planet) return;
    this._focusedKey = key;
    this.sceneManager.focusPlanet(planet.mesh.getWorldPosition(new THREE.Vector3()), planet.data.displayRadius);
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
    // One gesture, both audio channels (plan §A.6). unlockAudio() resumes the
    // effects context and speakBody() below runs in the same tap call stack —
    // the two things iOS each require. Ordering is load-bearing: a play() that
    // beats resume() buys permanent silence for the session, not an error.
    unlockAudio();
    if (this._rocket) this._rocket.cancel(); // REQ-PLAY-204: a new pick ends the flight
    if (key === 'earth' && this._onEarthSelect) {
      emitPlayEvent('select', { body: key });
      this._onEarthSelect();
      return;
    }
    const belt = this.belts.find((b) => b.config.name === key);
    if (belt) {
      this._selectBelt(key, belt);
      return;
    }
    const planet = this.planetFactory.planets[key];
    if (!planet) return;
    // Both callers of _select are tap handlers, so this is a user-gesture call
    // stack — which is what lets iOS start speech at all (spec A-104). Narrate
    // the body the panel resolved, so moons/stars read their own facts.
    speakBody(this._ui.infoPanel.show(key, planet.data));
    // Strictly after the narration: a selection that also completes a mission
    // must end with the praise, not with the body's fact talking over it — the
    // TTS channel keeps only the newest utterance (tts.js speak()).
    emitPlayEvent('select', { body: key });
    this._ui.planetList.setActive(key);
    this._ui.planetStrip.setActive(key);
    this._ui.interaction.selectedPlanet = key;
    this._focusedKey = key;
    this.sceneManager.focusPlanet(planet.mesh.position, planet.data.displayRadius);
    this.planetFactory.onFocus(key);
  }

  /**
   * Select a belt (REQ-EVT-205). Reached only from the sidebar or the strip —
   * the instanced rocks are never in the raycast set — so this is the whole
   * selection path for a band.
   * @param {string} key - Belt key, matching its Belts.js config name.
   * @param {Object} belt - The Belt instance, which owns the band radii.
   */
  _selectBelt(key, belt) {
    const { innerRadius, outerRadius } = belt.config;
    speakBody(this._ui.infoPanel.show(key, BELT_DATA[key]));
    // Same contract as the planet path in _select: the belt IS a selectable body
    // in the list and the strip, so selecting one has to reach the mission engine
    // too. Without this a belt mission could never complete — the branch above
    // returns before _select's own emit. Ordered after the narration for the same
    // reason it is there: the praise must not talk over the body's fact.
    emitPlayEvent('select', { body: key });
    this._ui.planetList.setActive(key);
    this._ui.planetStrip.setActive(key);
    this._ui.interaction.selectedPlanet = key;
    // Nothing to follow: a band does not orbit, and leaving the previous focus
    // in place would let that planet drag the camera off the ring we just framed.
    this._focusedKey = null;
    this.planetFactory.onDefocus();
    // Aim at the middle of the band and pull back by its half-width, so the
    // frame holds the ring rather than a point on it.
    const midRadius = (innerRadius + outerRadius) / 2;
    this.sceneManager.focusPlanet(new THREE.Vector3(midRadius, 0, 0), (outerRadius - innerRadius) / 2);
  }

  /**
   * Return to the overview: hide the panel, clear selection, reset the camera.
   */
  _deselect() {
    if (!this._ui) return;
    cancelSpeech();
    if (this._rocket) this._rocket.cancel(); // REQ-PLAY-204
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
    const { infoPanel, planetList, planetStrip, timeControls, eventBanner } = this._ui;
    if (infoPanel.el) infoPanel.el.style.display = d;
    if (planetList.el) planetList.el.style.display = d;
    if (planetList._toggleBtn) planetList._toggleBtn.style.display = d;
    if (planetStrip.el) planetStrip.el.style.display = d;
    if (timeControls.el) timeControls.el.style.display = d;
    // Without this a banner raised on the last solar frame would hang over the
    // Earth view for the rest of its display window.
    if (eventBanner.el) eventBanner.el.style.display = d;
    // The play overlays are solar-view chrome too: neither may survive a switch
    // to the Earth view sitting on top of a scene it does not describe.
    if (this._stickerBook) this._stickerBook.setVisible(visible);
    if (!visible && this._sizeCompare) this._sizeCompare.close();
  }

  /**
   * Sample the planets' heliocentric longitudes and celebrate an alignment that
   * has just formed (REQ-EVT-303, REQ-EVT-304).
   *
   * Longitudes are read off the positions PlanetFactory wrote this frame rather
   * than re-solving the orbits: `OrbitalMechanics` puts every body on the XZ
   * plane, so the longitude is just atan2(z, x).
   */
  _checkAlignment() {
    const planets = this.planetFactory.planets;
    for (let i = 0; i < ALIGNMENT_PLANET_KEYS.length; i++) {
      const planet = planets[ALIGNMENT_PLANET_KEYS[i]];
      // A body the factory has not built yet (textures still loading) means the
      // sky is incomplete, and half a sky cannot be judged aligned.
      if (!planet) return;
      const { x, z } = planet.mesh.position;
      this._longitudes[i] = Math.atan2(z, x) * RAD_TO_DEG;
    }
    if (this._alignment.update(this._longitudes) === 'enter') {
      this._ui.eventBanner.show(STR.eventAlignment);
    }
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
    emitPlayEvent('view-enter', { view: 'SOLAR' });
    this._setUiVisible(true);
    if (this._ui) this._ui.interaction.enabled = true;
    if (this.sceneManager.controls) this.sceneManager.controls.enabled = true;
    if (fromState === 'EARTH') this.sceneManager.resetCamera();
  }

  onExit() {
    this._active = false;
    if (this._rocket) this._rocket.cancel(); // REQ-PLAY-204: no flight across a view switch
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
      for (const belt of this.belts) belt.update(this._simTime);
      if (this._ui) this._checkAlignment();
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
    // Play layer rides the app's one rAF: the pools return to rest. The rocket
    // trip is not here — it animates inside its own overlay, on its own clock.
    if (this._celebration) this._celebration.update(delta);
    if (this._praise) this._praise.update(delta);
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
    for (const belt of this.belts) belt.dispose();
    if (this._unsubscribePlay) this._unsubscribePlay();
    if (this._stickerBook) this._stickerBook.dispose();
    if (this._sizeCompare) this._sizeCompare.dispose();
    if (this._rocket) this._rocket.dispose();
    if (this._praise) this._praise.dispose();
    if (this._celebration) this._celebration.dispose();
    this.sceneManager.dispose();
  }
}

// Local calendar date, not UTC: "daily" means the child's real day (A-505), and
// a UTC key would roll over mid-evening for anyone east of Greenwich.
function localDateString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
