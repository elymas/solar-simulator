---
id: SPEC-PWA-001
title: "PWA installability, iPhone safe-area layout, and offline app shell"
version: "0.1.0"
status: draft
created: 2026-08-12
updated: 2026-08-12
author: limbowl
priority: P2
phase: "v1.1.0"
module: "public + index.html + vite.config.js"
lifecycle: spec-anchored
tier: S
tags: "pwa, manifest, service-worker, offline, safe-area, viewport-fit, github-pages, fonts, brownfield"
related_specs: [SPEC-UI-001, SPEC-MOBILE-001, SPEC-EARTH-002]
---

## HISTORY

- 2026-08-12 (v0.1.0): Initial draft. Covers proposal item 16 (web app manifest, iOS meta, safe-area insets, service worker offline shell, GitHub Pages base path). Tier S; acceptance.md is provided beyond the Tier S 2-file minimum per epic instruction. Carries one sanctioned open decision: font self-host vs SW-cache (plan.md).

---

# SPEC-PWA-001: PWA + Safe-Area + Offline

## 1. Environment

### 1.1 Overview

The app is a static Vite site on GitHub Pages, used by a child on an iPhone 17 Pro (Dynamic Island, home indicator, notchless-bezel-less display). Today it is browser-tab-only: no manifest, no service worker, no `viewport-fit=cover`, fonts from the Google Fonts CDN. This SPEC makes it installable to the home screen as "태양계 탐험", lays UI out of the Dynamic Island/home-indicator zones, and makes it boot offline after the first visit.

### 1.2 Brownfield Facts (verified citations)

- `index.html:5` — viewport meta is `width=device-width, initial-scale=1.0` with NO `viewport-fit=cover`; NO `env(safe-area-inset-*)` usage anywhere in the codebase (grep-verified).
- `index.html:8` — `theme-color` meta already `#0a0a0f` (matches the requested manifest colors).
- `index.html:11` — favicon is an inline SVG data URI (🪐 emoji); no PNG icon assets exist; only `public/textures/` exists under `public/` (observed).
- `index.html:12-17` — Inter + JetBrains Mono loaded from the Google Fonts CDN (`fonts.googleapis.com` / `fonts.gstatic.com`) — the offline gap and the font decision's subject.
- `vite.config.js` — `base: '/solar-simulator/'` (observed, whole file): GitHub Pages project-page base path ALREADY configured; every manifest/SW/precache URL must respect it.
- `public/textures/` — 7.0MB total (measured): full texture precache is viable on modern connections.
- No service worker, no manifest anywhere (grep-verified).
- `src/ui/TimeControls.js` — bar fixed at `bottom: 0` (home-indicator collision when standalone); `src/ui/PlanetList.js` / `src/earth/EarthHUD.js` / toggle buttons anchor to top/side edges (Dynamic Island / rounded-corner exposure in landscape).
- SPEC-EARTH-002's `FlightDataService` already has a real OFFLINE state (REQ-440: no retry loops offline) — live aircraft is the one feature that legitimately dies offline.

## 2. Assumptions

- **A-601**: GitHub Pages serves over HTTPS (SW-eligible) at the `/solar-simulator/` project path; no custom domain change is planned.
- **A-602**: 7.0MB texture precache is acceptable on first visit over Wi-Fi (the child's usage context); the SW install is background and does not block first paint.
- **A-603**: iOS standalone mode (apple-mobile-web-app-capable) honors the manifest display and safe-area env() values; iOS Safari supports the maskable icon set via apple-touch-icon fallback.
- **A-604**: Icon artwork can be generated from the existing 🪐-style branding (a simple planet-on-dark motif) — no external design asset dependency.

## 3. Requirements (GEARS)

**Ubiquitous**

- **REQ-PWA-101**: The app shall ship a web app manifest with: `name` "태양계 탐험", `short_name` "태양계", `display: standalone`, `background_color` and `theme_color` `#0a0a0f`, `start_url` and `scope` resolving under the `/solar-simulator/` base, and an icon set including 192×192 + 512×512 PNGs with `purpose: maskable` variants.
- **REQ-PWA-102**: The app shall include iOS install meta: `apple-mobile-web-app-capable`, an appropriate `apple-mobile-web-app-status-bar-style`, and a 180×180 `apple-touch-icon` PNG.
- **REQ-PWA-103**: The viewport meta shall gain `viewport-fit=cover`, and safe-area padding via `env(safe-area-inset-*)` shall be applied to: TimeControls (bottom inset — home indicator), the SPEC-MOBILE-001 icon strip when present (bottom), PlanetList / EarthHUD / toggle buttons (top and side insets — Dynamic Island and landscape rounded corners), so no interactive element sits under a system exclusion zone.
- **REQ-PWA-104**: A service worker shall precache the app shell (HTML, bundled JS/CSS, manifest, icons) plus the `public/textures/` set (7.0MB measured) and font resources (per the REQ-PWA-105 decision), keyed to each deploy's asset hashes so updates invalidate stale entries.
- **REQ-PWA-106**: All PWA URLs (manifest href, icon paths, SW registration scope, precache manifest entries) shall respect the Vite `base` (`/solar-simulator/`, observed in `vite.config.js`) — verified against a production build, not the dev server.

**Capability gate**

- **REQ-PWA-105**: **Where** the font decision (plan.md open decision) selects self-hosting, the two font families (Inter, JetBrains Mono — the observed `index.html:12-17` set) shall be bundled and the CDN `<link>`s removed; **Where** it selects SW caching, the CDN font responses shall be runtime-cached with a cache-first strategy so repeat/offline visits render identically. Either way, offline text rendering shall not fall back to invisible text (no FOIT dead-end offline).

**Event-driven / State-driven**

- **REQ-PWA-107**: **When** the app is launched with no network after at least one completed prior visit, it shall boot to a fully functional solar view (textures, fonts, UI intact); **While** offline, the live-aircraft layer shall present its existing OFFLINE state (SPEC-EARTH-002 REQ-440 behavior — no retry storm), and no other feature shall degrade.

**Unwanted behavior**

- **REQ-PWA-108**: The service worker shall not cache or serve stale live-data API responses (the airplanes.live endpoint is network-only), and shall not serve a stale app shell after a new deploy beyond the standard update cycle (stale-while-update with activation on next launch is acceptable; a permanently pinned old version is not).

## 4. Solution Approach

- Manifest + icons in `public/` (Vite copies them under the base path); icon set generated once (512 master → 192/180/maskable variants) from the planet-on-dark motif.
- `index.html`: viewport-fit, apple metas, manifest link. Safe-area CSS: `padding: env(safe-area-inset-*)` additions on the four anchored surfaces (values are additive, evaluating to 0 in browsers/contexts without insets — zero regression on desktop).
- Service worker: precache + runtime strategy per REQ-PWA-104/108. Tooling (vite-plugin-pwa/Workbox vs hand-rolled SW) is a plan.md implementation decision bounded by the REQs — the hashed-bundle precache requirement (REQ-PWA-104 "keyed to asset hashes") is the deciding constraint.
- Font path per the sanctioned open decision (plan.md §A.1).

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| First visit | SW install is non-blocking (background); first-paint time not regressed by precache |
| Payload | Precache total documented at build time; icons ≤200KB combined; no texture duplication in cache versions (old caches purged on activate) |
| Update latency | New deploy reachable by second launch after publish (standard SW update cycle) |
| Offline integrity | Offline boot renders bit-identical UI (fonts included) except live-data layers |
| Desktop regression | Zero layout change where `env()` insets are 0; manifest/SW inert on desktop browsing |
| Compatibility | GitHub Pages project-path scope: SW scope confined to `/solar-simulator/` |

## 6. Exclusions (What NOT to Build)

### Out of Scope — Push notifications and background sync

- No push, no periodic background sync, no notification permission prompts (a 5-year-old's device stays prompt-free).

### Out of Scope — Custom in-app update UI

- No "new version available" toast/reload button. Standard SW update-on-next-launch is sufficient.

### Out of Scope — Offline live data

- Live aircraft (airplanes.live) is inherently online; offline shows the existing OFFLINE state (REQ-PWA-107). No attempt to cache or fake live data (REQ-PWA-108).

### Out of Scope — App store packaging

- No TWA/Capacitor/native wrapper. Home-screen PWA only.

### Out of Scope — Korean webfont bundling

- KIDS-001's Korean rendering uses system font fallbacks; this SPEC's font decision covers ONLY the two existing Latin/mono families. Bundling a Hangul webfont (multi-MB) is explicitly excluded.

## 7. Traceability (REQ → AC)

| Requirement | Acceptance |
|-------------|------------|
| REQ-PWA-101..108 | AC-PWA-101..108 (1:1) |

## 8. Proposal Item Traceability (Appendix)

| Proposal item # | Item summary | REQ IDs |
|-----------------|--------------|---------|
| 16 | PWA: manifest "태양계 탐험" + icons/apple-touch-icon, standalone, #0a0a0f, viewport-fit=cover + safe-area insets, SW precache (shell/textures/fonts) + offline boot, font self-host vs SW-cache decision, GitHub Pages base-path compatibility | REQ-PWA-101, 102, 103, 104, 105, 106, 107, 108 |
