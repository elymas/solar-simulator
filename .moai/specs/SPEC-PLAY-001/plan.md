# Implementation Plan — SPEC-PLAY-001

Sections ordered by decision-reversibility: most-likely-to-change decisions first.

## A. Key Decisions (highest change-likelihood first)

### A.1 Size-comparison implementation approach — RESOLVED (Option B)

DECISION (2026-08-12, decided by: user via AskUserQuestion round): **Option B — 2D DOM/canvas count-representation lineup.** Rationale: the count-fact maps 1:1 to the spoken fact; near-zero GPU cost; extreme ratios stay renderable. The trade-off table below is retained as the decision record (both options satisfy the approach-neutral REQ-PLAY-10x, which stay untouched):

| Axis | Option A — Three.js overlay mini-scene | Option B — 2D DOM/canvas lineup |
|------|----------------------------------------|--------------------------------|
| Look | Real textured spheres side by side (wow factor, reuses PlanetFactory materials) | Flat circles/emoji + big type (poster-like clarity) |
| Cost | A second scene/render pass while open; texture memory already loaded | Near-zero GPU; pure DOM |
| Effort | Medium (scene lifecycle, camera framing for extreme ratios) | Low (layout + CSS) |
| Extreme ratios (sun vs mercury ≈ 285:1) | Hard — tiny body becomes sub-pixel; needs split-scale tricks or scrolling | Easy — horizontal scroll of a to-scale strip, or "N개가 들어가요" repeated-icon representation |
| Kid comprehension | Photorealistic but scale still hard to read | Count-based representation ("지구 11개" rendered as 11 little Earths in a row) maps directly to the spoken fact |

Decision confirmed as Option B (see record above); Option A is retained in the table for provenance only.

### A.2 SFX source — synthesized vs tiny samples (second plan decision, bounded)

Chosen default: **synthesized via Web Audio oscillators/envelopes** (zero payload, no asset pipeline, 3 sounds ≈ 60 lines); bundled samples (≤50KB total) remain the documented fallback if synthesized chimes sound too harsh on device review at M4. This is a bounded default, not an open clarification — the mission sanctions only the size-compare and PWA-font decisions as open markers.

### A.3 Mission predicate vocabulary (data model — cross-feature contract)

Predicates are DATA, not functions: `{ type: 'select', bodies: [...] }`, `{ type: 'view', view: 'EARTH' }`, `{ type: 'action', action: 'rocket-arrived' | 'size-compare' }`. The engine maps event stream → predicate matching. Rationale: serializable catalog, trivially unit-tested, extensible by later SPECs (EVENTS-001 alignment / EARTH-003 shower events can become mission types by ADDING event emissions — the engine needs no change). Event names normalized: `{ type: 'select', body }, { type: 'view-enter', view }, { type: 'rocket-arrived', body }, { type: 'size-compare', body }`.

### A.4 Daily rotation determinism

`missionsForDate(dateString, catalog)` → stable subset of 3 via seeded shuffle keyed on `YYYY-MM-DD`. Completing all 3 shows a "내일 또 만나요!" state (no infinite re-rolls — return-visit cadence is the point, A-505). Already-earned stickers can re-complete missions (praise fires) but never duplicate inventory (REQ-PLAY-404).

### A.5 Rocket path + moving-target landing

Quadratic bezier: P0 = Earth position at launch, P2 = destination's LIVE position (re-read each frame), P1 = control point above the ecliptic at launch time (arc height ∝ distance). The path bends toward the moving target because P2 is live — guaranteeing touchdown without predictive math. Flight duration: clamp(2.5s + distance-scaled, ≤6s), real-time. Cancel = dispose rocket + clear timer hooks (REQ-PLAY-204 seams: selection change, view change, relaunch).

### A.6 Shared sound-toggle contract (extends KIDS-001)

`sfx.js` reads/writes the SAME persisted setting as `tts.js` (single source; KIDS-001 owns the key). One "소리" toggle = both channels (mission requirement). iOS unlock: first qualifying user gesture calls `AudioContext.resume()` AND primes TTS — one shared unlock hook exported from `src/audio/`.

## B. Trade-off Notes (beyond A.1/A.2)

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Mission triggering | Normalized event stream seam | Polling app state per frame | Events are testable with synthetic streams; polling couples the engine to live scene internals |
| Sticker persistence shape | Single JSON blob under one namespaced key | One key per sticker | Atomic read/parse/validate; corrupt-state reset is one code path |
| Praise channel | TTS praise + celebration reuse | Dedicated reward modal | A modal interrupts a 5-year-old's flow; celebration+voice is the reward vocabulary the app already teaches |
| Rocket visual | Tiny mesh/sprite + emissive trail | Detailed rocket model asset | No asset pipeline exists; a bright dart with a trail reads perfectly at scene scale |
| Sticker book access | Toggle button (🏆-style) near existing UI chrome | Auto-popup on completion | Auto-popups fight the celebration moment; the book is a place the child chooses to visit |

## C. Milestones (phase ordering; priority labels)

| M | Scope | Priority |
|---|-------|----------|
| M0 | A.1 resolved 2026-08-12 (Option B) — no remaining action | High |
| M1 | Mission engine + sticker persistence (pure, tests FIRST: rotation determinism, predicate matching, award-once, corrupt-storage reset) | High |
| M2 | Size-comparison view per A.1 decision + "크기 비교" entry + TTS wiring | High |
| M3 | SFX module (synthesized default) + shared-toggle gating + iOS unlock hook; Celebration pooled burst + star twinkle; camera-arrival hook | Medium |
| M4 | Rocket journey: path/flight (pure path math tested) + entry point + arrival fact table + cancel seams; device audio review (A.2 fallback check) | Medium |
| M5 | Sticker book overlay + mission HUD surfacing (today's missions) + praise flow end-to-end | Medium |
| M6 | Full regression + build + device pass (gesture unlock, reduced-motion variants, localStorage round-trip on real Safari) | High |

## D. File-Touch List

**New**
- `src/play/missions.js` (+ `missions.test.js`)
- `src/play/stickers.js` (+ `stickers.test.js`)
- `src/play/StickerBook.js` (+ jsdom test)
- `src/play/SizeCompare.js` (name holds for either A.1 option) (+ test)
- `src/play/RocketJourney.js` (+ path-math test)
- `src/audio/sfx.js` (+ `sfx.test.js` — gating/unlock logic with fake AudioContext)
- `src/effects/Celebration.js` (+ pool logic test)

**Modified**
- `src/ui/InfoPanel.js` (kid-view buttons: "크기 비교", "로켓 발사")
- `src/main.js` / selection+arrival hooks (emitPlayEvent seam, celebration trigger on camera-arrival, unlock hook)
- `src/ui/strings.js` (KIDS-001 module: play-layer strings)
- `src/planets/planetData.js` OR `src/play/travelFacts.js` (destination travel-fact table — co-located with rocket module preferred to keep planetData purely astronomical; final call at run phase)
- `index.html` (sticker book / mission chip base CSS)

## E. Test Strategy (TDD)

- **Pure targets (tests first)**: rotation (same date → same 3; different date → different subset; catalog < 3 handled), predicate matching per type, award-once invariant, corrupt/absent localStorage → clean reset, SFX gating (muted → zero plays; unlock-before-play ordering), bezier path (starts at P0, ends within ε of live P2, apex above ecliptic), size-ratio math (diameter fields → rendered ratio within 5%).
- **jsdom**: InfoPanel buttons render for eligible bodies (no 로켓 for Earth/stars), sticker book grid earned/locked states, mission chip display.
- **Manual/device**: audio quality (A.2 checkpoint), gesture unlock on iOS, celebration feel, rocket readability at 120Hz, reduced-motion sweep.

## F. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AudioContext unlock races TTS unlock on first tap | Single shared unlock hook in `src/audio/` invoked from the same gesture handler; both channels primed together |
| Extreme size ratios unreadable (sun vs mercury) | A.1 decision explicitly weighs this; Option B's count-representation sidesteps it; if Option A chosen, spec ratio ±5% still binds only rendered relative widths, allowing split-panel framing |
| Mission predicates coupling to not-yet-built events (alignment, shower) | Seed catalog (spec §8) uses ONLY base events; cross-SPEC mission types are additive later |
| localStorage quota/corruption | Defensive parse → reset inventory + console-silent; tested |
| Celebration bursts during degraded frames | Pool budget small (≤200 particles/burst); if M6 profiling shows cost, register a 'celebration' shed step (REQ-PLAY-305 escape hatch) |
| Rocket flying during view switch to EARTH | Cancel seam on view change (REQ-PLAY-204); test |

## G. Cross-SPEC Notes

- `depends_on: SPEC-KIDS-001` — TTS praise/narration, shared "소리" toggle (KIDS owns the persisted key), `sizeComparisonKo` count facts, InfoPanel kid view hosting the entry buttons.
- SPEC-MOBILE-001 — entry buttons + sticker book targets inherit ≥44px sizing; strip selection events feed the same mission event stream automatically.
- SPEC-EVENTS-001 / SPEC-EARTH-003 — optional future mission types (witness alignment/shower) become one-line event emissions + catalog entries; no engine change (A.3).

Open markers: none — the §A.1 size-comparison clarification was resolved 2026-08-12 (Option B, user decision via AskUserQuestion).
