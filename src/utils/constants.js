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
