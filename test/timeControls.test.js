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

describe('TimeControls safe-area inset (REQ-PWA-103)', () => {
  it('adds a safe-area-inset-bottom padding term additive to the base bottom padding', () => {
    new TimeControls(stubSimApi());
    const styleText = document.head.querySelector('style').textContent;
    expect(styleText).toContain('padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));');
  });
});
