// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as assets from './ttsAssets.js';
import { init as initTts, speak, cancel, setMuted } from './tts.js';

const LINE = '태양. 태양은 스스로 빛나는 별이에요.';
const LINE_ID = 'abc123def4567890';

/** An <audio> stand-in that records what happened to it. */
function installAudio() {
  const made = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.paused = false;
      this.currentTime = 0;
      this.muted = false;
      this._listeners = {};
      made.push(this);
    }
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); }
    play() { this.played = true; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  globalThis.Audio = FakeAudio;
  return made;
}

beforeEach(() => {
  assets._setManifestForTest({ [LINE_ID]: LINE });
});

afterEach(() => {
  delete globalThis.Audio;
  assets.stop();
  setMuted(false);
});

describe('ttsAssets — recorded takes', () => {
  it('knows which lines were baked', () => {
    expect(assets.has(LINE)).toBe(true);
    expect(assets.has('한 번도 녹음한 적 없는 문장이에요.')).toBe(false);
  });

  it('matches on the exact final sentence, whitespace trimmed', () => {
    expect(assets.has(`  ${LINE}  `)).toBe(true);
    expect(assets.has(LINE.replace('.', '!'))).toBe(false);
  });

  it('plays the file named by the phrase id', () => {
    const made = installAudio();
    expect(assets.play(LINE)).toBe(true);
    expect(made).toHaveLength(1);
    expect(made[0].src).toContain(`${LINE_ID}.mp3`);
    expect(made[0].played).toBe(true);
  });

  it('answers false for an unbaked line, so the caller can fall back', () => {
    installAudio();
    expect(assets.play('녹음이 없는 문장이에요.')).toBe(false);
  });

  it('answers false where there is no Audio at all', () => {
    expect(assets.play(LINE)).toBe(false);
  });

  it('stops the previous take before starting the next', () => {
    const made = installAudio();
    assets.play(LINE);
    assets.play(LINE);
    expect(made[0].paused).toBe(true);
  });

  it('stop() halts and rewinds', () => {
    const made = installAudio();
    assets.play(LINE);
    assets.stop();
    expect(made[0].paused).toBe(true);
    expect(made[0].currentTime).toBe(0);
  });

  it('survives a manifest that never loads', async () => {
    await assets.init({ fetchFn: () => Promise.reject(new Error('offline')) });
    // The reject path replaces the test manifest, which is the point: nothing
    // throws and every lookup simply answers "no".
    expect(() => assets.has(LINE)).not.toThrow();
  });
});

describe('tts.speak routes to the recorded take when there is one', () => {
  it('plays the file and never touches the speech engine', () => {
    const made = installAudio();
    const synth = { speaking: false, pending: false, speak: vi.fn(), cancel: vi.fn(),
      getVoices: () => [{ lang: 'ko-KR', name: 'Yuna' }], addEventListener: () => {}, removeEventListener: () => {} };
    initTts({ synth, storage: null });
    assets._setManifestForTest({ [LINE_ID]: LINE });

    speak(LINE);

    expect(made).toHaveLength(1);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('falls back to the speech engine for a line that was never baked', () => {
    installAudio();
    const synth = { speaking: false, pending: false, speak: vi.fn(), cancel: vi.fn(),
      getVoices: () => [{ lang: 'ko-KR', name: 'Yuna' }], addEventListener: () => {}, removeEventListener: () => {} };
    initTts({ synth, storage: null });
    assets._setManifestForTest({ [LINE_ID]: LINE });

    speak('녹음이 없는 새로운 문장이에요.');

    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('plays a recorded take even where the device has no speech engine at all', () => {
    const made = installAudio();
    initTts({ synth: null, storage: null });
    assets._setManifestForTest({ [LINE_ID]: LINE });

    speak(LINE);

    expect(made).toHaveLength(1);
  });

  it('stays silent while muted, on either backend', () => {
    const made = installAudio();
    const synth = { speaking: false, pending: false, speak: vi.fn(), cancel: vi.fn(),
      getVoices: () => [{ lang: 'ko-KR', name: 'Yuna' }], addEventListener: () => {}, removeEventListener: () => {} };
    initTts({ synth, storage: null });
    assets._setManifestForTest({ [LINE_ID]: LINE });
    setMuted(true);

    speak(LINE);
    speak('녹음이 없는 문장이에요.');

    expect(made).toHaveLength(0);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('cancel() stops a playing file, not just an utterance', () => {
    const made = installAudio();
    initTts({ synth: null, storage: null });
    assets._setManifestForTest({ [LINE_ID]: LINE });

    speak(LINE);
    cancel();

    expect(made[0].paused).toBe(true);
  });
});
