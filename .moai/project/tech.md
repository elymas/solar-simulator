# Technology Stack

## Runtime Dependencies

### Three.js r175

- **Role:** 3D rendering engine
- **Bundle size:** ~160 KB gzipped
- **Used features:**
  - `WebGLRenderer` — hardware-accelerated canvas rendering with ACES filmic tone mapping
  - `PerspectiveCamera` — field-of-view camera with 60° FOV
  - `OrbitControls` (addons) — mouse/touch orbit, zoom, and pan with inertia damping
  - `SphereGeometry`, `RingGeometry`, `BufferGeometry` — celestial body and orbit meshes
  - `MeshBasicMaterial`, `MeshStandardMaterial` — Sun (emissive) and planets (PBR)
  - `TextureLoader` + `LoadingManager` — async texture loading with progress tracking
  - `Raycaster` — screen-to-world picking for planet selection
  - `EffectComposer`, `UnrealBloomPass`, `RenderPass`, `OutputPass` (addons) — post-processing bloom for the Sun
  - `THREE.MathUtils.degToRad` — orbital inclination and axial tilt conversion
- **Why Three.js:** Widest community support, most solar system tutorial references, mature OrbitControls, and proven EffectComposer pipeline. Alternatives (Babylon.js, A-Frame) were considered but rejected as over-engineered for a static site.

---

## Build Tooling

### Vite 6.x

- **Role:** Development server and production bundler
- **Configuration** (`vite.config.js`):
  ```js
  export default defineConfig({
    base: '/solar-simulator/',
  });
  ```
  The `base` path is required for GitHub Pages, which serves the site from a subpath.
- **Asset handling:** `public/textures/` is served as-is; Vite copies it into `dist/` at build time without hashing.
- **Output:** `dist/` directory containing the bundled `index.html`, JS, and texture assets.

---

## Language

### Vanilla JavaScript (ES Modules)

- **Module system:** Native ESM (`"type": "module"` in `package.json`)
- **No transpilation target set** — Vite defaults to modern browsers (Chrome 87+, Firefox 85+, Safari 14+)
- **No TypeScript** — project uses plain `.js` files with JSDoc annotations for type hints
- **No framework** — all UI is programmatic DOM construction; no React, Vue, or similar

---

## CI/CD Pipeline

### GitHub Actions

- **Workflow file:** `.github/workflows/deploy.yml`
- **Trigger:** Push to the `main` branch (or manual `workflow_dispatch`)
- **Jobs:**
  1. `build` — Checks out code, sets up Node.js 20 with npm cache, runs `npm ci` and `npm run build`, uploads `dist/` as a Pages artifact
  2. `deploy` — Deploys the Pages artifact using `actions/deploy-pages@v4`
- **Permissions:** `pages: write`, `id-token: write` (required for OIDC-based Pages deployment)
- **Concurrency:** Single deployment group `pages`; in-progress runs are not cancelled on new push

### GitHub Pages

- **Hosting:** Static file serving from the `dist/` artifact
- **URL:** `https://elymas.github.io/solar-simulator/`
- **Limits:**
  - Site size: max 1 GB
  - Bandwidth: 100 GB/month (soft limit)
  - Build time: 10-minute limit per workflow run

---

## Asset Pipeline

### Textures

- **Source:** [Solar System Scope](https://www.solarsystemscope.com/textures/) — CC BY 4.0
- **Format:** 2K JPEG (planets) and PNG (Saturn rings with alpha)
- **Total size:** ~15 MB for all 13 texture files
- **Loading strategy:** All textures loaded via `THREE.LoadingManager` before the scene is shown; loading screen displays real progress percentage
- **Color space:** Each texture has `colorSpace = THREE.SRGBColorSpace` applied after load for correct gamma

### Fonts

- `Inter` (weights 300, 400, 500, 600, 700) — UI text
- `JetBrains Mono` (weights 400, 500) — numerical data display
- Both loaded via Google Fonts with `preconnect` hints in `index.html`

---

## Orbital Mechanics

### Keplerian Elements (offline)

- **Source:** [NASA JPL Approximate Planetary Positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html)
- **Algorithm:** Mean anomaly → Kepler's equation solved via Newton-Raphson iteration (max 10 steps, convergence at `|dE| < 1e-8`) → true anomaly → 3D position with inclination rotation
- **No runtime API calls** — all constants are hard-coded in `planetData.js`

---

## Browser Support

| Browser | Minimum Version |
|---|---|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 15+ |
| Edge | 90+ |
| iOS Safari | 15+ |
| Chrome Android | 90+ |

**Requirement:** WebGL support (available in ~98% of browsers globally).

---

## Performance Considerations

- Pixel ratio is capped at `2` (`Math.min(devicePixelRatio, 2)`) to avoid rendering at 3x on high-DPI mobile screens
- Mobile and low-hardware-concurrency devices (`navigator.hardwareConcurrency <= 4`) automatically reduce pixel ratio to `1` and lower bloom intensity
- Planet sphere segment count scales with display radius (32 for small bodies, 64 for large ones) to balance quality vs. triangle count
- `OrbitControls` uses `enableDamping` for smooth, frame-rate-independent rotation
- Post-processing composer is used for every frame; there is no fallback path that bypasses bloom

---

## 테스트 스택 (SPEC-SIM-001에서 신규 도입, 2026-07-05)

### Vitest + jsdom

- **역할**: 프로젝트 최초의 테스트 스위트. 그 이전에는 테스트가 전혀 없었다.
- **위치**: `test/` 디렉터리와 일부 `src/**/*.test.js` 콜로케이션(`InfoPanel.test.js`, `performance.test.js`).
- **범위**: WebGL 렌더링이 필요 없는 순수 로직(궤도 계산, 뷰 라우팅, 상태 기계, 항공기 폴링/백오프, 일식 검출 등)을 의존성 주입으로 분리해 유닛 테스트한다. 실제 3D 시각적 외관과 실기기 프레임률은 여전히 수동/육안 검증 대상이다.
- **실행**: `npm test` (`vitest run`).

## 외부 네트워크 의존성 (SPEC-EARTH-002에서 신규 도입)

### api.airplanes.live

- **역할**: 지구 뷰의 실시간 항공기 위치 오버레이(F5)를 위한 무료·키리스·CORS 검증 완료 ADS-B API.
- **중요성**: 이것이 앱이 런타임에 수행하는 **유일한 외부 네트워크 호출**이다. SPEC-UI-001이 확립한 "초기 로드 후 완전 오프라인 동작" 설계 원칙(REQ-020)과 공존하도록, 이 기능은 완전히 선택적(옵트인)이며 API가 도달 불가능해도 우아하게 저하되어 다른 모든 기능에 영향을 주지 않는다.
- **채택 경위**: 원래 후보였던 adsb.lol/adsb.fi 대신, 배포 origin에서의 라이브 브라우저 CORS 스모크 테스트를 통과한 airplanes.live가 채택되었다.
