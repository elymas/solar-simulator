---
id: SPEC-EARTH-001
document: progress
version: "0.1.0"
status: implemented
created: "2026-07-05"
updated: "2026-07-05"
author: manager-tdd
---

# SPEC-EARTH-001: Run Phase Progress (TDD)

## Checkpoint — Run phase complete (2026-07-05)

All E1-E9 tasks GREEN. `npm test` = 97 tests / 14 files passing (46 inherited from SPEC-SIM-001 + prior gap fixes, +51 new for EARTH-001). `npm run build` clean (597 kB / 149 kB gz, mostly three.js).

| Phase | Result |
|-------|--------|
| RED | Test files authored first per task group (viewRouting, viewManager, solarSystemView, transition-timing, earthRig, earthView, earthHud) — each imports the not-yet-written module and fails until GREEN. |
| GREEN | 4-state ViewManager + hash routing + fade transition + SolarSystemView wrapper + EarthView/EarthRig/EarthHUD implemented; all assertions pass. |
| REFACTOR | Removed the redundant `_mountEarth()` indirection (eager `mount()` in start() + lazy rig build in onEnter cover it); dropped SceneManager's now-dead clock + self-registered resize; centralized resize on ViewManager. |

### Acceptance criteria completion

- Met (code-verified):
  - AC-EARTH-01 (ViewManager 4-state machine + single-context: illegal-transition guard tested; static guard asserts exactly one `new THREE.WebGLRenderer(` and one `new EffectComposer(` across `src/`; passes retargeted per active view).
  - AC-EARTH-02 (hash routing #/ ⇄ #/earth, deep-link, browser-back via hashchange, echo suppression; 400ms fade midpoint-swap timing under fake timers).
  - AC-EARTH-04 (Escape/back-button/browser-back → SOLAR with overview camera restore; mobile exit disposes rig + invokes F5 poll-stop hook; desktop keeps rig resident).
  - AC-EARTH-05 (frozen View interface conformance on BOTH views: mount/unmount/onEnter/onExit/update/getScenePass/dispose; F5/F6/F7 empty mount groups present).
  - AC-EARTH-06 (REQ-380 static guard: no `navigator.geolocation`/`.permissions` anywhere under `src/earth/`).
  - REQ-330 Moon numerics: 27.32 d ±5% and 5.14° ±0.5° asserted; one full 2π orbit in one period verified.
  - REQ-385 context-loss wiring: synthetic `webglcontextlost` → preventDefault + pause; `webglcontextrestored` → resume.
- Partially met (code fact verified, VISUAL/RUNTIME pending — browser-only):
  - AC-EARTH-02 fade *smoothness* (timing is unit-tested; perceived crossfade is manual).
  - AC-EARTH-03 terminator *appearance* (onBeforeCompile day/night patch + uniforms unit-tested; the actual GLSL blend, clouds, and Moon visuals are manual-visual). Sub-solar/terminator HUD readouts render but are placeholder strings (not yet fed live astronomy — that richness belongs to later work).
  - NFR frame p95 (desktop ≤25ms / mobile ≤50ms), real VRAM reclaim after mobile dispose, and real context-loss on constrained hardware — measurement-only, not unit-testable.
- Error count delta: 0 introduced (SIM-001's 46 tests still green). No stagnation triggers.

## Drift check (planned vs actual)

Planned files (spec-compact + tasks.md):

Actual:
- **NEW as planned:** `src/core/ViewManager.js`, `src/views/SolarSystemView.js`, `src/earth/EarthView.js`, `src/earth/EarthRig.js`, `src/earth/EarthHUD.js`.
- **MODIFIED as planned:** `src/main.js` (god-loop + `__solarSim` deleted → ViewManager bootstrap), `src/scene/SceneManager.js` (self-loop neutered → `stepCamera`/`render`; renderPass exposed; resize centralized on ViewManager; dead clock removed), `src/utils/constants.js` (EARTH_VIEW/EARTH_CONTROLS/EARTH_RIG), `src/controls/InteractionManager.js` (`enabled` picking gate).
- **NOT modified (no edit needed):** `src/ui/PlanetList.js`, `src/ui/InfoPanel.js`, `src/ui/TimeControls.js` — UI ownership transfer was achieved by SolarSystemView toggling their existing `.el`/`_toggleBtn` display + wiring, not by editing the widgets. Only TimeControls got a one-line JSDoc fix (stale `__solarSim` reference).
- **Added (justified):** 7 test files under `test/` (viewRouting, viewManager, solarSystemView, earthRig, earthView, earthHud — transition timing folded into viewManager.test.js).

Divergence detail for sync phase:
- planned_files: 5 new + 6 modify → actual 5 new + 5 modify (PlanetList/InfoPanel unedited) + 7 test files.
- new_dependencies: none (three.js + vitest/jsdom only).
- new_directories: `src/core/`, `src/views/`, `src/earth/`.
- scope_changes: none beyond approved simplifications (below).

Drift: low (< 30%), no re-planning gate triggered.

## Architecture divergence from the literal Phase-1 phrasing (flagged, ponytail)

Phase-1 said "ViewManager owns the ONE renderer/composer; SolarSystemView owns scene/camera/controls/lighting." Implemented instead: the single WebGLRenderer + EffectComposer stay constructed inside SolarSystemView's `SceneManager` (which already builds exactly one of each), and ViewManager DRIVES the loop — retargeting the shared passes per active view, invoking the SIM-001 perf-degrader, and calling render. EarthView borrows the shared renderer/composer via `mount()` and never builds a second context.

Rationale: REQ-385 is a property of "one renderer ever," which the single-construction static guard verifies. Physically extracting the render core into ViewManager would have forced churn on SIM-001's delicate perf-degrader coexistence (REQ-240 FrameBudgetDegrader + REQ-018 mobile hard-fallback live in SceneManager and are read/written by PlanetFactory via `sceneManager` flags). Wrapping preserved that behavior in place with zero regression to SIM-001's 46 tests, satisfied the FROZEN View interface (what SPEC-EARTH-002 depends on), and kept the "riskiest task" diff small. If stricter physical ownership is required, the render core can be extracted later behind the same interface.

## Approved simplifications
- Rim-glow + night-city-lights beyond the nightmap terminator blend: skipped (REQ-370 nice-to-have).
- 4K/8K earth hi-res lazy tier: reuse existing 2K day/night/clouds only (no art ships).
- Dolly-zoom transition upgrade: DOM crossfade only.
- F5/F6/F7: empty mount groups + `stopPolling()`/`onStopPolling` hook only — no implementation (SPEC-EARTH-002).
