---
id: SPEC-EARTH-003
title: "Earth-view event additions: annual meteor showers, ISS marker, Seoul flight reference point"
version: "1.0.0"
status: implemented
created: 2026-08-12
updated: 2026-08-12
author: limbowl
priority: P2
phase: "v1.1.0"
module: "src/earth + src/effects + src/utils"
lifecycle: spec-anchored
tier: M
tags: "earth-view, meteor-shower, iss, seoul, flight-data, range-test, degradation, brownfield"
depends_on: [SPEC-KIDS-001]
related_specs: [SPEC-EARTH-001, SPEC-EARTH-002, SPEC-SIM-001]
---

## HISTORY

- 2026-08-12 (v1.0.0): Run completed and synced. All 12 REQ/AC pairs implemented. Independent evaluation PASS on cycle 2 after fixing critical entry-detection gap and intensity dead zones. Plan-versus-actual divergence and frozen contracts for downstream SPECs are recorded in §9. Original requirements (§3) preserved verbatim; divergence annotated in §9.2. Status upgraded from draft to implemented.
- 2026-08-12 (v0.1.0): Initial draft. Covers proposal items 8 (meteor showers), 11 (ISS), 15 (flight reference point → Seoul/Incheon). Third Earth-view SPEC, extending the SPEC-EARTH-001/002 layer stack. Depends on SPEC-KIDS-001 for Korean HUD strings + TTS channel + facts shape.

---

# SPEC-EARTH-003: Earth-View Event Additions

## 1. Environment

### 1.1 Overview

The Earth view (SPEC-EARTH-001/002) already layers day/night terminator, a real-period Moon, eclipse diorama + HUD, tiered aurora, and live aircraft. This SPEC adds three kid-visible layers: annual meteor showers with shooting-star streaks driven by the shared simulation clock, a tappable ISS marker on a 92-minute orbit, and relocation of the live-aircraft reference point from London to the child's home sky — Seoul/Incheon.

### 1.2 Brownfield Facts (verified citations)

- `src/utils/eclipseData.js:105` — `detectEclipsesInRange(prevDay, currDay)` half-open interval range-testing immune to frame step size; `findNextEclipse` at line 118. THIS is the reference pattern for time-anchored event detection that the meteor-shower table reuses.
- `src/utils/constants.js:107-108` — `SIM_EPOCH_ISO = '2026-03-30T00:00:00Z'` / `SIM_EPOCH_MS`: sim-day 0 anchor shared by TimeControls and the eclipse table; shower dates convert through the same anchor.
- `src/utils/constants.js:113-123` — `FLIGHT_DEFAULTS` with `lat: 51.5, lon: -0.1` (London; lat/lon at lines 115-116) feeding the airplanes.live point query (`baseUrl: 'https://api.airplanes.live/v2/point'`, radius 250nm, poll 12s).
- `src/utils/performance.js:40` — `EARTH_DEGRADE_STEPS = ['aurora','bloom','lod','pixelRatio']`; ViewManager swaps degrader steps on Earth enter/exit; `SceneManager.js:190-192` — `onAuroraShed` callback precedent for wiring a shed action.
- `src/earth/EarthView.js` + `src/earth/EarthHUD.js` — Earth view with HUD toggles (aircraft toggle precedent for the ISS toggle), auto-collapse ≤768px; all strings routed Korean-first by SPEC-KIDS-001.
- `src/core/ViewManager.js` — SOLAR/EARTH state machine, single rAF, `prefers-reduced-motion` honored, shared sim clock (`solarView.simApi`; Earth view advances the same clock).

### 1.3 Shower reference data (authoritative for REQ-E3-101)

| Shower | koreanName (canonical field) | Activity range | Peak |
|--------|------------------------------|----------------|------|
| Quadrantids | 사분의 유성우 | Dec 28 – Jan 12 (year-wrapping) | Jan 3 |
| Lyrids | 거문고 유성우 | Apr 14 – Apr 30 | Apr 22 |
| Perseids | 페르세우스 유성우 | Jul 17 – Aug 24 | Aug 12 |
| Geminids | 쌍둥이 유성우 | Dec 4 – Dec 17 | Dec 14 |

Naming convention (canonical): the table's `koreanName` field is the SINGLE source for every shower-name surface, and it EXCLUDES the constellation suffix "자리" (i.e. "페르세우스 유성우", never "페르세우스자리 유성우"). The HUD notice, the AC literal, and the TTS callout all derive mechanically as `${koreanName}가 쏟아져요!`.

## 2. Assumptions

- **A-401**: The sim clock's day-number → calendar-date mapping (epoch 2026-03-30) is the single time source; showers recur EVERY sim year on the same calendar dates (real-world drift of ±1 day across years is ignored — documented simplification).
- **A-402**: SPEC-KIDS-001 is completed first (`depends_on`): HUD strings module + TTS `speak()` + facts shape available.
- **A-403**: A pooled streak effect (≤12 concurrent sprites/lines) is within Earth-view frame budget on `full`-tier devices; the degrade ladder protects the rest.
- **A-404**: Seoul-area point query (37.5, 126.9, 250nm) returns a healthy aircraft population from airplanes.live (ICN/GMP corridor is among the densest in Asia); the SPEC-EARTH-002 state machine (LIVE/OFFLINE/RATE_LIMITED, empty-sky vs error) is location-agnostic and needs no logic change.
- **A-405**: A circular-orbit ISS approximation (no TLE, no precession) is honest enough for a 5-year-old when labeled as a symbolic marker (matching the app-wide symbolic-scale stance).

## 3. Requirements (GEARS)

### 3.1 MS — Annual meteor showers (proposal item 8)

**Ubiquitous**

- **REQ-E3-101**: The event layer shall define a data table of at least the four major annual showers in §1.3 (Quadrantids, Lyrids, Perseids, Geminids) with activity date ranges, peak dates, and Korean names, including explicit year-wrapping logic for ranges crossing Dec 31 (Quadrantids).
- **REQ-E3-102**: Shower detection shall be pure logic against the shared sim clock: an activity predicate (is date within range, wrap-aware) and an intensity function (0..1, peaking exactly at the peak date, tapering to range edges). Detection of range ENTRY (for one-shot notices) shall use half-open interval crossing over (prevDay, currDay] — reusing the `eclipseData.js` range-test philosophy so no entry is skipped at any frame step size, including 500x.
- **REQ-E3-106**: The streak effect shall join the Earth degrade ladder as a 'meteors' step positioned immediately AFTER 'aurora' (shed order: aurora → meteors → bloom → lod → pixelRatio), and shall respect the SPEC-MOBILE-001 `constrained` tier by booting at a reduced pool size.

**State-driven**

- **REQ-E3-103**: **While** a shower is active AND the Earth view is active, the view shall render shooting-star streaks from a fixed pre-allocated pool (small sprite/line effects), with spawn rate scaled by the intensity function (visibly densest at the peak date).
- **REQ-E3-105**: **While** `prefers-reduced-motion` is set, streak animation shall be disabled; the HUD notice (REQ-E3-104) still appears so the event is not lost.

**Event-driven**

- **REQ-E3-104**: **When** the sim clock crosses INTO a shower's activity range (or the Earth view opens during an active shower), the HUD shall show a Korean notice derived from the shower table's `koreanName` field as `${koreanName}가 쏟아져요!` (Perseids: "페르세우스 유성우가 쏟아져요!") and emit one TTS callout via the shared SPEC-KIDS-001 channel; the notice shall not repeat until the range is exited and re-entered.

### 3.2 ISS — International Space Station marker (proposal item 11)

**Ubiquitous**

- **REQ-E3-201**: The Earth view shall render an ISS marker orbiting with a 92-minute period measured in SIMULATION time, inclination 51.6°, at a display altitude just above the Earth surface (visually distinct from aircraft altitude); its position propagation shall be a pure function of sim time (unit-testable: period, inclination band, altitude radius).
- **REQ-E3-202**: The EarthHUD shall provide an ISS visibility toggle following the existing aircraft-toggle pattern; the ISS layer defaults ON (it is one cheap marker, unlike the polled aircraft layer).

**Event-driven**

- **REQ-E3-203**: **When** the ISS marker is tapped/selected, the UI shall present its Korean kid facts (SPEC-KIDS-001 shape, e.g. first fact "우주인이 사는 우주 정거장이에요!") and speak them via the shared TTS channel.

**Unwanted behavior**

- **REQ-E3-204**: The ISS layer shall not fetch external tracking data (no TLE/API); the orbit is an honest symbolic circular approximation, documented as such in code comments and the info content.

### 3.3 SEOUL — Flight reference point (proposal item 15)

**Ubiquitous**

- **REQ-E3-301**: `FLIGHT_DEFAULTS` (`src/utils/constants.js:113-123`) shall change its reference point from London (lat 51.5, lon -0.1) to the Seoul/Incheon area (lat 37.5, lon 126.9), keeping all other tuning (radius, poll interval, backoff, instance cap) unchanged; the code comment shall be updated to state the Seoul rationale (primary user's home sky; ICN/GMP corridor density).
- **REQ-E3-302**: HUD flight copy shall reflect the new region in Korean (e.g., status line referring to 서울 하늘 / 우리나라 하늘), sourced from the SPEC-KIDS-001 strings module; the LIVE/LOADING/OFFLINE/RATE_LIMITED state semantics and the empty-sky vs error distinction (SPEC-EARTH-002 REQ-480/490) are preserved untouched.

## 4. Solution Approach

- **Shower table + detection**: `[NEW] src/utils/meteorData.js` mirroring `eclipseData.js` structure: SHOWER_TABLE (month/day ranges + peak + Korean names), `isShowerActive(simDay)`, `showerIntensity(simDay)`, `detectShowerEntries(prevDay, currDay)` (half-open, wrap-aware). Year-wrap approach: map sim-day → calendar month/day via the SIM_EPOCH anchor; a range with start > end (Dec 28–Jan 12) is active when date ≥ start OR ≤ end.
- **Streaks**: `[NEW] src/effects/MeteorShower.js` — fixed pool (default 12; constrained 6) of short additive line/sprite streaks spawning at random sky positions on the night-side upper dome, brief lifetime, recycled; spawn cadence = base × intensity. Mount/unmount with Earth view lifecycle (aurora precedent).
- **ISS**: `[NEW] src/earth/ISSMarker.js` — small emissive sprite/mesh + `[NEW]` pure propagation in the same file or `src/utils/issOrbit.js`: angle = simMinutes/92 × 2π on a plane inclined 51.6°, radius = earthRadius + displayAltitude. Raycast-included (tappable), HUD toggle like aircraft.
- **Seoul**: two-line constants change + comment + HUD strings (via strings module).

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Frame rate | Earth-view targets preserved (desktop 60 / mobile 30fps); streak pool bounded; ISS is one marker |
| Allocation | Streak pool pre-allocated; zero per-frame geometry allocation (recycle in place) |
| Degradation | 'meteors' sheds after 'aurora', before bloom (REQ-E3-106); ISS marker is exempt (single sprite, negligible) |
| External APIs | ZERO new external dependencies (showers/ISS fully offline; aircraft unchanged) |
| Accessibility | HUD notice `aria-live="polite"`; reduced-motion per REQ-E3-105 |
| Testability | Shower table/predicates/intensity, entry detection, ISS propagation: pure vitest targets |

## 6. Exclusions (What NOT to Build)

### Out of Scope — Real-time ISS tracking

- No TLE ingestion, no live ISS API. Symbolic circular orbit only (REQ-E3-204).

### Out of Scope — Radiant-accurate meteor rendering

- Streaks spawn decoratively on the night dome; no radiant-point geometry per shower constellation, no magnitude distribution physics.

### Out of Scope — Shower catalog completeness

- Four major showers only. Minor showers (Orionids, Leonids, ...) are a data-table extension left to future content work.

### Out of Scope — Earth-view camera relocation

- The initial Earth-view camera orientation is untouched; only the AIRCRAFT reference point moves to Seoul. Auto-rotating the globe to face Korea is future UX work.

### Out of Scope — Aircraft provider/state-machine changes

- `FlightDataService` polling, backoff, state machine, and trust-boundary clamping (SPEC-EARTH-002) are consumed as-is; only `FLIGHT_DEFAULTS` coordinates and HUD copy change.

## 7. Traceability (REQ → AC)

| Requirement | Module | Acceptance |
|-------------|--------|------------|
| REQ-E3-101..106 | MS | AC-E3-101..106 |
| REQ-E3-201..204 | ISS | AC-E3-201..204 |
| REQ-E3-301..302 | SEOUL | AC-E3-301..302 |

## 8. Proposal Item Traceability (Appendix)

| Proposal item # | Item summary | REQ IDs |
|-----------------|--------------|---------|
| 8 | Meteor showers (table + range-test detection, year wrap, streak pool, Korean HUD notice + TTS, reduced-motion, degrade ladder) | REQ-E3-101, 102, 103, 104, 105, 106 |
| 11 | ISS (92-min sim orbit, 51.6°, HUD toggle, tappable → Korean facts + TTS, no external data) | REQ-E3-201, 202, 203, 204 |
| 15 | Flight reference point → Seoul/Incheon + Korean HUD copy | REQ-E3-301, 302 |

---

## 9. Implementation Record (2026-08-12)

All 12 REQ/AC pairs were implemented. This section records **what was actually built**. Sections 1–8 preserve the plan-time record unchanged; only §9.2 explicitly lists where reality diverged from plan, and why.

### 9.1 Frozen Contracts for Downstream SPECs

Currently only SPEC-KIDS-001 references EARTH-003 as a consumer of its TTS and facts contracts, so EARTH-003 has no downstream SPECs of its own. Still, the following public surface is frozen for any future SPEC that might consume it:

#### Shower table and predicates — `src/utils/meteorData.js`

| Export | Signature | Purpose |
|--------|-----------|---------|
| `SHOWER_TABLE` | `Array<{id, koreanName, start, end, peak}>` where `start`, `end`, `peak` are ordinal day-of-year (1..365) integers | Four-entry table (Quadrantids, Lyrids, Perseids, Geminids) with canonical Korean names and ordinal-day ranges. Ordinals are fixed to a non-leap reference year; the wrap is encoded as `start > end` (Quadrantids: 362 > 12 representing Dec 28 → Jan 12). Example: `{id:"quadrantids",koreanName:"사분의 유성우",start:362,end:12,peak:3}`. Do not modify existing entries; extend by appending. Table ranges do not overlap — a single match is the correct return type for activity queries. |
| `isShowerActive(simDay)` | `(number) → {id,koreanName,start,end,peak}\|null` | The shower object active at `simDay`, or `null` if none. Pure function; no external state. Unit-testable. |
| `showerIntensity(simDay)` | `(number) → [0, 1]` | Intensity value for the active shower (0 if none). Reaches exactly 0 at the instant the range opens, exactly 1.0 at the peak instant, and tapers to 0 at the close of the final active day. **Load-bearing split**: activity remains day-quantized (used by `detectShowerEntries` boundary scan), but intensity interpolates continuously within days (for smooth spawn-rate animation). |
| `detectShowerEntries(prevDay, currDay)` | `(number, number) → Array<{...}>` | Pure function returning shower objects newly entered during the half-open window (prevDay, currDay]. Walks every whole day boundary the span crosses, making detection exact regardless of frame step size. Returns `[]` for backward time (currDay ≤ prevDay). Returns the full `SHOWER_TABLE` array once each for spans ≥ 365.25 days (multi-year fast-forward rule to avoid notice spam after 500x jumps). |

**Key invariant**: The table's `koreanName` field is the single source for every shower-name surface (HUD notice, AC literal, TTS callout, derived as `${koreanName}가 쏟아져요!`). Consumers maintain their own notice re-arm gate (see EarthView._detectShowers); the function is stateless and pure.

#### ISS propagation — `src/utils/issOrbit.js`

| Export | Signature | Purpose |
|--------|-----------|---------|
| `issPosition(simTimeMinutes)` | `(number) → {x, y, z}` | Pure function: circular-orbit ISS position in sim world coordinates. Period 92 sim-minutes, inclination 51.6°, constant radius = earthRadius + 15 units. Returns cartesian {x, y, z} in the same scale as planets. Unit-testable; no external data, no network calls. No TLE, no live tracking (REQ-E3-204, A-405). |

#### ISS marker and facts — `src/earth/ISSMarker.js`

| Export | Signature | Purpose |
|--------|-----------|---------|
| `ISS_FACTS` | `{name, nameKo, emoji, factsKo, sizeComparisonKo}` where `factsKo` is `string[3]` | SPEC-KIDS-001 §10.1(c) frozen body-facts shape. First fact verbatim: `"우주인이 사는 우주 정거장이에요!"`; `sizeComparisonKo`: `"국제 우주 정거장은 축구장 하나만큼 커요!"`. Reused identically by consumer InfoPanel and TTS layers. |
| `ISSMarker` | Class: `constructor()`, property `object3d: THREE.Sprite`, method `update(simMinutes)`, method `setVisible(visible)`, method `dispose()` | Small emissive sprite orbiting Earth at altitude 15. Built once; `update()` rewrites position in place (zero per-frame allocation). Included in `EarthView`'s raycast target set via the `object3d` property (tappable). `setVisible()` controls visibility; tap handling and facts/TTS dispatch live in `EarthView._selectISS` (drag-guarded by `TOUCH_TAP_MAX_DRAG_PX`). |

#### Streak effect — `src/effects/MeteorShower.js`

| Export | Signature | Purpose |
|--------|-----------|---------|
| `MeteorShower` | Class: `constructor(opts)` where opts = `{poolSize?, earthRadius?, sunDirection?, win?}`, method `update(dt, simDay)`, method `setVisible(v)`, method `dispose()` | Fixed pre-allocated pool (12 full / 6 constrained) of short additive-blended line streaks spawning on the night-side upper dome. `update(dt, simDay)` advances streak life and spawns new ones at rate = `baseSpawnRate × intensity`. `setVisible(false)` both hides the pool AND stops all spawning/animation (degrade shed, REQ-E3-106). Zero per-frame allocation; slots recycle in place. Respects `prefers-reduced-motion`. |

#### Degradation ladder — `src/utils/performance.js`

| Export | Value | Purpose |
|--------|-------|---------|
| `EARTH_DEGRADE_STEPS` | `['aurora', 'meteors', 'bloom', 'lod', 'pixelRatio']` | Degradation order for Earth-view frame budgeting (REQ-E3-106). Steps shed left-to-right; restore resumes right-to-left. The 'meteors' step is positioned immediately after 'aurora' so frame-budget pressure sheds decorative streaks before costly bloom. SceneManager dispatches `'meteors'` (shed) and `'restore:meteors'` (restore) to the `onMeteorsShed` callback, which calls `meteorShower.setVisible()`. |

#### Constants — `src/utils/constants.js`

| Export | Fields | Purpose | Attribution |
|--------|--------|---------|-------------|
| `ISS_DEFAULTS` | `{orbitalPeriodMinutes: 92, inclinationDeg: 51.6, altitudeOffset: 15}` | ISS symbolic orbit tuning (REQ-E3-201). Altitude chosen to sit above aircraft band (3–4.5 units at cruise) and below cloud shell (~102) to prevent visual collision. | SPEC-EARTH-003 |
| `METEOR_DEFAULTS` | `{poolSizeFull: 12, poolSizeConstrained: 6, baseSpawnRate: 3, lifetimeMinSec: 0.5, lifetimeMaxSec: 0.8, altitudeMin: 30, altitudeMax: 55, length: 12, speed: 80}` | Streak pool and spawn tuning (REQ-E3-103/106). Altitude/length/speed are visual calibration knobs for decorative night-side streaks, not physical meteor scale. Constrained tier (SPEC-MOBILE-001) uses `poolSizeConstrained`. | SPEC-EARTH-003 |
| `FLIGHT_DEFAULTS` | `{baseUrl, lat: 37.5, lon: 126.9, radiusNm, pollIntervalMs, backoffStartMs, backoffMaxMs, maxInstances, altitudeScale}` | Live-aircraft query moved from London (51.5°N, 0.1°W) to Seoul/Incheon (37.5°N, 126.9°E) — the primary user's home sky; ICN/GMP corridor is among Asia's densest. All other fields (radius, poll interval, backoff, instance cap) unchanged. | SPEC-EARTH-002 (set); SPEC-EARTH-003 (lat/lon moved) |

### 9.2 Plan Versus Actual (Divergence Table)

| # | Item | Planned | Actual | Reason |
|---|------|--------|--------|--------|
| 1 | Shower entry detection module location | `src/utils/meteorData.js` (plan.md §D lists it flatly) | `src/utils/meteorData.js`, separate file mirroring `eclipseData.js` structure | No divergence; plan.md did not propose absorption into EarthView. Pure logic warrants standalone module for unit-test isolation and reuse (same eclipse-data pattern). |
| 2 | ISS propagation module location | `src/utils/issOrbit.js` (plan.md §D alternative: "same file or `src/utils/issOrbit.js`") | Implemented in `src/utils/issOrbit.js`, separate file | Isolated propagation logic enables unit testing without Three.js setup; matches plan. |
| 3 | `SceneManager.js` modification | Listed as "only if shed-callback wiring requires it" | Required modification; shed callback wired at lines 234 and 239, new `'meteors'` and `'restore:meteors'` cases dispatching to `onMeteorsShed` callback | SPEC-EARTH-002 established the shed-callback precedent for aurora. Meteor degrade follows the exact pattern: EarthView calls `meteorShower.setVisible()` in response to the callback. Necessary, not optional. |
| 4 | `src/ui/strings.js` | Implied as "HUD strings via strings module" but not explicitly named in file-touch list (plan.md §D) | Modified to add shower Korean names and ISS status strings | Shower notice and ISS toggle/fact labels routed through the module as required by REQ-E3-104/202. No new dependency, existing pattern. |
| 5 | ISS facts object location | Plan.md §D allows "planet-data or local beside ISSMarker" | `ISS_FACTS` object defined locally in `ISSMarker.js` alongside the marker class | Plan explicitly permitted this option. SPEC-KIDS-001 §10.1(c) mandates that "consumed is the shape, not the file", so location does not matter to consumers. |
| 6 | New external dependencies | Zero stated in §5 NFR | Zero dependencies added | package.json and package-lock.json byte-identical before and after. |
| 7 | New directories | Not mentioned in plan | `src/earth/` and `src/effects/` pre-existed (SPEC-EARTH-001/002); no new directory created | All new and modified files fit within existing module boundaries. |

### 9.3 Unverified Items (Not Rounded Up to Pass)

The following criteria remain **unverified** and are explicitly NOT marked satisfied until a device-based manual pass is completed:

- **AC-E3-103 visual verification** — "Streaks spawn from fixed pool, spawn rate at peak > edge" (vitest logic passes; visual appearance not verified). The pool is correctly recycled and spawn cadence scales with intensity, but the visual "look" of streaks at peak vs edge intensity is unverified on a real browser at real framerates.
- **Definition of Done device pass (§5)** — "Manual Earth-view pass on device (streak look, ISS visibility, Seoul aircraft live smoke from the deploy origin)". All automated tests pass and the code review found no issues, but the following require actual rendering:
  - Streak visual appearance and night-side placement
  - ISS marker glint/visibility and orbit smoothness
  - Seoul aircraft population density (live API smoke test on a real device in a real browser)

### 9.4 Coverage Metrics

- **Repository totals**: 87.47% statement coverage, 90.33% line coverage (target 85%, met).
- **New modules**:
  - `ISSMarker.js`: 100 / 100 / 100 (statement / branch / function)
  - `issOrbit.js`: 100 / 100 / 100 (statement / branch / function)
  - `meteorData.js`: 100 / 95.65 / 100 (one internal `intensityOf` branch at line 77 untested; reflects a guard that never fires in practice because `isShowerActive` gates every caller. Functionality verified by 1000-sample fuzzing; statement coverage 100%)
  - `MeteorShower.js`: 98.86 / 94.59 / 100 (statement / branch / function)
- **Modified modules**:
  - `EarthHUD.js`: 95.8% statement
  - `EarthView.js`: 88.16% statement
  - `performance.js`: 97.5% statement
- **Untested integration**: `SceneManager.js` dispatch of new `'meteors'` (line 234) and `'restore:meteors'` (line 239) shed steps is untested in isolation. The function is not imported by any test; no test harness exists for `_applyBudgetDegradation` dispatch logic. Both endpoints (FrameBudgetDegrader emits step names; `EarthView.setMeteorsShed` receives them via `onMeteorsShed` callback) are covered; only the dispatch line itself is dark. This is a pre-existing structural gap shared with `'aurora'`/`'restore:aurora'` from SPEC-EARTH-002, not introduced by this SPEC.
