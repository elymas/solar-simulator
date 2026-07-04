import { ECLIPSE_TABLE } from '../utils/eclipseData.js';

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
    this.onToggleAurora = null;
    this._injectStyles();
    this._createDOM();
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
        top: 16px;
        right: 16px;
        background: rgba(26, 26, 46, 0.9);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(22, 199, 255, 0.2);
        border-radius: 12px;
        padding: 18px 20px;
        z-index: 120;
        font-family: 'Inter', sans-serif;
        color: #e0e0e0;
        min-width: 240px;
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
      .earth-hud-value { font-size: 13px; font-family: 'JetBrains Mono', monospace; color: #e0e0e0; }
      .earth-hud-back {
        margin-top: 14px;
        width: 100%;
        background: rgba(22, 199, 255, 0.15);
        border: 1px solid rgba(22, 199, 255, 0.3);
        color: #16c7ff;
        border-radius: 8px;
        padding: 10px 12px;
        font-family: 'Inter', sans-serif;
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
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        cursor: pointer;
        text-align: left;
      }
      .earth-hud-toggle:hover { background: rgba(22, 199, 255, 0.2); }
      .earth-hud-flight-status {
        font-size: 12px;
        font-family: 'JetBrains Mono', monospace;
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
        font-family: 'Inter', sans-serif;
        font-size: 12px;
      }
      .earth-hud-note { font-size: 11px; color: #888; font-style: italic; }
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
      <h2 class="earth-hud-title">Earth</h2>
      <div class="earth-hud-row"><span class="earth-hud-label">Sub-solar point</span><span class="earth-hud-value" data-field="subsolar">—</span></div>
      <div class="earth-hud-row"><span class="earth-hud-label">Terminator</span><span class="earth-hud-value" data-field="terminator">—</span></div>
      <div class="earth-hud-section">
        <button class="earth-hud-toggle" type="button" data-toggle="aircraft">Live aircraft: off</button>
        <div class="earth-hud-flight-status" data-field="flight-status" role="status" aria-live="polite" data-state="OFF">off</div>
      </div>
      <div class="earth-hud-section">
        <select class="earth-hud-eclipse-select" data-field="eclipse-preset" aria-label="Jump to eclipse">
          <option selected disabled>Jump to an eclipse…</option>
          ${eclipseOptions}
        </select>
        <button class="earth-hud-toggle" type="button" data-action="find-eclipse">Find next eclipse</button>
        <div class="earth-hud-note">Illustrative diagram — not to scale</div>
      </div>
      <div class="earth-hud-section">
        <button class="earth-hud-toggle" type="button" data-toggle="aurora">Aurora: on</button>
      </div>
      <button class="earth-hud-back" type="button">&#8592; Solar System</button>
    `;
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());

    this._subSolarEl = this.el.querySelector('[data-field="subsolar"]');
    this._terminatorEl = this.el.querySelector('[data-field="terminator"]');
    this._flightStatusEl = this.el.querySelector('[data-field="flight-status"]');
    this._aircraftToggle = this.el.querySelector('[data-toggle="aircraft"]');
    this._eclipseSelect = this.el.querySelector('[data-field="eclipse-preset"]');
    this._auroraToggle = this.el.querySelector('[data-toggle="aurora"]');

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
    this._auroraToggle.addEventListener('click', () => {
      if (this.onToggleAurora) this.onToggleAurora();
    });

    document.body.appendChild(this.el);
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
        text = 'loading live aircraft…';
        break;
      case 'LIVE':
        text = count > 0
          ? `live · ${count} aircraft · updated ${Math.round(updatedAgoSec)}s ago`
          : 'live · 0 aircraft · clear sky in range';
        break;
      case 'RATE_LIMITED':
        text = 'rate limited — backing off (showing last known)';
        break;
      case 'OFFLINE':
        text = 'live flight data unavailable';
        break;
      default:
        text = 'off';
    }
    this._flightStatusEl.dataset.state = state;
    this._flightStatusEl.textContent = text;
    if (this._aircraftToggle) {
      this._aircraftToggle.textContent = state === 'OFF' ? 'Live aircraft: off' : 'Live aircraft: on';
    }
  }

  /** @param {boolean} on */
  setAuroraEnabled(on) {
    if (this._auroraToggle) this._auroraToggle.textContent = `Aurora: ${on ? 'on' : 'off'}`;
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
  }

  hide() {
    this.el.style.display = 'none';
  }

  /**
   * Remove the HUD from the DOM (mobile dispose / view teardown).
   */
  dispose() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
