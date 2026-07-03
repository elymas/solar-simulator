# SPEC Review Report: SPEC-SIM-001
Iteration: 2/3
Verdict: PASS
Overall Score: 0.85

Reasoning context ignored per M1 Context Isolation. Audit inputs: spec.md, acceptance.md, iteration-1 report. Orchestrator rulings applied: (1) MP-3 `created`/`updated`/`tags` waived as project convention; (2) tens-block numbering with 5-step insertions (REQ-255, REQ-285) waived; (3) Given/When/Then in acceptance.md accepted, EARS scoped to spec.md requirement blocks.

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: 23 REQs enumerated end-to-end — F1: 010/020/030/040/050/060, F2: 110/120/130/140/150/160, F3: 210/220/230/240/250/255/260/270/280/285/290. No duplicates (the iteration-1 `REQ-260-A` collision is gone; anisotropy is now REQ-255, spec.md:L138, and REQ-260 is unique, spec.md:L141). Declared 100-unit blocks (spec.md:L82) match actual placement: all F1 in 0xx, F2 in 1xx, F3 in 2xx. Within each EARS category subgroup, numbers ascend (230<290; 250<255). 5-step insertions accepted per orchestrator ruling 2.
- [PASS] MP-2 EARS format compliance: All 23 requirement statements now use a normative pattern. Ubiquitous: REQ-010 "시스템은 **항상** ... 렌더링해야 한다" (L87), likewise 020/110/120/210/220/270/280/285. Event-driven WHEN/THEN + 해야 한다: REQ-030 (L91), REQ-130 (L109), REQ-230 (L130), REQ-290 (L131). State-driven: REQ-040 (L94), REQ-140 (L112), REQ-240 (L134) all rewritten as "**WHILE** ... 동안, ... 해야 한다" (iteration-1 IF/THEN mislabels fixed). Optional: REQ-050 (L97), REQ-150 (L115), REQ-250 (L137), REQ-255 (L138) all rewritten as "**Where** ... 경우, 시스템은 ... 해야 한다" — no "가능하면", no "~할 수 있다" remains (grep-level re-check of §3 confirms zero may-statements). Unwanted: REQ-060/160/260 use "...하지 않아야 한다" (formal shall-not; see D-r3 minor note).
- [PASS] MP-3 YAML frontmatter validity: id `SPEC-SIM-001` (L2, matches SPEC-{DOMAIN}-{NUM}), version "0.1.1" string (L3), status "draft" (L4), created "2026-07-03" ISO date (L5), priority "high" (L8), tags array of 6 (L10). `created`/`tags` naming accepted per orchestrator ruling 1 (project 8-field schema, SPEC-UI-001 precedent).
- [N/A] MP-4 Section 22 language neutrality: N/A — single-language SPEC (JavaScript/Three.js static browser app, spec.md:L47-55). Auto-pass.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | Requirements single-interpretation with concrete anchors (REQ-020 L88 explicit unit ranges; REQ-240 L134 ordered ladder with explicit cross-SPEC scoping note). Minor residual ambiguity: REQ-150 "hero" membership still example-based ("예: Titan, Europa", L115); REQ-230's "(저사양 판정 휴리스틱: §4.3, Assumptions)" pointer is dangling (see D-r1). |
| Completeness | 1.0 | 1.0 | All sections present: HISTORY L13, Environment/context L22-64, Assumptions L68-76, Requirements L80-141, Solution L145-186, NFR L190-197, Exclusions L201-208 (6 specific entries with REQ cross-refs), Traceability L212-224, Expert Consultation L228. Frontmatter complete per project schema (rulings applied). ACs in acceptance.md per project convention. |
| Testability | 0.75 | 0.75 | Iteration-1 subjective assertions replaced with measurable gates: eccentricity ratio ≈1.66 ±5% and inclination 17°±1° (acceptance.md:L45-46); samples ≥ 4 proxy + aliasing-step comparison (L100-101); hysteresis "임계값당 최대 1회" (L145); 3-speed × 60s p95 sampling (L155-156). Residual: "야간면이 가시적으로 어두워야 한다(완전 검정 아님)" (L108) still needs tester judgment; REQ-255 anisotropy has no verifying scenario (D-r2). |
| Traceability | 0.75 | 0.75 | All 23 REQs covered in spec table (spec.md:L214-224); every acceptance "Related Requirements" entry references an existing REQ; no orphans in either direction. Iteration-1 gaps closed: REQ-130 scenario (acceptance.md:L77-82), REQ-150 scenario (L85-90), REQ-250 incl. fallback (L122-127), REQ-285 scenario (L114-119) + DoD L213. Downgraded for: REQ-255 listed in AC-SIM-05 (L131) but no scenario exercises anisotropy; spec table maps REQ-210 only to AC-SIM-04 (L221) while the actual frame-time verification lives in AC-SIM-06 (L150-158). |

## Defects Found

D-r1. spec.md:L130 — REQ-230's reference "(저사양 판정 휴리스틱: §4.3, Assumptions)" is dangling: §4.3 (L168-176) and Assumptions A-101..A-107 (L70-76) contain no low-end classification heuristic. The heuristic exists only in acceptance.md:L162 ("hardwareConcurrency <= 4") and by inheritance from SPEC-UI-001 REQ-018. Fix: state the heuristic in §4.3 or an Assumption, or point the reference at SPEC-UI-001 REQ-018. — Severity: minor
D-r2. acceptance.md:L129-146 — AC-SIM-05 lists REQ-255 in Related Requirements but neither scenario verifies anisotropic filtering. Add a scenario or measurable proxy (e.g., focused-body texture anisotropy > 1). — Severity: minor
D-r3. spec.md:L100, L118, L141 — REQ-060/160/260 sit under the "Unwanted" heading but are phrased as ubiquitous prohibitions ("...하지 않아야 한다") rather than "If [undesired condition], then...". The text itself is formal and normative (matches the Ubiquitous pattern with negated response), so this is a heading/labeling nuance only. — Severity: minor
D-r4. spec.md:L131 — REQ-290 is a compound requirement: the WHEN-triggered lazy-load response is bundled with an initial-bundle prohibition ("이 티어는 초기 번들에 포함하지 않아야 한다") that is logically an ubiquitous constraint, not part of the focus event. Both clauses are formal shall-statements, so not an MP-2 blocker; splitting would improve atomicity. — Severity: minor
D-r5. spec.md:L221 vs acceptance.md:L150 — Spec traceability maps REQ-210 to AC-SIM-04 only, but no AC-SIM-04 scenario measures frame time; the verifying scenario is AC-SIM-06 scenario 1 (which does list REQ-210 at L150). Add AC-SIM-06 to the REQ-210 row. — Severity: minor
D-r6. spec.md:L208 — Exclusions references "(A-009 상속)" but this SPEC's assumptions are A-101..A-107; A-009 presumably belongs to SPEC-UI-001 but is not qualified. Qualify the cross-SPEC reference. — Severity: minor

No critical or major defects remain.

## Chain-of-Verification Pass

Second-look findings: D-r1, D-r2, D-r5, D-r6 were discovered on the second pass (first pass focused on regression verification of D1-D12; the re-read followed every parenthetical section reference in §3 to its target and re-walked AC scenarios against each Related-Requirements entry). Verified on re-read: all 23 REQ entries individually read (6 F1 + 6 F2 + 11 F3); numbering checked end-to-end against the declared block scheme, not spot-checked; traceability verified for every REQ in both directions (spec table L214-224 vs acceptance Related-Requirements headers L16/L39/L58/L94/L131/L150 — consistent, no orphans); Exclusions re-checked for specificity (6 entries, all concrete, all cross-referenced — PASS); contradiction scan re-run including the REQ-220 "항상 LOD" vs REQ-230/REQ-240 "LOD 업그레이드 비활성화" pair — not a contradiction (base LOD persists; only upgrades are suspended); eccentricity math verified ((1+0.248)/(1-0.248)=1.6596≈1.66, acceptance.md:L45 correct).

## Regression Check (Iteration 2+ only)

Defects from previous iteration (.moai/reports/plan-audit/SPEC-SIM-001-review-1.md):

- D1 (REQ-260-A duplicate/suffix hack) — RESOLVED: REQ-260-A removed; anisotropy reassigned to unique REQ-255 (spec.md:L138); REQ-260 unique (L141); traceability (L222) and acceptance (L131) updated. REQ-255 as a 5-step insertion accepted per orchestrator ruling 2.
- D2 (REQ-150/250 may-statements) — RESOLVED: "적용**해야 한다**" (L115), "절감**해야 한다**" (L137).
- D3 ("가능하면" informal Optional triggers) — RESOLVED: REQ-050/150/250/255 all use "Where ... 경우, ... 해야 한다" (L97, L115, L137, L138).
- D4 (State-Driven phrased IF/THEN) — RESOLVED: REQ-040 (L94), REQ-140 (L112), REQ-240 (L134) all rewritten as WHILE.
- D5 (frontmatter created/tags) — WAIVED per orchestrator ruling 1 (canonical project convention).
- D6 (REQ-240 ladder contradicts Exclusions) — RESOLVED: ladder is now bloom → LOD 업그레이드 → 픽셀 비율 (L134); aurora/eclipse moved to an explicit cross-SPEC parenthetical marked outside this SPEC's scope, consistent with Exclusions L207.
- D7 (acceptance ladder mismatch) — RESOLVED: acceptance.md:L172 matches spec.md:L134 exactly.
- D8 (tone mapping without REQ) — RESOLVED: REQ-285 added (L127), AC-SIM-04 scenario added (acceptance.md:L114-119), DoD traces REQ-285 (L213), traceability row updated (L221).
- D9 (REQ-130/150/250 unverified) — RESOLVED: dedicated scenarios at acceptance.md:L77-82 (REQ-130), L85-90 (REQ-150), L122-127 (REQ-250 with fallback).
- D10 (API-level detail in REQs) — RESOLVED: `MOON_DATA` field names → "(스키마 필드명: §4.2)" (L112); `samples: 4` → "(구현 세부: §4.3)" (L125); material class names → "(재질 매핑: §4.3)" (L126); `getMaxAnisotropy()` → "(구현: §4.3)" (L138); `hardwareConcurrency` → reference (L130, but see new D-r1: the referenced target does not define the heuristic).
- D11 (AC-SIM-06 under-tests NFR) — RESOLVED: scenario now samples 1x/10x/100x for 60s each with rolling-window p95 per speed (acceptance.md:L155-156), per iteration-1 recommendation 8's "sample multiple speeds" option.
- D12 (subjective assertions) — RESOLVED: measurable ratios/tolerances at acceptance.md:L45-46; samples ≥ 4 proxy + aliasing-step comparison at L100-101; hysteresis max-1-transition at L145.

Unresolved from iteration 1: none. Stagnation: none — every actionable iteration-1 defect was addressed.

## Recommendation

PASS. Evidence per must-pass criterion: MP-1 — full 23-REQ enumeration, zero duplicates, block scheme honored (spec.md:L82-141); MP-2 — every requirement matches an EARS pattern with normative 해야 한다, all four iteration-1 violation classes eliminated (L94, L97, L112, L115, L134, L137, L138); MP-3 — all six required fields present with correct types under the waived naming (L2-L10); MP-4 — N/A, single-language SPEC.

Optional cleanup for manager-spec (non-blocking, may be batched into the next revision or handled during run phase):
1. (D-r1) Define the low-end heuristic where REQ-230 points, or repoint the reference to SPEC-UI-001 REQ-018.
2. (D-r2) Add an anisotropy verification scenario or proxy to AC-SIM-05.
3. (D-r5) Add AC-SIM-06 to the REQ-210 traceability row.
4. (D-r3/D-r4/D-r6) Labeling/atomicity/cross-ref polish as described above.
