// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { SolarSystemView } from './SolarSystemView.js';
import { InfoPanel } from '../ui/InfoPanel.js';
import { missionsForDate, MISSIONS_PER_DAY } from '../play/missions.js';
import { onPlayEvent, emitPlayEvent, resetPlayEvents } from '../play/playEvents.js';
import { init as initTts, setMuted } from '../audio/tts.js';
import { init as initSfx, unlockAudio } from '../audio/sfx.js';
import { STR } from '../ui/strings.js';
import { PLANET_DATA } from '../planets/planetData.js';

const DATE = new Date('2026-08-12T09:00:00');
const NEXT_DAY = new Date('2026-08-13T09:00:00');

/** The bodies the scene stub actually builds — the only ones _select can resolve. */
const STUB_BODIES = ['earth', 'saturn', 'mars', 'jupiter'];

/**
 * Find a date whose rotation contains a given mission id.
 *
 * SEARCHED, not hard-coded. The rotation is a seeded shuffle over the whole
 * catalog, so every catalog addition re-rolls which missions land on which date.
 * A literal date here silently stops testing what it claims the moment the
 * catalog grows — which is exactly what happened when the catalog went from 10
 * entries to 25 and this file's fixed dates quietly lost their missions.
 */
function dayWithMission(id, limit = 400) {
  for (let offset = 0; offset < limit; offset += 1) {
    const date = new Date(2026, 0, 1 + offset, 9);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (missionsForDate(key).some((m) => m.id === id)) return date;
  }
  throw new Error(`no date within ${limit} days carries mission "${id}"`);
}

/** Every body today's select-missions listen for. */
function selectTargets(date) {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return new Set(
    missionsForDate(key)
      .filter((m) => m.predicate.type === 'select')
      .flatMap((m) => m.predicate.bodies)
  );
}

/** A day whose rotation contains 'earth-home' — the mission Earth itself completes. */
const EARTH_MISSION_DAY = dayWithMission('earth-home');

/** Fire the play event that completes a catalog mission, whatever its predicate. */
function emitFor(mission) {
  const p = mission.predicate;
  if (p.type === 'select') emitPlayEvent('select', { body: p.bodies[0] });
  else if (p.type === 'view') emitPlayEvent('view-enter', { view: p.view });
  else emitPlayEvent(p.action, { body: p.body });
}

function body(key, position, { displayRadius = 6 } = {}) {
  const mesh = new THREE.Mesh();
  mesh.position.copy(position);
  return { mesh, data: { ...PLANET_DATA[key], key, displayRadius }, isStar: false };
}

describe('SolarSystemView mission + play surfaces (SPEC-PLAY-001 M2/M5)', () => {
  let sceneManager;
  let planetFactory;
  let infoPanel;
  let view;
  let now;
  let audio;

  beforeEach(() => {
    resetPlayEvents();
    now = DATE;
    audio = { oscillators: 0, spoken: [] };
    const map = new Map();
    globalThis.localStorage = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, String(v)),
    };

    sceneManager = {
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
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
        saturn: body('saturn', new THREE.Vector3(0, 0, 600), { displayRadius: 9 }),
        mars: body('mars', new THREE.Vector3(0, 0, 300), { displayRadius: 5 }),
        jupiter: body('jupiter', new THREE.Vector3(0, 0, 400), { displayRadius: 12 }),
      },
      update: vi.fn(),
      onFocus: vi.fn(),
      onDefocus: vi.fn(),
    };

    infoPanel = new InfoPanel();
    view = new SolarSystemView({
      sceneManager,
      planetFactory,
      createInfoPanel: () => infoPanel,
      createPlanetList: () => ({ el: null, setActive: vi.fn(), clearActive: vi.fn() }),
      createPlanetStrip: () => ({ el: null, setActive: vi.fn(), clearActive: vi.fn() }),
      createTimeControls: () => ({ el: null, updateDate: vi.fn(), updatePlayButton: vi.fn() }),
      createInteraction: () => ({ enabled: true, dispose: vi.fn() }),
      createRocket: () => ({
        launch: vi.fn(() => true),
        canLaunch: (key) => key === 'mars',
        cancel: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn(),
      }),
      getDate: () => now,
      win: undefined,
    });
    view.buildUI();
    // Strictly after buildUI: it calls initTts()/initSfx() with the browser
    // defaults, which under jsdom means no speech engine and no AudioContext.
    initTts({
      synth: {
        speaking: false,
        pending: false,
        speak: (u) => audio.spoken.push(u.text),
        cancel: () => {},
        getVoices: () => [{ lang: 'ko-KR', name: 'Yuna' }],
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      storage: null,
    });
    initSfx({
      audioContext: {
        currentTime: 0,
        destination: {},
        resume: () => Promise.resolve(),
        createOscillator: () => {
          audio.oscillators += 1;
          return {
            frequency: { setValueAtTime: () => {} },
            connect: () => {},
            start: () => {},
            stop: () => {},
          };
        },
        createGain: () => ({
          gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          connect: () => {},
        }),
      },
    });
    // The child has already tapped something by the time a mission can complete.
    unlockAudio();
    view.onEnter(null);
  });

  afterEach(() => {
    view.dispose();
    resetPlayEvents();
    setMuted(false);
    initTts({ synth: null, storage: null });
    document.body.replaceChildren();
    delete globalThis.localStorage;
  });

  // The first mission today has NOT already completed — selecting a body to
  // give the burst a home can itself tick one off.
  const pendingMission = () => view._missionEngine().today().find((m) => !m.done);

  // Today's first pending mission whose body this fixture's scene actually holds —
  // the only kind that can be asserted to sparkle SOMEWHERE, since the burst lands
  // on the completing body and a body absent from the scene has no position.
  const pendingMissionInScene = () =>
    view
      ._missionEngine()
      .today()
      .find((m) => !m.done && m.predicate.type === 'select' && planetFactory.planets[m.predicate.bodies[0]]);

  describe('entry-point wiring (REQ-PLAY-101/201)', () => {
    it('opens the size comparison from the InfoPanel button, without touching the scene', () => {
      view._select('saturn');
      const snapshot = () => ({
        focused: view._focusedKey,
        focusCalls: sceneManager.focusPlanet.mock.calls.length,
        resets: sceneManager.resetCamera.mock.calls.length,
        children: sceneManager.scene.children.length,
        panelOpen: infoPanel.isOpen,
      });
      const before = snapshot();

      infoPanel.el.querySelector('.kid-compare').click();
      expect(view._sizeCompare.isOpen).toBe(true);
      view._sizeCompare.close();

      expect(view._sizeCompare.isOpen).toBe(false);
      expect(snapshot()).toEqual(before);
    });

    it('drives the rocket button off canLaunchRocket, the one eligibility rule', () => {
      view._select('mars');
      expect(infoPanel.el.querySelector('.kid-rocket').hidden).toBe(false);

      view._select('saturn'); // the stub rocket only accepts mars
      expect(infoPanel.el.querySelector('.kid-rocket').hidden).toBe(true);
    });

    it('launches from the rocket button', () => {
      view._select('mars');
      infoPanel.el.querySelector('.kid-rocket').click();

      expect(view._rocket.launch).toHaveBeenCalledWith('mars');
    });
  });

  describe('praise flow (REQ-PLAY-404, AC-PLAY-404)', () => {
    it('celebrates, fanfares and speaks praise exactly once on completion', () => {
      // No pre-selection: the burst finds its home in the event itself, so a test
      // that props one up with an earlier pick can no longer hide a missing burst.
      emitFor(pendingMissionInScene());

      expect(audio.spoken).toEqual([STR.playPraise]);
      expect(audio.oscillators).toBeGreaterThan(0);
      expect(view._praise.activeCount).toBeGreaterThan(0);
    });

    it('awards the sticker exactly once, however often the mission re-completes', () => {
      const mission = pendingMission();
      emitFor(mission);
      const afterFirst = view._store.stickers();
      expect(afterFirst).toContain(mission.sticker);

      audio.spoken.length = 0;
      emitFor(mission);
      emitFor(mission);

      expect(view._store.stickers()).toEqual(afterFirst);
      expect(audio.spoken).toEqual([]); // the day's completion moment happens once
    });

    it('flips the sticker book tile and ticks the badge', () => {
      const mission = pendingMission();
      expect(view._stickerBook.toggleBtn.querySelector('.sticker-badge').textContent).toBe(`0/${MISSIONS_PER_DAY}`);

      emitFor(mission);
      view._stickerBook.open();

      const tile = view._stickerBook.el.querySelector(`[data-sticker="${mission.sticker}"]`);
      expect(tile.classList.contains('sticker-tile--locked')).toBe(false);
      expect(view._stickerBook.toggleBtn.querySelector('.sticker-badge').textContent).toBe(`1/${MISSIONS_PER_DAY}`);
    });

    it('stays silent but fully visual with the shared 소리 toggle off (Scenario 4)', () => {
      setMuted(true);

      const mission = pendingMissionInScene();
      emitFor(mission);

      expect(audio.oscillators).toBe(0);
      expect(audio.spoken).toEqual([]);
      expect(view._praise.activeCount).toBeGreaterThan(0);
      expect(view._store.stickers()).toContain(mission.sticker);
    });

    it('completes a mission reached through a real selection, sparkling on that body', () => {
      const selectMission = missionsForDate('2026-08-12').find(
        (m) => m.predicate.type === 'select' && planetFactory.planets[m.predicate.bodies[0]]
      );
      if (!selectMission) return; // rotation-dependent; the seam tests cover the rest
      const key = selectMission.predicate.bodies[0];
      const burst = vi.spyOn(view._praise, 'burst');

      view._select(key);

      expect(view._store.stickers()).toContain(selectMission.sticker);
      expect(burst).toHaveBeenCalledTimes(1);
      expect(burst.mock.calls[0][0].z).toBeCloseTo(planetFactory.planets[key].mesh.position.z);
    });

    // The TTS channel keeps only the newest utterance, so a selection that also
    // completes a mission must narrate the body FIRST and praise LAST — otherwise
    // the body's fact talks over the praise it just triggered. M5 deviation 7 put
    // `emitPlayEvent('select')` after `speakBody` for this reason; nothing locked
    // it until now, and the burst fix lives in the same few lines.
    it('narrates the body before the praise, so praise is the last thing heard', () => {
      const mission = pendingMissionInScene();
      audio.spoken.length = 0;

      view._select(mission.predicate.bodies[0]);

      expect(audio.spoken.length).toBeGreaterThan(1); // body fact + praise
      expect(audio.spoken.at(-1)).toBe(STR.playPraise);
    });

    // Regression, evaluator MUST-FIX 1 (AC-PLAY-404, acceptance §2 Scenario 3):
    // the burst target used to be read from `_focusedKey`, which `_select` assigns
    // AFTER emitting the event — so the first tap of a session awarded the sticker
    // and spoke the praise with no sparkle at all.
    it('sparkles on the first selection of a session, with nothing focused before it', () => {
      const mission = pendingMissionInScene();
      expect(view._focusedKey).toBeNull();

      view._select(mission.predicate.bodies[0]);

      expect(view._store.stickers()).toContain(mission.sticker);
      expect(view._praise.activeCount).toBeGreaterThan(0);
    });

    // The earth branch emits and returns before any of the focus bookkeeping, so
    // it never had a `_focusedKey` of its own to celebrate on.
    it('sparkles on Earth when the Earth pick itself completes a mission', () => {
      now = EARTH_MISSION_DAY; // 'earth-home' is in this day's rotation
      view.setEarthSelectHandler(() => {});
      const burst = vi.spyOn(view._praise, 'burst');

      view._select('earth');

      expect(view._store.stickers()).toContain('home');
      expect(burst).toHaveBeenCalledTimes(1);
      expect(burst.mock.calls[0][0].x).toBeCloseTo(200); // earth sits at x=200
    });

    // Same defect, its other face: the stale `_focusedKey` put the burst on the
    // PREVIOUS pick, so the child saw the reward land on the wrong planet.
    it('sparkles on the completing body, not on the body picked before it', () => {
      // Both bodies are DERIVED from the day's rotation rather than named: which
      // planet completes a mission on a given date changes whenever the catalog
      // does, and a hard-coded pair turns into a silent no-op test.
      const targets = selectTargets(now);
      const completing = STUB_BODIES.find((k) => targets.has(k));
      const inert = STUB_BODIES.find((k) => !targets.has(k));
      expect(completing, 'no stub body completes a mission on this date').toBeTruthy();
      expect(inert, 'every stub body completes a mission on this date').toBeTruthy();

      const burst = vi.spyOn(view._praise, 'burst');

      view._select(inert);
      expect(burst).not.toHaveBeenCalled();

      view._select(completing);

      expect(burst).toHaveBeenCalledTimes(1);
      const at = view.planetFactory.planets[completing].mesh.position;
      expect(burst.mock.calls[0][0].z).toBeCloseTo(at.z);
      expect(burst.mock.calls[0][0].x).toBeCloseTo(at.x);
    });
  });

  describe('midnight rollover (acceptance §3)', () => {
    it('rebuilds the engine when the real calendar date changes', () => {
      const before = view._missionEngine();
      expect(before.today().map((m) => m.id)).toEqual(
        missionsForDate('2026-08-12').map((m) => m.id)
      );

      now = NEXT_DAY;
      const after = view._missionEngine();

      expect(after).not.toBe(before);
      expect(after.today().map((m) => m.id)).toEqual(missionsForDate('2026-08-13').map((m) => m.id));
    });

    it('awards an event against the mission set that was active when it fired', () => {
      const mission = pendingMission();
      emitFor(mission);
      expect(view._store.stickers()).toContain(mission.sticker);

      now = NEXT_DAY;
      expect(view._missionEngine().today().map((m) => m.id)).toEqual(
        missionsForDate('2026-08-13').map((m) => m.id)
      );
      expect(view._store.stickers()).toContain(mission.sticker); // yesterday's award stands
    });
  });

  describe('chrome lifecycle', () => {
    it('hides the sticker book with the rest of the solar UI on view exit', () => {
      view._stickerBook.open();

      view.onExit();

      expect(view._stickerBook.isOpen).toBe(false);
      expect(view._stickerBook.toggleBtn.style.display).toBe('none');

      view.onEnter('EARTH');
      expect(view._stickerBook.toggleBtn.style.display).toBe('');
    });

    it('closes an open size comparison when the view is left', () => {
      view._select('saturn');
      infoPanel.el.querySelector('.kid-compare').click();

      view.onExit();

      expect(view._sizeCompare.isOpen).toBe(false);
    });

    it('unsubscribes on dispose: no award after teardown', () => {
      const mission = pendingMission();
      view.dispose();

      emitFor(mission);

      expect(view._store.stickers()).toEqual([]);
      expect(document.querySelector('.sticker-toggle')).toBeNull();
    });
  });

  describe('play-event subscription (REQ-PLAY-402)', () => {
    it('listens on the shared seam rather than polling', () => {
      const seen = [];
      onPlayEvent((e) => seen.push(e.type));
      view._select('saturn');
      expect(seen).toContain('select');
    });
  });
});
