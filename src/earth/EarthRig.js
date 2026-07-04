import * as THREE from 'three';
import { TEXTURE_MAP, EARTH_VIEW_DEFAULTS, EARTH_RIG } from '../utils/constants.js';

/**
 * EarthRig builds the high-detail Earth for the dedicated Earth view: a lit
 * day/night sphere with a real-time terminator (day<->night blend driven by a sun
 * direction, injected into the standard MeshStandardMaterial via onBeforeCompile —
 * not a hand-rolled ShaderMaterial), a translucent cloud layer, and a Moon on a
 * schematic-distance but real-period / real-inclination orbit.
 *
 * Reuses the existing 2K day/night/cloud textures (constants.TEXTURE_MAP). No
 * normal/specular/hi-res art ships, so those are intentionally absent.
 */
export class EarthRig {
  /**
   * @param {Object} [opts]
   * @param {THREE.TextureLoader} [opts.textureLoader]
   * @param {THREE.WebGLRenderer} [opts.renderer] - For max-anisotropy on textures.
   */
  constructor({ textureLoader, renderer } = {}) {
    this._loader = textureLoader || new THREE.TextureLoader();
    this._renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'earthRig';

    // Fixed sun direction in earth-local space; the terminator sweeps because the
    // Earth mesh rotates under it (REQ-330: terminator from sun-relative rotation).
    this.sunDirection = new THREE.Vector3(1, 0, 0.35).normalize();

    this._buildEarth();
    this._buildClouds();
    this._buildMoon();
  }

  /**
   * Load a texture as sRGB with max anisotropy when a renderer is available.
   * @param {string} path
   * @returns {THREE.Texture}
   */
  _tex(path) {
    const t = this._loader.load(path);
    t.colorSpace = THREE.SRGBColorSpace;
    if (this._renderer && this._renderer.capabilities) {
      t.anisotropy = this._renderer.capabilities.getMaxAnisotropy();
    }
    return t;
  }

  /**
   * Build the lit Earth sphere and patch its material for the day/night terminator.
   */
  _buildEarth() {
    const r = EARTH_VIEW_DEFAULTS.earthRadius;
    const geometry = new THREE.SphereGeometry(r, 96, 96);
    const material = new THREE.MeshStandardMaterial({
      map: this._tex(TEXTURE_MAP.earth),
      roughness: 1,
      metalness: 0,
    });

    const nightMap = this._tex(TEXTURE_MAP.earthNight);
    this._terminatorUniforms = {
      uSunDirection: { value: this.sunDirection },
      uNightMap: { value: nightMap },
      uNightIntensity: { value: 1.0 },
    };

    // @MX:NOTE: [AUTO] Terminator via onBeforeCompile — inject a world-space normal
    // varying and mix the night texture where the surface faces away from the sun.
    // Patching MeshStandardMaterial keeps SIM-001's lighting/tone-mapping for free
    // instead of a bespoke ShaderMaterial.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDirection = this._terminatorUniforms.uSunDirection;
      shader.uniforms.uNightMap = this._terminatorUniforms.uNightMap;
      shader.uniforms.uNightIntensity = this._terminatorUniforms.uNightIntensity;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEarthWorldNormal;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvEarthWorldNormal = normalize(mat3(modelMatrix) * normal);'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 uSunDirection;\nuniform sampler2D uNightMap;\nuniform float uNightIntensity;\nvarying vec3 vEarthWorldNormal;'
        )
        .replace(
          '#include <dithering_fragment>',
          [
            'float sunDot = dot(normalize(vEarthWorldNormal), normalize(uSunDirection));',
            'float dayFactor = clamp(sunDot * 4.0 + 0.5, 0.0, 1.0);',
            'vec3 nightColor = texture2D(uNightMap, vMapUv).rgb * uNightIntensity;',
            'gl_FragColor.rgb = mix(nightColor, gl_FragColor.rgb, dayFactor);',
            '#include <dithering_fragment>',
          ].join('\n')
        );
    };
    material.userData.terminatorUniforms = this._terminatorUniforms;

    this.earth = new THREE.Mesh(geometry, material);
    this.earth.name = 'earth';
    this.earth.rotation.z = THREE.MathUtils.degToRad(23.44); // axial tilt
    this.group.add(this.earth);
  }

  /**
   * Build the translucent cloud layer as a child of Earth.
   */
  _buildClouds() {
    const r = EARTH_VIEW_DEFAULTS.earthRadius * EARTH_RIG.cloudScale;
    const geometry = new THREE.SphereGeometry(r, 96, 96);
    const material = new THREE.MeshStandardMaterial({
      map: this._tex(TEXTURE_MAP.earthClouds),
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    });
    this.clouds = new THREE.Mesh(geometry, material);
    this.clouds.name = 'earthClouds';
    this.earth.add(this.clouds);
  }

  /**
   * Build the Moon on an inclined orbit. Distance/radius are schematic; the
   * orbital period and inclination are the real IAU values (asserted to tolerance).
   */
  _buildMoon() {
    // moonOrbit carries the orbital-plane inclination; moonPivot spins within it.
    this.moonOrbit = new THREE.Group();
    this.moonOrbit.name = 'moonOrbit';
    this.moonOrbit.rotation.x = THREE.MathUtils.degToRad(EARTH_RIG.moonInclinationDeg);

    this.moonPivot = new THREE.Group();
    this.moonPivot.name = 'moonPivot';

    const geometry = new THREE.SphereGeometry(EARTH_RIG.moonRadius, 48, 48);
    const material = new THREE.MeshStandardMaterial({
      map: this._tex(TEXTURE_MAP.moon),
      roughness: 1,
      metalness: 0,
    });
    this.moon = new THREE.Mesh(geometry, material);
    this.moon.name = 'moon';
    this.moon.position.set(EARTH_RIG.moonDistance, 0, 0);

    this.moonPivot.add(this.moon);
    this.moonOrbit.add(this.moonPivot);
    this.group.add(this.moonOrbit);
  }

  /**
   * Advance rotations. `daysElapsed` maps wall-clock delta to sim days so the Moon
   * honors its 27.32-day period and the Earth its 23.934-hour spin.
   * @param {number} delta - Frame delta in seconds.
   * @param {number} [daysPerSecond] - Sim days advanced per real second.
   */
  update(delta, daysPerSecond = 1) {
    const days = delta * daysPerSecond;
    // Earth spin (rad/day) so the terminator sweeps under the fixed sun.
    const earthSpin = (2 * Math.PI) / (EARTH_RIG.earthRotationPeriodHours / 24);
    this.earth.rotation.y += earthSpin * days;
    this.clouds.rotation.y += earthSpin * days * 1.05;
    // Moon orbit (rad/day).
    this.moonPivot.rotation.y += ((2 * Math.PI) / EARTH_RIG.moonOrbitalPeriodDays) * days;
  }

  /**
   * F5/F6/F7 groups attach under the Earth so they inherit its transform.
   * @returns {THREE.Group}
   */
  getAttachPoint() {
    return this.group;
  }

  /**
   * Dispose all GPU resources (mobile VRAM reclaim, REQ-355).
   */
  dispose() {
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    if (this._terminatorUniforms && this._terminatorUniforms.uNightMap.value) {
      this._terminatorUniforms.uNightMap.value.dispose();
    }
  }
}
