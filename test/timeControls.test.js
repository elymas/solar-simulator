import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TimeControls } from '../src/ui/TimeControls.js';

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

describe('TimeControls safe-area inset (REQ-PWA-103)', () => {
  it('adds a safe-area-inset-bottom padding term additive to the base bottom padding', () => {
    new TimeControls(stubSimApi());
    const styleText = document.head.querySelector('style').textContent;
    expect(styleText).toContain('padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));');
  });
});
