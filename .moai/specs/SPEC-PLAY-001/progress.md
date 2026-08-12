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

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
