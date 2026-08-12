---
id: SPEC-MOBILE-001
title: "Touch selection correctness, kid-sized tap targets, DPR quality policy, and mobile planet icon strip"
version: "0.1.0"
status: completed
created: 2026-08-12
updated: 2026-08-12
author: limbowl
priority: P1
phase: "v1.1.0"
module: "src/controls + src/scene + src/ui"
lifecycle: spec-anchored
tier: M
tags: "touch, mobile, hig, tap-targets, device-pixel-ratio, performance, icon-strip, brownfield"
related_specs: [SPEC-UI-001, SPEC-SIM-001]
---

## HISTORY

- 2026-08-12 (v0.1.0): Initial draft. Covers proposal items 4 (touch selection fix + target sizes), 5 (DPR/quality policy), 6 (mobile planet icon strip). Contains one confirmed interaction defect (touchstart-selects-during-drag) fixed reproduction-first per TDD.

---

# SPEC-MOBILE-001: Touch Correctness + Kid-Sized Targets + DPR Policy + Icon Strip

## 1. Environment

### 1.1 Overview

The primary device is an iPhone 17 Pro-class phone (402×874 pt, 460ppi, 120Hz, A19 Pro GPU — a HIGH-end device) operated by a 5-year-old. Three problems block that combination today: (1) touch selection fires on `touchstart` with no movement guard, so starting an orbit drag on a body triggers an unwanted select + camera focus; (2) the static performance heuristic classifies ALL mobile devices as low-end and permanently blurs high-end iPhones at pixelRatio 1; (3) the only body selector besides the 3D scene is a text sidebar that is auto-hidden on ≤768px, and its touch targets are far below kid-friendly sizes.

### 1.2 Brownfield Facts (verified citations)

- `src/controls/InteractionManager.js:285-300` — `_onTouchStart` raycasts and selects immediately on `touchstart`, with NO movement guard and NO deselect-on-empty-tap branch. `event.touches.length !== 1` already exits multi-touch.
- `src/controls/InteractionManager.js:240-261` — the mouse path stores pointer-down position (`_onPointerDown`) and `_onClick` ignores the click when drag distance > 5px. This is the guard pattern the touch path must mirror.
- `src/scene/SceneManager.js:161-177` — `_detectPerformance`: `isMobile` = UA regex (`/Android|iPhone|iPad|iPod/i`), `lowEnd = isMobile || hardwareConcurrency <= 4`; lowEnd forces `setPixelRatio(1)` (renderer + composer), bloom 0.4/0.15, `textureCapEnabled`, `lodUpgradesDisabled`. This permanently blurs high-end iPhones.
- `src/scene/SceneManager.js:186` — a `FrameBudgetDegrader` (`src/utils/performance.js:48`) already sheds quality dynamically: solar steps `['bloom','lod','pixelRatio']` (`performance.js:34`), Earth steps `['aurora','bloom','lod','pixelRatio']` (`performance.js:40`), with `setSteps` swap support (`performance.js:71`) and existing unit tests (`src/utils/performance.test.js`).
- `src/scene/SceneManager.js:179-183` — a legacy fps-window degrader (mobile-only, one-way, drops post-processing after sustained sub-30fps) coexists.
- `src/ui/PlanetList.js` — items ~33px tall (8px padding, 13px font; mobile 6px/12px per `index.html:83-85`), collapse caret 14px wide, toggle button 36×36, auto-hidden on ≤768px (one-way).
- `src/ui/TimeControls.js` — play/reset buttons 40×40; bar fixed at `bottom: 0`.
- `src/planets/planetData.js` — every body has `nameKo` and a color; bodies are the shared registry an icon strip can be generated from.

## 2. Assumptions

- **A-201**: jsdom-dispatched `TouchEvent`s (or equivalent synthesized event objects) reach `InteractionManager` handlers; raycast can be stubbed at a seam so guard logic is testable without WebGL.
- **A-202**: `min(devicePixelRatio, 2)` with full bloom is sustainable on iPhone 17 Pro-class GPUs; where it is not (older devices), the FrameBudgetDegrader's `pixelRatio` step recovers the frame budget dynamically.
- **A-203**: `navigator.deviceMemory` is unavailable on iOS Safari; the static weak-device cap therefore keys on BOTH signals being observed-and-weak, and iPhones simply never match it.
- **A-204**: Apple HIG minimum target is 44×44 pt; the kid-friendly floor for primary selectors is 48px.

## 3. Requirements (GEARS)

### 3.1 T — Touch selection correctness + target sizes (proposal item 4)

**Unwanted behavior**

- **REQ-MOB-101**: The interaction layer shall not select, deselect, or focus any body on `touchstart`.

**Event-driven**

- **REQ-MOB-102**: **When** a single-finger touch ends having moved no more than the touch tap threshold from its start point, the interaction layer shall raycast at the touch position and select the hit body — mirroring the mouse path's drag-guard pattern (`InteractionManager.js:248-261`). The touch threshold is a named constant (default 8px, accommodating finger jitter; the mouse path keeps 5px).
- **REQ-MOB-103**: **When** a single-finger touch moves beyond the tap threshold before ending, the gesture shall remain orbit-only: no selection change occurs on release. Multi-touch gestures (pinch/two-finger) shall never change selection.
- **REQ-MOB-104**: **When** a qualifying tap (per REQ-MOB-102) hits empty space while a body is selected, the interaction layer shall deselect — matching the mouse path's empty-click behavior.

**Ubiquitous**

- **REQ-MOB-105**: Tap targets shall meet kid-friendly minimums: planet-list items ≥48px rendered height, all buttons (play/reset, list toggle, HUD toggles, 🔊/mute from SPEC-KIDS-001) ≥44×44px hit area, and the list collapse caret ≥32px hit area.

### 3.2 D — DPR / quality policy (proposal item 5)

**Ubiquitous**

- **REQ-MOB-201**: The renderer shall initialize with the default full-tier quality policy — `pixelRatio = min(window.devicePixelRatio, 2)` and full default bloom — subject only to the REQ-MOB-203 constrained-tier exception.
- **REQ-MOB-204**: The FrameBudgetDegrader shall remain the dynamic safety net (its existing `pixelRatio` step becomes the mechanism that sheds resolution under sustained over-budget frames), and all existing tests in `src/utils/performance.test.js` shall continue to pass unmodified in behavior.
- **REQ-MOB-205**: The quality-tier decision shall be a pure function of observed device signals (`devicePixelRatio`, `hardwareConcurrency`, `deviceMemory`), unit-testable, and `textureCapEnabled` / `lodUpgradesDisabled` shall derive from that tier — not from the UA-mobile classification.

**Unwanted behavior**

- **REQ-MOB-202**: The renderer shall not apply a blanket quality cap (pixelRatio 1, reduced bloom, texture cap, LOD-upgrade disable) from user-agent/mobile classification alone.

**Capability gate**

- **REQ-MOB-203**: **Where** genuinely weak signals are BOTH observed (`hardwareConcurrency ≤ 4` AND `deviceMemory ≤ 4` with `deviceMemory` actually available), the quality tier shall apply the conservative static cap (pixelRatio 1 + texture cap + LOD upgrades disabled). **Where** `deviceMemory` is unavailable, no static cap applies and the dynamic degrader alone protects the frame budget.

### 3.3 S — Mobile planet icon strip (proposal item 6)

**State-driven**

- **REQ-MOB-301**: **While** the viewport is ≤768px wide, the UI shall present a bottom horizontal, touch-scrollable strip of tappable body icons as the PRIMARY selector, positioned directly above the TimeControls bar; the text sidebar remains auto-hidden as today.
- **REQ-MOB-304**: **While** the viewport is >768px wide, the strip shall not be rendered and the desktop sidebar behavior is unchanged.

**Ubiquitous**

- **REQ-MOB-302**: Each strip item shall show a visual token (the body's `emoji` where present per SPEC-KIDS-001 shape, else a color dot from body data) with its Korean name beneath, and shall provide a ≥48px tap target.
- **REQ-MOB-303**: The strip and all other selection surfaces (3D tap, sidebar, InfoPanel) shall share one selection state bidirectionally: selecting anywhere highlights the strip item and scrolls it into view; selecting on the strip drives the same select/focus path as a 3D tap.
- **REQ-MOB-305**: The strip shall derive its item list from the same body registry as the sidebar (sun, planets, dwarf planets, stars — top-level bodies), so bodies added by later SPECs (e.g., SPEC-EVENTS-001's comet) appear without strip changes.

## 4. Solution Approach

- **Touch fix**: record touch-start position in `_onTouchStart` (no selection there), add `_onTouchEnd` applying the guard + raycast + select/deselect. Reproduction-first: a failing test reproducing "drag over a body selects it" is written BEFORE the fix (see acceptance AC-MOB-101 and plan.md §E).
- **DPR policy**: extract a pure `decideQualityTier(signals)` (new `src/utils/quality.js` or inside `performance.js` — run-phase choice), consumed by `SceneManager._detectPerformance`. UA-mobile remains ONLY for choosing the 30fps-vs-60fps frame budget of the degrader (`SceneManager.js:186`) and the legacy fps monitor — not for capping quality.
- **Icon strip**: new `src/ui/PlanetStrip.js` sharing the sidebar's data source and selection callback; CSS `overflow-x: auto` momentum scrolling; positioned above TimeControls (safe-area padding arrives with SPEC-PWA-001's `viewport-fit=cover` — the strip uses `env(safe-area-inset-bottom)` padding that harmlessly evaluates to 0 until then).

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Frame rate | DPR 2 + full bloom on iPhone-class: 60fps steady-state in solar view; degrader recovers within its existing over-budget window when exceeded |
| Input latency | Selection on touchend adds no perceptible delay (no 300ms-style heuristics, no double-tap wait) |
| Strip perf | Strip is DOM-only; no per-frame work; scroll uses native momentum |
| Regression | `src/utils/performance.test.js` green; desktop mouse behavior byte-identical |
| Accessibility | Strip items are buttons with Korean `aria-label`; strip scroll container keyboard-focusable on desktop-sized fallback (hidden anyway >768px) |
| Testability | Guard logic, tier decision, and strip selection-sync are pure/jsdom vitest targets |

## 6. Exclusions (What NOT to Build)

### Out of Scope — Gesture library

- No Hammer.js/pointer-gesture dependency. The guard is ~20 lines mirroring the existing mouse pattern.

### Out of Scope — Moons in the icon strip

- The strip lists top-level bodies only. Moon selection on mobile continues via the 3D scene (and the sidebar if the user reopens it); a moon-drilldown strip mode is future work.

### Out of Scope — Persistent quality settings UI

- No user-facing graphics-quality menu. The tier decision + dynamic degrader are automatic; a manual override is future work.

### Out of Scope — Safe-area/PWA metrics

- `viewport-fit=cover` and `env(safe-area-inset-*)` activation belong to SPEC-PWA-001; this SPEC only leaves the strip/controls CSS compatible with them.

### Out of Scope — Hover affordances on touch

- Touch hover tooltips / OutlinePass hover parity are not addressed here; the strip + InfoPanel + TTS (SPEC-KIDS-001) carry naming on touch devices.

## 7. Traceability (REQ → AC)

| Requirement | Module | Acceptance |
|-------------|--------|------------|
| REQ-MOB-101..105 | T | AC-MOB-101..105 |
| REQ-MOB-201..205 | D | AC-MOB-201..205 |
| REQ-MOB-301..305 | S | AC-MOB-301..305 |

## 8. Proposal Item Traceability (Appendix)

| Proposal item # | Item summary | REQ IDs |
|-----------------|--------------|---------|
| 4 | Touch selection fix (touchend + movement guard, reproduction-first) + kid target sizes | REQ-MOB-101, 102, 103, 104, 105 |
| 5 | DPR/quality policy (remove blanket mobile cap, min(dpr,2), degrader as safety net, conservative static cap only on weak signals) | REQ-MOB-201, 202, 203, 204, 205 |
| 6 | Mobile planet icon strip (bottom scrollable strip, ≥48px targets, shared selection state) | REQ-MOB-301, 302, 303, 304, 305 |
