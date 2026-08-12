import { ECLIPSE_TABLE, ECLIPSE_DIAGRAM_INTRO, ECLIPSE_SCALE_NOTE, getEclipseTypeInfo } from '../utils/eclipseData.js';
import { EARTH_VIEW_DEFAULTS } from '../utils/constants.js';
import { STR } from '../ui/strings.js';

/**
 * EarthHUD is the Earth view's overlay: a richer info readout than the solar
 * InfoPanel (sub-solar point + terminator time), the SPEC-EARTH-002 sim controls
 * (aircraft status + opt-in toggle, eclipse preset picker + find-next, aurora toggle),
 * plus an always-present "back to solar system" control. Escape and browser-back are
 * handled by ViewManager; the back button routes through onBack.
 */
export class EarthHUD {
  constructor() {
    this.onBack = null;
    this.onToggleAircraft = null;
    this.onSelectEclipse = null;
    this.onFindNextEclipse = null;
    this.onToggleEclipse = null;
    this.onToggleAurora = null;
    this.onToggleISS = null;
    this.onSpeedChange = null;
    this._collapsed = false;
    this._injectStyles();
    this._createDOM();
    this._checkAutoCollapse();
    this._resizeHandler = () => this._checkAutoCollapse();
    window.addEventListener('resize', this._resizeHandler);
  }

  /**
   * Inject CSS. Reuses the project color tokens (#e0e0e0 / #888 on #1a1a2e) which
   * meet WCAG 2.1 AA body contrast.
   */
  _injectStyles() {
    if (document.getElementById('earth-hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'earth-hud-styles';
    style.textContent = `
      .earth-hud {
        position: fixed;
        /* Additive safe-area insets (Dynamic Island + landscape rounded
           corner, REQ-PWA-103): 0 on devices/browsers without env() support. */
        top: calc(64px + env(safe-area-inset-top, 0px));
        right: calc(16px + env(safe-area-inset-right, 0px));
        background: rgba(26, 26, 46, 0.9);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(22, 199, 255, 0.2);
        border-radius: 12px;
        padding: 18px 20px;
        z-index: 120;
        font-family: 'Inter Variable', sans-serif;
        color: #e0e0e0;
        min-width: 240px;
        max-width: 320px;
        transition: opacity 0.3s, transform 0.3s;
      }
      .earth-hud.collapsed {
        opacity: 0;
        pointer-events: none;
        transform: translateX(20px);
      }
      .earth-hud-toggle-btn {
        position: fixed;
        /* Additive safe-area insets (Dynamic Island + landscape rounded
           corner, REQ-PWA-103): 0 on devices/browsers without env() support. */
        top: calc(16px + env(safe-area-inset-top, 0px));
        right: calc(16px + env(safe-area-inset-right, 0px));
        background: rgba(26, 26, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(22, 199, 255, 0.15);
        border-radius: 8px;
        color: #16c7ff;
        width: 36px;
        height: 36px;
        font-size: 18px;
        cursor: pointer;
        z-index: 121;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .earth-hud-toggle-btn:hover {
        background: rgba(22, 199, 255, 0.25);
      }
      .earth-hud-title {
        font-size: 20px;
        font-weight: 600;
        color: #16c7ff;
        margin: 0 0 12px 0;
      }
      .earth-hud-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 6px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .earth-hud-label { font-size: 12px; color: #888; }
      /* Korean tail on the mono stacks: JetBrains Mono carries no Hangul glyphs. */
      .earth-hud-value { font-size: 13px; font-family: 'JetBrains Mono Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', monospace; color: #e0e0e0; }
      .earth-hud-back {
        margin-top: 14px;
        width: 100%;
        background: rgba(22, 199, 255, 0.15);
        border: 1px solid rgba(22, 199, 255, 0.3);
        color: #16c7ff;
        border-radius: 8px;
        padding: 10px 12px;
        font-family: 'Inter Variable', sans-serif;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .earth-hud-back:hover { background: rgba(22, 199, 255, 0.28); }
      .earth-hud-section {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .earth-hud-toggle {
        background: rgba(22, 199, 255, 0.1);
        border: 1px solid rgba(22, 199, 255, 0.25);
        color: #16c7ff;
        border-radius: 8px;
        padding: 8px 10px;
        font-family: 'Inter Variable', sans-serif;
        font-size: 12px;
        cursor: pointer;
        text-align: left;
      }
      .earth-hud-toggle:hover { background: rgba(22, 199, 255, 0.2); }
      .earth-hud-flight-status {
        font-size: 12px;
        font-family: 'JetBrains Mono Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', monospace;
        color: #9fe0b0;
      }
      .earth-hud-flight-status[data-state="OFFLINE"],
      .earth-hud-flight-status[data-state="RATE_LIMITED"] { color: #e0a35a; }
      .earth-hud-flight-status[data-state="OFF"] { color: #888; }
      .earth-hud-eclipse-select {
        width: 100%;
        background: #14142a;
        color: #e0e0e0;
        border: 1px solid rgba(22, 199, 255, 0.25);
        border-radius: 8px;
        padding: 7px 8px;
        font-family: 'Inter Variable', sans-serif;
        font-size: 12px;
      }
      .earth-hud-note { font-size: 11px; color: #888; font-style: italic; }
      .earth-hud-credit { font-size: 10px; color: #777; text-decoration: none; }
      .earth-hud-credit:hover { color: #16c7ff; }
      .earth-hud-speed-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .earth-hud-speed-slider {
        flex: 1;
        accent-color: #16c7ff;
      }
      .earth-hud-speed-value {
        font-family: 'JetBrains Mono Variable', monospace;
        font-size: 13px;
        color: #e0e0e0;
        min-width: 56px;
        text-align: right;
      }
    `;
    document.head.appendChild(style);
  }

  _createDOM() {
    this.el = document.createElement('div');
    this.el.className = 'earth-hud';
    const eclipseOptions = ECLIPSE_TABLE
      .map((e, i) => `<option value="${i}">${e.name} (${e.date.slice(0, 10)})</option>`)
      .join('');

    this.el.innerHTML = `
      <h2 class="earth-hud-title">${STR.earthTitle}</h2>
      <div class="earth-hud-row"><span class="earth-hud-label">${STR.earthSubSolar}</span><span class="earth-hud-value" data-field="subsolar">—</span></div>
      <div class="earth-hud-row"><span class="earth-hud-label">${STR.earthTerminator}</span><span class="earth-hud-value" data-field="terminator">—</span></div>
      <div class="earth-hud-section">
        <span class="earth-hud-label">${STR.earthRotationSpeed}</span>
        <div class="earth-hud-speed-row">
          <input class="earth-hud-speed-slider" type="range" data-field="speed-slider" min="0.05" max="3" step="0.05" value="${EARTH_VIEW_DEFAULTS.rotationSpeedDefault}" aria-label="${STR.earthRotationSpeed}" />
          <span class="earth-hud-speed-value" data-field="speed-value">${STR.earthRotationSpeedValue(EARTH_VIEW_DEFAULTS.rotationSpeedDefault)}</span>
        </div>
      </div>
      <div class="earth-hud-section">
        <button class="earth-hud-toggle" type="button" data-toggle="aircraft">${STR.earthAircraftOff}</button>
        <div class="earth-hud-flight-status" data-field="flight-status" role="status" aria-live="polite" data-state="OFF">${STR.earthFlightOff}</div>
        <a class="earth-hud-credit" data-field="flight-credit" href="https://adsb.fi/" target="_blank" rel="noopener noreferrer">${STR.earthFlightCredit}</a>
      </div>
      <div class="earth-hud-section">
        <select class="earth-hud-eclipse-select" data-field="eclipse-preset" aria-label="${STR.earthEclipseSelectLabel}">
          <option selected disabled>${STR.earthEclipseSelectPlaceholder}</option>
          ${eclipseOptions}
        </select>
        <button class="earth-hud-toggle" type="button" data-action="find-eclipse">${STR.earthFindNextEclipse}</button>
        <button class="earth-hud-toggle" type="button" data-toggle="eclipse">${STR.earthEclipseOn}</button>
        <div class="earth-hud-note" data-field="eclipse-detail">${ECLIPSE_DIAGRAM_INTRO}</div>
      </div>
      <div class="earth-hud-section">
        <button class="earth-hud-toggle" type="button" data-toggle="aurora">${STR.earthAuroraOn}</button>
      </div>
      <div class="earth-hud-section">
        <div class="earth-hud-note" data-field="meteor-notice" role="status" aria-live="polite"></div>
      </div>
      <div class="earth-hud-section">
        <button class="earth-hud-toggle" type="button" data-toggle="iss">${STR.earthIssOn}</button>
        <div class="earth-hud-note" data-field="iss-facts"></div>
      </div>
      <button class="earth-hud-back" type="button">${STR.earthBack}</button>
    `;
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());

    this._subSolarEl = this.el.querySelector('[data-field="subsolar"]');
    this._terminatorEl = this.el.querySelector('[data-field="terminator"]');
    this._flightStatusEl = this.el.querySelector('[data-field="flight-status"]');
    this._aircraftToggle = this.el.querySelector('[data-toggle="aircraft"]');
    this._eclipseSelect = this.el.querySelector('[data-field="eclipse-preset"]');
    this._eclipseToggle = this.el.querySelector('[data-toggle="eclipse"]');
    this._eclipseDetailEl = this.el.querySelector('[data-field="eclipse-detail"]');
    this._auroraToggle = this.el.querySelector('[data-toggle="aurora"]');
    this._meteorNoticeEl = this.el.querySelector('[data-field="meteor-notice"]');
    this._issToggle = this.el.querySelector('[data-toggle="iss"]');
    this._issFactsEl = this.el.querySelector('[data-field="iss-facts"]');
    this._speedSlider = this.el.querySelector('[data-field="speed-slider"]');
    this._speedValueEl = this.el.querySelector('[data-field="speed-value"]');

    this.backButton = this.el.querySelector('.earth-hud-back');
    this.backButton.addEventListener('click', () => {
      if (this.onBack) this.onBack();
    });
    this._aircraftToggle.addEventListener('click', () => {
      if (this.onToggleAircraft) this.onToggleAircraft();
    });
    this._eclipseSelect.addEventListener('change', () => {
      const idx = parseInt(this._eclipseSelect.value, 10);
      if (Number.isInteger(idx) && ECLIPSE_TABLE[idx] && this.onSelectEclipse) {
        this.onSelectEclipse(ECLIPSE_TABLE[idx]);
      }
    });
    this.el.querySelector('[data-action="find-eclipse"]').addEventListener('click', () => {
      if (this.onFindNextEclipse) this.onFindNextEclipse();
    });
    this._eclipseToggle.addEventListener('click', () => {
      if (this.onToggleEclipse) this.onToggleEclipse();
    });
    this._auroraToggle.addEventListener('click', () => {
      if (this.onToggleAurora) this.onToggleAurora();
    });
    this._issToggle.addEventListener('click', () => {
      if (this.onToggleISS) this.onToggleISS();
    });
    this._speedSlider.addEventListener('input', () => {
      const speed = parseFloat(this._speedSlider.value);
      this.setSpeedDisplay(speed);
      if (this.onSpeedChange) this.onSpeedChange(speed);
    });

    document.body.appendChild(this.el);

    // Toggle button (mirrors PlanetList's toggle for the sidebar).
    this._toggleBtn = document.createElement('button');
    this._toggleBtn.className = 'earth-hud-toggle-btn';
    this._toggleBtn.innerHTML = '&#9776;';
    this._toggleBtn.title = STR.earthHudToggleTitle;
    this._toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleCollapse();
    });
    this._toggleBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    this._toggleBtn.addEventListener('touchstart', (e) => e.stopPropagation());
    document.body.appendChild(this._toggleBtn);
  }

  /**
   * Toggle panel collapse state (manual, via the toggle button).
   */
  _toggleCollapse() {
    this._collapsed = !this._collapsed;
    if (this._collapsed) {
      this.el.classList.add('collapsed');
    } else {
      this.el.classList.remove('collapsed');
    }
  }

  /**
   * Auto-collapse on narrow screens by default. One-way: only ever collapses
   * once, never auto-restores (mirrors PlanetList's _checkAutoHide).
   */
  _checkAutoCollapse() {
    if (window.innerWidth <= 768) {
      if (!this._collapsed) {
        this.el.classList.add('collapsed');
        this._collapsed = true;
      }
    }
  }

  /**
   * Update the aircraft-layer status region (aria-live). A LIVE empty sky (0 aircraft)
   * is reported as a valid state, visibly distinct from an OFFLINE/error state (REQ-490).
   * @param {string} state - OFF|LOADING|LIVE|RATE_LIMITED|OFFLINE.
   * @param {{count?:number, updatedAgoSec?:number}} [info]
   */
  setFlightStatus(state, { count = 0, updatedAgoSec = 0 } = {}) {
    let text;
    switch (state) {
      case 'LOADING':
        text = STR.earthFlightLoading;
        break;
      case 'LIVE':
        // A live-but-empty sky is a healthy state, worded apart from the error
        // states so it never reads as a failure (SPEC-EARTH-002 REQ-490).
        text = count > 0 ? STR.earthFlightLive(count, updatedAgoSec) : STR.earthFlightLiveEmpty;
        break;
      case 'RATE_LIMITED':
        text = STR.earthFlightRateLimited;
        break;
      case 'OFFLINE':
        text = STR.earthFlightOffline;
        break;
      default:
        text = STR.earthFlightOff;
    }
    this._flightStatusEl.dataset.state = state;
    this._flightStatusEl.textContent = text;
    if (this._aircraftToggle) {
      this._aircraftToggle.textContent = state === 'OFF' ? STR.earthAircraftOff : STR.earthAircraftOn;
    }
  }

  /** @param {boolean} on */
  setAuroraEnabled(on) {
    if (this._auroraToggle) this._auroraToggle.textContent = on ? STR.earthAuroraOn : STR.earthAuroraOff;
  }

  /** @param {boolean} on */
  setISSEnabled(on) {
    if (this._issToggle) this._issToggle.textContent = on ? STR.earthIssOn : STR.earthIssOff;
  }

  /**
   * Show the ISS's Korean kid facts (REQ-E3-203). This view has no InfoPanel, so
   * the HUD is the facts surface — mirrors the eclipse-detail note above.
   * @param {string[]} factsKo
   */
  showISSFacts(factsKo) {
    if (this._issFactsEl) this._issFactsEl.textContent = (factsKo || []).join(' ');
  }

  /**
   * Show the meteor-shower entry notice (REQ-E3-104): a Korean line derived
   * mechanically from the shower table's koreanName, on the same aria-live
   * note surface pattern as eclipse-detail/iss-facts above. Empty clears it.
   * @param {string} text
   */
  setMeteorNotice(text) {
    if (this._meteorNoticeEl) this._meteorNoticeEl.textContent = text || '';
  }

  /** @param {boolean} on */
  setEclipseEnabled(on) {
    if (this._eclipseToggle) this._eclipseToggle.textContent = on ? STR.earthEclipseOn : STR.earthEclipseOff;
  }

  /**
   * Describe the eclipse currently shown by the diorama, or fall back to the
   * generic explanation when none is active (e.g. simulation just toggled off,
   * or no eclipse has been reached yet).
   * @param {{type: string, name: string, date: string}|null} [eclipse]
   */
  setEclipseInfo(eclipse) {
    if (!this._eclipseDetailEl) return;
    if (!eclipse) {
      this._eclipseDetailEl.textContent = ECLIPSE_DIAGRAM_INTRO;
      return;
    }
    const { label, description } = getEclipseTypeInfo(eclipse.type);
    const when = eclipse.date.slice(0, 10);
    this._eclipseDetailEl.textContent = `${label} — ${eclipse.name} (${when}). ${description} ${ECLIPSE_SCALE_NOTE}`;
  }

  /**
   * Reflect a (possibly externally-set) rotation speed in the slider + value display.
   * @param {number} speed - Days per second.
   */
  setSpeedDisplay(speed) {
    if (this._speedSlider) this._speedSlider.value = speed;
    if (this._speedValueEl) this._speedValueEl.textContent = STR.earthRotationSpeedValue(speed);
  }

  /**
   * Update the readout.
   * @param {Object} info
   * @param {string} [info.subSolar]
   * @param {string} [info.terminator]
   */
  setInfo({ subSolar, terminator } = {}) {
    if (subSolar != null) this._subSolarEl.textContent = subSolar;
    if (terminator != null) this._terminatorEl.textContent = terminator;
  }

  show() {
    this.el.style.display = '';
    if (this._toggleBtn) this._toggleBtn.style.display = '';
  }

  hide() {
    this.el.style.display = 'none';
    if (this._toggleBtn) this._toggleBtn.style.display = 'none';
  }

  /**
   * Remove the HUD from the DOM (mobile dispose / view teardown).
   */
  dispose() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    if (this._toggleBtn && this._toggleBtn.parentNode) this._toggleBtn.parentNode.removeChild(this._toggleBtn);
    window.removeEventListener('resize', this._resizeHandler);
  }
}
