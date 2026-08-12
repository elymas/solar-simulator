## Task Decomposition

SPEC: SPEC-KIDS-001
Source: plan.md §C milestones (M1–M6) and §D file-touch list. No re-strategy was run —
plan.md was plan-audited (PASS 0.95–0.96) and is used verbatim as the execution plan.
Development mode: tdd (RED-GREEN-REFACTOR). Harness level: standard. Execution: sub-agent (manager-tdd, sequential).

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | Kid-facts data: add `factsKo` (3), `sizeComparisonKo`, `emoji` to the REQ-KIDS-301 required set (sun + 8 planets + 5 dwarfs + 11 enumerated moons + 4 stars). RED first: write the completeness test against the required-set contract, watch it fail, then fill data. Seed 6 bodies verbatim from spec.md §8.2; author the rest against §8.1 criteria. | REQ-KIDS-301, 304, 305 | - | src/planets/planetData.facts.test.js (new), src/planets/planetData.js | pending |
| T-002 | TTS wrapper `src/audio/tts.js`: `init({ synth })`, `speakBody(body)`, `speak(text)`, `cancel()`, `setMuted`/`isMuted`, `isAvailable()`. Deferred `voiceschanged` voice binding + lazy `getVoices()` fallback, deterministic ko-KR pick, cancel-before-speak ordering, mute persisted under `solar.muted`, no-throw when synth is undefined. Tests use an injected fake synth (no browser globals). | REQ-KIDS-201, 203, 205, 206, 207, 208 | - | src/audio/tts.js (new), src/audio/tts.test.js (new) | pending |
| T-003 | InfoPanel kid-first layout: big `nameKo` + emoji, English secondary, `factsKo` list at >=18px, `sizeComparisonKo`, 🔊 replay button, "자세히 보기" expander (collapsed by default; expanded by default for fact-less bodies) wrapping the existing scientific table. Wire selection -> `speakBody` at the smallest existing hook (InteractionManager or the main.js onSelect site) with cancel on switch. | REQ-KIDS-202, 204, 302, 303 | T-001, T-002 | src/ui/InfoPanel.js, src/ui/InfoPanel.test.js, src/controls/InteractionManager.js or src/main.js | pending |
| T-004 | Korean-primary labels in PlanetList items and hover tooltip; DELETE the `.planet-item-name-ko { display: none !important; }` rule at index.html:87-89; add the global 소리 mute toggle button in the TimeControls bar with Korean `aria-label`. | REQ-KIDS-101, 102, 207 | T-002 | src/ui/PlanetList.js, index.html, src/ui/TimeControls.js | pending |
| T-005 | Chrome sweep via new `src/ui/strings.js` (flat Korean-first `STR` object, not an i18n framework): loading screen, list title/dividers, InfoPanel labels + Korean unit words, TimeControls labels + "YYYY년 M월 D일" date form, EarthHUD labels/buttons/flight states (LIVE/LOADING/OFFLINE/RATE_LIMITED, empty-sky vs error), eclipse type info + diagram intro rewritten in age-appropriate Korean. Extend the index.html font stack with Korean-capable fallbacks. Adjust existing characterization tests that assert English strings in the same commit. | REQ-KIDS-103, 104, 105 | T-003, T-004 | src/ui/strings.js (new), src/ui/strings.test.js (new), src/ui/LoadingScreen.js, src/ui/PlanetList.js, src/ui/InfoPanel.js, src/ui/TimeControls.js, src/earth/EarthHUD.js, src/utils/eclipseData.js, index.html, test/earthHud.test.js, test/eclipseData.test.js, test/timeControls.test.js, test/ui.test.js | pending |
| T-006 | Regression pass: full `npm test` green (baseline 24 files / 197 tests), `npm run build` succeeds, AC-KIDS-103 grep gates (no "Solar System"/"Dwarf Planets"/"Stars"/"Speed"/"Date"/"Diameter"/"Orbital Period" as primary chrome literals; no `planet-item-name-ko` hiding rule). Device-only ACs (real speech audio, iOS first-tap gesture, voice quality) recorded as manual-pending, not claimed as verified. | Quality gate, AC-KIDS-102/103/305 | T-001..T-005 | (verification only) | pending |

### Drift Guard Baseline

- planned_new_files: 5 (`src/audio/tts.js`, `src/audio/tts.test.js`, `src/ui/strings.js`, `src/ui/strings.test.js`, `src/planets/planetData.facts.test.js`)
- planned_modified_files: 12
- drift = unplanned_new_files / 17 * 100; warn above 20%, re-planning gate above 30%
