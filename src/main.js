import { LoadingScreen } from './ui/LoadingScreen.js';
import { SceneManager } from './scene/SceneManager.js';
import { SolarSystemView } from './views/SolarSystemView.js';
import { EarthView } from './earth/EarthView.js';
import { ViewManager } from './core/ViewManager.js';

// Create loading screen FIRST, before anything else.
const loadingScreen = new LoadingScreen();

// SceneManager constructs the ONE WebGLRenderer + EffectComposer for the whole
// app; SolarSystemView owns it and lends it to ViewManager / EarthView (REQ-385).
const sceneManager = new SceneManager();

const solarView = new SolarSystemView({ sceneManager });
solarView.onLoadProgress = (loaded, total) => loadingScreen.updateProgress(loaded, total);
solarView.onLoadComplete = () => loadingScreen.hide();

// Share the ONE sim clock: EarthView reads + advances solarView.simApi while
// active, keeping both views on a single timeline (SPEC-EARTH-002 F6).
const earthView = new EarthView({
  isMobile: sceneManager.isMobile,
  isLowEnd: sceneManager.lowEnd,
  simApi: solarView.simApi,
});

// ViewManager replaces main.js's old god-loop: it drives the single rAF loop, the
// SOLAR/EARTH state machine, hash routing, transitions, and context-loss handling.
const viewManager = new ViewManager({ solarView, earthView });
viewManager.start();
