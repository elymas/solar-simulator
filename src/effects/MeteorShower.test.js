import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { MeteorShower } from './MeteorShower.js';
import { METEOR_DEFAULTS } from '../utils/constants.js';
import { SIM_EPOCH_ISO } from '../utils/constants.js';

// Converts a calendar (month, day) to a sim-day number via the same SIM_EPOCH
// anchor meteorData.js uses, so tests derive real shower dates instead of
// hardcoding fragile ordinal magic numbers.
const EPOCH_MS = Date.parse(SIM_EPOCH_ISO);
function simDayFor(monthIndex0, day) {
  const target = Date.UTC(new Date(EPOCH_MS).getUTCFullYear(), monthIndex0, day);
  return (target - EPOCH_MS) / 86400000;
}

const PERSEIDS_PEAK_DAY = simDayFor(7, 12); // Aug 12 — spec.md §1.3
const PERSEIDS_EDGE_DAY = simDayFor(7, 18); // just inside Jul17-Aug24, near the start edge
const NO_SHOWER_DAY = simDayFor(5, 1); // Jun 1 — gap between Lyrids and Perseids

function fakeWin(reducedMotion = false) {
  return { matchMedia: () => ({ matches: reducedMotion }) };
}

describe('MeteorShower pool discipline (REQ-E3-103, AC-E3-103)', () => {
  it('boots the full-tier pool at 12 by default', () => {
    const pool = new MeteorShower({ win: fakeWin() });
    expect(pool.group.children).toHaveLength(METEOR_DEFAULTS.poolSizeFull);
    expect(METEOR_DEFAULTS.poolSizeFull).toBe(12);
  });

  it('boots the constrained-tier pool at 6 (SPEC-MOBILE-001, AC-E3-106)', () => {
    const pool = new MeteorShower({ poolSize: METEOR_DEFAULTS.poolSizeConstrained, win: fakeWin() });
    expect(pool.group.children).toHaveLength(METEOR_DEFAULTS.poolSizeConstrained);
    expect(METEOR_DEFAULTS.poolSizeConstrained).toBe(6);
  });

  it('never grows the pool and recycles the same object identities across many spawns', () => {
    const pool = new MeteorShower({ poolSize: 4, win: fakeWin() });
    const originalLines = pool.group.children.slice();
    for (let i = 0; i < 2000; i++) pool.update(0.05, PERSEIDS_PEAK_DAY); // 100 simulated seconds
    expect(pool.group.children).toHaveLength(4);
    originalLines.forEach((line, i) => expect(pool.group.children[i]).toBe(line));
  });
});

describe('MeteorShower spawn cadence (REQ-E3-103, AC-E3-103)', () => {
  it('spawns more frequently at the peak date than near a range edge', () => {
    const countSpawns = (simDay) => {
      const pool = new MeteorShower({ poolSize: 20, win: fakeWin() });
      const spy = vi.spyOn(pool, '_spawn');
      for (let i = 0; i < 500; i++) pool.update(0.1, simDay); // 50 simulated seconds
      return spy.mock.calls.length;
    };
    expect(countSpawns(PERSEIDS_PEAK_DAY)).toBeGreaterThan(countSpawns(PERSEIDS_EDGE_DAY));
  });

  it('spawns nothing when no shower is active', () => {
    const pool = new MeteorShower({ win: fakeWin() });
    const spy = vi.spyOn(pool, '_spawn');
    for (let i = 0; i < 100; i++) pool.update(0.1, NO_SHOWER_DAY);
    expect(spy).not.toHaveBeenCalled();
  });

  it('spawns each streak on the night-side upper dome (reuses AuroraEffect\'s sun-direction dot test)', () => {
    const sunDirection = new THREE.Vector3(1, 0, 0.35).normalize();
    const pool = new MeteorShower({ poolSize: 30, sunDirection, win: fakeWin() });
    // A single large-dt update fires several spawns via the credit loop, all
    // sampled fresh (advance already ran this tick with nothing active yet) —
    // checking immediately avoids conflating spawn placement with post-spawn
    // tangential travel, which is not itself constrained to stay night-side.
    pool.update(5 / METEOR_DEFAULTS.baseSpawnRate, PERSEIDS_PEAK_DAY);
    const activeHeads = pool._pool.filter((s) => s.active).map((s) => s.head.clone().normalize());
    expect(activeHeads.length).toBeGreaterThan(0);
    for (const dir of activeHeads) expect(dir.dot(sunDirection)).toBeLessThanOrEqual(0);
  });
});

describe('MeteorShower prefers-reduced-motion (REQ-E3-105, AC-E3-105)', () => {
  it('spawns and animates nothing when prefers-reduced-motion is set', () => {
    const pool = new MeteorShower({ win: fakeWin(true) });
    const spawnSpy = vi.spyOn(pool, '_spawn');
    const advanceSpy = vi.spyOn(pool, '_advance');
    for (let i = 0; i < 100; i++) pool.update(0.1, PERSEIDS_PEAK_DAY);
    expect(spawnSpy).not.toHaveBeenCalled();
    expect(advanceSpy).not.toHaveBeenCalled();
  });

  it('does not throw when shedding a pool that is already reduced-motion-idle', () => {
    const pool = new MeteorShower({ win: fakeWin(true) });
    expect(() => {
      pool.setVisible(false); // degrader sheds the 'meteors' step
      pool.update(0.1, PERSEIDS_PEAK_DAY);
      pool.setVisible(true); // degrader restores
      pool.update(0.1, PERSEIDS_PEAK_DAY);
    }).not.toThrow();
  });
});

describe('MeteorShower lifecycle', () => {
  it('disposes without throwing', () => {
    const pool = new MeteorShower({ win: fakeWin() });
    expect(() => pool.dispose()).not.toThrow();
  });
});
