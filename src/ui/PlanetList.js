import { PLANET_DATA, MOON_DATA, STAR_DATA } from '../planets/planetData.js';

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
        /* Additive safe-area inset (landscape rounded corner, REQ-PWA-103):
           0 on devices/browsers without env() support, zero desktop regression. */
        left: calc(16px + env(safe-area-inset-left, 0px));
        transform: translateY(-50%);
        background: rgba(26, 26, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(22, 199, 255, 0.15);
        border-radius: 12px;
        padding: 16px 12px;
        z-index: 100;
        font-family: 'Inter Variable', sans-serif;
        min-width: 160px;
        max-height: calc(100vh - 100px);
        overflow-y: auto;
        transition: opacity 0.3s, transform 0.3s;
      }
      .planet-list::-webkit-scrollbar {
        width: 4px;
      }
      .planet-list::-webkit-scrollbar-track {
        background: transparent;
      }
      .planet-list::-webkit-scrollbar-thumb {
        background: rgba(22, 199, 255, 0.2);
        border-radius: 2px;
      }
      .planet-list.auto-hidden {
        opacity: 0;
        pointer-events: none;
        transform: translateY(-50%) translateX(-20px);
      }
      .planet-list-toggle {
        position: fixed;
        /* Additive safe-area insets (Dynamic Island + landscape rounded
           corner, REQ-PWA-103): 0 on devices/browsers without env() support. */
        top: calc(16px + env(safe-area-inset-top, 0px));
        left: calc(16px + env(safe-area-inset-left, 0px));
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
        z-index: 101;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .planet-list-toggle:hover {
        background: rgba(22, 199, 255, 0.25);
      }
      @media (max-width: 768px) {
        .planet-list {
          left: 8px;
          padding: 10px 8px;
          min-width: 140px;
          max-height: calc(100vh - 120px);
          font-size: 12px;
        }
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
        font-family: 'Inter Variable', sans-serif;
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
      .planet-list-item.moon-item {
        padding-left: 28px;
        font-size: 12px;
        color: #999;
      }
      .planet-list-caret {
        flex-shrink: 0;
        width: 14px;
        text-align: center;
        color: #666;
        transition: transform 0.15s;
      }
      .planet-list-caret.expanded {
        transform: rotate(90deg);
      }
      .moon-group.collapsed {
        display: none;
      }
      .planet-list-divider {
        font-size: 10px;
        font-weight: 500;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        margin-top: 10px;
        margin-bottom: 4px;
        padding: 0 10px;
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
   * Add a single item to the planet list.
   * @param {HTMLElement} container - The items container.
   * @param {string} key - Item key.
   * @param {Object} data - Item data with name, nameKo, color.
   * @param {boolean} isMoon - Whether this is a satellite (indented).
   */
  _addListItem(container, key, data, isMoon) {
    const btn = document.createElement('button');
    btn.className = isMoon ? 'planet-list-item moon-item' : 'planet-list-item';
    btn.dataset.key = key;

    const dot = document.createElement('span');
    dot.className = 'planet-dot';
    dot.style.background = this._colorToCSS(data.color || data.emissive || 0xffffff);

    const name = document.createElement('span');
    name.className = 'planet-item-name';
    name.textContent = data.name;

    const nameKo = document.createElement('span');
    nameKo.className = 'planet-item-name-ko';
    nameKo.textContent = data.nameKo || '';

    btn.appendChild(dot);
    btn.appendChild(name);
    btn.appendChild(nameKo);

    btn.addEventListener('click', () => {
      if (this.onSelect) {
        this.onSelect(key);
      }
    });

    container.appendChild(btn);
    this._buttons[key] = btn;
  }

  /**
   * Add a planet (or dwarf planet) row, plus a collapsible group for its
   * moons if it has any. Moon groups start collapsed (REQ: default hidden).
   * @param {HTMLElement} container - The items container.
   * @param {string} key - Planet identifier.
   * @param {Object} data - Planet data.
   */
  _addBodyWithMoons(container, key, data) {
    this._addListItem(container, key, data, false);

    const moons = MOON_DATA[key];
    if (!moons || moons.length === 0) return;

    const moonGroup = document.createElement('div');
    moonGroup.className = 'moon-group collapsed';

    const caret = document.createElement('span');
    caret.className = 'planet-list-caret';
    caret.innerHTML = '&#9656;';
    caret.title = 'Toggle moons';
    caret.addEventListener('click', (e) => {
      e.stopPropagation();
      this._setMoonGroupExpanded(key, moonGroup.classList.contains('collapsed'));
    });

    const btn = this._buttons[key];
    btn.insertBefore(caret, btn.firstChild);

    for (const moonData of moons) {
      this._addListItem(moonGroup, moonData.key, moonData, true);
      this._moonToParent[moonData.key] = key;
    }
    container.appendChild(moonGroup);
    this._moonGroups[key] = { group: moonGroup, caret };
  }

  /**
   * Expand or collapse a planet's moon group.
   * @param {string} planetKey - Parent planet key.
   * @param {boolean} expanded - Target state.
   */
  _setMoonGroupExpanded(planetKey, expanded) {
    const entry = this._moonGroups[planetKey];
    if (!entry) return;
    entry.group.classList.toggle('collapsed', !expanded);
    entry.caret.classList.toggle('expanded', expanded);
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

    // Build planet order with moons nested under their parent
    const planetOrder = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

    this._buttons = {};
    this._moonGroups = {};
    this._moonToParent = {};

    for (const planetKey of planetOrder) {
      this._addBodyWithMoons(itemsContainer, planetKey, PLANET_DATA[planetKey]);
    }

    // Dwarf planets section (the hardcoded planetOrder above excludes them, so
    // an explicit divider + loop is required — mirrors the Stars section).
    const dwarfKeys = Object.keys(PLANET_DATA).filter((k) => PLANET_DATA[k].category === 'dwarf');
    if (dwarfKeys.length > 0) {
      const dwarfDivider = document.createElement('div');
      dwarfDivider.className = 'planet-list-divider';
      dwarfDivider.textContent = 'Dwarf Planets';
      itemsContainer.appendChild(dwarfDivider);

      for (const key of dwarfKeys) {
        this._addBodyWithMoons(itemsContainer, key, PLANET_DATA[key]);
      }
    }

    // Add stars divider and star items
    const divider = document.createElement('div');
    divider.className = 'planet-list-divider';
    divider.textContent = 'Stars';
    itemsContainer.appendChild(divider);

    for (const [key, data] of Object.entries(STAR_DATA)) {
      this._addListItem(itemsContainer, key, data, false);
    }

    this.el.appendChild(itemsContainer);
    document.body.appendChild(this.el);

    // Toggle button for mobile auto-hide
    this._toggleBtn = document.createElement('button');
    this._toggleBtn.className = 'planet-list-toggle';
    this._toggleBtn.innerHTML = '&#9776;';
    this._toggleBtn.title = 'Toggle planet list';
    this._toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleVisibility();
    });
    this._toggleBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    this._toggleBtn.addEventListener('touchstart', (e) => e.stopPropagation());
    document.body.appendChild(this._toggleBtn);

    // Auto-hide on mobile by default
    this._isHidden = false;
    this._checkAutoHide();
    window.addEventListener('resize', () => this._checkAutoHide());
  }

  /**
   * Check screen width and auto-hide panel on narrow screens.
   */
  _checkAutoHide() {
    if (window.innerWidth <= 768) {
      if (!this._isHidden) {
        this.el.classList.add('auto-hidden');
        this._isHidden = true;
      }
    }
  }

  /**
   * Toggle sidebar visibility.
   */
  _toggleVisibility() {
    this._isHidden = !this._isHidden;
    if (this._isHidden) {
      this.el.classList.add('auto-hidden');
    } else {
      this.el.classList.remove('auto-hidden');
    }
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
    // A moon selected via the 3D view (not the caret) must not stay hidden
    // inside a still-collapsed group.
    const parentKey = this._moonToParent[key];
    if (parentKey) {
      this._setMoonGroupExpanded(parentKey, true);
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
