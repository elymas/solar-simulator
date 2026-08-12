# Progress — SPEC-KIDS-001

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-12T01:21:04Z
- plan_status: audit-ready

## §E.2 Run-phase Evidence

- Run started: 2026-08-12 (session caf91635)
- Worktree: `solar-kids` on `feat/spec-kids-001`; fast-forwarded b387cc7 -> e6fdbb3 to pull in the EPIC-KIDS SPEC set, then `npm install` (worktree had no node_modules).
- Baseline before implementation: `npm test` 24 files / 197 tests pass.
- Harness level: standard (multi-domain feature; no security/payment/auth keywords). Evaluator runs final-pass only (Phase 2.8a); no sprint contract.
- Development mode: tdd. Execution mode: sub-agent (manager-tdd, sequential) — team mode declined despite meeting the domain/file thresholds because M2->M3->M4->M5 form a dependency chain and InfoPanel.js / strings.js are edited by multiple milestones.
- Phase 1 (strategy): skipped by user decision — plan.md (plan-audited PASS 0.95-0.96) used verbatim as the execution plan.
- Phase 1.5 complete: tasks.md written, T-001..T-006 mapped from plan.md §C milestones; drift baseline 5 new + 12 modified files.

### Phase 2 (TDD implementation)

- T-002 complete: `src/audio/tts.js` + `src/audio/tts.test.js`, 22/22 pass. Notable decisions — `cancel()` fires only when `synth.speaking || synth.pending`, because iOS Safari drops an incoming utterance when cancel runs against an idle engine; a single parked slot (`heldText`), not a queue, holds one narration while the voice list is still empty, so rapid taps cannot stack speech; with zero ko-* voices the utterance still carries `lang='ko-KR'` per plan.md §F.
- T-001 complete: `src/planets/planetData.facts.test.js` (new) + `src/planets/planetData.js` (additive data only). All 29 REQ-KIDS-301 bodies carry `factsKo` (3), `sizeComparisonKo`, `emoji`. Seed 6 from spec.md §8.2 used verbatim. `test/__snapshots__/planetData.test.js.snap` regenerated as a consequence of the added fields.
- T-004 complete: `src/ui/PlanetList.js`, `index.html`, `src/ui/TimeControls.js`. The `.planet-item-name-ko { display: none !important; }` rule is deleted — grep for `planet-item-name-ko` in index.html returns 0 hits (AC-KIDS-102). Mute toggle labelled 소리 (not 말소리) so it stays accurate when SPEC-PLAY-001 routes SFX through it; `aria-label` states the action ("소리 켜기" while muted), not the state.
- Suite after T-001/T-002/T-004: 26 files / 250 tests pass, up from the 24 / 197 baseline. Verified by running `npm test`, not inferred.
- T-003 and T-005a dispatched in parallel under strict file ownership: T-003 owns InfoPanel.js + one selection hook; T-005a owns strings.js, LoadingScreen, PlanetList, TimeControls, EarthHUD, eclipseData, index.html. InfoPanel label centralisation is deferred to a T-005b mop-up so the two agents never share a file.
- T-003 complete: kid-first InfoPanel + 🔊 replay + "자세히 보기" expander. Selection hook chosen was `SolarSystemView._select()` rather than either of the two candidates named in plan.md §D — both the 3D tap and the planet-list click funnel through it, so one hook covers both callers instead of two. `_deselect()` cancels speech. Counted as intent-equivalent, not scope drift.
- T-005a complete: `src/ui/strings.js` + `strings.test.js`, chrome sweep across LoadingScreen / PlanetList / TimeControls / EarthHUD / eclipseData, Korean unit and date formatters, and the index.html font stack (`'Inter', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif`; no webfont added — SPEC-PWA-001 owns delivery). The SPEC-EARTH-002 REQ-480/490 empty-sky-vs-error distinction survives translation as two separate keys (`earthFlightLiveEmpty` vs `earthFlightOffline`).
- T-005b complete: InfoPanel labels routed through `STR.info*`, values through the Korean unit formatter, and the hardcoded `d/s` rotation-speed suffix in EarthHUD replaced.

### Phase 2.5 / T-006 — verification evidence (observed, not inferred)

- `npm test`: 27 files / 274 tests pass (baseline 24 / 197).
- `npm run build`: succeeds. The >500 kB chunk warning is the pre-existing three.js bundle, not a regression from this SPEC.
- AC-KIDS-102 grep gate: `planet-item-name-ko` in index.html returns 0 hits.
- AC-KIDS-103 grep gate: no English chrome literals remain in `src/ui/` or `src/earth/`. The residual "Diameter" matches are the `STR.infoDiameter` identifier and its Korean value `'지름'`, not user-facing text.
- Real-browser check (headed Chromium against the vite dev server, since jsdom cannot prove the Three.js app boots):
  - Planet list renders Korean-primary — first item reads 화성 / Mars, title 태양계, dividers 왜소행성 / 별. The `.planet-item-name-ko` computed display is `block`, confirming AC-KIDS-102 outside of grep.
  - Computed body font-family carries the Korean fallback chain; Hangul renders as glyphs, not tofu.
  - Kid view for 화성 shows emoji 🔴, `nameKo` primary with `Mars` secondary, the 3 seed facts verbatim, and the size comparison. Fact nodes compute to 19px, above the 18px floor of REQ-KIDS-302.
  - AC-KIDS-303 confirmed live: the scientific table is absent before clicking "자세히 보기", present after, and the panel stays open. Table labels and units render Korean ("공전 시간 / 1.88년", "한 바퀴 도는 시간 / 1.0일").
  - Console clean — only vite HMR debug lines, no errors.
  - Both 🔊 buttons carry codepoint U+1F50A with Korean aria-labels ("다시 듣기", "소리 끄기").

### Manual ACs still open (NOT claimed as verified)

- Real speech audio, ko-KR voice quality, and the iOS Safari first-tap gesture path — unverifiable in jsdom or headless Chromium; requires an iPhone-class device.
- Emoji glyph appearance on iOS (spec.md §8.1 review-checklist item 6). The test Chromium renders the speaker emoji with a monochrome fallback glyph; the codepoint is correct, so this is a font matter for device check, not a code defect.
- Native-Korean read-aloud pass over the full facts dataset (spec.md §8.1 checklist).
- Mobile viewport visual check at 375px width (AC-KIDS-102 second clause). SPEC-MOBILE-001 owns tap-target sizing for the new buttons.

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_
