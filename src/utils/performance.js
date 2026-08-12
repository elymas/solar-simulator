// Live performance degradation decision for REQ-018 (mobile only).
// ponytail: one degradation trigger for the single render loop, not a perf framework.

/**
 * Average frame rate over a window of frame deltas (seconds).
 * @param {number[]} deltas - Per-frame delta times in seconds.
 * @returns {number} Frames per second, or 0 when the window is empty/degenerate.
 */
export function rollingFps(deltas) {
  const total = deltas.reduce((sum, d) => sum + d, 0);
  if (total <= 0) return 0;
  return deltas.length / total;
}

/**
 * Decide whether to drop rendering quality. Only mobile devices degrade,
 * and only once a full sample window sustains an average below the threshold.
 * @param {Object} opts
 * @param {number[]} opts.deltas - Rolling window of frame deltas (seconds).
 * @param {number} opts.windowSize - Frames required before a decision is made.
 * @param {number} opts.thresholdFps - Average fps at or below which to degrade.
 * @param {boolean} opts.isMobile - Whether the device is mobile.
 * @returns {boolean}
 */
export function shouldDegrade({ deltas, windowSize, thresholdFps, isMobile }) {
  if (!isMobile) return false;
  if (deltas.length < windowSize) return false;
  return rollingFps(deltas) < thresholdFps;
}

// Strict priority order for frame-budget degradation (REQ-240). Core interaction
// (camera controls, click/hover picking) is deliberately absent — it is preserved
// at every degradation level.
//
// This is the SOLAR ladder: it is the FrameBudgetDegrader's default and the one
// ViewManager restores on leaving the Earth view, so it is the ladder the solar
// view actually runs. The belts join it at the head (SPEC-EVENTS-001
// REQ-EVT-204): a few thousand instanced rocks are pure scenery, so halving them
// costs a child nothing, while bloom, surface detail and resolution all change
// how the real bodies look.
export const DEGRADE_STEPS = ['belts', 'bloom', 'lod', 'pixelRatio'];

// @MX:NOTE: [AUTO] Earth-view ladder (SPEC-EARTH-002 REQ-650): the decorative aurora
// sheds FIRST, before the SIM-001 bloom/lod/pixelRatio order. Only active while the
// Earth view is the active view (ViewManager swaps the degrader's steps on enter/exit).
// No 'belts' step here — the belts live in the solar scene, which the Earth view
// does not render, so there is nothing to shed.
export const EARTH_DEGRADE_STEPS = ['aurora', 'bloom', 'lod', 'pixelRatio'];

/**
 * Frame-budget priority degrader (REQ-240). Pure state machine: feed it a frame
 * time each frame and it decides when to shed a non-essential effect. It steps
 * down one level after a sustained run of over-budget frames, and recovers one
 * level (in reverse) after a sustained run of good frames.
 */
export class FrameBudgetDegrader {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.budgetMs] - Per-frame budget in ms (16.67 desktop / 33.3 mobile).
   * @param {number} [opts.overBudgetFrames] - Consecutive over-budget frames before degrading.
   * @param {number} [opts.recoverFrames] - Consecutive good frames before recovering a level.
   */
  constructor({ budgetMs = 1000 / 60, overBudgetFrames = 30, recoverFrames = 60, steps = DEGRADE_STEPS } = {}) {
    this.budgetMs = budgetMs;
    this.overBudgetFrames = overBudgetFrames;
    this.recoverFrames = recoverFrames;
    this.steps = steps;
    this.level = 0;
    this._over = 0;
    this._under = 0;
  }

  /**
   * Swap the degradation ladder at runtime (e.g. ViewManager entering/leaving the
   * Earth view, which prepends 'aurora'). Resets the level and streak counters so the
   * new ladder starts clean.
   * @param {string[]} steps
   */
  setSteps(steps) {
    this.steps = steps;
    this.level = 0;
    this._over = 0;
    this._under = 0;
  }

  /**
   * Record one frame time. Returns the step applied (a member of the active
   * ladder), the step recovered ('restore:<step>'), or null when nothing changed.
   * @param {number} frameMs - Frame duration in milliseconds.
   * @returns {string|null}
   */
  record(frameMs) {
    if (frameMs > this.budgetMs) {
      this._under = 0;
      this._over += 1;
      if (this._over >= this.overBudgetFrames && this.level < this.steps.length) {
        this._over = 0;
        this.level += 1;
        return this.steps[this.level - 1];
      }
      return null;
    }

    this._over = 0;
    this._under += 1;
    if (this._under >= this.recoverFrames && this.level > 0) {
      this._under = 0;
      const restored = this.steps[this.level - 1];
      this.level -= 1;
      return `restore:${restored}`;
    }
    return null;
  }

  /**
   * Steps currently shed, in the order they were applied.
   * @returns {string[]}
   */
  get activeSteps() {
    return this.steps.slice(0, this.level);
  }
}
