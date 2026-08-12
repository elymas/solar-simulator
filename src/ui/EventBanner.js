import { speak } from '../audio/tts.js';

// Celebration banner for the planetary alignment event (SPEC-EVENTS-001
// REQ-EVT-303, REQ-EVT-305).
//
// It knows nothing about alignment: it is told to show a line, and it shows and
// speaks that line once. Deciding WHEN — and the "not again until the formation
// disperses" rule — belongs to AlignmentTracker's hysteresis, not here.

/** How long the banner stays up before dismissing itself. */
export const BANNER_DISPLAY_MS = 6000;

// Height of the top-left chip row (list toggle + sticker badge) this banner has
// to clear. Same figure as PlanetList's TOP_CHROME_PX and for the same reason:
// a 44px kid-sized control at a 16px offset, plus an 8px gap.
const TOP_CHROME_PX = 68;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the child's device asks for reduced motion. An engine without
 * matchMedia (older jsdom, acceptance.md §3) answers "no preference" rather
 * than throwing — motion is the default, and a missing API is not a request.
 * @returns {boolean}
 */
function prefersReducedMotion() {
  try {
    return Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches);
  } catch {
    return false;
  }
}

export class EventBanner {
  constructor() {
    this._timer = null;
    this._injectStyles();
    this._createDOM();
  }

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .event-banner {
        position: fixed;
        /* BELOW the top-left chip row, not level with it. Centring alone does
           not clear those chips: on a phone the banner is wider than the gap
           between them, so its left edge landed on top of the sticker badge
           (found on a real device). Dropping a full chip row down is what
           actually clears them, and it also frees the banner to use the full
           width instead of being squeezed between them. */
        top: calc(${TOP_CHROME_PX}px + env(safe-area-inset-top, 0px));
        left: 50%;
        transform: translateX(-50%);
        max-width: calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
        /* Korean wraps per syllable by default, which splits words mid-token
           ("줄을 섰|어요"). keep-all breaks on spaces instead (REQ-KIDS-105). */
        word-break: keep-all;
        display: none;
        align-items: center;
        gap: 10px;
        padding: 14px 22px;
        background: rgba(26, 26, 46, 0.92);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(22, 199, 255, 0.45);
        border-radius: 14px;
        color: #eaf6ff;
        font-family: 'Inter Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
        font-size: 18px;
        z-index: 200;
        pointer-events: none;
      }
      .event-banner.visible {
        display: flex;
      }
      .event-banner.animated {
        animation: event-banner-in 0.45s ease-out;
      }
      .event-banner.animated .event-banner-spark {
        animation: event-banner-sparkle 1.2s ease-in-out infinite;
      }
      .event-banner-spark {
        font-size: 20px;
      }
      @keyframes event-banner-in {
        from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes event-banner-sparkle {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
    `;
    document.head.appendChild(style);
  }

  _createDOM() {
    this.el = document.createElement('div');
    this.el.className = 'event-banner';
    // role=status + aria-live=polite: announced after the current utterance
    // rather than interrupting it, which is also what the shared TTS channel does.
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');

    this._spark = document.createElement('span');
    this._spark.className = 'event-banner-spark';
    this._spark.textContent = '✨';

    this._text = document.createElement('span');
    this._text.className = 'event-banner-text';

    document.body.appendChild(this.el);
  }

  /**
   * Raise the banner, speak it once, and arm the auto-dismiss.
   * @param {string} text - Korean line, rendered and spoken as one string.
   */
  show(text) {
    const reduced = prefersReducedMotion();
    this._text.textContent = text;
    // The flourish is built out of the DOM under reduced motion rather than
    // merely paused, so there is no sparkle to animate at all (REQ-EVT-305).
    this.el.replaceChildren(...(reduced ? [this._text] : [this._spark, this._text]));
    this.el.classList.toggle('animated', !reduced);
    this.el.classList.add('visible');

    speak(text);

    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.hide(), BANNER_DISPLAY_MS);
  }

  hide() {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.el.classList.remove('visible');
  }
}
