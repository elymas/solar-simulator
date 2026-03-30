# Solar System 3D Simulator

## Product Vision

Interactive 3D solar system simulation for educational exploration of planetary orbits, sizes, and astronomical data.

## Target Users

- Astronomy enthusiasts exploring the solar system
- Students learning about planetary motion and orbital mechanics
- Educators using it for classroom demonstrations
- General public curious about space and the scale of the solar system

## Core Features

- 3D visualization of the Sun, 8 planets, and the Moon
- Keplerian orbital animation with Newton-Raphson eccentric anomaly solver
- Adjustable time controls (0.1x to ~500x speed)
- Planet information panel with real astronomical data
- Saturn's ring system with alpha-transparent texture
- Earth cloud layer with independent rotation
- Bloom post-processing for the Sun
- Milky Way starfield background
- Responsive design for desktop and mobile

## Deployment

- Static site hosted on GitHub Pages
- Auto-deploys via GitHub Actions on push to `main`
- Production URL: https://elymas.github.io/solar-simulator/
- Repository: https://github.com/elymas/solar-simulator

## Constraints

- No backend, no API calls at runtime — fully client-side
- No user data collection or tracking
- Must load within 10 seconds on a 10 Mbps connection (~15 MB textures)
- Targets 60 fps on desktop, 30 fps on mobile
- WebGL required (98%+ browser coverage)

## License

MIT License. Texture assets licensed under CC BY 4.0 by Solar System Scope.
