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

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-08-12T07:09:00Z
run_commit_sha: be5ca321505afc41be518cf23be550ac15f81b88  # final implementation commit (M3)
run_status: partial-milestones-complete   # M1-M3 done; M4-M5 open in a separate delegation
ac_pass_count: 9      # AC-MOB-101,102,103,104,201,202,203,204,205
ac_fail_count: 0
ac_deferred_count: 6  # AC-MOB-105 (M4), AC-MOB-301..305 (M5)
preserve_list_post_run_count: 9
l44_pre_commit_fetch: "0 0"    # orchestrator pre-spawn fetch at 5664658
l44_post_push_fetch: "0 0"     # observed after pushing be5ca32
new_warnings_or_lints_introduced: 0
cross_platform_build:
  applicable: false            # browser-only ES modules; no OS build matrix
  vite_build: pass             # npm run build exit 0
  pwa_build_suite: pass        # npm run test:build exit 0, 16 tests
total_run_phase_files: 5       # 2 new (quality.js, quality.test.js), 3 modified
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
