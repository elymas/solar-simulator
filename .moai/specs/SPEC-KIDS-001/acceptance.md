# Acceptance Criteria — SPEC-KIDS-001

## 1. AC Matrix (1:1 with REQs)

| AC | REQ | Criterion (testable) | Verification |
|----|-----|----------------------|--------------|
| AC-KIDS-101 | REQ-KIDS-101 | PlanetList item, InfoPanel header, and tooltip render `nameKo` first and visually dominant (DOM order + computed font-size strictly greater than the English secondary) | vitest (jsdom DOM assertions) |
| AC-KIDS-102 | REQ-KIDS-102 | `index.html` contains no rule hiding `.planet-item-name-ko` (grep = 0 matches for `planet-item-name-ko` inside a `display: none` block); Korean names visible at 375px-wide viewport | grep + manual mobile viewport check |
| AC-KIDS-103 | REQ-KIDS-103 | Loading screen, list title/dividers, InfoPanel labels+units, TimeControls labels, EarthHUD labels/buttons/flight states source from the strings module and are Korean-first; zero English-primary chrome literals remain in those components (grep audit for the enumerated legacy strings: "Solar System", "Dwarf Planets", "Stars", "Speed", "Date", "Diameter", "Orbital Period") | vitest + grep audit |
| AC-KIDS-104 | REQ-KIDS-104 | Eclipse type labels/descriptions render Korean; each description passes the §8.1 read-aloud + truth checklist | vitest (string presence) + review checklist |
| AC-KIDS-105 | REQ-KIDS-105 | Unit formatter returns "1.88년"-style values; TimeControls date shows "YYYY년 M월 D일"; body font-family computed style includes a Korean-capable family | vitest (formatter) + manual |
| AC-KIDS-201 | REQ-KIDS-201 | TTS wrapper instantiates with an injected fake synth; all public methods callable with zero browser globals | vitest |
| AC-KIDS-202 | REQ-KIDS-202 | Selecting a body triggers exactly one `synth.speak` whose utterance text starts with `nameKo` and contains one `factsKo` entry, `lang === 'ko-KR'` | vitest (fake synth call log) |
| AC-KIDS-203 | REQ-KIDS-203 | Second selection while speaking → `cancel` observed before the next `speak` in the fake-synth call order | vitest (call-order assertion) |
| AC-KIDS-204 | REQ-KIDS-204 | InfoPanel renders 🔊 button; activating it re-invokes narration for the current body | vitest (jsdom) |
| AC-KIDS-205 | REQ-KIDS-205 | With a fake synth that returns `[]` until a simulated `voiceschanged`, the first `speak` still lands with a `ko-KR` voice after the event | vitest (async fake) |
| AC-KIDS-206 | REQ-KIDS-206 | With `synth = undefined`: no throw on any API call; InfoPanel renders no 🔊 button; `isAvailable() === false` | vitest |
| AC-KIDS-207 | REQ-KIDS-207 | `setMuted(true)` → `localStorage` key written; fresh module init with that storage → `isMuted() === true` (round-trip) | vitest |
| AC-KIDS-208 | REQ-KIDS-208 | While muted, `speakBody`/`speak` produce zero `synth.speak` calls | vitest |
| AC-KIDS-301 | REQ-KIDS-301 | Required-set bodies (sun, 8 planets, 5 dwarfs, 11 enumerated moons, 4 stars) each expose `factsKo` (3 non-empty), `sizeComparisonKo`, `emoji` | vitest (completeness test) |
| AC-KIDS-302 | REQ-KIDS-302 | Kid view DOM: Korean name node first, emoji present, fact nodes ≥3 with computed font-size ≥18px, 🔊 present | vitest (jsdom) + manual visual |
| AC-KIDS-303 | REQ-KIDS-303 | Scientific table hidden on open (expander collapsed); clicking "자세히 보기" reveals it; panel stays open | vitest (jsdom) |
| AC-KIDS-304 | REQ-KIDS-304 | Review checklist executed over the full dataset: length ≤45 chars, 해요체, no fear content, numeric claims within ±10% of data-field-derived values (spot-checked programmatically where derivable: size ratios) | checklist + vitest spot checks |
| AC-KIDS-305 | REQ-KIDS-305 | The completeness test exists, runs in `npm run test`, and FAILS if any required body loses a field (verified by temporary mutation during review) | vitest (meta-verified) |

## 2. Given-When-Then Scenarios

### Scenario 1 — First tap speaks Korean (iOS voice race)
- **Given** a fresh page load where the synth voice list is empty until `voiceschanged` fires 500ms later
- **When** the child taps 화성 (Mars) in the 3D scene before that event fires
- **Then** the InfoPanel opens with "화성" as the big primary label, and one utterance is spoken in a ko-KR voice ("화성" + one fact) as soon as voices resolve — with no error and no permanently lost narration.

### Scenario 2 — Rapid re-selection cancels cleanly
- **Given** narration for 목성 is mid-utterance
- **When** the child taps 토성
- **Then** the 목성 utterance is cancelled before the 토성 utterance starts (fake-synth call order: `cancel` → `speak`), and the InfoPanel shows 토성's kid view.

### Scenario 3 — Muted household
- **Given** a parent enabled mute yesterday (persisted key present)
- **When** the app boots and the child selects any body
- **Then** no utterance starts, the 🔊 button renders in its muted-consistent state, and unmuting restores narration on the next selection.

### Scenario 4 — No speech engine
- **Given** a browser without `speechSynthesis`
- **When** any body is selected
- **Then** the kid view renders fully (facts readable), no 🔊 button appears, and no exception reaches the console.

## 3. Edge Cases

- Body without facts (non-enumerated minor moon): kid view renders name+emoji-less gracefully, expander opens by default; `speakBody` speaks name only.
- Utterance `onerror` (engine hiccup): swallowed; subsequent narrations unaffected.
- `localStorage` unavailable (private mode quota): mute defaults to OFF in-memory; no throw.
- Very long Korean fact (authoring violation): completeness test enforces ≤45 chars, failing CI rather than overflowing UI.
- Rapid 10-tap sequence: exactly one live utterance at any moment (cancel-before-speak), no queue growth.
- English-secondary display for stars whose `nameKo` equals the English name: no duplicate-looking double label (render secondary only when it differs).

## 4. Quality Gate Criteria

- All new pure modules (tts, strings, formatters, facts completeness) covered by vitest; suite green via `npm run test`.
- `npm run build` succeeds (vite).
- No regression in existing tests (`src/ui/InfoPanel.test.js`, `src/utils/performance.test.js`).
- Grep gates: `planet-item-name-ko` hiding rule absent; legacy English chrome literals absent from the enumerated component list (AC-KIDS-103).
- TRUST 5: Tested (above), Readable (strings centralized, English code comments), Unified (existing style), Secured (no new external input; localStorage values parsed defensively), Trackable (conventional commits per milestone referencing SPEC-KIDS-001).

## 5. Definition of Done

- All AC-KIDS-1xx/2xx/3xx PASS (unit ACs green in CI; manual ACs checked on an iPhone-class device and one desktop browser).
- The facts dataset for the full REQ-KIDS-301 set is present and checklist-reviewed.
- SPEC frontmatter `status` transitioned per lifecycle by the owning agents (draft → in-progress → implemented → completed).
- No open clarification markers remain in plan.md (none were declared).
