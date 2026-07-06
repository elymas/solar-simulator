import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { EarthView } from '../src/earth/EarthView.js';

function makeSimApi({ time = 0, speed = 1, playing = true } = {}) {
  let t = time;
  let s = speed;
  let p = playing;
  return {
    getSimTime: () => t,
    setSimTime: (v) => { t = v; },
    getTimeSpeed: () => s,
    setTimeSpeed: (v) => { s = v; },
    isPlaying: () => p,
    togglePlay: () => { p = !p; },
  };
}

function makeView({ isMobile = false, simApi } = {}) {
  const rig = { group: new THREE.Group(), update: vi.fn(), dispose: vi.fn() };
  const controls = { enabled: false, update: vi.fn(), dispose: vi.fn() };
  const view = new EarthView({
    isMobile,
    simApi,
    rigFactory: () => rig,
    controlsFactory: () => controls,
    win: { innerWidth: 1024, innerHeight: 768 },
  });
  return { view, rig, controls };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('EarthView shared sim clock (TASK-F6-0, REQ-510/530)', () => {
  it('advances the ONE shared clock while active and playing, at its own independent 0.05 rate (ignoring the mock speed)', () => {
    const simApi = makeSimApi({ time: 100, speed: 10, playing: true });
    const { view } = makeView({ simApi });
    view.onEnter(null);
    view.update(1); // 1s * 0.05 days/s = 0.05 sim-days, regardless of speed:10
    expect(simApi.getSimTime()).toBeCloseTo(100.05, 6);
  });

  it('does not advance the clock while paused, and drives the rig at 0 days/s', () => {
    const simApi = makeSimApi({ time: 100, speed: 10, playing: false });
    const { view, rig } = makeView({ simApi });
    view.onEnter(null);
    view.update(0.5);
    expect(simApi.getSimTime()).toBe(100);
    expect(rig.update).toHaveBeenLastCalledWith(0.5, 0);
  });

  it("drives the rig at its own independent default rate, ignoring the main page's time speed", () => {
    const simApi = makeSimApi({ time: 0, speed: 42, playing: true });
    const { view, rig } = makeView({ simApi });
    view.onEnter(null);
    view.update(1);
    expect(rig.update).toHaveBeenLastCalledWith(1, 0.05);
  });

  it('drives the rig at the default rate even with no simApi injected', () => {
    const { view, rig } = makeView({});
    view.onEnter(null);
    expect(() => view.update(0.5)).not.toThrow();
    expect(rig.update).toHaveBeenLastCalledWith(0.5, 0.05);
  });

  it("HUD's onSpeedChange reaches this._daysPerSecond and drives the rig/clock at the new rate", () => {
    const simApi = makeSimApi({ time: 0, speed: 1, playing: true });
    const { view, rig } = makeView({ simApi });
    view.onEnter(null);
    view._hud.onSpeedChange(1.5);
    view.update(1);
    expect(rig.update).toHaveBeenLastCalledWith(1, 1.5);
    expect(simApi.getSimTime()).toBeCloseTo(1.5, 6);
  });
});
