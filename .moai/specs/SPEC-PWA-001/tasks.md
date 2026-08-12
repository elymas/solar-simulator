# Task Decomposition

SPEC: SPEC-PWA-001
Mode: TDD (quality.yaml development_mode: tdd)
Execution mode: Standard (sub-agent) — 9 files, 2 domains (frontend + build tooling)
Approved: 2026-08-12 (Decision Point 1, user)

## Approved deviations from plan.md

| # | plan.md says | Approved change | Rationale |
|---|--------------|-----------------|-----------|
| D-1 | `public/fonts/` + hand-written `@font-face` (§D New) | `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono` npm packages imported from `src/main.js` | Still Option A (zero third-party origins, self-hosted). Removes the manual download/subset step; one variable woff2 per family is smaller than 7 static weight files. Vite emits them hashed into `dist/assets/`, so the Workbox precache manifest picks them up automatically (REQ-PWA-104). |
| D-2 | `public/manifest.webmanifest` hand-authored (§D New) | vite-plugin-pwa generates the manifest from `vite.config.js` | plan §A.2 already sanctions plugin-generated equivalents; the plugin resolves `base` automatically (REQ-PWA-106). |
| D-3 | (unspecified icon tooling) | `@vite-pwa/assets-generator` run once via `npx`, generated PNGs committed; NOT added as a permanent devDependency | Icons are static build-time assets generated once. A permanent dep would be carried for no repeat use. |
| D-4 | "npm run test includes dist checks post-build" (acceptance §4, first alternative) | Build-artifact assertions live in `test/pwa.build.spec.js`, run via a dedicated `npm run test:build` script | acceptance.md §4 explicitly allows "a dedicated build-verify script". Keeps the default suite at its current ~2.2s (24 files / 197 tests). |

## Tasks

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | Add `vite-plugin-pwa` devDependency; configure the plugin in `vite.config.js` with the manifest (name `태양계 탐험`, short_name `태양계`, display standalone, background/theme `#0a0a0f`, start_url + scope under the `base`, icon entries incl. maskable) | REQ-PWA-101, REQ-PWA-106 | - | `package.json`, `vite.config.js` | completed |
| T-002 | Author a deterministic master SVG (planet-on-dark motif, no text/emoji glyphs) and run `npx @vite-pwa/assets-generator` once to emit 512/192 + maskable 512/192 + 180 apple-touch PNGs into `public/icons/` | REQ-PWA-101, REQ-PWA-102 | T-001 | `public/icons/` | completed |
| T-003 | `index.html`: add `viewport-fit=cover` to the viewport meta, add `apple-mobile-web-app-capable` + `apple-mobile-web-app-status-bar-style: black-translucent` + 180x180 `apple-touch-icon` link; remove the three Google Fonts CDN `<link>`s (lines 12-17) | REQ-PWA-102, REQ-PWA-103, REQ-PWA-105 | T-002, T-005 | `index.html` | completed |
| T-004 | Apply additive `env(safe-area-inset-*)` padding/margins to the four anchored surfaces inside their injected `<style>` blocks | REQ-PWA-103 | - | `src/ui/TimeControls.js`, `src/ui/PlanetList.js`, `src/earth/EarthHUD.js` | completed |
| T-005 | Add the two `@fontsource-variable` packages and import them from `src/main.js` so Vite bundles the woff2 files | REQ-PWA-105 | - | `package.json`, `src/main.js` | completed |
| T-006 | Service worker config: precache app shell + `public/textures/` (7.0MB, 14 image files + `.gitkeep`) + bundled fonts keyed to build hashes; runtime `NetworkOnly` for `api.airplanes.live`; `registerType: 'autoUpdate'` with activate-time purge of superseded caches; registration wired from `src/main.js` | REQ-PWA-104, REQ-PWA-107, REQ-PWA-108 | T-001, T-005 | `vite.config.js`, `src/main.js` | completed |
| T-007 | Tests: RED-first safe-area unit assertions in the existing suite; `test/pwa.build.spec.js` build-artifact suite (manifest fields, base-prefixed URLs, precache manifest contents, index.html metas, zero `fonts.googleapis.com` references, NetworkOnly rule); `test:build` npm script | AC-PWA-101..106, AC-PWA-108 | T-001..T-006 | `test/*.test.js`, `test/pwa.build.spec.js`, `package.json` | completed |
| T-008 | Verification evidence: `npm run build` + `vite preview` smoke, headless offline reload drill, precache payload figure recorded | AC-PWA-107 | T-007 | `.moai/specs/SPEC-PWA-001/progress.md` | completed |

## Verification boundary

Automatable in this run: AC-PWA-101, 102, 104, 105, 106, 108 (build-artifact assertions), AC-PWA-103 partial (CSS presence assertions only).

NOT automatable — requires a physical iPhone, reported as UNVERIFIED:
- AC-PWA-103 device half: standalone launch clearance of the Dynamic Island and home indicator, portrait + landscape.
- AC-PWA-107 device half: add-to-home-screen, airplane-mode relaunch.
- Scenario 1 (home-screen install) and Scenario 3 (deploy update on the live GitHub Pages origin).
