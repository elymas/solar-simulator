// Korean TTS narration wrapper (SPEC-KIDS-001 K2).
//
// Wraps a `speechSynthesis`-shaped backend. Voice selection, mute state,
// cancel-before-speak sequencing and availability detection are dependency
// injected so the whole decision surface is unit-testable without a browser
// speech engine (REQ-KIDS-201).
//
// Narration is an enhancement, never a blocker: every path here degrades to
// silence rather than throwing.
//
// TWO BACKENDS, ONE DOOR. Lines the build pre-recorded (ttsAssets.js) are played
// as audio files; anything else still goes to the platform's speech engine. The
// choice happens inside speak(), so every caller — and every rule below about
// muting, cancelling and the voice-load race — applies to both identically.

import * as assets from './ttsAssets.js';

const MUTE_KEY = 'solar.muted';
const SPEECH_LANG = 'ko-KR';

// Deterministic ko-* voice preference, best-known Korean voice per platform first:
// Yuna (Apple/iOS), Google 한국의 (Chrome/Android), Heami / SunHi (Windows).
// Matched as a substring of voice.name over the already ko-filtered candidates.
const VOICE_PREFERENCE = ['Yuna', 'Google', 'Heami', 'SunHi'];

let synth = null;
let storage = null;
let muted = false;
let voice = null;
let heldText = ''; // one narration parked while the platform voice list is still empty
let voicesChangedHandler = null;
const factCursor = new Map();

/**
 * Wire the module to a speech backend. Safe to call again (re-reads mute state,
 * re-binds the voice listener). `storage` exists so mute persistence is testable
 * without touching window; both arguments default to the browser globals.
 */
export function init({ synth: injectedSynth, storage: injectedStorage } = {}) {
  detachVoiceListener();
  synth = injectedSynth ?? readGlobal('speechSynthesis');
  storage = injectedStorage ?? readGlobal('localStorage');
  muted = readMuted();
  voice = null;
  heldText = '';
  factCursor.clear();
  attachVoiceListener();
  // Fire-and-forget: until it resolves, assets.play() answers "no" and every line
  // takes the platform-voice path, which is exactly the pre-upgrade behaviour.
  assets.init();
}

/** Speak a body's Korean name followed by one rotating fact (REQ-KIDS-202). */
export function speakBody(body) {
  if (!body) return;
  const name = body.nameKo || body.name;
  if (!name) return;
  const fact = nextFact(body);
  speak(fact ? `${name}. ${fact}` : name);
}

// @MX:ANCHOR: [AUTO] Single narration entry point. Mute gating, the voice-load
// race and cancel-before-speak all live here; nothing else may call synth.speak.
// @MX:SPEC: [AUTO] SPEC-KIDS-001 REQ-KIDS-203/205/208
// @MX:REASON: [AUTO] SPEC-EVENTS-001, SPEC-EARTH-003 and SPEC-PLAY-001 route their
// callouts through this function to inherit that behavior; a consumer that builds
// its own utterance instead would bypass mute and stack overlapping speech.
/** Speak raw text. Cross-SPEC callouts route through here to inherit mute/cancel. */
export function speak(text) {
  if (!text || muted) return;
  // A recorded take wins: it is the Korean voice this app was tuned for, and it
  // needs neither a platform voice nor the voice-load dance below. Checked before
  // isAvailable() on purpose — a device with no speech engine at all can still
  // play the files.
  if (assets.play(text)) return;
  if (!isAvailable()) return;
  // iOS Safari and Chrome populate voices asynchronously. Park the newest request
  // (never a queue) and flush it from the `voiceschanged` handler so the first tap
  // after load is not lost (REQ-KIDS-205). An engine that never loads a voice
  // cannot speak at all, so parking costs nothing there.
  // Note: the slot holds ONE request. A second call arriving while the first is
  // still parked silently DROPS the earlier text rather than queueing it — the
  // newest request wins. Every cross-SPEC caller routing through speak()
  // (SPEC-EVENTS-001, SPEC-EARTH-003, SPEC-PLAY-001) inherits that, so a callout
  // fired during the brief pre-voices window after boot may never be spoken.
  if (getVoices().length === 0) {
    heldText = text;
    return;
  }
  heldText = '';
  resolveVoice(); // stays null on a device with no Korean voice; lang carries it
  // Only cancel when something is actually speaking or queued: iOS Safari drops
  // the incoming utterance if cancel() runs against an idle engine.
  if (synth.speaking || synth.pending) safeCancel();
  startUtterance(text);
}

export function cancel() {
  heldText = '';
  // Both backends: a recorded take is just as much "speech in progress" as an
  // utterance, and muting mid-sentence has to stop whichever one is running.
  assets.stop();
  if (!isAvailable()) return;
  safeCancel();
}

export function setMuted(next) {
  muted = Boolean(next);
  if (muted) cancel(); // muting mid-sentence must actually stop the sentence
  try {
    storage?.setItem(MUTE_KEY, muted ? 'true' : 'false');
  } catch {
    // Private mode / quota: keep the choice in memory for this session only.
  }
}

export function isMuted() {
  return muted;
}

export function isAvailable() {
  return Boolean(synth) && typeof synth.speak === 'function';
}

function startUtterance(text) {
  const utterance = createUtterance(text);
  utterance.lang = SPEECH_LANG;
  if (voice) utterance.voice = voice;
  utterance.onerror = () => {}; // engine hiccups must never surface to the child
  try {
    synth.speak(utterance);
  } catch {
    // Partial or hostile engine: stay silent.
  }
}

function createUtterance(text) {
  const Utterance = globalThis.SpeechSynthesisUtterance;
  // jsdom and speechless browsers have no constructor; a plain object carries
  // the same fields, which is all the backend contract needs.
  return typeof Utterance === 'function' ? new Utterance(text) : { text };
}

function safeCancel() {
  try {
    synth.cancel();
  } catch {
    // Same degradation rule as speak().
  }
}

function getVoices() {
  if (!isAvailable() || typeof synth.getVoices !== 'function') return [];
  try {
    const list = synth.getVoices();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function resolveVoice() {
  if (voice) return voice;
  const korean = getVoices().filter((v) => v && String(v.lang || '').toLowerCase().startsWith('ko'));
  if (korean.length === 0) return null;
  for (const preferred of VOICE_PREFERENCE) {
    const hit = korean.find((v) => String(v.name || '').includes(preferred));
    if (hit) {
      voice = hit;
      return voice;
    }
  }
  voice = korean[0]; // deterministic: platform list order
  return voice;
}

function attachVoiceListener() {
  if (!isAvailable() || typeof synth.addEventListener !== 'function') return;
  voicesChangedHandler = () => {
    voice = null; // re-resolve against the freshly loaded list
    const parked = heldText;
    heldText = '';
    if (parked) speak(parked);
  };
  synth.addEventListener('voiceschanged', voicesChangedHandler);
}

function detachVoiceListener() {
  if (synth && voicesChangedHandler && typeof synth.removeEventListener === 'function') {
    synth.removeEventListener('voiceschanged', voicesChangedHandler);
  }
  voicesChangedHandler = null;
}

// Per-body cycle index so repeated taps read a different fact. Module memory
// only: resetting each session is intended.
function nextFact(body) {
  const facts = Array.isArray(body.factsKo) ? body.factsKo.filter(Boolean) : [];
  if (facts.length === 0) return '';
  const key = body.name || body.nameKo;
  const index = factCursor.get(key) ?? 0;
  factCursor.set(key, (index + 1) % facts.length);
  return facts[index % facts.length];
}

// Reading the global is itself a trust boundary: `localStorage` throws
// SecurityError when the document origin is opaque (sandboxed iframe without
// allow-same-origin) or cookies are blocked outright — before any getItem guard
// can run. init() executes during app boot, ahead of the rest of the UI, so an
// unguarded read would take the whole simulator down for a narration feature.
function readGlobal(name) {
  try {
    return globalThis[name] ?? null;
  } catch {
    return null;
  }
}

function readMuted() {
  try {
    return storage?.getItem(MUTE_KEY) === 'true'; // anything else defaults to unmuted
  } catch {
    return false;
  }
}
