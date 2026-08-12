import * as THREE from 'three';
import { DEGRADE_STEPS, EARTH_DEGRADE_STEPS } from '../utils/performance.js';

/**
 * The four states of the app's view machine. TO_EARTH / TO_SOLAR are the
 * in-flight transition states; SOLAR / EARTH are the resting states.
 */
export const VIEW_STATES = {
  SOLAR: 'SOLAR',
  TO_EARTH: 'TO_EARTH',
  EARTH: 'EARTH',
  TO_SOLAR: 'TO_SOLAR',
};

// @MX:ANCHOR: [AUTO] Legal state graph for the whole app. Every render/input path
// funnels through the ViewManager transitions guarded by this table; SPEC-EARTH-002
// (F5/F6/F7) mounts onto the EARTH state it defines.
// @MX:REASON: [AUTO] An illegal transition (e.g. TO_EARTH -> TO_EARTH, or SOLAR ->
// EARTH skipping the fade) would swap views mid-render or double-run a transition,
// leaving stale passes pointed at a disposed scene (black screen).
const LEGAL_TRANSITIONS = {
  [VIEW_STATES.SOLAR]: [VIEW_STATES.TO_EARTH],
  [VIEW_STATES.TO_EARTH]: [VIEW_STATES.EARTH],
  [VIEW_STATES.EARTH]: [VIEW_STATES.TO_SOLAR],
  [VIEW_STATES.TO_SOLAR]: [VIEW_STATES.SOLAR],
};

/**
 * Whether a state transition is permitted. Pure — no side effects.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
  return (LEGAL_TRANSITIONS[from] || []).includes(to);
}

/**
 * Map a URL hash to a target view name. `#/earth` -> 'earth', everything else
 * (including `#/`, empty, unknown) -> 'solar'. Pure.
 * @param {string} hash
 * @returns {'earth'|'solar'}
 */
export function hashToView(hash) {
  return (hash || '').replace(/^#/, '') === '/earth' ? 'earth' : 'solar';
}

/**
 * Map a view name to its canonical hash. Pure.
 * @param {'earth'|'solar'} view
 * @returns {string}
 */
export function viewToHash(view) {
  return view === 'earth' ? '#/earth' : '#/';
}

/**
 * ViewManager owns the single rAF loop, the shared clock, window resize, and the
 * SOLAR/TO_EARTH/EARTH/TO_SOLAR state machine + hash routing + fade transition.
 * It retargets the shared composer's passes to the active view each frame and
 * drives the SIM-001 perf-degrader, so exactly one WebGL context serves both views
 * (REQ-385). Render-core and views are injectable so the state/hash/lifecycle
 * logic is unit-testable without a real WebGL context.
 */
export class ViewManager {
  /**
   * @param {Object} opts
   * @param {Object} opts.solarView - View implementing the frozen View interface.
   * @param {Object} opts.earthView - View implementing the frozen View interface.
   * @param {Object} [opts.renderCore] - {renderer, composer, renderPass, outlinePass,
   *   render(scene,camera), _monitorPerformance?, _applyBudgetDegradation?, _degraded?}.
   *   Defaults to solarView.getRenderCore().
   * @param {Window} [opts.win] - Injected for hashchange/keydown/resize/matchMedia/timers.
   * @param {Function} [opts.raf] - requestAnimationFrame; injected as no-op in tests.
   * @param {number} [opts.transitionMs] - Total fade duration (REQ-320).
   */
  constructor({ solarView, earthView, renderCore, win, raf, transitionMs = 400 } = {}) {
    this.solarView = solarView;
    this.earthView = earthView;
    this.renderCore = renderCore || (solarView && solarView.getRenderCore && solarView.getRenderCore());
    this._win = win || (typeof window !== 'undefined' ? window : undefined);
    this._raf = raf || (this._win && this._win.requestAnimationFrame.bind(this._win));
    this.transitionMs = transitionMs;

    this.state = VIEW_STATES.SOLAR;
    this.activeView = solarView;
    this._clock = new THREE.Clock();
    this._running = true;
    this._overlay = null;
  }

  /**
   * Bootstrap: mount views on the shared core, honor a `#/earth` deep-link, wire
   * hashchange / Escape / resize / WebGL-context-loss, and start the rAF loop.
   */
  start() {
    if (this.solarView.mount) this.solarView.mount(this.renderCore.renderer, this.renderCore.composer);
    if (this.earthView.mount) this.earthView.mount(this.renderCore.renderer, this.renderCore.composer);
    if (this.earthView.setExitRequestHandler) {
      this.earthView.setExitRequestHandler(() => this.exitToSolar());
    }
    if (this.solarView.setEarthSelectHandler) {
      this.solarView.setEarthSelectHandler(() => this.enterEarth());
    }

    this._initFromHash();
    this._wireEvents();
    this._loop = this._loop.bind(this);
    this._raf(this._loop);
  }

  /**
   * Enter the EARTH view on initial load if the hash is a `#/earth` deep-link,
   * else enter the solar overview. The deep-link path is instant (no fade) since
   * there is no prior frame to cross-fade from.
   */
  _initFromHash() {
    const target = hashToView(this._win ? this._win.location.hash : '');
    if (target === 'earth') {
      this.activeView = this.earthView;
      this.earthView.onEnter(null);
      this.state = VIEW_STATES.EARTH;
      this._setHash('#/earth');
    } else {
      this.solarView.onEnter(null);
      this.state = VIEW_STATES.SOLAR;
    }
  }

  /**
   * Wire the window-level listeners this manager owns.
   */
  _wireEvents() {
    if (!this._win) return;
    this._win.addEventListener('hashchange', () => this._onHashChange());
    this._win.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === VIEW_STATES.EARTH) this.exitToSolar();
    });
    this._win.addEventListener('resize', () => this._onResize());

    // @MX:WARN: [AUTO] WebGL context loss handler. preventDefault() on 'lost' is
    // mandatory — it is what permits the browser to restore the context; without
    // it the canvas stays black permanently.
    // @MX:REASON: [AUTO] The Earth rig adds heavy textures/materials, raising loss
    // probability on constrained hardware. Pausing the loop on loss and resuming on
    // restore avoids rendering into a dead context (black screen).
    const canvas = this.renderCore.renderer.domElement;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this._running = false;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this._running = true;
    });
  }

  /**
   * The rAF-driven frame. Always reschedules so a paused loop can resume after a
   * context restore; skips the frame body while paused.
   */
  _loop() {
    this._raf(this._loop);
    if (!this._running) return;
    this.tick(this._clock.getDelta());
  }

  /**
   * One frame of work: update the active view, retarget the shared composer's
   * passes to it, run the perf-degrader on the shared core, then render.
   * Public so tests can drive frames deterministically.
   * @param {number} delta - Frame delta in seconds.
   */
  tick(delta) {
    this.activeView.update(delta);
    const { scene, camera } = this.activeView.getScenePass();
    const rc = this.renderCore;
    // @MX:NOTE: [AUTO] Retarget the shared RenderPass/OutlinePass every frame — they
    // were constructed bound to the solar scene/camera; without this the composer
    // keeps rendering the solar scene while the Earth view is active.
    if (rc.renderPass) {
      rc.renderPass.scene = scene;
      rc.renderPass.camera = camera;
    }
    if (rc.outlinePass) {
      rc.outlinePass.renderScene = scene;
      rc.outlinePass.renderCamera = camera;
    }
    if (rc._monitorPerformance) rc._monitorPerformance(delta);
    if (rc._applyBudgetDegradation && !rc._degraded) rc._applyBudgetDegradation(delta * 1000);
    rc.render(scene, camera);
  }

  /**
   * Request a transition into the Earth view (from an explicit Earth selection).
   * No-op unless currently resting in SOLAR.
   */
  enterEarth() {
    if (!canTransition(this.state, VIEW_STATES.TO_EARTH)) return;
    this.state = VIEW_STATES.TO_EARTH;
    this._transition({
      swap: () => {
        this.solarView.onExit();
        this.activeView = this.earthView;
        this.earthView.onEnter(VIEW_STATES.SOLAR); // lazily builds the rig on first entry
        // Aurora sheds first under budget pressure while Earth is active (REQ-650).
        if (this.renderCore.setDegradeSteps) this.renderCore.setDegradeSteps(EARTH_DEGRADE_STEPS);
        this.renderCore.onAuroraShed = (shed) => {
          if (this.earthView.setAuroraShed) this.earthView.setAuroraShed(shed);
        };
        this.renderCore.onMeteorsShed = (shed) => {
          if (this.earthView.setMeteorsShed) this.earthView.setMeteorsShed(shed);
        };
        this._setHash('#/earth');
      },
      finalState: VIEW_STATES.EARTH,
    });
  }

  /**
   * Request a transition back to the solar overview (back button / Escape /
   * browser back). No-op unless currently resting in EARTH.
   */
  exitToSolar() {
    if (!canTransition(this.state, VIEW_STATES.TO_SOLAR)) return;
    this.state = VIEW_STATES.TO_SOLAR;
    this._transition({
      swap: () => {
        this.earthView.onExit();
        this.activeView = this.solarView;
        this.solarView.onEnter(VIEW_STATES.EARTH);
        // Restore the solar ladder (no aurora/meteors) and drop the Earth shed hooks.
        if (this.renderCore.setDegradeSteps) this.renderCore.setDegradeSteps(DEGRADE_STEPS);
        this.renderCore.onAuroraShed = null;
        this.renderCore.onMeteorsShed = null;
        this._setHash('#/');
      },
      finalState: VIEW_STATES.SOLAR,
    });
  }

  /**
   * Run the crossfade: fade a black overlay in, swap the active view at the
   * opaque midpoint (so the swap is invisible), fade out, then settle the state.
   * Honors prefers-reduced-motion by swapping instantly with no fade.
   * @param {Object} p
   * @param {Function} p.swap - Mutation that exchanges the active view + hash.
   * @param {string} p.finalState - Resting state to settle into.
   */
  _transition({ swap, finalState }) {
    if (this._prefersReducedMotion()) {
      swap();
      this._finalize(finalState);
      return;
    }
    const half = this.transitionMs / 2;
    const overlay = this._ensureOverlay();
    overlay.style.transition = `opacity ${half}ms linear`;
    // eslint-disable-next-line no-unused-expressions
    overlay.offsetHeight; // force reflow so the opacity change animates
    overlay.style.opacity = '1';
    this._win.setTimeout(() => {
      swap();
      overlay.style.opacity = '0';
      this._win.setTimeout(() => this._finalize(finalState), half);
    }, half);
  }

  /**
   * Settle into a resting state and hide the overlay.
   * @param {string} finalState
   */
  _finalize(finalState) {
    this.state = finalState;
    if (this._overlay) this._overlay.style.pointerEvents = 'none';
  }

  /**
   * React to a hash change (deep link or browser back/forward). Ignores changes
   * that already match the current heading, which also absorbs the echo from our
   * own programmatic hash writes.
   */
  _onHashChange() {
    const target = hashToView(this._win.location.hash);
    const heading = this.state === VIEW_STATES.EARTH || this.state === VIEW_STATES.TO_EARTH ? 'earth' : 'solar';
    if (target === heading) return;
    if (target === 'earth') this.enterEarth();
    else this.exitToSolar();
  }

  /**
   * Resize the shared renderer/composer and BOTH views' cameras, regardless of
   * which is currently active. EarthView owns its own camera (distinct from the
   * shared renderCore camera SolarSystemView uses), constructed once at its own
   * aspect ratio; a dormant view's camera must still track the real window size
   * or it goes stale and renders squished/stretched once that view is entered.
   */
  _onResize() {
    const w = this._win.innerWidth;
    const h = this._win.innerHeight;
    if (this.renderCore.resize) this.renderCore.resize(w, h);
    if (this.solarView.onResize) this.solarView.onResize(w, h);
    if (this.earthView.onResize) this.earthView.onResize(w, h);
  }

  /**
   * Whether the environment requests reduced motion (accessibility, NFR).
   * @returns {boolean}
   */
  _prefersReducedMotion() {
    return !!(this._win && this._win.matchMedia && this._win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /**
   * Create (once) the fullscreen black crossfade overlay.
   * @returns {HTMLElement}
   */
  _ensureOverlay() {
    if (this._overlay) {
      this._overlay.style.pointerEvents = 'auto';
      return this._overlay;
    }
    const el = this._win.document.createElement('div');
    el.className = 'view-transition-overlay';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      background: '#000',
      opacity: '0',
      zIndex: '500',
      pointerEvents: 'auto',
    });
    this._win.document.body.appendChild(el);
    this._overlay = el;
    return el;
  }

  /**
   * Write the URL hash without churning history for repeated writes.
   * @param {string} hash
   */
  _setHash(hash) {
    if (this._win && this._win.location.hash !== hash) {
      this._win.location.hash = hash;
    }
  }
}
