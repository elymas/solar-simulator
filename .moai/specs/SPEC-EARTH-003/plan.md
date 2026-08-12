# Implementation Plan — SPEC-EARTH-003

Sections ordered by decision-reversibility: most-likely-to-change decisions first.

## A. Key Decisions (highest change-likelihood first)

### A.1 Year-wrapping calendar model (data-model decision — review first)

Showers are defined by calendar (month, day) ranges, not sim-day ranges: sim-day → UTC date via `SIM_EPOCH_MS` (the same anchor TimeControls and eclipseData use), then wrap-aware comparison — a range whose start > end (Quadrantids Dec 28 → Jan 12) matches when `date ≥ start || date ≤ end`. Entry detection converts BOTH `prevDay`/`currDay` to dates and reports ranges entered in the half-open interval, with an explicit multi-year fast-forward rule: if `currDay − prevDay` spans ≥1 full year, every shower is "entered" at most ONCE for the notice (no notice spam after a 500x multi-year jump).

Rejected alternative: precomputed per-year sim-day tables (eclipse-style). Eclipses are catalog instants (specific real events); showers are annual periodic ranges — a periodic predicate is smaller and needs no table regeneration for future years.

### A.2 Notice + intensity semantics (kid-visible behavior)

- One notice per range ENTRY (plus when opening Earth view mid-shower) — not per peak, not per frame. Re-arm only after range EXIT.
- Intensity: piecewise-linear 0→1→0 (range start → peak → range end). Spawn cadence = `maxRate × intensity`, so Perseids on Aug 12 visibly outclasses Aug 24.
- Notice text pattern: `${koreanName}가 쏟아져요!` — "페르세우스 유성우가 쏟아져요!" verbatim for Perseids; strings via KIDS-001 module; the same line is the TTS callout.

### A.3 Streak rendering technique (perf envelope)

Fixed pool of 12 (constrained tier: 6) short additive-blended line segments (THREE.Line pairs or elongated sprites — final pick at run phase inside the fixed-budget rule) spawning on the upper night-side dome, each with ~0.5-0.8s life, head-bright/tail-fade, recycled in place. No particle system dependency, no per-frame allocation (aurora/eclipse module discipline). Degrade: 'meteors' step halves then hides the pool.

### A.4 ISS propagation + interaction seam

Pure function `issPosition(simTimeMinutes) → {x,y,z}`: circular orbit, period 92 sim-minutes, inclination 51.6° plane, radius = earth display radius + fixed offset chosen to sit visually ABOVE aircraft altitude scale (aircraft at ~3-4.5 units per `constants.js:122` comment; ISS offset above that band). Marker = small emissive sprite with a subtle glow; registered in the Earth-view raycast target set (tappable per REQ-E3-203) — unlike belts (EVENTS-001), a single marker is a cheap, meaningful target.

### A.5 Seoul constants change (mechanical, land last)

`lat: 51.5 → 37.5`, `lon: -0.1 → 126.9`, comment rewritten (home-sky rationale + ICN/GMP density). HUD copy keys updated in the strings module. No FlightDataService logic change — verified by its untouched tests.

## B. Trade-off Notes

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Shower time model | Periodic calendar predicate | Per-year event table (eclipse pattern) | Annual recurrence is intrinsic; a predicate is ~20 lines and immune to "table ran out in 2031" rot. The RANGE-TEST philosophy (half-open crossing) is still inherited for entry notices |
| Streak placement | Random night-dome decorative | Radiant-accurate per-constellation origin | Radiant math adds celestial-coordinate plumbing invisible to a 5-year-old; night-side placement preserves the real "meteors at night" association |
| ISS data | Fixed circular orbit | Live TLE/API | Zero-dependency honesty (REQ-E3-204); a real-time feed adds a second external API for imperceptible kid value (SPEC-EARTH-002's A-405 aurora precedent) |
| ISS default | ON | OFF like aircraft | Aircraft OFF-default exists because polling costs network/battery (SPEC-EARTH-002 REQ-480); ISS costs nothing and delights immediately |
| Notice channel | Existing EarthHUD notice surface + TTS | New toast system | HUD already owns Earth-view messaging; a parallel toast system fragments UX (if EVENTS-001's EventBanner proves trivially reusable, use it — soft option, not a contract) |

## C. Milestones (phase ordering; priority labels)

| M | Scope | Priority |
|---|-------|----------|
| M1 | `meteorData.js` table + predicates + intensity + wrap-aware entry detection — tests FIRST (RED: Quadrantids wrap, Perseids peak, 500x jump single-notice) | High |
| M2 | MeteorShower streak pool + Earth-view mount/unmount + intensity-driven spawn + reduced-motion gate | High |
| M3 | Degrade ladder: EARTH steps → ['aurora','meteors','bloom','lod','pixelRatio']; constrained boot pool; performance.test.js extension | Medium |
| M4 | HUD notice + TTS wiring (entry events + view-open-mid-shower) | Medium |
| M5 | ISS: propagation function (tests first) + marker + HUD toggle + tap → facts + TTS | High |
| M6 | Seoul constants + comment + HUD copy; full regression + build + manual Earth-view pass | Medium |

## D. File-Touch List

**New**
- `src/utils/meteorData.js` (+ `src/utils/meteorData.test.js`)
- `src/effects/MeteorShower.js` (+ pool/spawn logic tests where pure)
- `src/earth/ISSMarker.js` (+ `src/earth/ISSMarker.test.js` or co-located propagation tests)

**Modified**
- `src/utils/performance.js` (EARTH_DEGRADE_STEPS gains 'meteors' after 'aurora')
- `src/earth/EarthView.js` (mount showers + ISS; shed callbacks mirroring `onAuroraShed` at `SceneManager.js:190-192`)
- `src/earth/EarthHUD.js` (ISS toggle + shower notice + Seoul copy)
- `src/core/ViewManager.js` (only if shed-callback wiring requires it — mirror of aurora wiring)
- `src/utils/constants.js` (FLIGHT_DEFAULTS lat/lon + comment; ISS/METEOR default blocks)
- `src/planets/planetData.js` or local facts object (ISS facts in KIDS-001 shape — ISS is not a planetData body; facts object lives beside ISSMarker, same shape)

## E. Test Strategy (TDD)

- **Pure targets (tests first)**: wrap-aware activity (Dec 30 active, Jan 5 active, Jan 20 inactive for Quadrantids), intensity peak exactness (Aug 12 = 1.0; monotonic taper), entry detection at coarse steps (half-open: no double-notice, no skip; multi-year jump → one notice per shower max), ISS propagation (period closes the circle within epsilon; max |latitude| ≈ 51.6°; radius constant).
- **Characterization**: performance.test.js Earth-step order; FlightDataService untouched-green.
- **jsdom**: HUD toggle renders; notice appears/re-arms correctly with fake sim clock; TTS spy counts.
- **Manual/device**: streak look, night-side placement, ISS glint visibility, Seoul aircraft density live smoke (the CORS/live-data smoke precedent from SPEC-EARTH-002 §9 — same API, new coordinates).

## F. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Seoul-area query returns sparse aircraft at some hours (late night) | SPEC-EARTH-002 REQ-490 empty-sky-vs-error display already handles legitimate emptiness; radius 250nm covers Japan/China corridors too |
| Notice spam at high speed crossing multiple ranges | Multi-year jump rule (A.1) + per-shower re-arm gate; explicit test |
| Streaks visible on day side (looks wrong) | Spawn constrained to night hemisphere via the existing sun-direction dot test (aurora precedent) |
| 'meteors' step insertion breaks EARTH step-order assumptions in ViewManager swap logic | Extend performance.test.js FIRST for the new order; ViewManager consumes the exported constant, not a literal |
| ISS tap competes with aircraft markers spatially | ISS altitude band sits above aircraft; raycast prioritizes nearest — acceptable; manual check |

## G. Cross-SPEC Notes

- `depends_on: SPEC-KIDS-001` (strings module, TTS, facts shape). The ISS facts object and shower notices conform to the KIDS shape/checklist.
- SPEC-EVENTS-001 is independent (different view); if its `EventBanner` lands first and is trivially reusable for the HUD notice, reuse — otherwise the HUD notice stands alone (no cross-SPEC contract created).
- SPEC-PWA-001 offline: showers/ISS are fully offline features (no new API), strengthening the offline story automatically.
- Run-order: implement after SPEC-MOBILE-001; REQ-E3-106 consumes its constrained-tier definition and extends the degrader ladder it characterizes.

No open clarification markers — all decisions resolved with stated defaults.
