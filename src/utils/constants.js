// Display constants and configuration for the Solar System simulator

export const COLOR_PALETTE = {
  background: 0x0a0a0f,
  accent: 0x16c7ff,
  textPrimary: '#e0e0e0',
  textSecondary: '#888888',
};

export const CAMERA_DEFAULTS = {
  fov: 60,
  near: 0.1,
  far: 100000,
  position: { x: 300, y: 200, z: 400 },
};

export const CONTROLS_DEFAULTS = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 50,
  maxDistance: 5000,
};

export const SCALE = {
  distanceScale: 1,
  radiusScale: 1,
  timeScale: 1,
};

// @MX:NOTE: [AUTO] EarthView runs a private earth-local scale, decoupled from the
// solar system's symbolic ~80..3500-unit scale. near/far are tuned to frame a
// single planet up close (not the whole system), so the camera's far plane is far
// smaller than CAMERA_DEFAULTS.far (100000). earthRadius is the reference unit the
// rig + moon distance derive from. rotationSpeedDefault is the Earth view's own
// independent playback rate (days/sec) for both the rig spin/Moon orbit and the
// shared sim clock while this view is active — deliberately decoupled from the
// solar view's own speed slider (confirmed product decision).
export const EARTH_VIEW_DEFAULTS = {
  fov: 50,
  near: 0.5,
  far: 60000,
  position: { x: 0, y: 120, z: 340 },
  earthRadius: 100,
  rotationSpeedDefault: 0.05,
};

export const EARTH_CONTROLS_DEFAULTS = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 130,
  maxDistance: 8000,
};

// Earth rig calibration knobs. Moon distance/radius are schematic (a physical
// 60-earth-radii moon would sit off-screen); the orbital period and inclination
// are the real IAU values, verified to tolerance in test/earthRig.test.js.
export const EARTH_RIG = {
  cloudScale: 1.02,
  moonRadius: 27,
  moonDistance: 900,
  moonOrbitalPeriodDays: 27.32,
  moonInclinationDeg: 5.14,
  earthRotationPeriodHours: 23.934,
};

export const TEXTURE_MAP = {
  sun: 'textures/2k_sun.jpg',
  mercury: 'textures/2k_mercury.jpg',
  venus: 'textures/2k_venus_surface.jpg',
  earth: 'textures/2k_earth_daymap.jpg',
  earthNight: 'textures/2k_earth_nightmap.jpg',
  earthClouds: 'textures/2k_earth_clouds.jpg',
  moon: 'textures/2k_moon.jpg',
  mars: 'textures/2k_mars.jpg',
  jupiter: 'textures/2k_jupiter.jpg',
  saturn: 'textures/2k_saturn.jpg',
  saturnRing: 'textures/2k_saturn_ring_alpha.png',
  uranus: 'textures/2k_uranus.jpg',
  neptune: 'textures/2k_neptune.jpg',
  stars: 'textures/2k_stars_milky_way.jpg',
  // Dwarf planet textures (F1). Provenance: Ceres/Eris/Makemake/Haumea from
  // Solar System Scope (CC BY 4.0), Pluto from USGS Astrogeology (public domain).
  // Files are not shipped yet; PlanetFactory falls back to a flat color when the
  // asset is absent, and picks up the real texture automatically once dropped here.
  ceres: 'textures/2k_ceres.jpg',
  pluto: 'textures/2k_pluto.jpg',
  haumea: 'textures/2k_haumea.jpg',
  makemake: 'textures/2k_makemake.jpg',
  eris: 'textures/2k_eris.jpg',
};

// High-resolution texture tier, lazy-loaded on focus (REQ-290) and never part of
// the initial bundle. Real 4K/8K art does not ship yet, so hero bodies point at
// the existing 2K files as a stand-in — the lazy-load + one-shot cache mechanism
// is what SPEC-SIM-001 exercises; swap in real hi-res files here with no code change.
export const TEXTURE_HIRES_MAP = {
  earth: 'textures/2k_earth_daymap.jpg',
  mars: 'textures/2k_mars.jpg',
  jupiter: 'textures/2k_jupiter.jpg',
  saturn: 'textures/2k_saturn.jpg',
  moon: 'textures/2k_moon.jpg',
};

// Simulation epoch: sim time is measured in DAYS elapsed from this instant
// (TimeControls maps _simTime days -> calendar date from the same anchor). The
// F6 eclipse table converts real eclipse instants to sim-days against this epoch.
export const SIM_EPOCH_ISO = '2026-03-30T00:00:00Z';
export const SIM_EPOCH_MS = Date.parse(SIM_EPOCH_ISO);

// F5 live-aircraft tuning. airplanes.live is a free, keyless, CORS-enabled
// community ADS-B API (smoke-tested from the deploy origin). Poll conservatively
// and cap both the query radius and the rendered instance count defensively.
export const FLIGHT_DEFAULTS = {
  baseUrl: 'https://api.airplanes.live/v2/point',
  lat: 51.5, // London — a dense, always-populated region for a live demo
  lon: -0.1,
  radiusNm: 250,
  pollIntervalMs: 12000, // within the SPEC's 10-15s window
  backoffStartMs: 30000, // exponential backoff floor (REQ-470)
  backoffMaxMs: 300000,
  maxInstances: 500,
  altitudeScale: 0.0001, // baro-ft -> earth-local units above the surface (~3-4.5 units at 30-45k ft cruise)
};

// F7 aurora tuning. Budget knobs: curtain count / segments / noise octaves.
export const AURORA_DEFAULTS = {
  polarLatitudeDeg: 67, // auroral oval sits ~67 deg, offset from the geographic pole
  axialTiltDeg: 23.44, // matches EarthRig's tilt so the oval aligns with the lit hemisphere
  curtainSegments: 96,
  height: 22,
};

export const BLOOM_DEFAULTS = {
  strength: 0.5,
  radius: 0.2,
  threshold: 0.9,
};

// Lighting calibration for the relit scene (F3 REQ-280). With MeshStandard
// planets, night sides go dark; ambientIntensity is the "not pure black" floor.
// sunDecay:0 disables distance falloff because the symbolic scale spans
// ~80..3500 units — physical inverse-square would black out everything past
// Mercury. Tune sunIntensity/ambientIntensity here, not decay.
export const LIGHTING_DEFAULTS = {
  ambientColor: 0x404050,
  ambientIntensity: 0.35,
  sunColor: 0xffffff,
  sunIntensity: 3,
  sunDistance: 0,
  sunDecay: 0,
};
