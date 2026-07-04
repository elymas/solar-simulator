---
id: SPEC-SIM-001
document: tasks
version: "0.1.0"
status: implemented
created: "2026-07-05"
updated: "2026-07-05"
author: manager-tdd
tags: [three.js, solar-system, dwarf-planets, moons, rendering-quality, brownfield]
---

# SPEC-SIM-001: Implementation Tasks (TDD RED-GREEN-REFACTOR)

Development mode: TDD (brownfield). Executed directly on `main` (personal git strategy, no feature branch). Vitest + jsdom test infra bootstrapped by TASK-001.

| ID | Description | Requirement | Depends on | Files (planned → actual) | Status |
|----|-------------|-------------|-----------|--------------------------|--------|
| TASK-001 | Bootstrap Vitest (+ jsdom), config, test script | infra | — | package.json, vitest.config.js, test/planetData.test.js | ✅ done |
| TASK-002 | 5 IAU dwarf planets + flat-color MeshStandard fallback | REQ-010/020/060 | 001 | planetData.js, constants.js, PlanetFactory.js | ✅ done |
| TASK-003 | Dwarf orbital verification + @MX:ANCHOR (Ω/ω omission) | REQ-040 | 002 | OrbitalMechanics.js, test/orbitalMechanics.test.js | ✅ done |
| TASK-004 | Dwarf UI: PlanetList section + InfoPanel branch | REQ-030 | 002 | PlanetList.js, InfoPanel.js, test/ui.test.js | ✅ done |
| TASK-005 | Charon satellite under Pluto (optional) | REQ-050 | 002 | planetData.js | ✅ done |
| TASK-006 | Callisto + 4 Saturn moons; re-tune 7 Saturn moons; REQ-160 snapshot | REQ-110/120/140/160 | 001 | planetData.js | ✅ done |
| TASK-007 | Multisampled composer target (samples:4) + ACES tone mapping | REQ-270/285 | 001 | SceneManager.js | ✅ done (manual-visual) |
| TASK-008 | Relight planets/clouds/satellites → MeshStandard; tune lights | REQ-280 | 002,007 | PlanetFactory.js, SceneManager.js, constants.js | ✅ done (lighting = manual-visual) |
| TASK-009 | Anisotropy + lazy hi-res texture tier (focus) + focus LOD bump | REQ-255/290/220 | 002,008 | PlanetFactory.js, TextureTierManager.js, constants.js, main.js | ✅ done |
| TASK-010 | FrameBudgetDegrader (REQ-240) + low-end flags (REQ-230) | REQ-230/240 | 007,009 | performance.js, SceneManager.js | ✅ done (wiring = manual-perf) |

## Deferred / out of scope (per Phase-1 strategy approval)
- SMAAPass — MSAA-only shipped (TASK-007).
- CONTROLS_DEFAULTS.maxDistance unchanged at 5000 (covers TNOs + stars).
- KTX2/Basis compression (REQ-250) — asset-blocked, deferred.
- Ω/ω orbital elements — intentionally omitted (schematic high-inclination orbits), documented via @MX:ANCHOR.
