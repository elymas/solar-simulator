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

### M2 + M5 — Size comparison, entry points, sticker book, mission HUD, praise flow (2026-08-12)

Methodology: TDD (RED-GREEN-REFACTOR). Every test file was written and confirmed
failing before its implementation existed (`SizeCompare.test.js` and
`StickerBook.test.js` failed to resolve their module; `InfoPanel.test.js` failed
8 of 8 new cases; `SolarSystemView.missions.test.js` failed 13 of 14).

**Files added**

| File | Purpose |
|------|---------|
| `src/play/SizeCompare.js` | 2D DOM count-representation lineup + the pure ratio math |
| `src/play/SizeCompare.test.js` | Ratio math, lineup composition, eligibility, widths, fact, close, reduced motion, a11y |
| `src/play/StickerBook.js` | Sticker-book overlay AND the mission HUD (one surface, one file) |
| `src/play/StickerBook.test.js` | Access, earned/locked grid, round-trip, HUD, badge, hostile storage |
| `src/views/SolarSystemView.missions.test.js` | Entry-point wiring, praise flow, rollover, chrome lifecycle |

**Files modified (surgical, additive)**

| File | Change |
|------|--------|
| `src/ui/InfoPanel.js` | `.kid-actions` row with `.kid-compare` / `.kid-rocket`; `bodyKey`; `onCompare` / `onRocket` / `canLaunch` fields; per-body visibility in `_renderKidView`; local `<style>` additions |
| `src/ui/strings.js` | Append-only play-layer block (14 keys) |
| `src/views/SolarSystemView.js` | `_praise` pool, `SizeCompare`, `StickerBook`, sticker store, `_missionEngine`, `_onPlayEvent`, `_celebratePraise`, `getDate` option, entry-point wiring, `_setUiVisible`/`update`/`dispose` extensions, `_select` emit ordering |
| `test/solarSystemView.test.js` | Stub meshes gained `getWorldPosition` (fixture only — no assertion changed; the praise burst reads the focused body and WHICH body that is depends on the day's rotation) |

`index.html` was NOT touched: the InfoPanel-local `<style>` pattern hosted every
new rule, and the sticker toggle sits beside the planet-list toggle
(`left: 70px` = 16 + 44 + 10), which has no mobile override to fight.

**REQ / AC covered**

| REQ | AC | Evidence |
|-----|----|----------|
| REQ-PLAY-101 | AC-PLAY-101 | Lineup renders the selected body beside Earth and beside the Sun where countable; the fact is asserted ≥24px AND strictly larger than every other text node in the overlay; `speak` called exactly once per open, twice across open→close→open |
| REQ-PLAY-102 | AC-PLAY-102 | Ratios read `radius` only — a fixture with a mangled `displayRadius` yields the identical ratio. Rendered widths: big disc = 260px, unit disc = 260/ratio, so the width ratio error is 0%. Jupiter/Earth (11.21) and Sun/Earth (109.18) asserted within 5% of the AC's 10.97 / 109 |
| REQ-PLAY-103 | AC-PLAY-103 | Snapshot of `_focusedKey`, `focusPlanet` call count, `resetCamera` call count, scene child count and `infoPanel.isOpen` is identical across open→close. Source-level assertion: no `three` import, no `camera`/`renderer`/`sceneManager` identifier in code |
| REQ-PLAY-104 | AC-PLAY-104 | Reduced motion drops `sizecompare--animated`; `textContent` and disc count asserted identical to the animated build |
| REQ-PLAY-201 | AC-PLAY-201 | The 로켓 button reads `SolarSystemView.canLaunchRocket` — the M3/M4 rule derived from `travelFacts.eligibleDestinations()`. InfoPanel's own default is `() => false`, so no second eligibility list exists to drift |
| REQ-PLAY-401 | AC-PLAY-401 | HUD lists today's three `promptKo` from `missionsForDate`, marks done without hiding, shows "내일 또 만나요!" only when all three are done |
| REQ-PLAY-402 | AC-PLAY-402 | The view subscribes to `onPlayEvent`; a real `_select` completes its mission end to end |
| REQ-PLAY-403 | AC-PLAY-403 | Grid renders one tile per catalog sticker, earned vivid (opacity 1) vs locked silhouette (opacity 0.3 + grayscale), counts asserted. Round-trip: award → `solar.play` written → a fresh store + engine + book over the same storage still shows it earned |
| REQ-PLAY-404 | AC-PLAY-404 | Completion → one `playFanfare`, one `speak(STR.playPraise)`, one sparkle burst. Re-completing twice leaves `store.stickers()` byte-identical and speaks nothing further. Scenario 4: muted → zero oscillators, zero utterances, while the burst still emits and the sticker is still awarded |
| — | acceptance §3 | Earth compares to the Sun only; a star is allowed where the data supports it; the button is hidden where it does not; midnight rollover replaces the engine and yesterday's award stands |

**Test counts** — `npm test`: 42 files passed (39 pre-existing + 3 new), 568
tests passed (500 pre-existing + 68 new: 28 SizeCompare, 18 StickerBook, 14
SolarSystemView missions, 8 appended to InfoPanel). Zero regressions.
`npm run build` succeeds (the >500 kB chunk warning is pre-existing).
M2 was also verified in isolation before its commit: 40 files / 536 tests.

**Korean strings** — 14 keys appended to `STR`. The two comparison forms are
deliberately particle-free: the count form reuses the wording already authored
for jupiter/saturn/uranus/neptune in planetData ("… 나란히 놓으면 … 폭이에요!"),
and the near-equal form ends both nouns with "크기", so no 은/는 이/가 와/과
selection is ever needed for a body name the code cannot inspect. The object
particle rides inside the count phrase because 개 and 반 take different ones
("109개를" vs "2개 반을"). Every derived fact is machine-checked in
`SizeCompare.test.js` against SPEC-KIDS-001 §8.1: ≤45 characters, 해요체 ending,
no English, and the spoken count within ±10% of the true ratio.

**Deviations from plan.md / spec.md**

1. **The count fact is DERIVED, not `sizeComparisonKo`.** The authored field
   compares each body to whichever reference reads best (가니메데 → 수성, 포보스
   → 달) and sometimes carries no count at all, so rendering it beside an
   Earth/Sun lineup would have contradicted the picture. REQ-PLAY-101's own
   example ("태양에는 지구가 109개 들어가요!") is a template, so the lineup
   generates its own sentence from the same real diameters. The authored field
   still shows in the InfoPanel, unchanged.
2. **Counts round to the nearest HALF, and a row that cannot be stated honestly
   is dropped.** Whole-body rounding puts Earth/Mercury 15% off, past §8.1's
   ±10% window; "2개 반" is 4% off and is the wording planetData already uses for
   Mercury. A half disc is drawn at half width with a half border-radius, so the
   strip still spans the big disc. Sirius A (1.71 suns) can be stated by no half
   within ±10%, so it renders no lineup and its 크기 비교 button is hidden.
3. **`MAX_COUNT = 120` bounds the strip.** Beyond it the discs go sub-pixel at
   the 260px lane, so Betelgeuse (886 suns), Stephenson 2-18 (2146 suns), Phobos
   and Deimos get no lineup. This extends acceptance §3's "hidden for bodies
   without the data" from "no diameter" to "no countable comparison" — the same
   data-driven rule, one predicate (`canCompareSize` = "has at least one row").
4. **The mission HUD lives inside `StickerBook.js`, in the same overlay as the
   grid.** A second always-on overlay would cost a phone its sky for information
   the child only wants between attempts. The toggle carries a `done/total`
   badge so the button still advertises that there is something inside.
5. **Praise fires only on `firstToday`.** AC-PLAY-404 makes praise on
   re-completion optional ("MAY fire"); firing a fanfare every later tap of the
   same planet would turn the reward into wallpaper. The award-once invariant is
   asserted directly, and a mission re-entering the rotation on a later day still
   praises without a duplicate award.
6. **A second, SILENT `Celebration` pool carries the praise burst.** M3/M4
   deviation 5 reserved `playFanfare` for this moment and refused to stack two
   sounds. Reusing the arrival pool would have played the chime under the
   fanfare; giving the praise pool `sounds: {}` and calling `playFanfare()`
   explicitly keeps one sound AND lets the reward be heard when there is no body
   on screen to sparkle at. Cost: one extra `THREE.Points`, `visible = false`
   whenever at rest (M3/M4 measured an idle pool at 0.000014 ms/frame).
7. **`emitPlayEvent('select')` now runs AFTER `speakBody` in `_select`.** The TTS
   channel keeps only the newest utterance, so emitting first meant the body's
   fact talked over the praise it had just triggered. Nothing else in the
   ordering moved; `unlockAudio()` is still the first statement.
8. **The SizeCompare fact is spoken BEFORE the event is emitted**, for the mirror
   reason: on the one body where opening also completes a mission (`compare-sun`)
   the praise should be what the child hears, and the fact stays on screen in
   display type.
9. **`SizeCompare` and `StickerBook` are constructed directly, not through
   factory options.** Both were briefly injectable; no test needed the seam, so
   the options were deleted in the self-review pass rather than kept as
   speculative generality. `getDate` remains injectable because the midnight
   rollover test needs it.
10. **`index.html` untouched** — see above.

**Residual — owned by M6 (manual / device pass)**

| Check | Why it cannot be asserted in vitest |
|-------|-------------------------------------|
| AC-PLAY-303 audio unlock on real Safari/iOS | `unlockAudio()` now also fires from the 크기 비교 and 로켓 발사 taps; only a real gesture stack proves Safari accepts them |
| AC-PLAY-404 celebration feel | Whether fanfare + praise + burst reads as a reward rather than noise, and whether the praise lands cleanly after the body narration it now supersedes |
| AC-PLAY-403 sticker-book touch UX | Grid tap targets at 320px width, overlay scroll on a short phone, and the toggle sitting beside the planet-list toggle at the smallest viewport |
| AC-PLAY-104 / 205 / 304 reduced-motion sweep | The full sweep across comparison, rocket, celebration and praise on a device with the OS setting on |
| AC-PLAY-101 lineup readability | 109 discs at ~2.4px each on a real phone — the assertion is that the widths are true, not that the dots are legible |
| SPEC-KIDS-001 §8.1 rule 6 | Native-Korean read-aloud pass on the two derived comparison forms and the praise line; emoji rendering of the sticker grid on iOS |
| AC-PLAY-403 localStorage on real Safari | Private browsing / ITP eviction of `solar.play` (the in-memory fallback is unit-tested; the real eviction is not) |

### M6 — Independent evaluation fixes (2026-08-12)

**Verdict: FAIL — gate-blocking, sync blocked.** The evaluation scored four
dimensions (Functionality / Security / Craft / Consistency); the per-dimension
numbers were NOT handed to the fix run, only the verdict and the finding list.
They are deliberately not reproduced here rather than reconstructed from memory —
sync should pull the scores from the evaluation report itself if it needs to cite
them. Two findings were MUST-FIX, one was a quality-gate string defect, four were
SHOULD-FIX and are deferred (below).

Methodology: TDD, reproduction-first. Every fix is preceded by a test that was run
and confirmed failing for the stated reason; each was then re-confirmed by
restoring the pre-fix behaviour and watching the new tests go red again.

**MUST-FIX 1 — the praise celebration fired at the wrong position, or not at all
(REQ-PLAY-404 / AC-PLAY-404, acceptance §2 Scenario 3)**

Root cause: `emitPlayEvent('select', …)` is synchronous, and `_select` assigned
`this._focusedKey = key` four statements AFTER the emit. `_celebratePraise` read
`_focusedKey`, so it always saw the PREVIOUS selection: the first tap of a session
awarded the sticker and spoke the praise with no sparkle at all (`_praise
.activeCount === 0`), and Mars→Jupiter put Jupiter's reward burst on Mars. The
earth branch was worse — it emits and returns before any focus bookkeeping, so it
never had a `_focusedKey` of its own.

Fix: the completing body now travels IN the event
(`_celebratePraise(event.body)`), with `_focusedKey` kept only as the fallback for
bodyless completions (`view-enter`). This covers `select`, `rocket-arrived` and
`size-compare` uniformly, and the earth branch for free, without moving a single
statement of the audio ordering.

Ordering note: M5 deviation 7 put the emit AFTER `speakBody` because the TTS
channel keeps only the newest utterance. That ordering was undefended — a mutation
moving the emit ahead of `speakBody` passed all 568 baseline tests. It now has a
lock ("narrates the body before the praise…"), which fails on exactly that
mutation with Saturn's fact as the last utterance.

Why the suite missed the defect: `SolarSystemView.missions.test.js` pre-selected a
body ("gives the burst somewhere to land") before firing synthetic events, which
propped up every burst assertion; the real-selection test asserted the sticker but
never the burst. Both pre-selects are gone; the burst assertions now stand on
their own and six tests in that file fail if the defect is reintroduced.

**MUST-FIX 2 — the travel-fact table taught inverted distance (honesty NFR,
REQ-PLAY-202 / REQ-PLAY-203 / AC-PLAY-203)**

Root cause: two incompatible trajectory classes in one table. Ceres was sourced
from Dawn — a low-thrust ion-propulsion rendezvous that spirals out to arrive
slowly enough to enter orbit (4 years) — while Jupiter used Voyager 1, a
high-speed flyby (1.5 years). Ceres is 2.77 AU and Jupiter 5.203 AU, so a child
hearing both learned that Ceres is farther away than Jupiter.

Fix: Ceres is re-derived on the table's shared fast-cruise basis — a chemical
Hohmann transfer, a = 1.885 AU, T/2 = 1.29 y — and now reads "세레스까지는 한 해
조금 넘게 날아가야 해요!". The basis itself is stated in the module header
(fast-cruise, direct chemical trajectories; low-thrust ion rendezvous explicitly
excluded), so the table cannot silently drift apart again.

Regression assertion: spoken durations are parsed back out of the Korean the child
hears — not kept in a parallel numeric table, which is exactly how numbers and
words drift — and asserted to rise with `distance` for every body beyond Earth's
orbit. Sunward of Earth the ordering is not asserted, with a documented reason:
travel time there is set by delta-v, not radial distance (Mercury is closer to the
Sun than Venus and takes longer). 해왕성(30.07 AU, 12 y) vs 명왕성(39.48 AU, 10 y)
is a genuine real-mission inversion — Voyager 2's grand tour vs New Horizons'
direct flyby — and is encoded as a one-entry exception list, with a second test
asserting each listed pair really still inverts so a stale exception cannot mask a
future defect. The old test only checked that a `참고:` comment existed.

**Quality gate — Korean particle error in rocket aria-labels (SPEC-KIDS-001 §8.1,
acceptance §4)**

`playRocketLabel` interpolated `${name}으로`, and 으로/로 selection depends on the
final consonant (ㄹ excepted), so VoiceOver/TalkBack read five of the thirteen
destinations ungrammatically: 달으로, 세레스으로, 하우메아으로, 마케마케으로,
에리스으로. It is now particle-free (`${name} 로켓 발사하기`), matching the rule the
module already states for its comparison forms; no particle-selection logic was
added, since avoiding it is the module's whole convention.

Coverage hole closed: acceptance §4 puts ALL Korean strings under the §8.1
checklist, but the machine checks covered only mission `promptKo`,
`TRAVEL_FACTS_KO` and the derived comparison sentences. Every `STR.play*` chrome
and aria string is now checked for length, English, 해요체 (spoken strings only —
해요체 would be wrong for a button label like 닫기), and for any
final-consonant-sensitive particle glued onto an interpolated body name.

**Deferred SHOULD-FIX — recorded, code deliberately untouched**

These are not gate blockers, and fixing them here would have widened the diff past
what the gate requires. They are carried into sync as known follow-ups.

| Id | Finding | Measured evidence | What a fix would touch |
|----|---------|-------------------|------------------------|
| S1 | The count strip can overflow the lane its own comment says it spans | `SizeCompare.js:9-12` states that laying `count` unit discs side by side spans the big disc, which is only true before `count` is rounded to the nearest half at `:62`. Earth/Mars ratio is 1.878 and rounds to 2, so the row draws 2 discs of 260/1.878 = 138.4px = **276.9px inside a 260px lane** (~6.5% overflow) | Either size the discs from `count` (`LANE_WIDTH_PX / count`) so the row is true to the spoken number, or scale the lane; then correct the header comment. Needs the visual check below, since the overlay is `max-width: 340px` with 24px padding |
| S3 | Bodies whose ratio leaves the countability budget get an overlay with no lineup at all | `MAX_COUNT = 120` drops 베텔게우스 (886 suns) and 스티븐슨 2-18 (2146 suns); the ±10% nearest-half tolerance separately drops 시리우스 A (1.71 suns). Three of the four stars therefore produce **0 comparison rows**, while the 크기 비교 entry point still opens | A non-count representation for ratios outside the countable band (a single scaled pair plus the authored 배 fact), or hiding the entry point when `comparisonRows()` is empty. The drop itself is correct — the rows would be lies — so this is a presentation gap, not a data fix |
| S4 | Reduced-motion is read once at boot, not live | `_buildPlayLayer()` calls `_prefersReducedMotion()` once and passes the boolean into both `Celebration` pools, `RocketJourney` and `SizeCompare`. No `matchMedia` change listener exists, so toggling the OS setting mid-session changes nothing until reload | A `change` subscription on the media query fanning out to the four holders, each needing a setter. Cost is four new mutable seams; the boot-time read is correct for the overwhelmingly common case |
| S5 | A second, silent `Celebration` pool exists solely for praise | `this._praise = new Celebration({ scene, reducedMotion, sounds: {} })` — a second `THREE.Points` with the full `POOL_SIZE = 160` buffers. M3/M4 measured an idle pool at 0.000014 ms/frame and it stays `visible = false` at rest | Merging the pools requires per-burst sound selection instead of per-pool (`burst(position, variant, radius, { silent: true })`). Deliberate per M5 deviation 6: the praise must be heard via `playFanfare()` even with no body on screen, and stacking the arrival chime under the fanfare was rejected |

**Residual manual / device checks — expanded by the evaluation**

These join the M5 residual table above; none are assertable in vitest.

| Check | Why it needs a human or a device |
|-------|----------------------------------|
| S1 Mars strip overflow, visual | Whether 276.9px of discs inside a 260px lane actually clips, wraps or merely crowds depends on the overlay's real CSS box at 320–340px width — a screenshot question, not a unit-test one |
| Celebration cost on the GPU side | The pool arithmetic is measured, but the draw-call and fill cost of two `THREE.Points` objects during an overlapping arrival + praise burst has only been reasoned about, never profiled on a phone GPU |
| Native-Korean read-aloud pass on the five fixed aria-labels | 달 / 세레스 / 하우메아 / 마케마케 / 에리스 with `playRocketLabel` under a real VoiceOver and TalkBack voice — the particle rule is now enforced mechanically, but §8.1 rule 6 asks for an ear, and "달 로켓 발사하기" should be confirmed to read naturally without the particle |

**Verification**

| Gate | Result |
|------|--------|
| `npm test` | 42 files / **580 tests passed** — baseline was 42 files / 568, so +12 tests and zero regressions |
| `npm run build` | succeeds (`✓ built in 755ms`; the >500 kB chunk warning is pre-existing) |
| Files touched | `SolarSystemView.js`, `travelFacts.js`, `strings.js` and their three test files — S1/S3/S4/S5 code (`SizeCompare.js`, `Celebration.js`, `_buildPlayLayer`, `PlanetStrip.js`) untouched |
| Commit | `b9fa3f4` fix(SPEC-PLAY-001): celebrate at the completing body and correct the Ceres travel fact |

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
