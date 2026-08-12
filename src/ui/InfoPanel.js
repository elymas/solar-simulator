import { MOON_DATA, STAR_DATA } from '../planets/planetData.js';
import { speakBody, isAvailable } from '../audio/tts.js';
import { STR, formatKoUnit } from './strings.js';

/**
 * Build an element from text. Always textContent, never innerHTML: plan.md A.1
 * lets downstream SPECs feed this same body shape from an external API
 * (SPEC-EARTH-003's ISS data), so no rendered node may carry markup.
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/**
 * InfoPanel displays detailed information about a selected celestial body
 * in a slide-in sidebar panel.
 */
export class InfoPanel {
  constructor() {
    this.isOpen = false;
    this.onClose = null;
    this.body = null; // resolved data of the body on screen, for the replay button
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
        font-family: 'Inter Variable', sans-serif;
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
      /* Korean is the primary label, English the secondary one (REQ-KIDS-101). */
      .planet-name-ko {
        font-size: 32px;
        font-weight: 700;
        margin: 0 0 2px 0;
        color: #16c7ff;
      }
      .planet-name {
        font-size: 15px;
        font-weight: 300;
        color: #888;
        margin: 0 0 20px 0;
      }
      .kid-emoji {
        font-size: 56px;
        line-height: 1.1;
      }
      .kid-facts {
        list-style: none;
        padding: 0;
        margin: 0 0 18px 0;
      }
      /* >=18px is a spec floor (REQ-KIDS-302), not a taste choice. */
      .kid-fact {
        font-size: 19px;
        line-height: 1.6;
        margin-bottom: 12px;
      }
      .kid-size {
        font-size: 19px;
        line-height: 1.5;
        color: #16c7ff;
        margin: 0 0 18px 0;
      }
      .kid-replay {
        font-size: 26px;
        background: none;
        border: 1px solid rgba(22, 199, 255, 0.4);
        border-radius: 12px;
        color: #16c7ff;
        cursor: pointer;
        padding: 8px 16px;
        margin-bottom: 18px;
      }
      .kid-details-toggle {
        display: block;
        width: 100%;
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        color: #888;
        cursor: pointer;
        font-family: inherit;
        font-size: 15px;
        padding: 10px;
        margin-bottom: 16px;
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
        font-family: 'JetBrains Mono Variable', monospace;
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

    // Kid view first, scientific table behind the expander (REQ-KIDS-302/303).
    this.el.innerHTML = `
      <button class="info-panel-close">&times;</button>
      <div class="kid-emoji" aria-hidden="true"></div>
      <h2 class="planet-name-ko"></h2>
      <h3 class="planet-name"></h3>
      <ul class="kid-facts"></ul>
      <p class="kid-size"></p>
      <button class="kid-replay" aria-label="${STR.infoReplay}">&#128266;</button>
      <button class="kid-details-toggle">${STR.infoDetailsToggle}</button>
      <div class="info-details" hidden>
        <div class="info-grid"></div>
      </div>
    `;

    // Prevent clicks on the panel from propagating to the canvas
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('touchstart', (e) => e.stopPropagation());

    // Close button: route through onClose so it matches Escape/R (camera reset),
    // falling back to a plain hide when no handler is wired.
    this.el.querySelector('.info-panel-close').addEventListener('click', () => {
      if (this.onClose) {
        this.onClose();
      } else {
        this.hide();
      }
    });

    this.el.querySelector('.kid-details-toggle').addEventListener('click', () => {
      const details = this.el.querySelector('.info-details');
      details.hidden = !details.hidden;
    });

    // Replay runs from a real tap, so it keeps satisfying the iOS gesture rule.
    this.el.querySelector('.kid-replay').addEventListener('click', () => {
      if (this.body) speakBody(this.body);
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
      return formatKoUnit(years.toFixed(2), STR.unitYear);
    }
    return formatKoUnit(days.toFixed(1), STR.unitDay);
  }

  /**
   * Format rotation period as human-readable string.
   * @param {number} hours
   * @returns {string}
   */
  _formatRotationPeriod(hours) {
    if (!hours) return STR.infoValueNone;
    const absHours = Math.abs(hours);
    const retrograde = hours < 0 ? STR.infoRetrogradeSuffix : '';

    if (absHours >= 24) {
      const days = absHours / 24;
      return `${formatKoUnit(days.toFixed(1), STR.unitDay)}${retrograde}`;
    }
    return `${formatKoUnit(absHours.toFixed(1), STR.unitHour)}${retrograde}`;
  }

  /**
   * Show the info panel with data for the given planet.
   * @param {string} planetKey - Key from planetFactory.planets
   * @param {Object} planetData - Planet data object from planetData.js
   */
  /**
   * Find moon data by key across all parent planets.
   * @param {string} key - Moon key.
   * @returns {Object|null} Moon data object or null.
   */
  _findMoonData(key) {
    for (const moons of Object.values(MOON_DATA)) {
      const found = moons.find((m) => m.key === key);
      if (found) return found;
    }
    return null;
  }

  show(planetKey, planetData) {
    // Resolve the correct data source with explicit type detection
    const moonData = this._findMoonData(planetKey);
    const starData = STAR_DATA[planetKey] || null;
    const data = moonData || starData || planetData;
    if (!data) return null;

    const nameEl = this.el.querySelector('.planet-name');
    const nameKoEl = this.el.querySelector('.planet-name-ko');
    const gridEl = this.el.querySelector('.info-grid');

    this.body = data;
    nameEl.textContent = data.name || planetKey;
    nameKoEl.textContent = data.nameKo || '';
    this._renderKidView(data);

    const items = [];

    if (starData) {
      // Star-specific data
      items.push({ label: STR.infoType, value: data.type });
      items.push({ label: STR.infoRadius, value: `${data.radiusSolar} R\u2609` });
      items.push({ label: STR.infoDistance, value: `${data.distance.toLocaleString()} ${data.distanceUnit}` });
      items.push({ label: STR.infoMass, value: `${data.mass} ${data.massUnit}` });
      items.push({ label: STR.infoLuminosity, value: `${data.luminosity.toLocaleString()} ${data.luminosityUnit}` });
      items.push({ label: STR.infoSurfaceTemp, value: `${data.surfaceTemp.toLocaleString()} K` });
      items.push({ label: STR.infoConstellation, value: `${data.constellation} (${data.constellationKo})` });
      items.push({ label: STR.infoApparentMag, value: data.apparentMagnitude.toString() });
      items.push({ label: STR.infoAbsoluteMag, value: data.absoluteMagnitude.toString() });
    } else if (planetKey === 'sun') {
      items.push({ label: STR.infoDiameter, value: `${(data.radius * 2).toLocaleString()} km` });
      items.push({ label: STR.infoSurfaceTemp, value: '5,778 K' });
      items.push({ label: STR.infoRotationPeriod, value: this._formatRotationPeriod(data.rotationPeriod) });
      items.push({ label: STR.infoAxialTilt, value: `${data.axialTilt}\u00B0` });
    } else if (moonData) {
      items.push({ label: STR.infoDiameter, value: `${(data.radius * 2).toLocaleString()} km` });
      items.push({ label: STR.infoDistanceFromParent, value: `${data.distanceFromParent?.toLocaleString()} km` });
      items.push({ label: STR.infoOrbitalPeriod, value: this._formatOrbitalPeriod(Math.abs(data.orbitalPeriod)) });
      items.push({ label: STR.infoRotationPeriod, value: this._formatRotationPeriod(data.rotationPeriod) });
      items.push({ label: STR.infoAxialTilt, value: `${data.axialTilt}\u00B0` });
      items.push({ label: STR.infoEccentricity, value: data.eccentricity?.toFixed(4) || STR.infoValueNone });
      if (data.retrograde) {
        items.push({ label: STR.infoOrbit, value: STR.infoValueRetrograde });
      }
    } else if (data.category === 'belt') {
      // A band has no diameter, no spin and no tilt. Two honest rows here; the
      // kid section above carries the rest (SPEC-EVENTS-001 REQ-EVT-205).
      items.push({ label: STR.infoClassification, value: STR.infoValueBelt });
      items.push({ label: STR.infoDistanceFromSun, value: `${data.distance} AU` });
    } else if (data.category === 'dwarf') {
      items.push({ label: STR.infoClassification, value: STR.infoValueDwarfPlanet });
      items.push({ label: STR.infoDiameter, value: `${(data.radius * 2).toLocaleString()} km` });
      items.push({ label: STR.infoDistanceFromSun, value: `${data.distance} AU` });
      items.push({ label: STR.infoOrbitalPeriod, value: this._formatOrbitalPeriod(data.orbitalPeriod) });
      items.push({ label: STR.infoRotationPeriod, value: this._formatRotationPeriod(data.rotationPeriod) });
      items.push({ label: STR.infoAxialTilt, value: `${data.axialTilt}°` });
      items.push({ label: STR.infoEccentricity, value: data.eccentricity?.toFixed(4) || STR.infoValueNone });
      if (data.discoveryYear !== undefined) {
        items.push({ label: STR.infoDiscovered, value: data.discoveryYear.toString() });
      }
      if (data.moons !== undefined) {
        items.push({ label: STR.infoMoons, value: data.moons.toString() });
      }
    } else {
      items.push({ label: STR.infoDiameter, value: `${(data.radius * 2).toLocaleString()} km` });
      items.push({ label: STR.infoDistanceFromSun, value: `${data.distance} AU` });
      items.push({ label: STR.infoOrbitalPeriod, value: this._formatOrbitalPeriod(data.orbitalPeriod) });
      items.push({ label: STR.infoRotationPeriod, value: this._formatRotationPeriod(data.rotationPeriod) });
      items.push({ label: STR.infoAxialTilt, value: `${data.axialTilt}\u00B0` });
      items.push({ label: STR.infoEccentricity, value: data.eccentricity?.toFixed(4) || STR.infoValueNone });
      if (data.moons !== undefined) {
        items.push({ label: STR.infoMoons, value: data.moons.toString() });
      }
    }

    gridEl.replaceChildren(
      ...items.map((item) => {
        const row = el('div', 'info-item');
        row.append(el('span', 'info-label', item.label), el('span', 'info-value', item.value));
        return row;
      })
    );

    this.el.classList.add('open');
    this.isOpen = true;
    return data;
  }

  /**
   * Fill the kid-first section. Bodies outside the REQ-KIDS-301 set carry no
   * facts, so their sections stay empty and the expander opens instead — the
   * scientific table is all the content they have (plan.md A.3).
   * @param {Object} data - Resolved body data.
   */
  _renderKidView(data) {
    const facts = Array.isArray(data.factsKo) ? data.factsKo : [];

    this.el.querySelector('.kid-emoji').textContent = data.emoji || '';
    this.el.querySelector('.kid-facts').replaceChildren(
      ...facts.map((fact) => el('li', 'kid-fact', fact))
    );
    this.el.querySelector('.kid-size').textContent = data.sizeComparisonKo || '';
    this.el.querySelector('.info-details').hidden = facts.length > 0;
    // No speech engine: no 🔊 affordance at all (REQ-KIDS-206).
    this.el.querySelector('.kid-replay').hidden = !isAvailable();
  }

  /**
   * Hide the info panel.
   */
  hide() {
    this.el.classList.remove('open');
    this.isOpen = false;
  }
}
