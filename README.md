# Solar System 3D Simulator

An interactive 3D simulation of the solar system built with Three.js, featuring real Keplerian orbital mechanics, 2K planetary textures, and time controls.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=flat-square)](https://elymas.github.io/solar-simulator/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r175-black?style=flat-square)](https://threejs.org/)

---

## Features

- **3D Solar System** — Sun, 8 planets, and the Moon rendered with 2K photorealistic textures
- **Keplerian Orbital Mechanics** — Accurate elliptical orbits using JPL orbital elements and Newton-Raphson iteration
- **Time Controls** — Play/pause, adjustable speed (0.1x to 500x), and simulation date display
- **Planet Info Panel** — Click any body to view diameter, distance, orbital period, rotation period, axial tilt, and moon count
- **Saturn's Rings** — Transparent ring texture with correct axial tilt
- **Earth Detail** — Animated cloud layer rendered over the day-side texture
- **Bloom Post-Processing** — Sun glow via UnrealBloomPass for a cinematic look
- **Starfield Background** — Milky Way panorama mapped to an inverted sphere
- **Responsive Design** — Works on desktop and mobile; reduces rendering quality automatically on low-end devices
- **Keyboard Shortcuts** — Space, R, and Escape for quick control

---

## Tech Stack

| Technology | Purpose | Version |
|---|---|---|
| [Three.js](https://threejs.org/) | 3D rendering engine | r175 |
| [Vite](https://vitejs.dev/) | Build tool and dev server | 6.x |
| Vanilla JavaScript | Application logic | ES modules |
| GitHub Actions | CI/CD pipeline | - |
| GitHub Pages | Static hosting | - |

**No backend. No database. No runtime API calls.** Fully static — all orbital calculations run client-side.

---

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm

### Install and Run

```bash
# Clone the repository
git clone https://github.com/elymas/solar-simulator.git
cd solar-simulator

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:5173/solar-simulator/` in your browser.

### Build for Production

```bash
npm run build
```

Output is written to `dist/`. The `base` path is set to `/solar-simulator/` in `vite.config.js` for GitHub Pages compatibility.

### Deploy

Push to the `main` branch. GitHub Actions automatically builds and deploys to GitHub Pages.

```
git push origin main
```

The workflow is defined in `.github/workflows/deploy.yml`.

---

## Project Structure

```
solar-simulator/
├── public/
│   └── textures/          # 2K JPEG/PNG planet textures (~15 MB total)
├── src/
│   ├── main.js            # Application entry point, animation loop
│   ├── scene/
│   │   └── SceneManager.js    # Renderer, camera, lights, post-processing
│   ├── planets/
│   │   ├── PlanetFactory.js   # Mesh creation, texture loading, orbit lines
│   │   ├── OrbitalMechanics.js # Keplerian position calculation
│   │   └── planetData.js      # Astronomical constants for all bodies
│   ├── controls/
│   │   └── InteractionManager.js  # Raycasting, hover, click, touch
│   ├── ui/
│   │   ├── InfoPanel.js       # Slide-in sidebar with planet data
│   │   ├── TimeControls.js    # Play/pause, speed slider, date display
│   │   └── LoadingScreen.js   # Full-screen loading overlay
│   └── utils/
│       └── constants.js       # Camera defaults, bloom settings, texture paths
├── index.html
├── vite.config.js
└── package.json
```

---

## Controls

### Mouse

| Action | Result |
|---|---|
| Left drag | Rotate camera |
| Scroll wheel | Zoom in / out |
| Right drag | Pan camera |
| Click on planet | Open info panel |
| Click on empty space | Close info panel |

### Keyboard

| Key | Action |
|---|---|
| `Space` | Toggle play / pause |
| `R` | Reset camera to default position |
| `Escape` | Close planet info panel |

### Time Controls (bottom bar)

- **Play / Pause button** — Toggle simulation
- **Speed slider** — Logarithmic scale from 0.1x to ~500x
- **Date display** — Shows the simulated calendar date

---

## Texture Sources

Textures are sourced from [Solar System Scope](https://www.solarsystemscope.com/textures/) and used under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.

| Texture | File |
|---|---|
| Sun | `2k_sun.jpg` |
| Mercury | `2k_mercury.jpg` |
| Venus | `2k_venus_surface.jpg` |
| Earth (day) | `2k_earth_daymap.jpg` |
| Earth (clouds) | `2k_earth_clouds.jpg` |
| Moon | `2k_moon.jpg` |
| Mars | `2k_mars.jpg` |
| Jupiter | `2k_jupiter.jpg` |
| Saturn | `2k_saturn.jpg` |
| Saturn rings | `2k_saturn_ring_alpha.png` |
| Uranus | `2k_uranus.jpg` |
| Neptune | `2k_neptune.jpg` |
| Stars (Milky Way) | `2k_stars_milky_way.jpg` |

Orbital element data sourced from [NASA JPL Approximate Planetary Positions](https://ssd.jpl.nasa.gov/planets/approx_pos.html).

---

## License

This project is released under the [MIT License](LICENSE).

Texture assets are licensed separately under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) by Solar System Scope.
