---
id: SPEC-SIM-001
document: progress
version: "0.1.0"
status: implemented
created: "2026-07-05"
updated: "2026-07-05"
author: manager-tdd
---

# SPEC-SIM-001: Run Phase Progress (TDD)

## Checkpoint — Run phase complete (2026-07-05)

All 10 tasks GREEN. `npm test` = 46 tests / 8 files passing. `npm run build` clean (581 kB / 145 kB gz, mostly three.js).

| Phase | Result |
|-------|--------|
| RED | 6 failing test files written before implementation (data, orbital, UI, factory, tier, degrader). |
| GREEN | All requirements implemented; 46 assertions passing. |
| REFACTOR | Extracted pure `TextureTierManager` + `FrameBudgetDegrader` for unit-testability; anisotropy centralized in `_loadTexture`; single `_applyPlanetTexture` fallback path serves all planets. |

### Acceptance criteria completion
- Met (code-verified): AC-SIM-01, AC-SIM-02, AC-SIM-03 (all data/UI/orbit assertions pass).
- Partially met (code fact verified, visual pending): AC-SIM-04 (samples:4 + ACES set in code — MSAA/relight *appearance* is manual), AC-SIM-05 (LOD swap + lazy tier logic unit-tested — *pop-in feel* manual), AC-SIM-06 (degrade order unit-tested — runtime p95 frame time & mobile degrade are manual/perf).
- Error count delta: 0 introduced. No stagnation triggers.

## Drift check (planned vs actual)

Planned files (spec-compact "Files to Modify"): planetData, constants, PlanetFactory, OrbitalMechanics, PlanetList, InfoPanel, SceneManager, InteractionManager, public/textures.

Actual:
- Modified as planned: planetData.js, constants.js, PlanetFactory.js, OrbitalMechanics.js, PlanetList.js, InfoPanel.js, SceneManager.js.
- **Not touched (no edit needed):** InteractionManager.js — dwarf/moon hit-targets auto-register via the existing `_buildClickTargets` loop over `planetFactory.planets`; public/textures/ — no art assets ship (approved: flat-color fallback).
- **Added (justified):** main.js (2 lines: onFocus/onDefocus wiring), src/utils/performance.js (+FrameBudgetDegrader, coexists with the parallel SPEC-UI-001 mobile degrader), src/planets/TextureTierManager.js (new pure unit for REQ-290 caching), test/* + vitest.config.js (test infra).

Drift: low (< 30%), no re-planning gate triggered. Additions are approved simplifications or necessary wiring.

## Coexistence note
A parallel SPEC-UI-001 gap-fix effort added OutlinePass hover, InfoPanel onClose, and a mobile-only fps degrader (`performance.js shouldDegrade`) in shared files (SceneManager, InfoPanel, InteractionManager, main.js). SPEC-SIM-001 changes are additive: the REQ-240 `FrameBudgetDegrader` runs on the composer path guarded by `!this._degraded`, so it never fights the REQ-018 mobile hard-fallback. Their colocated tests (`src/**/*.test.js`) are now included in the vitest run.
