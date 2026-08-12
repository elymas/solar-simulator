// Normalized play-event seam (SPEC-PLAY-001 plan.md §4 / §A.3).
//
// The whole module is the contract: four event shapes, emitted from the places
// the app already knows about, consumed by anything that cares.
//
//   { type: 'select', body }          a body was chosen (3D tap, list, strip)
//   { type: 'view-enter', view }      a view became active ('SOLAR' | 'EARTH')
//   { type: 'rocket-arrived', body }  a rocket journey touched down
//   { type: 'size-compare', body }    the size comparison was opened
//
// Events, not polling (plan.md §B): a subscriber is testable with a synthetic
// stream, whereas polling would couple every consumer to live scene internals.
// Nothing is imported here on purpose — the mission engine's import-purity rule
// (REQ-PLAY-405) reaches through this seam, so it must stay dependency-free.

const subscribers = new Set();

/**
 * Subscribe to the play-event stream.
 * @param {(event: {type: string}) => void} subscriber
 * @returns {() => void} unsubscribe; idempotent
 */
export function onPlayEvent(subscriber) {
  if (typeof subscriber !== 'function') return () => {};
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

// @MX:NOTE: [AUTO] A subscriber that throws must not take the emitter's call
// stack with it. These fire from inside _select and view transitions, so an
// exception raised by a decoration (mission HUD, sticker book) would otherwise
// abort the selection the child actually asked for.
/**
 * Emit one normalized play event.
 * @param {string} type
 * @param {object} [payload] - merged into the event ({ body } or { view })
 */
export function emitPlayEvent(type, payload) {
  const event = { type, ...payload };
  for (const subscriber of [...subscribers]) {
    try {
      subscriber(event);
    } catch {
      // Never surface a subscriber's failure to the caller.
    }
  }
}

/** Drop every subscriber (test isolation; also a teardown hook). */
export function resetPlayEvents() {
  subscribers.clear();
}
