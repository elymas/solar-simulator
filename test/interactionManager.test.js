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
