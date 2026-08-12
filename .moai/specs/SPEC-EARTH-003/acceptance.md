# Acceptance Criteria — SPEC-EARTH-003

## 1. AC Matrix (1:1 with REQs)

| AC | REQ | Criterion (testable) | Status | Note |
|----|-----|----------------------|--------|------|
| AC-E3-101 | REQ-E3-101 | SHOWER_TABLE contains ≥4 entries (Quadrantids, Lyrids, Perseids, Geminids) with ranges/peaks/Korean names exactly per spec §1.3; Quadrantids range is start>end (wrap-encoded) | ✅ PASS | vitest table-shape test green (automated) |
| AC-E3-102 | REQ-E3-102 | Activity predicate wrap-correct (Dec 30 ✓, Jan 5 ✓, Jan 20 ✗ for Quadrantids); intensity(peak)=1.0, monotonic taper to 0 at range edges; entry detection over (prevDay, currDay] catches a range entry at ANY step size (1-day and 400-day steps tested) without double-fire | ✅ PASS | **Correction to the criterion text:** the 1-day and 400-day steps named above do NOT prove the "ANY step size" property. 400 exceeds the 365.25-day multi-year branch, so that case never exercised the entry logic at all — the property was false under a green suite until the run phase caught it (see spec.md §9.2 and progress.md §E.2 defect 1). The real test is a sub-year window that fully contains a shower's range, e.g. 2026-11-30 → 2026-12-20 swallowing Geminids. Now verified by vitest predicate/intensity/entry tests plus brute-force fuzzing against a fine-grained oracle (1000 windows across three sampling strategies, 0 mismatches). |
| AC-E3-103 | REQ-E3-103 | While active + Earth view: streaks spawn from a fixed pool (≤12; ≤6 constrained), spawn rate at peak > rate at range edge (spy on spawn calls with fake clock); pool objects recycled (no growth) | ⏳ PARTIAL | Pool logic verified by vitest (automated); **visual appearance (streak look, night-side placement) requires device pass** |
| AC-E3-104 | REQ-E3-104 | Crossing INTO Perseids range → HUD notice "페르세우스 유성우가 쏟아져요!" + exactly one `speak()`; opening Earth view mid-shower → same notice; no repeat until exit+re-entry; multi-year 500x jump → at most one notice per shower | ✅ PASS | vitest jsdom + TTS spy (automated); all behaviors verified |
| AC-E3-105 | REQ-E3-105 | With `prefers-reduced-motion`: zero streak spawns; notice still renders | ✅ PASS | vitest matchMedia stub (automated) |
| AC-E3-106 | REQ-E3-106 | EARTH_DEGRADE_STEPS === ['aurora','meteors','bloom','lod','pixelRatio']; over-budget frames shed aurora first, then meteors (pool reduced/hidden) before bloom; constrained tier boots pool at 6 | ✅ PASS | performance.test.js order test green; vitest verifies step order and constrained boot size (automated) |
| AC-E3-201 | REQ-E3-201 | `issPosition`: pure; period 92 sim-minutes closes orbit (pos(t) ≈ pos(t+92min) within epsilon); max |geodetic latitude| ≈ 51.6° (±0.5°); radius constant above surface and above the aircraft altitude band | ✅ PASS | vitest numeric orbit tests (automated); period closure and inclination band verified |
| AC-E3-202 | REQ-E3-202 | EarthHUD renders ISS toggle (aircraft-toggle pattern); default ON; toggling hides/shows the marker | ✅ PASS | vitest jsdom toggle render test green (automated) |
| AC-E3-203 | REQ-E3-203 | Tapping the ISS marker presents Korean facts (first fact "우주인이 사는 우주 정거장이에요!") and triggers one `speak()`; facts object passes the KIDS-001 §8.1 checklist | ✅ PASS | vitest tap/speak spy + facts checklist validation (automated) |
| AC-E3-204 | REQ-E3-204 | Grep: no fetch/XHR/URL in ISS module; code comment documents the circular-orbit simplification | ✅ PASS | Grep gate on meteorData.js / issOrbit.js / ISSMarker.js / MeteorShower.js: zero matches for fetch/XHR/URL; code comments present |
| AC-E3-301 | REQ-E3-301 | `FLIGHT_DEFAULTS.lat === 37.5 && lon === 126.9`; all other FLIGHT_DEFAULTS fields byte-identical; comment states Seoul rationale | ✅ PASS | vitest constants test green; diff reviewed (automated) |
| AC-E3-302 | REQ-E3-302 | HUD flight copy renders the Korean region wording; LIVE/LOADING/OFFLINE/RATE_LIMITED semantics and empty-sky vs error distinction unchanged (existing SPEC-EARTH-002 characterization tests green) | ✅ PASS | vitest + existing SPEC-EARTH-002 suite green (automated) |

## 2. Given-When-Then Scenarios

### Scenario 1 — Perseids night (today's date, fittingly)
- **Given** the Earth view with the sim clock set to August 12 of any sim year
- **When** the child watches the night side
- **Then** shooting-star streaks fall at their densest rate, the HUD shows "페르세우스 유성우가 쏟아져요!", and one Korean TTS callout plays (respecting mute).

### Scenario 2 — New-year wrap (Quadrantids)
- **Given** the sim clock at Dec 30
- **When** time advances past Jan 3 into Jan 13 at 500x
- **Then** the Quadrantids notice fires exactly once at range entry (Dec 28 crossing already occurred before the window — entry detected at the (prevDay, currDay] crossing), streaks peak near Jan 3, and stop after Jan 12.

### Scenario 3 — Finding the ISS
- **Given** the Earth view with ISS toggle ON
- **When** the child taps the small bright marker sweeping around the globe
- **Then** Korean facts appear and are spoken ("우주인이 사는 우주 정거장이에요!" first), and the marker completes a full lap in 92 sim-minutes.

### Scenario 4 — Our sky
- **Given** the aircraft layer enabled
- **When** live data loads
- **Then** planes populate the Seoul/Incheon region (not London), and every HUD flight status renders in Korean with unchanged state semantics.

## 3. Edge Cases

- Sim clock running BACKWARD (if reset/preset jumps backward): entry detection only fires on forward crossings; backward jumps re-arm silently (documented; test).
- Earth view opened exactly at a range boundary day: notice logic uses the same half-open convention — no double fire.
- 500x multi-year jump spanning 3 sim years: max one notice per shower (A.1 rule), streaks resume at correct current intensity.
- Reduced-motion + active shower + degrader shed: no crash from shedding an already-motion-disabled pool.
- ISS toggle OFF then tap where the marker would be: no selection (raycast target removed with visibility).
- Aircraft OFFLINE state in Seoul (network down): unchanged SPEC-EARTH-002 behavior — Korean OFFLINE wording, no retry storm.

## 4. Quality Gate Criteria

- Full vitest suite green (`npm run test`); `npm run build` succeeds.
- performance.test.js extended for the 5-step Earth order and green; FlightDataService tests untouched-green.
- No new external API (grep gate on ISS/meteor modules).
- Facts/notice strings pass KIDS-001 §8.1 checklist.
- TRUST 5: Tested (pure detection/propagation), Readable (named constants: pool sizes, ISS period/inclination/altitude), Unified (eclipseData/aurora module patterns), Secured (no new external input surface), Trackable (conventional commits per milestone referencing SPEC-EARTH-003).

## 5. Definition of Done

- ✅ All AC-E3-1xx/2xx/3xx PASS on automated test (vitest + grep gate), with two exceptions:
  - ⏳ AC-E3-103 visual verification (streak appearance on device) — **OPEN**, pending device pass
  - ⏳ Device pass on streak look, ISS visibility, Seoul aircraft live smoke — **OPEN**
- ✅ `depends_on` gate satisfied (SPEC-KIDS-001 completed before run-phase entry, confirmed).
- ✅ Simplifications documented in code comments (annual-recurrence idealization, circular ISS orbit, streak night-side gating).
- ✅ No open clarification markers were declared.
- ✅ Run-phase quality gates: TRUST 5 PASS, evaluator-active PASS (cycle 2), 422 tests passing, npm run build succeeds.
