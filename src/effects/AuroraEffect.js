import * as THREE from 'three';
import { AURORA_DEFAULTS } from '../utils/constants.js';

// --- pure helpers (unit-tested; no WebGL) ---

/**
 * Two tiers only (REQ-630/645): the custom vertex-noise shader for capable desktop,
 * a static billboard sprite for mobile or low-end. No intermediate "reduced curtain".
 * @param {{isMobile:boolean, isLowEnd:boolean}} caps
 * @returns {'shader'|'billboard'}
 */
export function selectAuroraTier({ isMobile, isLowEnd }) {
  return isMobile || isLowEnd ? 'billboard' : 'shader';
}

/**
 * Night-side visibility (REQ-620): 1 where the surface faces away from the sun, 0 on
 * the lit side and at the terminator. Mirrors the shader's dot(normal, sunDir) fade.
 * @param {THREE.Vector3} normal
 * @param {THREE.Vector3} sunDir
 * @returns {number} 0..1
 */
export function nightSideVisibility(normal, sunDir) {
  const d = normal.clone().normalize().dot(sunDir.clone().normalize());
  return Math.max(0, Math.min(1, -d));
}

/**
 * Earth's rotation axis tilted off +Y by the axial tilt (around Z, matching EarthRig's
 * earth.rotation.z tilt), so the auroral oval sits over the true geographic pole.
 * @param {number} tiltDeg
 * @param {boolean} [north=true]
 * @returns {THREE.Vector3} unit vector
 */
export function poleAxis(tiltDeg, north = true) {
  const t = THREE.MathUtils.degToRad(tiltDeg);
  const v = new THREE.Vector3(-Math.sin(t), Math.cos(t), 0);
  return north ? v : v.multiplyScalar(-1);
}

// --- visual effect (not unit-tested; additive noise curtain / billboard fallback) ---

const VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying float vUp;
  // cheap value noise
  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
    vec2 u = f*f*(3.-2.*f);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  void main(){
    vUp = uv.y;
    vec3 p = position;
    float wave = noise(vec2(uv.x * 6.0 + uTime * 0.3, uv.y * 2.0));
    // displace horizontally for a dancing-ripple curtain; stronger toward the top.
    p.x += (wave - 0.5) * 8.0 * uv.y;
    p.z += (noise(vec2(uv.x * 4.0 - uTime * 0.2, uv.y)) - 0.5) * 8.0 * uv.y;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vWorldPos;
  varying float vUp;
  void main(){
    // vUp is uv.y (always written as 0..1 in the vertex buffer), but perspective-
    // correct varying interpolation can still hand the fragment stage a value a
    // hair outside [0,1] (float rounding at the seam/edges). pow() with a
    // non-integer exponent is undefined for a negative base, and on real
    // hardware that undefined result was NaN -- which bloom's blur convolution
    // then smeared across every neighboring pixel, turning one bad fragment
    // into a solid black block covering the whole curtain (root-caused via a
    // live WebGL bisection: the artifact vanished the instant this clamp was
    // added, confirmed on real hardware, not reproducible from source review
    // alone).
    float vUpC = clamp(vUp, 0.0, 1.0);
    // green core -> magenta/violet tips
    vec3 col = mix(vec3(0.1, 1.0, 0.4), vec3(0.7, 0.2, 1.0), pow(vUpC, 1.5));
    float alpha = (1.0 - vUpC) * 0.65; // fade out toward the top
    // night-side only: invisible on the sun-facing hemisphere.
    float night = clamp(-dot(normalize(vWorldPos), normalize(uSunDir)), 0.0, 1.0);
    gl_FragColor = vec4(col * night, alpha * night);
  }
`;

export class AuroraEffect {
  /**
   * @param {Object} [opts]
   * @param {'shader'|'billboard'} [opts.tier]
   * @param {number} [opts.earthRadius]
   * @param {THREE.Vector3} [opts.sunDirection]
   */
  constructor({ tier = 'shader', earthRadius = 100, sunDirection } = {}) {
    this.tier = tier;
    this._earthRadius = earthRadius;
    this._sunDir = (sunDirection || new THREE.Vector3(1, 0, 0.35)).clone().normalize();
    this.group = new THREE.Group();
    this.group.name = 'auroraEffect';
    this._uniforms = { uTime: { value: 0 }, uSunDir: { value: this._sunDir } };
    this._elapsed = 0;
    this._build();
  }

  _build() {
    const colatitudeDeg = 90 - AURORA_DEFAULTS.polarLatitudeDeg; // ring sits this far from the pole
    const colatRad = THREE.MathUtils.degToRad(colatitudeDeg);
    for (const north of [true, false]) {
      const mesh = this.tier === 'shader' ? this._buildCurtain(colatRad) : this._buildBillboard();
      this._orient(mesh, north, colatitudeDeg);
      this.group.add(mesh);
    }
  }

  /**
   * Builds the curtain as a radially-extruded spherical band (a cone-frustum
   * shell), not a cylinder. A cylinder has a constant radius from a straight
   * axis, so it only touches Earth's sphere at one height; everywhere else it
   * either clips inside the globe or floats away from it. Here every vertex
   * sits along its own base-ring direction `dir`, at distance
   * `earthRadius + t * height` from Earth's center, so the foot ring
   * (t=0) is always exactly flush with the sphere's surface and the curtain
   * flares straight outward from there.
   * @param {number} colatRad - colatitude (angle from the pole axis) in radians.
   */
  _buildCurtain(colatRad) {
    const r = this._earthRadius;
    const segments = AURORA_DEFAULTS.curtainSegments;
    const heightSegments = 8;
    const height = AURORA_DEFAULTS.height;
    const cols = segments + 1; // +1 to duplicate the seam vertex for clean UV wrap
    const rows = heightSegments + 1;

    const positions = new Float32Array(rows * cols * 3);
    const uvs = new Float32Array(rows * cols * 2);
    const indices = [];

    const sinColat = Math.sin(colatRad);
    const cosColat = Math.cos(colatRad);

    for (let j = 0; j < rows; j++) {
      const t = j / heightSegments;
      const radius = r + t * height;
      for (let i = 0; i < cols; i++) {
        const phi = (i / segments) * Math.PI * 2;
        const dirX = sinColat * Math.cos(phi);
        const dirY = cosColat;
        const dirZ = sinColat * Math.sin(phi);
        const vi = j * cols + i;
        positions[vi * 3] = dirX * radius;
        positions[vi * 3 + 1] = dirY * radius;
        positions[vi * 3 + 2] = dirZ * radius;
        uvs[vi * 2] = i / segments;
        uvs[vi * 2 + 1] = t;
      }
    }

    // Two triangles per grid quad, wound so the computed normal faces outward
    // (away from Earth's center) rather than into the globe.
    for (let j = 0; j < heightSegments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = j * cols + i;
        const b = j * cols + i + 1;
        const c = (j + 1) * cols + i;
        const d = (j + 1) * cols + i + 1;
        indices.push(a, c, b, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
  }

  _buildBillboard() {
    // Static additive sprite: no per-vertex noise, cheap enough for mobile/low-end.
    const mat = new THREE.SpriteMaterial({
      map: this._billboardTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.7,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(this._earthRadius * 0.9);
    return sprite;
  }

  _billboardTexture() {
    // ponytail: paint one small gradient once; reused by both poles.
    if (AuroraEffect._billboardTex) return AuroraEffect._billboardTex;
    const c = document.createElement('canvas');
    c.width = 16; c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 64, 0, 0);
      g.addColorStop(0, 'rgba(30,255,110,0.9)');
      g.addColorStop(1, 'rgba(180,60,255,0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 64);
    }
    const tex = new THREE.CanvasTexture(c);
    AuroraEffect._billboardTex = tex;
    return tex;
  }

  _orient(mesh, north, colatitudeDeg) {
    const axis = poleAxis(AURORA_DEFAULTS.axialTiltDeg, north);
    if (mesh.isMesh) {
      // Curtain vertices already encode their full position relative to
      // Earth's center (see _buildCurtain), since this.group sits at Earth's
      // own center. Only the rotation aligning local +Y (the untilted pole
      // axis the geometry was built in) to the real tilted axis is needed.
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    } else {
      // Billboard sprite: flat, always camera-facing, offset above the pole cap.
      const centerDist = this._earthRadius * Math.cos(THREE.MathUtils.degToRad(colatitudeDeg));
      mesh.position.copy(axis.multiplyScalar(centerDist));
    }
  }

  /**
   * @param {number} dt - Frame delta in seconds.
   */
  update(dt) {
    this._elapsed += dt;
    this._uniforms.uTime.value = this._elapsed;
  }

  /** @param {THREE.Vector3} dir */
  setSunDirection(dir) {
    this._sunDir.copy(dir).normalize();
  }

  /** @param {boolean} v */
  setVisible(v) {
    this.group.visible = v;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
