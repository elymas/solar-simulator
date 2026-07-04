# Architecture and Module Structure

## Module Overview

The application is organized into five directories under `src/`, each with a single responsibility.

```
src/
├── main.js              Entry point
├── scene/               Three.js scene infrastructure
├── planets/             Celestial body logic and data
├── controls/            User input handling
├── ui/                  DOM-based user interface components
└── utils/               Shared constants
```

---

## Module Responsibilities

### `main.js` — Application Entry Point

- Creates `LoadingScreen` first so it is visible before any async work begins
- Instantiates `SceneManager`, `PlanetFactory`, and wires loading callbacks
- Defers `InfoPanel`, `TimeControls`, and `InteractionManager` creation until `onLoadComplete` fires (via `initUI()`)
- Owns the simulation state: `simulationTime` (days), `timeSpeed` (days/second), `isPlaying`
- Exposes `window.__solarSim` API for UI components to access shared simulation state
- Passes `delta` to `PlanetFactory.update()` and `TimeControls.updateDate()` each frame

### `scene/SceneManager.js` — Three.js Infrastructure

Owns the full rendering pipeline:
- WebGL renderer (antialiased, ACES filmic tone mapping, pixel ratio capped at 2)
- PerspectiveCamera with configurable defaults from `constants.js`
- OrbitControls (damping enabled, zoom range 50–3000 units)
- Lighting: `AmbientLight` (fill) + `PointLight` at origin (Sun)
- Post-processing: `EffectComposer` → `RenderPass` → `UnrealBloomPass` → `OutputPass`
- Window resize handler maintaining correct camera aspect ratio
- Smooth camera reset via lerp (ease-out cubic over ~60 frames)
- Mobile/low-end detection: reduces pixel ratio and bloom intensity

### `planets/PlanetFactory.js` — Celestial Body Management

Creates and updates all scene objects:
- Starfield background (inverted `SphereGeometry` mapped with the Milky Way texture)
- Sun (`MeshBasicMaterial` — unaffected by scene lighting)
- All 8 planets (`MeshStandardMaterial` with per-planet texture)
- Earth cloud layer (transparent `MeshStandardMaterial`, rotates slightly faster than Earth)
- Moon (orbits Earth via a `Group` pivot parented to Earth's world position)
- Saturn rings (`RingGeometry` with double-sided alpha material)
- Orbit path lines (`LineLoop` with semi-transparent `LineBasicMaterial`)
- Per-frame: self-rotation (proportional to real rotation period) and orbital position update via `OrbitalMechanics`
- Texture loading via `THREE.LoadingManager`; progress and completion callbacks forwarded to `LoadingScreen`

### `planets/OrbitalMechanics.js` — Keplerian Physics

Static utility class with two public methods:
- `calculatePosition(planetData, timeDays)` — Computes 3D world position from Keplerian elements: mean anomaly → eccentric anomaly (Newton-Raphson) → true anomaly → orbital plane coordinates → inclination rotation
- `generateOrbitPath(planetData, segments)` — Returns a `Float32Array` of 3D points along the ellipse for orbit line rendering

### `planets/planetData.js` — Astronomical Constants

Exports `PLANET_DATA` (Sun + 8 planets) and `MOON_DATA`. Each entry contains:
- Physical: `radius` (km), `displayRadius` (scene units), `rotationPeriod` (hours, negative = retrograde), `axialTilt` (degrees)
- Orbital: `distance` (AU), `distanceDisplay` (scene units), `orbitalPeriod` (days), `eccentricity`, `inclination` (degrees)
- UI: `name`, `nameKo`, `color`, `moons`

### `controls/InteractionManager.js` — Input Handling

- Builds invisible collision helpers (`SphereGeometry`) for planets smaller than 8 display units, ensuring reliable raycasting on small bodies
- Maps mesh UUIDs to planet keys via `Map`
- Handles `mousemove` (cursor feedback), `click`, and `touchstart` events on the renderer canvas
- Fires `onSelect(key)` and `onDeselect()` callbacks consumed by `InfoPanel`

### `ui/InfoPanel.js` — Planet Detail Sidebar

- Fixed-position panel that slides in from the right (`right: -400px` → `right: 0`)
- Injects its own CSS into `<head>`
- Renders different fields for sun, moon, and regular planets
- Formats orbital period (days or years) and rotation period (hours or days, with retrograde label)
- Stops input event propagation to prevent accidental scene interaction while the panel is open

### `ui/TimeControls.js` — Bottom Control Bar

- Play/pause button wired to `window.__solarSim.togglePlay()`
- Logarithmic speed slider (input range −1 to 2.7, mapped as `10^value`) covering ~0.1x to ~500x
- Simulation date display: adds `simulationTime` days to a fixed epoch (2026-03-30) and formats as `YYYY-MM-DD`
- Updates play/pause icon state when called externally (e.g., from keyboard shortcut)

### `ui/LoadingScreen.js` — Loading Overlay

- Full-screen overlay shown before any 3D content appears
- Progress bar width driven by `loaded / total` from `THREE.LoadingManager`
- Fades out and removes itself (including its `<style>` element) after `transitionend`

### `utils/constants.js` — Shared Configuration

Exports named constant objects used across modules:
- `COLOR_PALETTE` — background, accent, text colors
- `CAMERA_DEFAULTS` — fov, near, far, initial position
- `CONTROLS_DEFAULTS` — damping, zoom limits
- `BLOOM_DEFAULTS` — strength, radius, threshold
- `TEXTURE_MAP` — file paths for all textures

---

## Data Flow

```
main.js
  │
  ├─ new LoadingScreen()          (shows immediately)
  │
  ├─ new SceneManager()           (renderer + camera + bloom)
  │
  └─ new PlanetFactory(scene)
       ├─ THREE.LoadingManager
       │    ├─ onProgress → LoadingScreen.updateProgress()
       │    └─ onLoad    → LoadingScreen.hide() + initUI()
       │
       └─ initUI() [deferred]
            ├─ new InfoPanel()
            ├─ new TimeControls(window.__solarSim)
            └─ new InteractionManager(camera, scene, renderer, planetFactory)
                  └─ onSelect(key) → InfoPanel.show(key, data)
                  └─ onDeselect()  → InfoPanel.hide()

Animation loop (SceneManager.start callback):
  ├─ simulationTime += delta * timeSpeed
  ├─ PlanetFactory.update(simulationTime, delta)
  │    ├─ planet self-rotation
  │    ├─ OrbitalMechanics.calculatePosition() per planet
  │    └─ Moon pivot follows Earth position
  └─ TimeControls.updateDate(simulationTime)
```

---

## Key Design Decisions

**No framework dependency.** The project uses vanilla ES modules. All UI is programmatically constructed DOM; there is no HTML template layer.

**Deferred UI initialization.** `InfoPanel`, `TimeControls`, and `InteractionManager` are created only after all textures have loaded. This guarantees the user never sees an incomplete scene.

**Collision helpers for small bodies.** Planets with `displayRadius < 8` get an invisible larger sphere child for raycasting. Without this, Mercury (radius 4) would be nearly impossible to click.

**LoadingManager drives the loading screen.** Texture load progress is passed through callbacks rather than polling, keeping `LoadingScreen` decoupled from `PlanetFactory` internals.

**Post-processing via EffectComposer.** The render loop calls `composer.render()` rather than `renderer.render()` so the bloom pass always applies.

---

## 확장 아키텍처 (SPEC-SIM-001 / SPEC-EARTH-001 / SPEC-EARTH-002, 2026-07-05)

브라운필드 확장으로 다음 디렉터리/모듈이 추가되었다.

```
src/
├── core/                ViewManager.js — 뷰 상태 기계 + 공유 렌더 루프
├── views/                SolarSystemView.js — 기존 앱을 View 인터페이스로 래핑
├── earth/                EarthView.js, EarthRig.js, EarthHUD.js — 지구 상세 뷰
├── effects/              EclipseRig.js, AuroraEffect.js, AircraftLayer.js
├── data/                 FlightDataService.js — 항공기 폴링/상태 기계
├── planets/              TextureTierManager.js — 초점 시 지연 고해상도 텍스처 티어(신규)
└── utils/                eclipseData.js — 실제 카탈로그 일식 테이블 + 순수 검출 함수
test/                     프로젝트 최초 테스트 스위트 (Vitest + jsdom)
```

**핵심 아키텍처 패턴 — 단일 렌더러, 다중 뷰**: 렌더러/`EffectComposer`는 오직 하나만 존재한다(`SolarSystemView`가 소유하는 `SceneManager` 내부에 생성됨). `ViewManager`가 유일한 rAF 루프를 구동하며, 활성 뷰(`SolarSystemView` 또는 `EarthView`)에 따라 composer의 렌더 패스를 재타깃(retarget)한다 — 뷰마다 별도의 `WebGLRenderer`를 만드는 방식이 아니다. 각 뷰는 `mount/unmount/onEnter/onExit/update/getScenePass`로 이루어진 동결된 View 인터페이스를 구현한다.

**`ViewManager`의 상태 기계**: `SOLAR` ⇄ `TO_EARTH`(전환 중, 400ms DOM 크로스페이드) ⇄ `EARTH` ⇄ `TO_SOLAR`. hash 라우팅(`#/`, `#/earth`)과 브라우저 뒤로가기가 동일한 전환을 구동한다.

**`EarthView`의 하위 시뮬레이션 마운트**: `EclipseRig`(일식/월식 diorama), `AuroraEffect`(오로라 커튼), `AircraftLayer`(항공기 `InstancedMesh`)는 모두 EarthView 활성 중에만 마운트되는 가산 레이어다. `EclipseRig`는 실제 궤도 위치를 참조하지 않는 고정 배치 diorama이며, `eclipseData.js`의 실제 일식 테이블 range-test 결과로만 트리거된다.

**테스트 인프라**: 이 확장에서 프로젝트 최초로 Vitest + jsdom 기반 유닛 테스트가 도입되었다(`test/`, 일부 `src/**/*.test.js` 콜로케이션). WebGL 렌더링이 필요한 부분은 의존성 주입으로 순수 로직을 분리해 유닛 테스트하고, 실제 시각적 외관·실기기 성능은 수동 검증으로 남겨둔다.
