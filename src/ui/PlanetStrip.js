import { PLANET_DATA, STAR_DATA, BELT_DATA } from '../planets/planetData.js';
import { STR } from './strings.js';

// The sidebar's own auto-hide breakpoint. The strip is the sidebar's mobile
// stand-in, so both switch at exactly the same width — never two selectors,
// never none. A phone in landscape (874pt) is already past this.
const MOBILE_MAX_WIDTH_PX = 768;

// Fallback only, used until TimeControls publishes its measured height:
// a one-row bar, 44px control button plus its 10px padding either side. The
// safe-area inset is added on top of this, not folded into it, so the strip
// rides above the home indicator too. The published height already includes
// that inset (it is a border-box measurement), which is why the env() term
// lives inside the fallback and not outside the var().
const ABOVE_TIME_CONTROLS_PX = 64;

/**
 * PlanetStrip is the primary body selector on phones: a bottom horizontal,
 * touch-scrollable row of tappable icons sitting directly above the
 * TimeControls bar, where a child's thumb already rests.
 *
 * It renders only at <=768px, where PlanetList auto-hides itself; past that
 * width the strip leaves the DOM entirely and the desktop sidebar is the sole
 * selector. Items come straight from the shared body registry, so a body added
 * by a later SPEC appears here without touching this file.
 */
export class PlanetStrip {
  constructor() {
    this.onSelect = null;
    this._buttons = {};
    this._injectStyles();
    this._createDOM();
    this._applyViewport();
    this._observeSize();
    window.addEventListener('resize', () => this._applyViewport());
  }

  /**
   * Inject CSS styles for the icon strip.
   */
  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .planet-strip {
        position: fixed;
        left: 0;
        right: 0;
        /* Stacked directly on top of the TimeControls bar, tracking the height
           that bar measures and publishes — it wraps to two rows on a phone,
           so its height is content-dependent and no constant follows it
           (REQ-MOB-301). The fallback keeps the safe-area inset additive
           (REQ-PWA-103) so the two never overlap the home indicator. */
        bottom: var(--time-controls-h, calc(${ABOVE_TIME_CONTROLS_PX}px + env(safe-area-inset-bottom, 0px)));
        display: flex;
        gap: 8px;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        padding: 8px calc(12px + env(safe-area-inset-left, 0px));
        background: rgba(26, 26, 46, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-top: 1px solid rgba(22, 199, 255, 0.15);
        z-index: 100;
        font-family: 'Inter Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
        scrollbar-width: none;
      }
      .planet-strip::-webkit-scrollbar {
        display: none;
      }
      .planet-strip-item {
        /* No shrinking: the row scrolls instead of squeezing targets below the
           kid-friendly 48px floor (REQ-MOB-105, REQ-MOB-302). */
        flex: 0 0 auto;
        min-width: 48px;
        min-height: 48px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 4px 6px;
        background: none;
        border: none;
        border-radius: 10px;
        color: #ccc;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
      }
      .planet-strip-item.active {
        background: rgba(22, 199, 255, 0.15);
        color: #16c7ff;
        box-shadow: inset 0 0 0 1px rgba(22, 199, 255, 0.45);
      }
      .planet-strip-token {
        font-size: 22px;
        line-height: 1;
      }
      .planet-strip-dot {
        width: 18px;
        height: 18px;
        border-radius: 50%;
      }
      .planet-strip-name {
        font-size: 11px;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Build the scroll row and one button per registry body.
   */
  _createDOM() {
    this.el = document.createElement('div');
    this.el.className = 'planet-strip';
    // Every top-level body the sidebar knows, in sidebar order: Sun, planets,
    // dwarf planets and the comet, then the belts, then the stars. Moons are
    // deliberately absent (spec.md §6) — they stay reachable through the 3D
    // scene and the sidebar.
    //
    // The belts have to be named here because they are not in PLANET_DATA:
    // they carry no mesh of their own in the picking registry (SPEC-EVENTS-001
    // REQ-EVT-203). On a phone the sidebar is auto-hidden and this strip is the
    // selector, so leaving them out would make them unreachable.
    for (const [key, data] of [
      ...Object.entries(PLANET_DATA),
      ...Object.entries(BELT_DATA),
      ...Object.entries(STAR_DATA),
    ]) {
      this._addItem(key, data);
    }
  }

  /**
   * Add one tappable body button.
   * @param {string} key - Registry key.
   * @param {Object} data - Body data with optional emoji, nameKo, name, color.
   */
  _addItem(key, data) {
    // nameKo is the primary label everywhere in this UI; a registry body
    // without one still needs something readable (acceptance.md §3).
    const name = data.nameKo || data.name || key;

    const btn = document.createElement('button');
    btn.className = 'planet-strip-item';
    btn.dataset.key = key;
    btn.setAttribute('aria-label', STR.stripSelect(name));

    const token = document.createElement('span');
    if (data.emoji) {
      token.className = 'planet-strip-token';
      token.textContent = data.emoji;
    } else {
      // No SPEC-KIDS-001 emoji for this body: fall back to its own colour.
      token.className = 'planet-strip-token planet-strip-dot';
      const hex = data.color || data.emissive || 0xffffff;
      token.style.background = '#' + hex.toString(16).padStart(6, '0');
    }

    const label = document.createElement('span');
    label.className = 'planet-strip-name';
    label.textContent = name;

    btn.append(token, label);
    btn.addEventListener('click', () => {
      if (this.onSelect) this.onSelect(key);
    });

    this.el.appendChild(btn);
    this._buttons[key] = btn;
  }

  /**
   * Mount the strip on phone-width viewports, unmount it past the breakpoint.
   * Re-run on resize so a rotation into landscape hands the selector back to
   * the sidebar.
   */
  _applyViewport() {
    const mobile = window.innerWidth <= MOBILE_MAX_WIDTH_PX;
    if (mobile && !this.el.isConnected) {
      document.body.appendChild(this.el);
    } else if (!mobile && this.el.isConnected) {
      this.el.remove();
    }
    this._publishHeight();
  }

  /**
   * Publish this strip's measured height so whatever sits above it can stack on
   * top instead of guessing. Mirrors TimeControls._publishHeight, and exists for
   * the same reason: the strip's height is content-dependent (icon size, safe-area
   * padding, font metrics), so no constant follows it. PlanetList reads this to
   * find where the bottom chrome starts — without it the list had no way to know
   * the strip was there and grew straight through it (found on a real device).
   */
  _publishHeight() {
    const root = document.documentElement;
    // Off-screen (desktop): contribute nothing, so consumers collapse to just
    // the time-controls bar rather than reserving space for an absent strip.
    if (!this.el.isConnected) {
      root.style.setProperty('--planet-strip-h', '0px');
      return;
    }
    const height = this.el.offsetHeight;
    // 0 means "not laid out yet" (or jsdom): leave the previous value alone
    // rather than briefly collapsing consumers onto the bar.
    if (height > 0) root.style.setProperty('--planet-strip-h', `${height}px`);
  }

  _observeSize() {
    if (typeof ResizeObserver === 'undefined') return;
    this._resizeObserver = new ResizeObserver(() => this._publishHeight());
    this._resizeObserver.observe(this.el);
  }

  /**
   * Highlight the selected body and centre it in the scroll row.
   * @param {string} key - Body key, which may not be in the strip.
   */
  setActive(key) {
    this.clearActive();

    const btn = this._buttons[key];
    // A moon tapped in the 3D view has no strip row. Leaving the strip
    // unhighlighted and unscrolled is the honest state (acceptance.md §3).
    if (!btn) return;

    btn.classList.add('active');
    // Guarded: jsdom implements no scrollIntoView, and centring is a nicety.
    btn.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  }

  /**
   * Remove the highlight from every item.
   */
  clearActive() {
    for (const btn of Object.values(this._buttons)) {
      btn.classList.remove('active');
    }
  }
}
