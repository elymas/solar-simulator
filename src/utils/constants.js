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
  far: 50000,
  position: { x: 300, y: 200, z: 400 },
};

export const CONTROLS_DEFAULTS = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 50,
  maxDistance: 3000,
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
};

export const BLOOM_DEFAULTS = {
  strength: 1.5,
  radius: 0.4,
  threshold: 0.6,
};
