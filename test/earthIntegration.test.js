import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { EarthView } from '../src/earth/EarthView.js';
import { ECLIPSE_TABLE } from '../src/utils/eclipseData.js';
import { STR } from '../src/ui/strings.js';
import { ISS_FACTS } from '../src/earth/ISSMarker.js';
import { issPosition } from '../src/utils/issOrbit.js';
import { SIM_EPOCH_MS } from '../src/utils/constants.js';
import { MeteorShower } from '../src/effects/MeteorShower.js';

const DAY_MS = 86400000;

/** Convert a real UTC ISO instant to a sim-day number against the shared epoch. */
function simDayFor(iso) {
  return (Date.parse(iso) - SIM_EPOCH_MS) / DAY_MS;
}

vi.mock('../src/audio/tts.js', () => ({ speak: vi.fn() }));
import { speak } from '../src/audio/tts.js';

// Inverse of the click-normalization formula used by EarthView/InteractionManager:
// project a known world position through the camera to the exact client coords
// that would raycast-hit it, so the ISS tap tests are deterministic (no guessing).
function clientPosOf(view, worldPosition) {
  // Mirror _onCanvasClick's own force-update: nothing in this test ever calls
  // renderer.render(), so the camera/marker matrices are otherwise stale.
  view.camera.updateMatrixWorld();
  const ndc = worldPosition.clone().project(view.camera);
  const w = view._win.innerWidth;
  const h = view._win.innerHeight;
  return { clientX: ((ndc.x + 1) / 2) * w, clientY: ((1 - ndc.y) / 2) * h };
}

function makeSimApi({ time = 0, speed = 1, playing = true } = {}) {
  let t = time; let s = speed; let p = playing;
  return {
    getSimTime: () => t, setSimTime: (v) => { t = v; },
    getTimeSpeed: () => s, setTimeSpeed: (v) => { s = v; },
    isPlaying: () => p, togglePlay: () => { p = !p; },
  };
}

function makeEclipseRig() {
  return { group: new THREE.Group(), show: vi.fn(), hide: vi.fn(), update: vi.fn(), dispose: vi.fn() };
}
function makeAurora() {
  return { group: new THREE.Group(), setVisible: vi.fn(), update: vi.fn(), setSunDirection: vi.fn(), dispose: vi.fn() };
}
function makeMeteors() {
  return { group: new THREE.Group(), setVisible: vi.fn(), update: vi.fn(), dispose: vi.fn() };
}
function makeFlightService() {
  return {
    state: 'OFF', count: 0, lastUpdatedAt: 0,
    start: vi.fn(function () { this.state = 'LOADING'; }),
    stop: vi.fn(function () { this.state = 'OFF'; }),
    tick: vi.fn(), getAircraft: vi.fn(() => []), onState: vi.fn(function (cb) { this._cb = cb; }),
  };
}

function makeView({ isMobile = false, simApi, eclipseRig, aurora, flightService, meteors } = {}) {
  const rig = { group: new THREE.Group(), update: vi.fn(), dispose: vi.fn() };
  const view = new EarthView({
    isMobile,
    simApi,
    rigFactory: () => rig,
    controlsFactory: () => ({ enabled: false, update: vi.fn(), dispose: vi.fn() }),
    eclipseRigFactory: () => eclipseRig,
    auroraFactory: () => aurora,
    meteorFactory: meteors ? () => meteors : undefined,
    flightServiceFactory: () => flightService,
    win: { innerWidth: 1024, innerHeight: 768 },
  });
  return { view, rig };
}

beforeEach(() => {
  speak.mockClear();
});

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('EarthView F6 eclipse detection over the shared clock (REQ-520/530, AC-ECLIPSE-02)', () => {
  it('mounts the eclipse rig into the eclipse layer on entry', () => {
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi: makeSimApi(), eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    expect(view.eclipseLayer.children).toContain(eclipseRig.group);
  });

  it('detects an eclipse crossed during a normal-speed frame and shows it', () => {
    const target = ECLIPSE_TABLE[0];
    const simApi = makeSimApi({ time: target.simDay - 0.001, speed: 1, playing: true });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view.update(1); // advances 0.05 sim-day (fixed rate), still crossing the 0.001-day-away instant
    expect(eclipseRig.show).toHaveBeenCalledWith(target);
  });

  it('does NOT miss an eclipse under a huge-delta leap spanning years (frame-step independent)', () => {
    // speed is now ignored (EarthView drives its own fixed 0.05 days/s rate) — force the
    // giant multi-year jump via a large delta instead: 60000 * 0.05 = 3000 sim-days (~8.2y).
    const simApi = makeSimApi({ time: ECLIPSE_TABLE[0].simDay - 1, playing: true });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view.update(60000); // one giant frame leaping past many eclipses
    expect(eclipseRig.show).toHaveBeenCalled();
  });

  it('does not fabricate an eclipse when none is crossed (REQ-550)', () => {
    const simApi = makeSimApi({ time: ECLIPSE_TABLE[0].simDay + 1, speed: 0.001, playing: true });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view.update(1);
    expect(eclipseRig.show).not.toHaveBeenCalled();
  });
});

describe('EarthView F6 preset jump + find next (REQ-510/540)', () => {
  it('preset selection jumps the shared clock and shows the rig', () => {
    const simApi = makeSimApi({ time: 0 });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view._hud.onSelectEclipse(ECLIPSE_TABLE[2]);
    expect(simApi.getSimTime()).toBeCloseTo(ECLIPSE_TABLE[2].simDay, 6);
    expect(eclipseRig.show).toHaveBeenCalledWith(ECLIPSE_TABLE[2]);
  });

  it('find-next fast-forwards the clock to the next eclipse', () => {
    const simApi = makeSimApi({ time: ECLIPSE_TABLE[0].simDay - 10 });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view._hud.onFindNextEclipse();
    expect(simApi.getSimTime()).toBeCloseTo(ECLIPSE_TABLE[0].simDay, 6);
  });
});

describe('EarthView F6 eclipse simulation on/off toggle', () => {
  it('toggling off hides the current diorama and updates the HUD label', () => {
    const simApi = makeSimApi({ time: 0 });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view._hud.onSelectEclipse(ECLIPSE_TABLE[0]); // something is showing
    expect(eclipseRig.show).toHaveBeenCalledTimes(1);

    view._hud.onToggleEclipse();
    expect(eclipseRig.hide).toHaveBeenCalledTimes(1);
    expect(view._hud.el.querySelector('[data-toggle="eclipse"]').textContent).toBe(STR.earthEclipseOff);
  });

  it('while off, manual preset selection still moves the clock but does not show the rig', () => {
    const simApi = makeSimApi({ time: 0 });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view._hud.onToggleEclipse(); // off

    view._hud.onSelectEclipse(ECLIPSE_TABLE[1]);
    expect(simApi.getSimTime()).toBeCloseTo(ECLIPSE_TABLE[1].simDay, 6); // time nav still works
    expect(eclipseRig.show).not.toHaveBeenCalled();
  });

  it('while off, an eclipse crossed during playback is not shown', () => {
    const target = ECLIPSE_TABLE[0];
    const simApi = makeSimApi({ time: target.simDay - 0.001, speed: 1, playing: true });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view._hud.onToggleEclipse(); // off

    view.update(1);
    expect(eclipseRig.show).not.toHaveBeenCalled();
  });

  it('toggling back on restores normal show behavior', () => {
    const simApi = makeSimApi({ time: 0 });
    const eclipseRig = makeEclipseRig();
    const { view } = makeView({ simApi, eclipseRig, aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view._hud.onToggleEclipse(); // off
    view._hud.onToggleEclipse(); // back on

    view._hud.onSelectEclipse(ECLIPSE_TABLE[0]);
    expect(eclipseRig.show).toHaveBeenCalledWith(ECLIPSE_TABLE[0]);
    expect(view._hud.el.querySelector('[data-toggle="eclipse"]').textContent).toBe(STR.earthEclipseOn);
  });
});

describe('EarthView F5 aircraft lifecycle (REQ-420/430/355)', () => {
  it('opt-in toggle starts the flight service; exit stops it (no leak)', () => {
    const flightService = makeFlightService();
    const { view } = makeView({ simApi: makeSimApi(), eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService });
    view.onEnter(null);
    view._hud.onToggleAircraft();
    expect(flightService.start).toHaveBeenCalledTimes(1);
    view.onExit();
    expect(flightService.stop).toHaveBeenCalled();
  });

  it('pushes flight state into the HUD aria-live status', () => {
    const flightService = makeFlightService();
    const { view } = makeView({ simApi: makeSimApi(), eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService });
    view.onEnter(null);
    // service reports LIVE with 2 aircraft
    flightService.state = 'LIVE'; flightService.count = 2;
    flightService._cb('LIVE');
    const el = view._hud.el.querySelector('[data-field="flight-status"]');
    expect(el.dataset.state).toBe('LIVE');
    expect(el.textContent).toContain('2');
  });
});

describe('EarthView F7 aurora mount + degradation shed (REQ-610/650)', () => {
  it('mounts aurora into the aurora layer on entry', () => {
    const aurora = makeAurora();
    const { view } = makeView({ simApi: makeSimApi(), eclipseRig: makeEclipseRig(), aurora, flightService: makeFlightService() });
    view.onEnter(null);
    expect(view.auroraLayer.children).toContain(aurora.group);
  });

  it('setAuroraShed(true) hides the aurora (frame-budget shed)', () => {
    const aurora = makeAurora();
    const { view } = makeView({ simApi: makeSimApi(), eclipseRig: makeEclipseRig(), aurora, flightService: makeFlightService() });
    view.onEnter(null);
    view.setAuroraShed(true);
    expect(aurora.setVisible).toHaveBeenLastCalledWith(false);
    view.setAuroraShed(false);
    expect(aurora.setVisible).toHaveBeenLastCalledWith(true);
  });
});

describe('EarthView F11 ISS marker (SPEC-EARTH-003 REQ-E3-201/202/203)', () => {
  it('mounts the marker into its own layer on entry, visible by default (REQ-E3-202)', () => {
    const { view } = makeView({ simApi: makeSimApi(), eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    expect(view.issLayer.children).toContain(view._issMarker.object3d);
    expect(view._issMarker.object3d.visible).toBe(true);
    expect(view._hud.el.querySelector('[data-toggle="iss"]').textContent).toBe(STR.earthIssOn);
  });

  it('HUD toggle hides then shows the marker', () => {
    const { view } = makeView({ simApi: makeSimApi(), eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);

    view._hud.onToggleISS();
    expect(view._issMarker.object3d.visible).toBe(false);
    expect(view._hud.el.querySelector('[data-toggle="iss"]').textContent).toBe(STR.earthIssOff);

    view._hud.onToggleISS();
    expect(view._issMarker.object3d.visible).toBe(true);
    expect(view._hud.el.querySelector('[data-toggle="iss"]').textContent).toBe(STR.earthIssOn);
  });

  it('tracks issPosition off the shared sim clock (sim-day -> sim-minute)', () => {
    const simApi = makeSimApi({ time: 2.5 }); // 2.5 sim-days
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    view.update(0); // delta 0: repositions without advancing the clock

    const expected = issPosition(2.5 * 24 * 60);
    expect(view._issMarker.object3d.position.x).toBeCloseTo(expected.x, 6);
    expect(view._issMarker.object3d.position.y).toBeCloseTo(expected.y, 6);
    expect(view._issMarker.object3d.position.z).toBeCloseTo(expected.z, 6);
  });

  it('tapping the marker speaks the first fact once and surfaces it in the HUD (REQ-E3-203)', () => {
    const simApi = makeSimApi({ time: 0 });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    const renderer = { domElement: {} };
    view.mount(renderer, {});
    view.onEnter(null);
    view.update(0);

    const at = clientPosOf(view, view._issMarker.object3d.position.clone());
    view._onCanvasClick({ clientX: at.clientX, clientY: at.clientY, target: renderer.domElement });

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(ISS_FACTS.factsKo[0]);
    expect(view._hud.el.querySelector('[data-field="iss-facts"]').textContent).toContain(ISS_FACTS.factsKo[0]);
  });

  it('a click that misses the marker selects nothing', () => {
    const simApi = makeSimApi({ time: 0 });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    const renderer = { domElement: {} };
    view.mount(renderer, {});
    view.onEnter(null);
    view.update(0);

    view._onCanvasClick({ clientX: 5, clientY: 5, target: renderer.domElement });
    expect(speak).not.toHaveBeenCalled();
  });

  it('toggle OFF removes the raycast target: a tap where the marker was selects nothing (edge case)', () => {
    const simApi = makeSimApi({ time: 0 });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    const renderer = { domElement: {} };
    view.mount(renderer, {});
    view.onEnter(null);
    view.update(0);
    const at = clientPosOf(view, view._issMarker.object3d.position.clone());

    view._hud.onToggleISS(); // OFF
    view._onCanvasClick({ clientX: at.clientX, clientY: at.clientY, target: renderer.domElement });

    expect(speak).not.toHaveBeenCalled();
  });

  it('an orbit-drag that releases over the marker is not a tap (past TOUCH_TAP_MAX_DRAG_PX)', () => {
    const simApi = makeSimApi({ time: 0 });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    const renderer = { domElement: {} };
    view.mount(renderer, {});
    view.onEnter(null);
    view.update(0);
    const at = clientPosOf(view, view._issMarker.object3d.position.clone());

    view._onCanvasPointerDown({ clientX: at.clientX - 50, clientY: at.clientY });
    view._onCanvasClick({ clientX: at.clientX, clientY: at.clientY, target: renderer.domElement });

    expect(speak).not.toHaveBeenCalled();
  });

  it('a clean tap (pointerdown + click at the same spot) still selects', () => {
    const simApi = makeSimApi({ time: 0 });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    const renderer = { domElement: {} };
    view.mount(renderer, {});
    view.onEnter(null);
    view.update(0);
    const at = clientPosOf(view, view._issMarker.object3d.position.clone());

    view._onCanvasPointerDown({ clientX: at.clientX, clientY: at.clientY });
    view._onCanvasClick({ clientX: at.clientX, clientY: at.clientY, target: renderer.domElement });

    expect(speak).toHaveBeenCalledTimes(1);
  });
});

describe('EarthView F8 meteor-shower HUD notice + TTS (SPEC-EARTH-003 REQ-E3-104, AC-E3-104)', () => {
  const perseidsNotice = STR.earthMeteorNotice('페르세우스 유성우');

  it('crossing INTO the Perseids range shows the notice and speaks it exactly once', () => {
    const perseidsStart = simDayFor('2026-07-17T00:00:00Z');
    const simApi = makeSimApi({ time: perseidsStart - 0.001, speed: 1, playing: true });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null); // not yet active: no notice on open
    expect(speak).not.toHaveBeenCalled();

    view.update(1); // 0.05 sim-day fixed rate, crosses the 0.001-day-away boundary

    expect(view._hud.el.querySelector('[data-field="meteor-notice"]').textContent).toBe(perseidsNotice);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(perseidsNotice);
  });

  it('opening the Earth view mid-shower shows the same notice and speaks it once', () => {
    const simApi = makeSimApi({ time: simDayFor('2026-08-01T00:00:00Z') }); // inside Perseids
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);

    expect(view._hud.el.querySelector('[data-field="meteor-notice"]').textContent).toBe(perseidsNotice);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(perseidsNotice);
  });

  it('does not re-fire while the clock stays inside the same active range', () => {
    const perseidsStart = simDayFor('2026-07-17T00:00:00Z');
    const simApi = makeSimApi({ time: perseidsStart + 0.001, speed: 1, playing: true });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null); // one notice on open (mid-shower)
    expect(speak).toHaveBeenCalledTimes(1);
    speak.mockClear();

    for (let i = 0; i < 5; i++) view.update(1); // several 0.05-day steps, still well inside the range

    expect(speak).not.toHaveBeenCalled();
  });

  it('re-fires after the range is exited and re-entered', () => {
    const perseidsStart = simDayFor('2026-07-17T00:00:00Z');
    const simApi = makeSimApi({ time: perseidsStart + 0.001, speed: 1, playing: true });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null); // notice #1 (view opened mid-shower)
    expect(speak.mock.calls.filter(([t]) => t === perseidsNotice)).toHaveLength(1);

    // Walk forward ~400 sim-days in several bounded steps (each under the
    // multi-year fast-forward threshold), past the Perseids end and all the
    // way around to next year's Perseids entry.
    for (let i = 0; i < 8; i++) view.update(1000); // 1000s x 0.05 days/s = 50 sim-days/step

    expect(speak.mock.calls.filter(([t]) => t === perseidsNotice)).toHaveLength(2);
  });

  it('does not double-fire when a step lands exactly on the range start boundary', () => {
    const quadrantidsNotice = STR.earthMeteorNotice('사분의 유성우');
    const dec27 = simDayFor('2026-12-27T00:00:00Z');
    const simApi = makeSimApi({ time: dec27, speed: 1, playing: true });
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    expect(speak).not.toHaveBeenCalled();

    view.update(20); // 20 x 0.05 = 1.0 sim-day: dec27 -> dec28 exactly (Quadrantids start)
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(quadrantidsNotice);
    speak.mockClear();

    view.update(1); // one more small step, still inside the range: no double-fire
    expect(speak).not.toHaveBeenCalled();
  });

  it('a multi-year jump renders at most one meteor notice and afterward does not spuriously re-fire', () => {
    const simApi = makeSimApi({ time: simDayFor('2026-02-01T00:00:00Z'), speed: 1, playing: true }); // safely between showers
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    expect(speak).not.toHaveBeenCalled();

    // 60000s x 0.05 days/s = 3000 sim-days (~8.2 sim years): mirrors the eclipse
    // suite's huge-delta jump.
    view.update(60000);
    const meteorCalls = speak.mock.calls.filter(([t]) => typeof t === 'string' && t.endsWith('가 쏟아져요!'));
    expect(meteorCalls.length).toBeLessThanOrEqual(1);

    speak.mockClear();
    view.update(1); // following normal frame: must not spuriously re-fire
    expect(speak.mock.calls.filter(([t]) => typeof t === 'string' && t.endsWith('가 쏟아져요!'))).toHaveLength(0);
  });

  it('a jump that swallows an entire shower window and lands on an inactive day fires no notice (regression: two-point endpoint sampling used to miss the swallowed shower entirely)', () => {
    const simApi = makeSimApi({ time: simDayFor('2026-11-30T00:00:00Z'), speed: 1, playing: true }); // before Geminids
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    expect(speak).not.toHaveBeenCalled();

    view.update(400); // 400 x 0.05 = 20 sim-days: swallows all of Geminids (Dec 4-17), lands Dec 20 (nothing active)

    expect(speak).not.toHaveBeenCalled();
  });

  it('a jump that swallows an entire shower window but lands inside a DIFFERENT active shower fires exactly one notice for the shower actually in the sky', () => {
    const quadrantidsNotice = STR.earthMeteorNotice('사분의 유성우');
    const simApi = makeSimApi({ time: simDayFor('2026-12-01T00:00:00Z'), speed: 1, playing: true }); // before Geminids
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    expect(speak).not.toHaveBeenCalled();

    view.update(700); // 700 x 0.05 = 35 sim-days: swallows Geminids entirely, lands inside Quadrantids

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(quadrantidsNotice);
  });

  it('still shows the notice under prefers-reduced-motion, independent of the streak pool (REQ-E3-105, AC-E3-105)', () => {
    const reducedWin = { innerWidth: 1024, innerHeight: 768, matchMedia: () => ({ matches: true }) };
    const simApi = makeSimApi({ time: simDayFor('2026-08-01T00:00:00Z') }); // inside Perseids
    const rig = { group: new THREE.Group(), update: vi.fn(), dispose: vi.fn() };
    const eclipseRig = makeEclipseRig();
    const aurora = makeAurora();
    const flightService = makeFlightService();
    const view = new EarthView({
      simApi,
      rigFactory: () => rig,
      controlsFactory: () => ({ enabled: false, update: vi.fn(), dispose: vi.fn() }),
      eclipseRigFactory: () => eclipseRig,
      auroraFactory: () => aurora,
      flightServiceFactory: () => flightService,
      meteorFactory: () => new MeteorShower({ earthRadius: 100, win: reducedWin }),
      win: reducedWin,
    });

    view.onEnter(null);

    expect(view._hud.el.querySelector('[data-field="meteor-notice"]').textContent).toBe(perseidsNotice);
    expect(speak).toHaveBeenCalledWith(perseidsNotice);
  });

  it('keeps _prevSimDay tracking sim time across many frames even when _eclipseRig is absent, so a crossing still fires exactly one clean notice instead of ballooning into the multi-year branch', () => {
    const perseidsStart = simDayFor('2026-07-17T00:00:00Z');
    const simApi = makeSimApi({ time: perseidsStart - 1, speed: 1, playing: true }); // one day before entry
    const { view } = makeView({ simApi, eclipseRig: makeEclipseRig(), aurora: makeAurora(), flightService: makeFlightService() });
    view.onEnter(null);
    expect(speak).not.toHaveBeenCalled();
    view._eclipseRig = null; // simulate the window between a dispose and the next _build()

    for (let i = 0; i < 25; i++) view.update(1); // 25 x 0.05 = 1.25 sim-days, crossing the Perseids start

    // The window-close must not depend on _detectEclipses's own (bailed) early
    // return: _prevSimDay has to keep pace with the real clock regardless.
    expect(view._prevSimDay).toBeCloseTo(simApi.getSimTime(), 6);
    expect(view._hud.el.querySelector('[data-field="meteor-notice"]').textContent).toBe(perseidsNotice);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(perseidsNotice);
  });
});

describe('EarthView F8 meteor shed integration (mirrors aurora setVisible wiring)', () => {
  it('setMeteorsShed toggles meteor visibility through the real shed pipeline', () => {
    const meteors = makeMeteors();
    const { view } = makeView({
      simApi: makeSimApi(),
      eclipseRig: makeEclipseRig(),
      aurora: makeAurora(),
      flightService: makeFlightService(),
      meteors,
    });
    view.onEnter(null);

    view.setMeteorsShed(true);
    expect(meteors.setVisible).toHaveBeenLastCalledWith(false);
    view.setMeteorsShed(false);
    expect(meteors.setVisible).toHaveBeenLastCalledWith(true);
  });
});
