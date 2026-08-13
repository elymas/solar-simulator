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
- **Halley's Comet** — Real eccentricity (0.967) and retrograde inclination on a display-scaled orbit that dives inside Mercury and out past the dwarf planets, with a tail that always points away from the sun and grows toward perihelion
- **Asteroid & Kuiper Belts** — Instanced rock fields between Mars and Jupiter and beyond Neptune, drifting at Kepler-derived per-rock speeds; scenery only, selectable as a whole from the planet list and mobile strip
- **Alignment Celebration** — A banner and spoken callout when four or more planets fall within a 30° heliocentric wedge, with hysteresis so it cannot flicker at the boundary
- **Bloom Post-Processing** — Sun glow via UnrealBloomPass for a cinematic look
- **Starfield Background** — Milky Way panorama mapped to an inverted sphere
- **Responsive Design** — Works on desktop and mobile; render quality is decided from device signals (pixel ratio, core count, memory), not a blanket mobile check, so high-end phones render at full sharpness
- **Touch-Optimized Selection** — Tap-to-select behind a drag guard, so starting an orbit drag on a body never triggers an accidental selection
- **Mobile Planet Strip** — A bottom, scrollable strip of tappable body icons is the primary selector on screens ≤768px, synced with the 3D scene and the sidebar
- **Size Comparison** — A "크기 비교" lineup that answers "how big IS it?" by counting: the body is drawn one lane wide and the reference body as that many little discs beside it. Ratios come from real diameters, and a comparison that cannot be stated honestly is not shown at all
- **Rocket Trip** — Launch a rocket from Earth to any planet, dwarf planet, or the Moon. It opens as its own overlay — two worlds, a dashed road, a rocket driving it — so a phone's full-screen info panel cannot hide it, and speaks both a real approximate travel time and the distance in Korean
- **Live Aircraft** — The Earth view can overlay real aircraft positions worldwide, published as a snapshot by a scheduled GitHub Action (OpenSky Network data) because no keyless ADS-B feed is callable from a browser. The HUD dates the data from the snapshot itself and never claims to be live
- **Celebrations & Sound** — Sparkle bursts and chimes on arrival, a distinct twinkle for stars, all from a pooled particle effect and a small Web Audio module that shares the one "소리" toggle with the speech narration
- **Daily Missions & Stickers** — Three Korean play prompts per real calendar day; completing one plays praise and awards a sticker that persists in the browser and fills in a sticker book
- **Keyboard Shortcuts** — Space, R, and Escape for quick control
- **PWA & Offline Support** — Installable to the home screen as "태양계 탐험", runs standalone with safe-area layout (Dynamic Island, home indicator), boots offline after the first visit with all textures and fonts cached

---

## Tech Stack

| Technology | Purpose | Version |
|---|---|---|
| [Three.js](https://threejs.org/) | 3D rendering engine | r175 |
| [Vite](https://vitejs.dev/) | Build tool and dev server | 6.x |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | PWA manifest and service worker generation | 1.x |
| [@fontsource-variable](https://fontsource.org/) | Self-hosted variable fonts (Inter, JetBrains Mono) | 5.x |
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

### Test Build Artifacts

```bash
npm run test:build
```

Builds the app and runs build-artifact assertions to verify PWA manifest, service worker configuration, precache entries, and safe-area CSS presence. Separate from the default test suite to keep CI fast.

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
│   ├── textures/          # 2K JPEG/PNG planet textures (~15 MB total)
│   └── icons/             # PWA icon set (192, 512, maskable variants, apple-touch-icon)
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
│   ├── play/
│   │   ├── missions.js        # Mission catalog, daily rotation, completion engine (pure)
│   │   ├── stickers.js        # Sticker inventory persisted to localStorage
│   │   ├── StickerBook.js     # Sticker grid + today's mission list overlay
│   │   ├── SizeCompare.js     # "크기 비교" count lineup and its ratio math
│   │   ├── RocketTrip.js      # "로켓 발사" overlay: distance, spoken fact, replay
│   │   ├── RocketTripScene.js # Its 3D diagram (own renderer, disposed on close)
│   │   ├── travelFacts.js     # Korean travel-time facts per destination
│   │   └── playEvents.js      # Event seam the mission engine subscribes to
│   ├── data/
│   │   └── FlightDataService.js  # Aircraft snapshot polling, state machine, dead reckoning
│   ├── earth/
│   │   ├── EarthView.js       # Globe view: aircraft, ISS, eclipses, aurora, meteors
│   │   └── EarthHUD.js        # Its Korean control panel and status lines
│   ├── audio/
│   │   ├── tts.js             # Korean speech narration wrapper
│   │   └── sfx.js             # Synthesized chime / twinkle / fanfare (shares the mute toggle)
│   ├── ui/
│   │   ├── InfoPanel.js       # Slide-in sidebar with planet data
│   │   ├── PlanetStrip.js     # Mobile bottom icon strip (≤768px primary selector)
│   │   ├── TimeControls.js    # Play/pause, speed slider, date display
│   │   └── LoadingScreen.js   # Full-screen loading overlay
│   └── utils/
│       ├── constants.js       # Camera defaults, bloom settings, texture paths
│       └── quality.js         # Boot-time render quality tier from device signals
├── .github/workflows/
│   └── flights.yml        # Scheduled worldwide aircraft snapshot -> flight-data branch
├── scripts/
│   └── build-tts.mjs      # Bakes the Korean narration to public/tts (npm run tts)
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

### Touch (mobile, ≤768px)

| Action | Result |
|---|---|
| Tap on a planet (finger moves ≤8px) | Select and open info panel |
| Drag (any distance beyond 8px) | Orbit the camera; no selection change |
| Tap the bottom icon strip | Select that body — same effect as tapping it in the 3D scene |
| Tap on empty space | Close info panel |

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
