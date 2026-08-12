import { describe, it, expect, beforeEach } from 'vitest';
import { init, speak, speakBody, cancel, setMuted, isMuted, isAvailable } from './tts.js';

const MUTE_KEY = 'solar.muted';

const YUNA = { name: 'Yuna', lang: 'ko-KR' };
const GOOGLE_KO = { name: 'Google 한국의', lang: 'ko-KR' };
const SAMANTHA = { name: 'Samantha', lang: 'en-US' };

// A speechSynthesis-shaped stub. `queue` models live utterances so queue growth
// under rapid re-selection is observable; `calls` preserves speak/cancel ordering.
function createFakeSynth({ voices = [] } = {}) {
  const listeners = new Set();
  const synth = {
    calls: [],
    queue: [],
    utterances: [],
    voices,
    get speaking() {
      return synth.queue.length > 0;
    },
    get pending() {
      return synth.queue.length > 1;
    },
    getVoices() {
      return synth.voices;
    },
    speak(utterance) {
      synth.calls.push('speak');
      synth.utterances.push(utterance);
      synth.queue.push(utterance);
    },
    cancel() {
      synth.calls.push('cancel');
      synth.queue.length = 0;
    },
    addEventListener(type, fn) {
      if (type === 'voiceschanged') listeners.add(fn);
    },
    removeEventListener(type, fn) {
      listeners.delete(fn);
    },
    // Test-only: simulate the async platform voice load (iOS Safari / Chrome).
    loadVoices(next) {
      synth.voices = next;
      for (const fn of listeners) fn();
    },
  };
  return synth;
}

function createFakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    read: (key) => (map.has(key) ? map.get(key) : null),
  };
}

const THROWING_STORAGE = {
  getItem() {
    throw new DOMException('quota');
  },
  setItem() {
    throw new DOMException('quota');
  },
};

const MARS = {
  name: 'Mars',
  nameKo: '화성',
  factsKo: ['붉은 먼지로 덮여 있어요.', '가장 큰 화산이 있어요.', '로봇 탐사차가 달리고 있어요.'],
};
const JUPITER = { name: 'Jupiter', nameKo: '목성', factsKo: ['가장 큰 행성이에요.'] };
const MINOR_MOON = { name: 'Metis', nameKo: '메티스' };

let synth;
let storage;

function boot(options = {}) {
  synth = 'synth' in options ? options.synth : createFakeSynth({ voices: [YUNA] });
  storage = options.storage ?? createFakeStorage();
  init({ synth, storage });
  return synth;
}

beforeEach(() => {
  synth = undefined;
  storage = undefined;
});

describe('AC-KIDS-201 — injectable backend, no browser globals', () => {
  it('exposes every public method against an injected fake synth', () => {
    boot();
    expect(() => {
      speakBody(MARS);
      speak('안녕');
      cancel();
      setMuted(true);
      isMuted();
      isAvailable();
    }).not.toThrow();
    expect(isAvailable()).toBe(true);
  });
});

describe('AC-KIDS-202 — speakBody speaks Korean name + one fact', () => {
  it('produces exactly one speak whose text starts with nameKo and carries a factsKo entry', () => {
    boot();
    speakBody(MARS);

    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(1);
    const utterance = synth.utterances[0];
    expect(utterance.text.startsWith(MARS.nameKo)).toBe(true);
    expect(MARS.factsKo.some((fact) => utterance.text.includes(fact))).toBe(true);
    expect(utterance.lang).toBe('ko-KR');
  });

  it('speaks the name only for a body without factsKo, without throwing', () => {
    boot();
    expect(() => speakBody(MINOR_MOON)).not.toThrow();
    expect(synth.utterances[0].text).toBe(MINOR_MOON.nameKo);
  });

  it('ignores a missing body', () => {
    boot();
    expect(() => speakBody(undefined)).not.toThrow();
    expect(synth.calls).toHaveLength(0);
  });

  it('rotates through factsKo on repeated taps of the same body', () => {
    boot();
    speakBody(MARS);
    speakBody(MARS);
    speakBody(MARS);
    speakBody(MARS);

    const spoken = synth.utterances.map((u) => u.text);
    expect(spoken[0]).toContain(MARS.factsKo[0]);
    expect(spoken[1]).toContain(MARS.factsKo[1]);
    expect(spoken[2]).toContain(MARS.factsKo[2]);
    expect(spoken[3]).toContain(MARS.factsKo[0]);
  });
});

describe('AC-KIDS-203 — cancel before speak', () => {
  it('cancels the in-flight utterance before starting the next one', () => {
    boot();
    speakBody(JUPITER);
    speakBody(MARS);

    expect(synth.calls).toEqual(['speak', 'cancel', 'speak']);
  });

  it('does not cancel when the engine is idle (iOS drops an utterance cancelled from idle)', () => {
    boot();
    speakBody(MARS);
    expect(synth.calls).toEqual(['speak']);
  });

  it('keeps exactly one live utterance across a rapid 10-tap sequence', () => {
    boot();
    for (let i = 0; i < 10; i++) speakBody(i % 2 === 0 ? MARS : JUPITER);

    expect(synth.queue).toHaveLength(1);
    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(10);
    expect(synth.calls.filter((c) => c === 'cancel')).toHaveLength(9);
  });
});

describe('AC-KIDS-205 — deferred voice binding (iOS voiceschanged race)', () => {
  it('lands the first narration with a ko-KR voice once the voice list loads', () => {
    boot({ synth: createFakeSynth({ voices: [] }) });
    speakBody(MARS);
    expect(synth.calls).toHaveLength(0);

    synth.loadVoices([SAMANTHA, YUNA]);

    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(1);
    expect(synth.utterances[0].voice).toBe(YUNA);
    expect(synth.utterances[0].lang).toBe('ko-KR');
    expect(synth.utterances[0].text.startsWith(MARS.nameKo)).toBe(true);
  });

  it('holds only the newest request while voices are loading', () => {
    boot({ synth: createFakeSynth({ voices: [] }) });
    speakBody(JUPITER);
    speakBody(MARS);
    synth.loadVoices([YUNA]);

    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(1);
    expect(synth.utterances[0].text.startsWith(MARS.nameKo)).toBe(true);
  });

  it('picks the preferred ko voice deterministically when several exist', () => {
    boot({ synth: createFakeSynth({ voices: [GOOGLE_KO, YUNA] }) });
    speak('안녕');
    expect(synth.utterances[0].voice).toBe(YUNA);
  });

  it('speaks with lang ko-KR and no voice when the device has no Korean voice', () => {
    boot({ synth: createFakeSynth({ voices: [SAMANTHA] }) });
    expect(() => speakBody(MARS)).not.toThrow();

    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(1);
    expect(synth.utterances[0].lang).toBe('ko-KR');
    expect(synth.utterances[0].voice).toBeFalsy();
  });
});

describe('AC-KIDS-206 — no speech engine', () => {
  it('no-ops without throwing and reports unavailable', () => {
    // jsdom has no speechSynthesis, so `undefined` cannot fall back to a real engine.
    expect(globalThis.speechSynthesis).toBeUndefined();
    boot({ synth: undefined, storage: createFakeStorage() });

    expect(isAvailable()).toBe(false);
    expect(() => {
      speakBody(MARS);
      speak('안녕');
      cancel();
      setMuted(true);
    }).not.toThrow();
  });
});

describe('AC-KIDS-207 — mute persistence', () => {
  it('round-trips the mute flag through storage under solar.muted', () => {
    const store = createFakeStorage();
    boot({ storage: store });
    setMuted(true);

    expect(store.read(MUTE_KEY)).toBe('true');

    boot({ storage: store });
    expect(isMuted()).toBe(true);
  });

  it('unmutes back through storage', () => {
    const store = createFakeStorage({ [MUTE_KEY]: 'true' });
    boot({ storage: store });
    expect(isMuted()).toBe(true);

    setMuted(false);
    boot({ storage: store });
    expect(isMuted()).toBe(false);
  });

  it('defaults to unmuted when the stored value is unexpected', () => {
    boot({ storage: createFakeStorage({ [MUTE_KEY]: '{"muted":true}' }) });
    expect(isMuted()).toBe(false);
  });

  it('falls back to in-memory mute when storage throws (private mode)', () => {
    expect(() => boot({ storage: THROWING_STORAGE })).not.toThrow();
    expect(isMuted()).toBe(false);

    expect(() => setMuted(true)).not.toThrow();
    expect(isMuted()).toBe(true);
  });
});

describe('AC-KIDS-208 — muted gate', () => {
  it('starts no utterance from speakBody or speak while muted', () => {
    boot();
    setMuted(true);
    speakBody(MARS);
    speak('안녕');

    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(0);
  });

  it('resumes narration after unmuting', () => {
    boot();
    setMuted(true);
    speakBody(MARS);
    setMuted(false);
    speakBody(MARS);

    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(1);
  });
});

describe('edge cases', () => {
  it('swallows an utterance error and keeps later narrations working', () => {
    boot();
    speakBody(MARS);

    expect(() => synth.utterances[0].onerror(new Error('engine hiccup'))).not.toThrow();

    speakBody(JUPITER);
    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(2);
  });

  it('stays silent and does not throw when the engine itself throws', () => {
    const hostile = createFakeSynth({ voices: [YUNA] });
    hostile.speak = () => {
      throw new Error('engine gone');
    };
    boot({ synth: hostile });

    expect(() => speakBody(MARS)).not.toThrow();
  });

  it('drops a queued-but-unspoken narration on cancel', () => {
    boot({ synth: createFakeSynth({ voices: [] }) });
    speakBody(MARS);
    cancel();
    synth.loadVoices([YUNA]);

    expect(synth.calls.filter((c) => c === 'speak')).toHaveLength(0);
  });
});
