import { LoadingScreen } from './ui/LoadingScreen.js';
import { SceneManager } from './scene/SceneManager.js';
import { PlanetFactory } from './planets/PlanetFactory.js';
import { InteractionManager } from './controls/InteractionManager.js';
import { InfoPanel } from './ui/InfoPanel.js';
import { TimeControls } from './ui/TimeControls.js';

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

/**
 * Initialize UI components after all textures have loaded.
 * This keeps the interface hidden during the loading phase.
 */
function initUI() {
  const infoPanel = new InfoPanel();
  const timeControls = new TimeControls(window.__solarSim);

  const interaction = new InteractionManager(
    sceneManager.camera,
    sceneManager.scene,
    sceneManager.renderer,
    planetFactory
  );

  // Wire up planet selection callbacks
  interaction.onSelect = (key) => {
    const planet = planetFactory.planets[key];
    if (planet) {
      infoPanel.show(key, planet.data);
    }
  };

  interaction.onDeselect = () => {
    infoPanel.hide();
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
      sceneManager.resetCamera();
    }

    // Escape: close info panel and deselect planet
    if (e.code === 'Escape') {
      infoPanel.hide();
      interaction.selectedPlanet = null;
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

  // Update time controls date display every frame (if initialized)
  if (window.__solarSim._timeControls) {
    window.__solarSim._timeControls.updateDate(simulationTime);
  }
});
