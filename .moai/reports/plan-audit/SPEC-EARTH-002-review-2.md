# SPEC Review Report: SPEC-EARTH-002
Iteration: 2/3
Verdict: PASS
Overall Score: 0.91

Reasoning context ignored per M1 Context Isolation. Orchestrator process rulings applied: (1) frontmatter `created`/`updated`/`tags` naming waived, (2) tens-block REQ numbering with 5-step insertions waived, (3) Given/When/Then accepted in acceptance.md.

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: 20 REQs — F5: 410,420,430,440,450,460,470,480,490; F6: 510,520,530,540,550; F7: 610,620,630,640,645,650. No duplicates. REQ-645 5-step insertion and REQ-490 addition are documented in HISTORY (spec.md:L16) and fall within the declared ranges "REQ-410~490, REQ-510~550, REQ-610~650" (spec.md:L16–L17) — accepted per orchestrator ruling 2. Ordering within each EARS-pattern group is ascending; the pattern-grouped layout (Ubiquitous REQ-480/490 before Optional REQ-410) is a deliberate documented scheme, not mis-ordered placement.
- [PASS] MP-2 EARS format compliance: All 20 REQs verified individually against the five patterns. Ubiquitous: REQ-480/490 ("시스템은 항상 … 해야 한다", L74–L75), REQ-510 (L95), REQ-610 (L112), negative-ubiquitous REQ-460/470 (L89–L90), REQ-550 (L107). Optional (Where): REQ-410 (L78), REQ-540 ("감아야 한다 … 스텝해야 한다", L104), REQ-640 (L122). Event-driven (WHEN/THEN): REQ-420 (L81), REQ-520 (L98), REQ-620 (L115). State-driven (WHILE): REQ-530 (L101), REQ-630 (L118), REQ-645 (L119). Unwanted (IF/THEN): REQ-430/440/450 (L84–L86). Every criterion carries normative "~해야 한다 / ~않아야 한다" modality; no plain declaratives remain.
- [PASS] MP-3 YAML frontmatter validity: Under ruling 1's project 8-field convention — id "SPEC-EARTH-002" (L2, matches SPEC-{DOMAIN}-{NUM}), version "0.1.1" string (L3), status "draft" (L4), created "2026-07-03" ISO (L5), updated (L6), author (L7), priority "medium" (L8), tags array (L10), plus issue_number and depends_on. All present with correct types.
- [N/A] MP-4 Section 22 language neutrality: N/A — single-language SPEC (Three.js r175 browser app, spec.md:L46; `src/data/FlightDataService.js`, L133). Auto-pass.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 (minor ambiguity resolved consistently) | REQ-630 tier ladder vs REQ-645 no-custom-shader mandate overlap (L118–L119 vs §4.3 L158 tier 1 "커튼/옥타브 감소"); REQ-620 (L115) lacks the capable-device scoping REQ-610 gained. Core F5/F6 REQs unambiguous (L74–L107). |
| Completeness | 1.00 | 1.0 (all sections + frontmatter + exclusions) | HISTORY L14, Environment L23, Assumptions L57, Requirements L67, Solution L129, NFR L162, Exclusions L175 (7 specific entries), Traceability L187, Expert Consultation L202; frontmatter complete per waived schema; ACs in acceptance.md (6 ACs + Precondition + DoD). |
| Testability | 0.90 | 0.75–1.0 (one term needs minor interpretation) | Quantified: 10–15s poll (L81), 30s exponential backoff (L90), ≤1.5ms/frame with "2020년 이후 통합 그래픽" reference class (L125), 1 sim-hour search increment / 5 sim-year window (L104), p95 ≤25/50ms (L167). "우아하게 비활성화" (L84) is operationalized by concrete observables; "지원 가능 기기" (L112) anchors to the existing isMobile/isLowEnd heuristic (L118). |
| Traceability | 1.00 | 1.0 (all REQs covered, no orphans) | Table L189–L198 maps all 20 REQs; REQ-450 → CORS Precondition (L193) matches acceptance.md:L26; every AC's Related Requirements list matches the table (acceptance.md:L31, L53, L76, L104, L125, L138); DoD covers all 20 REQs (acceptance.md:L197–L212) including REQ-640 (L209) and REQ-490 (L200). |

## Defects Found

D12. spec.md:L118–L119 vs L158 — REQ-630's degradation ladder tier 1 ("커튼 감소", implying the custom shader retained with reduced params, echoed in §4.3 tier (1) "커튼/옥타브 감소") sits in tension with REQ-645, which forbids the custom vertex-noise shader entirely while the device is classified low-end/mobile. The REQs are reconcilable (read REQ-645 as constraining how REQ-630's simplified tiers are implemented), but §4.3 should restate the ladder billboard-first to remove the ambiguity. — Severity: minor
D13. spec.md:L115 — REQ-620 ("WHEN 지구 뷰가 활성이면 THEN … 렌더해야 한다") is unconditional, while REQ-610 (L112) and REQ-630's off tier permit hard-off on the lowest device tier. Same class as resolved D10; REQ-620 needs the same "지원 가능 기기" scoping or an explicit deference to REQ-610/630. — Severity: minor
D14. spec.md:L81 — REQ-420's condition ("지구 뷰가 활성이고 … 탭이 보이는 동안") is a state, not an event; strictly this is State-driven (WHILE) content under a WHEN header. Syntactically it still matches the Event-driven template with full modality, so not an MP-2 failure. — Severity: minor
D15. spec.md:L122 — REQ-640's parenthetical "(정점 변위 반투명 밴드)" is residual implementation flavor (D6 class); the shader-vs-billboard tier distinction is legitimately WHAT-level, but the displacement/band detail belongs in §4.3 only. — Severity: minor
D16. spec.md:L101 — REQ-530 is a compound criterion (detection duty + fixed-substep sampling method in a second passive sentence). Both clauses are normative and coherent, but splitting would be cleaner. — Severity: minor

## Chain-of-Verification Pass

Second-look findings: D13 (REQ-620 missing device scoping) and D16 (REQ-530 compound) were found on the second pass. Re-verified: (1) all 20 REQ entries L74–L125 read individually; (2) numbering checked end-to-end across all three blocks — no duplicates, insertion REQ-645/REQ-490 within declared ranges; (3) traceability verified for all 20 REQs against the table, each AC's Related Requirements list, and the DoD — zero mismatches remain; (4) Exclusions L177–L183 re-checked — all 7 entries concrete, each citing a REQ or rationale; (5) contradiction scan — D12/D13 tensions found (both minor, reconcilable); Exclusions consistent with REQs (no-space-weather ↔ REQ-620/A-405; no-proxy ↔ REQ-450; no-keys ↔ REQ-460).

## Regression Check (Iteration 2+ only)

Defects from iteration 1 (report: SPEC-EARTH-002-review-1.md):

- D1 (frontmatter field names, critical): RESOLVED BY WAIVER — orchestrator ruling 1; fields present under project-canonical names (spec.md:L5, L10).
- D2 (REQ-540 no modality, critical): RESOLVED — "감아야 한다 … 스텝해야 한다", increment quantified to "1 시뮬레이션 시간(hour) 이하" (spec.md:L104).
- D3 (REQ-640 mixed modalities, critical): RESOLVED — split into Optional REQ-640 (L122) and State-driven REQ-645 (L119), each single-modality.
- D4 (pattern header misclassification, major): RESOLVED — REQ-430/440/450 under "Unwanted Behavior (IF/THEN)" header (L83); REQ-530 (L101) and REQ-630/645 (L118–L119) rewritten in WHILE form.
- D5 (REQ-480 placement/range, major): RESOLVED — REQ-480 moved under Ubiquitous header (L73–L74); HISTORY range corrected to "REQ-410~490" (L16).
- D6 (implementation details in REQs, major): RESOLVED — `document.visibilitychange`, hostnames, FBM/simplex, additive blending removed from Section 3; REQs defer via "(…: §4.1/§4.3)" pointers (L78, L81, L115, L122); providers retained in A-403 (L61). Residual flavor tracked as new minor D15.
- D7 (REQ-450 trace mismatch, minor): RESOLVED — table maps REQ-450 → "Precondition (CORS 스모크 테스트)" (spec.md:L193), matching acceptance.md:L26.
- D8 (REQ-640 missing from DoD, minor): RESOLVED — acceptance.md:L209.
- D9 (unquantified terms, minor): RESOLVED — "1 시뮬레이션 시간 이하" (L104); "중급 데스크탑" defined as "2020년 이후 통합 그래픽 또는 동급 이상" (L125, acceptance.md:L175); REQ-640 gate tied to the 1.5ms budget via "(REQ-650)" (L122).
- D10 (REQ-610 vs hard-off tier, minor): RESOLVED — "지원 가능 기기(하드-오프 최저 티어 제외)에서" (L112).
- D11 (orphaned empty-sky AC clause, minor): RESOLVED — REQ-490 created (L75), traced to AC-FLIGHT-02 (L194; acceptance.md:L53, L71) and DoD (acceptance.md:L200).

All 11 iteration-1 defects resolved (or waived by orchestrator ruling). No unresolved regressions. No stagnating defects.

## Recommendation

PASS. Rationale per must-pass criterion: MP-1 — 20 REQs, zero duplicates, insertions documented in HISTORY L16 and within declared ranges (ruling 2). MP-2 — every criterion individually verified against the five EARS patterns with normative modality (evidence lines listed above); the iteration-1 modality failures (REQ-540, REQ-640) are fixed at L104/L119/L122. MP-3 — frontmatter complete under the project 8-field schema (ruling 1), correct types at L2–L11. MP-4 — N/A, single-language Three.js SPEC.

Non-blocking polish for manager-spec (optional, may be handled during run phase):
1. (D12) Restate §4.3 fallback ladder (L158) billboard-first so it does not imply a reduced custom shader survives on low-end tiers, contradicting REQ-645.
2. (D13) Add "지원 가능 기기" scoping (or "REQ-610/630에 따름") to REQ-620 (L115).
3. (D15) Move "(정점 변위 반투명 밴드)" from REQ-640 to §4.3.
