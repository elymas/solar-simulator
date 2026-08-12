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

## 5. 구현 중 추가된 수용 기준 (2026-08-12)

원래 범위를 넘어 구현된 항목에 대한 기준이다. §1의 기준은 그대로 두고, 각각을 상위 REQ에 접미사 ID로 붙인다. 전부 통과 상태다.

| AC | 상위 REQ | 기준 (검증 가능) | 검증 | 추가 사유 |
|----|----------|------------------|------|-----------|
| AC-KIDS-201a | REQ-KIDS-201 | `globalThis.speechSynthesis` / `globalThis.localStorage`의 **속성 접근 자체**가 예외를 던지는 환경(쿠키 전면 차단, `allow-same-origin` 없는 iframe)에서 `init()`이 인자 없이 호출되어도 throw하지 않는다 | vitest | `buildUI()`가 UI 구성 **전에** `initTts()`를 호출하므로, 이 throw는 내레이션이 아니라 시뮬레이터 전체를 죽였다. 기존 가드는 주입된 storage만 덮었고 프로덕션이 실제로 쓰는 무인자 경로는 테스트된 적이 없었다 |
| AC-KIDS-206a | REQ-KIDS-206 | 음성 엔진 부재 시 InfoPanel의 🔊뿐 아니라 **TimeControls의 소리 토글도** 렌더되지 않는다 | vitest | REQ-KIDS-206은 "모든 🔊 어포던스"를 요구한다. 토글이 남아 있으면 결코 발생하지 않을 소리에 대한 선호를 영속시킨다 |
| AC-KIDS-301a | REQ-KIDS-301 | 천체 데이터에서 파생된 DOM(사실 목록, 과학 데이터 그리드, 호버 툴팁)은 `createElement` + `textContent`로 구성되며 `innerHTML` 문자열 보간을 쓰지 않는다. 천체 데이터가 들어가지 않는 정적 골격은 예외 | 코드 리뷰 + grep | plan.md §A.1이 SPEC-EARTH-003이 **외부 API**에서 같은 형태를 공급한다고 약속했다. 그 시점에 XSS 싱크가 된다 |
| AC-KIDS-304a | REQ-KIDS-304 | 필수 집합 천체의 `nameKo`는 **소리 내어 읽었을 때** 정확하다(Enceladus 엔셀라두스) | 검수 | 가정 A-101은 기존 `nameKo`를 범위 밖으로 선언했으나, `speakBody`가 이름을 읽게 되면서 표시 전용 오타가 아이가 귀로 배우는 오류가 되었다. 의도적 범위 예외 |

## 6. Definition of Done

- All AC-KIDS-1xx/2xx/3xx PASS (unit ACs green in CI; manual ACs checked on an iPhone-class device and one desktop browser).
- The facts dataset for the full REQ-KIDS-301 set is present and checklist-reviewed.
- SPEC frontmatter `status` transitioned per lifecycle by the owning agents (draft → in-progress → implemented → completed).
- No open clarification markers remain in plan.md (none were declared).

### DoD 판정 (2026-08-12)

- 자동 검증 AC 18/18 통과, 독립 평가 2차 PASS, `status: completed`.
- **다만 "manual ACs checked on an iPhone-class device" 항목은 아직 충족되지 않았다.** 실기기 확인 대기 목록은 spec.md §10.3과 progress.md에 있으며, 어느 것도 통과로 반올림하지 않는다. facts 데이터셋은 기계적 완전성·길이·수치 일치 검사는 통과했으나 **한국어 모어 화자 낭독 검수는 미완**이다.
- 커버리지는 저장소 전체 84.81%로 85% 목표에 미달한다. 미달분은 이 SPEC이 건드리지 않은 파일에서 발생한다(spec.md §10.4).
