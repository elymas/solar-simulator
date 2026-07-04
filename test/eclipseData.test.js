import { describe, it, expect } from 'vitest';
import { SIM_EPOCH_MS } from '../src/utils/constants.js';
import {
  ECLIPSE_TABLE,
  toSimDay,
  detectEclipsesInRange,
  findNextEclipse,
  isSolar,
  isLunar,
} from '../src/utils/eclipseData.js';

const DAY_MS = 86400000;

describe('eclipse table provenance (REQ-510/550: real events only)', () => {
  it('is non-empty, sorted by simDay, and every entry has a real ISO date + typed kind', () => {
    expect(ECLIPSE_TABLE.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < ECLIPSE_TABLE.length; i++) {
      expect(ECLIPSE_TABLE[i].simDay).toBeGreaterThan(ECLIPSE_TABLE[i - 1].simDay);
    }
    for (const e of ECLIPSE_TABLE) {
      expect(Number.isNaN(Date.parse(e.date))).toBe(false);
      expect(isSolar(e.type) || isLunar(e.type)).toBe(true);
    }
  });

  it('maps a real date to sim-days from the shared epoch', () => {
    const d = new Date(SIM_EPOCH_MS + 10 * DAY_MS).toISOString();
    expect(toSimDay(d)).toBeCloseTo(10, 6);
  });
});

describe('detectEclipsesInRange — frame-step independent (REQ-530, AC-ECLIPSE-02)', () => {
  it('detects an eclipse whose instant falls inside a small step', () => {
    const target = ECLIPSE_TABLE[0];
    const hits = detectEclipsesInRange(target.simDay - 0.01, target.simDay + 0.01);
    expect(hits.map((h) => h.date)).toContain(target.date);
  });

  it('does NOT miss eclipses across a huge 500x-style time jump spanning many entries', () => {
    // A single frame at 500x can leap years; a range test catches every entry inside.
    const lo = ECLIPSE_TABLE[0].simDay - 1;
    const hi = ECLIPSE_TABLE[ECLIPSE_TABLE.length - 1].simDay + 1;
    const hits = detectEclipsesInRange(lo, hi);
    expect(hits.length).toBe(ECLIPSE_TABLE.length);
  });

  it('is half-open (lo, hi] so consecutive frames never double-detect the same eclipse', () => {
    const t = ECLIPSE_TABLE[0].simDay;
    // frame N-1 ended exactly on the eclipse instant; frame N starts there.
    const frameN = detectEclipsesInRange(t, t + 0.5);
    expect(frameN.map((h) => h.date)).not.toContain(ECLIPSE_TABLE[0].date);
    const framePrev = detectEclipsesInRange(t - 0.5, t);
    expect(framePrev.map((h) => h.date)).toContain(ECLIPSE_TABLE[0].date);
  });

  it('returns [] for a window containing no eclipse (no fabricated events, REQ-550)', () => {
    // A 1-day window landing between two table entries.
    const gapStart = ECLIPSE_TABLE[0].simDay + 1;
    const hits = detectEclipsesInRange(gapStart, gapStart + 0.5);
    expect(hits).toEqual([]);
  });
});

describe('findNextEclipse — bounded forward search (REQ-540)', () => {
  it('returns the first eclipse strictly after now', () => {
    const first = ECLIPSE_TABLE[0];
    const next = findNextEclipse(first.simDay - 5);
    expect(next.date).toBe(first.date);
  });

  it('skips the current instant and returns the following eclipse', () => {
    const next = findNextEclipse(ECLIPSE_TABLE[0].simDay);
    expect(next.date).toBe(ECLIPSE_TABLE[1].date);
  });

  it('returns null when no eclipse falls within the bounded window', () => {
    const last = ECLIPSE_TABLE[ECLIPSE_TABLE.length - 1];
    expect(findNextEclipse(last.simDay + 1)).toBeNull();
  });

  it('honors a custom (shorter) search window', () => {
    const first = ECLIPSE_TABLE[0];
    // window of 1 day from well before the first eclipse finds nothing.
    expect(findNextEclipse(first.simDay - 100, 1)).toBeNull();
  });
});
