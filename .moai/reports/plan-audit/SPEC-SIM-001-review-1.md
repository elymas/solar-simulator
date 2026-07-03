# SPEC Review Report: SPEC-SIM-001
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.68

Reasoning context ignored per M1 Context Isolation. Audit inputs: spec.md, acceptance.md only.

## Must-Pass Results

- [FAIL] MP-1 REQ number consistency: `REQ-260-A` (spec.md:L136) collides with `REQ-260` (spec.md:L139) — a suffix hack on a duplicate base number. REQ-260-A additionally appears BEFORE REQ-260 and belongs to a different EARS category (Optional vs Unwanted). Numbering scheme is also non-sequential by design ("각 100 단위 블록으로 그룹화", spec.md:L81): 010/020/.../060, then 110-160, then 210-290 in steps of 10. The block scheme is documented and internally regular, but the 260-A collision proves it broke down; even one duplicate = FAIL per rubric.
- [FAIL] MP-2 EARS format compliance: REQ-150 (spec.md:L114 "...사용할 수 있다") and REQ-250 (spec.md:L135 "...절감할 수 있다") are "may"-statements, not shall-statements — no EARS pattern permits non-normative "can/may" phrasing. REQ-050 (L96) and REQ-260-A (L136) use the informal trigger "가능하면" instead of the EARS Optional pattern "Where [feature is included], the system shall...". REQ-040 (L93), REQ-140 (L111), REQ-240 (L132) are labeled State-Driven but use IF/THEN (the Unwanted pattern) instead of WHILE. REQ-290 (L129) mixes Event-driven and Unwanted ("...하되, 절대 포함하지 않아야") in a single criterion.
- [FAIL] MP-3 YAML frontmatter validity: `created_at` field absent — file uses `created` (spec.md:L5). `labels` field absent — file uses `tags` (spec.md:L10). Present and valid: id (L2, matches SPEC-{DOMAIN}-{NUM}), version (L3, string), status (L4, "draft"), priority (L8, "high"). NOTE: all four SPECs in `.moai/specs/` use the `created`/`tags` naming, so this is a project-template convention, not an author error unique to this SPEC. Per the strict schema it is a FAIL; recommend resolving at template level (rename fields or align the audit schema) rather than per-SPEC.
- [N/A] MP-4 Section 22 language neutrality: N/A — single-language SPEC (JavaScript/Three.js browser app, spec.md:L44-54). Auto-pass.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | Requirements are largely single-interpretation with concrete anchors (REQ-020 L87 gives explicit unit ranges; REQ-240 L132 gives an ordered degradation ladder). Minor ambiguity: REQ-150 "시각적 정체성이 뚜렷한 hero 위성" (L114) leaves "hero" membership open beyond the two examples. |
| Completeness | 0.50 | 0.50 | All content sections present: HISTORY L13, Environment/context L21-64, Requirements L79-140, Solution L143-185, NFR L188-196, Exclusions L199-206 (6 specific entries), Traceability L210-222. ACs live in acceptance.md (project convention, acceptable). Downgraded because frontmatter deviates from schema on two fields (L5, L10) — 0.50 band: "frontmatter missing one or two fields". |
| Testability | 0.75 | 0.75 | Strong concrete gates: samples ≥ 4 (acceptance.md:L85, L156), p95 ≤ 25ms/50ms (L150-151), ≤ 12MB initial payload (L152), ≤ 512KB per dwarf texture (L153). But several scenario assertions require judgment: "계단현상 없이 부드럽게" (acceptance.md:L84), "급격한 시각적 점프 없이" (L113), "가시적으로 타원형" (L45). |
| Traceability | 0.75 | 0.75 | Full REQ→AC table (spec.md:L212-222) covers all 22 REQs; all AC "Related Requirements" reference existing REQs; no orphans. Downgraded: REQ-130, REQ-150, REQ-250 map to ACs whose scenarios never exercise them (indirect mapping), and acceptance.md DoD L181 attributes tone mapping to REQ-210, which is the frame-time requirement — tone mapping has no REQ at all. |

## Defects Found

D1. spec.md:L136 vs L139 — `REQ-260-A` duplicates base number of `REQ-260`, appears before it, and sits in a different EARS category. Numbering collision resolved by suffix hack. — Severity: critical (MP-1)
D2. spec.md:L114, L135 — REQ-150 "사용할 수 있다" and REQ-250 "절감할 수 있다" are "may"-statements, not EARS shall-statements. — Severity: critical (MP-2)
D3. spec.md:L96, L114, L135, L136 — Optional requirements use informal "가능하면" instead of EARS "Where [feature is included], the system shall...". — Severity: major (MP-2)
D4. spec.md:L93, L111, L132 — REQ-040/REQ-140/REQ-240 labeled State-Driven but phrased IF/THEN instead of WHILE [state]. REQ-240 arguably fits the Unwanted pattern (frame-budget overrun is an undesired condition) — if so, relabel it; REQ-040/REQ-140 ("시뮬레이션이 재생 중" = ongoing state) must become WHILE. — Severity: major (MP-2)
D5. spec.md:L5, L10 — Frontmatter fields `created`/`tags` instead of schema-required `created_at`/`labels`. Project-wide template convention (verified across all 4 SPECs); resolve at template level. — Severity: major (MP-3)
D6. spec.md:L132 vs L205 — CONTRADICTION: REQ-240's degradation ladder begins with "오로라 입자 상세도 → 일식 그림자 오버레이 품질", but Exclusions L205 explicitly defers aurora and eclipse to SPEC-EARTH-002. This SPEC mandates degrading features it simultaneously excludes. — Severity: major (CN-2)
D7. acceptance.md:L140 vs spec.md:L132 — AC-SIM-06 scenario 3 tests order "bloom 반경 → LOD 업그레이드 → 동적 픽셀 비율", silently dropping the first two REQ-240 steps. Spec and acceptance disagree on the contracted ladder. (Consequence of D6 — fixing D6 resolves D7.) — Severity: major
D8. spec.md:L52, L170 + acceptance.md:L181 — ACESFilmicToneMapping is a committed behavior change (from NoToneMapping) with NO requirement; the DoD traces it to REQ-210 (frame-time NFR), which is wrong. Add a REQ or remove from DoD. — Severity: major
D9. spec.md:L108, L114, L135 — REQ-130 (moon click → InfoPanel), REQ-150 (hero moon textures), REQ-250 (KTX2) trace to AC-SIM-03/AC-SIM-04, but no scenario in those ACs verifies them. — Severity: minor
D10. spec.md:L111, L124, L125, L128, L136 — Implementation details in normative requirements: `MOON_DATA` field names (REQ-140), `samples: 4` + SMAA pass (REQ-270), `MeshStandardMaterial`/`MeshBasicMaterial` (REQ-280), `hardwareConcurrency <= 4` (REQ-230), `renderer.capabilities.getMaxAnisotropy()` (REQ-260-A). Brownfield constraints partially justify naming existing components, but API-call-level detail belongs in Solution §4, referenced from the REQ. — Severity: minor
D11. acceptance.md:L123 vs spec.md:L193 — AC-SIM-06 scenario 1 verifies only 10x speed for one 60s run; NFR requires p95 ≤ 25ms over ANY rolling 60s window at 1x–100x. The AC under-tests the NFR. — Severity: minor
D12. acceptance.md:L45, L84, L113 — Subjective assertions ("가시적으로 타원형", "부드럽게", "급격한 ... 없이") require tester judgment; each needs a measurable proxy or explicit reference metric. — Severity: minor

## Chain-of-Verification Pass

Second-look findings: D7, D8, and D11 were discovered on the second pass (first pass focused on spec.md-internal checks; the re-read cross-compared REQ-240's ladder and the NFR table against acceptance.md scenarios line-by-line). Verified end-to-end on re-read: all 22 REQ entries individually read (6 F1 + 6 F2 + 10 F3); REQ sequencing checked across all three blocks, not spot-checked; traceability verified for every REQ in both directions (spec table L212-222 vs acceptance "Related Requirements" headers — consistent, no orphans); Exclusions checked for specificity (6 entries, all concrete with REQ cross-refs — PASS); cross-requirement contradiction scan produced D6.

## Regression Check (Iteration 2+ only)

N/A — iteration 1.

## Recommendation

FAIL. Fix instructions for manager-spec, in priority order:

1. (D1/MP-1) Renumber REQ-260-A. Options: renumber Unwanted REQ-260 → REQ-2X0 at the end of the block and give the anisotropy requirement its own base number, or move anisotropy to REQ-255-style is NOT acceptable — assign a clean base-10 number (e.g., anisotropy = REQ-250 sibling → renumber the F3 block so every REQ has a unique, suffix-free number). Update the traceability table (spec.md:L220) and acceptance.md:L99 to match.
2. (D2/D3/MP-2) Rewrite all four Optional requirements (REQ-050, REQ-150, REQ-250, REQ-260-A) in EARS Optional form: "Where [feature/GPU support is included], the system shall ..." with normative 해야 한다. Eliminate "가능하면" and "~할 수 있다".
3. (D4/MP-2) Rephrase REQ-040 and REQ-140 as WHILE-state requirements ("WHILE 시뮬레이션이 재생 중인 동안, 시스템은 ...해야 한다"). Relabel REQ-240 as Unwanted (IF/THEN fits) or rephrase as WHILE.
4. (D6/D7) Remove aurora and eclipse steps from REQ-240's degradation ladder (they do not exist in this SPEC per Exclusions L205), OR restate the ladder as the cross-SPEC target order with an explicit note that only bloom/LOD/pixel-ratio apply within SPEC-SIM-001. Then align acceptance.md AC-SIM-06 scenario 3 to the corrected ladder.
5. (D8) Add a requirement for the tone-mapping change (e.g., "시스템은 항상 ACES 필름 톤 매핑으로 출력을 매핑해야 한다") and fix acceptance.md DoD L181 to trace to it; or delete the DoD line.
6. (D5/MP-3) Align frontmatter with the audit schema (`created_at`, `labels`) — or, since the convention is project-wide across all 4 SPECs, escalate to the orchestrator to align the template/audit schema once instead of patching per-SPEC.
7. (D9) Add scenarios to AC-SIM-03 (moon click → InfoPanel) and AC-SIM-04 or a new AC (KTX2 fallback behavior; hero-moon texture presence) so REQ-130/150/250 are actually verified.
8. (D11/D12) Strengthen AC-SIM-06 scenario 1 to sample multiple speeds (or state 10x as the agreed representative case in the NFR); add measurable proxies for the subjective assertions in acceptance.md L45/L84/L113.
