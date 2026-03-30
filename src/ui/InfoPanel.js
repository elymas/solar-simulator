import { MOON_DATA } from '../planets/planetData.js';

/**
 * InfoPanel displays detailed information about a selected celestial body
 * in a slide-in sidebar panel.
 */
export class InfoPanel {
  constructor() {
    this.isOpen = false;
    this._injectStyles();
    this._createDOM();
  }

  /**
   * Inject CSS styles for the info panel into the document head.
   */
  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .info-panel {
        position: fixed;
        top: 0;
        right: -400px;
        width: 380px;
        height: 100vh;
        background: rgba(26, 26, 46, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-left: 1px solid rgba(22, 199, 255, 0.2);
        padding: 30px 24px;
        transition: right 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
        z-index: 100;
        overflow-y: auto;
        font-family: 'Inter', sans-serif;
        color: #e0e0e0;
      }
      .info-panel.open {
        right: 0;
      }
      .info-panel-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        color: #888;
        font-size: 28px;
        cursor: pointer;
        transition: color 0.2s;
        line-height: 1;
        padding: 4px;
      }
      .info-panel-close:hover {
        color: #16c7ff;
      }
      .planet-name {
        font-size: 28px;
        font-weight: 600;
        margin: 0 0 4px 0;
        color: #16c7ff;
      }
      .planet-name-ko {
        font-size: 16px;
        font-weight: 300;
        color: #888;
        margin: 0 0 24px 0;
      }
      .info-grid {
        display: grid;
        gap: 16px;
      }
      .info-item {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }
      .info-label {
        font-size: 13px;
        color: #888;
      }
      .info-value {
        font-size: 14px;
        font-family: 'JetBrains Mono', monospace;
        color: #e0e0e0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create the DOM structure for the info panel.
   */
  _createDOM() {
    this.el = document.createElement('div');
    this.el.id = 'info-panel';
    this.el.className = 'info-panel';

    this.el.innerHTML = `
      <button class="info-panel-close">&times;</button>
      <h2 class="planet-name"></h2>
      <h3 class="planet-name-ko"></h3>
      <div class="info-grid"></div>
    `;

    // Prevent clicks on the panel from propagating to the canvas
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('touchstart', (e) => e.stopPropagation());

    // Close button
    this.el.querySelector('.info-panel-close').addEventListener('click', () => {
      this.hide();
    });

    document.body.appendChild(this.el);
  }

  /**
   * Format orbital period as human-readable string.
   * @param {number} days
   * @returns {string}
   */
  _formatOrbitalPeriod(days) {
    if (days >= 365.25) {
      const years = days / 365.25;
      return `${years.toFixed(2)} years`;
    }
    return `${days.toFixed(1)} days`;
  }

  /**
   * Format rotation period as human-readable string.
   * @param {number} hours
   * @returns {string}
   */
  _formatRotationPeriod(hours) {
    if (!hours) return 'N/A';
    const absHours = Math.abs(hours);
    const retrograde = hours < 0 ? ' (retrograde)' : '';

    if (absHours >= 24) {
      const days = absHours / 24;
      return `${days.toFixed(1)} days${retrograde}`;
    }
    return `${absHours.toFixed(1)} hours${retrograde}`;
  }

  /**
   * Show the info panel with data for the given planet.
   * @param {string} planetKey - Key from planetFactory.planets
   * @param {Object} planetData - Planet data object from planetData.js
   */
  show(planetKey, planetData) {
    const data = planetKey === 'moon' ? MOON_DATA.moon : planetData;
    const nameEl = this.el.querySelector('.planet-name');
    const nameKoEl = this.el.querySelector('.planet-name-ko');
    const gridEl = this.el.querySelector('.info-grid');

    nameEl.textContent = data.name || planetKey;
    nameKoEl.textContent = data.nameKo || '';

    // Build info items based on planet type
    const items = [];

    if (planetKey === 'sun') {
      // Sun-specific data
      items.push({ label: 'Diameter', value: `${(data.radius * 2).toLocaleString()} km` });
      items.push({ label: 'Surface Temp', value: '5,778 K' });
      items.push({ label: 'Rotation Period', value: this._formatRotationPeriod(data.rotationPeriod) });
      items.push({ label: 'Axial Tilt', value: `${data.axialTilt}\u00B0` });
    } else if (planetKey === 'moon') {
      // Moon-specific data
      items.push({ label: 'Diameter', value: `${(data.radius * 2).toLocaleString()} km` });
      items.push({ label: 'Distance from Earth', value: `${data.distanceFromEarth?.toLocaleString() || '384,400'} km` });
      items.push({ label: 'Orbital Period', value: this._formatOrbitalPeriod(data.orbitalPeriod) });
      items.push({ label: 'Rotation Period', value: this._formatRotationPeriod(data.rotationPeriod) });
      items.push({ label: 'Axial Tilt', value: `${data.axialTilt}\u00B0` });
      items.push({ label: 'Eccentricity', value: data.eccentricity?.toFixed(4) || 'N/A' });
    } else {
      // Regular planet data
      items.push({ label: 'Diameter', value: `${(data.radius * 2).toLocaleString()} km` });
      items.push({ label: 'Distance from Sun', value: `${data.distance} AU` });
      items.push({ label: 'Orbital Period', value: this._formatOrbitalPeriod(data.orbitalPeriod) });
      items.push({ label: 'Rotation Period', value: this._formatRotationPeriod(data.rotationPeriod) });
      items.push({ label: 'Axial Tilt', value: `${data.axialTilt}\u00B0` });
      items.push({ label: 'Eccentricity', value: data.eccentricity?.toFixed(4) || 'N/A' });
      if (data.moons !== undefined) {
        items.push({ label: 'Moons', value: data.moons.toString() });
      }
    }

    gridEl.innerHTML = items
      .map(
        (item) => `
        <div class="info-item">
          <span class="info-label">${item.label}</span>
          <span class="info-value">${item.value}</span>
        </div>
      `
      )
      .join('');

    this.el.classList.add('open');
    this.isOpen = true;
  }

  /**
   * Hide the info panel.
   */
  hide() {
    this.el.classList.remove('open');
    this.isOpen = false;
  }
}
