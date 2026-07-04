import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { EarthView } from '../src/earth/EarthView.js';

function makeView({ isMobile = false } = {}) {
  const rig = { group: new THREE.Group(), update: vi.fn(), dispose: vi.fn() };
  const controls = { enabled: false, update: vi.fn(), dispose: vi.fn() };
  const view = new EarthView({
    isMobile,
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

describe('EarthView interface + scaffold (E6, REQ-310/315)', () => {
  it('implements the frozen View interface identically to SolarSystemView', () => {
    const { view } = makeView();
    for (const m of ['mount', 'unmount', 'onEnter', 'onExit', 'update', 'getScenePass', 'dispose']) {
      expect(typeof view[m], m).toBe('function');
    }
  });

  it('getScenePass returns its own scene + earth-local camera', () => {
    const { view } = makeView();
    const pass = view.getScenePass();
    expect(pass.scene).toBe(view.scene);
    expect(pass.camera).toBe(view.camera);
    expect(pass.camera.isPerspectiveCamera).toBe(true);
  });

  it('exposes empty F5/F6/F7 mount points in the scene (REQ-350/360)', () => {
    const { view } = makeView();
    expect(view.scene.children).toContain(view.aircraftLayer);
    expect(view.scene.children).toContain(view.eclipseLayer);
    expect(view.scene.children).toContain(view.auroraLayer);
    expect(view.aircraftLayer.children).toHaveLength(0);
  });

  it('borrows the shared renderer via mount, never constructing its own', () => {
    const { view, controls } = makeView();
    const renderer = { domElement: {} };
    const composer = {};
    view.mount(renderer, composer);
    expect(view.renderer).toBe(renderer);
    expect(view.composer).toBe(composer);
    expect(view.controls).toBe(controls);
  });
});

describe('EarthView lazy asset lifecycle (E9, REQ-355)', () => {
  it('does not build the rig until first onEnter', () => {
    const { view } = makeView();
    expect(view._rig).toBeNull();
    view.onEnter(null);
    expect(view._rig).not.toBeNull();
    expect(view.scene.children).toContain(view._rig.group);
  });

  it('disposes rig + HUD on mobile exit and rebuilds on re-entry', () => {
    const { view } = makeView({ isMobile: true });
    view.onEnter(null);
    const firstRig = view._rig;
    view.onExit();
    expect(firstRig.dispose).toHaveBeenCalledTimes(1);
    expect(view._rig).toBeNull();
    expect(view._built).toBe(false);
    view.onEnter(null); // re-entry rebuilds
    expect(view._rig).not.toBeNull();
  });

  it('keeps the rig resident on desktop exit (instant re-entry)', () => {
    const { view, rig } = makeView({ isMobile: false });
    view.onEnter(null);
    view.onExit();
    expect(rig.dispose).not.toHaveBeenCalled();
    expect(view._rig).toBe(rig);
  });

  it('invokes the F5 poll-stop hook on every exit', () => {
    const { view } = makeView();
    const onStop = vi.fn();
    view.onStopPolling = onStop;
    view.onEnter(null);
    view.onExit();
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(view._pollStopped).toBe(true);
  });
});

describe('EarthView exit request wiring (E8, REQ-340)', () => {
  it('routes the HUD back button through the exit handler', () => {
    const { view } = makeView();
    const onExit = vi.fn();
    view.setExitRequestHandler(onExit);
    view.onEnter(null); // builds HUD
    view._hud.backButton.click();
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('no geolocation / permissions in the earth view (REQ-380)', () => {
  it('never references navigator.geolocation or permissions anywhere under src/earth', () => {
    const dir = join(process.cwd(), 'src', 'earth');
    const offenders = [];
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.js')) continue;
      const src = readFileSync(join(dir, name), 'utf8');
      if (/navigator\s*\.\s*(geolocation|permissions)/.test(src)) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });
});
