import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COLOR_PALETTE, CAMERA_DEFAULTS, CONTROLS_DEFAULTS, BLOOM_DEFAULTS, LIGHTING_DEFAULTS } from '../utils/constants.js';
import { shouldDegrade, FrameBudgetDegrader } from '../utils/performance.js';

/**
 * SceneManager handles the Three.js scene, renderer, camera, controls,
 * lighting, and post-processing (bloom effect for Sun glow).
 */
export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this._initRenderer();
    this._initCamera();
    this._initControls();
    this._initLighting();
    this._initPostProcessing();
    this._detectPerformance();
  }

  /**
   * Initialize WebGL renderer with antialiasing and dark background.
   */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(COLOR_PALETTE.background, 1);
    // ACES filmic tone mapping compresses the HDR bloom + lit surfaces into a
    // filmic response (REQ-285). OutputPass already consumes renderer.toneMapping.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.56; // calibration knob for overall brightness
    // @MX:NOTE: [AUTO] Shadow maps enabled for the F6 eclipse diorama (SPEC-EARTH-002).
    // Harmless to the solar view — no light there casts shadows, so it costs nothing
    // until EarthView's EclipseRig marks a caster/receiver.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
  }

  /**
   * Initialize perspective camera with configured defaults.
   */
  _initCamera() {
    const { fov, near, far, position } = CAMERA_DEFAULTS;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Initialize OrbitControls with damping and zoom limits.
   */
  _initControls() {
    const { enableDamping, dampingFactor, minDistance, maxDistance } = CONTROLS_DEFAULTS;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = enableDamping;
    this.controls.dampingFactor = dampingFactor;
    this.controls.minDistance = minDistance;
    this.controls.maxDistance = maxDistance;
  }

  /**
   * Initialize scene lighting: ambient light and a point light at the origin (Sun).
   */
  _initLighting() {
    const L = LIGHTING_DEFAULTS;
    const ambientLight = new THREE.AmbientLight(L.ambientColor, L.ambientIntensity);
    this.scene.add(ambientLight);

    // @MX:WARN: [AUTO] decay:0 (no distance falloff) is deliberate; physical
    // inverse-square decay would leave every planet past Mercury near-black on
    // this symbolic 80..3500-unit scale. Tune sunIntensity/ambientIntensity, not decay.
    // @MX:REASON: [AUTO] After relight (MeshBasic->MeshStandard) every planet/moon
    // depends on this light, so wrong decay/intensity darkens the entire scene.
    const sunLight = new THREE.PointLight(L.sunColor, L.sunIntensity, L.sunDistance, L.sunDecay);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);
  }

  /**
   * Initialize post-processing pipeline with bloom effect for Sun glow.
   */
  _initPostProcessing() {
    const { strength, radius, threshold } = BLOOM_DEFAULTS;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const size = new THREE.Vector2(width, height);

    // @MX:NOTE: [AUTO] The default EffectComposer target has samples:0, so the
    // renderer's antialias:true never reached the screen (every frame goes
    // through composer.render). A multisampled target revives MSAA (REQ-270).
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, renderTarget);

    // @MX:NOTE: [AUTO] renderPass is stored so ViewManager can retarget its
    // .scene/.camera to whichever View is active each frame (single shared
    // composer, one pass pipeline — REQ-385). outlinePass is retargeted the same way.
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(size, strength, radius, threshold);
    this.composer.addPass(this.bloomPass);

    // Hover highlight (REQ-006). Placed after bloom so the outline stays crisp.
    this.outlinePass = new OutlinePass(size, this.scene, this.camera);
    this.outlinePass.edgeStrength = 3;
    this.outlinePass.edgeGlow = 0.3;
    this.outlinePass.edgeThickness = 1.5;
    this.outlinePass.visibleEdgeColor.set(COLOR_PALETTE.accent);
    this.outlinePass.hiddenEdgeColor.set(COLOR_PALETTE.accent);
    this.composer.addPass(this.outlinePass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    // Normalize internal buffer sizes to devicePixelRatio; also sizes the
    // multisampled target and its ping-pong clone. Resize handler reuses setSize.
    this.composer.setSize(width, height);
  }

  /**
   * Set the mesh to outline on hover, or clear it when null (REQ-006).
   * @param {THREE.Object3D|null} mesh
   */
  setHoveredObject(mesh) {
    if (this.outlinePass) {
      this.outlinePass.selectedObjects = mesh ? [mesh] : [];
    }
  }

  /**
   * Resize the shared renderer + composer and this view's camera aspect.
   * Called by ViewManager, which owns the single window resize listener.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  /**
   * Detect mobile or low-end devices and reduce rendering quality
   * to maintain acceptable frame rates.
   */
  _detectPerformance() {
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isLowEnd = navigator.hardwareConcurrency <= 4;
    this.lowEnd = this.isMobile || isLowEnd;

    // REQ-230: low-end devices cap texture resolution (skip the hi-res tier) and
    // disable geometry LOD upgrades. PlanetFactory reads these flags on focus.
    this.textureCapEnabled = this.lowEnd;
    this.lodUpgradesDisabled = this.lowEnd;
    this.lodBudgetDisabled = false;

    if (this.lowEnd) {
      this.renderer.setPixelRatio(1);
      this.composer.setPixelRatio(1);
      this.bloomPass.strength = 0.4;
      this.bloomPass.radius = 0.15;
    }

    // Live degradation (REQ-018): sustained sub-30fps on mobile drops post-processing.
    this._fpsSamples = [];
    this._degraded = false;
    this._perfWindow = 90;
    this._perfThresholdFps = 30;

    // Frame-budget priority degradation (REQ-240): bloom -> LOD -> pixel ratio.
    this._budgetDegrader = new FrameBudgetDegrader({ budgetMs: this.isMobile ? 1000 / 30 : 1000 / 60 });
    this._baseBloomRadius = this.bloomPass.radius;
    this._basePixelRatio = this.renderer.getPixelRatio();

    // Set by ViewManager while the Earth view is active so the aurora sheds first
    // (SPEC-EARTH-002 REQ-650). Null in the solar view.
    this.onAuroraShed = null;
  }

  /**
   * Swap the frame-budget degradation ladder (ViewManager enters/leaves the Earth
   * view, which prepends the 'aurora' shed step). Resets the degrader's level.
   * @param {string[]} steps
   */
  setDegradeSteps(steps) {
    this._budgetDegrader.setSteps(steps);
  }

  /**
   * Apply the frame-budget priority degradation ladder (REQ-240). Shed one
   * non-essential effect per step (bloom radius -> LOD upgrades -> pixel ratio),
   * and restore in reverse when frame times recover. Camera controls and
   * click/hover picking are never touched.
   * @param {number} frameMs - Last frame duration in milliseconds.
   */
  _applyBudgetDegradation(frameMs) {
    switch (this._budgetDegrader.record(frameMs)) {
      case 'aurora':
        // Earth-view-only step: aurora sheds first (REQ-650). SceneManager stays
        // agnostic — EarthView owns the effect and registers this callback.
        if (this.onAuroraShed) this.onAuroraShed(true);
        break;
      case 'restore:aurora':
        if (this.onAuroraShed) this.onAuroraShed(false);
        break;
      case 'bloom':
        this.bloomPass.radius = 0;
        break;
      case 'lod':
        this.lodBudgetDisabled = true;
        break;
      case 'pixelRatio':
        this.composer.setPixelRatio(Math.max(1, this._basePixelRatio * 0.75));
        break;
      case 'restore:pixelRatio':
        this.composer.setPixelRatio(this._basePixelRatio);
        break;
      case 'restore:lod':
        this.lodBudgetDisabled = false;
        break;
      case 'restore:bloom':
        this.bloomPass.radius = this._baseBloomRadius;
        break;
      default:
        break;
    }
  }

  /**
   * Sample the frame rate and apply degradation once mobile fps stays too low.
   * @param {number} delta - Frame delta time in seconds.
   */
  _monitorPerformance(delta) {
    if (this._degraded || !this.isMobile) return;

    this._fpsSamples.push(delta);
    if (this._fpsSamples.length > this._perfWindow) {
      this._fpsSamples.shift();
    }

    if (
      shouldDegrade({
        deltas: this._fpsSamples,
        windowSize: this._perfWindow,
        thresholdFps: this._perfThresholdFps,
        isMobile: this.isMobile,
      })
    ) {
      this._applyDegradation();
    }
  }

  /**
   * Disable post-processing and lower render resolution to keep core rendering
   * interactive (REQ-018). The plain WebGLRenderer path is used from here on.
   */
  _applyDegradation() {
    this._degraded = true;
    // ponytail: no low-res texture assets exist, so lower render resolution instead of swapping textures.
    this.renderer.setPixelRatio(0.75);
    if (this.outlinePass) this.outlinePass.selectedObjects = [];
  }

  /**
   * Add a Three.js object to the scene.
   * @param {THREE.Object3D} object
   */
  add(object) {
    this.scene.add(object);
  }

  /**
   * Remove a Three.js object from the scene.
   * @param {THREE.Object3D} object
   */
  remove(object) {
    this.scene.remove(object);
  }

  /**
   * Smoothly reset camera to default position over ~60 frames.
   */
  resetCamera() {
    const { position } = CAMERA_DEFAULTS;
    this._resetTarget = new THREE.Vector3(position.x, position.y, position.z);
    this._resetLookAt = new THREE.Vector3(0, 0, 0);
    this._isResetting = true;
    this._isFocusing = false;
    this._resetProgress = 0;

    // Restore default controls distance
    const { minDistance, maxDistance } = CONTROLS_DEFAULTS;
    this.controls.minDistance = minDistance;
    this.controls.maxDistance = maxDistance;
  }

  /**
   * Smoothly move camera to focus on a planet.
   * @param {THREE.Vector3} targetPosition - The planet's current world position.
   * @param {number} displayRadius - The planet's display radius for calculating view distance.
   */
  focusPlanet(targetPosition, displayRadius) {
    this._focusTarget = targetPosition.clone();
    const offset = new THREE.Vector3(displayRadius * 3, displayRadius * 2, displayRadius * 3);
    this._focusCameraPos = targetPosition.clone().add(offset);
    this._isFocusing = true;
    this._isResetting = false;
    this._focusProgress = 0;

    // Adjust controls distance limits based on object size
    if (displayRadius <= 8) {
      this.controls.minDistance = 5;
      this.controls.maxDistance = 100;
    } else if (displayRadius >= 60) {
      this.controls.minDistance = displayRadius * 1.5;
      this.controls.maxDistance = displayRadius * 10;
    } else {
      this.controls.minDistance = 20;
      this.controls.maxDistance = 300;
    }
  }

  /**
   * Advance the smooth camera reset/focus animations by one frame. Extracted
   * from the old self-driven loop; ViewManager now owns the single rAF loop and
   * calls this from SolarSystemView.update(). Renderer/perf/render are ViewManager's.
   * @param {number} delta - Frame delta in seconds (accepted for parity; the
   *   ease uses a fixed per-frame step to match the pre-refactor feel).
   */
  stepCamera(delta) {
    // Handle smooth camera reset
    if (this._isResetting && this._resetTarget) {
      this._resetProgress += 0.03;
      const t = Math.min(this._resetProgress, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      this.camera.position.lerp(this._resetTarget, ease);
      this.controls.target.lerp(this._resetLookAt, ease);

      if (t >= 1) {
        this._isResetting = false;
        this._resetProgress = 0;
      }
    }

    // Handle smooth camera focus on planet
    if (this._isFocusing && this._focusTarget) {
      this._focusProgress += 0.03;
      const t = Math.min(this._focusProgress, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      this.camera.position.lerp(this._focusCameraPos, ease);
      this.controls.target.lerp(this._focusTarget, ease);

      if (t >= 1) {
        this._isFocusing = false;
        this._focusProgress = 0;
      }
    }
  }

  /**
   * Render the given scene/camera through the shared pipeline. Uses the plain
   * renderer once mobile-degraded (REQ-018), otherwise the multisampled composer
   * (whose renderPass/outlinePass ViewManager has already retargeted).
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  render(scene, camera) {
    if (this._degraded) {
      this.renderer.render(scene, camera);
    } else {
      this.composer.render();
    }
  }

  /**
   * Clean up renderer/composer/controls. The window resize listener lives on
   * ViewManager now, so nothing to unbind here.
   */
  dispose() {
    this.controls.dispose();
    this.renderer.dispose();
    this.composer.dispose();
  }
}
