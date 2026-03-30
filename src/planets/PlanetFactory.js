import * as THREE from 'three';
import { PLANET_DATA, MOON_DATA, STAR_DATA } from './planetData.js';
import { TEXTURE_MAP } from '../utils/constants.js';
import { OrbitalMechanics } from './OrbitalMechanics.js';

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
   * Load a texture with sRGB color space applied.
   * @param {string} path - Relative path to texture file.
   * @returns {THREE.Texture}
   */
  _loadTexture(path) {
    const texture = this.textureLoader.load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
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

    const materialProps = {
      map: this._loadTexture(TEXTURE_MAP[key]),
    };

    const material = new THREE.MeshBasicMaterial(materialProps);
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
    const material = new THREE.MeshBasicMaterial({
      map: this._loadTexture(TEXTURE_MAP.earthClouds),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
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
      material = new THREE.MeshBasicMaterial({
        map: this._loadTexture(TEXTURE_MAP.moon),
      });
    } else {
      material = new THREE.MeshBasicMaterial({ color: moonData.color });
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
      const positions = OrbitalMechanics.generateOrbitPath(data, 128);

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
