# Progress — SPEC-PLAY-001

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-12T01:21:04Z
- plan_status: audit-ready

## §E.2 Run-phase Evidence

### M1 — Mission engine, sticker persistence, SFX module, travel facts (2026-08-12)

Methodology: TDD (RED-GREEN-REFACTOR). Every test file was written and confirmed
failing before its implementation module existed.

**Files added (new only — no existing source file was modified)**

| File | Purpose |
|------|---------|
| `src/play/missions.js` | Mission catalog, seeded daily rotation, pure completion engine |
| `src/play/missions.test.js` | Rotation determinism, predicate matching, award-once, import purity |
| `src/play/stickers.js` | Single-blob play-state persistence (`solar.play`) |
| `src/play/stickers.test.js` | Round-trip, defensive parse, hostile-storage fallback |
| `src/audio/sfx.js` | Synthesized Web Audio one-shots (chime / twinkle / fanfare) |
| `src/audio/sfx.test.js` | Mute gating, unlock ordering, lazy construction, degradation |
| `src/play/travelFacts.js` | Destination → Korean travel fact table + eligibility derivation |
| `src/play/travelFacts.test.js` | Table completeness vs derived eligible set, §8.1 checklist |

**REQ / AC covered**

| REQ | AC | Evidence |
|-----|----|----------|
| REQ-PLAY-401 | AC-PLAY-401 | `missionsForDate` frozen inline snapshot (same date → same 3, cross-run stable, no `Math.random`); catalog shape + body-existence assertions |
| REQ-PLAY-402 | AC-PLAY-402 | Synthetic event streams per predicate type (`select` / `view` / `action`); unknown + malformed events are no-ops |
| REQ-PLAY-403 | AC-PLAY-403 | Award → serialize → fresh store from the same storage → still earned; single namespaced key asserted against the fake storage map |
| REQ-PLAY-404 | AC-PLAY-404 | Award-once invariant: re-completion still returns the match (praise may fire) with `awarded: false`; inventory unchanged |
| REQ-PLAY-405 | AC-PLAY-405 | Import-graph assertion: `missions.js` reaches only `planetData.js`, imports nothing from three.js, references no browser global |
| REQ-PLAY-303 | AC-PLAY-303 | Muted (shared KIDS-001 setting, read via `tts.isMuted()`) → zero nodes created; `resume()` recorded before any `createOscillator`; `sfx.js` source asserted free of the mute key and of `localStorage` |
| REQ-PLAY-202 | AC-PLAY-202 | Travel-fact table completeness asserted against the eligible-destination set derived from planetData (13 destinations: 7 planets + 5 dwarf planets + the Moon) |
| REQ-PLAY-203 | AC-PLAY-203 | Schematic / "not a transfer orbit" honesty comment asserted by test; every fact row carries a `// 참고:` reference duration |

**Test counts** — `npm test`: 33 files passed (29 pre-existing + 4 new), 418 tests
passed (341 pre-existing + 77 new). Zero regressions. `npm run build` succeeds.

**Korean strings** — all mission prompts and travel facts are machine-checked against
SPEC-KIDS-001 §8.1: ≤45 characters, 해요체 ending, no English, body name present, and
(for travel facts) a real reference duration recorded in the table comment.

**Deviations from plan.md**

1. `sfx.init()` takes `{ audioContext }` only, not `{ audioContext, storage }`. A
   `storage` parameter would be dead: mute is read exclusively through
   `tts.isMuted()` (plan §A.6 — KIDS-001 owns the key), so `sfx.js` has no reason to
   hold a storage handle. Injection parity with `tts.js` is preserved for the part
   that matters (the audio backend).
2. Storage key resolved to `solar.play` (plan §B left the choice open between
   `solar.play` and `solar.play.state`). Rationale recorded in the module header:
   one entry for the whole play layer as it grows.
3. `handleEvent` returns matched mission objects carrying `{ awarded, firstToday }`
   rather than bare ids. The UI needs the sticker id and emoji for the praise and
   sticker-book flip, and needs to distinguish "sticker newly earned" from "mission
   newly done today" (plan §A.4 allows praise on re-completion while forbidding a
   duplicate award). The ids remain on the returned entries.
4. `src/ui/strings.js` was left untouched. M1 produces no UI, and the mission prompts
   and travel facts are catalog data, not chrome labels — moving them into `STR`
   would split one authored table across two files.

**Out of scope for M1 (owned by later milestones)** — SizeCompare, StickerBook,
RocketJourney, Celebration, InfoPanel entry buttons, and all
`SolarSystemView`/`ViewManager`/`index.html` wiring.

### M3 + M4 — Celebration effects, SFX wiring, play-event seam, rocket journey (2026-08-12)

Methodology: TDD (RED-GREEN-REFACTOR). Every test file was written and confirmed
failing before its implementation existed. For the two seams inside already-shipped
files (`SolarSystemView`, `SceneManager`), RED was re-confirmed by stashing the
source edit and re-running: 16 of the 18 wiring tests fail without it.

**Files added**

| File | Purpose |
|------|---------|
| `src/play/playEvents.js` | The `emitPlayEvent(type, payload)` seam + subscription (plan §4) |
| `src/play/playEvents.test.js` | Vocabulary contract against the M1 mission engine, unsubscribe/leak, purity |
| `src/effects/Celebration.js` | Pooled one-shot sparkle/twinkle bursts |
| `src/effects/Celebration.test.js` | Pool reuse, budget, variants, reduced motion, disposal |
| `src/play/RocketJourney.js` | Pure path math + the schematic flight, cancel seams |
| `src/play/RocketJourney.test.js` | Bezier/apex/duration, moving-target landing, arrival, cancel-leak, reduced motion, honesty |
| `src/scene/SceneManager.focus.test.js` | Camera-arrival notification fires exactly once per focus |
| `src/views/SolarSystemView.play.test.js` | Unlock ordering, arrival→burst, star variant, events, rocket seams |
| `src/earth/EarthView.play.test.js` | `view-enter` emission for EARTH |

**Files modified (surgical, additive only)**

| File | Change |
|------|--------|
| `src/scene/SceneManager.js` | `onFocusArrive` callback field + one fire site inside the existing focus lerp. `focusPlanet()` signature untouched. |
| `src/views/SolarSystemView.js` | `initSfx()` after `initTts()`; `createCelebration`/`createRocket` factory opts; `_buildPlayLayer`/`_prefersReducedMotion`/`_getBody`/`_onFocusArrive`; `launchRocket`/`canLaunchRocket`; unlock + emit + rocket-cancel in `_select`; cancel in `_deselect`/`onExit`; `view-enter` in `onEnter`; pool + rocket pumped from `update`; disposal. |
| `src/earth/EarthView.js` | One `emitPlayEvent('view-enter', { view: 'EARTH' })` at the top of `onEnter`. |
| `test/solarSystemView.test.js` | Stub scene gained `add`/`remove` (fixture only — no assertion changed; the play layer now mounts into the scene during `buildUI`). |

**REQ / AC covered**

| REQ | AC | Evidence |
|-----|----|----------|
| REQ-PLAY-201 | AC-PLAY-201 | Eligibility derived from `travelFacts.eligibleDestinations()` (no second list): planets/Moon/dwarfs yes, Earth/Sun/stars no. Path math tested pure: t=0 → P0 exactly, t=1 → P2 exactly, apex above the ecliptic, arc height ∝ distance, duration floor 2500 ms / ceiling 6000 ms |
| REQ-PLAY-202 | AC-PLAY-202 | Arrival fires celebration at the destination's live position + `speak(travelFactKo(key))` + `emit('rocket-arrived', { body })`, exactly once however long the loop runs |
| REQ-PLAY-203 | AC-PLAY-203 | Header comment states the path is schematic and NOT a transfer orbit; a test greps the source for the absence of transfer-orbit vocabulary and impulse-budget math |
| REQ-PLAY-204 | AC-PLAY-204 | `cancel()` is the single teardown path (@MX:WARN). Group removed, every geometry/material disposed, `_destination` cleared; leak assertion runs the clock 3× the max flight after cancel and asserts zero callbacks. Seams tested: another selection, deselect, view exit, relaunch, disposal, destination gone |
| REQ-PLAY-205 | AC-PLAY-205 | Reduced motion: `launch()` builds no mesh, `isFlying()` false, arrival presented immediately (fact + TTS + static celebration) |
| REQ-PLAY-301 | AC-PLAY-301 | `SceneManager.onFocusArrive` fires exactly once per focus (`_isFocusing` is cleared before the call) and never for a reset; the view answers with exactly one sparkle burst, and one burst calls the chime exactly once |
| REQ-PLAY-302 | AC-PLAY-302 | `isStar` picks the `twinkle` effect id + the twinkle sound; sparkle and its chime stay silent |
| REQ-PLAY-303 | — | `initSfx()` runs immediately after `initTts()` in `buildUI`; `unlockAudio()` is the first statement of `_select`, ahead of `speakBody` — asserted through a shared ordering log (`resume` precedes `speak`) |
| REQ-PLAY-304 | AC-PLAY-304 | Reduced motion emits zero particles and still plays the sound; camera shake is not merely disabled but impossible — `Celebration` receives no camera, asserted against its own source |
| REQ-PLAY-305 | AC-PLAY-305 | Fixed 160-particle pool, one `THREE.Points`; allocation count and the identity of both attribute arrays are unchanged across 10 bursts; two rapid bursts both emit fully (ring cursor overwrites the oldest, so there is no exhaustion state) |
| REQ-PLAY-402 | — (M5 wires the engine) | `select` / `view-enter` / `rocket-arrived` emitted; the seam's vocabulary test drives the real M1 engine and completes `find-rings`, `earth-view`, `rocket-any`, `compare-sun` |

**Test counts** — `npm test`: 39 files passed (33 pre-existing + 6 new), 500 tests
passed (418 pre-existing + 82 new). Zero regressions. `npm run build` succeeds
(the >500 kB chunk warning is pre-existing).

**Celebration cost measurement + degrader decision (REQ-PLAY-305)**

Measured with node + three against a real `THREE.Scene`, 2000 bursts and 20000
frames after warm-up (`Celebration`, 64-particle sparkle, radius 8):

| Metric | Measured |
|--------|----------|
| `burst()` spawn | **0.0076 ms** |
| `update()` with the pool live | **0.00065 ms/frame** (0.004% of a 16.67 ms frame) |
| `update()` with the pool at rest | **0.000014 ms/frame** |
| Whole burst, spawn + all 51 alive frames | **0.041 ms** total CPU |

Decision: **no `'celebration'` shed step is registered with `FrameBudgetDegrader`.**
REQ-PLAY-305 makes registration conditional on the measured cost exceeding the
trivial threshold, and one entire burst costs a quarter of one percent of a single
frame's budget spread across 51 frames. The GPU side is one additive draw call of
at most 160 non-attenuated 3-pixel points with `depthWrite: false`, and the object
is `visible = false` whenever the pool is at rest, so an idle app issues no draw
call at all. Adding a shed step would be unreachable code guarding a cost that does
not exist. Caveat: the figures above are the JS-side cost (no GPU in the harness);
the M6 device pass remains the check on the draw-call side.

**Deviations from plan.md**

1. `RocketJourney` starts **no rAF and no timer**. It exposes `update()` and is
   pumped by the app's single ViewManager rAF through `SolarSystemView.update`,
   reading an injected wall clock (`performance.now()` in production). Flight time
   is therefore real-time and independent of the simulation speed, as §A.5 requires,
   while REQ-PLAY-204's "clear timers/RAF" is satisfied by construction — there is
   nothing to leak. A second rAF would also have violated the frozen single-loop
   architecture (REQ-385).
2. **The shared unlock hook is `sfx.unlockAudio()` itself**, called as the first
   statement of `_select`, immediately before `speakBody`. Plan §A.6 asks for "one
   shared unlock hook exported from `src/audio/`"; `sfx.js` already carries the
   @MX:ANCHOR declaring that function the place TTS priming joins, and TTS is primed
   by speaking inside the same gesture call stack. A wrapper module would have been
   a second name for one call.
3. The **ordering hazard flagged after M1 does not exist in the shipped code**:
   `initTts()` was already the first statement of `buildUI()`, so the persisted mute
   state is loaded before any UI can produce a gesture. `initSfx()` was added
   directly after it, and a test now locks the ordering (persisted mute → `isMuted()`
   true straight after `buildUI`).
4. **`Celebration` owns the sound**, mapping variant → one-shot. That makes
   REQ-PLAY-304's "zero particles, chime still plays" a single code path instead of
   a rule two call sites must both remember.
5. **Rocket arrival plays the sparkle chime, not `playFanfare`.** AC-PLAY-202 asks
   for the REQ-PLAY-301 celebration plus the spoken fact; stacking a fanfare on top
   of the chime would put two sounds on one moment. `playFanfare` stays reserved for
   M5's mission completion.
6. **Camera shake was never implemented.** No REQ asks for it and REQ-PLAY-304
   forbids it under reduced motion, so `Celebration` simply has no access to a
   camera — enforced by a source-level assertion rather than by a disabled feature.
7. `src/ui/strings.js` untouched. M3/M4 add no chrome labels; the only Korean
   surfaced is the M1 travel-fact table.
8. The **`size-compare` event is emitted by nobody yet** — M2/M5 owns the entry
   point. The seam and its vocabulary test are in place so that wiring is one line.

**Korean strings** — M3/M4 authored no new Korean text. The spoken arrival string
is the M1 `TRAVEL_FACTS_KO` table, already machine-checked against SPEC-KIDS-001
§8.1 by `travelFacts.test.js`.

**Out of scope for M3/M4 (owned by later milestones)** — the "로켓 발사" and
"크기 비교" InfoPanel buttons, SizeCompare, StickerBook, the mission-engine
subscription to `onPlayEvent`, and mission praise. `SolarSystemView.launchRocket(key)`
/ `canLaunchRocket(key)` are the public API M5's button calls.

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
