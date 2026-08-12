# Implementation Plan — SPEC-KIDS-001

Sections are ordered by decision-reversibility: the decisions most likely to change under review come first; mechanical steps come last.

## A. Key Decisions (highest change-likelihood first)

### A.1 Kid-facts data shape (cross-SPEC contract — review this first)

`factsKo: string[3]`, `sizeComparisonKo: string`, `emoji: string` added directly onto each body object in `src/planets/planetData.js` (no separate facts file). Rationale: bodies already carry `name`/`nameKo`; co-locating avoids a parallel registry that can drift. SPEC-EVENTS-001 (comet, belt info entries) and SPEC-EARTH-003 (ISS) will supply objects of the SAME shape — the InfoPanel and TTS consume the shape, not the file. Changing this shape after EVENTS/EARTH-003/PLAY land is expensive; it is the first thing to challenge in review.

### A.2 TTS module API (cross-SPEC contract)

`src/audio/tts.js` exposing: `init({ synth })` (injectable backend; defaults to `window.speechSynthesis`), `speakBody(body)` (name + one rotating fact), `speak(text)` (raw, for cross-SPEC callouts), `cancel()`, `setMuted(bool)` / `isMuted()`, `isAvailable()`. Voice resolution: subscribe `voiceschanged` once, pick first `ko-KR` voice by a deterministic preference list. Mute persisted under one namespaced key (`solar.muted`). Consumers in later SPECs call `speak()` only — they inherit mute/cancel/availability behavior for free.

- iOS gesture rule: `speakBody` is only ever invoked from selection/tap handlers (a user-gesture call stack), satisfying A-104. No autoplay narration anywhere.
- Fact rotation: cycle index per body so repeated taps read different facts (kid replayability), stored in module memory (not persisted — reset per session is fine).

### A.3 Kid-first InfoPanel layout (user-facing flow)

Panel order: big `nameKo` + emoji → English name small → `factsKo` list (large type) → `sizeComparisonKo` → 🔊 replay → "자세히 보기" expander → existing scientific table (unchanged markup inside). The expander is a plain `<button>` + hidden section (no new dependency). Bodies without facts (minor moons) skip straight to the expander, which is then expanded by default for them.

### A.4 UI strings module

`src/ui/strings.js` exporting a flat `STR` constant object (Korean-first values, English tucked into specific secondary slots where kept). Components replace literals with `STR.*`. This makes the K1 sweep reviewable in one file and unit-testable for completeness. NOT an i18n framework (no locale switching) — see spec exclusions.

### A.5 Font stack

Extend `index.html` body font-family to: `'Inter', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif` (and the monospace stack gains a Korean-capable fallback tail). No new font download in this SPEC (A-102); PWA-001 owns webfont delivery.

### A.6 Facts authoring path

Seed set (6 bodies) is fixed in spec.md §8.2; the remaining ~23 bodies are authored during run phase against §8.1 criteria, then gated by the AC review checklist + the mechanical completeness test (REQ-KIDS-305). This keeps content honest without freezing ~90 sentences before the tone anchor is validated in the real panel.

## B. Trade-off Notes (alternatives considered)

| Decision | Chosen | Rejected alternatives | Why |
|----------|--------|-----------------------|-----|
| Facts storage | Fields on body objects in planetData.js | Separate `factsKo.js` registry keyed by body key | Parallel registry drifts when bodies are added (EVENTS-001 adds a comet); co-location makes the completeness test trivial |
| TTS testability | Injectable synth backend + pure state logic | Mock `window` globals in tests | Injection keeps tests synchronous and engine-free; window-global mocking is brittle under jsdom |
| Speech content | Name + 1 rotating fact per tap | Read all 3 facts every time | 3 facts ≈ 15+ s of speech; a 5-year-old taps faster than that. Rotation gives freshness with cancel-on-new-selection |
| Chrome translation | Central strings module | In-place literal replacement per component | One reviewable surface; enables a strings completeness test; later SPECs add strings to one place |
| Korean font | System-font fallback chain | Bundle Noto Sans KR now | Hangul system fonts on iOS/macOS/Windows are excellent; bundling is a payload/PWA decision deferred to SPEC-PWA-001 |
| Mute persistence | `localStorage` single key | In-memory only | The mute choice is a parent-level setting; losing it on reload would frustrate |

## C. Milestones (phase ordering; priority labels — no time estimates)

| M | Scope | Priority |
|---|-------|----------|
| M1 | Facts data fields for required set (seed 6 verbatim + remaining bodies per §8.1) + completeness unit test (RED first: test the required-set contract, watch it fail, then fill data) | High |
| M2 | TTS wrapper module + unit tests (voice resolution incl. deferred `voiceschanged`, cancel-before-speak, mute persistence round-trip, unavailable no-op) | High |
| M3 | InfoPanel kid-first layout + 🔊 replay + "자세히 보기" expander + selection→speech wiring (`speakBody` on select, cancel on deselect/switch) | High |
| M4 | Korean-primary labels in PlanetList + tooltip; DELETE `index.html:87-89`; global mute toggle button | Medium |
| M5 | Chrome sweep via strings module: loading screen, list title/dividers, InfoPanel labels/units, TimeControls (labels + Korean date form), EarthHUD (incl. flight states), eclipse Korean rewrite; font stack extension | Medium |
| M6 | Regression pass: full vitest suite, `npm run build`, manual iOS Safari smoke (first-tap speech, voiceschanged race, mute persistence) | High |

## D. File-Touch List

**New**
- `src/audio/tts.js` (+ `src/audio/tts.test.js`)
- `src/ui/strings.js` (+ `src/ui/strings.test.js` — completeness/shape assertions)
- `src/planets/planetData.facts.test.js` (completeness test per REQ-KIDS-305; name final at run phase)

**Modified**
- `src/planets/planetData.js` (data fields only)
- `src/ui/InfoPanel.js` (+ existing `src/ui/InfoPanel.test.js` extended)
- `src/ui/PlanetList.js`
- `src/ui/TimeControls.js` (labels, date format, mute toggle placement)
- `src/earth/EarthHUD.js` (labels/buttons/flight states via strings module)
- `src/utils/eclipseData.js` (Korean rewrite of type info + diagram intro)
- `index.html` (delete lines 87-89; font stack; loading text)
- `src/controls/InteractionManager.js` or the selection callback site in `src/main.js` — wiring `speakBody` into the existing `onSelect` path (smallest hook wins; decided at run phase)

## E. Test Strategy (TDD)

- **Pure targets (vitest, jsdom)**: TTS wrapper (fake synth: assert cancel-before-speak ordering, ko-KR pick, deferred voice load resolution, mute gating, no-throw when synth undefined), facts completeness (REQ-KIDS-305), strings module shape, date/unit Korean formatters.
- **Characterization**: extend `src/ui/InfoPanel.test.js` for kid-view DOM (Korean name first, facts count, expander collapsed default, 🔊 hidden when TTS unavailable).
- **Manual/device**: actual speech audio, iOS first-tap gesture rule, voice quality — physically unverifiable in jsdom; listed as manual AC.

## F. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| iOS returns zero `ko-KR` voices (non-Korean device locale) | Fall back to default voice with `lang='ko-KR'` on the utterance; utterance lang hint alone yields acceptable Korean on iOS. Never block UI |
| `voiceschanged` never fires (some browsers fire only on demand) | Also call `getVoices()` lazily at first `speak`; resolve whichever path wins |
| Korean strings overflow fixed-width UI (sidebar min-width 130px mobile) | Korean names are typically SHORTER than English; spot-check longest labels ("왜소행성"); sidebar sizing itself is revised by SPEC-MOBILE-001 anyway |
| Facts factual errors | §8.1 criteria + review checklist AC + numeric-consistency spot test against data fields |
| EarthHUD translation touches strings SPEC-EARTH-002 tests may assert | Run existing suite in M5; adjust characterization tests alongside string changes in the same commit |

## G. Cross-SPEC Notes

- SPEC-PLAY-001 shares the mute toggle: `setMuted` gates BOTH speech (here) and SFX (PLAY). The toggle is labeled "소리" (sound), not "말소리" (speech), to stay accurate once SFX lands.
- SPEC-MOBILE-001 owns tap-target sizes for the new 🔊/mute buttons; this SPEC places them, MOBILE-001's ≥44px rule governs their final hit area.
- SPEC-EVENTS-001 / SPEC-EARTH-003 route event callouts through `speak()`; they must NOT construct their own utterances.

No open clarification markers — all decisions above are resolved with stated defaults.
