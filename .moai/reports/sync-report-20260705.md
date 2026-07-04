# Sync Report — 2026-07-05

Documentation-only sync (Phase 1 divergence analysis + Phase 2 document synchronization) for four already-implemented SPECs, committed directly to `main` (personal git strategy, no PR/branch).

## SPECs Synced

| SPEC | Commit(s) | Status change | Notes |
|------|-----------|----------------|-------|
| SPEC-UI-001 | 1a94afc, 3e6ea30 | already `implemented` (no change) | Addendum only |
| SPEC-SIM-001 | 35fdcc4 | `draft` → `implemented` | |
| SPEC-EARTH-001 | fbdf8bb | `draft` → `implemented` | |
| SPEC-EARTH-002 | 7ef2a8a | `draft` → `implemented` | + design-description correction (see below) |

## Files Touched

### SPEC documents
- `.moai/specs/SPEC-SIM-001/spec.md` — frontmatter status/date bump + new §9 Implementation Notes
- `.moai/specs/SPEC-SIM-001/acceptance.md` — frontmatter status/date bump
- `.moai/specs/SPEC-EARTH-001/spec.md` — frontmatter status/date bump + new §9 Implementation Notes
- `.moai/specs/SPEC-EARTH-001/acceptance.md` — frontmatter status/date bump
- `.moai/specs/SPEC-EARTH-002/spec.md` — frontmatter status/date bump + §1.4/REQ-510/REQ-530/§4.2 correction + new §9 Implementation Notes
- `.moai/specs/SPEC-EARTH-002/spec-compact.md` — frontmatter status/date bump + REQ-510/REQ-530/Files-to-Modify correction
- `.moai/specs/SPEC-EARTH-002/acceptance.md` — frontmatter status/date bump + matching Gherkin scenario corrections (AC-ECLIPSE-01/02)
- `.moai/specs/SPEC-UI-001/spec.md` — new §5 Implementation Notes addendum (gap-fix commit `1a94afc`, carried-forward cosmetic item)

### Project documents
- `.moai/project/product.md` — new section listing user-facing capabilities added by the three extension SPECs
- `.moai/project/structure.md` — new section documenting `src/core/`, `src/views/`, `src/earth/`, `src/effects/`, `src/data/`, `src/utils/eclipseData.js`, `test/`, and the single-renderer/multi-view architecture pattern
- `.moai/project/tech.md` — new sections: Vitest + jsdom test stack (project's first test suite), and `api.airplanes.live` as the app's only runtime external network dependency

`.moai/project/codemaps/` does not exist in this project — left untouched per scope (nothing to sync).

## The One Real Correction: SPEC-EARTH-002 Eclipse Detection Design

**What was wrong**: spec.md §1.4, REQ-510(b), REQ-530, and §4.2 (plus matching acceptance.md scenarios) described F6 eclipse detection as reading `OrbitalMechanics`' live Keplerian position data to compute genuine Sun-Earth-Moon geometric alignment, sampled via a "fixed substep" independent of frame rate.

**Why it was wrong**: `OrbitalMechanics.calculatePosition` deliberately omits the ascending node (Ω) — a documented SPEC-SIM-001 limitation. Without Ω, the orbit model cannot produce genuine node-crossing alignments; a literal implementation would have had to fabricate eclipse events, which is a direct violation of REQ-550 ("no fabricated eclipses not corresponding to genuine geometric alignment").

**What was actually built**: `src/utils/eclipseData.js` — a real cataloged eclipse table (NASA Five Millennium Canon of Solar/Lunar Eclipses, Espenak & Meeus; 10 entries, 2026–2030) is the source of truth. Detection is a half-open-interval range-test (`detectEclipsesInRange(prevDay, currDay)`) of simulation time against real historical/predicted instants — immune to frame step size by construction (a single 500x frame spanning years still catches every entry inside the interval), so no substep sampling is needed. `EclipseRig` itself is a fixed-placement local diorama that never reads live orbital positions; it is only triggered by the table-based detection result.

**Review status**: this design substitution was independently validated as sound by both `quality-earth-002` and `evaluator-earth-002` during the Run phase — it was a reviewed engineering decision, not a silent drift. Corrections were applied to spec.md (§1.4, REQ-510, REQ-530, §4.2), spec-compact.md (REQ-510, REQ-530, Files to Modify), and the corresponding acceptance.md Gherkin scenarios (AC-ECLIPSE-01, AC-ECLIPSE-02), each marked `[CORRECTED 2026-07-05]` inline.

## Known Non-Blocking Follow-Up Items (Carried Forward)

1. **SIM-001 — OutlinePass halo cosmetic issue**: hover outline on Mercury/Venus/Mars renders slightly larger than the visible planet surface, due to their invisible hit-helper collision radius. Click/hover functionality is unaffected; visual polish only.
2. **EARTH-001 — EarthHUD placeholder readouts**: the sub-solar point / terminator-time readouts in EarthHUD render but are still static placeholder strings, not yet wired to live astronomy data.
3. **EARTH-002 — degradation ladder revert gap**: the frame-degradation ladder does not revert already-applied visual effects when switching between the solar-view and earth-view degradation step lists (degrades correctly in each view, but a step applied under one view's ladder is not un-applied when the step list is swapped on view transition).

## Constraints Observed

- No PR/issue created (personal git strategy, direct-to-main).
- No source code (`src/`, `test/`) modified — documentation-only pass.
- No coverage/test generation run (existing TDD-generated tests and coverage already validated).
- Pre-existing `.moai/reports/session-*.md` files untouched.
