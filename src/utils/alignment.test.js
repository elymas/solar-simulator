import { describe, it, expect } from 'vitest';
import {
  ALIGNMENT_MIN_PLANETS,
  ALIGNMENT_ENTER_DEG,
  ALIGNMENT_EXIT_DEG,
  ALIGNMENT_PLANET_KEYS,
  detectAlignment,
  AlignmentTracker,
} from './alignment.js';
import { PLANET_DATA } from '../planets/planetData.js';
import { MAX_TIME_SPEED } from '../ui/TimeControls.js';

// Four movers plus four bystanders far enough apart to never form a cluster of
// their own, so every fixture below has exactly one candidate window.
const BYSTANDERS = [150, 195, 240, 290];

/** Four longitudes spanning `deg`, plus the bystanders. */
const spread = (deg) => [0, deg / 3, (deg * 2) / 3, deg, ...BYSTANDERS];

describe('alignment detector (REQ-EVT-301, AC-EVT-301)', () => {
  it('exports N, the enter window and the exit window as named constants', () => {
    expect(ALIGNMENT_MIN_PLANETS).toBe(4);
    expect(ALIGNMENT_ENTER_DEG).toBe(30);
    expect(ALIGNMENT_EXIT_DEG).toBe(40);
  });

  it('uses those constants as its defaults', () => {
    // Same fixture read twice: once through the defaults, once with the
    // constants passed explicitly. Divergence would mean an inline literal.
    const longitudes = spread(28);
    expect(detectAlignment(longitudes)).toEqual(
      detectAlignment(longitudes, ALIGNMENT_MIN_PLANETS, ALIGNMENT_ENTER_DEG)
    );
  });

  it('reports an alignment when 4 planets fall within the window', () => {
    const result = detectAlignment([10, 15, 25, 38, ...BYSTANDERS]);
    expect(result.aligned).toBe(true);
    expect(result.windowDeg).toBeCloseTo(28, 6);
    expect([...result.members].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(result.count).toBe(4);
  });

  it('reports no alignment when only 3 planets fall within the window', () => {
    const result = detectAlignment([10, 20, 30, 100, 150, 200, 250, 300]);
    expect(result.aligned).toBe(false);
    expect(result.windowDeg).toBeGreaterThan(ALIGNMENT_ENTER_DEG);
  });

  it('counts the 8 planets only — no dwarf, no comet, no sun', () => {
    expect(ALIGNMENT_PLANET_KEYS).toHaveLength(8);
    for (const key of ALIGNMENT_PLANET_KEYS) {
      expect(PLANET_DATA[key], key).toBeDefined();
      expect(PLANET_DATA[key].category, key).toBeUndefined();
    }
    expect(ALIGNMENT_PLANET_KEYS).not.toContain('sun');
    expect(ALIGNMENT_PLANET_KEYS).not.toContain('halley');
    expect(ALIGNMENT_PLANET_KEYS).not.toContain('pluto');
  });
});

describe('alignment detector edge cases (acceptance.md §3)', () => {
  it('detects a cluster that wraps across 0 degrees', () => {
    const result = detectAlignment([350, 355, 5, 20, ...BYSTANDERS]);
    expect(result.aligned).toBe(true);
    expect(result.windowDeg).toBeCloseTo(30, 6);
    expect([...result.members].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it('enters at exactly 30.0 degrees (the comparison is <=)', () => {
    expect(detectAlignment([0, 10, 20, 30, ...BYSTANDERS]).aligned).toBe(true);
    expect(detectAlignment([0, 10, 20, 30.5, ...BYSTANDERS]).aligned).toBe(false);
  });

  it('reports one window, not two, when five planets hold two qualifying subsets', () => {
    // 0..28 contains both 0..21 and 7..28 as qualifying 4-subsets.
    const longitudes = [0, 7, 14, 21, 28, 150, 200, 260];
    const result = detectAlignment(longitudes);
    expect(result.aligned).toBe(true);
    expect(result.count).toBe(5);
    expect([...result.members].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);

    const tracker = new AlignmentTracker();
    expect(tracker.update(longitudes)).toBe('enter');
    expect(tracker.update(longitudes)).toBeNull();
  });

  it('normalises longitudes outside 0..360 before comparing', () => {
    expect(detectAlignment([-10, -5, 5, 15, ...BYSTANDERS]).aligned).toBe(true);
    expect(detectAlignment([710, 715, 725, 738, ...BYSTANDERS]).aligned).toBe(true);
  });

  it('cannot align fewer planets than the minimum', () => {
    const result = detectAlignment([10, 12, 14]);
    expect(result.aligned).toBe(false);
    expect(result.count).toBe(0);
  });
});

describe('alignment hysteresis (REQ-EVT-302, AC-EVT-302)', () => {
  it('enters at 29, holds through 39, exits at 41', () => {
    const tracker = new AlignmentTracker();
    expect(tracker.update(spread(50))).toBeNull();
    expect(tracker.update(spread(29))).toBe('enter');
    expect(tracker.aligned).toBe(true);
    expect(tracker.update(spread(35))).toBeNull();
    expect(tracker.update(spread(39))).toBeNull();
    expect(tracker.aligned).toBe(true);
    expect(tracker.update(spread(41))).toBe('exit');
    expect(tracker.aligned).toBe(false);
  });

  it('produces exactly one enter while oscillating across the 30 boundary', () => {
    const tracker = new AlignmentTracker();
    const transitions = [];
    for (let i = 0; i < 20; i++) {
      const change = tracker.update(spread(i % 2 === 0 ? 29 : 31));
      if (change) transitions.push(change);
    }
    expect(transitions).toEqual(['enter']);
  });

  it('re-enters only after a real exit', () => {
    const tracker = new AlignmentTracker();
    expect(tracker.update(spread(29))).toBe('enter');
    expect(tracker.update(spread(41))).toBe('exit');
    expect(tracker.update(spread(29))).toBe('enter');
  });
});

// AC-EVT-304. The detector is a state predicate, not an interval test, so the
// proof it owes is that no frame step size or phase can step over the enter and
// exit transitions of a window that lasts longer than one step.
describe('frame-step tolerance (REQ-EVT-304, AC-EVT-304)', () => {
  // Largest simulation step one frame can carry, derived from this codebase:
  //   MAX_TIME_SPEED  = 10^2.7 ~= 501 sim-days per real second (TimeControls
  //                     speed slider's log-scale ceiling).
  //   WORST_FRAME_SEC = 4x the mobile per-frame budget of 1000/30 ms that
  //                     SceneManager gives the FrameBudgetDegrader — four times
  //                     over budget is 7.5fps, past which nothing is playable.
  const WORST_FRAME_SEC = 4 * (1 / 30);
  const MAX_FRAME_STEP_DAYS = MAX_TIME_SPEED * WORST_FRAME_SEC;

  // The four outer planets at their real display periods, all starting from the
  // same longitude at t=0, so they converge and disperse once across the sweep.
  // Real periods (not invented rates) are what make the window's duration an
  // honest number rather than a chosen one.
  const MOVERS = ['jupiter', 'saturn', 'uranus', 'neptune'];
  const longitudesAt = (t) => MOVERS.map((key) => (360 * t) / PLANET_DATA[key].orbitalPeriod);
  const spanAt = (t) => detectAlignment(longitudesAt(t), 4, 360).windowDeg;

  const sweep = (stepDays, phaseDays) => {
    const tracker = new AlignmentTracker({ minPlanets: 4 });
    const events = [];
    for (let t = -1500 + phaseDays; t <= 1500; t += stepDays) {
      const change = tracker.update(longitudesAt(t));
      if (change) events.push({ change, t, span: spanAt(t) });
    }
    return events;
  };

  it('holds the window open far longer than one worst-case frame step', () => {
    expect(MAX_FRAME_STEP_DAYS).toBeGreaterThan(60);
    expect(MAX_FRAME_STEP_DAYS).toBeLessThan(70);
    // Enter near span 30, exit past span 40, at the real outer-planet drift rate.
    const events = sweep(0.25, 0);
    expect(events.map((e) => e.change)).toEqual(['enter', 'exit']);
    expect(events[1].t - events[0].t).toBeGreaterThan(MAX_FRAME_STEP_DAYS * 10);
  });

  it('never skips the enter or the exit at any step size or phase', () => {
    const steps = [0.5, 5, 16.7, MAX_FRAME_STEP_DAYS];
    for (const stepDays of steps) {
      for (const fraction of [0, 0.25, 0.5, 0.75]) {
        const events = sweep(stepDays, stepDays * fraction);
        const label = `step ${stepDays} phase ${fraction}`;
        expect(events.map((e) => e.change), label).toEqual(['enter', 'exit']);
        expect(events[0].span, `${label}: enter`).toBeLessThanOrEqual(ALIGNMENT_ENTER_DEG);
        expect(events[1].span, `${label}: exit`).toBeGreaterThan(ALIGNMENT_EXIT_DEG);
      }
    }
  });
});

describe('alignment per-frame budget (NFR: zero-GC steady state)', () => {
  it('writes into a caller-supplied result instead of allocating one', () => {
    const out = detectAlignment(spread(20));
    const members = out.members;
    const again = detectAlignment(spread(50), ALIGNMENT_MIN_PLANETS, ALIGNMENT_ENTER_DEG, out);
    expect(again).toBe(out);
    expect(again.members).toBe(members);
  });

  it('reuses one result object across tracker updates', () => {
    const tracker = new AlignmentTracker();
    tracker.update(spread(20));
    const first = tracker.result;
    tracker.update(spread(50));
    expect(tracker.result).toBe(first);
  });
});
