import * as THREE from 'three';

// How far a finger may travel between touchstart and touchend and still count as
// a tap (REQ-MOB-102). Deliberately wider than the mouse path's 5px: a small
// finger wobbles on contact far more than a mouse does, and 8px is still an order
// of magnitude below any intentional orbit drag.
export const TOUCH_TAP_MAX_DRAG_PX = 8;

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
    // Picking is gated so SolarSystemView can silence it while the Earth view
    // owns the shared canvas — otherwise both views' listeners fire on one canvas.
    this.enabled = true;

    // Build clickable mesh list with collision helpers
    this._collisionHelpers = [];
    this._meshToKeyMap = new Map();
    this._buildClickTargets();
    this._createTooltip();

    // A drag-to-orbit gesture (OrbitControls) still ends in a native 'click' on
    // mouseup, at whatever screen position the drag left the cursor at. Track
    // where the mouse went down so _onClick can tell "orbited the camera" apart
    // from "clicked/tapped a body" instead of misreading every orbit as a
    // deselect that snaps the camera back to the default Sun-facing view.
    this._pointerDownPos = null;

    // Touch mirrors that guard (REQ-MOB-101..104): where the finger went down, or
    // null once the gesture is disqualified (second finger, cancel, tap consumed).
    this._touchStartPos = null;

    // Bind event handlers
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onTouchCancel = this._onTouchCancel.bind(this);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('click', this._onClick);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd);
    canvas.addEventListener('touchcancel', this._onTouchCancel);
  }

  /**
   * Build invisible collision spheres for small planets and map meshes to keys.
   * Raycasting uses these helpers for reliable selection of small bodies.
   */
  _buildClickTargets() {
    const MIN_HIT_RADIUS = 8;

    for (const [key, planet] of Object.entries(this.planetFactory.planets)) {
      const { mesh, data, isStar } = planet;

      this._meshToKeyMap.set(mesh.uuid, key);

      // ponytail: background stars use an artistically oversized displayRadius
      // (e.g. Stephenson 2-18 = 300) so their real mesh makes a giant hit sphere
      // that swallows hover/click near unrelated foreground planets. Point-size
      // their hitbox like small bodies instead of raycasting the huge mesh.
      if (isStar || data.displayRadius < MIN_HIT_RADIUS) {
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
   * Create the hover tooltip DOM element.
   */
  _createTooltip() {
    const style = document.createElement('style');
    style.textContent = `
      .planet-tooltip {
        position: fixed;
        pointer-events: none;
        background: rgba(26, 26, 46, 0.9);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        border: 1px solid rgba(22, 199, 255, 0.3);
        border-radius: 6px;
        padding: 4px 10px;
        font-family: 'Inter Variable', sans-serif;
        font-size: 13px;
        color: #e0e0e0;
        white-space: nowrap;
        z-index: 200;
        opacity: 0;
        transition: opacity 0.15s;
        transform: translate(-50%, -100%);
      }
      .planet-tooltip.visible {
        opacity: 1;
      }
      /* Korean is the primary label, English the secondary one (REQ-KIDS-101),
         matching the planet list and the InfoPanel header. */
      .planet-tooltip-nameko {
        color: #16c7ff;
        font-weight: 500;
      }
      .planet-tooltip-name {
        color: #888;
        font-size: 11px;
        margin-left: 6px;
      }
    `;
    document.head.appendChild(style);

    this._tooltip = document.createElement('div');
    this._tooltip.className = 'planet-tooltip';
    document.body.appendChild(this._tooltip);
  }

  /**
   * Show tooltip near the cursor for the hovered planet.
   * @param {string} key - Planet/star key.
   * @param {number} clientX - Mouse X position.
   * @param {number} clientY - Mouse Y position.
   */
  _showTooltip(key, clientX, clientY) {
    const planet = this.planetFactory.planets[key];
    if (!planet) return;

    const data = planet.data;
    const name = data.name || key;
    const nameKo = data.nameKo || '';

    // Korean leads. The English secondary is dropped when it would just repeat
    // the primary, so a star whose nameKo is its English name shows one word.
    const primary = nameKo || name;
    const secondary = primary === name ? '' : name;
    const span = (className, text) => {
      const el = document.createElement('span');
      el.className = className;
      el.textContent = text; // never innerHTML: body text may come from an API later
      return el;
    };
    this._tooltip.replaceChildren(span('planet-tooltip-nameko', primary));
    if (secondary) this._tooltip.append(span('planet-tooltip-name', secondary));
    this._tooltip.style.left = `${clientX}px`;
    this._tooltip.style.top = `${clientY - 12}px`;
    this._tooltip.classList.add('visible');
  }

  /**
   * Hide the tooltip.
   */
  _hideTooltip() {
    this._tooltip.classList.remove('visible');
  }

  /**
   * Collect all meshes (and their collision helpers) that can be clicked.
   * Excludes orbit lines, starfield, and other non-interactive objects.
   * @returns {THREE.Mesh[]}
   */
  _getClickableMeshes() {
    const meshes = [];

    for (const [key, planet] of Object.entries(this.planetFactory.planets)) {
      const { mesh, data, isStar } = planet;

      // If the planet has a collision helper, use that for raycasting
      if (isStar || data.displayRadius < 8) {
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
    if (!this.enabled) return;
    this._normalizeCoords(event.clientX, event.clientY);
    const key = this._raycastPlanet();

    if (key) {
      this.hoveredPlanet = key;
      this.renderer.domElement.style.cursor = 'pointer';
      this._showTooltip(key, event.clientX, event.clientY);
      this.planetFactory.sceneManager.setHoveredObject(this.planetFactory.planets[key]?.mesh || null);
    } else {
      this.hoveredPlanet = null;
      this.renderer.domElement.style.cursor = 'default';
      this._hideTooltip();
      this.planetFactory.sceneManager.setHoveredObject(null);
    }
  }

  /**
   * Record where the mouse went down, to distinguish an orbit-drag from a click.
   * @param {PointerEvent} event
   */
  _onPointerDown(event) {
    this._pointerDownPos = { x: event.clientX, y: event.clientY };
  }

  /**
   * Handle click to select or deselect a planet.
   * @param {MouseEvent} event
   */
  _onClick(event) {
    if (!this.enabled) return;
    // Ignore clicks on UI elements
    if (event.target !== this.renderer.domElement) return;

    // Camera-orbit drags fire a native 'click' on release too; only treat this
    // as a real click if the cursor barely moved since mousedown.
    if (this._pointerDownPos) {
      const dx = event.clientX - this._pointerDownPos.x;
      const dy = event.clientY - this._pointerDownPos.y;
      const dragDistance = Math.hypot(dx, dy);
      this._pointerDownPos = null;
      if (dragDistance > 5) return;
    }

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
   * Record where a single finger went down. Selection deliberately does NOT happen
   * here (REQ-MOB-101) — deciding on touchstart made every orbit drag that began
   * on a body select and fly to it.
   * @param {TouchEvent} event
   */
  _onTouchStart(event) {
    // A second finger (pinch/two-finger orbit) disqualifies the whole gesture,
    // including the tap the first finger had already started.
    if (event.touches.length !== 1) {
      this._touchStartPos = null;
      return;
    }
    if (!this.enabled) return;
    if (event.target !== this.renderer.domElement) return;

    const touch = event.touches[0];
    this._touchStartPos = { x: touch.clientX, y: touch.clientY };
  }

  /**
   * Select (or deselect) on finger-lift, when the gesture was a tap rather than an
   * orbit drag — the touch counterpart of _onClick's drag guard.
   * @param {TouchEvent} event
   */
  _onTouchEnd(event) {
    const start = this._touchStartPos;
    this._touchStartPos = null;

    if (!this.enabled) return;
    if (!start) return; // gesture was disqualified, or never started on the canvas
    if (event.touches.length > 0) return; // other fingers still down: not a tap

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    // Displacement is measured start->end, not along the path, so a finger that
    // wanders off a body and comes back still counts as a tap (acceptance.md §3).
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.hypot(dx, dy) > TOUCH_TAP_MAX_DRAG_PX) return;

    this._normalizeCoords(touch.clientX, touch.clientY);
    const key = this._raycastPlanet();

    if (key) {
      this.selectedPlanet = key;
      if (this.onSelect) {
        this.onSelect(key);
      }
    } else if (this.selectedPlanet) {
      // Empty-space tap clears the selection, matching the mouse path — without
      // this the touch path stranded kids inside a focused body.
      this.selectedPlanet = null;
      if (this.onDeselect) {
        this.onDeselect();
      }
    }
  }

  /**
   * Drop the pending tap when the system takes the gesture away (notification,
   * edge swipe, orientation change) so the next touch starts clean.
   */
  _onTouchCancel() {
    this._touchStartPos = null;
  }

  /**
   * Clean up event listeners.
   */
  dispose() {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('pointerdown', this._onPointerDown);
    canvas.removeEventListener('click', this._onClick);
    canvas.removeEventListener('touchstart', this._onTouchStart);
    canvas.removeEventListener('touchend', this._onTouchEnd);
    canvas.removeEventListener('touchcancel', this._onTouchCancel);
  }
}
