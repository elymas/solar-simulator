import * as THREE from 'three';

/**
 * InteractionManager handles raycasting, hover effects, and click/touch events
 * for selecting celestial bodies in the scene.
 */
export class InteractionManager {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer
   * @param {import('../planets/PlanetFactory.js').PlanetFactory} planetFactory
   */
  constructor(camera, scene, renderer, planetFactory) {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    this.planetFactory = planetFactory;

    this.hoveredPlanet = null;
    this.selectedPlanet = null;
    this.onSelect = null;
    this.onDeselect = null;

    // Build clickable mesh list with collision helpers
    this._collisionHelpers = [];
    this._meshToKeyMap = new Map();
    this._buildClickTargets();

    // Bind event handlers
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('click', this._onClick);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
  }

  /**
   * Build invisible collision spheres for small planets and map meshes to keys.
   * Raycasting uses these helpers for reliable selection of small bodies.
   */
  _buildClickTargets() {
    const MIN_HIT_RADIUS = 8;

    for (const [key, planet] of Object.entries(this.planetFactory.planets)) {
      const { mesh, data } = planet;

      this._meshToKeyMap.set(mesh.uuid, key);

      if (data.displayRadius < MIN_HIT_RADIUS) {
        // Create an invisible, larger collision sphere as a child of the planet mesh
        const helperGeo = new THREE.SphereGeometry(MIN_HIT_RADIUS, 8, 8);
        const helperMat = new THREE.MeshBasicMaterial({
          visible: false,
          transparent: true,
          opacity: 0,
        });
        const helper = new THREE.Mesh(helperGeo, helperMat);
        helper.name = `${key}_hitHelper`;
        mesh.add(helper);

        this._meshToKeyMap.set(helper.uuid, key);
        this._collisionHelpers.push(helper);
      }
    }
  }

  /**
   * Collect all meshes (and their collision helpers) that can be clicked.
   * Excludes orbit lines, starfield, and other non-interactive objects.
   * @returns {THREE.Mesh[]}
   */
  _getClickableMeshes() {
    const meshes = [];

    for (const [key, planet] of Object.entries(this.planetFactory.planets)) {
      const { mesh, data } = planet;

      // If the planet has a collision helper, use that for raycasting
      if (data.displayRadius < 8) {
        const helper = mesh.children.find((c) => c.name === `${key}_hitHelper`);
        if (helper) {
          meshes.push(helper);
          continue;
        }
      }

      meshes.push(mesh);
    }

    return meshes;
  }

  /**
   * Normalize mouse/touch coordinates to NDC (-1..1).
   * @param {number} clientX
   * @param {number} clientY
   */
  _normalizeCoords(clientX, clientY) {
    this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  /**
   * Perform raycast and return the planet key if hit.
   * @returns {string|null}
   */
  _raycastPlanet() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this._getClickableMeshes();
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      return this._meshToKeyMap.get(hitMesh.uuid) || null;
    }

    return null;
  }

  /**
   * Handle mouse movement for hover state and cursor changes.
   * @param {MouseEvent} event
   */
  _onMouseMove(event) {
    this._normalizeCoords(event.clientX, event.clientY);
    const key = this._raycastPlanet();

    if (key) {
      this.hoveredPlanet = key;
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.hoveredPlanet = null;
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  /**
   * Handle click to select or deselect a planet.
   * @param {MouseEvent} event
   */
  _onClick(event) {
    // Ignore clicks on UI elements
    if (event.target !== this.renderer.domElement) return;

    this._normalizeCoords(event.clientX, event.clientY);
    const key = this._raycastPlanet();

    if (key) {
      this.selectedPlanet = key;
      if (this.onSelect) {
        this.onSelect(key);
      }
    } else {
      if (this.selectedPlanet) {
        this.selectedPlanet = null;
        if (this.onDeselect) {
          this.onDeselect();
        }
      }
    }
  }

  /**
   * Handle touch events for mobile planet selection.
   * @param {TouchEvent} event
   */
  _onTouchStart(event) {
    if (event.target !== this.renderer.domElement) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    this._normalizeCoords(touch.clientX, touch.clientY);
    const key = this._raycastPlanet();

    if (key) {
      this.selectedPlanet = key;
      if (this.onSelect) {
        this.onSelect(key);
      }
    }
  }

  /**
   * Clean up event listeners.
   */
  dispose() {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('click', this._onClick);
    canvas.removeEventListener('touchstart', this._onTouchStart);
  }
}
