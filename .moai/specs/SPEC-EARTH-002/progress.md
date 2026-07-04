---
id: SPEC-EARTH-002
document: progress
version: "0.1.0"
created: "2026-07-05"
---

# SPEC-EARTH-002 Progress

Baseline before run: 97 tests passing (14 files) = SIM-001 46 + EARTH-001 51.

## Iteration log

| # | Task | AC delta | tests | notes |
|---|------|----------|-------|-------|
| 0 | baseline | - | 97 pass | prior 97 |
| 1 | F6-0 clock wiring | - | 101 | EarthView reads+advances the ONE simApi clock |
| 2 | F6-1 eclipse table + detection | AC-ECLIPSE-02 | 111 | real NASA-catalog table, range-test detection |
| 3 | F5-1 FlightDataService | AC-FLIGHT-02 | 125 | state machine, backoff, offline, clamp, dead-reckon |
| 4 | F7-3 degrade ladder + F7 helpers | AC-AURORA-02 | 137 | aurora-first shed; tier/night/pole math |
| 5 | F5-2 aircraft geo | AC-FLIGHT-01 (partial) | 141 | geoToLocal pure mapping |
| 6 | F5-3/F6-3/F7 HUD | AC-FLIGHT/ECLIPSE | 153 | aria-live status, empty-vs-error, picker, find-next |
| 7 | EarthView F5/F6/F7 integration | AC-ECLIPSE-01/02, AC-FLIGHT, AC-AURORA | 169(local) | detection→rig, preset jump, poll lifecycle, aurora shed |
| 8 | SceneManager+ViewManager wiring | - | 160 full | shadowMap, degrade-step swap, aurora callback |

Final: 160 tests pass (97 baseline + 63 new), 0 regressions. `npm run build` OK (40 modules).

## Drift check

- planned_files: 5 NEW src, 7 MODIFY src, 5 NEW test
- actual_files:
  - NEW src (5): src/utils/eclipseData.js, src/effects/EclipseRig.js, src/effects/AuroraEffect.js, src/effects/AircraftLayer.js, src/data/FlightDataService.js
  - MODIFY src (7): EarthView.js, EarthHUD.js, SceneManager.js, performance.js, ViewManager.js, constants.js, main.js
  - NEW test (8): eclipseData, flightDataService, aurora, earthDegradation, earthSim, aircraftGeo, earthHudSim, earthIntegration
- new_dependencies: none (package.json unchanged)
- new_directories: src/effects/, src/data/
- scope_changes:
  - eclipseData.js placed in src/utils/ (not src/effects/) — it is pure data/logic, no THREE render code.
  - AircraftLayer.js added as its own src/effects/ file (F5-2 render layer) — planned implicitly, made explicit.
  - Test files 8 vs planned 5 (+aircraftGeo, +earthHudSim, +earthIntegration) — finer-grained coverage, no src scope creep.
  - Drift on src: 0% (all planned src files, no extras).
