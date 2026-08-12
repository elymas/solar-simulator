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

---

## H. 실행 기록 (as-built, 2026-08-12)

§A~§G는 계획 시점의 기록으로 보존한다. 이 절은 **실제로 밟은 단계**를 남긴다. 계약과 차이의 정본은 spec.md §10이며, 여기서는 계획 문서 자체에 대한 차이만 다룬다.

### H.1 마일스톤 → 태스크 실행 순서

| 계획 (§C) | 실행 태스크 | 실제 순서 |
|-----------|-------------|-----------|
| M2 (TTS 래퍼) | T-002 | 1번째. 22/22 테스트 통과 |
| M1 (facts 데이터) | T-001 | 2번째. 필수 29개 천체 전부 충족 |
| M4 (한국어 우선 라벨 + CSS 삭제 + 음소거 토글) | T-004 | 3번째 |
| M3 (InfoPanel) / M5 (chrome 일괄 번역) | T-003 / T-005a | 4번째, **병렬**. 파일 소유권 분리 |
| M5 잔여 | T-005b | 5번째. InfoPanel 라벨을 `STR`로 이관 |
| M6 (회귀) | T-006 | 6번째 |

§C의 M1→M2 순서와 달리 **T-002(TTS)를 먼저** 실행했다. T-003이 두 산출물 모두에 의존하므로 어느 쪽을 먼저 하든 무방했고, 계약 표면(TTS API)을 먼저 고정하는 편이 이후 판단을 단순하게 만들었다.

T-003과 T-005a는 병렬로 돌리되 `InfoPanel.js`를 T-003이 단독 소유하도록 묶고, 라벨 이관은 T-005b로 미뤄 **두 에이전트가 같은 파일을 만지지 않게** 했다.

### H.2 §D 파일 목록과의 차이

- `src/controls/InteractionManager.js` **또는** `src/main.js` 중 하나에 훅을 건다고 적었으나, 실제 훅 위치는 `src/views/SolarSystemView.js:161`의 `_select()`다. 3D 탭과 목록 클릭이 모두 이 지점으로 모인다 — 두 개 대신 하나로 끝난다.
- 그럼에도 `src/controls/InteractionManager.js`는 **결국 수정되었다.** 훅 때문이 아니라 호버 툴팁이 영어 우선이었기 때문이다. REQ-KIDS-101이 지정한 세 표면 중 세 번째이며, 계획 단계에서 툴팁을 §D 어디에도 적지 않은 것이 누락의 출발점이었다.
- `src/planets/planetData.js`는 계획상 "데이터 추가만"이었으나, 기존 `nameKo` 한 건(Enceladus)을 수정했다. 사유는 spec.md §10.2 3번.

### H.3 계획이 예측하지 못한 것 — 회고

계획은 **읽히는 텍스트**와 **들리는 텍스트**를 구분하지 않았다. `nameKo`가 화면에 뜨기만 할 때와 소리로 재생될 때는 정확성 기준이 다르다는 사실이 가정 A-101을 무너뜨렸다. TTS를 추가하는 후속 SPEC은 자신이 읽어주게 될 기존 문자열 데이터를 "이미 검수된 것"으로 전제하지 말 것.
