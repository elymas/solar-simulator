# Task Decomposition

SPEC: SPEC-EVENTS-001
Development mode: TDD (RED-GREEN-REFACTOR)
Harness level: standard

## Plan corrections applied at run-phase entry

Three brownfield citations in `plan.md` were checked against the code before decomposition.

1. **A-301 resolved, not deferred.** `OrbitalMechanics._solveKepler` (10 Newton-Raphson iterations,
   initial guess `E = M`) converges for e=0.967 across a full-period sweep: residual `|E - e·sin E - M|`
   stays below 1e-6 at every one of 2000 samples, producing min r = 23.10 and max r = 1376.90 — exactly
   the q/Q envelope `spec.md` REQ-EVT-101 predicts. No solver change and no eccentricity fallback are
   needed. M1 keeps only the characterization test, not the investigation.
2. **Frame hook target corrected.** `plan.md` §D lists `src/main.js` for the alignment frame hook.
   `src/main.js` is a 33-line bootstrap; the render loop lives in `ViewManager` and dispatches to
   `SolarSystemView.update(delta)` (`src/views/SolarSystemView.js:241`). The hook and the belt mount
   belong there. Only the degrader shed/restore cases belong in `SceneManager`
   (`src/scene/SceneManager.js:222-246`, ladder swap at `:211`).
3. **No unified registry exists.** `plan.md` §A.5/§G assume comet and belt entries are picked up
   automatically by the mobile strip via SPEC-MOBILE-001 REQ-MOB-305. They are not: `planetData.js`
   exports three separate maps (`PLANET_DATA`, `MOON_DATA`, `STAR_DATA`), and `PlanetStrip.js:123`
   hardcodes `[...Object.entries(PLANET_DATA), ...Object.entries(STAR_DATA)]`. `PlanetList.js`
   likewise hand-builds each section. REQ-EVT-103/205 mandate PlanetList only, so strip support is a
   user-approved scope addition (without it the three new bodies are unreachable on phones, which
   SPEC-MOBILE-001 made the strip's primary job).

## Task table

| Task ID | Description | Requirement | AC | Dependencies | Planned Files | Status |
|---------|-------------|-------------|-----|--------------|---------------|--------|
| M1 | Comet data entry + Keplerian orbit render; document ÷10 period and a=700 scaling | REQ-EVT-101 | AC-EVT-101 | - | `src/planets/planetData.js`, `src/planets/planetData.comet.test.js`, `src/planets/PlanetFactory.js` | pending |
| M2 | Anti-sunward tail on a fixed, once-allocated point budget | REQ-EVT-102, REQ-EVT-104 | AC-EVT-102, AC-EVT-104 | M1 | `src/effects/CometTail.js`, `src/effects/CometTail.test.js`, `src/planets/PlanetFactory.js` | pending |
| M3 | Seeded belt generator, InstancedMesh render, drift, raycast exclusion | REQ-EVT-201, 202, 203, 206 | AC-EVT-201, 202, 203, 206 | - | `src/effects/Belts.js`, `src/effects/Belts.test.js`, `src/views/SolarSystemView.js`, `src/controls/InteractionManager.js` | pending |
| M4 | `belts` first-position shed step + constrained-tier boot counts | REQ-EVT-204 | AC-EVT-204 | M3 | `src/utils/performance.js`, `src/utils/performance.test.js`, `src/scene/SceneManager.js` | pending |
| M5 | Alignment detector, hysteresis state machine, banner + TTS callout | REQ-EVT-301, 302, 303, 304, 305 | AC-EVT-301..305 | - | `src/utils/alignment.js`, `src/utils/alignment.test.js`, `src/ui/EventBanner.js`, `src/ui/EventBanner.test.js`, `src/views/SolarSystemView.js` | pending |
| M6 | List + strip entries, dividers, KIDS-001-shaped facts, belt framing | REQ-EVT-103, 205 | AC-EVT-103, AC-EVT-205 | M1, M3, M5 | `src/ui/PlanetList.js`, `src/ui/PlanetStrip.js`, `src/ui/strings.js`, `src/planets/planetData.js` | pending |

## Execution batching

Milestones share `planetData.js`, `PlanetFactory.js`, and `SolarSystemView.js`, so batches run
sequentially rather than in parallel.

- Batch A = M1 + M2 (comet)
- Batch B = M3 + M4 (belts)
- Batch C = M5 + M6 (alignment event, then UI integration)

One conventional commit per milestone, referencing SPEC-EVENTS-001, on `feat/spec-events-001`.
No push and no merge — those are handled outside this run.
