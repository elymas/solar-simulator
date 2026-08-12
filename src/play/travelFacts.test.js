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
