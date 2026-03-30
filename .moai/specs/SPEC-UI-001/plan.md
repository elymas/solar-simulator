---
id: SPEC-UI-001
document: plan
version: "1.0.0"
status: draft
created: "2026-03-30"
updated: "2026-03-30"
author: limbowl
tags: [three.js, solar-system, 3d-simulation, github-pages]
---

# SPEC-UI-001: Implementation Plan - Solar System 3D Simulation Website

## Overview

A fully static 3D solar system simulation website built with Three.js and Vite, deployed to GitHub Pages via GitHub Actions. No backend required.

---

## Phase 1: Project Setup (Primary Goal)

### Milestone 1.1: Project Initialization

- Initialize Vite project with vanilla JavaScript (or TypeScript)
- Install Three.js r175 and required dependencies
- Configure `vite.config.js` with `base: '/<repo-name>/'` for GitHub Pages
- Set up project directory structure:

```
solar-simulator/
  src/
    main.js           # Entry point
    scene/             # Three.js scene setup
    planets/           # Planet data and creation
    ui/                # UI components
    controls/          # Time and camera controls
    utils/             # Helpers and constants
  public/
    textures/          # Planet textures (2K)
  index.html
  vite.config.js
```

### Milestone 1.2: CI/CD Pipeline

- Create `.github/workflows/deploy.yml` for GitHub Actions
- Configure automatic deployment on push to `main` branch
- Verify successful deployment to GitHub Pages

### Milestone 1.3: Basic Scene

- Set up WebGLRenderer with antialiasing
- Create PerspectiveCamera with appropriate FOV and clipping planes
- Add OrbitControls with damping and zoom limits
- Add basic ambient and point lighting
- Render a test sphere to validate the pipeline

### Dependencies

- None (greenfield project)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vite base path misconfiguration | Medium | High | Test deployment early in Phase 1 |
| Three.js version compatibility | Low | Medium | Pin to r175, test imports |

---

## Phase 2: Solar System Core (Primary Goal)

### Milestone 2.1: Sun

- Create Sun sphere with emissive material
- Add PointLight at Sun position
- Implement UnrealBloomPass for glow effect (REQ-015)
- Self-rotation animation

### Milestone 2.2: Planets

- Create planet factory function with configurable parameters
- Implement all 8 planets with correct display radius and distance
- Apply 2K texture maps from Solar System Scope
- Add self-rotation for each planet (correct axis tilt)

### Milestone 2.3: Special Bodies

- Earth's Moon orbiting Earth (REQ-001)
- Saturn rings with alpha transparency texture (REQ-013)

### Milestone 2.4: Orbital Animation

- Implement Keplerian orbital element calculations (JPL data)
- Animate orbital motion based on simulation time
- Ensure correct relative orbital periods
- Validation: Earth completes one orbit in 365 simulation days

### Milestone 2.5: Visual Enhancements

- Starfield/skybox background using NASA Deep Star Maps (REQ-003)
- Orbit path lines (semi-transparent ellipses) (REQ-014)
- Planet labels using CSS2DRenderer or sprite text (REQ-016)

### Technical Approach

- **Orbital Mechanics**: Use JPL Keplerian elements for offline computation. Each planet stores semi-major axis, eccentricity, inclination, longitude of ascending node, argument of perihelion, and mean anomaly at epoch.
- **Scale Strategy**: Separate logarithmic scales for distance and size. Minimum 4px radius enforced for all bodies.
- **Texture Loading**: Use Three.js `TextureLoader` with `LoadingManager` for progress tracking.

### Dependencies

- Phase 1 must be complete (basic scene and deployment)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Texture file size exceeds budget | Medium | Medium | Use 2K JPEG, target ~15MB total |
| Orbital calculation inaccuracy | Low | Low | Validate against known positions |
| Performance with bloom + 10 bodies | Medium | Medium | Profile early, disable bloom on slow devices |

---

## Phase 3: UI & Interaction (Primary Goal)

### Milestone 3.1: Planet Selection

- Implement raycasting for mouse/touch click detection
- Add OutlinePass for hover highlighting (REQ-006)
- Handle planet click events to trigger info panel (REQ-005)

### Milestone 3.2: Information Panel

- Slide-in sidebar (right side) with planet data:
  - Name, diameter, distance from Sun
  - Orbital period, rotation period
  - Axial tilt, eccentricity, number of moons
- Smooth camera transition to selected planet (REQ-011)
- Close button to return to overview

### Milestone 3.3: Time Controls

- Play/pause toggle button (REQ-007)
- Speed slider: 0.1x to 500x range (REQ-019)
- Current simulation date display (REQ-017)
- Bottom control bar layout

### Milestone 3.4: Keyboard Shortcuts

- Space: Play/pause toggle (REQ-009)
- R: Reset camera to default position
- Escape: Close info panel

### Technical Approach

- **Raycasting**: Use `THREE.Raycaster` with normalized device coordinates from mouse/touch events.
- **UI Framework**: Vanilla HTML/CSS overlays on the Three.js canvas. No heavy UI framework needed.
- **Camera Animation**: Use `gsap` or manual `lerp` for smooth camera transitions.
- **Control Bar**: Fixed position HTML element at viewport bottom.

### Dependencies

- Phase 2 Milestones 2.1-2.3 (planets must exist for selection)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Raycasting inaccuracy on small planets | Medium | Medium | Enlarge collision meshes beyond visual size |
| Touch event conflicts with OrbitControls | Medium | High | Separate touch zones for UI vs 3D |

---

## Phase 4: Polish (Secondary Goal)

### Milestone 4.1: Loading Screen

- Full-screen loading overlay with progress bar (REQ-008)
- Track texture loading progress via `LoadingManager`
- Space-themed loading animation
- Fade transition to 3D scene on complete (REQ-022)

### Milestone 4.2: Responsive Design

- Renderer resize on window resize events (REQ-004)
- Adaptive UI layout for mobile viewports
- Touch-friendly control sizing
- Orientation handling (portrait/landscape)

### Milestone 4.3: Performance Optimization

- Mobile device detection and quality adjustment (REQ-018)
- Disable post-processing on low-end devices
- Texture resolution downgrade option
- Frame rate monitoring and adaptive quality

### Milestone 4.4: Final Polish

- Color scheme implementation (#0a0a0f background, #16c7ff accent)
- Typography setup (Inter for UI, JetBrains Mono for data)
- Smooth transitions and animations throughout UI
- Favicon and meta tags for social sharing

### Dependencies

- Phase 2 and Phase 3 must be substantially complete

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Mobile performance insufficient | Medium | High | Progressive quality reduction, test on real devices |
| Loading time exceeds 10s | Low | Medium | Compress textures, implement progressive loading |

---

## Architecture Overview

```
index.html
  |
  +-- main.js (entry point)
       |
       +-- scene/SceneManager.js
       |     +-- Renderer, Camera, Controls, Lighting, PostProcessing
       |
       +-- planets/PlanetFactory.js
       |     +-- Planet data (physical + orbital parameters)
       |     +-- Texture loading
       |     +-- Mesh creation
       |
       +-- planets/OrbitalMechanics.js
       |     +-- Keplerian element calculations
       |     +-- Position computation at given time
       |
       +-- ui/InfoPanel.js
       |     +-- Planet data display
       |     +-- Open/close animations
       |
       +-- ui/TimeControls.js
       |     +-- Play/pause, speed slider, date display
       |
       +-- ui/LoadingScreen.js
       |     +-- Progress bar, fade transition
       |
       +-- controls/InteractionManager.js
       |     +-- Raycasting, hover, click handlers
       |     +-- Keyboard shortcuts
       |
       +-- utils/constants.js
             +-- Planet data tables
             +-- Display scale values
             +-- Color palette
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 3D Engine | Three.js r175 | Largest community, ~160KB gzipped, MIT license |
| Build Tool | Vite | Fast dev server, efficient bundling, native ES modules |
| UI Framework | Vanilla HTML/CSS | Minimal overhead, simple overlay on canvas |
| Orbital Data | JPL Keplerian Elements | Offline computation, no API dependency |
| Textures | Solar System Scope 2K | CC BY 4.0, comprehensive coverage, reasonable size |
| Animation Library | Built-in (or gsap if needed) | Smooth camera transitions |
| Deployment | GitHub Actions + GitHub Pages | Free, automated, static-only |

---

## Expert Consultation Recommendations

| Domain | Expert Agent | Reason |
|--------|-------------|--------|
| Frontend 3D | expert-frontend | Three.js scene architecture, post-processing pipeline, performance tuning |
| UI/UX Design | design-uiux | Information panel layout, control bar design, responsive patterns, dark theme |
| DevOps | expert-devops | GitHub Actions workflow optimization, caching strategy |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| All 10 celestial bodies rendered | 100% |
| Planet click info panel | Functional for all bodies |
| Orbital accuracy | Earth completes 1 orbit per 365 sim days |
| Initial load time | Under 10 seconds (standard connection) |
| Desktop frame rate | 60 fps |
| Mobile frame rate | 30 fps |
| GitHub Pages deployment | Automated on push to main |
