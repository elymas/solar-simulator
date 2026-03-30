/**
 * LoadingScreen displays a full-screen loading overlay with progress bar
 * while textures and assets are being loaded.
 */
export class LoadingScreen {
  constructor() {
    this.isVisible = true;
    this._createDOM();
  }

  /**
   * Create and inject loading screen HTML and CSS into the document.
   */
  _createDOM() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .loading-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #0a0a0f;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        transition: opacity 1s ease-out;
      }
      .loading-screen.fade-out {
        opacity: 0;
        pointer-events: none;
      }
      .loading-content {
        text-align: center;
      }
      .loading-title {
        font-family: 'Inter', sans-serif;
        font-size: 48px;
        font-weight: 300;
        color: #e0e0e0;
        letter-spacing: 8px;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .loading-subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 300;
        color: #16c7ff;
        letter-spacing: 4px;
        text-transform: uppercase;
        margin-bottom: 40px;
      }
      .loading-bar-container {
        width: 300px;
        height: 2px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 1px;
        margin: 0 auto 16px;
        overflow: hidden;
      }
      .loading-bar {
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #16c7ff, #4a9eff);
        border-radius: 1px;
        transition: width 0.3s ease;
      }
      .loading-text {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        color: #888;
      }

      @media (max-width: 768px) {
        .loading-title {
          font-size: 32px;
          letter-spacing: 4px;
        }
        .loading-subtitle {
          font-size: 13px;
          letter-spacing: 3px;
          margin-bottom: 30px;
        }
        .loading-bar-container {
          width: 240px;
        }
      }
    `;
    document.head.appendChild(style);
    this._styleEl = style;

    // Create overlay element
    this.el = document.createElement('div');
    this.el.id = 'loading-screen';
    this.el.className = 'loading-screen';
    this.el.innerHTML = `
      <div class="loading-content">
        <h1 class="loading-title">Solar System</h1>
        <p class="loading-subtitle">3D Simulator</p>
        <div class="loading-bar-container">
          <div class="loading-bar" id="loading-bar"></div>
        </div>
        <p class="loading-text" id="loading-text">Loading textures... 0%</p>
      </div>
    `;

    document.body.appendChild(this.el);

    this._barEl = this.el.querySelector('#loading-bar');
    this._textEl = this.el.querySelector('#loading-text');
  }

  /**
   * Update the progress bar width and percentage text.
   * @param {number} loaded - Number of items loaded so far.
   * @param {number} total - Total number of items to load.
   */
  updateProgress(loaded, total) {
    const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
    this._barEl.style.width = `${pct}%`;
    this._textEl.textContent = `Loading textures... ${pct}%`;
  }

  /**
   * Fade out the loading screen, then remove it from the DOM.
   */
  hide() {
    if (!this.isVisible) return;
    this.isVisible = false;

    this.el.classList.add('fade-out');

    // Remove from DOM after the CSS transition completes
    this.el.addEventListener('transitionend', () => {
      this.el.remove();
      this._styleEl.remove();
    }, { once: true });
  }
}
