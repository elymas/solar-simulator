# Implementation Plan — SPEC-EVENTS-001

Sections ordered by decision-reversibility: most-likely-to-change decisions first.

## A. Key Decisions (highest change-likelihood first)

### A.1 Comet display scaling (the honesty/visibility trade — review first)

Chosen: **real shape, compressed size and time** — keep real eccentricity (0.967) and real retrograde inclination (162.3°); scale semi-major axis to a=700 display units and period to 7.6 sim-years (÷10).

- Geometry consequence: perihelion 700×(1−0.967) ≈ 23 units (inside Mercury 80 — real Halley dives inside Venus, so "deep inner-system dive" is qualitatively honest); aphelion ≈ 1377 (beyond Eris 1150 — real Halley exceeds Neptune; honest).
- Time consequence: at 500x max speed, a 7.6-year orbit completes in minutes of wall time; at ~50x a perihelion approach is watchable. Real 76 years would be invisible at kid-typical speeds.
- The nucleus renders at a visible (non-physical) display radius like all bodies (the whole app is symbolic scale — SPEC-SIM-001 Fact C precedent).
- Rejected: real a-proportional placement (17.8 AU → interpolated ≈ display 780 — nearly identical to 700; kept round 700 for the documented q≈23/Q≈1377 envelope), and reduced "visual" eccentricity (dishonest orbit shape — the stretched ellipse IS the lesson).

### A.2 Alignment detector semantics (event quality — likely to be tuned)

Detector input: array of 8 heliocentric longitudes. Algorithm: sort longitudes, find the tightest window covering ≥N planets over the circular wrap (classic sliding window on sorted angles + 360° wrap duplication), return `{ aligned, count, windowDeg, members }`. Hysteresis lives in a tiny state machine wrapping the pure predicate: enter at ≤30° window, exit at >40°. N=4, ENTER=30, EXIT=40 as named constants.

- Why window-based (not pairwise spread): matches the intuitive "planets in a row from the sun" and is O(n log n) trivial at n=8.
- Members exclude dwarfs/comet/moons: the 8 planets only (REQ-EVT-301); including 5 dwarfs would make ≥4-in-30° too frequent to feel special.
- TTS callout text (run-phase final): banner text "행성들이 줄을 섰어요!" is also the spoken line — one string, both channels.

### A.3 Belt structure (perf envelope)

One `InstancedMesh` per belt; low-poly icosahedron rock (≤80 tris), flat-color `MeshStandardMaterial` (matches app's lighting model) with slight per-instance scale/rotation variety baked into matrices. Drift approach: per-instance orbital angle advanced on a coarse cadence — update 1/4 of instances per frame round-robin (full field refresh every 4 frames; imperceptible at these angular speeds, quarters the matrix-upload cost). Seeded PRNG (mulberry32-style tiny inline) for deterministic layout.

- Degrade hook: 'belts' step at index 0 of solar steps → `['belts','bloom','lod','pixelRatio']`. Shed action: swap both belts to their reduced count (pre-built low-count instance ranges via `instanceCount` property — free to toggle) or hide entirely at repeat shed. Restore path mirrors.
- `constrained` tier (SPEC-MOBILE-001): boot directly at reduced `instanceCount`.

### A.4 Comet tail technique

`THREE.Points` with a fixed buffer (e.g., 400 points) laid along the anti-sunward axis with lateral falloff; per-frame: write head position, axis direction, and an intensity uniform/attribute from perihelion proximity (`q/r` clamped). Additive blending, depthWrite off (aurora precedent from EARTH-002). Rejected: trail-of-past-positions ribbon (a comet tail is NOT the orbit path — it points anti-sunward; a position-history ribbon would teach the wrong thing).

### A.5 Registry integration

Comet lives in planetData (new `COMET_DATA` array or a `type:'comet'` entry — run-phase pick when reading PlanetList's registry consumption; the "혜성" divider follows the existing "Dwarf Planets"/"Stars" divider pattern). Belt info entries are registry entries WITHOUT meshes-for-raycast (list/strip selectable only; camera frames radius band on select).

## B. Trade-off Notes

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Comet period | 7.6 sim-years (÷10) | Real 76y + "find next perihelion" jump control | Fast-forward control adds UI + search code; a ÷10 period makes the orbit self-evidently alive at normal speeds. Honesty preserved by documenting the scaling (comets = display-scaled like distances) |
| Comet math | Reuse OrbitalMechanics | Bespoke comet propagator | One solver for all bodies; e=0.967 is a solver stress test worth doing once (A-301 verification at M1) |
| Belt drift | Round-robin quarter updates | Per-frame all-instance updates / GPU shader drift | Shader drift is cleaner but adds a custom material divergence from house style; quarter-cadence CPU updates are trivial and profiled-cheap at 3k instances |
| Alignment trigger | State predicate + hysteresis | (prevDay, currDay] event-table range-test like eclipses | Alignments are not catalogued instants; they are computed states lasting sim-weeks. Hysteresis + sweep-test gives the same "never skipped, never flickers" guarantee the eclipse table achieves for instants |
| Belt selectability | List-entry only | Raycast instances with instanceId picking | instanceId picking invites 3k-target raycasts and a fiddly UX for zero kid value; the belt as a concept is the selectable thing |

## C. Milestones (phase ordering; priority labels)

| M | Scope | Priority |
|---|-------|----------|
| M1 | Solver verification for e=0.967 / i=162.3° (A-301) + comet data entry + orbit render; document scaling in code comments | High |
| M2 | Comet tail (fixed-budget points, anti-sunward + perihelion growth) + tail math unit tests | High |
| M3 | Belt generator (seeded, pure, tested) + InstancedMesh render + raycast exclusion + drift | High |
| M4 | Degrader 'belts' step + constrained-tier boot counts + performance.test.js extension for the new step order | Medium |
| M5 | Alignment detector + hysteresis + sweep tests; banner UI + TTS callout wiring | High |
| M6 | Registry/UI integration: "혜성" divider, belt info entries, kid facts for comet/belts (KIDS-001 shape + checklist), regression pass + build | Medium |

## D. File-Touch List

**New**
- `src/effects/Belts.js` (+ `src/effects/Belts.test.js` — generator bounds/count/determinism)
- `src/effects/CometTail.js` (+ tail-math tests; may fold into PlanetFactory if ≤~60 lines — run-phase call)
- `src/utils/alignment.js` (+ `src/utils/alignment.test.js`)
- `src/ui/EventBanner.js` (+ test) — reusable for SPEC-EARTH-003 HUD notices if trivially shareable (soft goal, not a contract)

**Modified**
- `src/planets/planetData.js` (comet entry + belt info entries + their KIDS-shape facts)
- `src/planets/PlanetFactory.js` (comet nucleus/tail mounting, orbit line for high-e)
- `src/utils/performance.js` (solar steps gain 'belts' first)
- `src/scene/SceneManager.js` / `src/views/...` (belt mount + shed callback wiring, mirroring the aurora-shed pattern at `SceneManager.js:190-192`)
- `src/ui/PlanetList.js` ("혜성" divider + belt entries)
- `src/controls/InteractionManager.js` (raycast target set confirmation — belts excluded)
- `src/main.js` (frame hook: longitudes → detector → banner/TTS)

## E. Test Strategy (TDD)

- **Pure targets**: alignment detector (fixtures: exactly-4-in-30°, 3-in-30° negative, wrap-around 350°..20° cluster, 8-planet grand alignment), hysteresis (enter→stay→exit sequencing, no flicker at 30/40 boundary jitter), sweep test (coarse stepping never skips transitions), belt generator (count, radial bounds 320-430 / 900-1250, determinism same-seed-same-output), tail vector math (anti-sunward unit vector, growth monotonic as r→q).
- **Characterization**: performance.test.js extended for `['belts','bloom','lod','pixelRatio']` order.
- **Manual/device**: tail visual quality, belt density feel, banner timing, fps with everything active.

## F. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Kepler solver non-convergence at e=0.967 | M1 verifies first (High priority, before dependent work); bounded-iteration fix inside solver contract; documented visual-compromise fallback only if unfixable |
| Belt matrix updates janky on weak devices | Quarter-cadence updates + 'belts' first-shed + constrained-tier reduced boot counts |
| Alignment too rare (kid never sees it) at N=4/30° with display-scaled periods | Display periods differ from real ones, so alignment frequency is already display-domain; constants are named and tunable; acceptance only pins detector correctness, not astronomical frequency |
| Alignment TTS fires during unrelated narration | Shared TTS channel's cancel-before-speak (KIDS-001 REQ-KIDS-203) arbitrates; callout uses `speak()` which respects mute |
| "혜성" divider ordering confuses registry-driven strip | Strip reads registry order (MOBILE-001 REQ-MOB-305); comet appended after stars or before dwarfs — final order chosen at M6 with the list visible |

## G. Cross-SPEC Notes

- `depends_on: SPEC-KIDS-001` (facts shape + TTS). If run before KIDS lands, M6 blocks — the depends_on gate handles this.
- SPEC-MOBILE-001 strip auto-includes comet/belt entries (registry-driven). Run-order: implement after SPEC-MOBILE-001; REQ-EVT-204 consumes its constrained-tier definition and extends the degrader ladder it characterizes.
- SPEC-PLAY-001 celebration FX may later decorate the alignment banner; the banner exposes no API contract now (YAGNI).

No open clarification markers — all decisions resolved with stated defaults.
