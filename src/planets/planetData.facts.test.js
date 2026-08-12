import { describe, it, expect } from 'vitest';
import { PLANET_DATA, MOON_DATA, STAR_DATA } from './planetData.js';

// REQ-KIDS-301 required set, spelled out explicitly so the test fails loudly if
// a body ever loses its kid-facts fields (AC-KIDS-305).
const REQUIRED_PLANET_KEYS = [
  'sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
  'ceres', 'pluto', 'haumea', 'makemake', 'eris',
];
const REQUIRED_MOON_KEYS = [
  'moon', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'enceladus',
  'phobos', 'deimos', 'triton', 'charon',
];
const REQUIRED_STAR_KEYS = ['siriusA', 'siriusB', 'betelgeuse', 'stephenson2_18'];

const MOON_BY_KEY = Object.fromEntries(
  Object.values(MOON_DATA).flat().map((m) => [m.key, m])
);

const REQUIRED_BODIES = [
  ...REQUIRED_PLANET_KEYS.map((key) => [key, PLANET_DATA[key]]),
  ...REQUIRED_MOON_KEYS.map((key) => [key, MOON_BY_KEY[key]]),
  ...REQUIRED_STAR_KEYS.map((key) => [key, STAR_DATA[key]]),
];

const MAX_FACT_CHARS = 45; // spec.md 8.1 rule 1

const radiusOf = (key) =>
  (PLANET_DATA[key] ?? MOON_BY_KEY[key] ?? STAR_DATA[key]).radius;

// AC-KIDS-304 spot checks: only the size comparisons whose claim is machine
// derivable. `token` is the literal that must appear in the Korean sentence,
// `stated` its numeric value, `actual` the ratio computed from real `radius`
// fields (never displayRadius, which is symbolic). Comparisons phrased as prose
// ("명왕성과 거의 같아요") are reviewed by the 8.1 checklist, not asserted here.
const DERIVABLE_SIZE_CLAIMS = [
  { key: 'sun', token: '109', stated: 109, actual: () => radiusOf('sun') / radiusOf('earth') },
  { key: 'mercury', token: '2개 반', stated: 2.5, actual: () => radiusOf('earth') / radiusOf('mercury') },
  { key: 'earth', token: '4', stated: 4, actual: () => radiusOf('earth') / radiusOf('moon') },
  { key: 'mars', token: '절반', stated: 0.5, actual: () => radiusOf('mars') / radiusOf('earth') },
  { key: 'jupiter', token: '11', stated: 11, actual: () => radiusOf('jupiter') / radiusOf('earth') },
  { key: 'saturn', token: '9', stated: 9, actual: () => radiusOf('saturn') / radiusOf('earth') },
  { key: 'uranus', token: '4', stated: 4, actual: () => radiusOf('uranus') / radiusOf('earth') },
  { key: 'neptune', token: '4', stated: 4, actual: () => radiusOf('neptune') / radiusOf('earth') },
  { key: 'ceres', token: '4', stated: 4, actual: () => radiusOf('moon') / radiusOf('ceres') },
  { key: 'haumea', token: '2', stated: 2, actual: () => radiusOf('moon') / radiusOf('haumea') },
  { key: 'makemake', token: '2개 반', stated: 2.5, actual: () => radiusOf('moon') / radiusOf('makemake') },
  { key: 'moon', token: '4', stated: 4, actual: () => radiusOf('earth') / radiusOf('moon') },
  { key: 'enceladus', token: '7', stated: 7, actual: () => radiusOf('moon') / radiusOf('enceladus') },
  { key: 'phobos', token: '150', stated: 150, actual: () => radiusOf('moon') / radiusOf('phobos') },
  { key: 'deimos', token: '280', stated: 280, actual: () => radiusOf('moon') / radiusOf('deimos') },
  { key: 'charon', token: '절반', stated: 0.5, actual: () => radiusOf('charon') / radiusOf('pluto') },
  { key: 'siriusA', token: '1.7', stated: 1.7, actual: () => radiusOf('siriusA') / radiusOf('sun') },
  { key: 'betelgeuse', token: '900', stated: 900, actual: () => radiusOf('betelgeuse') / radiusOf('sun') },
  { key: 'stephenson2_18', token: '2000', stated: 2000, actual: () => radiusOf('stephenson2_18') / radiusOf('sun') },
];

describe('kid-facts completeness (REQ-KIDS-301, REQ-KIDS-305)', () => {
  it('resolves every body named by the required set', () => {
    for (const [key, body] of REQUIRED_BODIES) {
      expect(body, `missing body: ${key}`).toBeDefined();
    }
    expect(Object.keys(STAR_DATA).sort()).toEqual([...REQUIRED_STAR_KEYS].sort());
  });

  it('gives every required body exactly 3 non-empty Korean facts', () => {
    for (const [key, body] of REQUIRED_BODIES) {
      expect(Array.isArray(body.factsKo), `${key}.factsKo is not an array`).toBe(true);
      expect(body.factsKo, `${key}.factsKo length`).toHaveLength(3);
      for (const fact of body.factsKo) {
        expect(fact, key).toBeTypeOf('string');
        expect(fact.trim().length, `${key}: empty fact`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every fact within the 45-character read-aloud budget', () => {
    for (const [key, body] of REQUIRED_BODIES) {
      for (const fact of body.factsKo) {
        expect([...fact].length, `${key}: "${fact}"`).toBeLessThanOrEqual(MAX_FACT_CHARS);
      }
    }
  });

  it('gives every required body a size comparison and an emoji', () => {
    for (const [key, body] of REQUIRED_BODIES) {
      expect(body.sizeComparisonKo, `${key}.sizeComparisonKo`).toBeTypeOf('string');
      expect(body.sizeComparisonKo.trim().length, key).toBeGreaterThan(0);
      expect(body.emoji, `${key}.emoji`).toBeTypeOf('string');
      expect(body.emoji.trim().length, key).toBeGreaterThan(0);
    }
  });
});

describe('kid-facts numeric truth (REQ-KIDS-304)', () => {
  it.each(DERIVABLE_SIZE_CLAIMS)(
    '$key size comparison states $stated within 10% of the radius-derived ratio',
    ({ key, token, stated, actual }) => {
      const sentence = (PLANET_DATA[key] ?? MOON_BY_KEY[key] ?? STAR_DATA[key]).sizeComparisonKo;
      expect(sentence, `${key} must state "${token}"`).toContain(token);
      const ratio = actual();
      expect(Math.abs(stated - ratio) / ratio, `${key}: stated ${stated} vs real ${ratio}`)
        .toBeLessThanOrEqual(0.1);
    }
  );
});
