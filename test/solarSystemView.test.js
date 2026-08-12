import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SolarSystemView } from '../src/views/SolarSystemView.js';
import { ALIGNMENT_PLANET_KEYS } from '../src/utils/alignment.js';
import { ASTEROID_BELT, KUIPER_BELT } from '../src/effects/Belts.js';
import { BELT_DATA } from '../src/planets/planetData.js';
import { STR } from '../src/ui/strings.js';

// Heliocentric longitudes (degrees) for the 8 planets, in ALIGNMENT_PLANET_KEYS
// order. Evenly spread = no four inside any 30-degree window.
const SCATTERED = [0, 45, 90, 135, 180, 225, 270, 315];
const FORMED = [0, 6, 12, 18, 180, 225, 270, 315];
const DISPERSED = [0, 20, 40, 60, 180, 225, 270, 315];

/** Place a planet mesh on the XZ plane at the given heliocentric longitude. */
function positionAt(position, deg, radius) {
  const rad = (deg * Math.PI) / 180;
  position.x = radius * Math.cos(rad);
  position.y = 0;
  position.z = radius * Math.sin(rad);
}

// Minimal stubs — no real WebGL/DOM layout needed for lifecycle + ownership logic.
function makeStubs({ qualityTier = 'full', longitudes = SCATTERED } = {}) {
  // add/remove: the play layer (SPEC-PLAY-001) mounts its celebration pool and
  // its rocket into the same scene during buildUI.
  const scene = { tag: 'scene', add: vi.fn(), remove: vi.fn() };
  const camera = { tag: 'camera' };
  const belts = [ASTEROID_BELT, KUIPER_BELT].map((config) => ({
    config,
    mesh: { name: config.name },
    update: vi.fn(),
    setReduced: vi.fn(),
    dispose: vi.fn(),
  }));
  const sceneManager = {
    scene,
    camera,
    qualityTier,
    onBeltsShed: null,
    controls: { enabled: true, target: { copy: vi.fn() }, update: vi.fn() },
    renderer: { domElement: { addEventListener: vi.fn() } },
    focusPlanet: vi.fn(),
    // Journey framing: the view pulls the camera back to hold the whole
    // rocket path before the flight starts (SPEC-PLAY-001 REQ-PLAY-201).
    frameJourney: vi.fn(),
    resetCamera: vi.fn(),
    stepCamera: vi.fn(),
    setHoveredObject: vi.fn(),
  };
  // All 8 planets, so the alignment frame hook has real positions to read. The
  // comet joins them: PlanetFactory registers it like any other PLANET_DATA body.
  //
  // getWorldPosition on every body: the mission praise burst (SPEC-PLAY-001 M5)
  // reads the focused body's world position, and WHICH body that is depends on
  // the real calendar date's mission rotation — so no stub may lack it.
  const planets = {
    moon: { mesh: { position: {}, getWorldPosition: vi.fn((v) => v) }, pivot: {}, data: { displayRadius: 3 } },
    halley: {
      mesh: { position: { x: 700, y: 0, z: 0 }, getWorldPosition: vi.fn((v) => v) },
      data: { displayRadius: 2 },
    },
  };
  for (const key of ALIGNMENT_PLANET_KEYS) {
    planets[key] = {
      mesh: { position: { x: 0, y: 0, z: 0 }, getWorldPosition: vi.fn((v) => v) },
      data: { displayRadius: key === 'earth' ? 8 : 5 },
    };
  }
  const setLongitudes = (degs) => {
    ALIGNMENT_PLANET_KEYS.forEach((key, i) => positionAt(planets[key].mesh.position, degs[i], 100 + i * 50));
  };
  setLongitudes(longitudes);

  const planetFactory = {
    planets,
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
  const eventBanner = { el: el(), show: vi.fn(), hide: vi.fn() };

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
    createBelts: () => belts,
    createEventBanner: () => eventBanner,
    win,
  });
  return {
    view, sceneManager, planetFactory, infoPanel, planetList, planetStrip,
    timeControls, interaction, belts, eventBanner, emitKey, setLongitudes,
  };
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

// SPEC-EVENTS-001 M3. SolarSystemView owns the contents of the solar scene, so
// the belts mount here — SceneManager owns only the render core and the degrader.
describe('SolarSystemView belt field (REQ-EVT-201, REQ-EVT-202)', () => {
  it('mounts both belts into the solar scene', () => {
    const s = makeStubs();
    for (const belt of s.belts) {
      expect(s.sceneManager.scene.add).toHaveBeenCalledWith(belt.mesh);
    }
  });

  it('drifts the belts on simulation time, alongside the planets', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view.simApi.setTimeSpeed(10);
    s.view.update(0.5);
    for (const belt of s.belts) {
      expect(belt.update).toHaveBeenCalledWith(s.view.simApi.getSimTime());
    }
  });

  it('freezes the belts while the simulation is paused', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view.simApi.togglePlay(); // pause
    s.view.update(1);
    for (const belt of s.belts) expect(belt.update).not.toHaveBeenCalled();
  });
});

// SPEC-EVENTS-001 REQ-EVT-204 / AC-EVT-204. SolarSystemView owns the belts, so
// it owns the shed action too; SceneManager only decides WHEN, exactly as it
// does for the Earth view's aurora.
describe('SolarSystemView belt shedding (REQ-EVT-204)', () => {
  it('boots at the reduced instance count on a constrained-tier device', () => {
    const s = makeStubs({ qualityTier: 'constrained' });
    for (const belt of s.belts) expect(belt.setReduced).toHaveBeenCalledWith(true);
  });

  it('boots the full field on a full-tier device', () => {
    const s = makeStubs({ qualityTier: 'full' });
    for (const belt of s.belts) expect(belt.setReduced).not.toHaveBeenCalled();
  });

  it('registers the shed hook the frame-budget degrader calls', () => {
    const s = makeStubs();
    expect(typeof s.sceneManager.onBeltsShed).toBe('function');

    s.sceneManager.onBeltsShed(true);
    for (const belt of s.belts) expect(belt.setReduced).toHaveBeenCalledWith(true);

    s.sceneManager.onBeltsShed(false);
    for (const belt of s.belts) expect(belt.setReduced).toHaveBeenCalledWith(false);
  });

  // acceptance.md §3: a shed that lands while a belt entry is selected and
  // framed must not crash and must not move the camera target. Instance count
  // is a draw-range change, so nothing in the camera path can observe it.
  it('does not disturb the framed camera target when belts shed mid-view', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view._select('mars');
    s.sceneManager.controls.target.copy.mockClear();
    s.sceneManager.focusPlanet.mockClear();

    expect(() => s.view.setBeltsShed(true)).not.toThrow();

    expect(s.sceneManager.controls.target.copy).not.toHaveBeenCalled();
    expect(s.sceneManager.focusPlanet).not.toHaveBeenCalled();
    expect(s.sceneManager.resetCamera).not.toHaveBeenCalled();
    expect(s.view._focusedKey).toBe('mars');
  });
});

// SPEC-EVENTS-001 M6 / AC-EVT-103. The comet needs no branch of its own — it
// rides in PLANET_DATA, so PlanetFactory builds it and the ordinary selection
// path focuses and narrates it. This pins that, since "selectable like any
// body" is the requirement.
describe('SolarSystemView comet selection (REQ-EVT-103)', () => {
  it('focuses and narrates the comet through the ordinary body path', () => {
    const s = makeStubs();
    s.view.buildUI();

    s.view._select('halley');

    expect(s.infoPanel.show).toHaveBeenCalledWith('halley', s.planetFactory.planets.halley.data);
    expect(s.sceneManager.focusPlanet).toHaveBeenCalledTimes(1);
    expect(s.planetFactory.onFocus).toHaveBeenCalledWith('halley');
    expect(s.planetList.setActive).toHaveBeenCalledWith('halley');
    expect(s.planetStrip.setActive).toHaveBeenCalledWith('halley');
    expect(s.view._focusedKey).toBe('halley');
  });
});

// SPEC-EVENTS-001 M6 / AC-EVT-205. Belts are list- and strip-driven only: they
// never enter the raycast set, so selecting one is a pure UI path.
describe('SolarSystemView belt selection (REQ-EVT-205)', () => {
  it('frames the belt band with the camera', () => {
    const s = makeStubs();
    s.view.buildUI();

    s.view._select('asteroidBelt');

    expect(s.sceneManager.focusPlanet).toHaveBeenCalledTimes(1);
    const [target] = s.sceneManager.focusPlanet.mock.calls[0];
    const distance = Math.hypot(target.x, target.y, target.z);
    expect(distance).toBeGreaterThanOrEqual(ASTEROID_BELT.innerRadius);
    expect(distance).toBeLessThanOrEqual(ASTEROID_BELT.outerRadius);
  });

  it('frames each belt inside its own band', () => {
    const s = makeStubs();
    s.view.buildUI();

    s.view._select('kuiperBelt');

    const [target] = s.sceneManager.focusPlanet.mock.calls[0];
    const distance = Math.hypot(target.x, target.y, target.z);
    expect(distance).toBeGreaterThanOrEqual(KUIPER_BELT.innerRadius);
    expect(distance).toBeLessThanOrEqual(KUIPER_BELT.outerRadius);
  });

  it('opens the belt panel, which is what the narration reads from', () => {
    const s = makeStubs();
    s.view.buildUI();

    s.view._select('asteroidBelt');

    expect(s.infoPanel.show).toHaveBeenCalledWith('asteroidBelt', BELT_DATA.asteroidBelt);
    expect(s.planetList.setActive).toHaveBeenCalledWith('asteroidBelt');
    expect(s.planetStrip.setActive).toHaveBeenCalledWith('asteroidBelt');
  });

  it('stops following the previously focused planet', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view._select('mars');
    s.sceneManager.controls.target.copy.mockClear();

    s.view._select('asteroidBelt');
    s.view.update(0.1);

    // A band does not move, so nothing may keep dragging the camera target
    // around after it is framed — least of all the planet left behind.
    expect(s.view._focusedKey).toBeNull();
    expect(s.sceneManager.controls.target.copy).not.toHaveBeenCalled();
  });

  // acceptance.md §3: a shed landing on a framed belt must not move the camera.
  it('survives a degrader shed while the belt is framed', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view._select('kuiperBelt');
    s.sceneManager.focusPlanet.mockClear();

    expect(() => s.sceneManager.onBeltsShed(true)).not.toThrow();
    s.view.update(0.1);

    expect(s.sceneManager.focusPlanet).not.toHaveBeenCalled();
    expect(s.sceneManager.controls.target.copy).not.toHaveBeenCalled();
    expect(s.sceneManager.resetCamera).not.toHaveBeenCalled();
  });
});

// SPEC-EVENTS-001 M5. The detection hook lives here and not in main.js: main.js
// is a 33-line bootstrap, and the render loop runs through ViewManager into
// update(delta). Longitudes come from the positions PlanetFactory already wrote
// this frame — the orbits are never solved twice.
describe('SolarSystemView alignment event (REQ-EVT-303, REQ-EVT-304)', () => {
  it('raises the banner once when the formation enters', () => {
    const s = makeStubs();
    s.view.buildUI();

    s.view.update(0.1);
    expect(s.eventBanner.show).not.toHaveBeenCalled();

    s.setLongitudes(FORMED);
    s.view.update(0.1);
    expect(s.eventBanner.show).toHaveBeenCalledTimes(1);
    expect(s.eventBanner.show).toHaveBeenCalledWith(STR.eventAlignment);

    s.view.update(0.1);
    s.view.update(0.1);
    expect(s.eventBanner.show).toHaveBeenCalledTimes(1);
  });

  it('re-triggers only after the formation disperses past the exit window', () => {
    const s = makeStubs({ longitudes: FORMED });
    s.view.buildUI();
    s.view.update(0.1);
    expect(s.eventBanner.show).toHaveBeenCalledTimes(1);

    s.setLongitudes(DISPERSED); // 60 degrees apart: past the 40 exit window
    s.view.update(0.1);
    expect(s.eventBanner.show).toHaveBeenCalledTimes(1);

    s.setLongitudes(FORMED);
    s.view.update(0.1);
    expect(s.eventBanner.show).toHaveBeenCalledTimes(2);
  });

  it('does not sample a paused sky', () => {
    const s = makeStubs({ longitudes: FORMED });
    s.view.buildUI();
    s.view.simApi.togglePlay(); // pause
    s.view.update(1);
    expect(s.eventBanner.show).not.toHaveBeenCalled();
  });

  it('waits for the planets to exist before sampling', () => {
    const s = makeStubs({ longitudes: FORMED });
    s.view.buildUI();
    delete s.planetFactory.planets.neptune; // textures still loading
    expect(() => s.view.update(0.1)).not.toThrow();
    expect(s.eventBanner.show).not.toHaveBeenCalled();
  });

  it('hides the banner with the rest of the overlay chrome', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.view.onExit();
    expect(s.eventBanner.el.style.display).toBe('none');
    s.view.onEnter(null);
    expect(s.eventBanner.el.style.display).toBe('');
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

  it('releases the belt geometry and material it allocated', () => {
    const s = makeStubs();
    s.view.buildUI();
    s.sceneManager.dispose = vi.fn();
    s.view.dispose();
    for (const belt of s.belts) expect(belt.dispose).toHaveBeenCalled();
  });
});
