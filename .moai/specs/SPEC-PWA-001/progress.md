# Progress — SPEC-PWA-001

## §E.1 Plan-phase Audit-Ready Signal

- plan_complete_at: 2026-08-12T01:21:04Z
- plan_status: audit-ready

## §E.2 Run-phase Evidence

### Context

- run_started_at: 2026-08-12
- Branch: feat/spec-pwa-001 (worktree: solar-pwa)
- Mode: TDD (quality.yaml development_mode: tdd), sub-agent (solo), harness: standard
- Scale-based mode: Standard (9 files, 2 domains — frontend + build tooling)

### Entry preconditions

- The branch was at b387cc7 and did not contain the SPEC documents (added in e6fdbb3 on main).
  Resolved by `git merge --ff-only main` — the branch had zero unique commits, so no merge commit was created.
- `node_modules` was absent in this worktree; installed via `npm ci`.
- Baseline suite before implementation: 24 files / 197 tests passing.

### Phase log

- Phase 1: plan.md (plan-auditor 0.95 PASS) reused as the execution plan rather than re-derived, then verified against the live codebase. All brownfield facts in spec.md §1.2 confirmed at HEAD.
- Decision Point 1: user approved the task decomposition and all four deviations D-1..D-4 (recorded in tasks.md).
- Phase 1.6: 8 acceptance criteria registered as tracked items.
- Phase 1.7: skipped — no stub-able new source files (new artifacts are generated assets and config).
- Phase 1.8: no @MX tags in any target file (grep-verified), so no MX context map was needed.
- Phase 2B: implemented by manager-tdd, T-001..T-007.
- Phase 2.5 / 2.75: orchestrator re-verified every claim independently (see below). No lint/format/type config exists in this project, so the gate's lint stage is a graceful skip; vitest is the whole quality toolchain here.
- Phase 2.9: no @MX tags added — this change introduces no exported function with fan_in >= 3 and no async danger pattern.

### Test evidence (re-run by the orchestrator, not taken on report)

```
npm test          -> Test Files 24 passed (24) | Tests 202 passed (202)   [197 baseline + 5 new safe-area tests]
npm run test:build -> built in 677ms | precache 42 entries (8121.97 KiB) | Tests 16 passed (16)
```

### Precache payload (AC-PWA-107 / acceptance §5)

Build-time precache manifest: **42 entries, 8121.97 KiB (~7.93 MB)**.

Entries actually materialized in browser Cache Storage after a completed first visit: **37**
(14 textures + 12 font woff2 + 6 icons + index.html + manifest.webmanifest + registerSW.js + hashed JS + hashed CSS).
The 42-vs-37 gap is the build-side count including the generated `sw.js` / `workbox-*.js` runtime, which is
loaded by the browser as the service worker itself rather than stored as a precache entry.

Breakdown: textures 7.0 MB (14 files) + fonts 312 KB (12 woff2, Inter + JetBrains Mono unicode-range subsets)
+ icons ~6 KB + shell (hashed JS 643 KB, CSS 6.8 KB, HTML, manifest, registerSW).

### AC-PWA-107 offline drill (desktop half — executed, PASS)

Method: killed the origin server outright rather than toggling a CDP offline flag, so the fetches were
real connection failures and the SW cache was the only possible source.

1. `npm run build` then `vite preview` on `http://localhost:4173/solar-simulator/`.
2. Cleared all prior registrations and caches, then loaded the page fresh (headed Chromium — headless
   cannot create a WebGL context on this machine, so the scene would not render).
3. Confirmed the completed first visit: service worker `activated`, scope `http://localhost:4173/solar-simulator/`,
   page controlled, 37 precache entries stored.
4. Killed the preview server; verified the origin was dead (`curl` -> connection refused).
5. Reloaded the page.

Result: the app booted fully from cache. Canvas rendered at 3600x2086; `.time-controls` and `.planet-list`
present; `getComputedStyle(document.body).fontFamily` = `"Inter Variable", sans-serif` with
`document.fonts.status === 'loaded'` (13 faces) — confirming self-hosted fonts render offline with no
Google Fonts origin. A screenshot showed the full solar system with textured Sun and planets, orbit rings,
starfield, and the Korean planet list.

The only failed requests while offline were exactly 5 (see the pre-existing defect below). Nothing else
degraded.

### Pre-existing defect found during the drill (NOT introduced by this SPEC, NOT fixed here)

Five textures are referenced by the source but do not exist in `public/textures/`:
`2k_ceres.jpg`, `2k_pluto.jpg`, `2k_haumea.jpg`, `2k_makemake.jpg`, `2k_eris.jpg`.

- Online they return HTTP 200 with `content-type: text/html` — the preview server's SPA fallback serving
  `index.html` (4290 B), which THREE.TextureLoader cannot decode. The dwarf planets render untextured.
- Offline they fail outright (`ERR_CONNECTION_REFUSED`), since files that do not exist at build time
  cannot enter the precache manifest.

Both paths produce the same user-visible outcome, so this SPEC introduces no regression. It is out of
scope for REQ-PWA-104, which requires precaching `public/textures/` — and these files are not in it.
Recommended follow-up: add the five texture assets, or drop the references, under a separate SPEC.

### Orchestrator-applied corrections after the implementation agent's handoff

1. `test/pwa.build.spec.js` AC-PWA-108 assertion was two independent substring checks
   (`'airplanes'` and `'NetworkOnly'`), which would pass even if the live endpoint were bound to a
   caching handler — the exact failure REQ-PWA-108 forbids. Tightened to assert both inside one
   `registerRoute(...)` call, and RED-checked the new pattern against a decoupled-handler counterfactual
   (rejects) and the real built output (accepts).
2. `index.html` gained `<meta name="mobile-web-app-capable" content="yes">` alongside the apple- variant.
   Chrome logs a deprecation warning for the apple-only form on every load; iOS Safari still needs the
   apple- one, so both are present.

### Verification boundary — UNVERIFIED (requires a physical iPhone)

- AC-PWA-103 device half: standalone launch clearance of the Dynamic Island and home indicator, portrait + landscape.
- AC-PWA-107 device half: add-to-home-screen, airplane-mode relaunch.
- Scenario 1 (home-screen install) and Scenario 3 (deploy update against the live GitHub Pages origin).
- Lighthouse PWA installability audit (acceptance §4) was not run.

## §E.3 Run-phase Audit-Ready Signal

- run_complete_at: 2026-08-12
- run_commit: d1ecbd8
- run_status: audit-ready
- spec_status_after_run: in-progress (device-side ACs unverified — see the verification boundary above)

## §E.4 Sync-phase Audit-Ready Signal

- sync_complete_at: 2026-08-12
- sync_status: audit-ready
- delivery: local commit only. No push, no PR, no merge — the user reserved those for W1-M.
  `github.spec_git_workflow: main_direct` independently requires no PR, so nothing was skipped
  against the configured strategy.

### Sync-phase gate results

| Check | Result |
|-------|--------|
| Tests | 202/202 default suite + 16/16 build-artifact |
| Lint / format / type | No config exists in this project — graceful skip. vitest is the entire quality toolchain here. |
| Security (`npm audit`) | 4 high (vite, nanoid, postcss, undici). All four are present in `HEAD~1`'s lockfile, so this SPEC introduced none. All are build-toolchain packages; the site deploys as static files, so there is no production runtime exposure. |
| MX tags | Zero P1/P2 violations |
| DB docs (Phase 0.08) | Skipped: `db.enabled: false` and no migration files changed |
| Coverage | Lines 85.92% (target 85, met). Statements 82.58%, Branches 62.85%, Functions 76.14%. |

Coverage gaps sit in code this SPEC did not touch (`TimeControls.js` 63.79% statements,
`PlanetFactory.js` 75%). No tests were generated for them — that is outside SPEC-PWA-001's scope
and would have been unrequested work. This SPEC's own surface is covered by the 5 safe-area unit
tests and the 16 build-artifact assertions.

### Documents synchronized

Scope was set by the user at the Phase 1.6 gate: SPEC documents plus the README entries this
change introduces, and explicitly NOT the README's accumulated drift.

- `spec.md` — HISTORY entry, §1.2 brownfield facts annotated as-implemented, §4 Solution Approach
  rewritten to the actual build, REQ-PWA-105's capability gate recorded as resolved to the
  self-hosting branch, `status: draft -> in-progress`.
- `plan.md` — §C milestone outcomes, new §H recording divergences D-5..D-9.
- `acceptance.md` — per-AC verification status column; §5 Definition of Done split into met and
  unmet. Device criteria are NOT marked passed.
- `README.md` — PWA/offline feature entry, `vite-plugin-pwa` and `@fontsource-variable` in the tech
  stack, `public/icons/` in the structure block, `npm run test:build` documented.

### Corrections applied to the documentation agent's output

Four factual errors were caught on review and fixed:

1. `acceptance.md` AC-PWA-103 claimed "7 files carry env()". The real count is 4 — the 7 was the
   font-rename file count. Corrected and the files named.
2. `acceptance.md` AC-PWA-107 said the drill ran in **headless** Chromium. It ran **headed**;
   headless cannot create a WebGL context on this machine, which is the whole reason headed was used.
3. `acceptance.md` AC-PWA-108 paraphrased the route pattern as `/api\.airplanes\.live/`. The actual
   config pattern is `/^https:\/\/api\.airplanes\.live\//`.
4. `plan.md` D-5 attributed a font-rename plan to §A.3, which never mentions one, and D-7 cited the
   197-test baseline as the current count instead of 202.

### Pre-existing README drift left in place (out of the approved scope)

- Project Structure block omits `earth/`, `effects/`, `views/`, `core/`, `data/`.
- Textures listed as "~15 MB total"; the measured figure is 7.0 MB.
- "No backend. No database. No runtime API calls." — SPEC-EARTH-002 added a live aircraft API.
- Features list predates the Earth view and the eclipse work.
- Two links point at `LICENSE`, which has never existed in this repository (since 9ff297a).

A `/moai sync project` pass would be the right place to clear these together.
