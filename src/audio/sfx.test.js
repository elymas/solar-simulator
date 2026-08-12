import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { init, unlockAudio, isUnlocked, playChime, playTwinkle, playFanfare } from './sfx.js';
import { init as initTts, setMuted } from './tts.js';

const MUTE_KEY = 'solar.muted';

// An AudioContext-shaped fake. `calls` preserves ordering so the iOS unlock rule
// ("resume before any node exists") is observable, and `nodes` counts every node
// the module creates so the muted path can be asserted at zero.
function createFakeAudioContext() {
  const ctx = {
    calls: [],
    nodes: [],
    state: 'suspended',
    currentTime: 10,
    destination: { name: 'destination' },
    resume() {
      ctx.calls.push('resume');
      ctx.state = 'running';
      return Promise.resolve();
    },
    createOscillator() {
      ctx.calls.push('createOscillator');
      const node = {
        kind: 'oscillator',
        type: '',
        frequency: { value: 0, setValueAtTime: (v) => (node.frequency.value = v) },
        startedAt: null,
        stoppedAt: null,
        connect: () => {},
        start: (t) => (node.startedAt = t),
        stop: (t) => (node.stoppedAt = t),
      };
      ctx.nodes.push(node);
      return node;
    },
    createGain() {
      ctx.calls.push('createGain');
      const node = {
        kind: 'gain',
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => {},
      };
      ctx.nodes.push(node);
      return node;
    },
  };
  return ctx;
}

function oscillators(ctx) {
  return ctx.nodes.filter((n) => n.kind === 'oscillator');
}

function unmutedStorage(muted = false) {
  const map = new Map([[MUTE_KEY, muted ? 'true' : 'false']]);
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
}

describe('sfx (REQ-PLAY-303, AC-PLAY-303)', () => {
  let ctx;

  beforeEach(() => {
    ctx = createFakeAudioContext();
    initTts({ synth: null, storage: unmutedStorage(false) });
    init({ audioContext: () => ctx });
  });

  describe('lazy construction', () => {
    it('builds no AudioContext until the unlock gesture', () => {
      let built = 0;
      init({
        audioContext: () => {
          built += 1;
          return ctx;
        },
      });
      expect(built).toBe(0);
      expect(isUnlocked()).toBe(false);

      unlockAudio();
      expect(built).toBe(1);

      unlockAudio();
      expect(built, 'the context is built once and reused').toBe(1);
    });

    it('accepts an AudioContext instance as well as a factory', () => {
      init({ audioContext: ctx });
      unlockAudio();
      expect(ctx.calls).toContain('resume');
    });
  });

  describe('unlock-before-play ordering (iOS)', () => {
    it('plays nothing before the unlock gesture', () => {
      expect(playChime()).toBe(false);
      expect(playTwinkle()).toBe(false);
      expect(playFanfare()).toBe(false);
      expect(ctx.calls).toEqual([]);
      expect(ctx.nodes).toEqual([]);
    });

    it('resumes before it ever creates a node', () => {
      unlockAudio();
      expect(isUnlocked()).toBe(true);
      expect(playChime()).toBe(true);
      expect(ctx.calls[0]).toBe('resume');
      expect(ctx.calls.indexOf('resume')).toBeLessThan(ctx.calls.indexOf('createOscillator'));
    });
  });

  describe('mute gating — the shared "소리" toggle', () => {
    it('creates zero nodes while the KIDS-001 setting says muted', () => {
      initTts({ synth: null, storage: unmutedStorage(true) }); // persisted mute, read by tts.js
      unlockAudio();
      expect(playChime()).toBe(false);
      expect(playTwinkle()).toBe(false);
      expect(playFanfare()).toBe(false);
      expect(ctx.nodes).toEqual([]);
    });

    it('follows the toggle live, in both directions', () => {
      unlockAudio();
      setMuted(true);
      expect(playChime()).toBe(false);
      expect(ctx.nodes).toEqual([]);

      setMuted(false);
      expect(playChime()).toBe(true);
      expect(oscillators(ctx).length).toBeGreaterThan(0);
    });

    it('never reads the mute key itself (tts.js owns it)', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/audio/sfx.js'), 'utf8');
      expect(source).not.toContain(MUTE_KEY);
      expect(source).not.toMatch(/\blocalStorage\b/);
      expect(source).toMatch(/import \{ isMuted \} from '\.\/tts\.js'/);
    });
  });

  describe('the three one-shots', () => {
    beforeEach(() => unlockAudio());

    it.each([
      ['chime', playChime],
      ['twinkle', playTwinkle],
      ['fanfare', playFanfare],
    ])('%s finishes within 0.5s', (_name, play) => {
      expect(play()).toBe(true);
      const stops = oscillators(ctx).map((n) => n.stoppedAt);
      expect(stops.every((t) => typeof t === 'number')).toBe(true);
      expect(Math.max(...stops) - ctx.currentTime).toBeLessThanOrEqual(0.5);
    });

    it('gives each sound a distinct signature', () => {
      const signature = (play) => {
        const fresh = createFakeAudioContext();
        init({ audioContext: fresh });
        unlockAudio();
        play();
        return oscillators(fresh)
          .map((n) => `${n.type}:${Math.round(n.frequency.value)}`)
          .join(',');
      };
      const [chime, twinkle, fanfare] = [playChime, playTwinkle, playFanfare].map(signature);
      expect(new Set([chime, twinkle, fanfare]).size).toBe(3);
    });

    it('pairs every oscillator with a gain envelope and starts it', () => {
      playChime();
      const oscs = oscillators(ctx);
      expect(oscs.length).toBeGreaterThan(0);
      expect(ctx.nodes.filter((n) => n.kind === 'gain')).toHaveLength(oscs.length);
      expect(oscs.every((n) => typeof n.startedAt === 'number')).toBe(true);
    });
  });

  describe('degradation', () => {
    it('stays silent and calm when no AudioContext exists', () => {
      init({ audioContext: null });
      expect(unlockAudio()).toBe(false);
      expect(isUnlocked()).toBe(false);
      expect(playChime()).toBe(false);
    });

    it('survives a constructor that throws', () => {
      init({
        audioContext: () => {
          throw new Error('NotAllowedError');
        },
      });
      expect(unlockAudio()).toBe(false);
      expect(playChime()).toBe(false);
    });

    it('swallows the rejected promise a real resume() returns off-gesture', async () => {
      const hostile = createFakeAudioContext();
      hostile.resume = () => {
        hostile.calls.push('resume');
        return Promise.reject(new Error('NotAllowedError'));
      };
      init({ audioContext: hostile });
      expect(unlockAudio()).toBe(true); // synchronous call succeeded
      // An unhandled rejection would fail this test file outright.
      await new Promise((r) => setTimeout(r, 0));
      expect(hostile.calls).toContain('resume');
    });

    it('survives a context whose resume throws', () => {
      const hostile = createFakeAudioContext();
      hostile.resume = () => {
        throw new Error('NotAllowedError');
      };
      init({ audioContext: hostile });
      expect(unlockAudio()).toBe(false);
      expect(playChime()).toBe(false);
    });
  });
});
