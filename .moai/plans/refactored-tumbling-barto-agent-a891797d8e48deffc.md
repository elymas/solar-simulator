# Solar-Simulator Feature Expansion — Architectural Design (Plan Phase)

Scope: F1 dwarf planets, F2 Jupiter/Saturn moons, F3 rendering quality + stack verdict, F4 Earth view, F5 live flights, F6 eclipses, F7 aurora. Design only — no implementation code.

---

## 0. Grounding: what the code actually is today

Read every module. The three facts that drive every decision below:

**Fact A — All bodies use `MeshBasicMaterial` (unlit).** `PlanetFactory.js:127` (planets), `:160` (clouds), `:182/:186` (moons), `:219` (rings), `:272` (stars), `:75` (sun). Consequence: the `PointLight` at the sun (`SceneManager.js:71`) and `AmbientLight` (`:68`) contribute **nothing** to any planet. There is no day/night terminator, no self-shadowing, no light response at all — every surface is drawn at full texture brightness from every angle. **F6 (eclipse shadows) and F7 (aurora at lit poles / dark side) are physically impossible until materials become lit (`MeshStandardMaterial`/`MeshPhongMaterial`).** This makes F3's material migration a hard prerequisite for F6/F7, not a nice-to-have.

**Fact B — F1 and F2 are ~90% data, not architecture.** `PlanetFactory._createAllPlanets()` (`:92-112`) iterates `PLANET_DATA` for planets and iterates all of `MOON_DATA` for satellites; `_createOrbitLines()` (`:239-263`) auto-generates an orbit for every non-sun `PLANET_DATA` key; `PlanetList._createDOM()` (`:224-248`) already nests moons and has a category-divider pattern (`Stars`). Jupiter's Io/Europa/Ganymede and Saturn's Titan/Enceladus/Rhea **already exist and already render** (`planetData.js:187-274`). So F2 = add Callisto + a few more Saturn moons (+ optional textures/labels), and F1 = add 5 dwarf rows (+ textures + one PlanetList category + one InfoPanel branch). No new subsystem.

**Fact C — Nothing is to scale, and there is exactly one scene/camera/renderer/loop.** `displayRadius` and `distanceDisplay` are hand-tuned (Sun 50, Earth 8 at distance ~200, Moon 15 units from Earth vs. real ~60 Earth-radii). `main.js` builds one `SceneManager` (`:14`), one `PlanetFactory` (`:34`), one `requestAnimationFrame` loop (`:145-170`), and a global god-object `window.__solarSim` (`:22-31`). Consequence: **geometrically-accurate eclipse umbra math cannot work in this coordinate system** (F6 must be scripted or use a separate local rig), and **F4 requires introducing a view/state layer** that does not exist yet.

**Verified rendering bug relevant to F3:** `EffectComposer`'s default render target is `new WebGLRenderTarget(w, h, { type: HalfFloatType })` with `samples` defaulting to 0 (`node_modules/three/examples/jsm/postprocessing/EffectComposer.js:67`). The renderer's `antialias: true` (`SceneManager.js:31`) applies only to the default framebuffer, **not** to the composer's offscreen target. Because all output goes through `composer.render()` (`SceneManager.js:229`), **the visible image is currently NOT multisampled** — the AA flag is dead. This is the single cheapest, highest-impact F3 fix.

Asset weight today: `public/textures/` = **7.0 MB** total, all 2K JPG. Small enough that keeping the solar scene fully resident in memory during an Earth-view excursion is free on desktop.

---

## 1. F3 Tech-stack verdict

**Recommendation: (a) Keep vanilla Three.js r175 on `WebGLRenderer`.** Add a multisampled `EffectComposer` target, migrate planet materials to lit `MeshStandardMaterial`, add SMAA + ACES tone mapping, and lazy-load higher-detail textures. Do **not** migrate frameworks or renderers.

| Option | Bundle delta (gz, approx) | Rewrite cost (11 modules) | GitHub Pages fit | WebGPU / post-processing maturity | Verdict |
|---|---|---|---|---|---|
| **(a) Vanilla three + EffectComposer + higher-detail assets** | ~0 core; +~5–15 KB for SMAA pass; textures lazy-loaded (opt-in bytes) | **0 rewritten** — additive only | Perfect: pure static, Vite already tree-shakes, `base` set | Stays on mature WebGL `UnrealBloomPass`/`EffectComposer` path already in use | **CHOSEN** |
| (b) react-three-fiber | +React+ReactDOM+fiber ≈ **+130–150 KB gz**; drei (if used) far more | **All 11 modules rewritten** imperative→JSX; InfoPanel/PlanetList/TimeControls become React too | Static-compatible, but heavier CI/build | Same three under the hood — buys no rendering capability we lack | Rejected |
| (c) Babylon.js | **New engine ≈ +300+ KB gz core** (more with post-process/GUI) | **Full rewrite + API relearn**; loses `three/addons` ecosystem | Static-compatible | Strong engine, but zero reuse of existing orbital/scene code | Rejected |
| (d) CesiumJS or globe.gl for Earth view only | Cesium **+3–4 MB** (engine+assets+tiles); globe.gl adds d3 + is itself a three wrapper | Earth view only, but **two engines/cameras coexist** | Cesium's tile/ion assets fight a no-backend static model; globe.gl tolerable | Cesium overkill and heavy; globe.gl re-solves what we already have in three | Rejected |

**Rejection rationale, concretely:**
- **(b) r3f** — the entire value proposition is declarative component ergonomics. We have 11 working imperative modules and a hand-tuned RAF loop; rewriting them to JSX is pure cost for zero user-visible gain, and it drags the DOM UI into React too. Violates "does this need to exist at all."
- **(c) Babylon** — a second rendering engine with no path to reuse `OrbitalMechanics`, `PlanetFactory`, or the `three/addons` passes already wired. Highest rewrite cost of all four.
- **(d) Cesium/globe.gl** — Cesium is a geospatial globe platform (imagery tiles, terrain, ion tokens) — that's a backend-shaped dependency bolted onto a deliberately backend-free project, and 3–4 MB dwarfs the whole current app. globe.gl is a thin three.js wrapper; adopting it means running its opinions and camera alongside our own three scene for F5/F6/F7 — two coordinate systems to reconcile. We can build the Earth view natively in the engine we already own.
- **WebGPU (`three.webgpu.js` ships in r175, confirmed present)** — real, but it's a **separate build** and its post-processing is TSL-based `PostProcessing`, not the `EffectComposer`/`UnrealBloomPass` this app uses. Migrating means rewriting the bloom pipeline for a renderer whose ecosystem is still stabilizing, to run on a browser feature not yet universal. Not warranted for an educational site. Keep WebGL; revisit WebGPU only if a future volumetric feature demands compute shaders.

The "smoother + higher-resolution" goal in F3 is achieved by fixing the dead AA flag, adding lit materials + tone mapping, and tiering textures — **not** by changing stacks.

---

## 2. F4 View-switching architecture

**Recommendation: one renderer + one `EffectComposer`, two `Scene`/`Camera` pairs, governed by a new `ViewManager` state machine.** Reject "single scene / camera zones" (Fact C: you cannot dolly from a solar overview into an atmosphere/aurora/flight-detailed Earth that is 8 units wide — the scales are irreconcilable). Reject "two `SceneManager` instances" as written, because each `SceneManager` creates its own `WebGLRenderer` and appends a canvas (`SceneManager.js:30-38`) — two WebGL contexts is wasteful and risks context loss. Instead, **share the renderer**; give each view its own scene, camera, and update function.

### State machine

```
        selectPlanet('earth')  /  hashchange #/earth
  ┌──────────────────┐  ───────────────────────────►  ┌─────────────┐
  │ SolarSystemView  │        (transition: TO_EARTH)   │  EarthView  │
  │  (current app,   │  ◄───────────────────────────   │             │
  │   wrapped)       │   back btn / Esc / #/            └─────────────┘
  └──────────────────┘        (transition: TO_SOLAR)
States: SOLAR, TO_EARTH (transitioning), EARTH, TO_SOLAR (transitioning)
```

- **`ViewManager`** (new, `src/core/ViewManager.js`) owns: the shared renderer+composer, the active view, hash routing, transition orchestration, and which DOM UI is mounted. Only the active view's `update(dt)` runs; only its `(scene, camera)` is rendered. This replaces the god-loop in `main.js:145`.
- **`SolarSystemView`** (new wrapper, `src/views/SolarSystemView.js`) — moves the existing wiring (PlanetFactory, InteractionManager, InfoPanel, PlanetList, TimeControls, the focus/deselect logic from `main.js:57-142`) behind a `View` interface: `mount()/unmount()/update(dt)/onEnter()/onExit()`. The solar scene stays resident but its `update()` is skipped while in EARTH state (orbits freeze — acceptable, or keep ticking cheaply).
- **`EarthView`** (new, `src/earth/EarthView.js`) — its own `Scene`, its own `PerspectiveCamera` with Earth-appropriate `near/far` (kilometers-scale local frame, not the solar 0.1–100000), its own high-detail Earth rig, its own HUD, and mount points for F5/F6/F7.

### View interface (contract, not code)

`mount(renderer, composer)` · `unmount()` · `onEnter(fromState)` · `onExit()` · `update(dtSeconds)` · `getScenePass()` returns `{scene, camera}` for the composer's `RenderPass`.

### Transition animation

Simplest correct approach: **crossfade via a full-screen DOM overlay** (a `<div>` faded to black over ~400 ms), swap the active view at the opaque midpoint, fade back. Zero extra render targets, works identically on mobile. Optional upgrade later: a "dive to Earth" camera dolly in the solar view that hands off to EarthView at the opaque frame (the user reads it as a continuous zoom). Reuse the existing ease-out-cubic tween style already in `SceneManager.start()` (`:198-226`).

### Asset lifecycle (dispose vs keep)

- **Solar scene:** keep resident (7 MB, cheap). Pause its `update()` in EARTH state.
- **EarthView:** lazy-build on first entry (don't pay for it if the user never clicks Earth). Its heavy assets (4K/8K Earth day/night/normal/specular, cloud, aurora shader, flight `InstancedMesh`) are built on first `onEnter`.
- **On exit:** desktop → keep EarthView alive (instant re-entry). Mobile (`navigator` check already exists at `SceneManager.js:115`) → `dispose()` EarthView geometries/materials/textures/render targets to reclaim VRAM. F5 polling **must** stop on exit regardless of platform (see §6).

### UI panel swapping

`ViewManager` owns mounting. `PlanetList`/`TimeControls`/`InfoPanel` are SolarSystemView-owned and hidden/detached in EARTH state. EarthView mounts its own HUD (info density: sub-solar point, terminator time, selected aircraft, eclipse controls, aurora toggle) plus a persistent "← Solar System" back button. The `window.__solarSim` global (`main.js:22`) is superseded by `ViewManager`; keep a thin shim on `window.__solarSim` during migration so nothing that references it breaks, then remove.

### URL / hash routing

`#/` → SOLAR, `#/earth` → EARTH. `ViewManager` listens to `hashchange` and drives the same transitions as clicks, so the Earth view is deep-linkable and the browser Back button works. Vite `base: '/solar-simulator/'` is unaffected (hash routing needs no server rewrites — ideal for GitHub Pages).

### Hardcoded assumptions that break (must be refactored in F4)

| Location | Assumption | Break under F4 |
|---|---|---|
| `main.js:14,34,145` | one SceneManager, one factory, one loop | loop must become view-dispatched |
| `main.js:22-31` | `window.__solarSim` global holds all sim state | must move into view/ViewManager scope |
| `main.js:57-81` | `selectPlanet` only focuses camera | selecting Earth must *transition views*, not just focus |
| `SceneManager.js:44-50` | single camera, `far:100000` (`constants.js:13`) | EarthView needs its own near/far/frame |
| `constants.js:17-22` `CONTROLS_DEFAULTS` | one min/max distance regime | EarthView controls need Earth-local limits |
| `InteractionManager` (`main.js:92`) | built once over the solar factory's planets | EarthView needs its own picking (aircraft, poles) or none |
| `PlanetFactory._createStarfield` (`:59-67`) | starfield sphere r=10000 lives in the shared scene | EarthView needs its own (or a shared, view-agnostic) sky |
| `SCALE` (`constants.js:24-28`) | placeholder identity scale, unused | EarthView introduces a real local scale; solar stays symbolic |

---

## 3. F3 Rendering-quality upgrade plan (ordered by impact ÷ cost)

1. **Multisample the composer (fix dead AA).** Construct `EffectComposer` with `new THREE.WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 })` (WebGL2, universal on target browsers). Removes jagged planet limbs immediately. *Cost: ~2 lines. Impact: high.* Alternative/addition: an `SMAAPass` (higher quality than FXAA on edges, cheaper than TAA and no temporal ghosting on orbiting bodies — **prefer SMAA over FXAA/TAA** here; TAA's reprojection fights constant orbital motion).
2. **Migrate planet/moon materials `MeshBasicMaterial → MeshStandardMaterial`** (sun & stars stay `MeshBasic`/emissive — they *are* the light sources). This lights the existing `PointLight`, produces a real day/night terminator, and is the prerequisite for F6 shadows and F7 pole lighting (Fact A). Lower `AmbientLight` so the dark side is visibly dark but not black. *Cost: medium (relight + tune per body). Impact: high + unblocks F6/F7.*
3. **Tone mapping + output.** Set `renderer.toneMapping = ACESFilmicToneMapping` (currently `NoToneMapping`, `SceneManager.js:37`) with a tuned `toneMappingExposure`; keep the existing `OutputPass`. Makes bloom and lit surfaces read as HDR rather than flat. *Cost: low. Impact: high.*
4. **Anisotropic filtering.** In `_loadTexture` (`PlanetFactory.js:50-54`) set `texture.anisotropy = renderer.capabilities.getMaxAnisotropy()`. Kills the smeared look at grazing angles (rings, planet limbs). *Cost: ~1 line. Impact: medium.*
5. **Texture resolution tiers + lazy load.** Keep 2K as the initial payload (fast first paint). On focus/selection of a body — and always in EarthView — swap to 4K/8K day/night/normal/specular fetched on demand. Never ship 8K in the initial bundle. *Cost: medium (a small texture-tier loader). Impact: high sharpness, controlled bytes.*
6. **Geometry LOD / segment bump.** Current segments are a binary `displayRadius` threshold (`PlanetFactory.js:120`, moons hardcoded 16 at `:178`). Give focused/close bodies 96–128 segments, distant ones fewer; optionally distance-based swap. *Cost: low-medium. Impact: medium (round limbs when zoomed).*
7. **Pixel-ratio handling.** Keep the `min(devicePixelRatio, 2)` cap (`:35`) but add **dynamic resolution scaling**: if frame time exceeds budget, drop `setPixelRatio` a step; recover when headroom returns. Preserves the existing mobile downgrade (`:114-123`). *Cost: medium. Impact: medium (smoothness on weak GPUs).*
8. **Earth surface shading (EarthView).** Normal/bump map for terrain relief, specular map so oceans glint and land doesn't, cloud layer casting a soft shadow, day↔night blend across the terminator using the existing `2k_earth_nightmap.jpg` (already in `TEXTURE_MAP`, `constants.js:35`, currently unused). *Cost: medium. Impact: high in EarthView.*
9. **Instanced rendering (situational).** Use `InstancedMesh` for: F5 aircraft (potentially thousands — mandatory), an optional asteroid-belt band introduced alongside Ceres, and any point-star upgrade. Not needed for the 8 planets + handful of moons. *Cost: per-feature. Impact: high where counts are large.*

---

## 4. F6 Eclipse design

**Recommendation: scripted "preset eclipse events" (time-jump to real eclipse dates) rendered with a real light + shadow map in a *local, correctly-scaled rig*, primarily inside EarthView.** Do **not** attempt geometric umbra math in the solar-system view.

**Why scripted, not geometric:** Fact C — Sun/Earth/Moon sizes and separations in the solar view are symbolic (Moon 15 units from an 8-unit Earth; real ratio ~60:1). A true umbra cone requires physical size/distance ratios; in the current coordinate system the shadow would be nonsensical. Educationally, a non-scale simulator's job is to *show what an eclipse is*, on demand — a curated list of actual events (e.g., total solar 2027-08-02, total lunar dates) that the user jumps to via a picker beats hoping alignment occurs during free playback (which, at symbolic scale, it never cleanly does).

**Rendering technique — local eclipse rig:** in EarthView, stand up a Sun–Earth–Moon sub-arrangement at controllable *relative* scale (doesn't need to match reality, only to produce a believable cone) and enable Three.js shadow maps:
- `DirectionalLight` from the sun direction, `castShadow = true`, `PCFSoftShadowMap`.
- **Solar eclipse:** Moon `castShadow`, Earth `receiveShadow` → the Moon's shadow lands on Earth's surface; the camera watches the umbral spot track across the globe. Soft shadow radius gives a penumbra falloff for free.
- **Lunar eclipse:** Earth `castShadow`, Moon `receiveShadow` → Earth's shadow swallows the Moon; tint the umbral core red via a shader/emissive term to reproduce the "blood moon" (Rayleigh-refracted sunlight) instead of pure black.

**Umbra/penumbra specifically:** shadow maps with `PCFSoftShadowMap` + a tuned `light.shadow.radius` yield a single soft falloff, which reads as penumbra. For the crisper two-zone umbra/penumbra look, layer a **projected radial-gradient decal/shader on the receiving surface**: opaque core (umbra) → graded ring (penumbra) → clear, sized from the scripted event's magnitude. This is cheaper and more controllable than physically raytracing two cones, and it degrades gracefully on mobile (drop to the plain soft shadow map, or a flat darkening disc).

**Solar-view tie-in (optional, cheap):** when a preset is selected, the solar view may *scripted-align* Sun–Earth–Moon for a recognizable silhouette and drop a stylized shadow billboard — purely illustrative, no geometry claims.

---

## 5. F7 Aurora design

**Recommendation: noise-driven curtain geometry with additive emissive shading, ringed around the magnetic poles, EarthView only.** Reject volumetric raymarching.

**Why curtains, not raymarch:** volumetric raymarching a billboard is a heavy per-pixel fragment cost that tanks on integrated/mobile GPUs — exactly the low-end devices the app already special-cases (`SceneManager.js:114-123`). A curtain is cheap geometry the GPU loves.

**Technique:** a set of vertical ribbon meshes (or a thin cylinder band) placed as a partial ring offset from the geographic poles toward the magnetic poles, tilted to Earth's axial tilt (23.44°, already in `planetData.js:54`). Custom `ShaderMaterial`:
- **Vertex:** displace along the curtain's height/curve using scrolling FBM/simplex noise → the rippling "dancing" motion.
- **Fragment:** vertical gradient (green core → magenta/violet tips), intensity driven by animated noise, **`AdditiveBlending`, `depthWrite: false`, `transparent: true`, `side: DoubleSide`** so curtains glow and layer without occlusion artifacts. Its emissive contribution also feeds the existing bloom pass for the characteristic soft radiance.
- Bind to Earth's night side (fade by `dot(surfaceNormal, sunDirection)`) so aurorae only show against darkness — which is why F3's lit-material migration (Fact A) is a prerequisite.

**Performance budget:** target ≤ ~1.5 ms/frame on mid-tier desktop. Knobs: curtain count, ribbon segment count, noise octaves. Two aurorae (north + south) at moderate segment counts fit comfortably alongside the Earth rig + F5 flights.

**Mobile fallback (tiered):** (1) fewer curtains + fewer noise octaves; (2) if still constrained, replace vertex-displaced ribbons with a static curved mesh carrying a scrolling animated aurora texture (no per-vertex noise); (3) hard off on the lowest tier (reuse the existing `isMobile || isLowEnd` gate). Aurora is decorative — dropping it must never break EarthView.

---

## 6. F5 Flight-data integration

**Conditional feature, EarthView only, must degrade gracefully — never block or error the view if data is unavailable.**

**API choice (client-side, no key, CORS, static-host-safe):** free community ADS-B feeds — **`adsb.lol` / `adsb.fi` / `airplanes.live`** — expose anonymous JSON over CORS with no server-side secret, which is the only shape compatible with a keyless GitHub Pages static site. **OpenSky Network** is the documented fallback but its anonymous tier is heavily rate-limited and now steers toward OAuth2 client-credentials (a secret we cannot ship in a static bundle). *Exact rate limits and current CORS headers must be re-verified at implementation time and pinned in the SPEC; treat all numbers here as "verify then pin."*

**Polling architecture (`src/data/FlightDataService.js`, new):**
- **Cadence:** poll every ~10–15 s (ADS-B position updates are seconds-scale; faster wastes the rate budget for no visible gain). Poll **only while EARTH state is active and the tab is visible** (`document.visibilitychange`) — stop immediately on view exit or tab hide (this is both a rate-limit and a battery concern).
- **Rate-limit budget:** one request per interval → a few requests/minute, well under free tiers. Optionally request a bounding box around the current sub-solar/camera region rather than the whole sky to shrink payloads.
- **Data → render:** map each aircraft `(lat, lon, baro_altitude, track)` to a position on the Earth sphere (+ small altitude offset) into a single **`InstancedMesh`** (one instance matrix per aircraft; orient by heading). Thousands of instances = one draw call. Selecting an instance shows callsign/altitude/velocity in the HUD.
- **Interpolation between polls:** dead-reckon each aircraft forward from its last known position using reported `velocity` + `track` each frame, so motion is smooth at 60 fps instead of teleporting every ~12 s. On each new poll, lerp from the dead-reckoned estimate to the fresh truth to avoid snapping.

**Graceful-degradation states (explicit HUD status, feature stays optional):**
| State | Trigger | Behavior |
|---|---|---|
| `OFF` (default) | user hasn't enabled flights | no polling, no cost; a toggle invites opt-in |
| `LOADING` | first fetch in flight | spinner in HUD; Earth fully usable |
| `LIVE` | fetch OK | instanced aircraft + "live • N aircraft • updated Xs ago" |
| `RATE_LIMITED` | HTTP 429 / quota | back off (exponential), show "rate-limited, retrying"; keep last frame's aircraft dead-reckoning |
| `OFFLINE` / `ERROR` | network fail / CORS / bad payload | show "flight data unavailable"; **EarthView continues** with zero aircraft; auto-retry with backoff |

No API key path exists by design (keyless provider); the "no key" degradation is simply provider-unreachable → `OFFLINE`. Validate/clamp all incoming coordinates before building matrices (untrusted external input at a trust boundary).

---

## 7. File-impact analysis

Legend: **N** = new module, **M** = modify. Blank = untouched by that feature.

| File | F1 dwarfs | F2 moons | F3 render | F4 Earth view | F5 flights | F6 eclipse | F7 aurora |
|---|---|---|---|---|---|---|---|
| `src/planets/planetData.js` | **M** (+5 dwarf rows, `category`) | **M** (+Callisto, +Saturn moons, +textures) | | | | | |
| `src/utils/constants.js` | **M** (dwarf texture map) | **M** (moon texture map) | **M** (bloom/tone/AA/texture-tier config) | **M** (EarthView near/far/scale consts) | | | |
| `src/planets/PlanetFactory.js` | **M** (dwarf loop/category) | **M** (moon orbit lines/labels) | **M** (MeshStandard, anisotropy, LOD) | | | | |
| `src/planets/OrbitalMechanics.js` | **M** (high-i/high-e dwarfs; consider Ω/ω) | | | | | | |
| `src/ui/PlanetList.js` | **M** (dwarf category divider) | **M** (moon entries auto, verify) | | **M** (owned by SolarSystemView) | | | |
| `src/ui/InfoPanel.js` | **M** (dwarf-planet branch) | **M** (moon data already handled, verify) | | **M** (SolarSystemView-scoped) | | | |
| `src/scene/SceneManager.js` | | | **M** (composer MSAA, tone map, shadows, lighting) | **M** (share renderer across views) | | **M** (shadow map enable) | |
| `src/controls/InteractionManager.js` | **M** (dwarf hit-targets, auto) | | | **M** (solar-scoped; EarthView picks separately) | | | |
| `src/main.js` | | | | **M** (gut god-loop → ViewManager bootstrap) | | | |
| `src/core/ViewManager.js` | | | | **N** (state machine, routing, transitions, UI mount) | | | |
| `src/views/SolarSystemView.js` | | | | **N** (wrap current app behind View interface) | | | |
| `src/earth/EarthView.js` | | | | **N** (scene/camera/HUD/rig host) | **M** | **M** | **M** |
| `src/earth/EarthRig.js` | | | **M**-adjacent | **N** (hi-detail Earth: day/night/normal/spec/clouds) | | | |
| `src/ui/EarthHUD.js` | | | | **N** (richer info density, back button) | **M** (flight status/selection) | **M** (eclipse picker) | **M** (aurora toggle) |
| `src/data/FlightDataService.js` | | | | | **N** (poll/interpolate/degrade) | | |
| `src/effects/EclipseRig.js` | | | | | | **N** (local light+shadow rig, umbra decal) | |
| `src/effects/AuroraEffect.js` | | | | | | | **N** (curtain geometry + shader) |
| `public/textures/…` | +dwarf textures | +moon textures | +4K/8K Earth tiers (lazy) | +Earth normal/spec | | | +aurora ramp (optional) |

New directories proposed: `src/core/`, `src/views/`, `src/earth/`, `src/data/`, `src/effects/`.

---

## 8. Implementation order, dependency graph, and SPEC split

### Dependency graph

```
F1 (dwarfs) ─┐
F2 (moons)  ─┼─ independent, no prerequisites ──► ship anytime
             │
F3 (render + LIT MATERIALS) ──────────────► prerequisite for F6, F7
             │
F4 (Earth view + ViewManager) ────────────► prerequisite for F5, F6, F7
             ├──► F5 (flights)      needs F4
             ├──► F6 (eclipse)      needs F4 + F3(shadows/lit)
             └──► F7 (aurora)       needs F4 + F3(lit night side)
```

Two hard edges (from Fact A and Fact C): **F3's lit-material migration gates F6 and F7**, and **F4 gates F5/F6/F7**. Everything else is parallelizable.

### Milestone order (each independently shippable)

1. **M1 — Content expansion (F1 + F2).** Pure data + textures + one PlanetList category + one InfoPanel branch. Lowest risk, immediate visible value, touches no architecture. Ship first.
2. **M2 — Fidelity upgrade (F3).** Composer MSAA/SMAA, ACES tone mapping, anisotropy first (cosmetic, safe), then the `MeshBasic → MeshStandard` relight (higher risk — changes the look to a real day/night terminator; isolate and tune here so F6/F7 inherit a working lit scene). Texture tiers.
3. **M3 — Earth-view platform (F4).** ViewManager + SolarSystemView wrapper + EarthView scaffold + high-detail Earth rig + hash routing. Ships as "click Earth → dedicated view" with the richer HUD, even before F5/F6/F7 exist.
4. **M4 — Earth simulations (F5, F6, F7).** Each layers onto EarthView and is independently demoable/shippable within the milestone: flights (opt-in, degrading), eclipses (preset picker + local shadow rig), aurora (curtain shader + mobile tiers).

### Recommended SPEC split: **3 SPECs**

- **SPEC-1 "Solar System: Content & Fidelity" = M1 + M2 (F1, F2, F3).** All confined to the *existing* single-view app. Cohesive theme ("make the current scene bigger and prettier"), and it deliberately front-loads the material migration that F6/F7 depend on — so the risky relight is validated in a small, self-contained SPEC before any Earth-view work builds on it.
- **SPEC-2 "Earth View Platform" = M3 (F4).** The architectural spine: view state machine, renderer sharing, routing, transitions, EarthView + Earth rig + HUD. One SPEC because it's one indivisible refactor of the app's core loop and shipping it alone (a working, richer Earth view) is a clean, testable milestone.
- **SPEC-3 "Earth View Simulations" = M4 (F5, F6, F7).** Three additive features that all plug into SPEC-2's EarthView and share its HUD, lifecycle, and mobile-degradation policy. Grouping them keeps that shared EarthView contract in one SPEC's scope; each remains an independent milestone inside it.

**Why not 1 SPEC:** F3's material migration + F4's core-loop refactor + three Earth simulations is too much surface for one reviewable/testable unit, and it couples low-risk data work to high-risk shader/architecture work.

**Why not 2 SPECs:** the natural 2-way cut (content+fidelity | everything-Earth) buries the F4 platform refactor together with F5/F6/F7 in one oversized SPEC, hiding the single most important architectural decision (the view machine) inside a pile of feature work. Splitting F4 into its own SPEC-2 makes the spine independently reviewable and independently shippable, and lets SPEC-3's three simulations proceed in parallel against a frozen EarthView contract.

---

## Post-design risk notes (for run phase)

- **F3 relight regression:** switching to `MeshStandardMaterial` makes night sides dark — intended, but it changes the app's signature "everything glowing" look. Tune ambient + confirm the sun/stars stay emissive. Add a visual before/after check.
- **F6 scale honesty:** document in the UI that eclipse geometry is illustrative, not to scale — the whole app is non-scale (Fact C); don't imply otherwise.
- **F5 external input:** clamp/validate all aircraft coordinates before building instance matrices; never let a malformed API payload throw inside the render loop.
- **F1 orbital fidelity:** Pluto/Eris have high inclination/eccentricity; the current `calculatePosition` (`OrbitalMechanics.js:19-51`) omits longitude of ascending node (Ω) and argument of perihelion (ω), so crossing orbits will look schematic. Acceptable for education; note it rather than silently shipping "wrong-looking" Pluto.
- **F4 `window.__solarSim` shim:** keep the global as a thin compatibility shim during the ViewManager migration, then delete — don't leave two sources of truth.
