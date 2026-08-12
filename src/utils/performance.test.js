import { describe, it, expect } from 'vitest';
import { rollingFps, shouldDegrade, FrameBudgetDegrader, EARTH_DEGRADE_STEPS } from './performance.js';

describe('rollingFps', () => {
  it('returns 0 for an empty window', () => {
    expect(rollingFps([])).toBe(0);
  });

  it('computes frames divided by total elapsed time', () => {
    // 3 frames at 1/60s each => 60 fps
    expect(rollingFps([1 / 60, 1 / 60, 1 / 60])).toBeCloseTo(60);
  });

  it('reports low fps for long frame deltas', () => {
    // 2 frames over 0.2s => 10 fps
    expect(rollingFps([0.1, 0.1])).toBeCloseTo(10);
  });
});

describe('shouldDegrade', () => {
  const windowSize = 3;

  it('never degrades on desktop regardless of fps', () => {
    expect(
      shouldDegrade({ deltas: [0.1, 0.1, 0.1], windowSize, thresholdFps: 30, isMobile: false })
    ).toBe(false);
  });

  it('waits until the sample window is full', () => {
    expect(
      shouldDegrade({ deltas: [0.1, 0.1], windowSize, thresholdFps: 30, isMobile: true })
    ).toBe(false);
  });

  it('degrades when mobile fps is sustained below threshold', () => {
    // 3 frames over 0.15s => 20 fps < 30
    expect(
      shouldDegrade({ deltas: [0.05, 0.05, 0.05], windowSize, thresholdFps: 30, isMobile: true })
    ).toBe(true);
  });

  it('stays healthy when mobile fps meets threshold', () => {
    // 3 frames at 1/60s => 60 fps >= 30
    expect(
      shouldDegrade({ deltas: [1 / 60, 1 / 60, 1 / 60], windowSize, thresholdFps: 30, isMobile: true })
    ).toBe(false);
  });
});

describe('EARTH_DEGRADE_STEPS — meteors join the ladder after aurora (REQ-E3-106)', () => {
  it('is the 5-step ladder: aurora, meteors, bloom, lod, pixelRatio', () => {
    expect(EARTH_DEGRADE_STEPS).toEqual(['aurora', 'meteors', 'bloom', 'lod', 'pixelRatio']);
  });

  it('sheds aurora, then meteors, then bloom in that order under sustained over-budget frames', () => {
    const budgetMs = 1000 / 60;
    const over = () => budgetMs + 5;
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30, steps: EARTH_DEGRADE_STEPS });
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('aurora');
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('meteors');
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('bloom');
  });
});
