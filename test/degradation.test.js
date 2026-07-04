import { describe, it, expect } from 'vitest';
import { FrameBudgetDegrader, DEGRADE_STEPS } from '../src/utils/performance.js';

const budgetMs = 1000 / 60; // ~16.67ms desktop budget
const over = () => budgetMs + 5;
const under = () => budgetMs - 5;

describe('FrameBudgetDegrader priority order (REQ-240, TASK-010)', () => {
  it('degrades bloom -> lod -> pixelRatio, 30 consecutive over-budget frames each', () => {
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30 });
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('bloom');
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('lod');
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('pixelRatio');
    // Floor reached: further over-budget frames change nothing.
    for (let i = 0; i < 60; i++) expect(d.record(over())).toBeNull();
    expect(d.level).toBe(3);
  });

  it('resets the over-budget streak on a single good frame', () => {
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30 });
    for (let i = 0; i < 29; i++) d.record(over());
    expect(d.record(under())).toBeNull(); // streak broken before it could fire
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('bloom'); // requires a fresh run of 30
  });

  it('recovers in reverse order after sustained good frames', () => {
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30, recoverFrames: 60 });
    for (let i = 0; i < 30; i++) d.record(over()); // -> bloom (level 1)
    for (let i = 0; i < 30; i++) d.record(over()); // -> lod (level 2)
    expect(d.level).toBe(2);
    for (let i = 0; i < 59; i++) expect(d.record(under())).toBeNull();
    expect(d.record(under())).toBe('restore:lod'); // last applied recovers first
    expect(d.level).toBe(1);
  });

  it('never degrades core interaction (camera/picking are not steps)', () => {
    expect(DEGRADE_STEPS).toEqual(['bloom', 'lod', 'pixelRatio']);
    expect(DEGRADE_STEPS).not.toContain('controls');
    expect(DEGRADE_STEPS).not.toContain('picking');
  });
});
