// Pre-baked narration playback (SPEC-KIDS-001 K2, upgraded voice).
//
// The app ships an mp3 per spoken line, generated at build time by
// scripts/build-tts.mjs. This module answers one question — "is there a recorded
// take of this exact sentence?" — and plays it if so. tts.js asks before falling
// back to the device's own speech engine.
//
// EVERY PATH DEGRADES TO "no". A missing manifest, a 404, a decode error, an
// autoplay refusal: all of them return false and the caller speaks the line with
// the platform voice instead. Narration is an enhancement, never a blocker, and
// that rule does not change just because the voice got better.

// Plain concatenation, not `new URL`: BASE_URL is a ROOT-RELATIVE path
// ('/solar-simulator/' on Pages, '/' in dev and under vitest), and the URL
// constructor rejects a relative base outright.
const BASE = (() => {
  const base = import.meta.env?.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
})();
const TTS_DIR = `${BASE}tts/`;
const MANIFEST_URL = `${TTS_DIR}manifest.json`;

let manifest = null; // id -> text, or null until loaded
let loading = null;
let current = null; // the one HTMLAudioElement in flight
let unlocked = false;

/**
 * Reverse the manifest into text -> id.
 *
 * The runtime never hashes anything: the build owns the hash, ships the text
 * alongside each id, and this looks lines up by their exact text. That is what
 * keeps the two sides from drifting — there is only one hash implementation, in
 * the build script, and a phrase the build did not record simply has no entry.
 */
function indexByText(entries) {
  const byText = new Map();
  for (const [id, text] of Object.entries(entries || {})) byText.set(text, id);
  return byText;
}

let byText = new Map();

/**
 * Load the manifest once. Safe to call repeatedly and safe to never resolve to
 * anything useful — a project built without running the TTS script simply has no
 * manifest, and the whole module then answers "no" forever.
 * @param {Function} [fetchFn]
 * @returns {Promise<void>}
 */
export function init({ fetchFn } = {}) {
  if (loading) return loading;
  const doFetch = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  if (!doFetch) {
    manifest = {};
    return Promise.resolve();
  }
  loading = doFetch(MANIFEST_URL)
    .then((res) => (res && res.ok ? res.json() : null))
    .then((data) => {
      manifest = data && typeof data === 'object' ? data.entries || {} : {};
      byText = indexByText(manifest);
    })
    .catch(() => {
      manifest = {};
      byText = new Map();
    });
  return loading;
}

/**
 * Whether a recorded take exists for this exact sentence.
 * @param {string} text
 * @returns {boolean}
 */
export function has(text) {
  return byText.has(String(text || '').trim());
}

/**
 * iOS will not play audio that did not start inside a user gesture, and it
 * remembers that per ELEMENT. Priming one silent element on the first tap is what
 * lets a later visual event — an alignment banner, a meteor shower — speak at all.
 * Called from the same gesture that unlocks the effects channel.
 */
export function unlock() {
  if (unlocked || typeof Audio === 'undefined') return;
  unlocked = true;
  try {
    const primer = new Audio();
    primer.muted = true;
    // A play() that rejects is the expected case on a browser that needs no
    // unlocking; the rejection is swallowed rather than surfaced.
    primer.play?.().catch(() => {});
  } catch {
    // No Audio constructor: the caller's fallback handles it.
  }
}

/**
 * Play the recorded take for a sentence.
 * @param {string} text
 * @returns {boolean} false when there is nothing to play, so the caller can fall back
 */
export function play(text) {
  const id = byText.get(String(text || '').trim());
  if (!id || typeof Audio === 'undefined') return false;
  stop();
  try {
    const el = new Audio(`${TTS_DIR}${id}.mp3`);
    current = el;
    el.addEventListener('ended', () => { if (current === el) current = null; });
    // A rejected play() means the browser refused (autoplay policy, decode
    // failure). The line is then simply not spoken — falling back here would
    // double-speak, because this returned true synchronously.
    el.play?.().catch(() => { if (current === el) current = null; });
    return true;
  } catch {
    current = null;
    return false;
  }
}

/** Stop whatever is playing. Mirrors speechSynthesis.cancel(). */
export function stop() {
  if (!current) return;
  try {
    current.pause();
    current.currentTime = 0;
  } catch {
    // Detached or already ended.
  }
  current = null;
}

/** Test seam: install a manifest without a network round trip. */
export function _setManifestForTest(entries) {
  manifest = entries || {};
  byText = indexByText(manifest);
  loading = Promise.resolve();
}
