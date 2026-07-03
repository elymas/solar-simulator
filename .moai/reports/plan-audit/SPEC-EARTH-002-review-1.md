# SPEC Review Report: SPEC-EARTH-002
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.68

Reasoning context ignored per M1 Context Isolation (none was provided beyond the SPEC path; audited spec.md + acceptance.md only).

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: 18 REQs present — F5: 410,420,430,440,450,460,470,480; F6: 510,520,530,540,550; F7: 610,620,630,640,650 (spec.md:L73–L120). No duplicates; consistent 3-digit padding; consistent tens-increment block scheme per module, documented at spec.md:L16 ("REQ-410~470, REQ-510~550, REQ-610~650") and continuing the multi-SPEC numbering chain (external refs REQ-240, REQ-350/355/360 at spec.md:L40, L120). Interpretation note: read literally ("REQ-001…REQ-N, no gaps"), tens-block numbering would fail; I judged the documented block scheme as the intended sequence. The orchestrator may override this interpretation. Minor defect D5 (REQ-480 out of numeric order at spec.md:L82, before REQ-460/470 at L85–86) is recorded but is not a gap or duplicate.
- [FAIL] MP-2 EARS format compliance: REQ-540 (spec.md:L100) contains NO "shall" modality at all — "…빨리 감는다. 내부 검색은 작은 증분으로 스텝한다" are plain declaratives, not "…해야 한다". This is informal language inside the EARS section. REQ-640 (spec.md:L117) is a compound criterion mixing three modalities in one sentence ("사용하고 … 허용되며 … 필수다") — matches no single EARS pattern. Additionally, requirements under the "State-Driven" headers (REQ-430/440/450 at L79–81, REQ-530 at L97, REQ-630 at L114) use IF/THEN instead of the state-driven WHILE form, and REQ-480 (L82) is ubiquitous-form placed under a State-Driven header. Mixed informal/formal within single criteria = FAIL per M5.
- [FAIL] MP-3 YAML frontmatter validity: `created_at` field is MISSING — frontmatter has `created: "2026-07-03"` (spec.md:L5), not `created_at`. `labels` field is MISSING — frontmatter has `tags: [three.js, …]` (spec.md:L10), not `labels`. Content-equivalent values exist under wrong keys, but the required field names are absent. Two missing required fields = FAIL per M5. Present and valid: id (L2, matches SPEC-{DOMAIN}-{NUM}), version (L3, string), status (L4, "draft"), priority (L8, "medium").
- [N/A] MP-4 Section 22 language neutrality: N/A — single-language SPEC. Scope is a Three.js/JavaScript browser app (spec.md:L45 "Three.js r175", L128 `src/data/FlightDataService.js`). No multi-language tooling covered. Auto-pass.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 (minor ambiguity a reasonable engineer resolves consistently) | REQ-640 (L117) compound modality; "중급 데스크탑" undefined (L120, L163); REQ-610 "항상 …렌더할 수 있어야" (L108) in tension with hard-off tier (L114, L153). Core F5/F6 requirements are unambiguous (L73–L103). |
| Completeness | 0.50 | 0.50 (frontmatter missing one or two fields) | All content sections present: HISTORY L14, Environment/WHY L22, Requirements L66, Solution/HOW L124, NFR L157, Exclusions L170 (7 specific entries), Traceability L182; ACs in companion acceptance.md (6 ACs + precondition + DoD). Frontmatter missing `created_at` (L5) and `labels` (L10) per MP-3. |
| Testability | 0.75 | 0.75 (measurable with minor interpretation) | Strong quantified gates: 10–15s poll (L76), ≤1.5ms/frame (L120), p95 ≤25/50ms (L162), 500x no-skip (L97). Judgment-call terms remain: "작은 증분" (L100), "GPU 예산이 허용하는 경우" (L117), "중급 데스크탑" (L120), "우아하게 비활성화" (L79, though followed by concrete observables). |
| Traceability | 0.75 | 0.75 (one indirect mapping) | All 18 REQs mapped in table L184–L192; all 6 ACs reference existing REQs. Defects: REQ-450 mapped to AC-FLIGHT-01 (L186) but acceptance.md AC-FLIGHT-01 (acceptance.md:L31) lists only REQ-410/420/460/480 — REQ-450 is actually verified by the CORS Precondition (acceptance.md:L26); REQ-640 absent from Definition of Done (acceptance.md:L186–L200); "empty sky vs API-down distinction" appears only in AC/edge cases (acceptance.md:L71, L178) with no backing REQ. |

## Defects Found

D1. spec.md:L5, L10 — Frontmatter field names wrong: `created` should be `created_at`; `tags` should be `labels` (or `labels` added). Required fields absent by name (MP-3). — Severity: critical
D2. spec.md:L100 — REQ-540 has no normative modality: "빨리 감는다", "스텝한다" are plain declaratives, not "~해야 한다". Not a valid EARS statement (MP-2). — Severity: critical
D3. spec.md:L117 — REQ-640 mixes three modalities in one criterion ("사용하고 / 허용되며 / 필수다"); matches no single EARS pattern; should be split into separate Optional + Unwanted/State-driven criteria (MP-2). — Severity: critical
D4. spec.md:L78–L82, L96–L97, L113–L114 — "State-Driven" sections use IF/THEN instead of WHILE. REQ-530 ("고 시간 가속으로 실행 중이면") and REQ-630 ("저사양으로 분류되면") describe operating states and belong in WHILE form; REQ-430/440/450 are Unwanted-pattern (IF undesired condition) statements under a State-Driven header. Pattern misclassification. — Severity: major
D5. spec.md:L82 — REQ-480 is a ubiquitous-form requirement placed under the State-Driven header, and out of numeric order (appears between REQ-450 and REQ-460). Also inconsistent with HISTORY L16 which declares the F5 range as "REQ-410~470". — Severity: major
D6. spec.md:L73, L76, L111, L117 — Implementation details inside requirements (HOW in WHAT): REQ-410 hardcodes provider endpoints ("api.adsb.lol"); REQ-420 names the DOM API `document.visibilitychange`; REQ-620 mandates "노이즈 구동 커튼 지오메트리, additive 블렌딩"; REQ-640 mandates "FBM/simplex 노이즈" shader internals. These belong in Section 4 (Solution), which already restates them (L128–L153). — Severity: major
D7. spec.md:L186 / acceptance.md:L31 — Traceability mismatch: spec table maps REQ-450 to AC-FLIGHT-01, but AC-FLIGHT-01's Related Requirements omit REQ-450; the actual verification lives in the CORS Precondition (acceptance.md:L26). Table should point REQ-450 at the precondition. — Severity: minor
D8. acceptance.md:L186–L200 — REQ-640 is missing from the Definition of Done checklist (610/620/630/650 present, 640 absent). — Severity: minor
D9. spec.md:L100, L117, L120 — Unquantified terms requiring judgment: "작은 증분" (how small?), "GPU 예산이 허용하는 경우" (which threshold?), "중급 데스크탑" (which hardware class?). — Severity: minor
D10. spec.md:L108 vs L114/L153 — REQ-610 says the system shall "항상" be able to render aurora when Earth view is active, but REQ-630/Solution permit a hard "off" tier on lowest-tier devices. Clarify REQ-610 as capability-on-capable-devices or add an explicit exception. — Severity: minor
D11. acceptance.md:L71, L178 — "Empty sky (해양/비수기) vs API-down must be visually distinguishable" appears only in acceptance scenario and Edge Cases; no REQ in spec.md requires it. Orphaned AC clause — add a REQ (e.g., under F5 State-Driven) or remove from AC. — Severity: minor

## Chain-of-Verification Pass

Second-look findings: D11 (orphaned "empty vs down" AC clause) and D8 (REQ-640 missing from DoD) were found on the second pass, not the first. Re-verified end-to-end: (1) every REQ entry L73–L120 read individually, not skimmed; (2) REQ sequencing checked across all three blocks — no duplicates, REQ-480 ordering anomaly confirmed; (3) traceability verified for all 18 REQs against both the L184–L192 table and each AC's Related Requirements list — only REQ-450 mismatches; (4) Exclusions (L170–L178) checked for specificity — all 7 entries are concrete and cite REQs, PASS; (5) cross-requirement contradiction scan — only the REQ-610/REQ-630 tension (D10); Exclusions do not conflict with any included requirement (no-space-weather-API ↔ REQ-620 consistent; no-proxy ↔ REQ-450 consistent).

## Regression Check (Iteration 2+ only)

N/A — iteration 1.

## Recommendation

FAIL. Fix instructions for manager-spec, in priority order:

1. (D1, MP-3) In spec.md frontmatter, rename `created:` → `created_at:` (L5) and `tags:` → `labels:` (L10), or add `created_at`/`labels` fields. Apply the same to acceptance.md for consistency.
2. (D2, MP-2) Rewrite REQ-540 (L100) with normative modality, e.g.: "가능하면 시스템은 '다음 일식 찾기' 컨트롤을 제공해야 하며, 활성화 시 시스템은 경계 검색 창 내 다음 발생으로 시뮬레이션 시계를 빨리 감아야 한다. 내부 검색은 [N일 이하] 증분으로 스텝해야 한다." Quantify the increment (resolves part of D9).
3. (D3, MP-2) Split REQ-640 (L117) into two criteria: an Optional ("가능하면 GPU 예산이 X를 허용하는 경우, 시스템은 커스텀 셰이더를 사용해야 한다") and a State-driven for mobile ("저사양/모바일로 분류된 동안, 시스템은 빌보드/스프라이트 폴백을 사용해야 한다").
4. (D4) Recategorize: move REQ-430/440/450 under an Unwanted/IF header; rewrite REQ-530 and REQ-630 in WHILE form ("~하는 동안") or relabel their sections.
5. (D5) Move REQ-480 after REQ-470 (or renumber) and place it under the correct pattern header (Ubiquitous); update HISTORY L16 range to "REQ-410~480".
6. (D6) Strip implementation identifiers (`document.visibilitychange`, "additive 블렌딩", "FBM/simplex", endpoint hostnames) from Section 3 REQs; keep them in Section 4 Solution only. Provider candidates may remain in Assumptions (A-403).
7. (D7) In the traceability table (L186), map REQ-450 to the CORS Precondition (or add REQ-450 to AC-FLIGHT-01's Related Requirements in acceptance.md).
8. (D8) Add REQ-640 to the Definition of Done in acceptance.md.
9. (D9) Quantify or define: "중급 데스크탑" (name a reference GPU class), "GPU 예산이 허용하는 경우" (tie to the 1.5ms budget explicitly).
10. (D10) Reword REQ-610 to exempt the hard-off lowest tier, or state "지원 가능 기기에서".
11. (D11) Add an F5 requirement for the empty-sky vs API-down visual distinction, or remove it from AC-FLIGHT-02/Edge Cases.

Note on MP-1: PASS was granted under the documented tens-block numbering interpretation (spec.md:L16). If the project standard mandates strictly consecutive REQ-001…REQ-N numbering, MP-1 must be re-graded FAIL and the SPEC renumbered — flagging for orchestrator decision.
