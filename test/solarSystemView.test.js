import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SolarSystemView } from '../src/views/SolarSystemView.js';

// Minimal stubs — no real WebGL/DOM layout needed for lifecycle + ownership logic.
function makeStubs() {
  // add/remove: the play layer (SPEC-PLAY-001) mounts its celebration pool and
  // its rocket into the same scene during buildUI.
  const scene = { tag: 'scene', add: vi.fn(), remove: vi.fn() };
  const camera = { tag: 'camera' };
  const sceneManager = {
    scene,
    camera,
    controls: { enabled: true, target: { copy: vi.fn() }, update: vi.fn() },
    renderer: { domElement: { addEventListener: vi.fn() } },
    focusPlanet: vi.fn(),
    resetCamera: vi.fn(),
    stepCamera: vi.fn(),
    setHoveredObject: vi.fn(),
  };
  // getWorldPosition on every body: the mission praise burst (SPEC-PLAY-001 M5)
  // reads the focused body's world position, and WHICH body that is depends on
  // the real calendar date's mission rotation — so no stub may lack it.
  const planetFactory = {
    planets: {
      earth: { mesh: { position: {}, getWorldPosition: vi.fn((v) => v) }, data: { displayRadius: 8 } },
      mars: { mesh: { position: { x: 1 }, getWorldPosition: vi.fn((v) => v) }, data: { displayRadius: 5 } },
      moon: { mesh: { position: {}, getWorldPosition: vi.fn((v) => v) }, pivot: {}, data: { displayRadius: 3 } },
    },
    update: vi.fn(),
    onFocus: vi.fn(),
    onDefocus: vi.fn(),
  };
  const el = () => ({ style: {} });
  const infoPanel = { el: el(), show: vi.fn(), hide: vi.fn() };
  const planetList = { el: el(), _toggleBtn: el(), setActive: vi.fn(), clearActive: vi.fn() };
  const planetStrip = { el: el(), onSelect: null, setActive: vi.fn(), clearActive: vi.fn() };
  const timeControls = { el: el(), updatePlayButton: vi.fn(), updateDate: vi.fn() };
  const interaction = { enabled: true, selectedPlanet: null, dispose: vi.fn() };

  const keyListeners = [];
  const win = { addEventListener: (t, fn) => t === 'keydown' && keyListeners.push(fn) };
  const emitKey = (code) => keyListeners.forEach((fn) => fn({ code, preventDefault() {} }));

  const view = new SolarSystemView({
    sceneManager,
    planetFactory,
    createInfoPanel: () => infoPanel,
    createPlanetList: () => planetList,
    createPlanetStrip: () => planetStrip,
    createTimeControls: () => timeControls,
    createInteraction: () => interaction,
    win,
  });
  return { view, sceneManager, planetFactory, infoPanel, planetList, planetStrip, timeControls, interaction, emitKey };
}

afterEach(() => vi.restoreAllMocks());

describe('SolarSystemView interface + render core (E3, REQ-315)', () => {
  it('exposes getScenePass {scene, camera} and getRenderCore == its SceneManager', () => {
    const { view, sceneManager } = makeStubs();
    expect(view.getScenePass()).toEqual({ scene: sceneManager.scene, camera: sceneManager.camera });
    expect(view.getRenderCore()).toBe(sceneManager);
  });

  it('implements the full frozen View interface', () => {
    const { view } = makeStubs();
    for (const m of ['mount', 'unmount', 'onEnter', 'onExit', 'update', 'getScenePass', 'dispose']) {
      expect(typeof view[m], m).toBe('function');
    }
  });
});

describe('SolarSystemView UI ownership toggling (E4, REQ-330/340)', () => {
  let s;
  beforeEach(() => {
    s = makeStubs();
    s.view.buildUI();
  });

  it('onExit hides overlays, disables controls + picking', () => {
    s.view.onExit();
    expect(s.infoPanel.el.style.display).toBe('none');
    expect(s.planetList.el.style.display).toBe('none');
    expect(s.timeControls.el.style.display).toBe('none');
    expect(s.sceneManager.controls.enabled).toBe(false);
    expect(s.interaction.enabled).toBe(false);
    expect(s.sceneManager.setHoveredObject).toHaveBeenCalledWith(null);
  });

  it('onEnter restores overlays, controls + picking', () => {
    s.view.onExit();
    s.view.onEnter('EARTH');
    expect(s.infoPanel.el.style.display).toBe('');
    expect(s.sceneManager.controls.enabled).toBe(true);
    expect(s.interaction.enabled).toBe(true);
  });

  it('restores the overview camera only when returning from EARTH', () => {
    s.view.onEnter('EARTH');
    expect(s.sceneManager.resetCamera).toHaveBeenCalledTimes(1);
    s.sceneManager.resetCamera.mockClear();
    s.view.onEnter(null); // initial boot must not force a reset
    expect(s.sceneManager.resetCamera).not.toHaveBeenCalled();
  });
});

describe('SolarSystemView deep-link safety (REQ-325)', () => {
  it('keeps its UI hidden when built without being entered (a #/earth deep-link boot)', () => {
    const s = makeStubs();
    // Simulates: ViewManager deep-links straight into EARTH, so solar onEnter is
    // never called, but solar textures still finish and build the UI.
    s.view.buildUI();
    expect(s.infoPanel.el.style.display).toBe('none');
    expect(s.planetList.el.style.display).toBe('none');
    expect(s.timeControls.el.style.display).toBe('none');
    // Hiding the DOM panels isn't enough: the freshly built InteractionManager
    // and OrbitControls both default to enabled, so without disabling them here
    // they'd keep raycasting/orbiting the dormant solar camera on every pointer
    // move over the shared canvas — surfacing tooltips for a scene the user is
    // not looking at (regression: Sun/star tooltips while EarthView is active).
    expect(s.interaction.enabled).toBe(false);
    expect(s.sceneManager.controls.enabled).toBe(false);
  });
});

describe('SolarSystemView earth selection routes to a view transition (REQ-310)', () => {
  it('selecting earth requests enterEarth instead of focusing', () => {
    const s = makeStubs();
    s.view.buildUI();
    const onEarth = vi.fn();
    s.view.setEarthSelectHandler(onEarth);

    s.view._select('earth');
    expect(onEarth).toHaveBeenCalledTimes(1);
    expect(s.sceneManager.focusPlanet).not.toHaveBeenCalled();

    s.view._select('mars'); // other bodies still focus
    expect(s.sceneManager.focusPlanet).toHaveBeenCalledTimes(1);
    expect(s.planetFactory.onFocus).toHaveBeenCalledWith('mars');
  });
});

describe('SolarSystemView mobile icon strip wiring (REQ-MOB-303, AC-MOB-303)', () => {
  it('routes a strip tap through the same selection path as the sidebar', () => {
    const s = makeStubs();
    s.view.buildUI();

    s.planetStrip.onSelect('mars');
    expect(s.infoPanel.show).toHaveBeenCalledWith('mars', s.planetFactory.planets.mars.data);
    expect(s.sceneManager.focusPlanet).toHaveBeenCalledTimes(1);
    expect(s.planetFactory.onFocus).toHaveBeenCalledWith('mars');
  });

  it('mirrors selection state onto the strip exactly as onto the sidebar', () => {
    const s = makeStubs();
    s.view.buildUI();

    s.view._select('mars');
    expect(s.planetStrip.setActive).toHaveBeenCalledWith('mars');

    s.view._deselect();
    expect(s.planetStrip.clearActive).toHaveBeenCalled();
  });

  it('hides and restores the strip with the rest of the overlay chrome', () => {
    const s = makeStubs();
    s.view.buildUI();

    s.view.onExit();
    expect(s.planetStrip.el.style.display).toBe('none');

    s.view.onEnter(null);
    expect(s.planetStrip.el.style.display).toBe('');
  });
});

describe('SolarSystemView per-frame update (E3)', () => {
  it('advances sim time, follows the focused body, steps camera + controls', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view._select('mars');
    s.view.update(0.5);

    expect(s.planetFactory.update).toHaveBeenCalled();
    expect(s.sceneManager.controls.target.copy).toHaveBeenCalledWith(s.planetFactory.planets.mars.mesh.position);
    expect(s.sceneManager.stepCamera).toHaveBeenCalledWith(0.5);
    expect(s.sceneManager.controls.update).toHaveBeenCalled();
    expect(s.timeControls.updateDate).toHaveBeenCalled();
  });

  it('uses world position to follow a body that orbits on a pivot', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view._select('moon');
    s.view.update(0.1);
    expect(s.planetFactory.planets.moon.mesh.getWorldPosition).toHaveBeenCalled();
  });

  it('does not advance planets while paused', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view.simApi.togglePlay(); // pause
    s.view.update(1);
    expect(s.planetFactory.update).not.toHaveBeenCalled();
  });
});

describe('SolarSystemView keyboard shortcuts (E4)', () => {
  it('acts only while active and drives play/deselect/time-reset', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view.onEnter(null); // activate

    s.emitKey('Space');
    expect(s.timeControls.updatePlayButton).toHaveBeenCalled();
    expect(s.view.simApi.isPlaying()).toBe(false);

    s.emitKey('Escape');
    expect(s.infoPanel.hide).toHaveBeenCalled();
    expect(s.sceneManager.resetCamera).toHaveBeenCalled();

    s.emitKey('Home');
    expect(s.view.simApi.getSimTime()).toBe(0);
  });

  it('ignores keys while inactive (EarthView owns input in EARTH)', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view.onExit(); // inactive
    s.sceneManager.resetCamera.mockClear();
    s.emitKey('Escape');
    expect(s.sceneManager.resetCamera).not.toHaveBeenCalled();
  });
});

describe('SolarSystemView dispose', () => {
  it('tears down picking + the render core', () => {
    const s = makeStubs();
    s.view.buildUI();
    const disposeCore = vi.fn();
    s.sceneManager.dispose = disposeCore;
    s.view.dispose();
    expect(s.interaction.dispose).toHaveBeenCalled();
    expect(disposeCore).toHaveBeenCalled();
  });
});
