import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { SolarSystemView } from './SolarSystemView.js';
import { Celebration, SPARKLE, TWINKLE } from '../effects/Celebration.js';
import { onPlayEvent, resetPlayEvents } from '../play/playEvents.js';
import { init as initTts, isMuted } from '../audio/tts.js';
import { init as initSfx } from '../audio/sfx.js';

const MUTE_KEY = 'solar.muted';

// jsdom exposes no localStorage here, so the global the app reads at boot is
// stood up for the duration of the test file.
function installStorage() {
  const map = new Map();
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
    clear: () => map.clear(),
  };
  globalThis.localStorage = storage;
  return storage;
}

function body(key, position, { displayRadius = 6, isStar = false } = {}) {
  const mesh = new THREE.Mesh();
  mesh.position.copy(position);
  return { mesh, data: { key, displayRadius, nameKo: key }, isStar };
}

/**
 * A speechSynthesis-shaped fake and an AudioContext-shaped fake sharing one
 * ordering log, so "which channel was primed first" is directly observable.
 */
function audioFakes(log) {
  const synth = {
    speaking: false,
    pending: false,
    speak: (u) => log.push(`speak:${u.text}`),
    cancel: () => log.push('cancel'),
    getVoices: () => [{ lang: 'ko-KR', name: 'Yuna' }],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const audioContext = {
    currentTime: 0,
    destination: {},
    resume: () => {
      log.push('resume');
      return Promise.resolve();
    },
    createOscillator: () => ({
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
    }),
    createGain: () => ({
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
    }),
  };
  return { synth, audioContext };
}

describe('SolarSystemView play wiring (SPEC-PLAY-001 M3/M4)', () => {
  let sceneManager;
  let planetFactory;
  let view;
  let sounds;
  let rocket;
  let events;
  let storage;

  beforeEach(() => {
    resetPlayEvents();
    storage = installStorage();
    events = [];
    onPlayEvent((event) => events.push(event));

    sceneManager = {
      scene: new THREE.Scene(),
      controls: { enabled: true, target: new THREE.Vector3(), update: () => {} },
      focusPlanet: vi.fn(),
      resetCamera: vi.fn(),
      stepCamera: vi.fn(),
      setHoveredObject: vi.fn(),
      dispose: vi.fn(),
      onFocusArrive: null,
    };
    planetFactory = {
      planets: {
        earth: body('earth', new THREE.Vector3(200, 0, 0), { displayRadius: 8 }),
        mars: body('mars', new THREE.Vector3(0, 0, 300), { displayRadius: 5 }),
        sirius: body('sirius', new THREE.Vector3(9000, 0, 0), { displayRadius: 20, isStar: true }),
      },
      update: vi.fn(),
      onFocus: vi.fn(),
      onDefocus: vi.fn(),
    };

    sounds = { [SPARKLE]: vi.fn(), [TWINKLE]: vi.fn() };
    rocket = {
      launch: vi.fn(() => true),
      canLaunch: vi.fn(() => true),
      cancel: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    };

    view = new SolarSystemView({
      sceneManager,
      planetFactory,
      createInfoPanel: () => ({ el: null, show: (key, data) => data, hide: vi.fn() }),
      createPlanetList: () => ({ el: null, setActive: vi.fn(), clearActive: vi.fn() }),
      createPlanetStrip: () => ({ el: null, setActive: vi.fn(), clearActive: vi.fn() }),
      createTimeControls: () => ({ el: null, updateDate: vi.fn(), updatePlayButton: vi.fn() }),
      createInteraction: () => ({ enabled: true, dispose: vi.fn() }),
      createCelebration: (opts) => new Celebration({ ...opts, sounds }),
      createRocket: () => rocket,
      win: undefined,
    });
  });

  afterEach(() => {
    resetPlayEvents();
    initTts({ synth: null, storage: null });
    delete globalThis.localStorage;
  });

  describe('shared gesture unlock (plan §A.6)', () => {
    it('loads the persisted mute state during buildUI, before any celebration can fire', () => {
      storage.setItem(MUTE_KEY, 'true');
      expect(isMuted(), 'the module default lies until init() has read storage').toBe(false);

      view.buildUI();

      expect(isMuted()).toBe(true);
    });

    it('primes the effects channel before it speaks, from the same tap', () => {
      view.buildUI();
      const log = [];
      const { synth, audioContext } = audioFakes(log);
      initTts({ synth, storage });
      initSfx({ audioContext });

      view._select('mars');

      expect(log[0], 'iOS only starts a suspended context from the gesture').toBe('resume');
      expect(log.some((entry) => entry.startsWith('speak:'))).toBe(true);
    });
  });

  describe('camera arrival (REQ-PLAY-301/302, AC-PLAY-301/302)', () => {
    beforeEach(() => view.buildUI());

    it('registers itself as the arrival listener', () => {
      expect(typeof sceneManager.onFocusArrive).toBe('function');
    });

    it('bursts exactly one sparkle with exactly one chime at the body', () => {
      view._select('mars');
      expect(sounds[SPARKLE]).not.toHaveBeenCalled();

      sceneManager.onFocusArrive();

      expect(sounds[SPARKLE]).toHaveBeenCalledTimes(1);
      expect(sounds[TWINKLE]).not.toHaveBeenCalled();
      expect(view._celebration.activeCount).toBeGreaterThan(0);
    });

    it('gives a star the twinkle variant instead (REQ-PLAY-302)', () => {
      view._select('sirius');
      sceneManager.onFocusArrive();

      expect(sounds[TWINKLE]).toHaveBeenCalledTimes(1);
      expect(sounds[SPARKLE]).not.toHaveBeenCalled();
    });

    it('celebrates nothing when the arrival has no selection behind it', () => {
      sceneManager.onFocusArrive();
      expect(sounds[SPARKLE]).not.toHaveBeenCalled();
      expect(sounds[TWINKLE]).not.toHaveBeenCalled();
    });

    it('pumps the pool from the frame loop', () => {
      view._select('mars');
      sceneManager.onFocusArrive();
      expect(view._celebration.activeCount).toBeGreaterThan(0);

      for (let i = 0; i < 100; i += 1) view.update(0.05);

      expect(view._celebration.activeCount).toBe(0);
    });
  });

  describe('play events (plan §A.3)', () => {
    beforeEach(() => view.buildUI());

    it('emits select for every body the child picks', () => {
      view._select('mars');
      expect(events).toContainEqual({ type: 'select', body: 'mars' });
    });

    it('emits select for Earth even though it routes to the Earth view', () => {
      const toEarth = vi.fn();
      view.setEarthSelectHandler(toEarth);

      view._select('earth');

      expect(events).toContainEqual({ type: 'select', body: 'earth' });
      expect(toEarth).toHaveBeenCalledTimes(1);
    });

    it('emits nothing for a body the scene does not have', () => {
      view._select('planet-x');
      expect(events).toEqual([]);
    });

    it('emits view-enter when the solar view becomes active', () => {
      view.onEnter('EARTH');
      expect(events).toContainEqual({ type: 'view-enter', view: 'SOLAR' });
    });
  });

  describe('rocket seams (REQ-PLAY-204, AC-PLAY-204)', () => {
    beforeEach(() => view.buildUI());

    it('exposes the launch API for the entry-point button', () => {
      expect(view.canLaunchRocket('mars')).toBe(true);
      expect(view.launchRocket('mars')).toBe(true);
      expect(rocket.launch).toHaveBeenCalledWith('mars');
    });

    it('cancels an in-flight rocket when another body is selected', () => {
      view._select('mars');
      expect(rocket.cancel).toHaveBeenCalledTimes(1);
    });

    it('cancels on deselect', () => {
      view._deselect();
      expect(rocket.cancel).toHaveBeenCalledTimes(1);
    });

    it('cancels when the view is left for the Earth view', () => {
      view.onExit();
      expect(rocket.cancel).toHaveBeenCalledTimes(1);
    });

    it('is driven by the frame loop', () => {
      view.update(0.016);
      expect(rocket.update).toHaveBeenCalledTimes(1);
    });

    it('is disposed with the view', () => {
      view.dispose();
      expect(rocket.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('reduced motion (REQ-PLAY-304/205)', () => {
    it('passes the environment preference down to both play modules', () => {
      const seen = {};
      const quiet = new SolarSystemView({
        sceneManager,
        planetFactory,
        createInfoPanel: () => ({ el: null, show: (key, data) => data, hide: vi.fn() }),
        createPlanetList: () => ({ el: null, setActive: vi.fn(), clearActive: vi.fn() }),
        createPlanetStrip: () => ({ el: null, setActive: vi.fn(), clearActive: vi.fn() }),
        createTimeControls: () => ({ el: null, updateDate: vi.fn(), updatePlayButton: vi.fn() }),
        createInteraction: () => ({ enabled: true, dispose: vi.fn() }),
        createCelebration: (opts) => {
          seen.celebration = opts.reducedMotion;
          return new Celebration({ ...opts, sounds });
        },
        createRocket: (opts) => {
          seen.rocket = opts.reducedMotion;
          return rocket;
        },
        win: { matchMedia: () => ({ matches: true }), addEventListener: () => {} },
      });

      quiet.buildUI();

      expect(seen.celebration).toBe(true);
      expect(seen.rocket).toBe(true);
    });
  });
});
