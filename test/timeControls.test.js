import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TimeControls } from '../src/ui/TimeControls.js';
import { init as initTts, isMuted } from '../src/audio/tts.js';
import { STR } from '../src/ui/strings.js';

const stubSimApi = () => {
  let speed = 1;
  let playing = true;
  return {
    getSimTime: () => 0,
    setSimTime: () => {},
    setTimeSpeed: (v) => { speed = v; },
    getTimeSpeed: () => speed,
    togglePlay: () => { playing = !playing; },
    isPlaying: () => playing,
  };
};

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('TimeControls speed slider range (10x slower floor)', () => {
  let tc;
  beforeEach(() => {
    tc = new TimeControls(stubSimApi());
  });

  it('extends the slider floor to 0.01x (log10 = -2)', () => {
    expect(tc.speedSlider.min).toBe('-2');
  });

  it('drives the slider down to its new floor and reports 0.01x speed', () => {
    tc.speedSlider.value = '-2';
    tc.speedSlider.dispatchEvent(new Event('input'));
    expect(tc.simApi.getTimeSpeed()).toBeCloseTo(0.01, 5);
    expect(tc.speedValueEl.textContent).toBe('0.01x');
  });

  it('still reads sub-1x speeds set directly with 2-decimal precision', () => {
    tc._updateSpeedDisplay(0.01);
    expect(tc.speedValueEl.textContent).toBe('0.01x');
  });
});

describe('TimeControls Korean chrome (REQ-KIDS-103, REQ-KIDS-105)', () => {
  let tc;
  beforeEach(() => {
    tc = new TimeControls(stubSimApi());
  });

  it('labels speed and date in Korean from the strings module', () => {
    expect(tc.el.querySelector('.speed-label').textContent).toBe(STR.timeSpeed);
    expect(tc.el.querySelector('.date-label').textContent).toBe(STR.timeDate);
  });

  it('renders the simulation date in the Korean form', () => {
    tc.updateDate(0);
    expect(tc.dateEl.textContent).toBe('2026년 3월 30일');
    tc.updateDate(2);
    expect(tc.dateEl.textContent).toBe('2026년 4월 1일');
  });
});

describe('TimeControls sound toggle (REQ-KIDS-207)', () => {
  const fakeStorage = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
    };
  };
  const fakeSynth = () => ({ speak() {}, cancel() {}, getVoices: () => [] });

  it('hides the sound button when there is no speech engine (REQ-KIDS-206)', () => {
    initTts({ synth: undefined, storage: fakeStorage() });
    const tc = new TimeControls(stubSimApi());

    // A control that governs nothing must not look operable — otherwise a parent
    // "mutes" a browser that was never going to speak.
    expect(tc.muteBtn.hidden).toBe(true);
  });

  it('shows the sound button when a speech engine is present', () => {
    initTts({ synth: fakeSynth(), storage: fakeStorage() });
    const tc = new TimeControls(stubSimApi());

    expect(tc.muteBtn.hidden).toBe(false);
  });

  it('renders a sound button labelled in Korean, unmuted by default', () => {
    initTts({ synth: fakeSynth(), storage: fakeStorage() });
    const tc = new TimeControls(stubSimApi());

    expect(tc.muteBtn).toBeTruthy();
    expect(tc.muteBtn.closest('.time-controls')).toBe(tc.el);
    expect(tc.muteBtn.getAttribute('aria-label')).toContain('소리');
    expect(tc.muteBtn.textContent).toBe('🔊');
  });

  it('toggles the shared mute state and the icon on click', () => {
    initTts({ synth: fakeSynth(), storage: fakeStorage() });
    const tc = new TimeControls(stubSimApi());

    tc.muteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(isMuted()).toBe(true);
    expect(tc.muteBtn.textContent).toBe('🔇');
    expect(tc.muteBtn.getAttribute('aria-label')).toContain('소리');

    tc.muteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(isMuted()).toBe(false);
    expect(tc.muteBtn.textContent).toBe('🔊');
  });

  it('reflects the persisted muted state restored by init on boot', () => {
    initTts({ synth: fakeSynth(), storage: fakeStorage({ 'solar.muted': 'true' }) });
    const tc = new TimeControls(stubSimApi());

    expect(tc.muteBtn.textContent).toBe('🔇');
  });
});

describe('TimeControls kid-sized tap targets (REQ-MOB-105, AC-MOB-105)', () => {
  // See test/ui.test.js for why sizes are declared as explicit width/height
  // floors: jsdom cascades class rules into getComputedStyle but has no layout.
  const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]);

  it('gives play, reset and sound buttons a >=44x44 hit area', () => {
    const tc = new TimeControls(stubSimApi());
    for (const [name, btn] of [['play', tc.playPauseBtn], ['reset', tc.resetBtn], ['mute', tc.muteBtn]]) {
      expect(px(btn, 'width'), name).toBeGreaterThanOrEqual(44);
      expect(px(btn, 'height'), name).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('TimeControls two-row wrap keeps buttons at 44px (REQ-MOB-105, AC-MOB-105)', () => {
  // The >=44 computed-width check above passes in jsdom even while a real
  // browser squeezes these buttons to 28px at 402px: jsdom cascades the
  // declared 44px into getComputedStyle but runs no flex layout, so
  // flex-shrink never applies and the computed value never becomes the real
  // one. These are declaration-level guards on the two properties that stop
  // the shrink — weaker than a layout assertion, but the strongest thing
  // jsdom can hold. The real proof is a headed-browser measurement.
  const styleText = () => document.head.querySelector('style').textContent;

  it('pins .control-btn against flex shrinking', () => {
    new TimeControls(stubSimApi());
    expect(styleText()).toMatch(/\.control-btn\s*\{[^}]*flex-shrink:\s*0/);
  });

  it('lets the bar wrap to a second row at phone widths only', () => {
    new TimeControls(stubSimApi());
    const css = styleText();
    const breakpoint = css.indexOf('@media (max-width: 768px)');
    expect(breakpoint, 'the sheet declares a <=768px block').toBeGreaterThan(-1);

    // Scoping is the assertion, not a detail of it. Above 768px the bar has no
    // explicit width, so it is shrink-to-fit: an unscoped wrap there latches —
    // the wrapped layout narrows the container, which keeps it wrapped, and
    // widening the window never recovers one row.
    expect(css.slice(0, breakpoint), 'no unscoped wrap above the breakpoint').not.toMatch(/flex-wrap\s*:/);
    expect(css.slice(breakpoint)).toMatch(/\.time-controls\s*\{[^}]*flex-wrap:\s*wrap/);
  });
});

describe('TimeControls publishes its measured height (REQ-MOB-301)', () => {
  const PROP = '--time-controls-h';
  let restoreHeight = null;

  // jsdom reports offsetHeight as 0 for every element, so the publish path
  // needs a real number to carry.
  const stubOffsetHeight = (px) => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => px });
    return () => {
      if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
      else delete HTMLElement.prototype.offsetHeight;
    };
  };

  afterEach(() => {
    restoreHeight?.();
    restoreHeight = null;
    document.documentElement.style.removeProperty(PROP);
    delete globalThis.ResizeObserver;
  });

  it('publishes the bar height as a CSS custom property on construction', () => {
    restoreHeight = stubOffsetHeight(95);
    new TimeControls(stubSimApi());

    expect(document.documentElement.style.getPropertyValue(PROP)).toBe('95px');
  });

  it('republishes on resize, so wrapping to two rows moves the strip with it', () => {
    let observerCallback = null;
    globalThis.ResizeObserver = class {
      constructor(fn) { observerCallback = fn; }
      observe() {}
      disconnect() {}
    };

    restoreHeight = stubOffsetHeight(68);
    new TimeControls(stubSimApi());
    expect(document.documentElement.style.getPropertyValue(PROP)).toBe('68px');

    // The bar wraps: same viewport, taller bar (a longer date string alone can
    // trigger this), so a viewport-keyed constant would never see the change.
    restoreHeight();
    restoreHeight = stubOffsetHeight(95);
    observerCallback();

    expect(document.documentElement.style.getPropertyValue(PROP)).toBe('95px');
  });
});

describe('TimeControls safe-area inset (REQ-PWA-103)', () => {
  it('adds a safe-area-inset-bottom padding term additive to the base bottom padding', () => {
    new TimeControls(stubSimApi());
    const styleText = document.head.querySelector('style').textContent;
    expect(styleText).toContain('padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));');
  });
});
