# Implementation Plan — SPEC-PWA-001

Tier S note: this SPEC is Tier S; acceptance.md is provided beyond the Tier S 2-file minimum per the epic's explicit instruction (all six SPECs carry the 3-file set). Sections ordered by decision-reversibility.

## A. Key Decisions (highest change-likelihood first)

### A.1 Fonts: self-host vs SW-cache — RESOLVED (Option A)

DECISION (2026-08-12, decided by: user via AskUserQuestion round): **Option A — self-host Inter + JetBrains Mono woff2 subsets and drop the Google Fonts CDN (zero third-party origins).** Rationale: deterministic offline rendering + privacy; payload negligible next to the 7.0MB texture precache. The trade-off table below is retained as the decision record.

| Axis | Option A — Self-host (drop CDN) | Option B — CDN + SW runtime cache |
|------|--------------------------------|-----------------------------------|
| Offline correctness | Deterministic: fonts are build assets, precached like JS | Correct after first visit IF the SW captured the CSS+woff2 pair; Google Fonts CSS URL varies by UA, adding cache-key complexity |
| Payload | +~150-300KB woff2 subset in the bundle (one-time, cacheable) | No bundle growth; network hit on first visit as today |
| Privacy/requests | Zero third-party requests (nice for a kid's device) | Keeps fonts.googleapis.com / fonts.gstatic.com dependency |
| Maintenance | Font files vendored once; version pinned | CDN keeps fonts fresh; SW cache strategy must whitelist two origins |
| Build complexity | Download/subset step once; CSS `@font-face` local | Workbox runtime-caching config only |

Decision confirmed as Option A (see record above); Option B is retained in the table for provenance only.

### A.2 Service worker tooling (implementation decision, bounded default)

Chosen default: **vite-plugin-pwa (Workbox precache manifest)**. The binding constraint is REQ-PWA-104's "keyed to asset hashes": Vite emits hashed bundle filenames per build, and a hand-rolled static precache list goes stale on every deploy — the exact class of silent failure a kid-facing offline app cannot surface. The plugin generates the hashed precache manifest at build time, handles activate-time cache purge (REQ-PWA-108 stale-version clause), and respects `base` automatically (REQ-PWA-106). `public/textures/` included via `includeAssets`/glob so the 7.0MB set precaches. Hand-rolled SW remains the documented fallback ONLY if the plugin's GitHub Pages base handling disappoints in M1 verification (risk table).

- Registration: `registerType: 'autoUpdate'` (update on next launch; no custom UI per exclusions).
- Runtime rules: `api.airplanes.live` → `NetworkOnly` (REQ-PWA-108); the Google-Fonts `CacheFirst` rule is NOT APPLICABLE under the selected Option A (no Google Fonts origins remain).

### A.3 Safe-area application map (mechanical once listed)

`viewport-fit=cover` on the `index.html:5` meta, then additive padding:

| Surface | Inset |
|---------|-------|
| TimeControls (`bottom: 0` bar) | `padding-bottom: env(safe-area-inset-bottom)` |
| Icon strip (SPEC-MOBILE-001, when landed) | same bottom inset (its CSS is already env()-ready per MOBILE plan) |
| PlanetList + list toggle (top/left) | `env(safe-area-inset-top)` / `-left` margins |
| EarthHUD + its toggle (top/right) | `env(safe-area-inset-top)` / `-right` margins |

All additive → desktop/no-inset contexts get 0 and are pixel-unchanged.

### A.4 Icon set (one-time asset work)

Master 512×512 planet-on-dark (#0a0a0f) motif consistent with the existing 🪐 favicon; derive 192, maskable 192/512 (safe-zone padded), 180 apple-touch-icon. Stored in `public/icons/`. No external design dependency (A-604).

## B. Trade-off Notes (beyond A.1/A.2)

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Texture caching | Precache all 7.0MB at install | Runtime cache-first on demand | Focus-time texture-tier upgrades (PlanetFactory) fetch lazily; a kid offline on a car ride hits an uncached hi-res tier exactly when unsupervised. 7.0MB once on Wi-Fi is the honest cost of "offline must work" |
| Update strategy | autoUpdate (activate next launch) | Prompt-to-refresh UI | Exclusion: no update UI; a stale-by-one-session shell is harmless here |
| Manifest location | `public/manifest.webmanifest` | Inline data-URI manifest | Standard path, plugin-generated; debuggable in devtools |
| Status bar style | `black-translucent` | `default` | Content already dark (#0a0a0f); translucent lets the scene reach the top edge behind the Dynamic Island, matching the immersive look |

## C. Milestones (phase ordering; priority labels)

| M | Scope | Priority | Run-Phase Outcome (d1ecbd8) |
|---|-------|----------|----------------------------|
| M0 | A.1 resolved 2026-08-12 (Option A) — no remaining action | High | ✓ COMPLETE: User confirmed Option A (self-host) via AskUserQuestion |
| M1 | Manifest + icons + iOS metas + `viewport-fit=cover` + safe-area CSS map; production-build URL audit under `/solar-simulator/` base | High | ✓ COMPLETE: vite-plugin-pwa generated manifest from vite.config.js; icons generated from `public/icons/icon.svg` via @vite-pwa/assets-generator; viewport-fit added; safe-area env() insets applied to four anchored surfaces; production build verified all URLs resolve under `/solar-simulator/` base |
| M2 | Service worker per A.2 (+ font path per A.1): precache shell/textures/fonts, runtime rules (NetworkOnly live API), activate purge | High | ✓ COMPLETE: vite-plugin-pwa configured with Workbox precache (42 entries, 8121.97 KiB) including shell, 7.0MB textures, and self-hosted fonts; api.airplanes.live routed NetworkOnly; autoUpdate + activate-time cache purge configured; @fontsource-variable packages precached as build assets |
| M3 | Verification pass: offline boot drill (build → preview → load → kill network → reload), Lighthouse PWA installability audit, device add-to-home-screen + safe-area visual check, deploy smoke on GitHub Pages | High | ⚠ PARTIAL: Desktop offline drill PASSED (scene booted fully from cache, fonts rendered offline); device drills UNVERIFIED (require physical iPhone); Lighthouse audit NOT run |

## D. File-Touch List

**New**
- `public/manifest.webmanifest` (or plugin-generated equivalent)
- `public/icons/` (512, 192, maskable 512/192, apple-touch-icon 180)
- SW source (plugin-managed; `src/pwa.js` registration shim if needed)
- (Option A — selected) `public/fonts/` + `@font-face` CSS block

**Modified**
- `index.html` (viewport-fit, apple metas, manifest link, safe-area CSS, (Option A) CDN link removal)
- `vite.config.js` (vite-plugin-pwa config; `base` untouched)
- `package.json` (dev-dependency: vite-plugin-pwa)

## E. Test Strategy

- **Build-artifact assertions (vitest, node-side)**: production build output contains manifest with the required fields/Korean name; every manifest/precache URL starts with `/solar-simulator/`; precache manifest includes texture files and (Option A) font files; index.html contains `viewport-fit=cover` + apple metas (string assertions on `dist/`).
- **Unit**: safe-area CSS presence on the four mapped surfaces (jsdom class/style assertions where components own their styles).
- **Manual (listed as ACs)**: iPhone add-to-home-screen → standalone launch → Dynamic Island/home-indicator clearance; airplane-mode relaunch boots fully; aircraft layer shows OFFLINE state; Lighthouse installable check green.

## F. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| vite-plugin-pwa base-path edge cases on project pages | M1 audits the BUILT artifact URLs before M2 invests further; documented fallback: hand-rolled SW with an injected `self.__WB_MANIFEST`-style hashed list |
| 7.0MB precache on cellular first visit | SW install is background/non-blocking; worst case the child browses online normally while it fills; texture set measured and pinned in AC |
| iOS standalone quirks (status bar overlap, orientation) | M3 device pass explicitly checks portrait+landscape safe-area clearance; `black-translucent` + env() is the tested standard recipe |
| SW caching a deploy mid-rollout (mixed-hash shell) | Workbox precache is atomic per-manifest; activate purges old caches (REQ-PWA-108) |
| Google Fonts CSS UA-variance breaks Option B offline | Decision table already flags it; if B is chosen, cache both the CSS response and woff2 with ignoreVary handling — or the finding tilts the decision to A |

## G. Cross-SPEC Notes

- SPEC-MOBILE-001's strip ships env()-ready padding; this SPEC activates it via viewport-fit=cover. Either landing order is safe (env() = 0 until both halves exist).
- SPEC-KIDS-001's Korean text uses system fonts — unaffected by A.1 (Latin/mono families only; Hangul webfont excluded by spec §6).
- SPEC-EARTH-002's FlightDataService offline behavior is consumed as-is (REQ-PWA-107); NetworkOnly rule guarantees the SW never masks it (REQ-PWA-108).

## H. Additional Implementation Divergences (Beyond D-1..D-4)

The following five divergences from plan.md emerged during implementation (run phase d1ecbd8, outside the four pre-approved deviations). They are recorded for completeness and future reference but do not require re-approval (they are necessary/technical corrections, not scope changes).

| # | Issue | Plan Said | Implemented | Reason |
|---|-------|-----------|-------------|--------|
| D-5 | Font-family name propagation | Not anticipated — §A.1 chose self-hosting but assumed the family names would stay `'Inter'` / `'JetBrains Mono'`, so no rename appears in the §D touch list | Families renamed to `'Inter Variable'` / `'JetBrains Mono Variable'` across 7 files: the 4 safe-area surfaces plus `src/ui/InfoPanel.js`, `src/ui/LoadingScreen.js`, `src/controls/InteractionManager.js` | @fontsource-variable registers under the `* Variable` names. Leaving the bare CDN-era names would have silently fallen back to system fonts once the CDN links were removed — the exact outcome REQ-PWA-105 forbids. Post-change grep confirms zero remaining non-Variable references. |
| D-6 | Icon generation config | Implicit reliance on @vite-pwa/assets-generator defaults | `pwa-assets.config.js` added to customize generator behavior | Generator built-in presets emit maskable only at 512px and pad with white background; REQ-PWA-101 mandates maskable-192. Custom config was necessary to emit both 192 and 512 maskable variants without background padding. |
| D-7 | Build-artifact test structure | `npm run test` includes dist checks post-build (acceptance §4, first alternative) | Two vitest configs: default (unit + component tests), separate `vitest.build.config.js` for build-artifact tests. `npm run test:build` runs both build and the build-artifact suite. | vitest CLI positional filter (`.spec.js` filename pattern) only narrows within files matched by the `include` glob already. A `.spec.js` file explicitly excluded from the default `include` cannot be re-included by filter alone; separate config required. Keeps the default `npm test` build-free at ~2.2s (24 files, 202 tests after the 5 new safe-area tests); the build-artifact suite adds a full `vite build` on every run. |
| D-8 | Safe-area inset application scope | Four anchored surfaces (§A.3): TimeControls, PlanetList, EarthHUD + toggles | Safe-area insets applied in BOTH component-injected `<style>` blocks AND index.html `!important` media-query overrides | Base CSS rules alone are defeated at exactly the mobile widths where insets matter (480px and 768px breakpoints in `@media` queries). The overrides must carry the insets as well for the rule to take effect on physical devices where safe-area env() values are non-zero. Without the second application site, the DOM-level styles would be shadowed by index.html media rules. |
| D-9 | iOS manifest meta handling | `apple-mobile-web-app-capable` (apple- variant only, per §D New) | Both `<meta name="apple-mobile-web-app-capable">` and `<meta name="mobile-web-app-capable">` added | Apple's variant is required for iOS Safari standalone launch (no web standard exists yet); the standardized `mobile-web-app-capable` replacement logs a deprecation warning on every Chrome load if absent. Both are necessary for zero-warning cross-browser PWA behavior. Documented inline in index.html. |

Open markers: none — all divergences are technical/necessary corrections (no scope changes). §A.1 font-strategy clarification remains resolved (Option A, user decision 2026-08-12).
