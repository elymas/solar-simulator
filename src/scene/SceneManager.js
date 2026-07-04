import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COLOR_PALETTE, CAMERA_DEFAULTS, CONTROLS_DEFAULTS, BLOOM_DEFAULTS } from '../utils/constants.js';
import { shouldDegrade } from '../utils/performance.js';

/**
 * SceneManager handles the Three.js scene, renderer, camera, controls,
 * lighting, and post-processing (bloom effect for Sun glow).
 */
export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this._initRenderer();
    this._initCamera();
    this._initControls();
    this._initLighting();
    this._initPostProcessing();
    this._initResizeHandler();
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
    this.renderer.toneMapping = THREE.NoToneMapping;
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
    const ambientLight = new THREE.AmbientLight(0x606060, 0.8);
    this.scene.add(ambientLight);

    const sunLight = new THREE.PointLight(0xffffff, 1.5, 0, 0.5);
    sunLight.position.set(0, 0, 0);
    this.scene.add(sunLight);
  }

  /**
   * Initialize post-processing pipeline with bloom effect for Sun glow.
   */
  _initPostProcessing() {
    const { strength, radius, threshold } = BLOOM_DEFAULTS;
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);

    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

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
   * Handle window resize to maintain correct aspect ratio.
   */
  _initResizeHandler() {
    this._onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);
    };
    window.addEventListener('resize', this._onResize);
  }

  /**
   * Detect mobile or low-end devices and reduce rendering quality
   * to maintain acceptable frame rates.
   */
  _detectPerformance() {
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isLowEnd = navigator.hardwareConcurrency <= 4;

    if (this.isMobile || isLowEnd) {
      this.renderer.setPixelRatio(1);
      this.bloomPass.strength = 0.4;
      this.bloomPass.radius = 0.15;
    }

    // Live degradation (REQ-018): sustained sub-30fps on mobile drops post-processing.
    this._fpsSamples = [];
    this._degraded = false;
    this._perfWindow = 90;
    this._perfThresholdFps = 30;
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
   * Start the animation loop using the post-processing composer.
   * @param {Function} onUpdate - Callback invoked each frame with delta time.
   */
  start(onUpdate) {
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = this.clock.getDelta();

      if (onUpdate) {
        onUpdate(delta);
      }

      // Handle smooth camera reset
      if (this._isResetting && this._resetTarget) {
        this._resetProgress += 0.03;
        const t = Math.min(this._resetProgress, 1);
        // Ease-out cubic
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

      this._monitorPerformance(delta);

      this.controls.update();
      if (this._degraded) {
        this.renderer.render(this.scene, this.camera);
      } else {
        this.composer.render();
      }
    };

    animate();
  }

  /**
   * Clean up resources and event listeners.
   */
  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.composer.dispose();
  }
}
