# Implementation Plan — SPEC-MOBILE-001

Sections ordered by decision-reversibility: most-likely-to-change decisions first.

## A. Key Decisions (highest change-likelihood first)

### A.1 Touch guard semantics (user-facing behavior — review first)

Tap = `touchstart`→`touchend` with movement ≤ `TOUCH_TAP_MAX_DRAG_PX` (named constant, default **8px**; mouse path keeps its existing 5px). Chosen over duplicating 5px exactly: finger contact jitters more than a mouse; 8px stays far below any intentional orbit drag. Cancel cases: multi-touch at any point during the gesture disqualifies the tap; `touchcancel` clears state. Empty-space qualifying tap deselects (mouse parity — the current touch path never deselects, which strands kids in focus mode).

### A.2 Quality-tier decision function (policy surface — likely to be tuned)

Pure function, single call site:

- inputs: `{ devicePixelRatio, hardwareConcurrency, deviceMemory }` (all read once at boot)
- output tier: `full` → `pixelRatio: min(dpr, 2)`, full bloom, no texture cap, LOD upgrades on; `constrained` → pixelRatio 1, texture cap, LOD upgrades off (bloom kept at reduced 0.4/0.15 as today)
- rule: `constrained` iff `hardwareConcurrency ≤ 4 && deviceMemory !== undefined && deviceMemory ≤ 4`; otherwise `full`.

Consequences to confirm in review: a 4-core desktop Safari (no `deviceMemory`) now boots `full` and relies on the degrader — accepted per the mission's "degrader as safety net" framing. UA-mobile detection is retained ONLY for the degrader's frame-budget target (30fps mobile / 60fps desktop) and the legacy fps monitor — behavior of those is unchanged.

### A.3 Icon strip composition (kid-facing UX)

Strip = horizontal scroll row above TimeControls: item = emoji (SPEC-KIDS-001 `emoji` field when the body has one) or a colored dot fallback + `nameKo` beneath in small type; ≥48px square target. Item set: same top-level registry the sidebar renders (sun, planets, dwarfs, stars; comet joins automatically when EVENTS-001 adds it to the registry). Selected item gets a highlight ring and `scrollIntoView({ inline: 'center' })`. No dependency on SPEC-KIDS-001: `emoji` is read optionally; dots suffice if KIDS lands later (soft coupling, no `depends_on`).

### A.4 Strip ↔ selection sync seam

The strip calls the SAME selection callback the sidebar uses (whatever `main.js` currently wires into PlanetList) and subscribes to the same "selected body changed" notification path used to highlight the sidebar. No new event bus — reuse the existing callback plumbing; the seam is confirmed at run phase when reading `main.js` wiring.

### A.5 Target-size CSS strategy (mechanical)

Raise real padded heights (not invisible hit-slop): list items to ≥48px, caret to a 32px flex cell, buttons to 44px boxes. Mobile media-query values in `index.html` updated in the same sweep. TimeControls 40×40 → 44×44.

## B. Trade-off Notes

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Touch select timing | touchend + guard | pointer events unification (pointerdown/up shared with mouse) | Pointer-event refactor touches the working mouse path; scope discipline says fix touch alongside, not rewrite both. Unification is a clean future refactor once covered by these new tests |
| Touch threshold | 8px constant | Reuse 5px exactly / time-based tap detection | 5px is jittery for small fingers; time-based taps reject slow deliberate kid taps. Distance-only mirrors the proven mouse pattern |
| Static-cap predicate | hwc≤4 AND deviceMemory≤4 (both observed) | hwc≤4 alone when deviceMemory missing | hwc-alone re-blurs 4-core desktops/tablets — exactly the defect being removed. The degrader catches genuinely weak no-signal devices dynamically |
| DPR ceiling | min(dpr, 2) | Uncapped dpr (3 on iPhone Pro) | dpr 3 renders 2.25× the pixels of dpr 2 for marginal perceptual gain at arm's length; 2 is the industry sweet spot; degrader can still shed below 2 |
| Strip tech | Plain DOM buttons + overflow-x | Canvas-rendered strip / virtualized list | ≤20 items; DOM is trivially accessible, testable, and cheap |
| Strip placement | Above TimeControls (both bottom-stacked) | Floating side rail | Thumb reach on a phone held by a child; bottom stack matches existing TimeControls anchoring |

## C. Milestones (phase ordering; priority labels)

| M | Scope | Priority |
|---|-------|----------|
| M1 | **Reproduction test FIRST** (RED): synthesized touch sequence "touchstart on body → move 30px → touchend" currently selects on touchstart — assert NO selection should occur; watch it fail against current code | High |
| M2 | Touch fix (GREEN): guard + touchend selection + empty-tap deselect + multi-touch/touchcancel handling; mouse-path regression tests | High |
| M3 | `decideQualityTier` pure function + tests; rewire `SceneManager._detectPerformance` to consume it; verify `performance.test.js` untouched-green | High |
| M4 | Target-size sweep (list items, caret, toggle, TimeControls buttons, KIDS-001 sound buttons if landed) | Medium |
| M5 | PlanetStrip component: render, scroll, selection sync both directions, ≤768px gating | Medium |
| M6 | Regression pass: full suite, build, device smoke (DPR check via `renderer.getPixelRatio()`, drag-vs-tap feel, strip scroll) | High |

## D. File-Touch List

**New**
- `src/ui/PlanetStrip.js` (+ `src/ui/PlanetStrip.test.js`)
- `src/controls/InteractionManager.test.js` (reproduction + guard suite)
- `src/utils/quality.js` (+ `src/utils/quality.test.js`) — final home may be `performance.js` if smaller (run-phase call)

**Modified**
- `src/controls/InteractionManager.js` (touch path rewrite: `_onTouchStart` slimmed to position capture, new `_onTouchEnd`/`_onTouchCancel`, listener registration/dispose)
- `src/scene/SceneManager.js` (`_detectPerformance` consumes tier function; UA kept only for budget targets)
- `src/ui/PlanetList.js` (item/caret/toggle sizes)
- `src/ui/TimeControls.js` (44px buttons)
- `index.html` (mobile media-query sizes; strip base CSS)
- `src/main.js` (strip instantiation + selection wiring)

## E. Test Strategy (TDD — reproduction-first per CLAUDE.md §7 Rule 4)

- **M1 reproduction (the defect)**: instantiate `InteractionManager` with a stub renderer (`domElement` = plain div) and a stubbed `_raycastPlanet` seam returning `'mars'`; dispatch touchstart(100,100) → touchmove(130,100) → touchend. Current code selects at touchstart → test asserting "no `onSelect` call" FAILS. This failing test is committed (or demonstrated in the failing state) before the fix.
- **Guard suite**: tap-within-threshold selects on touchend; drag>8px never selects; empty tap deselects; two-finger never selects; touchcancel resets; mouse click path unchanged (5px guard still enforced, characterization).
- **Tier function**: table-driven cases — iPhone-class {dpr 3, hwc 6, mem undefined} → full/pixelRatio 2; weak Android {dpr 2, hwc 4, mem 2} → constrained; 4-core desktop Safari {dpr 2, hwc 4, mem undefined} → full; dpr 1.5 → 1.5 (min with 2).
- **Strip**: renders registry order, tap invokes selection callback with body key, external selection highlights + scrollIntoView (spy), absent >768px.
- **Manual/device**: real drag feel, 120Hz smoothness, actual DPR on device, degrader recovery under load.

## F. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| DPR 2 + full bloom overwhelms an older/thermal-throttled phone | FrameBudgetDegrader `pixelRatio` step sheds automatically (REQ-MOB-204); legacy fps monitor still drops post-processing as last resort |
| touchend selection regresses hover/orbit interplay with OrbitControls | Guard only gates selection; OrbitControls keeps receiving all touch events untouched |
| jsdom TouchEvent construction quirks | Fall back to dispatching hand-built event objects at the handler seam (`_onTouchStart(fakeEvent)`) — the guard logic, not the DOM plumbing, is the unit under test |
| Strip overlaps TimeControls on short landscape viewports | Strip collapses to smaller height under a `max-height` media query; landscape phone is secondary orientation |
| Removing the static mobile cap changes texture-tier behavior mid-session (focus-time LOD upgrades now allowed on mobile) | That is the intended fix (high-end phones get sharp textures); `constrained` tier still disables upgrades for genuinely weak devices |

## G. Cross-SPEC Notes

- SPEC-KIDS-001 buttons (🔊, mute) inherit REQ-MOB-105 sizing; if KIDS lands first, M4 resizes them here.
- SPEC-PWA-001 activates `env(safe-area-inset-bottom)`; strip and TimeControls CSS written `env()`-ready now (evaluates 0 until viewport-fit=cover exists).
- SPEC-EVENTS-001's comet + belt entries appear in the strip automatically via REQ-MOB-305 (registry-driven).

No open clarification markers — all decisions resolved with stated defaults.
