import * as THREE from 'three';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { SceneManager } from './scene/SceneManager.js';
import { PlanetFactory } from './planets/PlanetFactory.js';
import { InteractionManager } from './controls/InteractionManager.js';
import { InfoPanel } from './ui/InfoPanel.js';
import { TimeControls } from './ui/TimeControls.js';
import { PlanetList } from './ui/PlanetList.js';

// Create loading screen FIRST, before anything else
const loadingScreen = new LoadingScreen();

// Initialize the scene manager with renderer, camera, controls, lighting, and bloom
const sceneManager = new SceneManager();

// Simulation state
let simulationTime = 0; // in days
let timeSpeed = 1; // days per second
let isPlaying = true;

// Export simulation controls for UI integration
window.__solarSim = {
  sceneManager,
  planetFactory: null, // set after creation
  getSimTime: () => simulationTime,
  setSimTime: (t) => { simulationTime = t; },
  setTimeSpeed: (s) => { timeSpeed = s; },
  getTimeSpeed: () => timeSpeed,
  togglePlay: () => { isPlaying = !isPlaying; },
  isPlaying: () => isPlaying,
};

// Create planet factory (textures start loading via LoadingManager)
const planetFactory = new PlanetFactory(sceneManager.scene, sceneManager);
window.__solarSim.planetFactory = planetFactory;

// Wire loading callbacks
planetFactory.onLoadProgress = (loaded, total) => {
  loadingScreen.updateProgress(loaded, total);
};

planetFactory.onLoadComplete = () => {
  loadingScreen.hide();
  initUI();
};

// Track which planet is focused for camera following
let focusedPlanetKey = null;

/**
 * Focus the camera on a planet by key.
 * @param {string} key - Planet key to focus on.
 * @param {InfoPanel} infoPanel - Info panel instance.
 * @param {PlanetList} planetList - Planet list instance.
 * @param {InteractionManager} interaction - Interaction manager instance.
 */
function selectPlanet(key, infoPanel, planetList, interaction) {
  const planet = planetFactory.planets[key];
  if (!planet) return;

  infoPanel.show(key, planet.data);
  planetList.setActive(key);
  interaction.selectedPlanet = key;
  focusedPlanetKey = key;

  sceneManager.focusPlanet(planet.mesh.position, planet.data.displayRadius);
}

/**
 * Deselect the current planet and return to overview.
 * @param {InfoPanel} infoPanel - Info panel instance.
 * @param {PlanetList} planetList - Planet list instance.
 * @param {InteractionManager} interaction - Interaction manager instance.
 */
function deselectPlanet(infoPanel, planetList, interaction) {
  infoPanel.hide();
  planetList.clearActive();
  interaction.selectedPlanet = null;
  focusedPlanetKey = null;
  sceneManager.resetCamera();
}

/**
 * Initialize UI components after all textures have loaded.
 * This keeps the interface hidden during the loading phase.
 */
function initUI() {
  const infoPanel = new InfoPanel();
  const timeControls = new TimeControls(window.__solarSim);
  const planetList = new PlanetList();

  const interaction = new InteractionManager(
    sceneManager.camera,
    sceneManager.scene,
    sceneManager.renderer,
    planetFactory
  );

  // Wire up planet list selection
  planetList.onSelect = (key) => {
    selectPlanet(key, infoPanel, planetList, interaction);
  };

  // Wire up planet selection callbacks (click on 3D scene)
  interaction.onSelect = (key) => {
    selectPlanet(key, infoPanel, planetList, interaction);
  };

  interaction.onDeselect = () => {
    deselectPlanet(infoPanel, planetList, interaction);
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Space: toggle play/pause
    if (e.code === 'Space') {
      e.preventDefault();
      window.__solarSim.togglePlay();
      timeControls.updatePlayButton();
    }

    // R: reset camera to default position
    if (e.code === 'KeyR') {
      deselectPlanet(infoPanel, planetList, interaction);
    }

    // Escape: close info panel and deselect planet
    if (e.code === 'Escape') {
      deselectPlanet(infoPanel, planetList, interaction);
    }

    // Home: reset simulation time to start
    if (e.code === 'Home') {
      e.preventDefault();
      simulationTime = 0;
      timeControls.updateDate(0);
    }
  });

  // Store references for the animation loop
  window.__solarSim._timeControls = timeControls;
}

// Start the animation loop
sceneManager.start((delta) => {
  if (isPlaying) {
    simulationTime += delta * timeSpeed;
    planetFactory.update(simulationTime, delta);
  }

  // Track focused planet position so controls.target follows the orbiting body
  if (focusedPlanetKey) {
    const planet = planetFactory.planets[focusedPlanetKey];
    if (planet) {
      // For satellites with pivots, get world position
      if (planet.pivot) {
        const worldPos = new THREE.Vector3();
        planet.mesh.getWorldPosition(worldPos);
        sceneManager.controls.target.copy(worldPos);
      } else {
        sceneManager.controls.target.copy(planet.mesh.position);
      }
    }
  }

  // Update time controls date display every frame (if initialized)
  if (window.__solarSim._timeControls) {
    window.__solarSim._timeControls.updateDate(simulationTime);
  }
});
