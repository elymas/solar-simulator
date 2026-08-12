# Progress — SPEC-EVENTS-001

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-12T01:21:04Z
- plan_status: audit-ready

## §E.2 Run-phase Evidence

- run_started_at: 2026-08-12T08:07:00Z
- development_mode: tdd (RED-GREEN-REFACTOR, per `.moai/config/sections/quality.yaml`)
- harness_level: standard
- execution_mode: sub-agent, three sequential batches (M1+M2, M3+M4, M5+M6)
- branch: `feat/spec-events-001` — committed only, not pushed and not merged

### Pre-flight

`node_modules/` was absent in this worktree; `npm ci` was run before anything else. Baseline suite
before any SPEC-EVENTS-001 work: 29 files / 341 tests, all green.

depends_on gate: SPEC-KIDS-001 `status: completed`. Run-order gate (§G): SPEC-MOBILE-001 sync
commits `8414e77` and `3b4f522` present in history.

### Plan corrections applied at run entry

Three brownfield citations in `plan.md` were checked against the code before decomposition. See
`tasks.md` for the full statement; summarized here because two of them changed the work.

1. **A-301 resolved, not deferred.** `OrbitalMechanics._solveKepler` converges at e=0.967 with its
   existing 10 Newton-Raphson iterations. A 2000-sample full-period sweep at a=700, T=2775.9 days
   holds residual `|E - e·sin E - M| < 1e-6` at every sample and produces min r = 23.10,
   max r = 1376.90 — exactly the q/Q envelope REQ-EVT-101 predicts. No solver change was made and
   the documented eccentricity-0.9 visual fallback was never reached. M1 kept only the
   characterization test.
2. **Frame-hook target corrected.** `plan.md` §D placed the alignment hook in `src/main.js`, which is
   a 33-line bootstrap. The render loop runs `ViewManager` → `SolarSystemView.update(delta)`, so the
   hook and the belt mount went there. `SceneManager` received only the degrader shed/restore cases.
3. **No unified registry exists.** `plan.md` §A.5/§G assumed SPEC-MOBILE-001 REQ-MOB-305 made the
   phone strip registry-driven. It is not: `PlanetStrip.js:123` hardcodes its source list. The comet
   arrived free because it lives in `PLANET_DATA`; the belts needed an explicit edit. User approved
   extending the strip so all three new bodies stay reachable on phones.

### Milestone evidence

| M | Commit | AC | Evidence |
|---|--------|-----|----------|
| M1 | `473497f` | AC-EVT-101 | Halley in `PLANET_DATA` with `category: 'comet'` (dwarf-precedent), so `PlanetFactory`, `PlanetStrip` and `InteractionManager` mount it with zero new branches. Orbit sweep pins min r 23.10 ±5%, max r 1376.90 ±5%, plus `min < Mercury(80)` and `max > Eris(1150)`. Scaling documented in a code comment at the entry. `orbitSegments: 512` added as a data field after measuring polyline deviation at the aphelion apex: 128 segments cut 10.00 units flat, 512 cuts 0.77. Default unchanged for the other ~40 orbit lines. +11 tests |
| M2 | `ae7b6ec` | AC-EVT-102, 104 | `src/effects/CometTail.js` — `THREE.Points`, ~400-point buffer allocated once, additive, `depthWrite` off. Pure `tailAxis`/`tailIntensity` tested renderer-free: anti-sunward dot > 0.999, intensity strictly greater at r=q than r=Q. Zero-allocation update verified three ways: buffer object identity across 50 updates, `attribute.version` increments, and a source-text assertion that `update()` contains no `new`. Tail-not-trail pinned by replaying a position and getting a byte-identical buffer. +19 tests |
| M3 | `551c877` | AC-EVT-201, 202, 203, 206 | Seeded mulberry32 generator, no dependency added. Asteroid 2600 instances, radii 320.02–429.95, ±7.98 vertical; Kuiper 1200, radii 901.35–1249.60, ±44.90. Density 1.0032e-2 vs 5.0760e-4 — Kuiper 19.8× sparser, computed in-test from band area rather than hardcoded. Determinism deep-equal same-seed / differs cross-seed. Round-robin quarter-cadence drift, positions composed from absolute sim time so staggered quarters cannot diverge. Raycast exclusion is **structural, no filtering code written**: `_getClickableMeshes()` iterates `planetFactory.planets` and belts never enter it; the load-bearing test asserts target-set length equals registry size, so a future scene-graph raycast fails loudly. +36 tests |
| M4 | `1aa9cd5` | AC-EVT-204 | `DEGRADE_STEPS` amended in place to `['belts','bloom','lod','pixelRatio']` rather than adding a parallel constant — it is already the solar ladder in fact, being both the `FrameBudgetDegrader` default and the array `ViewManager.js:229` restores on Earth-view exit. `EARTH_DEGRADE_STEPS` untouched. Shed lowers `InstanceMesh.count` to 40% (60% cut, exceeds the ≥50% floor) with buffers pre-sized at full count; no geometry rebuild. `constrained` tier boots reduced. Shed while a belt is framed moves nothing and does not crash |
| M5 | `de320f7`, `273585e` | AC-EVT-301..305 | `src/utils/alignment.js` — sliding window over sorted longitudes with +360 wrap duplication, `ALIGNMENT_MIN_PLANETS`/`ENTER_DEG`/`EXIT_DEG` exported and proven to be the defaults, `ALIGNMENT_PLANET_KEYS` asserted to hold exactly 8 categoryless `PLANET_DATA` keys (dwarfs, comet and sun excluded deliberately, since `PLANET_DATA` now contains all three). Hysteresis: 29 enters, 35/39 hold, 41 exits; 20 alternations of 29↔31 yield a single enter. Banner is `aria-live="polite"`, one `speak()` per enter with the banner string itself, auto-dismiss at 6000 ms, reduced-motion static, `matchMedia`-absent safe. REFACTOR hoisted an inline sort comparator out of the frame path — it was allocating a closure per frame against the zero-GC NFR. +25 tests |
| M6 | `eb83fb6` | AC-EVT-103, 205 | New `BELT_DATA` export, deliberately neither `PLANET_DATA` nor `STAR_DATA`: both of those are mesh registries whose keys `PlanetFactory` turns into meshes that land in `planetFactory.planets`, the exact collection `InteractionManager` raycasts. A belt there would grow a phantom sphere and re-open the picking path REQ-EVT-203 closes. Band radii stay in `Belts.js`; `_selectBelt` reads them off the live `Belt.config` rather than duplicating. `InfoPanel` gained a `category === 'belt'` branch (six lines, mirroring dwarf) — without it a belt hit the generic branch and rendered `지름 NaN km`. Two dividers: 혜성 and 띠, both via `STR`. Facts for all three in KIDS-001 shape, ☄️ pinned, `planetData.facts.test.js` key list extended so they are actually covered rather than silently skipped |
| — | `6ded077` | — | Untracked `.moai/state/`, `.moai/harness/` and `.moai/lessons-inbox.jsonl`, which `551c877` swept in alongside its source changes. They hold a session UUID, PID, hostname and absolute cwd paths. `.gitignore` extended |

### AC coverage

All 15 AC-EVT criteria have at least one test citing them by ID. Edge cases from `acceptance.md` §3
carry explicit fixtures: 350°→20° wrap, exactly 30.0° enters while 30.5° does not, five planets with
two qualifying 4-subsets yielding one aligned state and one banner, `matchMedia` absent, and a
degrader shed on a framed belt.

### Manual and visual verification (`acceptance.md` §5 DoD)

469 unit tests never put a WebGL context on screen, so the scene was checked in a real headed browser
against the dev server (headed mode is required here — headless Chromium cannot create a WebGL
context on this machine).

- Console clean on load: no THREE errors, no WebGL context failure, no warnings.
- Asteroid belt renders as a distinct band between Mars and Jupiter; Kuiper belt visibly sparser and
  further out; comet tail points away from the sun.
- `PlanetList` dividers render in order: 왜소행성 / 혜성 / 띠 / 별, with 핼리 혜성, 소행성대 and
  카이퍼 벨트 present.
- Clicking 소행성대 frames the belt band, opens the info panel with its Korean facts and size
  comparison, and highlights the row. Console stayed clean through the interaction.

### Known limitation recorded against A-304

Assumption A-304 claims state-based sampling with hysteresis "cannot miss" an alignment window. The
sweep test proves the narrower, true statement: **a window longer than one frame step is never
skipped, at any step size or phase**. It is not "no window is ever missed". A formation involving
Mercury (4.09°/day) holds roughly 17 simulation days, which is shorter than a single 66.8-day frame
at the 500x ceiling. That is a property of state sampling rather than a defect in this detector, and
`spec.md` §6 already places a `findNextEclipse`-style predictive search out of scope. Worth
correcting in the SPEC text at sync rather than leaving A-304 overstated.

The 500x maximum frame step was derived, not guessed: `TimeControls.js` exports the logarithmic
slider ceiling (`10^2.7 ≈ 501.19` sim-days per real second) so a slider change invalidates the proof
loudly, and the worst frame is taken as 4× the mobile 30fps budget from `SceneManager.js:196`,
giving 501.19 × (4/30) ≈ 66.82 sim-days per frame.

### Drift guard

- Planned new files: 9. Actual new files: 9. Unplanned new files: 0 → **new-file drift 0%**.
- Planned modified files: 10, all touched as planned.
- Unplanned modified files: `src/ui/InfoPanel.js` (belt render branch, required by AC-EVT-205),
  `src/ui/TimeControls.js` (exports the speed ceiling so AC-EVT-304 derives it instead of copying
  `2.7`; rendered markup byte-identical), `.gitignore` (state-file cleanup), plus seven existing test
  files updated by ordinary TDD.
- Total changeset excluding `.moai`: 29 files, +2643 / −53.
- Drift is informational only; no re-planning gate triggered.

### Suite and build

| Stage | Test files | Tests | Build |
|-------|-----------|-------|-------|
| Baseline | 29 | 341 | — |
| After M1+M2 | 31 | 371 | pass |
| After M3+M4 | 32 | 425 | pass |
| After M5+M6 | 34 | 469 | pass |

Zero regressions. All 341 pre-existing tests remained green throughout. `npm run build` succeeds,
PWA precache 42 entries.

## §E.3 Run-phase Audit-Ready Signal

- run_complete_at: 2026-08-12T09:05:00Z
- run_status: audit-ready
- milestones_complete: M1, M2, M3, M4, M5, M6
- ac_covered: 15 / 15
- tests: 469 passed / 469
- build: pass
- commits: 473497f, ae7b6ec, 551c877, 1aa9cd5, de320f7, eb83fb6, 273585e, 6ded077
- pushed: no
- merged: no
- open_items_for_sync: correct `plan.md` §D file list (main.js → SolarSystemView.js), correct
  `plan.md` §A.5/§G registry assumption, and soften `spec.md` assumption A-304 to the guarantee the
  sweep test actually proves

## §E.4 Sync-phase Audit-Ready Signal

- sync_complete_at: 2026-08-12T09:10:00Z
- sync_status: audit-ready
- lifecycle: spec-anchored (Level 2 — SPEC updated to as-built, originals preserved and annotated in place)
- documents_updated: `spec.md`, `plan.md`, `acceptance.md`, `progress.md`, `CHANGELOG.md`, `README.md`
- spec_status: draft → completed; spec version 0.1.0 → 0.2.0
- open_items_from_§E.3: all three closed — `plan.md` §D file list corrected (`main.js` → `SolarSystemView.js`),
  `plan.md` §A.5/§G registry assumption corrected, `spec.md` A-304 narrowed to the guarantee the sweep
  test proves
- requirements_added: REQ-EVT-401 (`spec.md` §3.4) — the phone-strip entries, a run-phase scope
  addition made at the user's explicit approval and previously covered by no REQ
- acceptance_added: AC-EVT-401
- ac_covered: 16 / 16. The original 15 each cite their ID in at least one test; AC-EVT-401 is covered by
  the named `PlanetStrip.test.js` case "carries the comet and both belts, the three bodies with no other
  phone route", which predates the ID. That test did not carry the tag when the docs commit landed,
  because source was deliberately untouched during sync; the tag was added immediately afterward in
  `9857312` (comment only, no assertion changed), so all 16 criteria are now citable by grep and this
  sync leaves no follow-up
- tests: 469 passed / 469, 34 files. Baseline before this SPEC 341 / 29 → 128 tests added, zero regressions
- coverage: 89.08% statements, 92.07% lines against an 85% target. New modules: `alignment.js` 100%,
  `EventBanner.js` 97.14%, `Belts.js` 96.15%, `CometTail.js` 90.90%
- build: pass, PWA precache 42 entries
- security_scan: skipped by its activation gate — no authentication, database, API-endpoint, user-input or
  secret-bearing file is in the changeset, which is entirely 3D rendering, UI and pure math
- source_code_changed: no (documentation only)
- commits: 1 docs commit on `feat/spec-events-001`
- pushed: no
- merged: no
- pr: none
