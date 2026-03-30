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
