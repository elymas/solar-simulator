import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { EarthView } from '../src/earth/EarthView.js';
import { ECLIPSE_TABLE } from '../src/utils/eclipseData.js';
import { STR } from '../src/ui/strings.js';

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
function makeFlightService() {
  return {
    state: 'OFF', count: 0, lastUpdatedAt: 0,
    start: vi.fn(function () { this.state = 'LOADING'; }),
    stop: vi.fn(function () { this.state = 'OFF'; }),
    tick: vi.fn(), getAircraft: vi.fn(() => []), onState: vi.fn(function (cb) { this._cb = cb; }),
  };
}

function makeView({ isMobile = false, simApi, eclipseRig, aurora, flightService } = {}) {
  const rig = { group: new THREE.Group(), update: vi.fn(), dispose: vi.fn() };
  const view = new EarthView({
    isMobile,
    simApi,
    rigFactory: () => rig,
    controlsFactory: () => ({ enabled: false, update: vi.fn(), dispose: vi.fn() }),
    eclipseRigFactory: () => eclipseRig,
    auroraFactory: () => aurora,
    flightServiceFactory: () => flightService,
    win: { innerWidth: 1024, innerHeight: 768 },
  });
  return { view, rig };
}

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
