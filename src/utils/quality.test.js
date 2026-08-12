import { describe, it, expect } from 'vitest';
import { decideQualityTier, MAX_PIXEL_RATIO } from './quality.js';

// SPEC-MOBILE-001 M3 (REQ-MOB-201..205). The old heuristic classified every
// user-agent-mobile device as low-end and pinned it to pixelRatio 1, which
// permanently blurred high-end phones. Quality is now a pure function of what
// the device actually reports.
describe('decideQualityTier (SPEC-MOBILE-001)', () => {
  // AC-MOB-201/202/203 in one table: the tier must follow observed signals, and
  // must never follow the user agent.
  const cases = [
    {
      name: 'iPhone 17 Pro class: 6 cores, no deviceMemory API',
      signals: { devicePixelRatio: 3, hardwareConcurrency: 6, deviceMemory: undefined },
      tier: 'full',
      pixelRatio: 2,
    },
    {
      name: 'genuinely weak Android: 4 cores AND 2GB, both observed',
      signals: { devicePixelRatio: 2, hardwareConcurrency: 4, deviceMemory: 2 },
      tier: 'constrained',
      pixelRatio: 1,
    },
    {
      name: '4-core desktop Safari: weak core count, but no memory signal to confirm it',
      signals: { devicePixelRatio: 2, hardwareConcurrency: 4, deviceMemory: undefined },
      tier: 'full',
      pixelRatio: 2,
    },
    {
      name: '8 cores with 2GB reported: only one weak signal',
      signals: { devicePixelRatio: 2, hardwareConcurrency: 8, deviceMemory: 2 },
      tier: 'full',
      pixelRatio: 2,
    },
    {
      name: 'low-DPR display: the cap is a ceiling, not a target',
      signals: { devicePixelRatio: 1.5, hardwareConcurrency: 8, deviceMemory: 8 },
      tier: 'full',
      pixelRatio: 1.5,
    },
  ];

  for (const { name, signals, tier, pixelRatio } of cases) {
    it(`${name} -> ${tier} @ pixelRatio ${pixelRatio}`, () => {
      const decision = decideQualityTier(signals);
      expect(decision.tier).toBe(tier);
      expect(decision.pixelRatio).toBe(pixelRatio);
    });
  }

  it('caps pixelRatio at 2 however high the display reports', () => {
    expect(decideQualityTier({ devicePixelRatio: 4, hardwareConcurrency: 8 }).pixelRatio).toBe(MAX_PIXEL_RATIO);
  });

  // AC-MOB-205: the texture/LOD flags derive from the tier, not from a separate
  // user-agent test, so there is exactly one place quality policy is decided.
  it('derives the texture cap and LOD-upgrade flags from the tier', () => {
    const full = decideQualityTier({ devicePixelRatio: 3, hardwareConcurrency: 6 });
    expect(full.textureCapEnabled).toBe(false);
    expect(full.lodUpgradesDisabled).toBe(false);

    const constrained = decideQualityTier({ devicePixelRatio: 2, hardwareConcurrency: 4, deviceMemory: 4 });
    expect(constrained.textureCapEnabled).toBe(true);
    expect(constrained.lodUpgradesDisabled).toBe(true);
  });

  // AC-MOB-201: full tier leaves bloom at the scene's defaults; only the
  // constrained tier asks for the reduced values.
  it('overrides bloom only in the constrained tier', () => {
    expect(decideQualityTier({ devicePixelRatio: 3, hardwareConcurrency: 6 }).bloomOverride).toBeNull();
    expect(decideQualityTier({ devicePixelRatio: 2, hardwareConcurrency: 2, deviceMemory: 2 }).bloomOverride)
      .toEqual({ strength: 0.4, radius: 0.15 });
  });

  it('treats the constrained predicate as an AND of both weak signals at the boundary', () => {
    expect(decideQualityTier({ hardwareConcurrency: 4, deviceMemory: 4 }).tier).toBe('constrained');
    expect(decideQualityTier({ hardwareConcurrency: 5, deviceMemory: 4 }).tier).toBe('full');
    expect(decideQualityTier({ hardwareConcurrency: 4, deviceMemory: 5 }).tier).toBe('full');
  });

  // AC-MOB-205: pure — same input, same output, and no reach into globals. The
  // user agent is not even an input, so it cannot influence the decision.
  it('is pure: repeated calls agree and nothing is read from globals', () => {
    const signals = { devicePixelRatio: 3, hardwareConcurrency: 6, deviceMemory: undefined };
    expect(decideQualityTier(signals)).toEqual(decideQualityTier(signals));
    expect(decideQualityTier(signals)).not.toBe(decideQualityTier(signals));
  });

  it('falls back to a safe full tier when the device reports nothing at all', () => {
    const decision = decideQualityTier({});
    expect(decision.tier).toBe('full');
    expect(decision.pixelRatio).toBe(1);
  });
});
