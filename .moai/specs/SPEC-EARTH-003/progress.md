# Progress — SPEC-EARTH-003

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-12T01:21:04Z
- plan_status: audit-ready

## §E.2 Run-phase Evidence

- run_started_at: 2026-08-12T08:08:00Z
- harness_level: standard (file_count 9 > 3, spec_type feature, no security/payment keywords, priority P2)
- development_mode: tdd (quality.yaml)
- execution: sub-agent mode, waves scheduled by file ownership to prevent write conflicts

### Precondition gate

| Check | Result |
|-------|--------|
| Worktree root | `/Users/masterp/orca/workspaces/solar-simulator/solar-earth` |
| `depends_on: SPEC-KIDS-001` | `status: completed` |
| Run-order (§G, after SPEC-MOBILE-001) | sync commits `3b4f522`, `8414e77` present |
| Baseline `npm test` | Initially failed: `sh: vitest: command not found` (empty `node_modules`). After `npm ci` (415 packages): 29 files / 341 tests pass |

Brownfield citations in plan.md re-verified before implementation. All valid; only
`SceneManager.js` line numbers had shifted (`onAuroraShed` 190-192 → 202/226/229) after
SPEC-MOBILE-001 landed.

### Milestones

| M | Scope | Files |
|---|-------|-------|
| M1 | Shower table, wrap-aware predicates, intensity, half-open entry detection | `src/utils/meteorData.js` (+test) |
| M5a | Pure ISS propagation (92 sim-min period, 51.6°, radius 115) | `src/utils/issOrbit.js` (+test), `constants.js` `ISS_DEFAULTS` |
| M5b | ISS marker, HUD toggle (default ON), tap → Korean facts + TTS, drag guard | `src/earth/ISSMarker.js` (+test), `EarthView.js`, `EarthHUD.js`, `strings.js` |
| M2+M3 | Streak pool (12 full / 6 constrained), night-dome spawn, reduced-motion gate, degrade ladder | `src/effects/MeteorShower.js` (+test), `performance.js`, `constants.js` `METEOR_DEFAULTS`, `EarthView.js`, `ViewManager.js`, `SceneManager.js` |
| M4 | HUD notice `${koreanName}가 쏟아져요!` + one TTS callout, per-shower re-arm | `EarthHUD.js`, `EarthView.js`, `strings.js` |
| M6 | Flight reference point London → Seoul/Incheon, Korean region copy | `constants.js` `FLIGHT_DEFAULTS`, `strings.js` |

### Verification

- `npm test`: 33 files / 422 tests pass
- `npm run build`: succeeds (pre-existing >500 kB three.js chunk advisory only)
- Grep gate (REQ-E3-204): no `fetch`, `XMLHttpRequest`, URL literal or `WebSocket` in
  `meteorData.js`, `issOrbit.js`, `MeteorShower.js`, `ISSMarker.js`
- New external dependencies: none (`package.json` / `package-lock.json` unchanged)
- Manual/device verification deliberately excluded from this run by user decision;
  AC-E3-103's visual check and the §5 device pass remain open.

### Quality gates

- manager-quality TRUST 5: **PASS** (0 critical, 2 warning, 3 suggestion). One
  `@MX:ANCHOR` added on `isShowerActive` (fan_in 4). No P1/P2 MX violation.
- evaluator-active cycle 1: **FAIL** — 1 critical, 2 moderate, 1 minor.
- evaluator-active cycle 2: **PASS** — critical fix confirmed by brute-force fuzzing
  (1000 windows across three sampling strategies, 0 mismatches; 500 × 60-frame state
  machine trials, 30,500 checks, 0 violations).

### Defects found and fixed during the run

1. **CRITICAL — shower entry silently skipped.** `detectShowerEntries` sampled only the
   two window endpoints, so a shower whose entire range fell inside `(prevDay, currDay]`
   was never reported. Reproduced: a 20-day window 2026-11-30 → 2026-12-20 swallowed
   Geminids (13-day range) and returned `[]`. The existing "400-day step" test passed
   only because 400 exceeds the 365.25-day multi-year branch, so endpoint sampling was
   never exercised — REQ-E3-102's "no entry is skipped at any frame step size" was false
   under a green suite. Trigger is ordinary: `ViewManager.js:164` passes an uncapped
   `getDelta()` and the speed slider reaches 3 days/sec, so a backgrounded tab resuming
   suffices. Fixed by walking every whole day boundary the window crosses — exact, not
   approximate, because activity is day-quantized — bounded at ~366 iterations by the
   existing multi-year branch.
2. **Consumer correction (follow-on).** With (1) fixed, a shower can be reported after it
   has already ended. `EarthView._detectShowers` now applies one uniform rule — when
   `entries` is non-empty, notice `isShowerActive(curr)`, which may be null — replacing
   the previous `entries.length === 1` special case.
3. **Frame-window ownership.** `_prevSimDay` was advanced only inside `_detectEclipses`,
   which bails on `!this._eclipseRig` while `_detectShowers` bails only on `!this._simApi`.
   Between a dispose and the next build the shower window never closed. The advance now
   has a single unconditional owner in `update()`.
4. **Entry-day dead zone.** `showerIntensity` was quantized to whole days, returning
   exactly 0 for the entire first day of a range while the notice and TTS fired on that
   same day. Fixed with sub-day interpolation applied to intensity only; activity and
   entry detection stay day-quantized because the boundary scan in (1) depends on it.
5. **Exit-day cliff.** The descending taper reached 0 at the *start* of the last active
   day, leaving that whole day dead. `peakToEnd` now spans the final day, so the taper
   reaches 0 as the range truly closes.
6. **Missing integration test** for `EarthView.setMeteorsShed`, added to mirror the
   aurora shed test.

### Deliberate simplifications (recorded, not defects)

- **Streak flight is not night-side confined.** Only the spawn point is gated. Measured
  exposure: 0.8 s at 80 units/sec is 64 units of travel at a spawn radius of 130–155,
  roughly a 26° arc, so a streak spawned near the terminator can cross to the day side
  before expiring. REQ-E3-103's text governs the spawn point; confining the whole flight
  requires terminator-avoidance logic disproportionate to a decorative layer.
- **A shower entered and exited within a single frame produces no notice.** The data
  layer now detects it correctly, but the consumer declines to announce a shower that is
  already over, since `isShowerActive(curr)` is the single source of truth for "what is
  in the sky right now". AC-E3-104 bounds notices from above, so this is compliant.
- **ISS `altitudeOffset: 15`** (earth-local units) was not specified numerically. Chosen
  to sit clearly above the aircraft band (3–4.5 units at cruise) and the cloud shell
  (102), well inside the Moon's distance (900). A candidate for adjustment once the
  deferred device pass happens.
- **Annual recurrence idealization (A-401)** and the **symbolic circular ISS orbit
  (A-405)** are documented in code comments as required by the Definition of Done.

## §E.3 Run-phase Audit-Ready Signal

- run_complete_at: 2026-08-12T09:50:00Z
- run_status: audit-ready
- tests: 422 passing / 33 files
- build: passing
- evaluator_verdict: PASS (cycle 2)
- trust5_verdict: PASS
- open_items: manual/device verification (AC-E3-103 visual, §5 Definition of Done device pass)

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
