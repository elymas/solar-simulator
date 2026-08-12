import { describe, it, expect } from 'vitest';
import { STR, formatKoUnit, formatKoDate } from './strings.js';

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
    expect(STR.earthFlightLiveEmpty).toContain('서울');
    expect(STR.earthFlightOffline).toContain('서울');
  });

  it('keeps the empty-sky and error lines distinct after the Seoul reword (REQ-480/490)', () => {
    expect(STR.earthFlightLiveEmpty).not.toBe(STR.earthFlightOffline);
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
