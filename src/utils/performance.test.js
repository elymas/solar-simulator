import { describe, it, expect } from 'vitest';
import {
  rollingFps,
  shouldDegrade,
  FrameBudgetDegrader,
  DEGRADE_STEPS,
  EARTH_DEGRADE_STEPS,
} from './performance.js';

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

// SPEC-EVENTS-001 REQ-EVT-204 / AC-EVT-204. A few thousand instanced rocks are
// pure scenery, so they are the cheapest thing in the solar view to give up —
// cheaper than the sun's glow, than surface detail, and far cheaper than
// resolution. That puts 'belts' at the head of the solar ladder.
describe('solar degradation ladder sheds belts first (REQ-EVT-204)', () => {
  const budgetMs = 1000 / 60;
  const over = () => budgetMs + 5;
  const under = () => budgetMs - 5;

  it('orders the solar steps belts -> bloom -> lod -> pixelRatio', () => {
    expect(DEGRADE_STEPS).toEqual(['belts', 'bloom', 'lod', 'pixelRatio']);
  });

  it('puts belts ahead of every other solar step', () => {
    for (const step of ['bloom', 'lod', 'pixelRatio']) {
      expect(DEGRADE_STEPS.indexOf('belts'), step).toBeLessThan(DEGRADE_STEPS.indexOf(step));
    }
  });

  it('still never degrades core interaction', () => {
    expect(DEGRADE_STEPS).not.toContain('controls');
    expect(DEGRADE_STEPS).not.toContain('picking');
  });

  it('leaves the Earth ladder alone — that view has no belts to shed', () => {
    expect(EARTH_DEGRADE_STEPS).not.toContain('belts');
  });

  it('sheds belts on the first degradation, before bloom, lod or pixelRatio', () => {
    // Default construction == the solar view's degrader (SceneManager passes no
    // steps), so this is the ladder the solar view actually runs.
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30 });
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('belts');
    expect(d.activeSteps).toEqual(['belts']);

    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('bloom');
  });

  it('walks the whole ladder under sustained pressure and stops at the floor', () => {
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30 });
    const shed = [];
    for (let i = 0; i < 30 * 5; i++) {
      const step = d.record(over());
      if (step) shed.push(step);
    }
    expect(shed).toEqual(['belts', 'bloom', 'lod', 'pixelRatio']);
    expect(d.level).toBe(4);
  });

  it('restores belts last, only after everything else has recovered', () => {
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30, recoverFrames: 60 });
    for (let i = 0; i < 30 * 4; i++) d.record(over()); // whole ladder shed
    const restored = [];
    for (let i = 0; i < 60 * 4; i++) {
      const step = d.record(under());
      if (step) restored.push(step);
    }
    expect(restored).toEqual([
      'restore:pixelRatio',
      'restore:lod',
      'restore:bloom',
      'restore:belts',
    ]);
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
