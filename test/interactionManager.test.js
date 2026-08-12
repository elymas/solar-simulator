import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlanetFactory } from '../src/planets/PlanetFactory.js';
import { InteractionManager } from '../src/controls/InteractionManager.js';

// Stub SceneManager: PlanetFactory only reaches for renderer.capabilities for anisotropy.
const stubSceneManager = () => ({
  renderer: { capabilities: { getMaxAnisotropy: () => 16 } },
  setHoveredObject: () => {},
});

const stubRenderer = () => ({
  domElement: { addEventListener: () => {}, removeEventListener: () => {} },
});

describe('InteractionManager star hitbox (bug: hover near Earth shows Stephenson 2-18)', () => {
  it('caps background stars to a point-sized hit helper instead of their oversized display mesh', () => {
    const factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000);
    const interaction = new InteractionManager(camera, factory.scene, stubRenderer(), factory);

    const clickable = interaction._getClickableMeshes();
    const starHit = clickable.find((m) => interaction._meshToKeyMap.get(m.uuid) === 'stephenson2_18');

    expect(starHit.name).toBe('stephenson2_18_hitHelper');
    expect(starHit.geometry.parameters.radius).toBe(8);
    // The real display mesh (radius 300) must never be raycast directly.
    expect(clickable).not.toContain(factory.planets.stephenson2_18.mesh);
  });
});

describe('InteractionManager drag-vs-click (bug: orbit-drag snapped camera back to the Sun)', () => {
  it('ignores a click that lands far from where the pointer went down (an orbit drag)', () => {
    const factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000);
    const renderer = stubRenderer();
    const interaction = new InteractionManager(camera, factory.scene, renderer, factory);

    let deselected = false;
    interaction.onDeselect = () => { deselected = true; };
    interaction.selectedPlanet = 'earth'; // simulates a body already focused

    interaction._onPointerDown({ clientX: 100, clientY: 100 });
    // Mouseup 80px away from mousedown: an orbit drag, not a click — the
    // resulting native 'click' event must not deselect/reset the camera.
    interaction._onClick({ clientX: 180, clientY: 100, target: renderer.domElement });

    expect(deselected).toBe(false);
    expect(interaction.selectedPlanet).toBe('earth');
  });

  it('still deselects on a genuine click (pointer barely moved) that misses every body', () => {
    const factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000);
    const renderer = stubRenderer();
    const interaction = new InteractionManager(camera, factory.scene, renderer, factory);

    let deselected = false;
    interaction.onDeselect = () => { deselected = true; };
    interaction.selectedPlanet = 'earth';

    interaction._onPointerDown({ clientX: 100, clientY: 100 });
    interaction._onClick({ clientX: 102, clientY: 101, target: renderer.domElement });

    expect(deselected).toBe(true);
    expect(interaction.selectedPlanet).toBeNull();
  });
});

// SPEC-MOBILE-001 M1 — reproduction-first evidence (AC-MOB-101). The touch path
// selected on `touchstart`, so a child planting a finger on a body to spin the
// camera selected and flew to it before the drag had even begun.
describe('InteractionManager touch selection (SPEC-MOBILE-001)', () => {
  // jsdom TouchEvent construction is unreliable, and the guard logic — not the DOM
  // plumbing — is the unit under test, so hand-built events go straight to the
  // handler seam. Shapes mirror the real ones: on touchend the lifted finger is in
  // changedTouches and `touches` holds only the fingers still down.
  const touchSetup = () => {
    const factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000);
    const renderer = stubRenderer();
    const interaction = new InteractionManager(camera, factory.scene, renderer, factory);
    const at = (x, y) => ({ clientX: x, clientY: y });
    const start = (...pts) => ({ target: renderer.domElement, touches: pts.map(([x, y]) => at(x, y)) });
    const end = (x, y, remaining = []) => ({
      target: renderer.domElement,
      touches: remaining.map(([rx, ry]) => at(rx, ry)),
      changedTouches: [at(x, y)],
    });
    return { interaction, start, end };
  };

  it('does not select a body when a single-finger drag passes over it (the defect)', () => {
    const { interaction, start, end } = touchSetup();
    interaction._raycastPlanet = () => 'mars';
    const selected = [];
    interaction.onSelect = (key) => { selected.push(key); };

    interaction._onTouchStart(start([100, 100]));
    // The defect lived here: selection fired on touchstart, before the finger moved.
    expect(selected).toEqual([]);

    interaction._onTouchEnd(end(130, 100)); // 30px orbit drag, then lift
    expect(selected).toEqual([]);
    expect(interaction.selectedPlanet).toBeNull();
  });
});

describe('InteractionManager tooltip is Korean-first (REQ-KIDS-101, AC-KIDS-101)', () => {
  const hover = (key) => {
    const factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000);
    const interaction = new InteractionManager(camera, factory.scene, stubRenderer(), factory);
    interaction._showTooltip(key, 100, 100);
    return interaction._tooltip;
  };
  const size = (el) => parseFloat(getComputedStyle(el).fontSize);

  it('puts the Korean name first and the English name second', () => {
    const tip = hover('mars');
    const spans = tip.querySelectorAll('span');
    expect(spans[0].textContent).toBe('화성');
    expect(spans[1].textContent).toBe('Mars');
  });

  // Queried by class, not position, so this stays meaningful whatever the order.
  it('renders the Korean name strictly larger than the English secondary', () => {
    const tip = hover('mars');
    const ko = tip.querySelector('.planet-tooltip-nameko');
    const en = tip.querySelector('.planet-tooltip-name');
    expect(size(ko)).toBeGreaterThan(size(en));
  });

  it('does not repeat the word when nameKo equals the English name', () => {
    const factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100000);
    const interaction = new InteractionManager(camera, factory.scene, stubRenderer(), factory);
    factory.planets.mars.data = { name: 'Mars', nameKo: 'Mars' };
    interaction._showTooltip('mars', 100, 100);

    expect(interaction._tooltip.querySelectorAll('span')).toHaveLength(1);
    expect(interaction._tooltip.textContent).toBe('Mars');
  });
});
