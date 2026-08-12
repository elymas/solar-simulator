import { setMuted, isMuted } from '../audio/tts.js';
import { STR, formatKoDate } from './strings.js';

/**
 * TimeControls provides a fixed bottom control bar with play/pause,
 * logarithmic speed slider, and simulation date display.
 */
export class TimeControls {
  /**
   * @param {Object} simApi - Simulation control API (SolarSystemView.simApi):
   *   getSimTime/setSimTime/setTimeSpeed/getTimeSpeed/togglePlay/isPlaying.
   */
  constructor(simApi) {
    this.simApi = simApi;
    this.startDate = new Date('2026-03-30T00:00:00Z');
    this._injectStyles();
    this._createDOM();
    this._bindEvents();
  }

  /**
   * Inject CSS styles for the time controls into the document head.
   */
  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .time-controls {
        position: fixed;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 20px;
        background: rgba(26, 26, 46, 0.9);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(22, 199, 255, 0.15);
        border-bottom: none;
        border-radius: 12px 12px 0 0;
        padding: 12px 24px;
        z-index: 100;
        font-family: 'Inter', sans-serif;
        user-select: none;
      }
      .control-btn {
        background: rgba(22, 199, 255, 0.15);
        border: 1px solid rgba(22, 199, 255, 0.3);
        color: #16c7ff;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .control-btn:hover {
        background: rgba(22, 199, 255, 0.25);
      }
      .speed-control {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .speed-label {
        font-size: 12px;
        color: #888;
      }
      .speed-value {
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        color: #16c7ff;
        min-width: 50px;
        text-align: right;
      }
      #speed-slider {
        width: 150px;
        accent-color: #16c7ff;
      }
      .date-display {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .date-label {
        font-size: 12px;
        color: #888;
      }
      .sim-date {
        /* Korean tail: the date now reads "2026년 3월 30일", and JetBrains Mono
           carries no Hangul glyphs. */
        font-family: 'JetBrains Mono', 'Apple SD Gothic Neo', 'Noto Sans KR', monospace;
        font-size: 14px;
        color: #e0e0e0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create the DOM structure for the time controls bar.
   */
  _createDOM() {
    this.el = document.createElement('div');
    this.el.id = 'time-controls';
    this.el.className = 'time-controls';

    this.el.innerHTML = `
      <button id="play-pause-btn" class="control-btn" title="${STR.timePlayPause}" aria-label="${STR.timePlayPause}">
        <span class="play-icon">&#9654;</span>
        <span class="pause-icon">&#9646;&#9646;</span>
      </button>
      <button id="reset-btn" class="control-btn" title="${STR.timeReset}" aria-label="${STR.timeReset}">&#8634;</button>
      <button id="mute-btn" class="control-btn"></button>
      <div class="speed-control">
        <label class="speed-label">${STR.timeSpeed}</label>
        <input type="range" id="speed-slider" min="-2" max="2.7" step="0.01" value="0" aria-label="${STR.timeSpeed}" />
        <span id="speed-value" class="speed-value">1x</span>
      </div>
      <div class="date-display">
        <span class="date-label">${STR.timeDate}</span>
        <span id="sim-date" class="sim-date">${formatKoDate(this.startDate)}</span>
      </div>
    `;

    // Prevent events from propagating to the 3D canvas
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('touchstart', (e) => e.stopPropagation());

    document.body.appendChild(this.el);

    // Cache DOM references
    this.playPauseBtn = this.el.querySelector('#play-pause-btn');
    this.resetBtn = this.el.querySelector('#reset-btn');
    this.speedSlider = this.el.querySelector('#speed-slider');
    this.speedValueEl = this.el.querySelector('#speed-value');
    this.dateEl = this.el.querySelector('#sim-date');
    this.muteBtn = this.el.querySelector('#mute-btn');

    // Set initial visual state
    this.updatePlayButton();
    this.updateMuteButton();
  }

  /**
   * Bind event listeners for controls.
   */
  _bindEvents() {
    this.playPauseBtn.addEventListener('click', () => {
      this.simApi.togglePlay();
      this.updatePlayButton();
    });

    this.speedSlider.addEventListener('input', () => {
      const logValue = parseFloat(this.speedSlider.value);
      const speed = Math.pow(10, logValue);
      this.simApi.setTimeSpeed(speed);
      this._updateSpeedDisplay(speed);
    });

    this.muteBtn.addEventListener('click', () => {
      setMuted(!isMuted());
      this.updateMuteButton();
    });

    this.resetBtn.addEventListener('click', () => {
      this.speedSlider.value = 0;
      this.simApi.setTimeSpeed(1);
      this.simApi.setSimTime(0);
      this._updateSpeedDisplay(1);
      this.updateDate(0);
    });
  }

  /**
   * Update speed display text from a linear speed value.
   * @param {number} speed
   */
  _updateSpeedDisplay(speed) {
    if (speed < 1) {
      // 2 decimals: the slider now reaches 0.01x, which toFixed(1) would round to "0.0x".
      this.speedValueEl.textContent = `${speed.toFixed(2)}x`;
    } else if (speed < 10) {
      this.speedValueEl.textContent = `${speed.toFixed(1)}x`;
    } else {
      this.speedValueEl.textContent = `${Math.round(speed)}x`;
    }
  }

  /**
   * Update the play/pause button visual state.
   */
  updatePlayButton() {
    const playing = this.simApi.isPlaying();
    const playIcon = this.playPauseBtn.querySelector('.play-icon');
    const pauseIcon = this.playPauseBtn.querySelector('.pause-icon');

    if (playing) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'inline';
    } else {
      playIcon.style.display = 'inline';
      pauseIcon.style.display = 'none';
    }
  }

  /**
   * Reflect the shared mute state (restored from localStorage by tts.init).
   */
  updateMuteButton() {
    const muted = isMuted();
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
    this.muteBtn.setAttribute('aria-label', muted ? STR.timeSoundOff : STR.timeSoundOn);
    this.muteBtn.title = this.muteBtn.getAttribute('aria-label');
  }

  /**
   * Update the date display based on current simulation time in days.
   * @param {number} simTimeDays - Simulation time elapsed in days.
   */
  updateDate(simTimeDays) {
    const msPerDay = 86400000;
    const currentDate = new Date(this.startDate.getTime() + simTimeDays * msPerDay);
    this.dateEl.textContent = formatKoDate(currentDate);
  }
}
