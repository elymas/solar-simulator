---
id: SPEC-EVENTS-001
title: "Solar-view celestial additions: Halley's Comet, asteroid/Kuiper belts, planetary alignment event"
version: "0.1.0"
status: draft
created: 2026-08-12
updated: 2026-08-12
author: limbowl
priority: P2
phase: "v1.1.0"
module: "src/planets + src/effects"
lifecycle: spec-anchored
tier: M
tags: "comet, halley, asteroid-belt, kuiper-belt, alignment, instancing, three.js, brownfield"
depends_on: [SPEC-KIDS-001]
related_specs: [SPEC-SIM-001, SPEC-EARTH-002, SPEC-MOBILE-001]
---

## HISTORY

- 2026-08-12 (v0.1.0): Initial draft. Covers proposal items 7 (Halley's Comet), 9 (asteroid + Kuiper belts), 10 (planetary alignment event). Depends on SPEC-KIDS-001 for the kid-facts data shape + TTS callout channel.

---

# SPEC-EVENTS-001: Solar-View Celestial Additions

## 1. Environment

### 1.1 Overview

The solar view today contains the sun, 8 planets, 5 dwarfs, 21 moons, and 4 stars — but no comet, no belts, and no "event" moments. This SPEC adds three wonder-generators: Halley's Comet on a visibly eccentric orbit with an anti-sunward tail, instanced asteroid/Kuiper belts, and a planetary-alignment celebration event with a Korean banner and TTS callout.

### 1.2 Brownfield Facts (verified citations)

- `src/planets/planetData.js` — bodies carry `distanceDisplay` on the symbolic ~80..3500-unit scale (observed: Mercury 80, Venus 150, Earth 200, Mars 300, Jupiter 450, Saturn 600, Uranus 730, Neptune 850, Ceres 400, Pluto 950, Haumea 1000, Makemake 1050, Eris 1150; stars at 3500).
- `src/planets/OrbitalMechanics.js:8-22` — the Keplerian position solver consumes `distanceDisplay` (semi-major axis, display units), `orbitalPeriod`, `eccentricity`, `inclination` per body. A comet entry reuses this solver unchanged.
- `src/planets/PlanetFactory.js` — planets as MeshStandardMaterial spheres, texture fallback to flat color, orbit LineLoops, moons on pivot groups, focus-time LOD/texture-tier upgrades.
- `src/utils/performance.js:34,40,48,71` — `DEGRADE_STEPS = ['bloom','lod','pixelRatio']` (solar), `EARTH_DEGRADE_STEPS = ['aurora',...]` (Earth precedent for adding a domain step), `FrameBudgetDegrader` with constructor `steps` param and `setSteps()`.
- `src/utils/eclipseData.js:105,118` — `detectEclipsesInRange(prevDay, currDay)` half-open interval range-testing immune to frame step size, and `findNextEclipse`. THIS is the reference philosophy for event detection quality (frame-step-size immunity) that the alignment detector must honor in its own state-based form.
- `src/ui/PlanetList.js` — divider pattern ("Dwarf Planets" / "Stars") that the new "혜성" divider follows.
- SPEC-KIDS-001 defines `factsKo` / `sizeComparisonKo` / `emoji` fields and the TTS `speak()` channel (mute-aware) that this SPEC's facts and callouts use.

### 1.3 Real-Halley reference values (for the scaling decision)

Real Halley: eccentricity 0.967, semi-major axis 17.8 AU, period ~76 years, inclination 162.3° (retrograde), perihelion 0.586 AU (inside Venus's orbit), aphelion ~35 AU (beyond Neptune's 30.1 AU).

## 2. Assumptions

- **A-301**: `OrbitalMechanics.calculatePosition` behaves correctly for eccentricity 0.967 and inclination >90° (retrograde). Verified at run phase M1; if the solver's eccentric-anomaly iteration degrades at e≈0.97, the comet gets a bounded-iteration tweak inside the solver's existing contract (documented fallback: eccentricity 0.9 visual compromise — only if the solver cannot converge).
- **A-302**: SPEC-KIDS-001 is completed first (depends_on): facts fields exist and `speak()` is mute-aware.
- **A-303**: ~2-3k static-drift instances in one InstancedMesh (belt) + ~1-1.5k (Kuiper) are within frame budget on `full`-tier devices; `constrained`-tier and degrader interplay per REQ-EVT-204.
- **A-304**: Alignment windows (≥4 planets within 30° heliocentric longitude) persist for many simulation days — far longer than the largest per-frame time step at 500x — so state-based sampling with hysteresis cannot miss them (frame-step tolerance argument in §3.3).

## 3. Requirements (GEARS)

### 3.1 C — Halley's Comet (proposal item 7)

**Ubiquitous**

- **REQ-EVT-101**: The solar view shall include Halley's Comet (nameKo "핼리 혜성") as a selectable body on a Keplerian orbit with real eccentricity 0.967 and real retrograde inclination 162.3°, using DISPLAY-scaled geometry: semi-major axis 700 display units (⇒ perihelion ≈ 23, diving inside Mercury's 80 — qualitatively matching the real sub-Venus perihelion; aphelion ≈ 1377, beyond Eris's 1150 — matching the real beyond-Neptune aphelion) and a DISPLAY-scaled period of 7.6 simulation years (real 76 years ÷ 10) so a child sees perihelion passes at normal play speeds. The scaling decision (÷10 period, a=700) shall be documented in code comments and this SPEC.
- **REQ-EVT-102**: The comet shall render a particle/sprite tail that ALWAYS points anti-sunward (directly away from the sun's position) and grows in length/opacity as the comet approaches perihelion, shrinking toward aphelion.
- **REQ-EVT-103**: The comet shall appear in the PlanetList under a new "혜성" divider, be selectable/focusable like any body, and carry SPEC-KIDS-001-shaped kid facts (`factsKo`, `sizeComparisonKo`, `emoji` ☄️) spoken via the shared TTS channel on selection.
- **REQ-EVT-104**: The tail shall run on a fixed particle/vertex budget allocated once (no per-frame geometry allocation); its per-frame update shall be bounded (position/opacity writes only).

### 3.2 B — Asteroid belt + Kuiper belt (proposal item 9)

**Ubiquitous**

- **REQ-EVT-201**: The solar view shall render an asteroid belt as a single InstancedMesh rock field of 2,000-3,000 instances distributed in a torus band strictly between Mars (300) and Jupiter (450) display radii (band 320-430 with vertical/inclination jitter), with slow per-instance orbital drift.
- **REQ-EVT-202**: The solar view shall render a sparser Kuiper belt ring beyond Neptune (850): 1,000-1,500 instances in a 900-1,250 display-radius band with greater thickness and slower drift.
- **REQ-EVT-205**: Both belts shall have selectable info entries ("소행성대", "카이퍼 벨트") in the PlanetList with SPEC-KIDS-001-shaped kid facts + TTS; selecting one frames the belt region with the camera (list-driven selection — belts are not raycast-selectable per REQ-EVT-203).
- **REQ-EVT-206**: Belt instance generation (count, radial band, jitter, drift rates) shall be a deterministic seeded pure function, unit-testable for count and bounds without a renderer.

**Unwanted behavior**

- **REQ-EVT-203**: The interaction layer shall not include belt instances in raycast target sets (performance: thousands of instances must never enter the picking path).

**Capability gate / degradation**

- **REQ-EVT-204**: **Where** the frame-budget degrader is active in the solar view, a new first-position 'belts' shed step shall reduce belt instance counts (≥50% reduction or full hide) BEFORE bloom/lod/pixelRatio shed; **While** the quality tier is `constrained` (SPEC-MOBILE-001), belts shall start at the reduced instance count.

### 3.3 A — Planetary alignment event (proposal item 10)

**Ubiquitous**

- **REQ-EVT-301**: The event layer shall provide a pure detector function that, given the 8 planets' heliocentric longitudes (degrees), reports an alignment when ≥N planets (default 4) fall within a longitude window (default 30°); N and the window are named constants.
- **REQ-EVT-302**: The detector shall apply hysteresis: alignment ENTERS at window ≤30° and EXITS only when the tightest qualifying window exceeds 40°, so the banner cannot flicker at the boundary.
- **REQ-EVT-304**: Detection shall be evaluated each frame from `OrbitalMechanics` positions (state-based sampling). Frame-step tolerance shall be demonstrated by a sweep test: stepping synthetic longitudes across an alignment window in coarse increments (up to the largest 500x-speed frame step) never skips the enter/exit transitions — honoring the frame-step-immunity philosophy of `eclipseData.js` range-testing in state-predicate form.

**Event-driven**

- **REQ-EVT-303**: **When** an alignment ENTERS, the UI shall show a Korean celebration banner "행성들이 줄을 섰어요!" and emit one TTS callout through the shared SPEC-KIDS-001 channel (mute-respecting); the banner auto-dismisses and shall not re-trigger until after the alignment EXITS.

**State-driven**

- **REQ-EVT-305**: **While** `prefers-reduced-motion` is set, the banner shall present statically (no entrance animation, no particle flourish).

## 4. Solution Approach

- **Comet**: a planetData entry (type marker `comet`) + PlanetFactory handling: small nucleus sphere + tail (THREE.Points or stretched sprite; run-phase pick, budget-fixed per REQ-EVT-104). Tail orientation: normalize(cometPos − sunPos) each frame; length/opacity from `r/perihelion` ratio. Orbit LineLoop reuses existing orbit-path generation (high-e ellipse renders correctly from the same math).
- **Belts**: `[NEW] src/effects/Belts.js` — one InstancedMesh per belt (low-poly rock geometry, flat-color material), transforms from the seeded generator; drift = per-instance angular velocity applied to the pivot angle each frame (cheap matrix updates batched; or a whole-ring rotation with per-instance phase — run-phase micro-decision within the fixed-budget rule).
- **Alignment**: `[NEW] src/utils/alignment.js` pure detector (+ hysteresis state machine); a thin frame hook computes longitudes from existing body angles and feeds the detector; `[NEW]` banner element (DOM overlay, Korean-first per KIDS-001 strings module).
- PlanetList/registry: comet + belt entries join the same registry the sidebar/strip render (SPEC-MOBILE-001 REQ-MOB-305 makes the strip pick them up automatically).

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Frame rate | Belts + comet tail together ≤2ms/frame on a mid-tier desktop GPU at full instance counts; 60fps desktop / 30fps mobile targets preserved via REQ-EVT-204 shedding |
| Draw calls | Each belt = 1 draw call (InstancedMesh); tail = 1 draw call |
| Memory | Belt transforms allocated once; no per-frame allocation in belts, tail, or detector (zero-GC steady state) |
| Determinism | Seeded belt generation reproducible across sessions (stable visual + testable bounds) |
| Testability | Alignment detector, hysteresis, belt generator: pure vitest targets. Tail anti-sunward math: pure vector test |
| Accessibility | Banner is `aria-live="polite"`; reduced-motion per REQ-EVT-305 |

## 6. Exclusions (What NOT to Build)

### Out of Scope — Additional comets or comet catalog

- Only Halley. No comet catalog, no periodic-comet table, no user-added comets.

### Out of Scope — Physically accurate tail simulation

- No dust/ion dual-tail physics, no solar-wind particle simulation. One schematic anti-sunward tail with distance-scaled intensity.

### Out of Scope — Individually selectable belt rocks

- Belt instances are scenery (REQ-EVT-203). Only the belt-as-a-whole info entries are selectable.

### Out of Scope — Real asteroid ephemerides

- No named asteroids (Vesta, Pallas, ...) and no real orbital elements for belt instances; the belt is a statistically plausible decorative field. (Ceres already exists separately as a dwarf planet.)

### Out of Scope — Alignment prediction / "next alignment" search

- Detection is live-state only. A `findNextEclipse`-style fast-forward search for alignments is future work.

## 7. Traceability (REQ → AC)

| Requirement | Module | Acceptance |
|-------------|--------|------------|
| REQ-EVT-101..104 | C | AC-EVT-101..104 |
| REQ-EVT-201..206 | B | AC-EVT-201..206 |
| REQ-EVT-301..305 | A | AC-EVT-301..305 |

## 8. Proposal Item Traceability (Appendix)

| Proposal item # | Item summary | REQ IDs |
|-----------------|--------------|---------|
| 7 | Halley's Comet (high-e Keplerian orbit, display scaling documented, anti-sunward tail, "혜성" divider, kid facts + TTS) | REQ-EVT-101, 102, 103, 104 |
| 9 | Asteroid belt + Kuiper belt (InstancedMesh fields, raycast-excluded, degrader hook, info entries) | REQ-EVT-201, 202, 203, 204, 205, 206 |
| 10 | Planetary alignment event (pure detector, hysteresis, Korean banner + TTS, frame-step immunity) | REQ-EVT-301, 302, 303, 304, 305 |
