import { PLANET_DATA, MOON_DATA } from '../planets/planetData.js';

/**
 * PlanetList renders a left sidebar with clickable celestial body items.
 * Clicking an item selects the corresponding planet and focuses the camera.
 */
export class PlanetList {
  constructor() {
    this.onSelect = null;
    this._activeKey = null;
    this._injectStyles();
    this._createDOM();
  }

  /**
   * Inject CSS styles for the planet list sidebar.
   */
  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .planet-list {
        position: fixed;
        top: 50%;
        left: 16px;
        transform: translateY(-50%);
        background: rgba(26, 26, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(22, 199, 255, 0.15);
        border-radius: 12px;
        padding: 16px 12px;
        z-index: 100;
        font-family: 'Inter', sans-serif;
        min-width: 160px;
      }
      .planet-list-title {
        font-size: 11px;
        font-weight: 500;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 12px;
        padding: 0 4px;
      }
      .planet-list-items {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .planet-list-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        background: none;
        border: none;
        border-radius: 8px;
        color: #ccc;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
        width: 100%;
      }
      .planet-list-item:hover {
        background: rgba(22, 199, 255, 0.1);
        color: #fff;
      }
      .planet-list-item.active {
        background: rgba(22, 199, 255, 0.15);
        color: #16c7ff;
      }
      .planet-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .planet-item-name {
        flex: 1;
      }
      .planet-item-name-ko {
        font-size: 11px;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Convert a Three.js hex color number to CSS hex string.
   * @param {number} hex - Color as integer (e.g., 0xffdd44).
   * @returns {string} CSS hex string (e.g., '#ffdd44').
   */
  _colorToCSS(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  /**
   * Create the DOM structure for the planet list sidebar.
   */
  _createDOM() {
    this.el = document.createElement('div');
    this.el.className = 'planet-list';

    // Prevent clicks from propagating to the canvas
    this.el.addEventListener('click', (e) => e.stopPropagation());
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('touchstart', (e) => e.stopPropagation());

    const title = document.createElement('h3');
    title.className = 'planet-list-title';
    title.textContent = 'Solar System';
    this.el.appendChild(title);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'planet-list-items';

    // Order: Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, Neptune
    const order = [
      { key: 'sun', data: PLANET_DATA.sun },
      { key: 'mercury', data: PLANET_DATA.mercury },
      { key: 'venus', data: PLANET_DATA.venus },
      { key: 'earth', data: PLANET_DATA.earth },
      { key: 'moon', data: MOON_DATA.moon },
      { key: 'mars', data: PLANET_DATA.mars },
      { key: 'jupiter', data: PLANET_DATA.jupiter },
      { key: 'saturn', data: PLANET_DATA.saturn },
      { key: 'uranus', data: PLANET_DATA.uranus },
      { key: 'neptune', data: PLANET_DATA.neptune },
    ];

    this._buttons = {};

    for (const { key, data } of order) {
      const btn = document.createElement('button');
      btn.className = 'planet-list-item';
      btn.dataset.key = key;

      const dot = document.createElement('span');
      dot.className = 'planet-dot';
      dot.style.background = this._colorToCSS(data.color);

      const name = document.createElement('span');
      name.className = 'planet-item-name';
      name.textContent = data.name;

      const nameKo = document.createElement('span');
      nameKo.className = 'planet-item-name-ko';
      nameKo.textContent = data.nameKo;

      btn.appendChild(dot);
      btn.appendChild(name);
      btn.appendChild(nameKo);

      btn.addEventListener('click', () => {
        if (this.onSelect) {
          this.onSelect(key);
        }
      });

      itemsContainer.appendChild(btn);
      this._buttons[key] = btn;
    }

    this.el.appendChild(itemsContainer);
    document.body.appendChild(this.el);
  }

  /**
   * Highlight the active planet item.
   * @param {string} key - Planet key to highlight.
   */
  setActive(key) {
    this.clearActive();
    this._activeKey = key;
    if (this._buttons[key]) {
      this._buttons[key].classList.add('active');
    }
  }

  /**
   * Remove highlight from all items.
   */
  clearActive() {
    this._activeKey = null;
    for (const btn of Object.values(this._buttons)) {
      btn.classList.remove('active');
    }
  }
}
