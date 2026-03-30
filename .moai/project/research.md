# Solar System Simulation - Research Document

## 1. Technology Stack Recommendation

### Core: Three.js (r175)

| Criteria | Assessment |
|----------|-----------|
| Bundle size | ~160KB gzipped (lightweight) |
| GitHub Pages | Fully static, CDN available (jsdelivr, unpkg) |
| Planet rendering | SphereGeometry + texture maps (diffuse, normal, bump, specular) |
| Lighting | PointLight (Sun), AmbientLight, shadow mapping |
| Camera | OrbitControls (orbit, zoom, pan with damping) |
| Post-processing | EffectComposer + BloomPass (sun glow), OutlinePass (hover) |
| Browser support | WebGL 98%+ coverage |
| Community | ~103k GitHub stars, most tutorials and examples |

**Alternatives considered:**
- Babylon.js: Overkill (~500KB+), fewer solar system examples
- p5.js: Limited 3D control, no orbit controls
- A-Frame: Less control than raw Three.js
- CSS 3D: No real lighting/textures, only for flat diagrams
- WebGPU: Not universally supported yet (skip for now)

### Build Tool: Vite

- Fast build, efficient bundling
- `base: '/<repo-name>/'` for GitHub Pages subpath
- `public/` folder for static assets (textures)
- Output to `dist/` folder

### Deployment: GitHub Actions + GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: ['main']
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### GitHub Pages Limits
- Repository size: recommended < 1GB, max 5GB
- Deployed site: max 1GB
- Bandwidth: 100GB/month (soft limit)
- Build time: 10 min limit

---

## 2. Astronomical Data

### Planet Physical Data

| Body | Diameter (km) | Relative Size | Distance (AU) | Orbital Period | Rotation | Axial Tilt | Eccentricity | Moons |
|------|--------------|---------------|---------------|---------------|----------|-----------|-------------|-------|
| Sun | 1,392,700 | 109.2x | 0 | - | 25.05 days | 7.25 | - | - |
| Mercury | 4,879 | 0.383x | 0.387 | 87.97 days | 58.65 days | 0.034 | 0.2056 | 0 |
| Venus | 12,104 | 0.949x | 0.723 | 224.7 days | 243.02 days (R) | 177.4 | 0.0068 | 0 |
| Earth | 12,756 | 1.000x | 1.000 | 365.25 days | 23.93 hours | 23.44 | 0.0167 | 1 |
| Moon | 3,475 | 0.272x | 0.00257 (from Earth) | 27.32 days | 27.32 days | 1.54 | 0.0549 | - |
| Mars | 6,792 | 0.532x | 1.524 | 687.0 days | 24.62 hours | 25.19 | 0.0934 | 2 |
| Jupiter | 142,984 | 11.21x | 5.203 | 11.86 years | 9.93 hours | 3.13 | 0.0489 | 95 |
| Saturn | 120,536 | 9.45x | 9.537 | 29.46 years | 10.66 hours | 26.73 | 0.0565 | 146 |
| Uranus | 51,118 | 4.01x | 19.19 | 83.75 years | 17.24 hours (R) | 97.77 | 0.0457 | 28 |
| Neptune | 49,528 | 3.88x | 30.07 | 163.7 years | 16.11 hours | 28.32 | 0.0113 | 16 |

(R) = Retrograde rotation

### Display Scale (Recommended)

| Body | Display Radius (px) | Display Distance (px) |
|------|--------------------|-----------------------|
| Sun | 50 (capped) | 0 |
| Mercury | 4 (min) | 80 |
| Venus | 7 | 150 |
| Earth | 8 | 200 |
| Mars | 5 | 300 |
| Jupiter | 28 | 450 |
| Saturn | 24 | 600 |
| Uranus | 14 | 730 |
| Neptune | 13 | 850 |

**Scale Strategy:** Separate distance and size scales with user-adjustable zoom. Minimum 4px radius for clickability.

### Orbital Mechanics

**Recommended: Keplerian Elements (offline computation)**
- Source: JPL Approximate Positions - https://ssd.jpl.nasa.gov/planets/approx_pos.html
- No API calls needed at runtime
- Alternative: `astronomy-engine` npm package (MIT, arcsecond accuracy)

---

## 3. Visual Resources (Free Textures)

### Primary: Solar System Scope (CC BY 4.0)
URL: https://www.solarsystemscope.com/textures/

Available textures (2K and 8K):
- Sun: `2k_sun.jpg`
- Mercury: `2k_mercury.jpg`
- Venus: `2k_venus_surface.jpg`, `2k_venus_atmosphere.jpg`
- Earth: `2k_earth_daymap.jpg`, `2k_earth_nightmap.jpg`, `2k_earth_clouds.jpg`, `2k_earth_normal_map.tif`, `2k_earth_specular_map.tif`
- Moon: `2k_moon.jpg`
- Mars: `2k_mars.jpg`
- Jupiter: `2k_jupiter.jpg`
- Saturn: `2k_saturn.jpg`, `2k_saturn_ring_alpha.png`
- Uranus: `2k_uranus.jpg`
- Neptune: `2k_neptune.jpg`
- Stars: `2k_stars_milky_way.jpg`

### Secondary Sources
- NASA Visible Earth: https://visibleearth.nasa.gov/ (public domain)
- NASA CGI Moon Kit: https://svs.gsfc.nasa.gov/cgi-bin/details.cgi?aid=4720 (up to 16K)
- NASA 3D Resources: https://nasa3d.arc.nasa.gov/ (public domain)
- NASA Deep Star Maps 2020: https://svs.gsfc.nasa.gov/4851 (up to 8K skybox)
- Planet Pixel Emporium: http://planetpixelemporium.com/planets.html (free personal use)

### Texture Optimization
- Use 2K JPEG/WebP (500KB-1.5MB per planet)
- Total target: ~15MB for all textures
- Progressive loading: low-res first, then swap to high-res
- Three.js `LoadingManager` for progress UI

---

## 4. Reference Projects

### Top Tier (Production Quality)
| Project | URL | Tech | Key Features |
|---------|-----|------|-------------|
| NASA Eyes | https://eyes.nasa.gov/apps/solar-system/ | WebGL (custom) | Real-time positions, 1950-2050 time travel, 126 missions |
| Solar System Scope | https://www.solarsystemscope.com/ | WebGL | 3D real-time, time controls, info panels, night sky mode |
| NASA Orrery | https://eyes.nasa.gov/apps/orrery/ | WebGL | Live solar system view with asteroids/comets |

### Three.js Based (Best References for Our Project)
| Project | URL | Key Features |
|---------|-----|-------------|
| jsOrrery | https://mgvez.github.io/jsorrery/ | JPL orbital elements, N-body gravity, Apollo trajectories |
| sanderblue/solar-system-threejs | https://github.com/sanderblue/solar-system-threejs | Real astronomical data, asteroid belt, satellites |
| N3rson/Solar-System-3D | https://github.com/N3rson/Solar-System-3D | BloomPass, OutlinePass, dat.GUI |

### Tutorial Resources
| Resource | URL | Quality |
|----------|-----|---------|
| DEV Community - Solar system with Three.js | https://dev.to/cookiemonsterdev/solar-system-with-threejs-3fe0 | Step-by-step guide (2024) |
| HackerNoon - Solar System in JS | https://hackernoon.com/how-to-create-a-solar-system-in-javascript-with-threejs | Practical code-focused |
| Medium - Physics from The Martian | https://medium.com/@pint_drinker/physics-from-the-martian-simulating-the-solar-system-with-three-js-af605d7f7b69 | Newton's gravity, updated 2024 |
| Three.js Journey Challenge | https://threejs-journey.com/challenges/008-solar-system | Beginner to advanced |

---

## 5. Essential Features (Priority Order)

### Must Have (MVP)
1. 3D rendered Sun + 8 planets with textures
2. Orbital animation (circular or Keplerian)
3. OrbitControls (zoom, rotate, pan)
4. Planet click/hover for info panel
5. Time controls (play/pause, speed slider)
6. Dark theme with starfield background
7. Loading screen with progress bar
8. Responsive design

### Should Have
1. Saturn rings
2. Earth's Moon
3. Orbit path lines (semi-transparent)
4. Bloom/glow effect on Sun
5. Planet labels
6. Date/time display
7. Keyboard shortcuts (Space=pause, R=reset)

### Nice to Have
1. Earth night map + cloud layer
2. Realistic vs schematic mode toggle
3. Scale mode toggle (exaggerated vs proportional)
4. Planet comparison view
5. Multiple moons (Galilean, Titan)
6. Asteroid belt particles
7. Sound effects / ambient music

---

## 6. UI/UX Design Patterns

### Layout
- Full-screen 3D canvas as main content
- Slide-in sidebar for planet info (right side)
- Bottom control bar: time controls, speed slider, date display
- HUD overlay: planet labels, distance info
- Loading screen with space background animation

### Color Scheme (Dark Theme)
- Background: #0a0a0f (deep space black)
- UI surfaces: #1a1a2e
- Accent: #16c7ff (cyan) or #4a9eff (blue)
- Text primary: #e0e0e0
- Text secondary: #888888

### Typography
- Sans-serif for UI: Inter, Space Grotesk, or Exo 2
- Monospace for data: JetBrains Mono or Space Mono
- Thin font weights for futuristic feel

### Post-Processing Effects
- Bloom/Glow: Sun and bright bodies (EffectComposer + BloomPass)
- OutlinePass: Hovered/selected planet highlight
- Optional lens flare from Sun direction

---

*Research completed: 2026-03-30*
*Sources: NASA, JPL, Solar System Scope, Three.js community, GitHub*
