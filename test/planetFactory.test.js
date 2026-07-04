import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PlanetFactory } from '../src/planets/PlanetFactory.js';

// Stub SceneManager: PlanetFactory only reaches for renderer.capabilities for anisotropy.
const stubSceneManager = () => ({
  renderer: { capabilities: { getMaxAnisotropy: () => 16 } },
  setHoveredObject: () => {},
});

describe('PlanetFactory material assignment (F3 relight, REQ-280)', () => {
  let factory;
  beforeEach(() => {
    factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
  });

  it('renders planets and dwarfs with lit MeshStandardMaterial', () => {
    for (const key of ['earth', 'mars', 'jupiter', 'ceres', 'pluto', 'eris']) {
      const mat = factory.planets[key].mesh.material;
      expect(mat.isMeshStandardMaterial, key).toBe(true);
    }
  });

  it('keeps the Sun and starfield as emissive MeshBasicMaterial', () => {
    expect(factory.planets.sun.mesh.material.isMeshBasicMaterial).toBe(true);
    const starfield = factory.scene.children.find((o) => o.material?.map && o.material.side === THREE.BackSide);
    expect(starfield.material.isMeshBasicMaterial).toBe(true);
  });

  it('relights satellites (textured and flat) and Earth clouds', () => {
    expect(factory.planets.moon.mesh.material.isMeshStandardMaterial).toBe(true); // textured moon
    expect(factory.planets.io.mesh.material.isMeshStandardMaterial).toBe(true); // flat-color moon
    expect(factory.earthClouds.material.isMeshStandardMaterial).toBe(true);
  });
});

describe('PlanetFactory flat-color texture fallback (F1, TASK-002)', () => {
  let factory;
  beforeEach(() => {
    factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
  });

  it('keeps the flat fallback color when the texture file is missing', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    let onErr;
    factory.textureLoader = { load: (_p, _ok, _prog, err) => { onErr = err; } };

    factory._applyPlanetTexture(material, 'ceres', 0x8c8377);
    onErr(); // simulate 404 for the not-yet-shipped dwarf texture

    expect(material.map).toBeNull();
    expect(material.color.getHex()).toBe(0x8c8377);
  });

  it('swaps in the texture (sRGB + max anisotropy) when the file loads', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0x8c8377 });
    let onLoad;
    factory.textureLoader = { load: (_p, ok) => { onLoad = ok; } };

    factory._applyPlanetTexture(material, 'ceres', 0x8c8377);
    const texture = {};
    onLoad(texture);

    expect(material.map).toBe(texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(texture.anisotropy).toBe(16);
    expect(material.color.getHex()).toBe(0xffffff); // texture must not be tinted by the fallback
  });
});

describe('PlanetFactory focus: hi-res tier + LOD (REQ-290, REQ-220, TASK-009/010)', () => {
  let factory;
  beforeEach(() => {
    factory = new PlanetFactory(new THREE.Scene(), stubSceneManager());
  });

  it('lazy-loads a hero body hi-res texture exactly once on focus', () => {
    const loaded = [];
    factory.textureLoader = { load: (p) => loaded.push(p) };
    factory.onFocus('earth');
    factory.onFocus('earth'); // repeat focus must not reload
    expect(loaded).toEqual(['textures/2k_earth_daymap.jpg']);
    expect(factory.tierManager.isUpgraded('earth')).toBe(true);
  });

  it('does not lazy-load a body that has no hi-res tier', () => {
    const loaded = [];
    factory.textureLoader = { load: (p) => loaded.push(p) };
    factory.onFocus('mercury');
    expect(loaded).toEqual([]);
  });

  it('raises the focused body LOD and restores it exactly on defocus', () => {
    const base = factory.planets.earth.mesh.geometry.parameters.widthSegments;
    factory.onFocus('earth');
    expect(factory.planets.earth.mesh.geometry.parameters.widthSegments).toBe(128);
    factory.onDefocus();
    expect(factory.planets.earth.mesh.geometry.parameters.widthSegments).toBe(base);
  });

  it('skips the LOD upgrade when the device disables it (REQ-230)', () => {
    factory.sceneManager.lodUpgradesDisabled = true;
    const base = factory.planets.earth.mesh.geometry.parameters.widthSegments;
    factory.onFocus('earth');
    expect(factory.planets.earth.mesh.geometry.parameters.widthSegments).toBe(base);
  });
});
