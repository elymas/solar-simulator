# Acceptance Criteria — SPEC-MOBILE-001

## 1. AC Matrix (1:1 with REQs)

| AC | REQ | Criterion (testable) | Verification |
|----|-----|----------------------|--------------|
| AC-MOB-101 | REQ-MOB-101 | **Reproduction-first evidence**: the M1 test (touchstart on body → drag 30px → touchend must NOT select) exists, demonstrably FAILED against pre-fix code (failure output captured in run-phase evidence), and PASSES post-fix. No selection callback fires during touchstart in any test | vitest + recorded RED evidence |
| AC-MOB-102 | REQ-MOB-102 | Touch sequence with movement ≤8px → exactly one `onSelect(key)` on touchend; movement 9px → zero calls (boundary tested at 8 vs 9) | vitest |
| AC-MOB-103 | REQ-MOB-103 | Drag >threshold → no selection change on release; gesture containing a second touch at any point → no selection | vitest |
| AC-MOB-104 | REQ-MOB-104 | Qualifying tap with stubbed raycast miss while a body is selected → `onDeselect` fires (mouse parity) | vitest |
| AC-MOB-105 | REQ-MOB-105 | Computed sizes: list item height ≥48px, all buttons ≥44×44, caret hit area ≥32px (mobile media query values included) | vitest (jsdom computed style) + manual device |
| AC-MOB-201 | REQ-MOB-201 | On boot with dpr=3: `renderer.setPixelRatio` called with 2; with dpr=1.5: called with 1.5; bloom at full defaults in `full` tier | vitest (tier function) + device check (`getPixelRatio()===2`) |
| AC-MOB-202 | REQ-MOB-202 | Tier decision ignores UA: iPhone UA + {hwc 6, mem undefined} → `full`. Grep: no `isMobile`-conditioned `setPixelRatio(1)` remains in `SceneManager._detectPerformance` | vitest + grep |
| AC-MOB-203 | REQ-MOB-203 | {hwc 4, mem 2} → `constrained` (pixelRatio 1 + texture cap + LOD upgrades off); {hwc 4, mem undefined} → `full`; {hwc 8, mem 2} → `full` | vitest (table-driven) |
| AC-MOB-204 | REQ-MOB-204 | `src/utils/performance.test.js` passes UNMODIFIED in behavior; degrader still steps bloom→lod→pixelRatio when fed over-budget frames (step order characterized AS OF SPEC-MOBILE-001 completion; later extended by SPEC-EVENTS-001/SPEC-EARTH-003) | vitest (existing suite) |
| AC-MOB-205 | REQ-MOB-205 | `decideQualityTier` is exported, pure (same input → same output, no globals), and `textureCapEnabled`/`lodUpgradesDisabled` in SceneManager derive from its output | vitest + code review |
| AC-MOB-301 | REQ-MOB-301 | At ≤768px the strip renders above TimeControls (DOM order/position assertions); sidebar remains auto-hidden | vitest (jsdom) + manual |
| AC-MOB-302 | REQ-MOB-302 | Each strip item: visual token (emoji when body has `emoji`, else color dot) + `nameKo` text + ≥48px target | vitest |
| AC-MOB-303 | REQ-MOB-303 | Strip tap → same selection callback as sidebar with body key; external selection change → strip item highlighted + `scrollIntoView` invoked | vitest (spies) |
| AC-MOB-304 | REQ-MOB-304 | At >768px the strip is absent from the DOM (or `display:none` with zero listeners) | vitest |
| AC-MOB-305 | REQ-MOB-305 | Strip items are generated from the body registry; adding a synthetic test body to the registry yields a new strip item without strip code changes | vitest |

## 2. Given-When-Then Scenarios

### Scenario 1 — Orbit drag no longer hijacks selection (the defect)
- **Given** the solar view with no selection, and the child places a finger ON Jupiter to spin the camera
- **When** the finger drags 30px and lifts
- **Then** the camera orbits and NOTHING is selected — no InfoPanel, no camera focus fly-to, no TTS narration.

### Scenario 2 — Deliberate tap selects
- **Given** the solar view
- **When** the child taps Mars (finger down, ≤8px wobble, up)
- **Then** Mars is selected on finger-lift: InfoPanel opens, focus behavior identical to a desktop click.

### Scenario 3 — High-end iPhone renders sharp
- **Given** an iPhone 17 Pro (dpr 3, hwc 6, no deviceMemory API)
- **When** the app boots
- **Then** the canvas renders at pixelRatio 2 with full bloom, and only a sustained over-budget frame streak causes the degrader to shed (bloom first, pixelRatio last).

### Scenario 4 — Strip drives everything
- **Given** a 402pt-wide viewport
- **When** the child scrolls the bottom strip and taps 토성 (emoji/dot + "토성" label)
- **Then** Saturn is selected exactly as a 3D tap would: camera focus, InfoPanel, strip highlight centered.

## 3. Edge Cases

- Touch begins on body, drags off, returns, lifts within 8px total displacement of start: displacement measured start→end (not path length) — selects. Documented behavior.
- `touchcancel` (system gesture/notification): pending tap state cleared; next touch starts fresh.
- Rotation mid-gesture (orientation change): guard state reset; no phantom selection.
- `devicePixelRatio` changes (external display move): initial policy only; no live re-tier (documented; degrader handles the consequences).
- Registry body without `nameKo` (defensive): strip falls back to `name`.
- Strip with selection of a body NOT in the strip (a moon tapped in 3D): strip clears highlight, no scroll, no crash.

## 4. Quality Gate Criteria

- Full vitest suite green (`npm run test`); `npm run build` succeeds.
- AC-MOB-101 RED evidence recorded in progress.md §E.2 (reproduction-first proof per CLAUDE.md §7 Rule 4).
- Existing `performance.test.js` and `InfoPanel.test.js` untouched-green.
- Desktop mouse interaction characterization tests pass (byte-identical behavior).
- TRUST 5: Tested (guard/tier/strip units), Readable (named constants, English comments), Unified (existing IM/SceneManager style), Secured (no new external input), Trackable (conventional commits per milestone referencing SPEC-MOBILE-001).

## 5. Definition of Done

- All AC-MOB-1xx/2xx/3xx PASS; manual device pass on an iPhone-class device (sharpness visibly improved vs pixelRatio 1, drag-vs-tap correct at 120Hz).
- No regression on desktop (mouse guard, sidebar, quality on high-end desktop unchanged at min(dpr,2)).
- Frontmatter lifecycle transitions owned by the standard agents; no open clarification markers were declared.
