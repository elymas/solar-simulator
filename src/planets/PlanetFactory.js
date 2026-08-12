import * as THREE from 'three';
import { PLANET_DATA, MOON_DATA, STAR_DATA } from './planetData.js';
import { TEXTURE_MAP, TEXTURE_HIRES_MAP } from '../utils/constants.js';
import { OrbitalMechanics } from './OrbitalMechanics.js';
import { TextureTierManager } from './TextureTierManager.js';

/**
 * PlanetFactory creates and manages all celestial bodies in the solar system.
 * Handles mesh creation, texture loading, orbit lines, and animation updates.
 */
export class PlanetFactory {
  /**
   * @param {THREE.Scene} scene - The Three.js scene to add objects to.
   * @param {Object} sceneManager - SceneManager instance for access to renderer.
   */
  constructor(scene, sceneManager) {
    this.scene = scene;
    this.sceneManager = sceneManager;
    this.planets = {};
    this.stars = {};
    this.orbitLines = [];
    this.moonPivots = {};
    this.tierManager = new TextureTierManager(TEXTURE_HIRES_MAP);
    this._focusedLODKey = null;

    // Loading callbacks (set by main.js before textures start loading)
    this.onLoadProgress = null;
    this.onLoadComplete = null;

    // Use LoadingManager to track texture loading progress
    this.loadingManager = new THREE.LoadingManager();
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);

    this.loadingManager.onProgress = (_url, loaded, total) => {
      if (this.onLoadProgress) this.onLoadProgress(loaded, total);
    };
    this.loadingManager.onLoad = () => {
      if (this.onLoadComplete) this.onLoadComplete();
    };

    this._createStarfield();
    this._createSun();
    this._createAllPlanets();
    this._createOrbitLines();
    this._createStars();
  }

  /**
   * Load a texture with sRGB color space and max anisotropy applied.
   * @param {string} path - Relative path to texture file.
   * @returns {THREE.Texture}
   */
  _loadTexture(path) {
    const texture = this.textureLoader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    const renderer = this.sceneManager?.renderer;
    if (renderer) {
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
    return texture;
  }

  /**
   * Apply a body texture to a material, degrading to a flat color when the file
   * is absent. Keeps the scene renderable with zero art (F1 dwarfs) and picks up
   * real textures automatically once dropped at the TEXTURE_MAP path.
   * @param {THREE.Material} material - Target material (color used as fallback).
   * @param {string} key - Body key indexing TEXTURE_MAP.
   * @param {number} fallbackColor - Flat color to keep when the texture is missing.
   */
  _applyPlanetTexture(material, key, fallbackColor) {
    const path = TEXTURE_MAP[key];
    if (!path) {
      if (fallbackColor != null) material.color.set(fallbackColor);
      return;
    }
    this.textureLoader.load(
      path,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const renderer = this.sceneManager?.renderer;
        if (renderer) {
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      },
      undefined,
      () => {
        // ponytail: texture file absent -> keep flat MeshStandard color, no throw.
        if (fallbackColor != null) material.color.set(fallbackColor);
      }
    );
  }

  /**
   * Create the starfield background using an inverted sphere.
   */
  _createStarfield() {
    const geometry = new THREE.SphereGeometry(10000, 64, 64);
    const material = new THREE.MeshBasicMaterial({
      map: this._loadTexture(TEXTURE_MAP.stars),
      side: THREE.BackSide,
    });
    const starfield = new THREE.Mesh(geometry, material);
    this.scene.add(starfield);
  }

  /**
   * Create the Sun with emissive MeshBasicMaterial (unaffected by lighting).
   */
  _createSun() {
    const data = PLANET_DATA.sun;
    const geometry = new THREE.SphereGeometry(data.displayRadius, 64, 64);
    const material = new THREE.MeshBasicMaterial({
      map: this._loadTexture(TEXTURE_MAP.sun),
      color: 0xffffff,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'sun';
    this.scene.add(mesh);

    this.planets.sun = {
      mesh,
      data,
    };
  }

  /**
   * Create all planets from PLANET_DATA (excluding sun).
   */
  _createAllPlanets() {
    const planetKeys = Object.keys(PLANET_DATA).filter((k) => k !== 'sun');

    for (const key of planetKeys) {
      this._createPlanet(key, PLANET_DATA[key]);
    }

    // Create moons for all planets that have them
    for (const [parentKey, moons] of Object.entries(MOON_DATA)) {
      if (this.planets[parentKey]) {
        for (const moonData of moons) {
          this._createSatellite(parentKey, moonData);
        }
      }
    }

    // Create Saturn's rings
    if (this.planets.saturn) {
      this._createSaturnRings();
    }
  }

  /**
   * Create a single planet mesh with texture and axial tilt.
   * @param {string} key - Planet identifier (e.g., 'earth', 'mars').
   * @param {Object} data - Planet data from planetData.js.
   */
  _createPlanet(key, data) {
    const segments = data.displayRadius >= 14 ? 64 : 32;
    const geometry = new THREE.SphereGeometry(data.displayRadius, segments, segments);

    // MeshStandardMaterial makes planets respond to the Sun's light (day/night
    // terminator). Texture loads asynchronously; missing files degrade to the
    // body's flat color via _applyPlanetTexture (F1 dwarfs ship without art).
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
    });
    this._applyPlanetTexture(material, key, data.color);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = key;

    // Apply axial tilt
    if (data.axialTilt) {
      mesh.rotation.z = THREE.MathUtils.degToRad(data.axialTilt);
    }

    // Set initial position using orbital mechanics
    const pos = OrbitalMechanics.calculatePosition(data, 0);
    mesh.position.set(pos.x, pos.y, pos.z);

    this.scene.add(mesh);

    this.planets[key] = {
      mesh,
      data,
    };

    // Add cloud layer to Earth
    if (key === 'earth') {
      this._createEarthClouds(mesh, data);
    }
  }

  /**
   * Create a translucent cloud layer around Earth.
   * @param {THREE.Mesh} earthMesh - The Earth mesh to attach clouds to.
   * @param {Object} data - Earth planet data.
   */
  _createEarthClouds(earthMesh, data) {
    const geometry = new THREE.SphereGeometry(data.displayRadius * 1.02, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      map: this._loadTexture(TEXTURE_MAP.earthClouds),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    });
    const clouds = new THREE.Mesh(geometry, material);
    clouds.name = 'earthClouds';
    earthMesh.add(clouds);
    this.earthClouds = clouds;
  }

  /**
   * Create a satellite (moon) orbiting a parent planet using a pivot group.
   * @param {string} parentKey - Parent planet key (e.g., 'earth', 'mars').
   * @param {Object} moonData - Moon data object.
   */
  _createSatellite(parentKey, moonData) {
    const geometry = new THREE.SphereGeometry(moonData.displayRadius, 16, 16);

    let material;
    if (moonData.key === 'moon' && TEXTURE_MAP.moon) {
      material = new THREE.MeshStandardMaterial({
        map: this._loadTexture(TEXTURE_MAP.moon),
        roughness: 1,
        metalness: 0,
      });
    } else {
      material = new THREE.MeshStandardMaterial({
        color: moonData.color,
        roughness: 1,
        metalness: 0,
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = moonData.key;
    mesh.position.set(moonData.distanceDisplay, 0, 0);

    const pivot = new THREE.Group();
    pivot.name = `${moonData.key}Pivot`;
    pivot.add(mesh);

    this.scene.add(pivot);
    this.moonPivots[moonData.key] = pivot;

    this.planets[moonData.key] = {
      mesh,
      data: moonData,
      pivot,
      parentKey,
      isSatellite: true,
    };
  }

  /**
   * Create Saturn's ring system.
   */
  _createSaturnRings() {
    const saturnData = PLANET_DATA.saturn;
    const saturnMesh = this.planets.saturn.mesh;
    const innerRadius = saturnData.displayRadius * 1.2;
    const outerRadius = saturnData.displayRadius * 2.2;

    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
    const material = new THREE.MeshBasicMaterial({
      map: this._loadTexture(TEXTURE_MAP.saturnRing),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.name = 'saturnRing';

    // Rotate ring to be in the xz-plane, then apply Saturn's tilt
    ring.rotation.x = -Math.PI / 2;

    saturnMesh.add(ring);
    this.saturnRing = ring;
  }

  /**
   * Create semi-transparent orbit path lines for all planets.
   */
  _createOrbitLines() {
    const planetKeys = Object.keys(PLANET_DATA).filter((k) => k !== 'sun');

    for (const key of planetKeys) {
      const data = PLANET_DATA[key];
      // orbitSegments lets one body opt out of the shared 128 default; only
      // Halley needs it (see planetData.js), and raising the default for
      // everyone would cost 40 orbit lines their cheapness for nothing.
      const positions = OrbitalMechanics.generateOrbitPath(data, data.orbitSegments ?? 128);

      if (positions.length === 0) continue;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: 0x444466,
        transparent: true,
        opacity: 0.3,
      });

      // Close the loop by using Line with an extra segment back to start
      const line = new THREE.LineLoop(geometry, material);
      line.name = `${key}Orbit`;
      this.scene.add(line);
      this.orbitLines.push(line);
    }
  }

  /**
   * Create stars beyond the solar system as emissive spheres.
   */
  _createStars() {
    for (const [key, data] of Object.entries(STAR_DATA)) {
      const segments = data.displayRadius >= 40 ? 64 : 32;
      const geometry = new THREE.SphereGeometry(data.displayRadius, segments, segments);
      const material = new THREE.MeshBasicMaterial({
        color: data.color,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = key;

      // Position stars at large distances using azimuth and elevation
      const dist = data.distanceDisplay;
      const az = data.azimuth || 0;
      const el = data.elevation || 0;
      mesh.position.set(
        dist * Math.cos(el) * Math.sin(az),
        dist * Math.sin(el),
        dist * Math.cos(el) * Math.cos(az)
      );

      this.scene.add(mesh);

      this.stars[key] = { mesh, data };
      this.planets[key] = { mesh, data, isStar: true, isSatellite: false };
    }
  }

  /**
   * Update all celestial body positions and rotations.
   * @param {number} timeDays - Current simulation time in days.
   * @param {number} delta - Frame delta time in seconds.
   */
  update(timeDays, delta) {
    const planetKeys = Object.keys(PLANET_DATA);

    for (const key of planetKeys) {
      const planet = this.planets[key];
      if (!planet) continue;

      const { mesh, data } = planet;

      // Self-rotation
      if (data.rotationPeriod) {
        // rotationPeriod is in hours, convert to radians per second
        const rotationSpeed = (2 * Math.PI) / (Math.abs(data.rotationPeriod) * 3600);
        const direction = data.rotationPeriod < 0 ? -1 : 1;
        mesh.rotation.y += direction * rotationSpeed * delta * 86400;
      }

      // Orbital position (skip sun)
      if (key !== 'sun' && data.orbitalPeriod) {
        const pos = OrbitalMechanics.calculatePosition(data, timeDays);
        mesh.position.set(pos.x, pos.y, pos.z);
      }
    }

    // Update all satellite orbits
    this._updateSatellites(timeDays);

    // Rotate Earth cloud layer slightly faster than Earth
    if (this.earthClouds) {
      this.earthClouds.rotation.y += 0.02 * delta;
    }
  }

  /**
   * Update all satellite positions to orbit their parent planets.
   * @param {number} timeDays - Current simulation time in days.
   */
  _updateSatellites(timeDays) {
    for (const [parentKey, moons] of Object.entries(MOON_DATA)) {
      const parent = this.planets[parentKey];
      if (!parent) continue;

      for (const moonData of moons) {
        const pivot = this.moonPivots[moonData.key];
        if (!pivot) continue;

        pivot.position.copy(parent.mesh.position);

        const period = Math.abs(moonData.orbitalPeriod);
        const direction = moonData.retrograde === true ? -1 : 1;
        const angle = direction * ((2 * Math.PI) / period) * timeDays;
        pivot.rotation.y = angle;
      }
    }
  }

  /**
   * React to a body gaining focus: lazy-load its hi-res texture tier (REQ-290)
   * and raise its geometry LOD (REQ-220). Both are skipped on low-end or
   * frame-budget-degraded devices; camera/picking are never affected.
   * @param {string} key - Focused body key.
   */
  onFocus(key) {
    this._upgradeTexture(key);
    this._raiseLOD(key);
  }

  /**
   * React to losing focus: restore the previously focused body's base geometry.
   */
  onDefocus() {
    this._restoreLOD();
  }

  /**
   * Lazy-load and swap in a body's hi-res texture, at most once per body.
   * @param {string} key - Body key.
   */
  _upgradeTexture(key) {
    if (this.sceneManager?.textureCapEnabled) return; // low-end texture cap (REQ-230)
    const path = this.tierManager.requestUpgrade(key);
    if (!path) return;
    const planet = this.planets[key];
    if (!planet) return;
    this.textureLoader.load(path, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const renderer = this.sceneManager?.renderer;
      if (renderer) {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      const material = planet.mesh.material;
      if (material.map && material.map !== texture) material.map.dispose();
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    });
  }

  /**
   * Rebuild the focused body's sphere at a higher segment count. Only one body
   * is high-LOD at a time; the original segment count is read back from the
   * geometry so restore is exact regardless of the body's base tier.
   * @param {string} key - Body key to raise.
   */
  _raiseLOD(key) {
    if (this.sceneManager?.lodUpgradesDisabled || this.sceneManager?.lodBudgetDisabled) return;
    const planet = this.planets[key];
    if (!planet || planet.isStar || !planet.mesh.geometry?.parameters) return;
    if (this._focusedLODKey === key) return;
    this._restoreLOD();
    planet._preLODSegments = planet.mesh.geometry.parameters.widthSegments ?? 32;
    this._swapSegments(planet, 128);
    this._focusedLODKey = key;
  }

  /**
   * Restore the currently high-LOD body to its original segment count.
   */
  _restoreLOD() {
    if (!this._focusedLODKey) return;
    const planet = this.planets[this._focusedLODKey];
    if (planet && planet._preLODSegments != null) {
      this._swapSegments(planet, planet._preLODSegments);
    }
    this._focusedLODKey = null;
  }

  /**
   * Replace a body's sphere geometry with one at the given segment count.
   * @param {Object} planet - Planet entry from this.planets.
   * @param {number} segments - New width/height segment count.
   */
  _swapSegments(planet, segments) {
    planet.mesh.geometry.dispose();
    planet.mesh.geometry = new THREE.SphereGeometry(planet.data.displayRadius, segments, segments);
  }

  /**
   * Get a planet mesh by key.
   * @param {string} key - Planet identifier.
   * @returns {THREE.Mesh|null}
   */
  getPlanetMesh(key) {
    return this.planets[key]?.mesh || null;
  }

  /**
   * Get all planet keys.
   * @returns {string[]}
   */
  getPlanetKeys() {
    return Object.keys(this.planets);
  }
}
