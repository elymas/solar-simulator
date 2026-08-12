# Progress — SPEC-MOBILE-001

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-12T01:21:04Z
- plan_status: audit-ready

## §E.2 Run-phase Evidence

Scope of this record: M1-M3 (touch guard + quality tier). M4 (tap-target CSS)
and M5 (PlanetStrip) are a separate delegation and remain open.

Baseline at delegation: HEAD `5664658`, 27 files / 288 tests passing.
Evidence logs: `.moai/state/verify/spec-mobile-001-m1m3/`.

### AC-MOB-101 RED evidence (reproduction-first, acceptance.md §4)

The M1 test was committed as `ea43bef` and observed FAILING against the pre-fix
source in that same commit. Verbatim vitest output
(`.moai/state/verify/spec-mobile-001-m1m3/01-M1-RED.log`):

```
 FAIL  test/interactionManager.test.js > InteractionManager touch selection (SPEC-MOBILE-001) > does not select a body when a single-finger drag passes over it (the defect)
AssertionError: expected [ 'mars' ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "mars",
+ ]

 ❯ test/interactionManager.test.js:101:22
     99|     interaction._onTouchStart(start([100, 100]));
    100|     // The defect lived here: selection fired on touchstart, before th…
    101|     expect(selected).toEqual([]);
       |                      ^

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

The failure lands on the assertion immediately after `_onTouchStart`, so the RED
signal is the defect itself (selection fired on touchstart) and not an incidental
`_onTouchEnd is not a function`. The same test passes at `7c94541`.

A second RED was captured for M3 (`04-M3-RED.log`): `src/utils/quality.test.js`
failed to resolve `./quality.js` before the module existed.

### AC matrix

| AC | Status | Verification command | Actual output |
|----|--------|----------------------|---------------|
| AC-MOB-101 | PASS | `npx vitest run test/interactionManager.test.js` | RED at `ea43bef` (above); 15 passed at `7c94541` |
| AC-MOB-102 | PASS | same | boundary pinned both sides: 8px → `['mars']`; 9px → `[]` |
| AC-MOB-103 | PASS | same | 60px drag → no select; two-finger gesture → no select |
| AC-MOB-104 | PASS | same | raycast miss with `selectedPlanet='earth'` → `onDeselect` fired, `selectedPlanet` null |
| AC-MOB-105 | deferred to M4 | — | tap-target CSS sweep is out of this delegation's scope |
| AC-MOB-201 | PASS (unit) | `npx vitest run src/utils/quality.test.js` | dpr 3 → pixelRatio 2; dpr 1.5 → 1.5; dpr 4 → 2; full tier `bloomOverride: null` |
| AC-MOB-202 | PASS | `grep -n "setPixelRatio(1)" src/scene/SceneManager.js` | no matches; retained `isMobile` at `:196` (frame budget) and `:259`/`:271` (legacy fps monitor) |
| AC-MOB-203 | PASS | `npx vitest run src/utils/quality.test.js` | {hwc 4, mem 2} → constrained; {hwc 4, mem undefined} → full; {hwc 8, mem 2} → full |
| AC-MOB-204 | PASS | `git diff --stat 5664658 -- src/utils/performance.js src/utils/performance.test.js` | empty (untouched); suite green inside the 308-test run |
| AC-MOB-205 | PASS | `npx vitest run src/utils/quality.test.js` + grep | `decideQualityTier` exported and pure (repeat calls equal, fresh object each call); SceneManager `:178`/`:179` assign `textureCapEnabled`/`lodUpgradesDisabled` from its output |
| AC-MOB-301..305 | deferred to M5 | — | PlanetStrip is out of this delegation's scope |

### Suite, build, and regression evidence

| Check | Command | Result |
|-------|---------|--------|
| Full suite | `npm test` | exit 0 — 28 files / 308 tests passed (baseline 27 / 288; +1 file, +20 tests) |
| Production build | `npm run build` | exit 0 — 42 precache entries, `dist/sw.js` generated |
| PWA build suite | `npm run test:build` | exit 0 — 1 file / 16 tests passed |
| PRESERVE untouched | `git diff --stat 5664658 -- <preserve paths>` | empty for all 9 paths (performance.js, performance.test.js, InfoPanel.js, InfoPanel.test.js, PlanetList.js, TimeControls.js, index.html, main.js, SolarSystemView.js) |

### M3 module-placement decision

`decideQualityTier` lives in a NEW `src/utils/quality.js` rather than folding
into `src/utils/performance.js`. Three reasons, in order of weight:

1. `performance.js` is on this SPEC's PRESERVE list and AC-MOB-204 requires it
   unmodified-green — folding in would have contradicted the constraint directly.
2. Different concern and lifecycle: `performance.js` is a per-frame state machine
   that sheds effects while the app runs; the tier is a one-shot boot decision.
3. Diff size is a wash either way (~50 lines of function + JSDoc), so the tie
   breaks toward the zero-regression-risk option.

Test file is co-located (`src/utils/quality.test.js`) to match the existing
co-located convention of `performance.test.js` in the same directory. The M1/M2
tests extended the pre-existing `test/interactionManager.test.js` rather than
creating `src/controls/InteractionManager.test.js` as plan.md §D proposed — that
file already existed at HEAD, so plan.md §D was stale on this point.

### Commits (Route A — Hybrid Trunk, pushed directly to main)

| Commit | Milestone | Subject |
|--------|-----------|---------|
| `ea43bef` | M1 (RED) | `test(SPEC-MOBILE-001): M1 RED — touch drag over a body must not select` |
| `7c94541` | M2 (GREEN) | `fix(SPEC-MOBILE-001): M2 GREEN — select on touchend behind a drag guard` |
| `be5ca32` | M3 | `refactor(SPEC-MOBILE-001): M3 — quality tier from device signals, not the user agent` |

### M4-M5 evidence (tap targets + PlanetStrip)

Scope of this record: M4 (tap-target sweep) and M5 (PlanetStrip). This closes
the two milestones the M1-M3 record above left open; M6 (regression + browser
verification) is the orchestrator's.

Baseline at delegation: HEAD `1f10a6c`, 28 files / 308 tests passing (re-measured
by this delegation, `npm test` exit 0).
Evidence logs: `.moai/state/verify/spec-mobile-001-m4m5/`.

#### AC-MOB-105 measurement method

jsdom has **no layout engine** — `offsetHeight` is always 0 — but it **does**
cascade class rules from an injected `<style>` tag into `getComputedStyle`. This
was established empirically with a throwaway probe before writing any test:
`min-height`/`width`/`height` declared on a class resolved to `"48px"`/`"44px"`,
while `offsetHeight` read `0`. The pre-existing `renders nameKo strictly larger`
test in `test/ui.test.js` relies on the same mechanism.

Every target size is therefore declared as an explicit `min-height`/`width`/
`height` floor and asserted as a **real computed value** (`parseFloat(
getComputedStyle(el).minHeight) >= 48`), not as a style-text `toContain` match.
The floors are also real boxes, not invisible hit-slop: a `.planet-list-item` is
genuinely 48px tall with its content vertically centred.

One target cannot be checked this way: `index.html`'s `@media (max-width: 768px)`
block is never loaded into jsdom, so its declaration is asserted as **file text**
(`readFileSync('index.html')` + a regex scoped to the planet-list block). See
Gaps below.

#### AC matrix (M4-M5)

| AC | Status | Verification command | Actual output |
|----|--------|----------------------|---------------|
| AC-MOB-105 | PASS | `npx vitest run test/ui.test.js test/timeControls.test.js` | RED first (`m4-red.log`): play `40 < 44`, list rows `NaN`, caret `14 < 32`, toggle `36 < 44`, index.html regex no-match. GREEN at `b96fcd0`: rows/moon rows `minHeight 48`, caret `width 32` + `minHeight 32`, toggle `44x44`, play/reset/mute `44x44`, mobile block matches `min-height: 48px` |
| AC-MOB-301 | PASS | `npx vitest run src/ui/PlanetStrip.test.js` | at 402px `strip.el.isConnected === true` and `document.querySelector('.planet-strip') === strip.el`; declared `bottom: calc(64px + env(safe-area-inset-bottom, 0px))` parsed to `64 >= 64` (mobile TimeControls = 44px button + 10px padding either side); `PlanetList` still carries `auto-hidden` at the same width |
| AC-MOB-302 | PASS | same | `saturn` → token `🪐` + name `토성`; emoji-less registry body → `.planet-strip-dot` with `background: rgb(22, 199, 255)` and empty text; `nameKo`-less body → English `Nameless`; `minWidth`/`minHeight` both `48`; items are `BUTTON` with `aria-label` `화성 보기` |
| AC-MOB-303 | PASS | `npx vitest run src/ui/PlanetStrip.test.js test/solarSystemView.test.js` | strip click → `onSelect('saturn')`; `setActive('neptune')` → `active` class + `scrollIntoView({block:'nearest',inline:'center'})`; highlight moves rather than accumulates; via SolarSystemView a strip tap produces `infoPanel.show('mars', …)` + one `focusPlanet` + `onFocus('mars')`, and `_select`/`_deselect` drive `planetStrip.setActive`/`clearActive` |
| AC-MOB-304 | PASS | `npx vitest run src/ui/PlanetStrip.test.js` | at 1280px `strip.el.isConnected === false`, `document.querySelector('.planet-strip')` and `.planet-strip-item` both `null` — AC's **absent-from-DOM** branch (not the `display:none` alternative), so its "zero listeners" qualifier does not apply. Rotation test: portrait→landscape→portrait mounts/unmounts correctly |
| AC-MOB-305 | PASS | same | rendered `data-key` order deep-equals `[...Object.keys(PLANET_DATA), ...Object.keys(STAR_DATA)]` (18 bodies); `_buttons.moon`/`_buttons.io` undefined (moons excluded per spec.md §6); a synthetic `__comet` added to `PLANET_DATA` renders token `☄️` + name `시험 혜성` with **zero** change to `PlanetStrip.js` |

AC-MOB-101..104 and AC-MOB-201..205 were not re-claimed by this delegation; they
remain PASS from M1-M3 and stayed green inside the 336-test run below.

#### Suite, build, and regression evidence

| Check | Command | Result |
|-------|---------|--------|
| Full suite | `npm test` | exit 0 — 29 files / 336 tests passed (baseline 28 / 308; +1 file, +28 tests: 6 for M4, 22 for M5) |
| Production build | `npm run build` | exit 0 — 42 precache entries, `dist/sw.js` generated |
| PWA build suite | `npm run test:build` | exit 0 — 1 file / 16 tests passed |
| PRESERVE untouched | `git diff --stat 1f10a6c -- <preserve paths>` | empty for all 9 paths (performance.js/.test.js, quality.js/.test.js, InteractionManager.js, interactionManager.test.js, SceneManager.js, InfoPanel.js, InfoPanel.test.js) |
| strings.js exception | `git diff 1f10a6c -- src/ui/strings.js` | +4 lines only: one `stripSelect` template function for the Korean `aria-label` (the sanctioned exception) |

#### Decisions taken at run phase

- **Selection seam**: plan.md §A.4 expected the sidebar's selection callback to be
  wired in `src/main.js`. It is not — `src/main.js` contains no selection wiring
  at all. The convergence point is `SolarSystemView.buildUI` (`:103-107`), so the
  strip was given a `createPlanetStrip` injected factory matching the existing
  `createPlanetList`/`createInteraction` style, and its `onSelect` points at the
  same `this._select(key)`. plan.md §A.4 was stale on this point.
- **Test file placement**: `src/ui/PlanetStrip.test.js`, co-located as plan.md §D
  proposed and matching its two nearest siblings (`src/ui/InfoPanel.test.js`,
  `src/ui/strings.test.js`). The M4 tests instead extended the pre-existing
  `test/ui.test.js` / `test/timeControls.test.js`, which already own PlanetList
  and TimeControls.
- **No `stopPropagation` on the strip container**, unlike `PlanetList` and
  `TimeControls`. Every `InteractionManager` and `OrbitControls` listener is bound
  to `renderer.domElement` (`InteractionManager.js:62-67`), and the strip is a
  sibling overlay — a strip tap has no bubbling path to the canvas, so the three
  guard listeners those components carry would be no-ops here.
- **Registry order taken straight through** (`PLANET_DATA` then `STAR_DATA`) with
  no re-partition by category. `PLANET_DATA`'s own key order already lists the
  Sun and planets before the dwarf planets, so this reproduces the sidebar's
  grouping exactly while staying purely registry-driven.
- **`ABOVE_TIME_CONTROLS_PX = 64`** is a named constant interpolated into the CSS
  and re-derived by the test, so a future TimeControls height change surfaces as
  a failing assertion rather than a silent overlap.

#### Gaps (what was NOT verified here)

- `index.html`'s `@media (max-width: 768px)` `min-height: 48px !important` is
  asserted as **file text only**. jsdom never loads that stylesheet, so no
  computed-value check is possible for it and it carries strictly weaker
  evidence than the other AC-MOB-105 rows.
- "The strip renders **above** TimeControls" (AC-MOB-301) is verified as a
  declared CSS offset (`bottom >= 64px`), not as measured geometry — jsdom has
  no layout engine, so no test in this suite proves the two bars do not overlap
  on a real device.
- No browser or device run was performed: real drag-vs-tap feel, 120Hz
  smoothness, momentum scrolling of the strip, actual emoji glyph rendering, and
  true safe-area behaviour on a notched device are all unverified here. That is
  M6, which the delegation assigned to the orchestrator.
- `scrollIntoView` is asserted only as "called with the right options" against a
  spy; jsdom implements no scrolling, so the centring behaviour itself is
  unverified.

#### Commits (Route A — Hybrid Trunk, pushed directly to main)

| Commit | Milestone | Subject |
|--------|-----------|---------|
| `b96fcd0` | M4 | `fix(SPEC-MOBILE-001): M4 kid-sized tap targets across list, caret and buttons` |
| `3a6c279` | M5 | `feat(SPEC-MOBILE-001): M5 mobile planet icon strip as the phone-first selector` |

### M4 correction — AC-MOB-105 failed in a real browser

M4 was recorded PASS above on jsdom evidence. A headed-Chromium measurement at
`f0df097` shows AC-MOB-105 actually **FAILED at every phone width**. The M4-M5
`AC matrix` row for AC-MOB-105 and the `#### AC-MOB-105 measurement method`
subsection are left as written — they record what was true of the jsdom
evidence at that time; this subsection records the correction.

#### RED evidence (orchestrator browser measurement at `f0df097`)

Reproduction is a real-browser measurement, not a test. jsdom cascades the
declared `width: 44px` into `getComputedStyle` but runs no layout, so
`flex-shrink` never executes and the computed value never becomes the real one
— the M4 assertion `parseFloat(getComputedStyle(btn).width) >= 44` passes while
the button renders at 28px. No jsdom test can reproduce this defect.

| Viewport | `.control-btn` rendered width | AC-MOB-105 |
|----------|-------------------------------|------------|
| 375px | 24px | FAIL |
| 402px (primary device) | 28px | FAIL |
| 480px | 40px | FAIL |
| 600px | 44px | pass |
| 768px | 44px | pass |
| 1280px | 44px | pass |

Height measured a correct 44px at every width. Live values at 402px from
`getComputedStyle(playPauseBtn)`: `width: "28.1406px"`, `flexShrink: "1"`.

Cause: `.time-controls` is a flex container and `.control-btn` inherited the
default `flex-shrink: 1`. Measured budget at 402px — bar `calc(100% - 32px)` =
370, `padding: 12px` each side, `gap: 8px` × 4 → content budget 314px against
360px of natural child width (3 × 44 + speed-control 140 + date-display 88).
The 46px overflow was being paid out of the buttons.

#### Fix

| Change | File | Why |
|--------|------|-----|
| `.control-btn { flex-shrink: 0 }` | `src/ui/TimeControls.js` | Makes the declared 44px a floor rather than a starting point. |
| `.time-controls { flex-wrap: wrap; justify-content: center }` | `src/ui/TimeControls.js` | Absorbs the overflow as a second row. Self-adjusting: ≥600px still lays out on one row unchanged; no per-width media query. |

Every existing control is preserved — nothing hidden, removed, or shortened
(the date display in particular stays), per the user's decision.

#### Strip-offset decision — runtime measurement, not a media-query constant

`PlanetStrip` anchored at a hard-coded `bottom: calc(64px + env(...))`, chosen
against a one-row bar. With wrapping the bar grows to roughly 88-95px, so the
constant would have put the bar's top above the strip's bottom and overlapped
it by ~31px at 402px.

Rejected: a media-query constant. It would re-hardcode a bar height — the same
bug class being fixed — and it cannot hold. The wrap point is **content**-
dependent, not viewport-dependent: `#sim-date` changes width as the simulation
runs (`2026년 3월 30일` vs `2026년 12월 30일`) and `#speed-value` changes with the
slider (`0.01x` vs `500x`). Either can cross the wrap threshold at a fixed
viewport width, where no media query fires and a window `resize` listener never
runs. A constant tuned at 320/375/402/480/600/768/1280 would hold at exactly
those widths by coincidence and drift at every other width and every date.

Chosen: `TimeControls._trackHeight()` publishes `this.el.offsetHeight` to the
CSS custom property `--time-controls-h`, once at construction and again from a
`ResizeObserver` on `.time-controls`. Consumers read
`bottom: var(--time-controls-h, calc(<N>px + env(safe-area-inset-bottom, 0px)))`.

Why the invariant holds across 320-1280px rather than at sampled widths: the
strip's offset is the bar's own rendered border-box height, so the two are
equal **by construction** — there is no width at which they can disagree,
because no width-keyed value is involved. `ResizeObserver` fires on any box
change whatever the trigger (viewport resize, text reflow, font load,
orientation change), which is the superset of cases a `resize` listener misses.
`offsetHeight` is border-box and so already includes
`padding-bottom: calc(Npx + env(safe-area-inset-bottom))`; consumers therefore
must not re-add the env() term, which is why it lives inside the `var()`
fallback rather than outside it. A `0` height (jsdom, or pre-layout) is not
published, leaving the fallback in place rather than pinning consumers flush to
the screen edge.

#### `.planet-list` (index.html:90) — treated, not skipped

It **does** need the same treatment. `PlanetList._checkAutoHide()` only adds
`auto-hidden` at ≤768px; `_toggleVisibility()` (the `.planet-list-toggle`
button) removes it, so a phone user can reopen the list and its
`bottom: calc(70px + env(...))` is reachable, not dead code. At a ~88px bar it
would have overlapped by ~18px. Changed to the same
`bottom: var(--time-controls-h, calc(70px + env(safe-area-inset-bottom, 0px))) !important`.
Its sibling `max-height: calc(100vh - 120px)` was left alone: with the taller
bar the list top rises to ~32px at 874px viewport height, still on-screen, and
it is not part of this defect.

#### Regression guard added (declaration-level — read the Gaps)

| Test | File | Asserts |
|------|------|---------|
| `pins .control-btn against flex shrinking` | `test/timeControls.test.js` | `flex-shrink: 0` present in the `.control-btn` rule |
| `lets the bar wrap to a second row instead of squeezing its children` | `test/timeControls.test.js` | `flex-wrap: wrap` present in the `.time-controls` rule |
| `publishes the bar height as a CSS custom property on construction` | `test/timeControls.test.js` | `--time-controls-h` == stubbed `offsetHeight` |
| `republishes on resize, so wrapping to two rows moves the strip with it` | `test/timeControls.test.js` | Re-publishes from a stubbed `ResizeObserver` callback |
| `sits above the TimeControls bar…` (updated) | `src/ui/PlanetStrip.test.js` | Strip consumes `var(--time-controls-h, …)`; fallback still ≥64 |
| `anchors the reopened planet-list to the measured bar height…` | `test/ui.test.js` | index.html `.planet-list` consumes the same var |

The existing `>= 44` computed-style assertions were not weakened, loosened, or
deleted. They remain correct as declaration checks; they were simply never
sufficient alone.

#### Suite, build, and regression evidence

| Check | Result |
|-------|--------|
| `npm test` | 29 files / **341** tests passed, exit 0 (baseline 336 + 5 new) |
| `npm run build` | exit 0, 42 precache entries |
| `npm run test:build` | 1 file / 16 tests passed, exit 0 |
| RED confirmation | 6 failed / 52 passed on the three touched files before the fix |

Logs: `.moai/state/verify/spec-mobile-001-m4fix/`.

#### Gaps (what was NOT verified here)

- **The jsdom guard is declaration-level only.** It asserts that
  `flex-shrink: 0` and `flex-wrap: wrap` are *declared* — it does not and
  cannot assert that a button *renders* at 44px, because jsdom has no layout
  engine. If a later stylesheet overrode these declarations at higher
  specificity, every test here would still pass.
- **The real proof is the orchestrator's post-fix browser re-verification** at
  320 / 375 / 402 / 480 / 600 / 768 / 1280px. Until that measurement exists,
  AC-MOB-105 is fixed-in-principle, not confirmed-fixed.
- **No layout assertion exists for the no-overlap invariant** either. That the
  strip never overlaps `.time-controls` follows from the offset being the bar's
  own measured height, which is an argument, not a measurement. The same
  browser re-verification is what would confirm it.
- **`ResizeObserver` behaviour itself is stubbed**, not exercised. The test
  proves the publish path runs when the callback fires; it does not prove the
  browser fires that callback on a wrap.
- **Real-device safe-area behaviour is unverified.** The claim that
  `offsetHeight` already carries `env(safe-area-inset-bottom)` (and so must not
  be double-added) is reasoned from the border-box model, not measured on a
  notched device — headless Chromium reports the inset as 0.

#### Follow-up finding — desktop wrap hysteresis introduced by `ca5e158`

The orchestrator's browser re-verification of `ca5e158` confirmed the phone-width
fix (44×44 buttons at every width 320-1280; strip never overlaps the bar) and
found one desktop regression, violating acceptance.md §5 Definition of Done
("No regression on desktop").

Orchestrator measurement, headed Chromium at `ca5e158`, dev server:

| Path | bar width | bar height | rows |
|------|-----------|------------|------|
| Fresh load at 1280px | 635 | 69 | 1 |
| Resize 1280 → 402 | 370 | 88 | 2 (correct) |
| Resize 402 → 1280 (back) | 640 | **108** | **2 — stuck** |

The bar never recovers one row. Cause: `flex-wrap: wrap` was declared
unconditionally. Above 768px `.time-controls` is `position: fixed` with no
explicit width, so its used width is **shrink-to-fit** — derived from content.
That makes an unscoped wrap a one-way door: once the flex algorithm wraps, the
container's shrink-to-fit width is recomputed from the wrapped layout, which is
itself narrow enough to keep it wrapped. Below 768px this cannot happen, because
`index.html:59` gives the bar `width: calc(100% - 32px) !important`, making the
width viewport-derived rather than content-derived and breaking the feedback
loop.

Fix: `flex-wrap: wrap` and `justify-content: center` moved into a
`@media (max-width: 768px)` block inside the TimeControls injected stylesheet.
Desktop keeps the default `nowrap` and its original single-row layout.
`justify-content: center` moved with the wrap because it only serves the short
second row — on a shrink-to-fit single row it is a no-op, so desktop CSS is now
equivalent to its pre-`ca5e158` state. **The mobile-only scoping is what
prevents the hysteresis**: the loop requires a content-derived container width,
which exists only above the breakpoint, where wrap no longer applies.

`.control-btn { flex-shrink: 0 }` left unconditional — correct at every width,
and no desktop change (desktop was already rendering 44px).

`--time-controls-h` publication under `nowrap`: `_publishHeight()` reads
`this.el.offsetHeight` with no reference to wrap state, and the two publish
tests pass in jsdom, where the wrap declaration is not in effect at all — i.e.
they exercise the desktop-equivalent path. The desktop *value* (69px one-row)
is browser-measured by the orchestrator, not by this suite.

Guard updated. `lets the bar wrap to a second row at phone widths only` now
splits the stylesheet at the breakpoint and asserts both halves: no
`flex-wrap:` declaration above it, and the `.time-controls` wrap below it.
Scoping is the assertion, because an unscoped `flex-wrap` is now itself the
bug. The `flex-shrink: 0` assertion is unchanged.

RED for this follow-up: `git show ca5e158:src/ui/TimeControls.js` has 0 `@media`
blocks and an unscoped `flex-wrap: wrap` at line 74, so both new assertions fail
against it (`08-red-followup.log`).

| Check | Result |
|-------|--------|
| `npm test` | 29 files / 341 tests passed, exit 0 (unchanged count — assertion rewritten, not added) |
| `npm run build` | exit 0 |
| `npm run test:build` | 16 tests passed, exit 0 |
| Bundle check | `@media (max-width: 768px){.time-controls{flex-wrap:wrap;justify-content:center}}` present in `dist/assets/` |

Gaps for this follow-up: the guard remains **declaration-level** — it proves the
wrap is mobile-scoped in the source, not that the hysteresis is gone in a
browser. jsdom applies no media queries and has no layout, so neither the
one-row desktop layout nor the resize round-trip (1280 → 402 → 1280) is
verifiable in this suite. Both are the orchestrator's browser re-verification.
The `justify-content` no-op-on-desktop claim is reasoned from shrink-to-fit
sizing, not measured.

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-08-12T07:32:00Z
run_commit_sha: 3a6c2798e90f929e751a83693f466a2c76d9aa7a  # final implementation commit (M5)
run_status: complete            # M1-M5 done; M6 (regression + browser verification) is orchestrator-owned
ac_pass_count: 15               # AC-MOB-101..105, 201..205, 301..305
ac_fail_count: 0
ac_deferred_count: 0
preserve_list_post_run_count: 9
l44_pre_commit_fetch: "0 0"     # orchestrator pre-spawn fetch at 1f10a6c
l44_post_push_fetch: "0 0"      # observed after pushing 3a6c279
new_warnings_or_lints_introduced: 0
cross_platform_build:
  applicable: false             # browser-only ES modules; no OS build matrix
  vite_build: pass              # npm run build exit 0
  pwa_build_suite: pass         # npm run test:build exit 0, 16 tests
total_run_phase_files: 15       # git diff --name-only 5664658 3a6c279 -- src test index.html; M1-M3 5 + M4-M5 10, no overlap; 4 of the 15 are new
m1_to_mN_commit_strategy: one-commit-per-milestone-pushed-directly-to-main
```

## §E.4 Sync-phase Audit-Ready Signal

```yaml
sync_complete_at: 2026-08-12T16:56:00Z
sync_commit_sha: pending-backfill-spec-mobile-001-sync   # backfilled in a follow-up commit; a commit cannot cite its own SHA
sync_status: complete
changelog_entry_position: "CHANGELOG.md [Unreleased] — Added (1 entry) / Changed (2 entries) / Fixed (2 entries), all tagged (SPEC-MOBILE-001)"
frontmatter_status_transitions:
  spec_md: "in-progress -> completed (updated: unchanged, already 2026-08-12)"
  plan_md: "no frontmatter block present — nothing to transition"
  acceptance_md: "no frontmatter block present — nothing to transition"
  progress_md: "no frontmatter block present — nothing to transition"
mx_tag_validation:
  files_checked: 9   # InteractionManager.js, SceneManager.js, quality.js, PlanetStrip.js, PlanetList.js, TimeControls.js, strings.js, SolarSystemView.js, index.html
  tags_added: 0
  tags_verified_existing: 1   # TimeControls.js:22-25 @MX:NOTE + @MX:SPEC (SPEC-MOBILE-001 REQ-MOB-301) for the --time-controls-h cross-file contract
  gaps: "none — all new exports have fan_in=1 (below the fan_in_anchor=3 threshold), no JS warn_patterns (async/Promise.all) present, no untested public functions"
readme_updated: true   # Features bullets (2 new + 1 revised), Touch controls table, Project Structure (PlanetStrip.js, quality.js)
```

### Known issue recorded (pre-existing, out of this SPEC's scope)

The orchestrator's browser verification pass found a pre-existing desktop layout defect that SPEC-MOBILE-001 did not cause and does not own: between roughly 769-1270px viewport width, `.time-controls` is severely compressed (the "속도" and "날짜" labels break mid-word and the date wraps to three lines). Cause: `.time-controls` is `position: fixed` with only `left: 50%` + `transform: translateX(-50%)`, so its shrink-to-fit available width is half the viewport (450px at a 900px viewport) while its content's max-content width is 635px. This centering predates SPEC-MOBILE-001. Confirmed pre-existing by restoring `flex-shrink: 1` on the buttons in a live browser and re-measuring: the bar stayed 544×99, so the buttons were never the binding constraint. Not fixed here — it is a separate SPEC's work.

## §F Phase 4 Mode Selection

### Input parameters

- tier: M (3 artifacts: spec.md + plan.md + acceptance.md)
- scope (file count): ~10 (3 new, 7 modified per plan.md §D)
- domain count: 3 (src/controls, src/scene, src/ui)
- file language mix: JavaScript (ES modules) + HTML/CSS in index.html
- concurrency benefit: LOW — coding-heavy, not research-heavy
- Agent Teams prereqs: n/a (Mode 3 retired)

### Mode evaluation

| Mode | Selected | Rationale |
|------|----------|-----------|
| 1 trivial | no | Semantic behavior change across 3 modules; not a single-line edit |
| 2 background | no | Write-capable implementation work, not read-only analysis |
| 3 agent-team | no | RETIRED — never selected |
| 4 parallel | no | 3 domains meets the multi-domain threshold, but the work is coding-heavy, so Anthropic's coding-task parallelism caveat routes it away from parallel fan-out |
| 5 sub-agent | **yes** | Default fallback for coding-heavy work; sequential per-milestone delegation |
| 6 workflow | no | ~10 files (far below the ~30 threshold) and the transform is semantic/new-code, not a single uniform mechanical rule |

Decision: sub-agent

### Justification

The SPEC touches three domains (controls, scene, ui), which meets the Mode 4
multi-domain threshold on domain count alone. It is nevertheless coding-heavy —
new behavior in the interaction guard, a new pure decision function, and a new
UI component — so Anthropic's coding-task parallelism caveat ("most coding tasks
involve fewer truly parallelizable tasks than research") routes it to Mode 5.
Mode 6 is excluded on both of its gates: the scope is ~10 files against a ~30
threshold, and the work is semantic rather than a single uniform mechanical
transform. Delegation is split into two sequential manager-develop spawns
(M1-M3 logic, then M4-M5 UI) with an orchestrator verification batch between
them; the two spawns never run concurrently, preserving the single-writer rule.

### Boundary case

Domain count = exactly 3, which is the Mode 4 auto-select threshold. The
tie-breaker "coding-heavy + multi-domain prefers Mode 5 over Mode 4" resolved it
to Mode 5.

### Implementation Kickoff Approval

Approved by the user before this section was written. Preferences drained at the
gate: delegation split (2 spawns) and M6 browser-verification scope (headed
browser for DPR + strip render only; touch feel and 120Hz remain user device
checks).
