import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { ViewManager, VIEW_STATES } from '../src/core/ViewManager.js';

// --- stubs: views + render core + window, so no real WebGL context is needed ---

function makeView(tag) {
  const scene = { tag: `${tag}-scene` };
  const camera = { tag: `${tag}-camera` };
  return {
    scene,
    camera,
    mount: vi.fn(),
    unmount: vi.fn(),
    onEnter: vi.fn(),
    onExit: vi.fn(),
    update: vi.fn(),
    onResize: vi.fn(),
    dispose: vi.fn(),
    getScenePass: () => ({ scene, camera }),
  };
}

function makeCanvas() {
  const l = {};
  return {
    addEventListener: (t, f) => ((l[t] ||= []).push(f)),
    _emit: (t, e) => (l[t] || []).forEach((f) => f(e || {})),
  };
}

function makeRenderCore() {
  return {
    renderer: { domElement: makeCanvas() },
    composer: {},
    renderPass: {},
    outlinePass: {},
    _degraded: false,
    render: vi.fn(),
    resize: vi.fn(),
    _monitorPerformance: vi.fn(),
    _applyBudgetDegradation: vi.fn(),
  };
}

function makeWin({ hash = '#/', reducedMotion = false } = {}) {
  const listeners = {};
  return {
    location: { hash },
    document,
    innerWidth: 1024,
    innerHeight: 768,
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener: (t, f) => ((listeners[t] ||= []).push(f)),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    requestAnimationFrame: () => 0,
    _emit: (t, e) => (listeners[t] || []).forEach((f) => f(e || {})),
  };
}

function makeManager(winOpts) {
  const solarView = makeView('solar');
  const earthView = makeView('earth');
  const renderCore = makeRenderCore();
  const win = makeWin(winOpts);
  const vm = new ViewManager({ solarView, earthView, renderCore, win, raf: () => 0 });
  return { vm, solarView, earthView, renderCore, win };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ViewManager boot + state machine (E1, REQ-310/315)', () => {
  it('boots into SOLAR and enters the solar view', () => {
    const { vm, solarView } = makeManager();
    vm.start();
    expect(vm.state).toBe(VIEW_STATES.SOLAR);
    expect(vm.activeView).toBe(solarView);
    expect(solarView.onEnter).toHaveBeenCalledWith(null);
  });

  it('honors a #/earth deep-link by entering EARTH instantly (no overlay)', () => {
    const { vm, earthView } = makeManager({ hash: '#/earth' });
    vm.start();
    expect(vm.state).toBe(VIEW_STATES.EARTH);
    expect(vm.activeView).toBe(earthView);
    expect(earthView.onEnter).toHaveBeenCalledWith(null);
    expect(document.querySelector('.view-transition-overlay')).toBeNull();
  });

  it('ignores enterEarth() while already in EARTH (illegal-transition guard)', () => {
    const { vm, solarView, earthView } = makeManager({ reducedMotion: true });
    vm.start();
    vm.enterEarth();
    expect(vm.state).toBe(VIEW_STATES.EARTH);
    solarView.onExit.mockClear();
    earthView.onEnter.mockClear();
    vm.enterEarth(); // no-op: SOLAR->TO_EARTH not legal from EARTH
    expect(solarView.onExit).not.toHaveBeenCalled();
    expect(earthView.onEnter).not.toHaveBeenCalled();
  });

  it('ignores exitToSolar() while already in SOLAR', () => {
    const { vm, earthView } = makeManager();
    vm.start();
    vm.exitToSolar();
    expect(vm.state).toBe(VIEW_STATES.SOLAR);
    expect(earthView.onExit).not.toHaveBeenCalled();
  });
});

describe('ViewManager transitions with reduced motion (E5 branch, REQ-320)', () => {
  it('enter/exit swap instantly and drive hash + lifecycle', () => {
    const { vm, solarView, earthView, win } = makeManager({ reducedMotion: true });
    vm.start();

    vm.enterEarth();
    expect(solarView.onExit).toHaveBeenCalled();
    expect(earthView.onEnter).toHaveBeenCalledWith(VIEW_STATES.SOLAR);
    expect(vm.activeView).toBe(earthView);
    expect(vm.state).toBe(VIEW_STATES.EARTH);
    expect(win.location.hash).toBe('#/earth');

    vm.exitToSolar();
    expect(earthView.onExit).toHaveBeenCalled();
    expect(solarView.onEnter).toHaveBeenCalledWith(VIEW_STATES.EARTH);
    expect(vm.activeView).toBe(solarView);
    expect(vm.state).toBe(VIEW_STATES.SOLAR);
    expect(win.location.hash).toBe('#/');
  });
});

describe('ViewManager fade transition timing (E5, REQ-320)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('swaps the active view only at the fade midpoint, then settles', () => {
    const { vm, solarView, earthView } = makeManager(); // reducedMotion false -> fade
    vm.start();
    vm.enterEarth();

    // Immediately: transitioning, view NOT yet swapped, overlay present.
    expect(vm.state).toBe(VIEW_STATES.TO_EARTH);
    expect(vm.activeView).toBe(solarView);
    expect(document.querySelector('.view-transition-overlay')).not.toBeNull();

    vi.advanceTimersByTime(200); // midpoint (half of 400ms)
    expect(vm.activeView).toBe(earthView);
    expect(earthView.onEnter).toHaveBeenCalledWith(VIEW_STATES.SOLAR);
    expect(vm.state).toBe(VIEW_STATES.TO_EARTH); // still fading out

    vi.advanceTimersByTime(200); // fade out complete
    expect(vm.state).toBe(VIEW_STATES.EARTH);
  });
});

describe('ViewManager frame loop retargets the shared passes (REQ-315/385)', () => {
  it('points renderPass + outlinePass at the active view and renders it', () => {
    const { vm, solarView, earthView, renderCore } = makeManager({ reducedMotion: true });
    vm.start();

    vm.tick(0.016);
    const solar = solarView.getScenePass();
    expect(renderCore.renderPass.scene).toBe(solar.scene);
    expect(renderCore.renderPass.camera).toBe(solar.camera);
    expect(renderCore.outlinePass.renderScene).toBe(solar.scene);
    expect(renderCore.render).toHaveBeenCalledWith(solar.scene, solar.camera);
    expect(renderCore._monitorPerformance).toHaveBeenCalledWith(0.016);
    expect(renderCore._applyBudgetDegradation).toHaveBeenCalledWith(16);

    vm.enterEarth();
    vm.tick(0.016);
    const earth = earthView.getScenePass();
    expect(renderCore.renderPass.scene).toBe(earth.scene);
    expect(renderCore.outlinePass.renderScene).toBe(earth.scene);
  });

  it('skips the budget degrader once the core is hard-degraded (REQ-018 fallback)', () => {
    const { vm, renderCore } = makeManager();
    renderCore._degraded = true;
    vm.start();
    vm.tick(0.016);
    expect(renderCore._applyBudgetDegradation).not.toHaveBeenCalled();
    expect(renderCore.render).toHaveBeenCalled();
  });
});

describe('ViewManager WebGL context loss (E9, REQ-385)', () => {
  it('preventDefaults context loss and pauses, resumes on restore', () => {
    const { vm, renderCore } = makeManager();
    vm.start();
    const canvas = renderCore.renderer.domElement;
    const preventDefault = vi.fn();
    canvas._emit('webglcontextlost', { preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(vm._running).toBe(false);
    canvas._emit('webglcontextrestored');
    expect(vm._running).toBe(true);
  });
});

describe('ViewManager hashchange dispatch + echo suppression (E2, REQ-325)', () => {
  it('drives a transition on external hash change but ignores its own echo', () => {
    const { vm, win, earthView } = makeManager({ reducedMotion: true });
    vm.start();

    win.location.hash = '#/earth';
    win._emit('hashchange');
    expect(vm.state).toBe(VIEW_STATES.EARTH);
    expect(earthView.onEnter).toHaveBeenCalledTimes(1);

    win._emit('hashchange'); // still #/earth, already heading earth -> ignored
    expect(earthView.onEnter).toHaveBeenCalledTimes(1);
  });
});

describe('ViewManager resize propagates to both views (REQ-315 dormant-camera fix)', () => {
  it('calls onResize on both the active AND inactive view, not just the active one', () => {
    const { vm, solarView, earthView, renderCore, win } = makeManager();
    vm.start();

    // solarView is active (default boot state); earthView is dormant but owns
    // its own camera, which must stay in sync even while not displayed.
    expect(vm.activeView).toBe(solarView);

    win.innerWidth = 1280;
    win.innerHeight = 720;
    win._emit('resize');

    expect(renderCore.resize).toHaveBeenCalledWith(1280, 720);
    expect(solarView.onResize).toHaveBeenCalledWith(1280, 720);
    expect(earthView.onResize).toHaveBeenCalledWith(1280, 720); // the regression guard
  });
});

describe('single WebGL context static guard (REQ-385)', () => {
  const srcFiles = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.js') && !name.endsWith('.test.js')) srcFiles.push(p);
    }
  })(join(process.cwd(), 'src'));

  // The rule REQ-385 actually protects is that the VIEWS share one render core:
  // SolarSystemView owns it and lends it to EarthView, so switching views can
  // never cost a second context or a context-loss race. A short-lived overlay that
  // builds its own renderer and disposes it on close is a different thing, and the
  // guard now says which files are allowed to be that — by name, so a new one has
  // to be argued for here rather than appearing quietly.
  const OVERLAY_RENDERERS = ['src/play/SizeCompareScene.js'];

  it('constructs exactly one WebGLRenderer among the view/render-core files', () => {
    const count = srcFiles
      .filter((f) => !OVERLAY_RENDERERS.some((allowed) => f.endsWith(allowed.replace(/\//g, sep))))
      .reduce(
        (n, f) => n + (readFileSync(f, 'utf8').match(/new THREE\.WebGLRenderer\(/g) || []).length,
        0
      );
    expect(count).toBe(1);
  });

  it('makes every overlay renderer dispose itself, so none outlives its overlay', () => {
    for (const allowed of OVERLAY_RENDERERS) {
      const file = srcFiles.find((f) => f.endsWith(allowed.replace(/\//g, sep)));
      expect(file, `${allowed} is allowlisted but missing`).toBeTruthy();
      const source = readFileSync(file, 'utf8');
      expect(source, `${allowed} must build a renderer to need the exemption`)
        .toMatch(/new THREE\.WebGLRenderer\(/);
      expect(source, `${allowed} must dispose its renderer`).toMatch(/renderer\.dispose\(\)/);
    }
  });

  it('constructs exactly one EffectComposer across the whole src tree', () => {
    const count = srcFiles.reduce(
      (n, f) => n + (readFileSync(f, 'utf8').match(/new EffectComposer\(/g) || []).length,
      0
    );
    expect(count).toBe(1);
  });
});
