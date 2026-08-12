---
id: SPEC-EARTH-003
title: "Earth-view event additions: annual meteor showers, ISS marker, Seoul flight reference point"
version: "0.1.0"
status: draft
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
