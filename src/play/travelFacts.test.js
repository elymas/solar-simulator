import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TRAVEL_FACTS_KO, eligibleDestinations, travelFactKo } from './travelFacts.js';
import { PLANET_DATA, MOON_DATA, STAR_DATA } from '../planets/planetData.js';

const SOURCE = readFileSync(resolve(process.cwd(), 'src/play/travelFacts.js'), 'utf8');

/** Korean name for a destination key, wherever the key lives in planetData. */
function nameKo(key) {
  if (PLANET_DATA[key]) return PLANET_DATA[key].nameKo;
  return Object.values(MOON_DATA)
    .flat()
    .find((m) => m.key === key).nameKo;
}

describe('eligibleDestinations (REQ-PLAY-201)', () => {
  const eligible = eligibleDestinations();

  it('excludes Earth — the rocket launches from there', () => {
    expect(eligible).not.toContain('earth');
  });

  it('excludes the Sun and every star', () => {
    expect(eligible).not.toContain('sun');
    for (const star of Object.keys(STAR_DATA)) expect(eligible).not.toContain(star);
  });

  it('includes every sun-orbiting planet but Earth', () => {
    for (const key of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      expect(eligible, `${key} should be reachable`).toContain(key);
    }
  });

  it('includes every dwarf planet present in planetData', () => {
    const dwarfs = Object.entries(PLANET_DATA)
      .filter(([, body]) => body.category === 'dwarf')
      .map(([key]) => key);
    expect(dwarfs.length).toBeGreaterThan(0);
    for (const key of dwarfs) expect(eligible).toContain(key);
  });

  it('includes the Moon', () => {
    expect(eligible).toContain('moon');
  });

  // SPEC-EVENTS-001 put a comet in PLANET_DATA with a `distance` field. Its orbit
  // is too eccentric for the one-way fast-cruise basis this table is built on, so
  // it must fall out here rather than acquire an invented duration.
  it('excludes comets — no single travel time exists for an e=0.967 orbit', () => {
    const comets = Object.entries(PLANET_DATA)
      .filter(([, body]) => body.category === 'comet')
      .map(([key]) => key);
    expect(comets.length).toBeGreaterThan(0);
    for (const key of comets) expect(eligible).not.toContain(key);
  });

  it('names no body twice and no body planetData does not have', () => {
    const known = new Set([
      ...Object.keys(PLANET_DATA),
      ...Object.values(MOON_DATA).flat().map((m) => m.key),
    ]);
    expect(new Set(eligible).size).toBe(eligible.length);
    for (const key of eligible) expect(known.has(key)).toBe(true);
  });
});

describe('TRAVEL_FACTS_KO (REQ-PLAY-202, AC-PLAY-202)', () => {
  it('covers exactly the eligible destination set — no gaps, no strays', () => {
    expect(Object.keys(TRAVEL_FACTS_KO).sort()).toEqual([...eligibleDestinations()].sort());
  });

  it('speaks the canonical Mars fact from the spec', () => {
    expect(TRAVEL_FACTS_KO.mars).toBe('화성까지는 반년을 날아가야 해요!');
  });

  it('names its destination in every fact', () => {
    for (const key of Object.keys(TRAVEL_FACTS_KO)) {
      expect(TRAVEL_FACTS_KO[key], `${key} fact should name the body`).toContain(nameKo(key));
    }
  });

  // SPEC-KIDS-001 §8.1: <=45 Korean chars, one clause, 해요체, no English.
  it('writes every fact to the KIDS-001 §8.1 checklist', () => {
    for (const [key, fact] of Object.entries(TRAVEL_FACTS_KO)) {
      expect(fact.length, `${key} fact too long`).toBeLessThanOrEqual(45);
      expect(fact, `${key} must use 해요체`).toMatch(/요!$/);
      expect(fact, `${key} must not use English`).not.toMatch(/[A-Za-z]/);
    }
  });
});

// Durations are read back out of the Korean the child actually hears, not kept in
// a parallel numeric table — a second table is exactly how the numbers and the
// words drift apart, which is the defect these tests exist to catch.
const NUMERAL = {
  삼: 3, 넉: 4, 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6,
  일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열두: 12, 열세: 13, 열네: 14, 스무: 20,
};
const UNIT_YEARS = { 일: 1 / 365, 달: 1 / 12, 해: 1 };

/**
 * The spoken one-way duration, in years. NaN when a fact is worded in a way this
 * parser has not been taught — which fails a test rather than passing silently.
 * @param {string} fact
 * @returns {number}
 */
function spokenYears(fact) {
  const tail = fact.slice(fact.indexOf('까지는') + '까지는'.length);
  if (tail.includes('반년')) return 0.5;
  const match = tail.match(/(\S+?)\s*(일|달|해)/);
  const count = match ? NUMERAL[match[1]] : undefined;
  if (count === undefined) return NaN;
  return count * UNIT_YEARS[match[2]] + (/해\s*반/.test(tail) ? 0.5 : 0);
}

describe('duration ordering (REQ-PLAY-203, AC-PLAY-203)', () => {
  // Beyond Earth's orbit only. Sunward of it, travel time is set by delta-v rather
  // than by radial distance — Mercury sits closer to the Sun than Venus and still
  // takes longer to reach — so ordering the inner system by `distance` would encode
  // a falsehood instead of catching one.
  const OUTWARD = Object.keys(TRAVEL_FACTS_KO)
    .filter((key) => PLANET_DATA[key] && PLANET_DATA[key].distance > 1)
    .sort((a, b) => PLANET_DATA[a].distance - PLANET_DATA[b].distance);

  // Genuine real-mission inversions, listed one by one so a NEW inversion still
  // fails. New Horizons flew a direct high-speed trajectory to Pluto (9y 6m);
  // Voyager 2 reached Neptune on a grand-tour path of gravity assists (12y 1m).
  const INVERSIONS = new Set(['neptune>pluto']);

  it('reads a duration back out of every fact', () => {
    for (const [key, fact] of Object.entries(TRAVEL_FACTS_KO)) {
      expect(spokenYears(fact), `${key}: reword it or teach this test its numeral`).toBeGreaterThan(0);
    }
  });

  it('never tells a child that a nearer body takes longer to reach', () => {
    for (const near of OUTWARD) {
      for (const far of OUTWARD) {
        if (PLANET_DATA[near].distance >= PLANET_DATA[far].distance) continue;
        if (INVERSIONS.has(`${near}>${far}`)) continue;
        expect(
          spokenYears(TRAVEL_FACTS_KO[near]),
          `${near} (${PLANET_DATA[near].distance} AU) must not be spoken as farther in time than ${far} (${PLANET_DATA[far].distance} AU)`
        ).toBeLessThanOrEqual(spokenYears(TRAVEL_FACTS_KO[far]));
      }
    }
  });

  it('keeps the exception list honest: every listed pair is still a real inversion', () => {
    for (const pair of INVERSIONS) {
      const [near, far] = pair.split('>');
      expect(PLANET_DATA[near].distance).toBeLessThan(PLANET_DATA[far].distance);
      expect(
        spokenYears(TRAVEL_FACTS_KO[near]),
        `${pair} no longer inverts — delete it from INVERSIONS rather than leave it masking a future defect`
      ).toBeGreaterThan(spokenYears(TRAVEL_FACTS_KO[far]));
    }
  });

  it('anchors the whole table to one trajectory basis, in the source comments', () => {
    expect(SOURCE, 'the shared basis must be stated').toMatch(/기준|basis/i);
    expect(SOURCE, 'the rejected low-thrust class must stay named').toMatch(/이온|저추력|low-thrust/i);
  });
});

describe('travelFactKo', () => {
  it('returns the destination fact', () => {
    expect(travelFactKo('mars')).toBe(TRAVEL_FACTS_KO.mars);
  });

  it('returns null for ineligible or unknown bodies', () => {
    for (const key of ['earth', 'sun', 'siriusA', 'nowhere', '', null, undefined]) {
      expect(travelFactKo(key), `${key} should have no travel fact`).toBeNull();
    }
  });
});

describe('honesty notes (REQ-PLAY-203, AC-PLAY-203)', () => {
  it('states in a comment that the rocket path is schematic, not a transfer orbit', () => {
    expect(SOURCE).toMatch(/schematic/i);
    expect(SOURCE).toMatch(/transfer orbit/i);
  });

  it('carries a reference duration comment beside every fact', () => {
    for (const key of Object.keys(TRAVEL_FACTS_KO)) {
      const line = SOURCE.split('\n').find((l) => l.trimStart().startsWith(`${key}:`));
      expect(line, `${key} has no table row`).toBeTruthy();
      expect(line, `${key} needs a reference-duration comment`).toMatch(/\/\/ 참고:/);
    }
  });
});
