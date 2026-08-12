// Boot-time render quality policy (SPEC-MOBILE-001 REQ-MOB-201..205).
//
// This lives apart from performance.js on purpose: performance.js is a per-frame
// state machine that sheds effects while the app runs, whereas this is a single
// decision taken once at boot from what the device reports about itself.

// dpr 3 renders 2.25x the pixels of dpr 2 for a difference nobody sees at arm's
// length, so 2 is the ceiling. The FrameBudgetDegrader can still shed below it.
export const MAX_PIXEL_RATIO = 2;

// Reduced bloom for capped devices — the values the old blanket mobile cap used.
const CONSTRAINED_BLOOM = { strength: 0.4, radius: 0.15 };

/**
 * Decide the render quality tier from observed device signals. Pure: the same
 * signals always yield the same decision, nothing is read from globals, and the
 * user agent is not an input at all — that is the whole point (REQ-MOB-202).
 *
 * @param {Object} [signals]
 * @param {number} [signals.devicePixelRatio] - window.devicePixelRatio.
 * @param {number} [signals.hardwareConcurrency] - navigator.hardwareConcurrency.
 * @param {number} [signals.deviceMemory] - navigator.deviceMemory (absent on iOS Safari).
 * @returns {{tier: 'full'|'constrained', pixelRatio: number, textureCapEnabled: boolean,
 *   lodUpgradesDisabled: boolean, bloomOverride: {strength: number, radius: number}|null}}
 */
export function decideQualityTier({ devicePixelRatio = 1, hardwareConcurrency, deviceMemory } = {}) {
  // Both weak signals must be genuinely observed before capping. A low core count
  // on its own re-blurs 4-core desktops and every iPhone — exactly the defect this
  // replaces — and iOS Safari never reports deviceMemory, so a phone simply never
  // matches here and leans on the dynamic degrader instead (REQ-MOB-203).
  const constrained =
    typeof hardwareConcurrency === 'number' && hardwareConcurrency <= 4 &&
    typeof deviceMemory === 'number' && deviceMemory <= 4;

  if (constrained) {
    return {
      tier: 'constrained',
      pixelRatio: 1,
      textureCapEnabled: true,
      lodUpgradesDisabled: true,
      bloomOverride: { ...CONSTRAINED_BLOOM },
    };
  }

  return {
    tier: 'full',
    pixelRatio: Math.min(devicePixelRatio, MAX_PIXEL_RATIO),
    textureCapEnabled: false,
    lodUpgradesDisabled: false,
    bloomOverride: null, // leave the scene's default bloom alone
  };
}
