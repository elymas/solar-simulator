---
id: SPEC-EARTH-001
document: tasks
version: "0.1.0"
status: implemented
created: "2026-07-05"
updated: "2026-07-05"
author: manager-tdd
tags: [three.js, earth-view, view-manager, state-machine, hash-routing, brownfield]
depends_on: [SPEC-SIM-001]
---

# SPEC-EARTH-001: Implementation Tasks (TDD RED-GREEN-REFACTOR)

Development mode: TDD (brownfield). Executed directly on `main` (personal git strategy, no feature branch). Reuses the Vitest + jsdom infra bootstrapped by SPEC-SIM-001. Views/render-core designed for dependency injection so state-machine / hash / lifecycle logic is unit-testable without a real WebGL context (SIM-001 precedent: SceneManager fully stubbed).

Architecture note (E3 divergence, flagged): the single WebGLRenderer + EffectComposer stay owned by SolarSystemView's `SceneManager` (already constructs exactly one of each → REQ-385 by construction). `ViewManager` drives the one rAF loop, retargets the composer passes per active view, invokes the SIM-001 perf-degrader, and calls render — it OWNS loop control without physically re-instantiating the renderer. EarthView borrows the shared renderer/composer via `mount()` and never builds a second context. This preserves SIM-001's delicate degrader coexistence in place rather than extracting/rebuilding it.

| ID | Description | Requirement | Depends on | Files (planned → actual) | Status |
|----|-------------|-------------|-----------|--------------------------|--------|
| E1 | View interface contract + ViewManager 4-state machine (SOLAR/TO_EARTH/EARTH/TO_SOLAR) + illegal-transition guards + injected render-core | REQ-310/315/385 | — | ViewManager.js, test/viewManager.test.js | ✅ done |
| E2 | Hash routing: pure hashToView/viewToHash + hashchange dispatch + #/earth deep-link | REQ-325 | E1 | ViewManager.js, test/viewRouting.test.js | ✅ done |
| E3 | Shared render core + SolarSystemView wrapper; neuter SceneManager self-loop; delete __solarSim; single-renderer/composer assertion | REQ-310/315/385 | E1 | SceneManager.js, SolarSystemView.js, main.js, InteractionManager.js, test/solarSystemView.test.js | ✅ done |
| E4 | UI ownership transfer (PlanetList/InfoPanel/TimeControls/InteractionManager) onEnter/onExit toggling | REQ-330/340 | E3 | SolarSystemView.js, InteractionManager.js | ✅ done |
| E5 | 400ms DOM crossfade transition + midpoint swap + prefers-reduced-motion | REQ-320 | E1 | ViewManager.js, test/transition.test.js | ✅ done |
| E6 | EarthView scaffold: own scene/earth-local camera/controls + F5/F6/F7 mount points | REQ-310/350/360 | E1 | EarthView.js, constants.js, test/earthView.test.js | ✅ done |
| E7 | EarthRig: day/night terminator (onBeforeCompile) + clouds + Moon (27.32d ±5%, 5.14° ±0.5°) | REQ-330/370 | E6 | EarthRig.js, constants.js, test/earthRig.test.js | ✅ done |
| E8 | EarthHUD + exit (back button / Escape / browser back → SOLAR, hash #/, overview restore) | REQ-330/340 | E6 | EarthHUD.js, EarthView.js, ViewManager.js, test/earthHud.test.js | ✅ done |
| E9 | Asset lifecycle (lazy rig build, mobile dispose, poll-stop hook) + WebGL context-loss handler + REQ-380 geolocation guard | REQ-355/380/385 | E6 | EarthView.js, ViewManager.js, test/earthView.test.js | ✅ done |

## Deferred / out of scope (per Phase-1 strategy approval)
- F5 flight data / F6 eclipse / F7 aurora implementations — SPEC-EARTH-002 (only empty mount points/hooks here).
- Rim-glow + night-city-lights beyond the nightmap terminator blend — nice-to-have (REQ-370), skipped; add when art/GL confirmed.
- 4K/8K earth hi-res lazy tier — reuse existing 2K day/night/clouds only (no art ships).
- Dolly-zoom transition upgrade — DOM crossfade only.
