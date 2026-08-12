# Acceptance Criteria — SPEC-EVENTS-001

## 1. AC Matrix (1:1 with REQs)

| AC | REQ | Criterion (testable) | Verification |
|----|-----|----------------------|--------------|
| AC-EVT-101 | REQ-EVT-101 | Comet data entry: e=0.967, inclination 162.3, distanceDisplay 700, orbitalPeriod 7.6 sim-years; position from OrbitalMechanics traces an ellipse with min radius ≈23 (±5%) and max ≈1377 (±5%) over one period sweep; scaling documented in code comment + spec | vitest (orbit sweep numeric test) |
| AC-EVT-102 | REQ-EVT-102 | Tail direction test: for sampled orbit positions, tail axis ≈ normalize(cometPos − sunPos) (dot > 0.999); tail intensity strictly greater at r=q than at r=Q | vitest (vector math) |
| AC-EVT-103 | REQ-EVT-103 | PlanetList contains "혜성" divider + 핼리 혜성 entry; selection focuses the comet and triggers TTS narration via shared channel; comet facts pass KIDS-001 §8.1 checklist (☄️ emoji present) | vitest (jsdom) + checklist |
| AC-EVT-104 | REQ-EVT-104 | Tail buffer allocated once at init (fixed length); per-frame path performs zero `new` allocations of geometry/arrays (code review + allocation assertion in test where feasible) | vitest + code review |
| AC-EVT-201 | REQ-EVT-201 | Generator output: instance count in [2000,3000]; all radii in [320,430]; jitter bounds respected; drift rates non-zero. **Measured: 2600 instances, radii 320.02–429.95, vertical jitter ±7.98** | vitest (pure generator) |
| AC-EVT-202 | REQ-EVT-202 | Kuiper generator: count in [1000,1500]; radii in [900,1250]; density (count/band-area) lower than asteroid belt's. **Measured: 1200 instances, radii 901.35–1249.60, vertical jitter ±44.90; density 5.0760e-4 against the asteroid belt's 1.0032e-2 — 19.8× sparser, computed in-test from band area rather than hardcoded** | vitest |
| AC-EVT-203 | REQ-EVT-203 | Raycast target set does NOT contain belt meshes (unit assertion on the target list construction); tapping through a belt region selects nothing/underlying body only | vitest + manual |
| AC-EVT-204 | REQ-EVT-204 | Degrader solar steps = ['belts','bloom','lod','pixelRatio']; feeding sustained over-budget frames sheds belts FIRST (instanceCount reduced ≥50% or hidden); constrained tier boots at reduced counts. **Measured: `InstanceMesh.count` drops to 40% of the full field — a 60% reduction, clearing the ≥50% floor — with buffers pre-sized at full count, so no geometry is rebuilt on shed or restore** | vitest (performance.test.js extension) |
| AC-EVT-205 | REQ-EVT-205 | "소행성대" / "카이퍼 벨트" list entries exist, selectable; selection frames belt radius band (camera target distance within band) + speaks facts | vitest (jsdom + camera math) + manual |
| AC-EVT-206 | REQ-EVT-206 | Same seed → identical transforms (deep-equal across two runs); different seed → different layout | vitest |
| AC-EVT-301 | REQ-EVT-301 | Fixtures: 4 planets within 30° → aligned (members correct); 3 within 30° → not aligned; N/window are exported named constants | vitest |
| AC-EVT-302 | REQ-EVT-302 | Sequence entering at 29° stays aligned through 39° and exits at 41°; oscillation 29↔31° produces exactly one enter (no flicker) | vitest (state machine) |
| AC-EVT-303 | REQ-EVT-303 | On enter: banner "행성들이 줄을 섰어요!" rendered + exactly one `speak()` call; no re-trigger before exit; auto-dismiss after its display window | vitest (jsdom + TTS spy) |
| AC-EVT-304 | REQ-EVT-304 | Sweep test: stepping synthetic longitudes across an alignment window at coarse increments (up to max 500x frame step equivalent) always observes the enter and exit transitions | vitest |
| AC-EVT-305 | REQ-EVT-305 | With `prefers-reduced-motion`, banner renders without entrance animation class/particles | vitest (jsdom matchMedia stub) |
| AC-EVT-401 | REQ-EVT-401 | `PlanetStrip` renders exactly `[...Object.keys(PLANET_DATA), ...Object.keys(BELT_DATA), ...Object.keys(STAR_DATA)]` in that order; the `halley`, `asteroidBelt` and `kuiperBelt` buttons each exist and carry their registry `emoji` token and `nameKo` label | vitest (jsdom) — `PlanetStrip.test.js`, "carries the comet and both belts, the three bodies with no other phone route" |

## 2. Given-When-Then Scenarios

### Scenario 1 — Watching Halley dive
- **Given** the solar view at 50x speed with the comet near aphelion (beyond Pluto's ring)
- **When** the child waits (or speeds up) through a perihelion approach
- **Then** the comet visibly accelerates inward past the inner planets, its tail growing and always streaming away from the sun, then recedes tail-first — with steady frame rate throughout.

### Scenario 2 — Belt is scenery, not a trap
- **Given** the asteroid belt rendered between Mars and Jupiter
- **When** the child drags across it and taps on a rock-dense region
- **Then** the camera orbits normally, the tap selects nothing (or a body behind it), and only the "소행성대" list/strip entry selects the belt — which frames the ring and speaks its facts.

### Scenario 3 — Alignment celebration
- **Given** simulation time approaching a computed ≥4-planet 30° alignment at 500x
- **When** the alignment condition becomes true between two frames
- **Then** the banner "행성들이 줄을 섰어요!" appears exactly once with one TTS callout, persists while the alignment holds, and can re-trigger only after the formation disperses past 40°.

### Scenario 4 — Weak device protection
- **Given** a `constrained`-tier device (SPEC-MOBILE-001) in the solar view
- **When** the app boots and frames run over budget anyway
- **Then** belts boot at reduced count, and the degrader sheds belts before touching bloom, LOD, or resolution.

## 3. Edge Cases

- Longitude wrap-around: cluster spanning 350°→20° detected as 30°-window alignment (explicit fixture).
- Exactly N=4 at exactly 30.0°: enters (≤ comparison pinned by test).
- Comet selected while at perihelion at 500x (fast angular motion): focus-follow remains stable (existing focus logic; manual check).
- Degrader shed while a belt entry is selected/framed: camera target unaffected; instanceCount change mid-view has no crash.
- `matchMedia` unavailable (old jsdom): reduced-motion check defaults to animations-on without throwing.
- Two alignments overlapping (5 planets, two 4-subsets): single aligned state (detector reports the tightest window; no double banner).

## 4. Quality Gate Criteria

- All new pure modules ≥ the project's standard coverage expectations; full vitest suite green; `npm run build` succeeds.
- `performance.test.js` extended and green (new step order characterized).
- No regression in existing suites; raycast exclusion asserted.
- Facts content for comet + belts passes the KIDS-001 §8.1 review checklist.
- TRUST 5: Tested, Readable (named constants: N, ENTER/EXIT windows, band radii, budgets), Unified (aurora/eclipse module patterns followed), Secured (no external input), Trackable (conventional commits per milestone referencing SPEC-EVENTS-001).

## 5. Definition of Done

**SATISFIED — 2026-08-12, run phase M1-M6 (`473497f`..`eb83fb6`).**

- [x] All AC-EVT-1xx/2xx/3xx/4xx PASS. Unit: 469 tests across 34 files, all green, up from a 341/29 baseline with zero regressions; each of the original 15 AC-EVT criteria is cited by ID in at least one test, and AC-EVT-401 is covered by the named `PlanetStrip.test.js` case above. Visual and manual items were checked in a **real headed browser** against the dev server — 469 unit tests never put a WebGL context on screen, and headless Chromium cannot create one on this machine:
  - Console clean on load: no THREE errors, no WebGL context failure, no warnings.
  - Tail behavior: the comet tail renders and points away from the sun.
  - Belt density: the asteroid belt reads as a distinct band between Mars and Jupiter; the Kuiper belt is visibly sparser and further out.
  - `PlanetList` dividers render in order — 왜소행성 / 혜성 / 띠 / 별 — with 핼리 혜성, 소행성대 and 카이퍼 벨트 present.
  - Selecting 소행성대 frames the belt band, opens the info panel with its Korean facts and size comparison, and highlights the row; console stayed clean through the interaction.
- [x] depends_on gate satisfied (SPEC-KIDS-001 `status: completed`) before run-phase entry; SPEC-MOBILE-001 sync commits `8414e77` and `3b4f522` present in history per the §G run-order gate.
- [x] Scaling decision documented in both code comments (`planetData.js`, the `halley` entry preamble) and spec (REQ-EVT-101).
- [x] No open clarification markers were declared.
- [x] `npm run build` succeeds; PWA precache 42 entries.

Banner timing (§2 Scenario 3) rests on the jsdom AC-EVT-303 case — one `speak()` per enter, 6000 ms auto-dismiss, no re-trigger before exit — rather than a headed observation, since reaching a live ≥4-planet alignment in-browser is not reliably reproducible on demand.
