# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Mobile planet icon strip (`src/ui/PlanetStrip.js`) — a bottom, horizontally-scrollable strip of tappable body icons that becomes the PRIMARY body selector at viewport widths ≤768px, positioned directly above the time-controls bar. Selection is synced bidirectionally with 3D-scene taps and the desktop sidebar: selecting anywhere highlights the strip item and scrolls it into view, and tapping the strip drives the same select/focus path as a 3D tap. Item list is generated from the shared body registry, so bodies added by later SPECs appear automatically. (SPEC-MOBILE-001)

### Changed

- Render quality tier is now decided from observed device signals (`devicePixelRatio`, `hardwareConcurrency`, `deviceMemory`) via the new `decideQualityTier` function in `src/utils/quality.js`, instead of a user-agent mobile check. High-end phones (e.g. iPhone 17 Pro-class) now boot at `pixelRatio = min(devicePixelRatio, 2)` with full bloom instead of being force-capped to `pixelRatio` 1. The conservative static cap (`pixelRatio` 1 + texture cap + LOD upgrades disabled) still applies only where `hardwareConcurrency <= 4` AND `deviceMemory` is available and `<= 4`; the existing `FrameBudgetDegrader` (`src/utils/performance.js`, untouched) remains the dynamic safety net for devices that report no memory signal. (SPEC-MOBILE-001)
- Kid-sized tap targets: planet-list rows are now ≥48px tall, all buttons (play/reset, list-toggle, HUD, mute) are ≥44×44px, and the list collapse caret is ≥32px, across `src/ui/PlanetList.js`, `src/ui/TimeControls.js`, and the mobile media query in `index.html`. (SPEC-MOBILE-001)

### Fixed

- Touch selection no longer fires on `touchstart`. A body is now selected only when a single-finger touch ends having moved no more than 8px (`TOUCH_TAP_MAX_DRAG_PX`) from its start point (`src/controls/InteractionManager.js`), mirroring the existing mouse drag-guard pattern. Starting an orbit drag on a body no longer selects and camera-focuses it; a qualifying tap on empty space while a body is selected now deselects, matching mouse behavior. (SPEC-MOBILE-001)
- `TimeControls` buttons (`src/ui/TimeControls.js`) no longer shrink below their declared 44×44px size when the bar's content overflows at phone widths: `.control-btn` is pinned with `flex-shrink: 0`, and `.time-controls` wraps to a second row (mobile-only, scoped to `@media (max-width: 768px)`) instead of squeezing its children. Found in a real-browser (non-jsdom) verification pass, since jsdom's lack of a layout engine cannot reproduce flex-shrink defects. Fixes a follow-on desktop-only regression where an unscoped wrap caused the bar to get stuck at two rows after a resize-down-then-up round trip (shrink-to-fit width feedback loop above the 768px breakpoint).

## Known References

Entries above are attributed to the SPEC that introduced them: SPEC-MOBILE-001 — `.moai/specs/SPEC-MOBILE-001/`.
