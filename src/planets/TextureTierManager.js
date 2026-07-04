/**
 * TextureTierManager decides when to lazy-load a body's high-resolution texture
 * tier (REQ-290). The hi-res tier is never in the initial bundle; it is fetched
 * on first focus and cached so a body upgrades at most once.
 *
 * Pure logic only — the actual GPU texture swap lives in PlanetFactory.
 */
export class TextureTierManager {
  /**
   * @param {Object<string,string>} hiResMap - Body key -> hi-res texture path.
   */
  constructor(hiResMap = {}) {
    this._hiRes = hiResMap;
    this._upgraded = new Set();
  }

  /**
   * Whether a body still has an un-loaded hi-res tier available.
   * @param {string} key
   * @returns {boolean}
   */
  hasUpgrade(key) {
    return Boolean(this._hiRes[key]) && !this._upgraded.has(key);
  }

  /**
   * Whether a body's hi-res tier has already been loaded.
   * @param {string} key
   * @returns {boolean}
   */
  isUpgraded(key) {
    return this._upgraded.has(key);
  }

  /**
   * Claim the hi-res path to load for a body, or null when there is nothing to
   * do (no hi-res tier, or already upgraded). Marks the body upgraded up front
   * so a repeated focus never triggers a second load.
   * @param {string} key
   * @returns {string|null}
   */
  requestUpgrade(key) {
    if (this._upgraded.has(key)) return null;
    const path = this._hiRes[key];
    if (!path) return null;
    this._upgraded.add(key);
    return path;
  }
}
