---
id: SPEC-EARTH-002
document: tasks
version: "0.1.0"
created: "2026-07-05"
---

# SPEC-EARTH-002 Task Decomposition

Methodology: TDD (RED-GREEN-REFACTOR) on pure-logic surfaces; WebGL/network land as manual-visual/live-only.

## Planned files

NEW (src):
- `src/utils/eclipseData.js` — real eclipse table + pure detection (F6-1)
- `src/effects/EclipseRig.js` — local shadow diorama (F6-2, visual)
- `src/effects/AuroraEffect.js` — noise-curtain shader + pure helpers (F7-1/2)
- `src/data/FlightDataService.js` — poll/backoff/state machine/validate/dead-reckon (F5-1)
- `src/effects/AircraftLayer.js` — InstancedMesh renderer (F5-2, visual)

MODIFY (src):
- `src/earth/EarthView.js` — shared-clock wiring, mount F5/F6/F7, aurora shed, poll lifecycle
- `src/earth/EarthHUD.js` — aircraft status (aria-live), eclipse picker + find-next, aurora toggle
- `src/scene/SceneManager.js` — shadowMap enable, aurora degrade case + callback + setDegradeSteps
- `src/utils/performance.js` — EARTH_DEGRADE_STEPS, injectable steps, setSteps
- `src/core/ViewManager.js` — swap degrade steps + aurora-shed callback on enter/exit EARTH
- `src/utils/constants.js` — SIM_EPOCH_MS + F5/F6/F7 tuning constants
- `src/main.js` — pass simApi into EarthView

NEW (test):
- `test/eclipseData.test.js`
- `test/flightDataService.test.js`
- `test/aurora.test.js`
- `test/earthDegradation.test.js`
- `test/earthSim.test.js` (clock wiring + poll lifecycle + aurora shed)

## Tasks

- TASK-F6-0: shared sim clock wired into EarthView (prereq for F6). simApi injected; rig driven by real timeSpeed/isPlaying; EarthView advances the one clock while active.
- TASK-F5-1: FlightDataService (state machine, poll airplanes.live, backoff 30s exp, offline short-circuit, coord clamp, dead-reckon).
- TASK-F5-2: AircraftLayer InstancedMesh + geo mapping.
- TASK-F5-3: EarthHUD aircraft status, empty-sky vs error distinction, aria-live.
- TASK-F6-1: eclipseData table + detectEclipsesInRange + findNextEclipse.
- TASK-F6-2: EclipseRig shadow diorama (solar/lunar, red umbra).
- TASK-F6-3: EarthHUD eclipse picker + find-next + illustrative label.
- TASK-F7-1: AuroraEffect curtain shader + night-side fade + pole placement.
- TASK-F7-2: mobile 2-tier fallback (shader vs billboard).
- TASK-F7-3: aurora-first degradation ladder extension.

## AC verification buckets

Code-verified (pure logic): AC-FLIGHT-02 (backoff/offline/clamp), AC-ECLIPSE-02 (500x no-miss + find-next), REQ-550 (no false eclipse), AC-AURORA-02 ordering (aurora-first), aurora night-side/pole math, mobile tier selection, F5 dead-reckon math, HUD state string, empty-vs-error distinction.

Manual/visual or live-network-only: CORS smoke (already confirmed airplanes.live), aircraft InstancedMesh render, eclipse shadow/umbra visuals, aurora appearance, real device fps.
