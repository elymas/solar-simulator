---
id: SPEC-KIDS-001
title: "Korean-first UI, Korean TTS narration, and kid-friendly facts layer"
version: "0.1.0"
status: draft
created: 2026-08-12
updated: 2026-08-12
author: limbowl
priority: P1
phase: "v1.1.0"
module: "src/ui + src/audio + src/planets"
lifecycle: spec-anchored
tier: M
tags: "korean, i18n, tts, speech-synthesis, kids, info-panel, accessibility, brownfield"
related_specs: [SPEC-UI-001, SPEC-SIM-001, SPEC-EARTH-001, SPEC-EARTH-002]
---

## HISTORY

- 2026-08-12 (v0.1.0): Initial draft. Covers proposal items 1 (Korean-first UI), 2 (Korean TTS narration), 3 (kid facts data + kid info panel). First SPEC of the kids/mobile epic; SPEC-EVENTS-001, SPEC-EARTH-003, and SPEC-PLAY-001 declare `depends_on` on this SPEC (TTS module + facts data shape).

---

# SPEC-KIDS-001: Korean-first UI + TTS Narration + Kid Facts

## 1. Environment

### 1.1 Overview

The primary user is a 5-year-old Korean child who cannot read English and reads Korean only haltingly. Audio (Korean TTS) and pictures are his primary information channels. Today the app is English-first everywhere, has **no audio code of any kind** (grep-verified), and its data layer (`src/planets/planetData.js`) is purely numeric/scientific with no kid-comprehensible content. This SPEC makes Korean the primary language of every user-facing surface, adds a Korean text-to-speech narration layer, and adds an age-appropriate Korean facts dataset with a kid-first InfoPanel presentation.

### 1.2 Brownfield Facts (verified citations)

- `index.html:87-89` — a mobile media query hides Korean planet names entirely: `.planet-item-name-ko { display: none !important; }`. This is the exact inverse of the desired behavior and MUST be deleted.
- `index.html:14-17` — fonts are Inter + JetBrains Mono from Google Fonts CDN. **Neither family contains Hangul glyphs**; Korean text currently renders via unspecified system fallback. A Korean-capable fallback chain must be declared (webfont self-hosting decisions belong to SPEC-PWA-001).
- `src/planets/planetData.js` — PLANET_DATA (sun, 8 planets, 5 dwarfs incl. pluto), MOON_DATA (21 moons), STAR_DATA (4 stars). Every body already has `name` + `nameKo` (39 `nameKo` occurrences observed). NO `factsKo` / `sizeComparisonKo` fields exist (grep-verified empty).
- `src/ui/PlanetList.js` — sidebar title "Solar System", dividers "Dwarf Planets" / "Stars"; English-primary labels.
- `src/ui/InfoPanel.js` — all labels English ("Diameter", "Orbital Period", "Eccentricity", ...), values like "1.88 years", monospace scientific table.
- `src/ui/TimeControls.js` — labels "Speed" / "Date"; date display derived from epoch 2026-03-30 (`src/utils/constants.js:107`).
- `src/earth/EarthHUD.js` — all EarthHUD labels/buttons/flight-status strings English (LIVE/OFFLINE/LOADING states per SPEC-EARTH-002 REQ-480).
- `src/utils/eclipseData.js` — `getEclipseTypeInfo` (line 82) and `ECLIPSE_DIAGRAM_INTRO` (line 87) carry English eclipse-type explanations.
- No `speechSynthesis` / audio code exists anywhere in `src/` (grep-verified).
- iOS Safari TTS quirks (externally known, treated as assumptions A-103/A-104): voices load asynchronously via the `voiceschanged` event, and speech reliably starts only from a user-gesture call stack.

### 1.3 Position in the Epic

This is the **first SPEC of the epic**. It owns two shared contracts consumed by later SPECs:

1. **TTS module contract** — a narration API (speak / cancel / mute) consumed by SPEC-EVENTS-001 (alignment callout), SPEC-EARTH-003 (shower/ISS callouts), SPEC-PLAY-001 (praise, narration, shared sound toggle).
2. **Kid-facts data shape** — `factsKo: string[]`, `sizeComparisonKo: string`, `emoji: string` fields on body data, reused by SPEC-EVENTS-001 (comet, belts) and SPEC-EARTH-003 (ISS).

## 2. Assumptions

- **A-101**: `nameKo` values already present in `planetData.js` are correct and reusable as the primary label; no re-translation of body names is needed.
- **A-102**: System font fallback (Apple SD Gothic Neo on iOS, Noto Sans KR-class fonts elsewhere) renders Hangul legibly; a dedicated Korean webfont is NOT required for this SPEC (revisit under SPEC-PWA-001 if self-hosting).
- **A-103**: On iOS Safari, `speechSynthesis.getVoices()` may return an empty list until the `voiceschanged` event fires; at least one `ko-KR` voice (e.g., Yuna) is present on Korean-locale iOS devices.
- **A-104**: A tap on a planet (canvas touch/click) is a user gesture, satisfying iOS's gesture requirement for starting speech.
- **A-105**: The child understands spoken standard Korean at a typical 5-year-old level; facts are authored to that comprehension level (see §8 authoring criteria).

## 3. Requirements (GEARS)

### 3.1 K1 — Korean-first UI (proposal item 1)

**Ubiquitous**

- **REQ-KIDS-101**: The UI shall present the Korean name (`nameKo`) as the PRIMARY (visually dominant: first-positioned, larger type) label and the English name as the secondary label in the planet list items, the InfoPanel header, and the hover tooltip.
- **REQ-KIDS-103**: The UI shall render all chrome strings Korean-first: loading screen text, planet-list title ("태양계") and dividers ("왜소행성", "별"), InfoPanel property labels and units, TimeControls labels ("속도", "날짜"), and all EarthHUD labels, buttons, and flight-status strings (including the LIVE/LOADING/OFFLINE/RATE_LIMITED states and the empty-sky vs error distinction of SPEC-EARTH-002 REQ-480/490, re-expressed in Korean).
- **REQ-KIDS-104**: The eclipse explanation content (the type labels and descriptions surfaced from `src/utils/eclipseData.js` `ECLIPSE_TYPE_INFO` / `ECLIPSE_DIAGRAM_INTRO`) shall be rewritten in age-appropriate Korean (English secondary where useful).
- **REQ-KIDS-105**: Formatted values shall use Korean unit words (years → "년", days → "일", hours → "시간") and the TimeControls date display shall use the Korean date form ("YYYY년 M월 D일"); the CSS font stack shall include Korean-capable fallback families so Hangul never renders in a browser default serif.

**Unwanted behavior**

- **REQ-KIDS-102**: The stylesheet shall not hide Korean name elements at any viewport width. (The `index.html:87-89` rule `.planet-item-name-ko { display: none !important; }` is deleted; no equivalent rule may be reintroduced.)

### 3.2 K2 — Korean TTS narration (proposal item 2)

**Ubiquitous**

- **REQ-KIDS-201**: The audio layer shall provide a dedicated TTS wrapper module around `window.speechSynthesis` whose decision logic (voice selection, mute state, cancel-before-speak sequencing, availability detection) is a pure, dependency-injected surface unit-testable without a real browser speech engine.
- **REQ-KIDS-204**: The InfoPanel shall provide a 🔊 replay button that re-speaks the current body's narration on demand.
- **REQ-KIDS-207**: The audio layer shall provide a global mute toggle whose state persists to `localStorage` and is restored on boot.

**Event-driven**

- **REQ-KIDS-202**: **When** a body is selected via a user gesture (tap/click on the 3D scene, list, or strip), the audio layer shall speak the body's Korean name followed by one of its `factsKo` entries in a `ko-KR` voice.
- **REQ-KIDS-203**: **When** a new narration is requested while a previous utterance is still speaking or queued, the audio layer shall cancel the previous utterance before starting the new one.
- **REQ-KIDS-206**: **When** `window.speechSynthesis` is detected as unavailable, the audio layer shall no-op without throwing and the UI shall hide or disable all 🔊 affordances.

**State-driven**

- **REQ-KIDS-205**: **While** the platform voice list has not yet loaded (iOS Safari populates voices asynchronously via `voiceschanged`), the TTS wrapper shall defer voice binding and resolve a `ko-KR` voice once the list loads, so that the first selection tap after page load still produces speech. **Where** multiple `ko-KR` voices exist, the wrapper shall prefer a `ko-KR` voice deterministically (exact preference order is a run-phase constant).
- **REQ-KIDS-208**: **While** the global mute is ON, the audio layer shall not start any utterance (selection, replay, or cross-SPEC callouts routed through this module).

### 3.3 K3 — Kid facts data + kid info panel (proposal item 3)

**Ubiquitous**

- **REQ-KIDS-301**: The body data shall carry three new fields — `factsKo` (exactly 3 short Korean facts at 5-year-old comprehension level), `sizeComparisonKo` (one Korean size-comparison sentence, e.g. "지구 11개를 나란히 놓으면 목성 폭!"), and `emoji` (one visual emoji) — for every PLANET_DATA body (sun + 8 planets + 5 dwarfs), for at least these major moons: moon, io, europa, ganymede, callisto, titan, enceladus, phobos, deimos, triton, charon, and for all 4 STAR_DATA stars.
- **REQ-KIDS-302**: The InfoPanel shall present the kid view FIRST: big Korean name, the body emoji, the `factsKo` entries in large type (minimum 18px rendered size on a 402pt-wide viewport), the `sizeComparisonKo` sentence, and the 🔊 replay button.
- **REQ-KIDS-303**: The existing scientific data table shall remain available behind a "자세히 보기" expander that is collapsed by default and toggles without closing the panel.
- **REQ-KIDS-304**: All `factsKo` / `sizeComparisonKo` content shall satisfy the authoring criteria and review checklist in §8 (age-appropriate, factually correct, numerically consistent with the scientific data fields).
- **REQ-KIDS-305**: A unit test shall mechanically enforce facts completeness: every body in the REQ-KIDS-301 required set has `factsKo.length === 3` with non-empty strings, a non-empty `sizeComparisonKo`, and a non-empty `emoji`.

## 4. Solution Approach

- `[NEW] src/audio/` module boundary for all sound work (TTS here; SPEC-PLAY-001 adds SFX beside it). The TTS wrapper holds a reference to an injected `speechSynthesis`-shaped backend, exposing `speak(text)`, `cancel()`, `setMuted(bool)`, `isAvailable()`, and voice resolution that subscribes to `voiceschanged` once.
- `[NEW]` a single UI-strings module (Korean-first constants) so chrome translation is one sweep, not scattered literals; components import labels instead of embedding English strings.
- `[EXTEND] src/planets/planetData.js` with `factsKo` / `sizeComparisonKo` / `emoji` per REQ-KIDS-301 (data-only change; numeric/scientific fields untouched).
- `[MODIFY] src/ui/InfoPanel.js` for the kid-first layout + "자세히 보기" expander + 🔊 button; `[MODIFY] src/ui/PlanetList.js` for Korean-primary labels; `[MODIFY] index.html` to delete lines 87-89 and extend the font stack; `[MODIFY] src/ui/TimeControls.js`, `src/earth/EarthHUD.js`, `src/utils/eclipseData.js` display strings.
- Mute toggle surfaced as a persistent 🔊/🔇 button (placement: TimeControls bar; target sizes governed by SPEC-MOBILE-001).

Full file-touch list and milestone ordering: see plan.md.

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Rendering perf | Text/DOM-only changes; no new per-frame 3D cost. TTS runs off the render loop. |
| Legibility | Kid-view fact type ≥18px at 402pt width; Korean primary labels ≥ the size of the former English primary. |
| Font | Korean-capable fallback chain declared; no FOUC regression for Latin text. |
| Robustness | TTS wrapper never throws on missing/partial `speechSynthesis`; utterance errors are swallowed (narration is enhancement, never blocking). |
| Persistence | Mute state survives reload (`localStorage`), single namespaced key. |
| Accessibility | Mute toggle and 🔊 button have `aria-label` in Korean; `prefers-reduced-motion` unaffected (no new animation). |
| Testability | TTS decision logic, strings completeness, and facts completeness are pure-logic vitest targets (jsdom, no real speech engine). |

## 6. Exclusions (What NOT to Build)

### Out of Scope — Full i18n framework

- No locale-switching framework, no runtime language toggle, no translation files per locale. Korean-first with English-secondary is a fixed presentation policy, not a configurable i18n system.

### Out of Scope — Korean webfont self-hosting

- Declaring a Korean-capable system-font fallback chain is in scope; shipping/self-hosting a Korean webfont (e.g., Noto Sans KR) is NOT — font delivery strategy belongs to SPEC-PWA-001.

### Out of Scope — Recorded voice audio

- No pre-recorded narration files. TTS via `speechSynthesis` only; where unavailable, the app degrades to silent text (REQ-KIDS-206).

### Out of Scope — Facts for every minor moon

- Only the REQ-KIDS-301 enumerated set gets facts. The remaining minor moons keep name-only display; their InfoPanel shows the kid view with facts omitted gracefully.

### Out of Scope — Sound effects

- Chimes, sparkle sounds, and the Web Audio SFX engine are SPEC-PLAY-001 scope. This SPEC ships only speech and the shared mute contract.

## 7. Traceability (REQ → AC)

| Requirement | Module | Acceptance |
|-------------|--------|------------|
| REQ-KIDS-101, 102, 103, 104, 105 | K1 | AC-KIDS-101..105 |
| REQ-KIDS-201..208 | K2 | AC-KIDS-201..208 |
| REQ-KIDS-301..305 | K3 | AC-KIDS-301..305 |

## 8. Facts Authoring Criteria + Seed Set

### 8.1 Authoring criteria (binding for every factsKo / sizeComparisonKo entry)

1. **Length**: each fact ≤ 45 Korean characters, one clause, 해요체 (polite, warm).
2. **Vocabulary**: no jargon beyond 별/행성/위성/왜소행성; no English loanwords unless universally known (로봇, 로켓).
3. **Truth**: every quantitative claim must be consistent (±10%) with the scientific fields already in `planetData.js` (diameter, orbital period, etc.) or a cited well-known astronomical fact.
4. **Tone**: wonder-positive; no fear content (no "지구가 멸망", no scary asteroid framing).
5. **Size comparisons**: `sizeComparisonKo` must contain a concrete count/ratio a child can picture, numerically derived from real diameters (NOT display radii, which are symbolic).
6. **Review checklist** (acceptance-gate): native-Korean read-aloud pass; per-fact truth check against data fields; length check; emoji renders on iOS.

### 8.2 Seed entries (canonical tone anchors — remaining bodies authored in run phase against §8.1)

| Body | emoji | factsKo (3) | sizeComparisonKo |
|------|-------|-------------|------------------|
| sun 태양 | ☀️ | "태양은 스스로 빛나는 별이에요." / "태양이 있어서 지구가 따뜻해요." / "절대 맨눈으로 오래 보면 안 돼요!" | "태양 지름은 지구 109개를 나란히 놓은 만큼이에요!" |
| earth 지구 | 🌍 | "우리가 사는 곳이에요." / "물이 많아서 파랗게 보여요." / "하루에 한 바퀴 스스로 돌아요." | "지구는 달보다 4배쯤 커요!" |
| moon 달 | 🌕 | "밤하늘에서 가장 밝게 보여요." / "달에는 공기가 없어요." / "사람이 직접 가 본 유일한 다른 세계예요." | "달 4개를 나란히 놓으면 지구 폭이에요!" |
| mars 화성 | 🔴 | "붉은 먼지로 덮여 있어서 빨갛게 보여요." / "태양계에서 가장 큰 화산이 있어요." / "로봇 탐사차가 화성을 달리고 있어요." | "화성은 지구의 절반 크기예요!" |
| jupiter 목성 | 🟠 | "태양계에서 가장 큰 행성이에요." / "커다란 빨간 점은 아주 큰 폭풍이에요." / "위성을 아주 많이 가지고 있어요." | "지구 11개를 나란히 놓으면 목성 폭!" |
| pluto 명왕성 | 🤍 | "아주 멀고 추운 작은 왜소행성이에요." / "하트 모양 무늬가 있어요." / "명왕성의 1년은 지구의 248년이에요." | "명왕성은 달보다 작아요!" |

## 9. Proposal Item Traceability (Appendix)

| Proposal item # | Item summary | REQ IDs |
|-----------------|--------------|---------|
| 1 | Korean-first UI (primary Korean labels, delete nameKo-hiding CSS, translate all chrome) | REQ-KIDS-101, 102, 103, 104, 105 |
| 2 | Korean TTS narration (wrapper module, selection speech, replay, mute, graceful no-op) | REQ-KIDS-201, 202, 203, 204, 205, 206, 207, 208 |
| 3 | Kid facts data + kid info panel (factsKo/sizeComparisonKo/emoji, kid-first panel, expander) | REQ-KIDS-301, 302, 303, 304, 305 |
