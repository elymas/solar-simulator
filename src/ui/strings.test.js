import { describe, it, expect } from 'vitest';
import { STR, formatKoUnit, formatKoDate } from './strings.js';
import { PLANET_DATA, MOON_DATA } from '../planets/planetData.js';

// AC-KIDS-103 grep gate: none of these may survive as a primary chrome label.
const BANNED_LITERALS = ['Solar System', 'Dwarf Planets', 'Stars', 'Speed', 'Date', 'Diameter', 'Orbital Period'];

// Keys the InfoPanel rework consumes. Declared here so the follow-up task cannot
// silently ship with a label missing.
const INFO_KEYS = [
  'infoType', 'infoRadius', 'infoDistance', 'infoMass', 'infoLuminosity',
  'infoSurfaceTemp', 'infoConstellation', 'infoApparentMag', 'infoAbsoluteMag',
  'infoDiameter', 'infoRotationPeriod', 'infoAxialTilt', 'infoDistanceFromParent',
  'infoOrbitalPeriod', 'infoEccentricity', 'infoOrbit', 'infoClassification',
  'infoDistanceFromSun', 'infoDiscovered', 'infoMoons',
  'infoValueDwarfPlanet', 'infoValueRetrograde', 'infoValueNone', 'infoRetrogradeSuffix',
  'infoValueBelt',
];

describe('STR completeness (REQ-KIDS-103)', () => {
  it('is a flat object of non-empty strings and template functions', () => {
    const entries = Object.entries(STR);
    expect(entries.length).toBeGreaterThan(0);

    for (const [key, value] of entries) {
      if (typeof value === 'function') {
        expect(value(1, 1), key).toBeTruthy();
      } else {
        expect(typeof value, key).toBe('string');
        expect(value.trim(), key).not.toBe('');
      }
    }
  });

  it('carries no banned English chrome literal', () => {
    for (const [key, value] of Object.entries(STR)) {
      if (typeof value !== 'string') continue;
      for (const banned of BANNED_LITERALS) {
        expect(value, `${key} still reads "${banned}"`).not.toContain(banned);
      }
    }
  });

  it('uses the Korean chrome labels the SPEC names verbatim', () => {
    expect(STR.listTitle).toBe('태양계');
    expect(STR.listDividerDwarf).toBe('왜소행성');
    expect(STR.listDividerStars).toBe('별');
    expect(STR.listDividerComet).toBe('혜성'); // REQ-EVT-103 names it verbatim
    expect(STR.listDividerBelt).toBe('띠');
    expect(STR.timeSpeed).toBe('속도');
    expect(STR.timeDate).toBe('날짜');
  });

  it('defines every InfoPanel key the follow-up task consumes', () => {
    for (const key of INFO_KEYS) {
      expect(STR[key], key).toBeTruthy();
    }
  });

  it('keeps the empty-sky state worded differently from the error states (REQ-480/490)', () => {
    const distinct = new Set([
      STR.earthFlightLiveEmpty,
      STR.earthFlightOffline,
      STR.earthFlightRateLimited,
      STR.earthFlightLoading,
      STR.earthFlightOff,
    ]);
    expect(distinct.size).toBe(5);
  });
});

describe('earthMeteorNotice (SPEC-EARTH-003 REQ-E3-104)', () => {
  it('builds the notice mechanically from the shower table koreanName field', () => {
    expect(STR.earthMeteorNotice('페르세우스 유성우')).toBe('페르세우스 유성우가 쏟아져요!');
    expect(STR.earthMeteorNotice('사분의 유성우')).toBe('사분의 유성우가 쏟아져요!');
  });
});

describe('Seoul flight reference point copy (SPEC-EARTH-003 REQ-E3-302)', () => {
  it('names the Seoul sky in the loading/live/offline lines', () => {
    expect(STR.earthFlightLoading).toContain('서울');
    expect(STR.earthFlightLive(1, 1)).toContain('서울');

    // The feed is a scheduled snapshot, not a live stream — the copy must not
    // claim otherwise, and an age past a minute reads in minutes.
    expect(STR.earthFlightLive(1, 1)).not.toContain('실시간');
    expect(STR.earthFlightLiveEmpty).not.toContain('실시간');
    expect(STR.earthFlightLive(3, 12)).toContain('12초 전');
    expect(STR.earthFlightLive(3, 2070)).toContain('35분 전');
    expect(STR.earthFlightLiveEmpty).toContain('서울');
    expect(STR.earthFlightOffline).toContain('서울');
  });

  it('keeps the empty-sky and error lines distinct after the Seoul reword (REQ-480/490)', () => {
    expect(STR.earthFlightLiveEmpty).not.toBe(STR.earthFlightOffline);
  });
});

// acceptance.md §4 puts EVERY Korean string of the play layer under the
// SPEC-KIDS-001 §8.1 checklist, but only mission prompts and the travel facts were
// ever machine-checked. These cover the rest: the play chrome and the aria-labels,
// which VoiceOver/TalkBack read aloud to the same child.
describe('play strings meet the KIDS-001 §8.1 checklist (SPEC-PLAY-001)', () => {
  const PLAY_KEYS = Object.keys(STR).filter((key) => key.startsWith('play'));

  // The names a child actually meets, so a failure names the body it is wrong for.
  const NAMES = [
    ...Object.values(PLANET_DATA).map((b) => b.nameKo),
    ...Object.values(MOON_DATA).flat().map((m) => m.nameKo),
  ].filter(Boolean);

  /** Every play string as it reaches the child: [key, rendered text, name?]. */
  function rendered() {
    const out = [];
    for (const key of PLAY_KEYS) {
      const value = STR[key];
      if (typeof value !== 'function') out.push([key, value, null]);
      // Same name in every slot: that puts the checks on all interpolation sites.
      else for (const name of NAMES) out.push([key, value(name, name, name), name]);
    }
    return out;
  }

  // These are the play strings that are SPOKEN or read as sentences; the rest are
  // button labels ('닫기'), for which 해요체 would be wrong.
  const SENTENCES = ['playCompareCount', 'playCompareSame', 'playDayComplete', 'playStickerLocked', 'playPraise'];

  it('covers the play layer at all', () => {
    expect(PLAY_KEYS.length).toBeGreaterThan(8);
  });

  it('stays within the §8.1 length rule and uses no English', () => {
    for (const [key, text, name] of rendered()) {
      const where = name ? `${key}(${name})` : key;
      expect(text.length, `${where} is longer than 45 Korean characters`).toBeLessThanOrEqual(45);
      expect(text, `${where} must not use English`).not.toMatch(/[A-Za-z]/);
    }
  });

  it('writes every spoken play string in 해요체', () => {
    for (const [key, text, name] of rendered()) {
      if (!SENTENCES.includes(key)) continue;
      expect(text, `${key}(${name}) must end in 해요체`).toMatch(/[요][.!]?$/);
    }
  });

  // strings.js states the module's own rule: the play strings are particle-free, so
  // no 은/는 이/가 와/과 (으)로 selection logic is needed for a body name that is only
  // known at runtime. A particle glued straight onto an interpolated name breaks it —
  // `${name}으로` reads aloud as 달으로 / 세레스으로 / 에리스으로.
  it('never glues a final-consonant-sensitive particle onto an interpolated name', () => {
    const JOSA = ['은', '는', '이', '가', '와', '과', '을', '를', '로', '으로'];
    for (const [key, text, name] of rendered()) {
      if (!name) continue;
      for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
        const after = text.slice(at + name.length);
        for (const josa of JOSA) {
          expect(
            after.startsWith(josa),
            `${key} renders "${text}" — drop the ${josa} particle instead of choosing it for ${name}`
          ).toBe(false);
        }
      }
    }
  });
});

describe('Korean formatters (REQ-KIDS-105)', () => {
  it('appends the Korean unit word directly to the value', () => {
    expect(formatKoUnit('1.88', STR.unitYear)).toBe('1.88년');
    expect(formatKoUnit(687, STR.unitDay)).toBe('687일');
    expect(formatKoUnit('24.6', STR.unitHour)).toBe('24.6시간');
  });

  it('renders the Korean date form without zero padding', () => {
    expect(formatKoDate(new Date(Date.UTC(2026, 2, 30)))).toBe('2026년 3월 30일');
    expect(formatKoDate(new Date(Date.UTC(2027, 0, 5)))).toBe('2027년 1월 5일');
  });
});
