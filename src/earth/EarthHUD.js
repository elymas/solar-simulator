/**
 * EarthHUD is the Earth view's overlay: a richer info readout than the solar
 * InfoPanel (sub-solar point + terminator time) plus an always-present
 * "back to solar system" control. Escape and browser-back are handled by
 * ViewManager; the back button routes through onBack.
 */
export class EarthHUD {
  constructor() {
    this.onBack = null;
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
    `;
    document.head.appendChild(style);
  }

  _createDOM() {
    this.el = document.createElement('div');
    this.el.className = 'earth-hud';
    this.el.innerHTML = `
      <h2 class="earth-hud-title">Earth</h2>
      <div class="earth-hud-row"><span class="earth-hud-label">Sub-solar point</span><span class="earth-hud-value" data-field="subsolar">—</span></div>
      <div class="earth-hud-row"><span class="earth-hud-label">Terminator</span><span class="earth-hud-value" data-field="terminator">—</span></div>
      <button class="earth-hud-back" type="button">&#8592; Solar System</button>
    `;
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());

    this._subSolarEl = this.el.querySelector('[data-field="subsolar"]');
    this._terminatorEl = this.el.querySelector('[data-field="terminator"]');
    this.backButton = this.el.querySelector('.earth-hud-back');
    this.backButton.addEventListener('click', () => {
      if (this.onBack) this.onBack();
    });

    document.body.appendChild(this.el);
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
