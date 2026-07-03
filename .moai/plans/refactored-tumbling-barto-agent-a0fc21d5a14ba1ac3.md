# Requirements Analysis: Solar System Simulator Expansion (F1-F7)

Plan-phase deliverable. Requirements analyst output for MoAI plan phase, project "solar-simulator". No implementation code written — this is a SPEC-input document only.

Source context read: `.moai/specs/SPEC-UI-001/{spec,acceptance}.md`, `.moai/project/{product,tech}.md`, and current source (`src/planets/planetData.js`, `src/planets/PlanetFactory.js`, `src/scene/SceneManager.js`, `package.json`, `public/textures/`, recent git log).

**Key brownfield finding used throughout this analysis:** the shipped codebase already exceeds SPEC-UI-001 as documented. It currently includes moons for Mars (Phobos, Deimos), Jupiter (Io, Europa, Ganymede — 3 of 4 Galilean), Saturn (Titan, Enceladus, Rhea), Uranus (Titania, Oberon, Miranda), Neptune (Triton, Proteus, Nereid), plus external background stars (Sirius A/B, Betelgeuse, Stephenson 2-18) and a working planet camera-focus system — none of which appear in SPEC-UI-001's REQ list. All moons except Earth's Moon use flat-color `MeshBasicMaterial` (no texture files), which is a useful, cheap pattern to reuse. This changes the actual F2 gap substantially (see Section 1).

---

## 1. Scope Recommendation

### F1 — Dwarf Planets

**Recommendation: the 5 IAU-recognized dwarf planets — Pluto, Ceres, Eris, Haumea, Makemake.**

Rationale:
- IAU designation is the only stable, unambiguous membership test. Hundreds of trans-Neptunian objects and asteroids are dwarf-planet *candidates*; without the IAU cutoff, scope has no natural boundary and will be re-litigated every time a new object is discussed.
- All 5 have well-known, distinct surface imagery (Pluto's Tombaugh Regio, Ceres' Occator crater, etc.), so unlike minor moons they carry real pedagogical/visual value — worth a small dedicated texture each, unlike the flat-color moon pattern.
- Placement reuses existing scale-compression precedent: Ceres sits in the asteroid belt (~2.77 AU, between Mars and Jupiter in the existing distance table); Pluto/Eris/Haumea/Makemake sit beyond Neptune and need the same kind of AU-to-display-unit compression already applied to the 8 planets.
- Reuse, don't build new: implement as entries in the existing `PLANET_DATA`-shaped structure and reuse `PlanetFactory`/`OrbitalMechanics`, not a parallel "dwarf planet subsystem." Pluto's high eccentricity (0.248) and inclination (17°) must be carried through, not simplified to circular orbits — SPEC-UI-001 already establishes Keplerian accuracy as a Primary Goal (REQ-010/AC-003), and dwarf planets should meet the same bar.
- Optional stretch: Charon (Pluto's moon) via the existing moon pipeline — not core, since it is the only dwarf-planet moon large enough to be visually relevant at this scale.

### F2 — Jupiter/Saturn Moons

**Recommendation: Galilean 4 (Io, Europa, Ganymede, Callisto) + Saturn's 7 gravitationally-rounded moons (Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus). Total 11 named moons.**

Cutoff rationale — same rigor class as the F1 IAU cutoff, not a subjective "notable moons" list:
- Jupiter has 95 known moons; only the 4 Galilean moons are large enough (>1,500 km) to be gravitationally rounded and historically significant (discovered by Galileo, 1610). The remaining ~91 are irregular captured objects under ~200 km — no visual or pedagogical value at this simulation's scale.
- Saturn has 146 known moons; exactly 7 are in hydrostatic equilibrium (rounded shape) — Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus. This is a scientifically principled, stable cutoff (won't need revisiting as new tiny moons are discovered).

**Concrete gap to build, given current code state:** Callisto (Jupiter) + Mimas, Tethys, Dione, Iapetus (Saturn) = **5 new moons**, not 11 — Io/Europa/Ganymede/Titan/Enceladus/Rhea already exist. Follow the established flat-color `MeshBasicMaterial` pattern for these (zero texture payload), matching every existing non-Earth moon. Do not touch or modify the already-shipped Mars/Uranus/Neptune moons — out of scope for this feature, flagged separately as a documentation-debt risk (Section 5).

### F3 — Smoothness / Resolution: concrete testable criteria

"Smoother and higher-resolution" is not directly testable as written. Concrete criteria:

- **Frame smoothness**: p95 frame time ≤ 1.5× target frame budget (≤25 ms desktop, ≤50 ms mobile) sustained over any rolling 60-second window during active playback (1x–100x speed) with the full expanded scene visible (all planets, dwarf planets, 11 major moons, orbit lines, bloom). This must hold as a *regression* check against the existing scene too — SPEC-UI-001's AC-007 60fps/30fps guarantee must not silently degrade once new bodies are added.
- **Geometry resolution**: introduce distance-based LOD (`THREE.LOD` or manual segment-count swapping) so a body only renders at a higher segment count when the camera is near it (e.g., inside the F4 dedicated Earth view). The wide overview scene keeps today's 32/64-segment tiers. This is the concrete lever for "higher resolution" without linearly growing the total triangle budget as body count grows.
- **Texture resolution**: tiered by role, not blanket-upgraded. Hero bodies eligible for higher resolution (Sun, Earth in the F4 dedicated view) may use 4K, lazy-loaded only when that view is entered (see load-budget NFR). Everything else (planets in overview, dwarf planets, all moons) stays at 1K–2K or flat color, gated by the existing low-tier-device heuristic (`hardwareConcurrency <= 4`) already in the codebase.

**Tech stack change verdict: no engine/renderer swap.** Recommend staying on Three.js `WebGLRenderer`. A move to `WebGPURenderer` or a different engine is unnecessary complexity and risk for this asset count, and would regress the existing 98%-browser-coverage requirement (WebGPU support is not yet universal). Recommended additive techniques instead: `THREE.LOD`, optional `KTX2Loader`/Basis-compressed textures only if the 4K Earth textures push payload over budget, and object pooling for any per-frame particle/geometry allocation introduced by aurora (F7) or eclipse shadow overlays (F6). This is a targeted-optimization recommendation, not a rewrite.

---

## 2. EARS-Format Requirements

REQ-IDs are grouped by feature in blocks of 100 (F1: 010s, F2: 110s, F3: 210s, F4: 310s, F5: 410s, F6: 510s, F7: 610s), each incrementing by 10 within the block to leave room for insertion, matching this project's existing EARS style (Ubiquitous / Event-Driven / State-Driven / Optional / Unwanted) as established in SPEC-UI-001 Section 3. "Where feasible" is used for Optional items, matching SPEC-UI-001's own "가능하면" convention.

### F1 — Dwarf Planets

**Ubiquitous**
- **REQ-010**: The system shall always render the 5 IAU-recognized dwarf planets (Pluto, Ceres, Eris, Haumea, Makemake) as distinct 3D bodies.
- **REQ-020**: The system shall always position Ceres within the asteroid-belt region (~2.77 AU scaled) and the four trans-Neptunian dwarf planets beyond Neptune's orbit at their scaled mean distances.

**Event-Driven**
- **REQ-030**: WHEN the user clicks a dwarf planet THEN the system shall display an info panel with its physical data (diameter, distance, orbital period, discovery year, classification note "Dwarf Planet"), reusing the existing planet info-panel component.

**State-Driven**
- **REQ-040**: IF the simulation is playing THEN dwarf planets shall animate along Keplerian orbits using the existing orbital-mechanics module, respecting each body's real eccentricity and inclination (notably Pluto's 0.248 eccentricity / 17° inclination) rather than simplifying to circular orbits.

**Optional**
- **REQ-050**: Where feasible, Pluto's moon Charon should render as an orbiting satellite using the existing moon rendering pipeline.

**Unwanted**
- **REQ-060**: The system shall not render any trans-Neptunian objects, minor planets, or asteroid-belt bodies beyond the 5 IAU dwarf planets.

### F2 — Jupiter/Saturn Major Moons

**Ubiquitous**
- **REQ-110**: The system shall always render Callisto as a fourth Jupiter moon alongside the existing Io, Europa, and Ganymede.
- **REQ-120**: The system shall always render Mimas, Tethys, Dione, and Iapetus as additional Saturn moons alongside the existing Titan, Enceladus, and Rhea, completing Saturn's 7 gravitationally-rounded moons.

**Event-Driven**
- **REQ-130**: WHEN the user clicks any of the 11 major Jupiter/Saturn moons THEN the system shall display an info panel using the same pattern already used for Earth's Moon, Phobos, and Deimos.

**State-Driven**
- **REQ-140**: IF the simulation is playing THEN each new moon shall orbit its parent planet using orbital data following the existing `MOON_DATA` schema (orbitalPeriod, eccentricity, distanceFromParent).

**Optional**
- **REQ-150**: Where a hero moon's visual identity benefits materially (e.g. Titan's hazy atmosphere, Europa's icy fractures), a lightweight texture may replace the flat-color material; this is not required for the remaining moons.

**Unwanted**
- **REQ-160**: The system shall not add moons for bodies outside Jupiter and Saturn as part of this feature. The already-shipped Mars/Uranus/Neptune moons are out of scope for changes here.

### F3 — Smoothness, Resolution, Performance

**Ubiquitous**
- **REQ-210**: The system shall always sustain the frame-time criteria defined in Section 3 (NFRs) with the full expanded scene (planets + dwarf planets + 11 major moons + orbit lines + bloom) active simultaneously.
- **REQ-220**: The system shall always apply distance-based level-of-detail to sphere geometry so only camera-proximate bodies render at increased segment counts.

**Event-Driven**
- **REQ-230**: WHEN a device is classified as low-tier (existing `hardwareConcurrency <= 4` heuristic) THEN the system shall cap texture resolution and disable LOD upgrades, extending the existing degradation pattern (SPEC-UI-001 REQ-018).

**State-Driven**
- **REQ-240**: IF the frame-time budget (Section 3) is exceeded for more than 30 consecutive frames THEN the system shall progressively disable non-essential effects in this order: aurora particle detail → eclipse shadow-overlay quality → bloom radius → LOD upgrade — before touching core interaction (camera controls, click/hover picking).

**Optional**
- **REQ-250**: Where the GPU supports it, compressed KTX2/Basis textures may replace JPEG for hero bodies to reduce decoded texture memory.

**Unwanted**
- **REQ-260**: The system shall not switch rendering backend away from `THREE.WebGLRenderer` (no WebGPU migration) as part of this feature.

### F4 — Dedicated Earth Simulation View

**Ubiquitous**
- **REQ-310**: The system shall always provide a dedicated Earth simulation view, distinct from the default overview scene, reachable only via explicit user selection of Earth.

**Event-Driven**
- **REQ-320**: WHEN the user selects Earth THEN the system shall transition into the dedicated Earth view, reusing the existing camera-focus mechanism, within the established 2-second transition budget (SPEC-UI-001 AC-002).
- **REQ-330**: WHEN the Earth view is active THEN the system shall display richer information than the standard info panel: a real-time day/night terminator (existing daymap/nightmap textures + sun-relative rotation), the cloud layer (existing texture), and the Moon in correct relative orbit.
- **REQ-340**: WHEN the user exits the Earth view (close control, Escape key, or selecting another body) THEN the system shall return the camera to the prior overview position, consistent with existing AC-002 close-panel behavior.

**State-Driven**
- **REQ-350**: IF the Earth view is active AND the aircraft-position layer (F5) is available THEN the system shall overlay aircraft markers on the Earth model.
- **REQ-360**: IF the Earth view is active THEN eclipse (F6) and aurora (F7) effects, when their trigger conditions are met, shall render within this view.

**Optional**
- **REQ-370**: Where feasible, the Earth view may include supplementary layers such as night-side city lights and a simple atmospheric rim-glow shader.

**Unwanted**
- **REQ-380**: The system shall not require geolocation or any additional user permission/data to display the Earth view; behavior must be identical for all users regardless of location.

### F5 — Real-Time Aircraft Positions (Optional, Degradable)

**Optional (primary framing — this entire feature is conditional)**
- **REQ-410**: Where a feasible free, CORS-accessible, client-side-callable flight-position API exists at implementation time, the system should overlay live aircraft position markers on the Earth view. Candidates identified during this research pass:
  - **adsb.lol** (`api.adsb.lol`) — free, open, no API key or account required, community-run; no ToS clause found restricting public/live deployment. Preferred candidate.
  - **OpenSky Network** (`opensky-network.org`) — free anonymous tier exists (400 credits/day, 10s resolution, bounding-box query support), but its Terms of Use require written consent for "operational use of the REST API in any live product, service, or automated system," which a public GitHub Pages deployment likely triggers. Deprioritized for this reason, not a technical one.
  - CORS support for either provider is **not confirmed** by their published docs and must be verified with a live browser fetch during implementation (a server-side doc fetch cannot confirm CORS, since it is browser-enforced) — see Section 4 edge cases.

**Event-Driven**
- **REQ-420**: WHEN the Earth view is active AND the flight-data feature is enabled THEN the system shall poll the selected provider at an interval no tighter than its documented/fair-use rate limit and update aircraft markers.

**State-Driven**
- **REQ-430**: IF the flight-data request fails (network error, CORS rejection, HTTP 4xx/5xx, or rate-limit exhaustion) THEN the system shall disable the aircraft layer gracefully, show a small non-blocking "live flight data unavailable" indicator, and continue all other Earth-view functionality unaffected.
- **REQ-440**: IF the browser is offline THEN the system shall not attempt flight-data requests and shall show the unavailable indicator immediately, without a retry loop.
- **REQ-450**: IF no free/CORS-compatible flight-position API is confirmed feasible during implementation THEN the entire F5 feature shall be omitted from the shipped SPEC without blocking F1–F4, F6, or F7.

**Unwanted**
- **REQ-460**: The system shall not embed any private or paid API key in client-side source. Only fully public, keyless, or client-safe-key APIs are eligible, preserving the project's static/backend-less/no-secrets architecture (SPEC-UI-001 REQ-020).
- **REQ-470**: The system shall not retry failed flight-data requests more frequently than a fixed backoff window (e.g. exponential backoff starting at 30s), to avoid degrading a shared free community API for other users.

### F6 — Solar and Lunar Eclipse Simulation

**Ubiquitous**
- **REQ-510**: The system shall always compute solar/lunar eclipse geometry (Sun-Moon-Earth alignment) from the same Keplerian position data already driving orbital animation — no separate eclipse-specific ephemeris system.

**Event-Driven**
- **REQ-520**: WHEN the computed Sun-Earth-Moon alignment falls within eclipse threshold THEN the system shall trigger the corresponding visual (shadow overlay on Earth for a solar eclipse; Moon darkening/red-tint for a lunar eclipse).

**State-Driven**
- **REQ-530**: IF the simulation is running at high time acceleration (per the existing 0.1x–500x range) THEN the system shall still detect eclipse-alignment crossings without skipping them due to large per-frame time steps — alignment must be sampled at a temporal resolution independent of render frame rate, not just once per rendered frame.

**Optional**
- **REQ-540**: Where feasible, provide an "eclipse finder" control that fast-forwards the simulation clock to the next occurrence within a bounded search window (e.g. next 5 simulated years), since real eclipses are infrequent relative to typical viewing sessions.

**Unwanted**
- **REQ-550**: The system shall not fabricate an eclipse event that does not correspond to genuine geometric alignment of the simulated bodies — visual accuracy must remain physically grounded, consistent with the base spec's Keplerian-accuracy requirement.

### F7 — Aurora Simulation

**Ubiquitous**
- **REQ-610**: The system shall always be capable of rendering an aurora visual effect at Earth's polar regions when the Earth view is active.

**Event-Driven**
- **REQ-620**: WHEN the Earth view is active THEN the system shall render the aurora effect as a decorative polar visual not tied to any live external solar-activity data (see Section 4 for rationale — avoids a second external-API dependency alongside F5).

**State-Driven**
- **REQ-630**: IF the device is classified as low-tier/mobile (existing heuristic) THEN the system shall render a simplified aurora (pre-baked texture or reduced particle count) instead of the full particle/shader version.

**Optional**
- **REQ-640**: Where GPU budget allows, aurora may use a custom shader (vertex-displaced translucent bands) for higher fidelity; otherwise a billboard/sprite-based fallback is acceptable and, per REQ-650, mandatory on mobile.

**Unwanted**
- **REQ-650**: The system shall not let the aurora effect degrade frame rate below the NFR floor in Section 3; if it does, the priority-degradation order defined in REQ-240 applies (aurora degrades first).

---

## 3. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Frame rate | 60 fps sustained desktop, 30 fps sustained mobile — re-validated against the *full expanded scene*, not just the original 10-body scene (regression risk, see Section 5). |
| Frame smoothness (testable) | p95 frame time ≤ 25 ms desktop / ≤ 50 ms mobile, over any rolling 60-second window during playback at 1x–100x speed with default-visible new features active. |
| Initial load budget | Current actual baseline is **7 MB** of textures (not the 15 MB originally estimated in SPEC-UI-001), leaving real headroom under the existing "10s @ 10 Mbps ≈ 12.5 MB" target. Recommend a hard ceiling of **12 MB total initial-load texture payload** (20% margin under the safe budget). Any new dwarf-planet texture should be ≤ 512 KB (1K resolution, matching the smaller Solar System Scope tier). **Earth's 4K texture upgrade (F4) must be lazy-loaded only when the Earth view is opened — it must not count against initial load**, since most users may never click Earth. |
| Texture memory (GPU/VRAM) | Recommend a decoded-texture budget ceiling of ≤ 256 MB desktop / ≤ 128 MB mobile. A 2K RGB texture decodes to ~8 MB; the current ~15 texture maps already consume roughly 120 MB decoded. Adding 4K Earth maps without the lazy-load + mobile-cap-to-2K guard in REQ-230 risks exceeding the mobile ceiling — this guard is not optional polish, it is load-bearing for the mobile NFR. |
| Accessibility (new Earth view UI) | WCAG 2.1 AA baseline (first explicit accessibility bar in this project — SPEC-UI-001 has none today, see Section 5 risk #6). Keyboard: Enter/Space to enter Earth view from the planet list (existing pattern), Escape to exit (existing pattern). `aria-live="polite"` region for the F5 "flight data unavailable" status indicator. Color contrast reuses existing tokens (#e0e0e0 primary / #888888 secondary text on #1a1a2e surface — already meets AA for body text at current sizes). `prefers-reduced-motion` media query must disable aurora particle animation and eclipse shadow-transition easing. |

---

## 4. Edge Cases and Failure Scenarios

**F1 — Dwarf planets**
- Pluto/Eris/Haumea/Makemake's high eccentricity/inclination orbits can visually clip through other bodies or the orbit-line field at extreme time acceleration (500x) — needs a closest-approach visual check.
- Ceres sits in the asteroid-belt region; if a future feature adds a visual asteroid belt, Ceres placement will need to be re-coordinated (flagged, not a current conflict).

**F2 — Moons**
- Saturn's compressed display scale already places 3 moons at `distanceDisplay` 35–45 units; adding 4 more (Mimas, Tethys, Dione, Iapetus) risks visual overlap/z-fighting at low zoom unless spacing is re-validated across all 7 moons together, not added incrementally.

**F3 — Performance**
- LOD threshold pop-in: visible "jump" when a body's segment count changes as the camera crosses the LOD distance threshold, unless cross-faded or hysteresis-guarded.
- Silent regression risk: the *existing* content (8 planets + Moon) must be re-benchmarked with all new bodies present, not just benchmarked in isolation — it's possible to "pass" a new-feature-only benchmark while the base scene has quietly dropped below 60fps.

**F4 — Earth view**
- The existing planet camera-focus feature (commit `fc5855f`) may only implement a camera dolly, not a true separate scene/view. If so, F4's "dedicated view with much richer information" is a bigger lift than reusing that infra suggests — this must be confirmed, not assumed, before Run-phase estimation.
- **WebGL context loss**: no `webglcontextlost`/`webglcontextrestored` handling exists anywhere in the current codebase (confirmed by grep). A heavier combined scene (more textures/materials/shaders held in GPU memory) increases context-loss probability on constrained devices. Recovery behavior (reload textures/geometry on restore) must be designed as part of this feature, not assumed to already exist.

**F5 — Flight positions**
- CORS block: browser preflight can fail silently and differently from a server-side check — must be verified with a live browser `fetch()` during Run-phase, not assumed feasible from documentation alone.
- Rate-limit exhaustion mid-session: needs graceful, silent degrade (REQ-430), not a visible repeating error.
- ToS ambiguity: a public GitHub Pages deployment plausibly counts as "operational use in a live product" under OpenSky's terms, which requires a written license — this is why adsb.lol is the preferred candidate, but its own terms should be re-checked at implementation time since community-run free services can change policy.
- Empty vs. down: sparse or zero aircraft in view (oceanic regions, off-peak hours) is a legitimate empty state and must be visually distinct from an API-down error state, or users will misread "no data" as "broken."

**F6 — Eclipses**
- At 500x time acceleration, an eclipse alignment window can be shorter than a single simulated frame's time-step, causing eclipses to be silently skipped entirely (never rendered) — this is the specific accelerated-timescale risk named in the task. Mitigation: sample alignment at fixed sub-steps independent of render rate, or rely on the REQ-540 eclipse-finder to internally step in small increments when searching.
- Recommend scoping v1 to a simplified binary "eclipse happening" visual rather than full umbra/penumbra/annular geometric accuracy — a deliberate simplification that should be marked explicitly in the eventual SPEC to avoid re-litigation later.

**F7 — Aurora**
- Aurora is a real geomagnetic phenomenon with no meaningful offline simulation basis (unlike eclipses, which are pure orbital geometry). Tying it to live solar-activity data would add a *second* external-API dependency alongside F5, compounding all of F5's degradation-handling complexity. REQ-620 explicitly scopes F7 as decorative-only for this reason.
- Fragment-shader-heavy aurora effects are known to tank frame rate on integrated/low-end mobile GPUs (Adreno/Mali) — the sprite/billboard fallback (REQ-640/REQ-650) must be a hard requirement on mobile, not optional polish, given the existing 30fps mobile floor.

---

## 5. Risks and Constraints, Ranked by Severity

**High**
1. **Load/texture-memory budget creep** — five features simultaneously add assets against a static, backend-less, GitHub Pages-hosted project with an already-tight 10s/10Mbps load target. Must track cumulative payload across all features together, not per-feature in isolation.
2. **F5 external-dependency risk** — unconfirmed CORS, ambiguous ToS (OpenSky), and shared free-tier rate limits (both candidates) make this the single highest-uncertainty item in the whole expansion. Correctly scoped as Optional/degradable; must not be allowed to block shipping F1–F4/F6/F7.
3. **No WebGL context-loss handling exists today** (confirmed by grep across `src/`) — a heavier combined scene raises the practical likelihood of hitting this gap. Must be designed as part of F4, not discovered in production.
4. **SPEC-UI-001 documentation drift** — the shipped codebase already exceeds its own spec (moons on all 8 planets, external stars, camera-focus — none documented in REQ-001–022). Any new SPEC that assumes "current state = SPEC-UI-001" will conflict with or duplicate already-shipped behavior. This should be reconciled (a lightweight SPEC-UI-001 addendum/re-baseline) before or alongside the first new SPEC's Run phase.

**Medium**
5. Frame-budget contention across three new GPU-cost features (moon/LOD count, aurora shader, eclipse overlay) competing for the same 60/30fps ceiling — needs the priority-degradation order (REQ-240) designed up front.
6. This expansion introduces the project's *first* explicit accessibility requirement (WCAG 2.1 AA for the Earth view). If under-resourced here, it likely stays a gap for all future UI work too.
7. Eclipse detection at high time-acceleration is an easy-to-overlook algorithmic edge case that will only surface once 500x mode is actually exercised in testing (it already exists and is in scope per SPEC-UI-001 REQ-019).

**Low**
8. Visual crowding/z-fighting from 11 major moons + 5 dwarf planets at default zoom — cosmetic, fixable via distance-scale tuning, not architecturally risky.
9. Aurora's lack of real-data grounding is a deliberate, low-risk decision since it is explicitly framed as decorative rather than a data-accuracy commitment.

---

## 6. SPEC Decomposition Proposal

**Recommendation: Option B (three SPECs), with a specific grouping and execution order.**

- **SPEC-SIM-002** — F1 (dwarf planets) + F2 (major moons) + F3 (smoothness/resolution/perf). Pure data-model + rendering-pipeline work; no dependency on the others. Should run **first**, because F3 establishes the LOD/degradation infrastructure (REQ-240's priority order) that F6 and F7 should build on rather than duplicate.
- **SPEC-ECLIPSE-001** — F6 (solar/lunar eclipses). Self-contained: only touches `OrbitalMechanics.js` and adds a rendering/detection module; no dependency on the Earth view existing. Can run **second**, in parallel with or immediately after SPEC-SIM-002 — good candidate for a fast, independently shippable slice.
- **SPEC-EARTH-001** — F4 (Earth detail view) + F5 (flight positions, Optional) + F7 (aurora). These three are genuinely coupled: F5 and F7 are both visual layers that only make sense *inside* the new Earth-view scene/UI surface that F4 builds. Should run **last**, so it can (a) inherit the perf/degradation pipeline from SPEC-SIM-002, the heaviest GPU-cost consumer, and (b) optionally host eclipse rendering from SPEC-ECLIPSE-001 as an already-built module instead of building it inline.

Rationale for rejecting the alternatives:
- **Option A (single SPEC)** rejected: 7 features spanning a new data model, a rendering-pipeline change, a new camera/scene mode, an external-API integration with its own error-handling subsystem, and two shader/particle effects is far beyond a single Run-phase's 180K-token budget (per `.claude/rules/moai/workflow/spec-workflow.md`), and would force an awkward internal sub-split anyway — better to make that split explicit at the SPEC level, and it also directly conflicts with the project's Multi-File Decomposition HARD rule at a scale that guarantees 3+ file changes.
- **Option C (one SPEC per feature, 7 total)** rejected as over-fragmentation: F1 and F2 are individually small (mostly additive data-file entries reusing existing `PlanetFactory`/`OrbitalMechanics` pipelines, on the order of tens of lines each) and don't individually justify the fixed overhead of a full SPEC document (spec.md + acceptance.md + traceability). Splitting them from F3 would also separate the perf work from the very content growth that motivates it.

**Recommended execution order: SPEC-SIM-002 → SPEC-ECLIPSE-001 → SPEC-EARTH-001**, with F5 explicitly flagged Optional/droppable inside SPEC-EARTH-001 so a failed F5 feasibility check at Run-phase does not block F4 or F7 within the same SPEC.

---

## 7. Given/When/Then Acceptance Scenario Sketches

**F1 — Dwarf Planets**
```gherkin
Scenario: All 5 IAU dwarf planets are rendered
  Given the website has fully loaded
  When the 3D scene is displayed
  Then Pluto, Ceres, Eris, Haumea, and Makemake should each be visible as distinct bodies
  And Ceres should appear between Mars and Jupiter
  And Pluto, Eris, Haumea, and Makemade should appear beyond Neptune's orbit

Scenario: Pluto's eccentric orbit is respected
  Given the simulation is playing
  When observing Pluto's orbital path over multiple simulated years
  Then the path should be visibly elliptical (eccentricity 0.248)
  And Pluto's orbit should show measurable inclination relative to the ecliptic plane (17 degrees)
```

**F2 — Jupiter/Saturn Major Moons**
```gherkin
Scenario: Callisto completes Jupiter's Galilean set
  Given the 3D scene is rendered
  When the user zooms in on Jupiter
  Then Io, Europa, Ganymede, and Callisto should all be visible orbiting Jupiter

Scenario: Saturn's 7 rounded moons are all present
  Given the 3D scene is rendered
  When the user zooms in on Saturn
  Then Mimas, Enceladus, Tethys, Dione, Rhea, Titan, and Iapetus should all be visible
  And no two moons should visually overlap at Saturn's default zoom level
```

**F3 — Smoothness / Resolution**
```gherkin
Scenario: Expanded scene sustains target frame rate
  Given the full expanded scene is loaded on a desktop browser
  And all planets, dwarf planets, and 11 major moons are visible
  When the simulation plays at 10x speed for 60 seconds
  Then the p95 frame time should not exceed 25 ms

Scenario: Low-tier device receives graceful degradation
  Given the user is on a device with hardwareConcurrency <= 4
  When the scene loads
  Then texture resolution should be capped and LOD upgrades disabled
  And core interaction (click, hover, camera controls) should remain fully functional
```

**F4 — Dedicated Earth View**
```gherkin
Scenario: Selecting Earth opens the dedicated view
  Given the simulation is running in the overview scene
  When the user clicks Earth
  Then the camera should transition into the dedicated Earth view within 2 seconds
  And the day/night terminator, cloud layer, and orbiting Moon should be visible

Scenario: Exiting the Earth view returns to overview
  Given the dedicated Earth view is open
  When the user presses Escape
  Then the camera should return to the prior overview position
  And the Earth-view-specific UI overlays should be removed
```

**F5 — Flight Positions (Optional)**
```gherkin
Scenario: Aircraft markers render when the API is available
  Given the Earth view is open and the flight-data feature is enabled
  And the selected flight-position API responds successfully
  When aircraft position data is received
  Then aircraft markers should appear on the Earth model at their reported positions

Scenario: Graceful degradation when the flight API is unreachable
  Given the Earth view is open and the flight-data feature is enabled
  When the flight-position API request fails (CORS, network error, or rate limit)
  Then the aircraft layer should be disabled
  And a small "live flight data unavailable" indicator should appear
  And all other Earth-view functionality should remain fully usable
```

**F6 — Eclipses**
```gherkin
Scenario: Solar eclipse renders on genuine alignment
  Given the simulation is playing
  When the Moon's shadow cone geometrically intersects Earth
  Then a solar eclipse shadow overlay should render on Earth
  And no eclipse should render at any other time

Scenario: Eclipse detection holds at high time acceleration
  Given the simulation is playing at 500x speed
  When a genuine Sun-Earth-Moon alignment occurs during that playback
  Then the eclipse should still be detected and rendered
  And it should not be silently skipped due to the large per-frame time step
```

**F7 — Aurora**
```gherkin
Scenario: Aurora renders in the Earth view on capable devices
  Given the Earth view is open on a desktop-class device
  When the polar regions are in view
  Then the aurora effect should render using the full particle/shader version

Scenario: Aurora falls back on low-tier devices
  Given the Earth view is open on a device classified as low-tier/mobile
  When the polar regions are in view
  Then a simplified billboard/sprite-based aurora should render instead
  And the frame rate should remain at or above the 30 fps mobile floor
```

---

## Sources (F5 research)

- [OpenSky REST API documentation](https://openskynetwork.github.io/opensky-api/rest.html) — anonymous rate limit (400 credits/day, 10s resolution), bounding-box query params, no CORS statement found.
- [OpenSky General Terms of Use & Data License Agreement](https://opensky-network.org/about/terms-of-use) — operational/live-product use requires written license regardless of non-profit status.
- [adsb.lol API docs](https://api.adsb.lol/docs) / [ADSB.lol Open Data](https://www.adsb.lol/docs/open-data/) — free, no API key or account required, community-run, ADSBExchange-RapidAPI-compatible schema, dynamic rate limits.
