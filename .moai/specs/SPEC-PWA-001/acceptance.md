# Acceptance Criteria — SPEC-PWA-001

Tier S note: provided beyond the Tier S 2-file minimum per the epic's explicit instruction.

## 1. AC Matrix (1:1 with REQs)

| AC | REQ | Criterion (testable) | Verification | Status (d1ecbd8) |
|----|-----|----------------------|--------------|-----------------|
| AC-PWA-101 | REQ-PWA-101 | Built manifest contains: name "태양계 탐험", short_name "태양계", display standalone, background/theme #0a0a0f, start_url+scope under `/solar-simulator/`, icons 192+512 with maskable purpose variants | build-artifact test (dist assertion) | **PASS** — `dist/manifest.webmanifest` verified to contain all required fields; icons emitted by @vite-pwa/assets-generator |
| AC-PWA-102 | REQ-PWA-102 | Built index.html contains apple-mobile-web-app-capable, a status-bar-style meta, and a 180×180 apple-touch-icon link resolving to an existing PNG | build-artifact test | **PASS** — `dist/index.html` contains both `apple-mobile-web-app-capable` and `mobile-web-app-capable` metas, `black-translucent` status-bar-style, and valid apple-touch-icon link (d1ecbd8) |
| AC-PWA-103 | REQ-PWA-103 | Viewport meta includes `viewport-fit=cover`; TimeControls, icon strip (when present), PlanetList(+toggle), EarthHUD(+toggle) carry env(safe-area-inset-*) padding/margins; on-device standalone launch shows no interactive element under the home indicator or Dynamic Island (portrait + landscape) | string/jsdom assertions + manual device | **PARTIAL PASS** — Automatable half: `viewport-fit=cover` present in viewport meta; safe-area insets verified in 4 files (`src/ui/TimeControls.js`, `src/ui/PlanetList.js`, `src/earth/EarthHUD.js`, and the `!important` media overrides in `index.html`). Device half: **UNVERIFIED** — on-device visual verification requires physical iPhone. Tested safe-area values but not the actual Dynamic Island/home-indicator clearance on a real device. |
| AC-PWA-104 | REQ-PWA-104 | Precache manifest (built) includes the app shell (hashed JS/CSS, HTML, manifest, icons) AND all `public/textures/` files (7.0MB set) AND fonts per the A.1 decision; precache entries carry build hashes/revisions | build-artifact test | **PASS** — Workbox precache manifest built with 42 entries (8121.97 KiB total): 14 textures (7.0MB), 12 font woff2 (312KB), 6 icons, plus shell (JS, CSS, HTML, manifest). All entries carry build-time hashes. |
| AC-PWA-105 | REQ-PWA-105 | Per decision: (A) zero `fonts.googleapis.com` references in dist + local @font-face serving woff2 from the base path, OR (B) SW runtime CacheFirst rule for both font origins verified by second-load-offline font rendering | build-artifact test + manual offline check | **PASS** — Option A (self-host) implemented: zero `fonts.googleapis.com` or `fonts.gstatic.com` references in dist; fonts served from `@fontsource-variable` packages bundled and hashed into dist/assets/; offline verification shows `document.fonts.status === 'loaded'` with 13 font faces after SW cache serve (progress.md offline drill). |
| AC-PWA-106 | REQ-PWA-106 | Every URL in manifest, SW registration, and precache manifest starts with `/solar-simulator/` (or is relative-resolving under it) in the PRODUCTION build; `vite preview` under the base serves an installable app | build-artifact test + preview smoke | **PASS** — All manifest icon/start_url paths, SW registration scope, and precache manifest entries verified to resolve under `/solar-simulator/` base. `vite preview` smoke test successful. |
| AC-PWA-107 | REQ-PWA-107 | Offline drill: build → serve → full first visit (SW installed, precache complete) → network killed → reload: solar view boots with textures+fonts intact; Earth view aircraft layer shows the existing OFFLINE presentation; no other feature degraded | manual drill (scripted steps in run evidence) | **PARTIAL PASS** — Automatable half: desktop offline drill PASSED, run in **headed** Chromium — headless cannot create a WebGL context on this machine, so the scene would not have rendered. The origin server was killed outright rather than toggling a CDP offline flag, so the fetches were real connection failures and the SW cache was the only possible source. Scene booted from cache, textures loaded (3600x2086 canvas), fonts rendered (`document.fonts.status === 'loaded'`), planet list and time controls present; the only failed requests were the 5 pre-existing missing dwarf-planet textures (see progress.md). Device half: **UNVERIFIED** — home-screen install + airplane-mode relaunch require a physical iPhone. The Earth-view aircraft layer's offline presentation was NOT exercised: the drill stayed on the solar view. |
| AC-PWA-108 | REQ-PWA-108 | SW config: `api.airplanes.live` matched NetworkOnly (no cache storage entry for it after use); activate handler purges previous-version caches (cache names asserted before/after a simulated update) | config/build test + devtools verification | **PASS** — `vite.config.js` routes `urlPattern: /^https:\/\/api\.airplanes\.live\//` to the `NetworkOnly` handler; the built `dist/sw.js` emits `registerRoute(/^https:\/\/api\.airplanes\.live\//, new NetworkOnly, "GET")`. The build-artifact assertion requires both inside a single `registerRoute(...)` call, so a decoupled handler cannot pass it (RED-checked against a counterfactual). Cache purge on activate via Workbox `cleanupOutdatedCaches` + `skipWaiting`/`clientsClaim`, asserted in the built SW. |

## 2. Given-When-Then Scenarios

### Scenario 1 — Home-screen install
- **Given** the deployed GitHub Pages site visited in iOS Safari
- **When** the child's parent uses "Add to Home Screen"
- **Then** the icon appears named "태양계", launches standalone (no browser chrome) with the #0a0a0f theme, and the scene fills the display with all controls clear of the Dynamic Island and home indicator.

### Scenario 2 — Offline car ride
- **Given** the app was fully visited once on Wi-Fi (SW + 7.0MB textures precached)
- **When** the device is offline and the child opens the home-screen app
- **Then** the solar system boots completely (textures sharp, fonts correct), everything except live aircraft works, and the aircraft layer shows its Korean OFFLINE state without retry storms.

### Scenario 3 — Deploy update
- **Given** a new version deployed to GitHub Pages while the old version is installed
- **When** the child launches the app twice (first launch fetches, second activates)
- **Then** the new version is active by the second launch and old cache storage is purged (no unbounded cache growth).

## 3. Edge Cases

- First visit interrupted mid-precache: app works online normally; SW retries install on next visit; offline guarantee applies only after a completed install (documented in AC-PWA-107 wording "completed prior visit").
- Private/incognito mode (no SW): app behaves exactly as today (no registration errors surfaced to the user).
- `env()` unsupported browser: padding contributes 0 — desktop layouts pixel-identical (regression-checked).
- Storage eviction under device pressure: SW re-installs on next online visit; no corrupted half-cache serving (Workbox atomic precache).
- Landscape orientation: left/right insets clear the rounded corners for PlanetList/EarthHUD toggles.
- GitHub Pages 404 SPA fallback: NOT needed (single-entry app, hash routing `#/earth` per ViewManager — no deep server paths); asserted by keeping start_url at the base root.

## 4. Quality Gate Criteria

- Build-artifact assertion suite green in CI (`npm run test` includes dist checks post-build or a dedicated build-verify script wired into the run evidence).
- `npm run build` + `vite preview` smoke passes; Lighthouse PWA installability audit passes on the preview/deploy.
- Zero desktop visual regression (env() additive-only diff review).
- The single sanctioned open clarification (plan.md §A.1 font strategy) resolved and recorded before Implementation Kickoff Approval.
- TRUST 5: Tested (artifact assertions), Readable (config-as-code commented), Unified (Vite ecosystem convention), Secured (SW scope confined to base; no third-party script additions; NetworkOnly for live API), Trackable (conventional commits referencing SPEC-PWA-001).

## 5. Definition of Done

- ✓ All automatable AC-PWA-10x PASS: AC-101, 102, 104, 105, 106, 108 verified by build-artifact assertions; AC-103 and AC-107 automatable halves verified (CSS presence, offline cache behavior). Tests green (202 pass, 16 build-artifact assertions).
- ⚠ Device-side ACs UNVERIFIED: AC-103 (Dynamic Island / home-indicator clearance on device) and AC-107 (add-to-home-screen, airplane-mode relaunch) require a physical iPhone. Acceptance.md §5 Definition of Done mandates device execution; device drills were not completed because no physical device was available during run phase. Spec status set to `in-progress` as a result — full completion requires device verification by the user.
- ✓ Precache payload documented in run evidence: 42 entries, 8121.97 KiB (textures 7.0MB + fonts 312KB + icons ~6KB + shell). Breakdown recorded in progress.md §E.2.
