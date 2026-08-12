---
id: SPEC-PLAY-001
title: "Play and engagement layer: size comparison, rocket journey, celebration effects and sounds, missions and stickers"
version: "0.1.0"
status: draft
created: 2026-08-12
updated: 2026-08-12
author: limbowl
priority: P2
phase: "v1.1.0"
module: "src/play + src/effects + src/audio + src/ui"
lifecycle: spec-anchored
tier: M
tags: "play, engagement, size-comparison, rocket, celebration, web-audio, missions, stickers, localstorage, brownfield"
depends_on: [SPEC-KIDS-001]
related_specs: [SPEC-UI-001, SPEC-SIM-001, SPEC-MOBILE-001]
---

## HISTORY

- 2026-08-12 (v0.1.0): Initial draft. Covers proposal items 12 (size comparison mode), 13 (rocket journey mini-event), 14 (celebration effects + sounds), 17 (missions & stickers). Depends on SPEC-KIDS-001 (TTS channel, shared sound toggle, facts/size data). Carries one sanctioned open decision: size-comparison implementation approach (plan.md).

---

# SPEC-PLAY-001: Play & Engagement Layer

## 1. Environment

### 1.1 Overview

The simulator is currently an observation tool: look, select, read. For a 5-year-old, delight comes from DOING and being rewarded. This SPEC adds four play loops: a size-comparison lineup ("how many Earths fit?"), a rocket journey mini-event from Earth to a chosen body, celebration effects with sound on arrivals and discoveries, and a daily missions + sticker-book progression that gives return visits a purpose.

### 1.2 Brownfield Facts (verified citations)

- **No audio code of any kind exists** (grep-verified; SPEC-KIDS-001 introduces the first audio module — TTS — and the shared mute contract this SPEC extends to SFX).
- `src/planets/planetData.js` — bodies carry real scientific diameters (the honest basis for size comparison; display radii are symbolic and must NOT be used for ratios). SPEC-KIDS-001 adds `sizeComparisonKo` (count facts like "태양에는 지구가 109개 들어가요!") and `emoji`.
- `src/core/ViewManager.js` — SOLAR/EARTH state machine, single rAF, crossfade transitions, `prefers-reduced-motion` honored, frozen View interface (additions must mount into existing scenes/layers — no ViewManager contract change).
- Camera focus flow (SPEC-UI-001/SIM-001): selecting a body flies the camera to it — the "camera-arrival" event that celebrations hook.
- `localStorage` is already the persistence mechanism precedent (SPEC-KIDS-001 mute key); missions/stickers persist the same way, namespaced.
- `src/utils/performance.js:48` — FrameBudgetDegrader; celebration effects must be intrinsically cheap (pooled one-shots) or register with the ladder.

## 2. Assumptions

- **A-501**: SPEC-KIDS-001 is completed first (`depends_on`): TTS `speak()`, the persisted sound toggle ("소리"), `sizeComparisonKo`/`emoji` data exist.
- **A-502**: Web Audio API (`AudioContext`) is available on target browsers; iOS requires resume/unlock from a user gesture — the same gesture rule the TTS module already obeys (a selection tap unlocks both).
- **A-503**: Short synthesized chimes (or ≤3 tiny bundled samples) are sufficient; no music/loop audio is desired.
- **A-504**: Real diameter fields in planetData are accurate enough for count facts (±10% honesty window per KIDS-001 §8.1).
- **A-505**: Daily-mission rotation keys off the REAL calendar date (`Date.now()`), not sim time — "daily" means the child's real day.

## 3. Requirements (GEARS)

### 3.1 SIZE — Size comparison mode (proposal item 12)

**Event-driven**

- **REQ-PLAY-101**: **When** the "크기 비교" entry point (button in the InfoPanel kid view) is activated for the selected body, the UI shall present a lineup visualization showing the selected body beside Earth (and beside the Sun where the comparison is meaningful) at TRUE relative diameter scale, with the count fact rendered large (e.g. "태양에는 지구가 109개 들어가요!") and spoken via the shared TTS channel.
- **REQ-PLAY-103**: **When** the comparison view is dismissed (close button / back), the UI shall return to the prior view state without disturbing the 3D scene or selection.

**Ubiquitous**

- **REQ-PLAY-102**: Size ratios in the comparison shall derive from the REAL diameter fields in `planetData.js` (never from symbolic display radii), and the rendered widths shall match those ratios within 5%.

**State-driven**

- **REQ-PLAY-104**: **While** `prefers-reduced-motion` is set, the comparison shall present without animated transitions (instant layout).

### 3.2 ROCKET — Rocket journey mini-event (proposal item 13)

**Event-driven**

- **REQ-PLAY-201**: **When** the "로켓 발사" entry point is activated with a destination body selected (any planet, the Moon, or a dwarf planet — not Earth itself, not stars), the scene shall launch a small rocket from Earth that travels along a curved schematic path to the destination over a short scripted real-time animation (seconds-scale, independent of simulation speed).
- **REQ-PLAY-202**: **When** the rocket arrives, the UI shall present an arrival celebration (REQ-PLAY-301 effects) plus a destination-specific Korean travel fact (e.g. Mars: "화성까지는 반년을 날아가야 해요!") spoken via TTS; travel facts shall be data-driven per destination.
- **REQ-PLAY-204**: **When** the user selects another body, switches view, or relaunches during a flight, the in-flight rocket shall cancel cleanly (no orphaned meshes, no stuck state).

**Ubiquitous**

- **REQ-PLAY-203**: The rocket path shall be explicitly schematic — a stylized curve, NOT a physical transfer orbit — and this honesty shall be stated in code comments and the spec (this sentence); travel-duration FACTS spoken to the child reference real approximate travel times (data-driven table), while the ANIMATION is seconds-scale.

**State-driven**

- **REQ-PLAY-205**: **While** `prefers-reduced-motion` is set, the flight animation shall be skipped: the rocket event degrades to the arrival presentation (fact + TTS + static celebration).

### 3.3 FX — Celebration effects + sounds (proposal item 14)

**Event-driven**

- **REQ-PLAY-301**: **When** the camera arrival at a newly selected body completes, the scene shall play a brief sparkle particle burst at the body and a short chime.
- **REQ-PLAY-302**: **When** a star (STAR_DATA body) is tapped, the scene shall play a twinkle effect at the star (with its chime), distinct from the planet sparkle.

**Ubiquitous**

- **REQ-PLAY-303**: All SFX shall play through a Web Audio wrapper module in `src/audio/` (synthesized or tiny bundled samples — plan.md decision), gated by the SAME persisted sound toggle as TTS (SPEC-KIDS-001 mute contract: one "소리" toggle governs speech AND effects), and unlocked from the first user gesture on iOS.
- **REQ-PLAY-305**: Celebration particles shall be pooled one-shot effects with a fixed budget, auto-disposing to the pool; where measured cost exceeds the trivial threshold, they register with the FrameBudgetDegrader ladder instead of being assumed cheap.

**State-driven**

- **REQ-PLAY-304**: **While** `prefers-reduced-motion` is set, celebrations shall emit no particles and no camera shake (chime + static highlight only).

### 3.4 MISSION — Missions & stickers (proposal item 17)

**Ubiquitous**

- **REQ-PLAY-401**: The play layer shall provide a data-driven mission catalog in Korean (each mission: id, promptKo, completion predicate type + params, sticker id, emoji); a deterministic daily rotation (keyed by real calendar date) selects the day's mission set (default 3) — same date, same missions.
- **REQ-PLAY-403**: Earned stickers shall persist in `localStorage` (namespaced key), survive reload (round-trip), and be presented in a sticker-book overlay UI: a grid showing earned stickers vivid and locked stickers as silhouettes/placeholders.
- **REQ-PLAY-405**: Mission state (today's missions, per-mission completion, sticker inventory) shall be a pure state machine module — rotation, predicate evaluation, award, persistence serialization all unit-testable without DOM or renderer.

**Event-driven**

- **REQ-PLAY-402**: **When** app events occur (body selected, view entered, comparison opened, rocket arrived, eclipse/alignment/shower witnessed where those SPECs are present), the mission engine shall evaluate the active missions' completion predicates against a normalized event stream.
- **REQ-PLAY-404**: **When** a mission completes, the UI shall celebrate (REQ-PLAY-301 path) with TTS praise (e.g. "참 잘했어요! 스티커를 받았어요!"), award the sticker exactly once (no duplicate award for an already-earned sticker), and mark the mission done for the day.

## 4. Solution Approach

- `[NEW] src/play/` module boundary: `missions.js` (catalog + rotation + predicates + state machine, pure), `stickers.js` (persistence + inventory, pure), `StickerBook.js` (overlay UI), plus entry-point buttons in the InfoPanel kid view ("크기 비교", "로켓 발사") and a sticker-book toggle.
- `[NEW] src/audio/sfx.js` beside KIDS-001's `tts.js`: tiny Web Audio wrapper (unlock-on-gesture, gain node, mute shared via the same persisted setting), 3 sounds: chime (arrival), twinkle (star), fanfare (mission/rocket).
- `[NEW] src/effects/Celebration.js`: pooled sparkle burst (one-shot particle pool, reused), star twinkle variant.
- **Size comparison**: implementation approach (dedicated overlay scene vs 2D canvas/DOM) is an open plan.md decision (sanctioned). The REQs above pin only observable behavior, so either implementation satisfies them.
- **Rocket**: small mesh/sprite following a quadratic-bezier from Earth's current position to the destination's current position (endpoints re-sampled during flight so it lands on the moving body), real-time clock (`performance.now()`), cancel hooks on selection/view change.
- **Event stream**: a minimal `emitPlayEvent(type, payload)` seam called from existing selection/arrival/view hooks; the mission engine subscribes. (Events, not polling — testable with synthetic streams.)

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Frame rate | Celebrations are ≤1s pooled one-shots; rocket is one animated object; no steady-state frame cost when idle |
| Audio | SFX ≤0.5s each; total bundled sample payload (if samples chosen) ≤50KB; no audio on muted toggle; no AudioContext warnings (gesture unlock) |
| Persistence | Sticker/mission state resilient to corrupt localStorage (defensive parse → reset to empty inventory, never crash) |
| Honesty | Size ratios true-scale ±5%; rocket path explicitly schematic; travel facts approximate real durations |
| Accessibility | Reduced-motion variants for every animated element (REQ-PLAY-104/205/304); sticker book keyboard/tap accessible; Korean `aria-label`s |
| Testability | Missions/stickers/rotation/predicates/SFX-gating: pure vitest targets; UI overlays jsdom-testable |

## 6. Exclusions (What NOT to Build)

### Out of Scope — Accounts, sync, or server-side progress

- Stickers/missions live in `localStorage` only. No profiles, no cloud sync, no multi-device merge.

### Out of Scope — Physical transfer-orbit simulation

- The rocket is a scripted schematic animation (REQ-PLAY-203). No Hohmann transfers, no launch windows, no delta-v.

### Out of Scope — Background music / audio loops

- Only short one-shot SFX and TTS. No soundtrack, no ambient loop, no volume mixer UI (the single shared toggle suffices).

### Out of Scope — Mission editor / remote mission updates

- The mission catalog is static data in the bundle; adding missions is a code change, not a CMS.

### Out of Scope — Reward economies

- No points, streaks, levels, or unlock trees. Stickers are flat collectibles; missions rotate; nothing is purchasable or expirable.

## 7. Traceability (REQ → AC)

| Requirement | Module | Acceptance |
|-------------|--------|------------|
| REQ-PLAY-101..104 | SIZE | AC-PLAY-101..104 |
| REQ-PLAY-201..205 | ROCKET | AC-PLAY-201..205 |
| REQ-PLAY-301..305 | FX | AC-PLAY-301..305 |
| REQ-PLAY-401..405 | MISSION | AC-PLAY-401..405 |

## 8. Mission Catalog Seed (canonical tone anchors — final catalog authored in run phase against KIDS-001 §8.1 criteria)

| id | promptKo | predicate | sticker |
|----|----------|-----------|---------|
| find-rings | "고리가 있는 행성을 찾아보세요!" | select body ∈ {saturn} | 🪐 |
| find-red | "빨간 행성을 찾아보세요!" | select body ∈ {mars} | 🔴 |
| find-biggest | "가장 큰 행성을 찾아보세요!" | select body ∈ {jupiter} | 🟠 |
| visit-moon | "달에 놀러 가 보세요!" | select body ∈ {moon} | 🌕 |
| earth-home | "우리가 사는 행성을 찾아보세요!" | select body ∈ {earth} | 🌍 |
| rocket-any | "로켓을 발사해 보세요!" | rocket-arrived (any destination) | 🚀 |
| compare-sun | "태양이 얼마나 큰지 비교해 보세요!" | size-compare opened with sun | ☀️ |
| earth-view | "지구 구경을 해 보세요!" | enter EARTH view | 🌏 |
| find-dwarf | "명왕성을 찾아보세요!" | select body ∈ {pluto} | 🤍 |
| watch-star | "반짝이는 별을 눌러 보세요!" | select body ∈ STAR_DATA | ⭐ |

## 9. Proposal Item Traceability (Appendix)

| Proposal item # | Item summary | REQ IDs |
|-----------------|--------------|---------|
| 12 | Size comparison mode ("크기 비교" lineup, true ratios, TTS, approach = plan decision) | REQ-PLAY-101, 102, 103, 104 |
| 13 | Rocket journey mini-event (schematic curved flight, arrival fact + celebration, cancel-safe, reduced-motion) | REQ-PLAY-201, 202, 203, 204, 205 |
| 14 | Celebration effects + sounds (sparkle burst + chime, star twinkle, Web Audio, shared sound toggle, pooled) | REQ-PLAY-301, 302, 303, 304, 305 |
| 17 | Missions & stickers (data-driven daily missions, completion predicates, localStorage stickers, sticker book, praise) | REQ-PLAY-401, 402, 403, 404, 405 |
