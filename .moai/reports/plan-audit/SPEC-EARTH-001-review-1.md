# SPEC Review Report: SPEC-EARTH-001
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.55

Reasoning context ignored per M1 Context Isolation. Audit performed solely on
`.moai/specs/SPEC-EARTH-001/spec.md` with cross-reference to `acceptance.md`.

## Must-Pass Results

- [FAIL] MP-1 REQ number consistency: REQ IDs are 310, 315, 320, 325, 330, 340, 350, 360, 355, 370, 380, 385 (spec.md:L80-L99). Not sequential: gaps exist even within the implied 5-step scheme (335, 345, 365, 375 absent; 330→340 skips a full step). REQ-355 appears AFTER REQ-360 (spec.md:L91 vs L92) — out-of-order presentation. No duplicates found (verified end-to-end). Per MP-1, "even one gap = FAIL."
- [FAIL] MP-2 EARS format compliance: All acceptance criteria are Gherkin Given/When/Then test scenarios (acceptance.md:L19-L123, explicitly fenced as `gherkin`), not EARS patterns. Additionally, EARS keyword misuse in the requirements themselves: REQ-330 uses "WHEN 지구 뷰가 활성이면" — a state condition requiring WHILE, not WHEN (spec.md:L86); REQ-350/REQ-355/REQ-360 are headed "State-Driven" but use "IF ... THEN" (spec.md:L90-L92), the keyword reserved for the Unwanted-behavior pattern (state-driven requires WHILE); REQ-355's trigger "지구 뷰를 종료하면" is an event, not a state. REQ-370 uses informal optional phrasing "가능하면 ... 포함할 수 있다" ("may include") instead of "Where [feature], the system shall" (spec.md:L95).
- [FAIL] MP-3 YAML frontmatter validity: `id` present (spec.md:L2), `version` present as string (L3), `status: draft` present (L4), `priority: high` present (L8). However required field `created_at` is ABSENT — the file uses `created:` (spec.md:L5); required field `labels` is ABSENT — the file uses `tags:` (spec.md:L10). Per MP-3, "any missing required field = FAIL." (Note: `created`/`tags` are plausible template aliases; if the project template defines them as canonical, orchestrator may waive — but as audited against the stated schema, this fails.)
- [N/A] MP-4 Section 22 language neutrality: N/A — single-project Three.js/JavaScript frontend SPEC (spec.md:L46, "Three.js r175 WebGLRenderer"), not multi-language tooling. Auto-pass.

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 — minor ambiguity in one or two requirements | REQ-330 "표준 정보 패널보다 풍부한 정보" is vague but partially bounded by the enumerated list (spec.md:L86); REQ-350/REQ-360 phrase future SPEC-EARTH-002 behavior as "shall overlay/render" while parentheticals limit scope to mount points only (spec.md:L90-L91) — resolvable via Exclusions (L162) but requires interpretation |
| Completeness | 0.75 | 0.75 — one section missing/sparse | HISTORY (L14), Environment/WHY (L22), Assumptions (L63), Requirements (L73), Solution/HOW (L103), NFR (L148), Exclusions with 6 specific entries (L160-L167), Traceability (L171) all present. No inline ACCEPTANCE CRITERIA section in spec.md — criteria exist only in companion acceptance.md; frontmatter field-name deviations (L5, L10) |
| Testability | 0.50 | 0.50 — several ACs contain weasel words or require judgment | "달이 **올바른** 상대 궤도로" — "correct" undefined (acceptance.md:L68); "렌더링될 수 **있어야** 한다" — capability phrasing, not binary (acceptance.md:L76); "VRAM이 회수되어야 한다" only testable via the separate ≤128MB gate (acceptance.md:L98 vs L133). Counterweight: Performance Gate table (acceptance.md:L129-L137) gives concrete numeric thresholds |
| Traceability | 1.0 | 1.0 — full bidirectional coverage | All 12 REQs (310-385) mapped in Traceability table (spec.md:L173-L181); every AC-EARTH-01..06 references only existing REQs (acceptance.md:L17, L38, L60, L81, L103, L115); verified per-REQ: no orphaned AC, no uncovered REQ (REQ-385 covered by AC-EARTH-01, REQ-370 by AC-EARTH-03) |

## Defects Found

D1. spec.md:L80-L99 — REQ numbering has gaps (335/345/365/375 missing; 330→340 breaks even the 5-step convention) and is not the sequential REQ-001..N scheme required by MP-1 — Severity: critical
D2. spec.md:L91-L92 — REQ-360 listed before REQ-355; out-of-order numbering within the State-Driven block — Severity: major
D3. spec.md:L16, L75 — Declared requirement range "REQ-310~380" contradicts the existence of REQ-385 (spec.md:L99); internal inconsistency — Severity: major
D4. acceptance.md:L19-L123 — All acceptance criteria are Gherkin Given/When/Then scenarios, not EARS patterns (MP-2) — Severity: critical
D5. spec.md:L86, L90-L92 — EARS keyword misuse: WHEN used for state condition (REQ-330); IF used for state-driven requirements (REQ-350/355/360, WHILE required); REQ-355 trigger is an event mislabeled State-Driven — Severity: major
D6. spec.md:L95 — REQ-370 "가능하면 ... 포함할 수 있다" — informal "may" phrasing; EARS Optional requires "Where [feature], the system shall" — Severity: major
D7. spec.md:L5, L10 — Frontmatter missing required `created_at` and `labels`; uses `created` and `tags` instead (MP-3) — Severity: critical
D8. spec.md:L81, L99 — Requirements embed implementation detail: class/library names (ViewManager, WebGLRenderer, EffectComposer, Scene/Camera, state enum SOLAR/TO_EARTH/EARTH/TO_SOLAR) in normative REQ text rather than Solution section (RQ-3/RQ-4). Possibly intentional for an "architecture spine" SPEC, but as written REQs specify HOW — Severity: major
D9. acceptance.md:L68, L76 — Non-binary AC language: "올바른 상대 궤도" (undefined "correct"), "렌더링될 수 있어야 한다" (capability, not observable pass/fail) — Severity: major
D10. spec.md:L156 vs acceptance.md:L134-L135 — NFR states desktop 60fps / mobile 30fps, but performance gates allow p95 ≤ 25ms (~40fps) / ≤ 50ms (~20fps); thresholds inconsistent across documents — Severity: minor
D11. spec.md:L173-L181 — spec.md contains no inline Acceptance Criteria section; AC-EARTH-xx referenced in Traceability are defined only in the companion acceptance.md — Severity: minor (acceptable if the project template mandates the split; confirm)

## Chain-of-Verification Pass

Second-look findings, per M6 re-read:
- Re-verified every REQ entry end-to-end (L80-L99): confirmed no duplicates; confirmed the 330→340 gap and 360/355 inversion on second pass.
- Re-verified traceability for all 12 REQs individually (not sampled): REQ-385→AC-EARTH-01, REQ-370→AC-EARTH-03 both confirmed; no orphans.
- Re-checked Exclusions (L160-L167) for specificity: all 6 entries are concrete and cross-referenced to REQs — PASS on specificity.
- Cross-requirement contradiction sweep found D10 (fps vs p95 gate mismatch) which the first pass had noted only tentatively — promoted to defect list.
- Re-checked frontmatter types: `version` is a quoted string, `tags` is a YAML array, `issue_number: 0` is an extra field (harmless).
No further new defects beyond D10's promotion.

## Regression Check (Iteration 2+ only)

N/A — iteration 1.

## Recommendation

FAIL. Fix instructions for manager-spec, in priority order:

1. (D7, MP-3) Rename frontmatter `created:` → `created_at:` and `tags:` → `labels:` at spec.md:L5 and L10 (and mirror in acceptance.md:L6, L9), OR have the orchestrator confirm the project template defines `created`/`tags` as the canonical schema and record that waiver.
2. (D1/D2/D3, MP-1) Renumber requirements sequentially (REQ-001..REQ-012 or a contiguous REQ-310..REQ-321) with no gaps, in ascending order (fix 360/355 inversion at spec.md:L91-L92), and update the declared range at spec.md:L16 and L75 plus all Traceability rows and acceptance.md references.
3. (D4, MP-2) Either restate acceptance criteria in EARS form inside spec.md's ACCEPTANCE CRITERIA section (keeping Gherkin scenarios as supplementary test scenarios, clearly labeled as such), or obtain an explicit template ruling that acceptance.md Gherkin satisfies the AC contract.
4. (D5/D6, MP-2) Fix EARS keywords: REQ-330 WHEN→WHILE; REQ-350/360 IF→WHILE; REQ-355 split into event-driven "WHEN the user exits the earth view..."; rewrite REQ-370 as "Where auxiliary layers are included, the system shall render night-side city lights and atmospheric rim-glow."
5. (D8) Move class/library names (ViewManager, WebGLRenderer, EffectComposer, state enum) from REQ-315/REQ-385 normative text into §4 Solution; restate REQs as behavior ("the system shall render all views through a single shared rendering context").
6. (D9) Define "올바른 상대 궤도" measurably (e.g., moon orbital period/inclination tolerance) and rewrite the optional-layer scenario as a conditional binary check.
7. (D10) Align NFR fps targets with the performance-gate p95 thresholds (state both as p95 frame-time or both as fps, with one authoritative number).
