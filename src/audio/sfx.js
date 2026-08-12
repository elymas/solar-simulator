// Celebration sound effects (SPEC-PLAY-001 REQ-PLAY-303).
//
// Synthesized, not sampled (plan.md §A.2): three oscillator-and-envelope one-shots
// cost zero bytes of payload and need no asset pipeline. Bundled samples stay the
// documented fallback if these read as harsh on device review at M4.
//
// Mute is NOT re-implemented here. tts.js owns the persisted "소리" setting and its
// storage key; this module only asks isMuted(). One toggle therefore governs speech
// and effects together, and there is exactly one place a mute bug can live.
//
// iOS will not start audio outside a user gesture, so nothing is constructed at
// import time: the context appears on the first unlockAudio() call and no sound can
// be produced before resume() has run.

import { isMuted } from './tts.js';

/** Master level. Low on purpose: these fire next to a child's face on a tablet. */
const PEAK_GAIN = 0.18;
const SILENT = 0.0001; // exponential ramps cannot reach 0
const ATTACK = 0.01;
const RELEASE_PAD = 0.02; // let the tail finish before the oscillator stops

// Every sound stays under the 0.5s budget in spec §5: the last note's
// offset + duration + RELEASE_PAD is the total length.
const SOUNDS = {
  // Arrival: a two-note major-sixth ping, bell-like.
  chime: { wave: 'sine', duration: 0.28, notes: [[880, 0], [1318.51, 0.08]] },
  // Star: higher and faster than the chime so a star tap is audibly not a planet.
  twinkle: { wave: 'triangle', duration: 0.18, notes: [[1567.98, 0], [2093, 0.05], [2637.02, 0.1]] },
  // Mission / rocket arrival: a rising C-major arpeggio — the "you did it" sound.
  fanfare: {
    wave: 'square',
    duration: 0.25,
    notes: [[523.25, 0], [659.25, 0.07], [783.99, 0.14], [1046.5, 0.21]],
  },
};

let createContext = defaultContextFactory;
let context = null;
let unlocked = false;

/**
 * Wire the module to an audio backend. Safe to call again (drops any existing
 * context and re-locks). Mirrors the tts.js injection style so the whole decision
 * surface is testable without a real Web Audio implementation.
 * @param {{audioContext?: AudioContext | (() => AudioContext) | null}} [options]
 */
export function init({ audioContext } = {}) {
  context = null;
  unlocked = false;
  if (audioContext === undefined) createContext = defaultContextFactory;
  else if (typeof audioContext === 'function') createContext = audioContext;
  else createContext = audioContext ? () => audioContext : () => null;
}

// @MX:ANCHOR: [AUTO] The single audio unlock gesture hook. Call it from the first
// qualifying user gesture; it primes the effects context and is the place TTS
// priming joins (plan.md §A.6 — one gesture, both channels).
// @MX:SPEC: [AUTO] SPEC-PLAY-001 REQ-PLAY-303 / A-502
// @MX:REASON: [AUTO] Selection taps, the rocket button and the size-compare button
// will all route their gesture here. A second unlock path would let a play() run
// against a suspended context, which iOS answers with permanent silence for the
// session rather than an error.
/**
 * Resume the audio context from a user gesture. Idempotent and never throws.
 * @returns {boolean} true once effects are allowed to sound
 */
export function unlockAudio() {
  if (unlocked) return true;
  if (!context) {
    try {
      context = createContext() ?? null;
    } catch {
      context = null; // a browser that refuses to construct one simply stays silent
    }
  }
  if (!context) return false;
  try {
    // resume() REJECTS (not throws) when Safari decides the call was not close
    // enough to a gesture. Swallow it: an unhandled rejection would surface a
    // red console error for a decoration the app is happy to live without.
    context.resume?.()?.catch?.(() => {});
  } catch {
    return false; // still locked: play() keeps refusing rather than half-working
  }
  unlocked = true;
  return true;
}

export function isUnlocked() {
  return unlocked;
}

/** Camera arrival at a body (REQ-PLAY-301). */
export function playChime() {
  return play('chime');
}

/** Star tapped (REQ-PLAY-302). */
export function playTwinkle() {
  return play('twinkle');
}

/** Mission completed / rocket arrived (REQ-PLAY-404, REQ-PLAY-202). */
export function playFanfare() {
  return play('fanfare');
}

// @MX:NOTE: [AUTO] Both guards run before a single node is allocated: a muted or
// still-locked app must not merely be inaudible, it must build nothing at all
// (AC-PLAY-303 asserts the node count is zero).
function play(name) {
  if (isMuted() || !unlocked || !context) return false;
  const sound = SOUNDS[name];
  if (!sound) return false;
  try {
    const start = context.currentTime;
    for (const [frequency, offset] of sound.notes) {
      playNote(sound, frequency, start + offset);
    }
  } catch {
    return false; // a hostile or partial Web Audio implementation stays silent
  }
  return true;
}

function playNote({ wave, duration }, frequency, at) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, at);

  envelope.gain.setValueAtTime(SILENT, at);
  envelope.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + ATTACK);
  envelope.gain.exponentialRampToValueAtTime(SILENT, at + duration);

  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + RELEASE_PAD);
}

// Reading the global is a trust boundary of its own: constructors are missing on
// old Safari (webkit-prefixed) and absent entirely under jsdom.
function defaultContextFactory() {
  try {
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return typeof Ctor === 'function' ? new Ctor() : null;
  } catch {
    return null;
  }
}
