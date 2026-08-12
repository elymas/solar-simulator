import { describe, it, expect } from 'vitest';
import { FrameBudgetDegrader, DEGRADE_STEPS, EARTH_DEGRADE_STEPS } from '../src/utils/performance.js';

const budgetMs = 1000 / 60;
const over = () => budgetMs + 5;

describe('EARTH_DEGRADE_STEPS — aurora sheds FIRST (REQ-650, AC-AURORA-02)', () => {
  it('places aurora before bloom, then keeps the SIM-001 ladder order', () => {
    expect(EARTH_DEGRADE_STEPS).toEqual(['aurora', 'meteors', 'bloom', 'lod', 'pixelRatio']);
    expect(EARTH_DEGRADE_STEPS.indexOf('aurora')).toBeLessThan(EARTH_DEGRADE_STEPS.indexOf('bloom'));
  });

  it('leaves the solar default ladder untouched (no regression)', () => {
    expect(DEGRADE_STEPS).toEqual(['bloom', 'lod', 'pixelRatio']);
  });

  it('a degrader configured with earth steps sheds aurora on the first degradation', () => {
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30, steps: EARTH_DEGRADE_STEPS });
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('aurora');
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('meteors');
  });

  it('setSteps swaps the ladder at runtime and resets the level (view switch)', () => {
    const d = new FrameBudgetDegrader({ budgetMs, overBudgetFrames: 30 }); // default solar
    for (let i = 0; i < 30; i++) d.record(over()); // -> bloom, level 1
    expect(d.level).toBe(1);
    d.setSteps(EARTH_DEGRADE_STEPS); // enter earth view
    expect(d.level).toBe(0);
    for (let i = 0; i < 29; i++) expect(d.record(over())).toBeNull();
    expect(d.record(over())).toBe('aurora'); // now sheds aurora first
  });
});
