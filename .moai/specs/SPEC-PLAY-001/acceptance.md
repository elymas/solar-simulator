# Acceptance Criteria — SPEC-PLAY-001

## 1. AC Matrix (1:1 with REQs)

| AC | REQ | Criterion (testable) | Verification |
|----|-----|----------------------|--------------|
| AC-PLAY-101 | REQ-PLAY-101 | "크기 비교" button in kid view opens the lineup: selected body + Earth (+ Sun where meaningful); count fact rendered at display-dominant size; exactly one `speak()` of the fact | vitest (jsdom + TTS spy) |
| AC-PLAY-102 | REQ-PLAY-102 | Rendered comparative widths derive from planetData diameter fields with ratio error ≤5% (unit test over the ratio math; Jupiter/Earth ≈ 10.97, Sun/Earth ≈ 109) | vitest (numeric) |
| AC-PLAY-103 | REQ-PLAY-103 | Closing the comparison restores prior UI state; selection and camera unchanged (state snapshot assertion) | vitest (jsdom) |
| AC-PLAY-104 | REQ-PLAY-104 | With `prefers-reduced-motion`: no transition/animation classes; content identical | vitest (matchMedia stub) |
| AC-PLAY-201 | REQ-PLAY-201 | "로켓 발사" available for planets/moon/dwarfs, absent for Earth and stars; launch spawns one rocket following a curved path (path math: starts at Earth pos, ends within ε of destination's live pos, apex above ecliptic plane) | vitest (path math + jsdom) |
| AC-PLAY-202 | REQ-PLAY-202 | Arrival → celebration invoked + destination's Korean travel fact shown and spoken ("화성까지는 반년을 날아가야 해요!" for Mars); facts table covers all eligible destinations | vitest (spies + table completeness) |
| AC-PLAY-203 | REQ-PLAY-203 | Code comment + spec state the schematic-path honesty; no transfer-orbit math present; travel-fact table values approximate real durations (review against reference list in table comments) | review + grep |
| AC-PLAY-204 | REQ-PLAY-204 | Selecting another body / switching view / relaunching mid-flight cancels: rocket object disposed, no callbacks fire after cancel (timer/RAF leak assertion) | vitest |
| AC-PLAY-205 | REQ-PLAY-205 | With reduced-motion: no flight animation; arrival fact + TTS + static celebration presented immediately | vitest |
| AC-PLAY-301 | REQ-PLAY-301 | Camera-arrival event → exactly one sparkle burst + one chime trigger (spies); burst auto-returns to pool | vitest |
| AC-PLAY-302 | REQ-PLAY-302 | Star selection → twinkle variant (distinct effect id) + chime | vitest |
| AC-PLAY-303 | REQ-PLAY-303 | SFX module: muted (shared KIDS-001 setting) → zero AudioContext plays for chime AND TTS remains muted (shared key asserted — same storage read); unlock ordering: no play before `resume()` | vitest (fake AudioContext) |
| AC-PLAY-304 | REQ-PLAY-304 | Reduced-motion: celebration emits zero particles, no camera shake; chime still allowed | vitest |
| AC-PLAY-305 | REQ-PLAY-305 | Particle pool fixed-size, reused across bursts (allocation count stable over 10 bursts); measured per-burst cost documented in run evidence; degrader registration present IF threshold exceeded | vitest + run-phase profiling note |
| AC-PLAY-401 | REQ-PLAY-401 | `missionsForDate('2026-08-12', catalog)` deterministic (repeat-call identical; snapshot); different dates differ; catalog entries carry id/promptKo/predicate/sticker/emoji | vitest |
| AC-PLAY-402 | REQ-PLAY-402 | Synthetic event streams complete the right missions: select saturn → find-rings done; enter EARTH → earth-view done; non-matching events do nothing | vitest |
| AC-PLAY-403 | REQ-PLAY-403 | Award → localStorage write; fresh engine init from that storage → sticker still earned (round-trip); sticker book shows earned vivid vs locked silhouette counts correctly | vitest (jsdom) |
| AC-PLAY-404 | REQ-PLAY-404 | Completion → celebration + one TTS praise; re-completing a mission whose sticker is already earned → praise MAY fire but inventory count unchanged (award-once invariant) | vitest |
| AC-PLAY-405 | REQ-PLAY-405 | Mission engine module imports no DOM/three.js (dependency-free pure logic; import graph assertion) | vitest + review |

## 2. Given-When-Then Scenarios

### Scenario 1 — "How big IS the sun?"
- **Given** the sun selected, kid view open
- **When** the child taps "크기 비교"
- **Then** the lineup shows Sun vs Earth at true ~109:1 representation, "태양에는 지구가 109개 들어가요!" renders big and is spoken aloud, and closing returns to the untouched solar view.

### Scenario 2 — Rocket to Mars
- **Given** Mars selected
- **When** the child taps "로켓 발사"
- **Then** a rocket arcs from Earth to Mars over a few real-time seconds (regardless of sim speed), lands on Mars even though Mars moved, sparkles burst with a chime, and "화성까지는 반년을 날아가야 해요!" is spoken.

### Scenario 3 — Daily mission loop
- **Given** today's missions include "고리가 있는 행성을 찾아보세요!" and Saturn's sticker is not yet earned
- **When** the child selects Saturn (via 3D tap, strip, or sidebar)
- **Then** celebration + "참 잘했어요!"-class praise plays, the 🪐 sticker flips to earned in the sticker book, and re-selecting Saturn later never duplicates the sticker.

### Scenario 4 — Quiet mode household
- **Given** the shared "소리" toggle is OFF
- **When** any celebration, rocket arrival, or mission completion occurs
- **Then** zero audio plays (no chime, no TTS), while all visual celebration/sticker behavior proceeds normally.

## 3. Edge Cases

- Rocket launched, then destination deselected mid-flight: flight cancels (REQ-PLAY-204) — no arrival fact for a body no longer selected.
- Rocket to the Moon (a moon, not planet): supported destination; path from Earth is short — duration clamp floor keeps it readable.
- Size comparison for Earth itself: compares to Sun only (Earth-vs-Earth skipped); button remains functional.
- Comparison for a star (STAR_DATA): allowed with Sun as reference where diameter data exists; otherwise button hidden for that body (data-driven eligibility).
- Midnight rollover while playing: mission set swaps on next rotation read; in-progress completion still awards against the mission that was active when the event fired.
- localStorage disabled entirely: missions playable in-memory for the session; stickers reset next visit (documented degradation, no crash).
- Two rapid camera-arrivals (fast re-selection): bursts pooled; second arrival cancels/reuses without pool exhaustion.

## 4. Quality Gate Criteria

- Full vitest suite green (`npm run test`); `npm run build` succeeds; no regression in existing suites.
- Mission/sticker/rotation/SFX-gating logic at the project's standard coverage bar; import-purity assertion for the engine.
- All Korean strings (missions, praise, travel facts) pass the KIDS-001 §8.1 authoring checklist.
- The single sanctioned open clarification (plan.md §A.1 size-compare approach) is resolved and recorded before Implementation Kickoff Approval.
- TRUST 5: Tested, Readable (data-driven catalogs, named budgets), Unified (src/audio + src/effects patterns), Secured (defensive localStorage parse; no external input), Trackable (conventional commits per milestone referencing SPEC-PLAY-001).

## 5. Definition of Done

- All AC-PLAY-1xx/2xx/3xx/4xx PASS; manual device pass (audio unlock, celebration feel, sticker book touch UX, reduced-motion sweep).
- depends_on gate satisfied (SPEC-KIDS-001 completed) before run-phase entry.
- Travel-fact + mission catalogs complete and checklist-reviewed.
- Honesty notes (schematic rocket, true-scale comparison) present in code comments.
