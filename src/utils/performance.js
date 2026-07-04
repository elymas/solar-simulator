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
