import * as THREE from 'three';
import { isLunar, isTotalLunar } from '../utils/eclipseData.js';

// @MX:NOTE: [AUTO] A local, relative-scale shadow diorama — NOT a physically accurate
// umbra-cone simulation. The whole app is symbolic-scale (no ascending node in the
// orbit model), so geometric umbra math can't hold; this rig illustrates the event with
// real Three.js shadow casting (DirectionalLight + PCFSoftShadowMap). The HUD labels it
// as an illustrative diagram. Placement/scale below are visual calibration knobs.
const DIORAMA_SCALE = 0.55;
const EARTH_R = 40;
const MOON_R = 11;
const SEP = 90; // sun-earth-moon separation in the diorama
const MOON_GREY = 0xbfbfbf;
const BLOOD_MOON = 0xb5352a;

export class EclipseRig {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.earthRadius] - Main-view earth radius, for placement.
   */
  constructor({ earthRadius = 100 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'eclipseRig';
    // Float the inset diagram above the main earth so it reads as a separate diagram.
    this.group.position.set(0, earthRadius * 1.9, 0);
    this.group.scale.setScalar(DIORAMA_SCALE);
    this.group.visible = false;

    this._buildLight();
    this._buildEarth();
    this._buildMoon();
    this.current = null;
  }

  _buildLight() {
    // Sun analog: a directional light casting shadows from +X.
    this.light = new THREE.DirectionalLight(0xfff4e0, 3);
    this.light.position.set(SEP * 2, 0, 0);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    const cam = this.light.shadow.camera;
    cam.near = 1;
    cam.far = SEP * 4;
    cam.left = cam.bottom = -SEP;
    cam.right = cam.top = SEP;
    this.light.shadow.radius = 6; // soft penumbra falloff
    this.group.add(this.light);
    this.group.add(this.light.target);
    this.group.add(new THREE.AmbientLight(0x222233, 0.4));
  }

  _buildEarth() {
    const geo = new THREE.SphereGeometry(EARTH_R, 48, 48);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b6fb0, roughness: 1, metalness: 0 });
    this.earth = new THREE.Mesh(geo, mat);
    this.earth.name = 'eclipseEarth';
    this.group.add(this.earth);
  }

  _buildMoon() {
    const geo = new THREE.SphereGeometry(MOON_R, 32, 32);
    this._moonMat = new THREE.MeshStandardMaterial({ color: MOON_GREY, roughness: 1, metalness: 0 });
    this.moon = new THREE.Mesh(geo, this._moonMat);
    this.moon.name = 'eclipseMoon';
    this.group.add(this.moon);
  }

  /**
   * Render the given eclipse type. Solar => Moon shadows the Earth; Lunar => Earth
   * shadows the Moon, with a red umbra tint during totality (blood moon).
   * @param {{type:string,name:string}} eclipse
   */
  show(eclipse) {
    this.current = eclipse;
    const lunar = isLunar(eclipse.type);
    if (lunar) {
      // Earth between sun (+X) and Moon: earth casts, moon receives.
      this.earth.position.set(0, 0, 0);
      this.moon.position.set(-SEP, 0, 0);
      this.earth.castShadow = true;
      this.earth.receiveShadow = false;
      this.moon.castShadow = false;
      this.moon.receiveShadow = true;
      this.light.target.position.set(-SEP, 0, 0);
      this._moonMat.color.setHex(isTotalLunar(eclipse.type) ? BLOOD_MOON : MOON_GREY);
    } else {
      // Moon between sun (+X) and Earth: moon casts, earth receives.
      this.moon.position.set(SEP * 0.55, 0, 0);
      this.earth.position.set(0, 0, 0);
      this.moon.castShadow = true;
      this.moon.receiveShadow = false;
      this.earth.castShadow = false;
      this.earth.receiveShadow = true;
      this.light.target.position.set(0, 0, 0);
      this._moonMat.color.setHex(MOON_GREY);
    }
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
    this.current = null;
  }

  /** @param {number} dt - Frame delta in seconds. */
  update(dt) {
    if (this.group.visible) this.group.rotation.y += dt * 0.2;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
