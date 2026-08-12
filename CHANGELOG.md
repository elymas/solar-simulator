# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Halley's Comet (핼리 혜성) — a selectable body on a genuinely eccentric orbit that dives from beyond the outermost dwarf planet to well inside Mercury and back, trailing a tail that always streams directly away from the sun and grows brighter and longer as it nears perihelion. The orbit keeps real Halley's eccentricity (0.967) and retrograde inclination (162.3°); only its size and period are display-scaled — 700 display units and 7.6 simulation years instead of 76 — so a child watching at ordinary speeds actually sees a perihelion pass rather than waiting hours for one. It appears under a new "혜성" divider in the planet list and on the mobile strip, with Korean kid facts and a spoken narration on selection. (SPEC-EVENTS-001)
- Asteroid belt and Kuiper belt — two rock fields rendered as instanced meshes: a dense band between Mars and Jupiter, and a sparser, thicker, slower ring out beyond Neptune. Individual rocks drift at speeds derived from their distance from the sun, so each ring shears over time rather than turning like a solid disc. The rocks are scenery and are deliberately not tappable in the 3D view — dragging or tapping across a belt never selects a rock — but "소행성대" and "카이퍼 벨트" appear in the planet list and mobile strip under a new "띠" divider, and selecting one frames the ring with the camera and reads out its Korean facts. On devices that fall behind their frame budget the belts thin out first, before the app touches sun glow, level of detail, or resolution; devices that boot into the constrained quality tier start with the thinner fields. (SPEC-EVENTS-001)
- Planetary alignment celebration — when four or more planets gather within a 30° wedge of sky as seen from the sun, a banner reading "행성들이 줄을 섰어요!" appears once with a spoken callout, then dismisses itself. It will not fire again until the planets drift apart past 40°, so a formation hovering on the edge cannot make the banner flicker. The banner is announced to screen readers (`aria-live="polite"`) and presents without animation when the system asks for reduced motion. (SPEC-EVENTS-001)
- Mobile planet icon strip (`src/ui/PlanetStrip.js`) — a bottom, horizontally-scrollable strip of tappable body icons that becomes the PRIMARY body selector at viewport widths ≤768px, positioned directly above the time-controls bar. Selection is synced bidirectionally with 3D-scene taps and the desktop sidebar: selecting anywhere highlights the strip item and scrolls it into view, and tapping the strip drives the same select/focus path as a 3D tap. Item list is generated from the shared body registry, so bodies added by later SPECs appear automatically. (SPEC-MOBILE-001)

### Changed

- Render quality tier is now decided from observed device signals (`devicePixelRatio`, `hardwareConcurrency`, `deviceMemory`) via the new `decideQualityTier` function in `src/utils/quality.js`, instead of a user-agent mobile check. High-end phones (e.g. iPhone 17 Pro-class) now boot at `pixelRatio = min(devicePixelRatio, 2)` with full bloom instead of being force-capped to `pixelRatio` 1. The conservative static cap (`pixelRatio` 1 + texture cap + LOD upgrades disabled) still applies only where `hardwareConcurrency <= 4` AND `deviceMemory` is available and `<= 4`; the existing `FrameBudgetDegrader` (`src/utils/performance.js`, untouched) remains the dynamic safety net for devices that report no memory signal. (SPEC-MOBILE-001)
- Kid-sized tap targets: planet-list rows are now ≥48px tall, all buttons (play/reset, list-toggle, HUD, mute) are ≥44×44px, and the list collapse caret is ≥32px, across `src/ui/PlanetList.js`, `src/ui/TimeControls.js`, and the mobile media query in `index.html`. (SPEC-MOBILE-001)

### Fixed

- Touch selection no longer fires on `touchstart`. A body is now selected only when a single-finger touch ends having moved no more than 8px (`TOUCH_TAP_MAX_DRAG_PX`) from its start point (`src/controls/InteractionManager.js`), mirroring the existing mouse drag-guard pattern. Starting an orbit drag on a body no longer selects and camera-focuses it; a qualifying tap on empty space while a body is selected now deselects, matching mouse behavior. (SPEC-MOBILE-001)
- `TimeControls` buttons (`src/ui/TimeControls.js`) no longer shrink below their declared 44×44px size when the bar's content overflows at phone widths: `.control-btn` is pinned with `flex-shrink: 0`, and `.time-controls` wraps to a second row (mobile-only, scoped to `@media (max-width: 768px)`) instead of squeezing its children. Found in a real-browser (non-jsdom) verification pass, since jsdom's lack of a layout engine cannot reproduce flex-shrink defects. Fixes a follow-on desktop-only regression where an unscoped wrap caused the bar to get stuck at two rows after a resize-down-then-up round trip (shrink-to-fit width feedback loop above the 768px breakpoint).

## Known References

Entries above are attributed to the SPEC that introduced them: SPEC-MOBILE-001 — `.moai/specs/SPEC-MOBILE-001/`; SPEC-EVENTS-001 — `.moai/specs/SPEC-EVENTS-001/`.
