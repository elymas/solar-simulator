import { describe, it, expect } from 'vitest';
import { SIM_EPOCH_MS } from './constants.js';
import { SHOWER_TABLE, isShowerActive, showerIntensity, detectShowerEntries } from './meteorData.js';

const DAY_MS = 86400000;

/** Convert a real UTC ISO instant to a sim-day number against the shared epoch. */
function simDayFor(iso) {
  return (Date.parse(iso) - SIM_EPOCH_MS) / DAY_MS;
}

describe('SHOWER_TABLE — REQ-E3-101, AC-E3-101', () => {
  it('has exactly the four canonical showers with byte-exact Korean names', () => {
    const byId = Object.fromEntries(SHOWER_TABLE.map((s) => [s.id, s]));
    expect(byId.quadrantids.koreanName).toBe('사분의 유성우');
    expect(byId.lyrids.koreanName).toBe('거문고 유성우');
    expect(byId.perseids.koreanName).toBe('페르세우스 유성우');
    expect(byId.geminids.koreanName).toBe('쌍둥이 유성우');
  });

  it('encodes the Quadrantids range as start > end (explicit wrap)', () => {
    const q = SHOWER_TABLE.find((s) => s.id === 'quadrantids');
    expect(q.start).toBeGreaterThan(q.end);
  });
});

describe('isShowerActive — wrap-aware activity predicate (REQ-E3-102, AC-E3-102)', () => {
  it('Quadrantids is active on Dec 30 and Jan 5, inactive on Jan 20', () => {
    expect(isShowerActive(simDayFor('2026-12-30T00:00:00Z'))?.id).toBe('quadrantids');
    expect(isShowerActive(simDayFor('2027-01-05T00:00:00Z'))?.id).toBe('quadrantids');
    expect(isShowerActive(simDayFor('2027-01-20T00:00:00Z'))).toBeNull();
  });
});

describe('showerIntensity — piecewise-linear taper (REQ-E3-102, AC-E3-102)', () => {
  it('is exactly 1.0 at the Perseids peak (Aug 12) and 0 at the range start and true closing instants', () => {
    expect(showerIntensity(simDayFor('2026-08-12T00:00:00Z'))).toBeCloseTo(1, 6);
    expect(showerIntensity(simDayFor('2026-07-17T00:00:00Z'))).toBeCloseTo(0, 6);
    // MOVED (not weakened): Aug 24 is the end DATE, active for a full 24h
    // under sub-day interpolation — its midnight is now > 0 (see the
    // dedicated "last active day" test below). The range's true closing
    // instant is one day later, at the start of Aug 25.
    expect(showerIntensity(simDayFor('2026-08-25T00:00:00Z'))).toBeCloseTo(0, 6);
  });

  it('rises monotonically from the start edge to the peak', () => {
    const values = ['2026-07-17', '2026-07-25', '2026-08-01', '2026-08-08', '2026-08-12'].map((d) =>
      showerIntensity(simDayFor(`${d}T00:00:00Z`))
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it('falls monotonically from the peak to the end edge', () => {
    const values = ['2026-08-12', '2026-08-16', '2026-08-20', '2026-08-24'].map((d) =>
      showerIntensity(simDayFor(`${d}T00:00:00Z`))
    );
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
  });

  it('is 0 outside any active range', () => {
    expect(showerIntensity(simDayFor('2027-01-20T00:00:00Z'))).toBe(0);
  });
});

describe('showerIntensity — sub-day interpolation on entry day (regression: whole first day was flat 0)', () => {
  it('is greater than 0 at midday of the range start day and keeps rising across that day', () => {
    const start = simDayFor('2026-07-17T00:00:00Z');
    const midday = simDayFor('2026-07-17T12:00:00Z');
    const lateDay = simDayFor('2026-07-17T23:59:59Z');
    expect(showerIntensity(start)).toBe(0);
    expect(showerIntensity(midday)).toBeGreaterThan(0);
    expect(showerIntensity(lateDay)).toBeGreaterThan(showerIntensity(midday));
  });

  it('is still exactly 0 at the range start instant and exactly 1.0 at the peak instant', () => {
    expect(showerIntensity(simDayFor('2026-07-17T00:00:00Z'))).toBe(0);
    expect(showerIntensity(simDayFor('2026-08-12T00:00:00Z'))).toBeCloseTo(1, 6);
  });

  it('never goes negative or above 1, sampled at sub-day steps across the whole range including late on the final day', () => {
    const from = simDayFor('2026-07-17T00:00:00Z');
    const to = simDayFor('2026-08-25T00:00:00Z'); // one step past the range end
    for (let t = from; t <= to; t += 0.25) {
      const v = showerIntensity(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(showerIntensity(simDayFor('2026-08-24T23:59:59Z'))).toBeGreaterThanOrEqual(0);
  });

  it('rises monotonically from start to peak and falls monotonically from peak to end, at sub-day resolution', () => {
    const rising = [];
    for (let t = simDayFor('2026-07-17T00:00:00Z'); t <= simDayFor('2026-08-12T00:00:00Z'); t += 0.5) {
      rising.push(showerIntensity(t));
    }
    for (let i = 1; i < rising.length; i++) expect(rising[i]).toBeGreaterThanOrEqual(rising[i - 1]);

    const falling = [];
    for (let t = simDayFor('2026-08-12T00:00:00Z'); t <= simDayFor('2026-08-24T00:00:00Z'); t += 0.5) {
      falling.push(showerIntensity(t));
    }
    for (let i = 1; i < falling.length; i++) expect(falling[i]).toBeLessThanOrEqual(falling[i - 1]);
  });

  it('the last active day is no longer dead: intensity at its midnight is > 0 and decreases monotonically across the day to (near) 0 at its close (regression: the descending taper used to floor to 0 for the entire final day)', () => {
    const endDayStart = simDayFor('2026-08-24T00:00:00Z');
    expect(showerIntensity(endDayStart)).toBeGreaterThan(0);

    const samples = [0, 4, 8, 12, 16, 20, 23.9].map((h) => showerIntensity(endDayStart + h / 24));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }
    expect(samples[samples.length - 1]).toBeCloseTo(0, 2);
  });
});

describe('detectShowerEntries — half-open (prevDay, currDay] crossing (REQ-E3-102, AC-E3-102)', () => {
  it('detects a 1-day-step entry crossing the Quadrantids start boundary', () => {
    const dec27 = simDayFor('2026-12-27T00:00:00Z');
    const dec28 = simDayFor('2026-12-28T00:00:00Z');
    const entries = detectShowerEntries(dec27, dec28);
    expect(entries.map((e) => e.id)).toEqual(['quadrantids']);
  });

  it('still catches the entry at a coarse 400-day step, with no skip and no duplicate', () => {
    const before = simDayFor('2026-01-01T00:00:00Z');
    const entries = detectShowerEntries(before, before + 400);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain('quadrantids');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports at most one entry per shower for a jump spanning three sim years', () => {
    const start = simDayFor('2026-01-01T00:00:00Z');
    const entries = detectShowerEntries(start, start + 3 * 365.25);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(SHOWER_TABLE.length);
  });

  it('fires nothing for backward time (reset/preset jump) and re-arms silently', () => {
    const later = simDayFor('2026-08-12T00:00:00Z');
    const earlier = simDayFor('2026-08-01T00:00:00Z');
    expect(detectShowerEntries(later, earlier)).toEqual([]);
    // Re-arm check: the very next forward call still detects correctly.
    const dec27 = simDayFor('2026-12-27T00:00:00Z');
    const dec28 = simDayFor('2026-12-28T00:00:00Z');
    expect(detectShowerEntries(dec27, dec28).map((e) => e.id)).toEqual(['quadrantids']);
  });

  it('does not double-fire when a step lands exactly on the range start boundary', () => {
    const dec27 = simDayFor('2026-12-27T00:00:00Z');
    const dec28 = simDayFor('2026-12-28T00:00:00Z'); // exact start boundary
    const dec29 = simDayFor('2026-12-29T00:00:00Z');
    const first = detectShowerEntries(dec27, dec28);
    const second = detectShowerEntries(dec28, dec29);
    expect(first.map((e) => e.id)).toEqual(['quadrantids']);
    expect(second.map((e) => e.id)).toEqual([]);
  });

  it('detects Geminids when its entire 13-day window falls inside a 20-day frame (regression: endpoint-only sampling missed a window fully contained between the two samples)', () => {
    const prev = simDayFor('2026-11-30T00:00:00Z');
    const curr = simDayFor('2026-12-20T00:00:00Z');
    const entries = detectShowerEntries(prev, curr);
    expect(entries.map((e) => e.id)).toContain('geminids');
  });

  it.each([
    ['quadrantids', '2026-12-27T00:00:00Z', '2027-01-13T00:00:00Z'],
    ['lyrids', '2026-04-13T00:00:00Z', '2026-05-01T00:00:00Z'],
    ['perseids', '2026-07-16T00:00:00Z', '2026-08-25T00:00:00Z'],
    ['geminids', '2026-12-03T00:00:00Z', '2026-12-18T00:00:00Z'],
  ])('detects %s when its entire range (incl. year-wrap) falls inside the frame', (id, prevIso, currIso) => {
    const entries = detectShowerEntries(simDayFor(prevIso), simDayFor(currIso));
    expect(entries.map((e) => e.id)).toContain(id);
  });

  it('reports two different showers, once each, when a single window contains both entire ranges', () => {
    const prev = simDayFor('2026-04-13T00:00:00Z');
    const curr = simDayFor('2026-08-25T00:00:00Z');
    const entries = detectShowerEntries(prev, curr);
    const ids = entries.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['lyrids', 'perseids']));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
