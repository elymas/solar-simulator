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

_<pending sync-phase>_

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
