import { describe, it, expect, vi, afterEach } from 'vitest';
import { EarthHUD } from '../src/earth/EarthHUD.js';
import { STR } from '../src/ui/strings.js';
import { FLIGHT_DEFAULTS } from '../src/utils/constants.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('EarthHUD (E8, REQ-330/340)', () => {
  it('routes the back button through onBack', () => {
    const hud = new EarthHUD();
    const onBack = vi.fn();
    hud.onBack = onBack;
    hud.backButton.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders sub-solar point + terminator readouts and updates them', () => {
    const hud = new EarthHUD();
    hud.setInfo({ subSolar: '12.3N 45.6E', terminator: '18:00 UTC' });
    expect(hud.el.querySelector('[data-field="subsolar"]').textContent).toBe('12.3N 45.6E');
    expect(hud.el.querySelector('[data-field="terminator"]').textContent).toBe('18:00 UTC');
  });

  it('labels the panel, readouts and back button in Korean (REQ-KIDS-103)', () => {
    const hud = new EarthHUD();
    expect(hud.el.querySelector('.earth-hud-title').textContent).toBe(STR.earthTitle);
    expect(hud.backButton.textContent).toBe(STR.earthBack);

    const labels = [...hud.el.querySelectorAll('.earth-hud-label')].map((el) => el.textContent);
    expect(labels).toContain(STR.earthSubSolar);
    expect(labels).toContain(STR.earthTerminator);
  });

  it('words every flight state in Korean, keeping the empty sky apart from the errors (REQ-480/490)', () => {
    const hud = new EarthHUD();
    const statusEl = hud.el.querySelector('[data-field="flight-status"]');
    const textFor = (state, info) => {
      hud.setFlightStatus(state, info);
      return statusEl.textContent;
    };

    expect(textFor('LIVE', { count: 3, updatedAgoSec: 12 })).toBe(STR.earthFlightLive(3, 12));
    expect(textFor('LIVE', { count: 0 })).toBe(STR.earthFlightLiveEmpty);
    expect(textFor('OFFLINE')).toBe(STR.earthFlightOffline);
    expect(textFor('RATE_LIMITED')).toBe(STR.earthFlightRateLimited);
    expect(textFor('LOADING')).toBe(STR.earthFlightLoading);
    expect(STR.earthFlightLiveEmpty).not.toBe(STR.earthFlightOffline);
  });

  it('toggles visibility and removes itself on dispose', () => {
    const hud = new EarthHUD();
    hud.hide();
    expect(hud.el.style.display).toBe('none');
    hud.show();
    expect(hud.el.style.display).toBe('');
    hud.dispose();
    expect(document.querySelector('.earth-hud')).toBeNull();
  });
});

describe('EarthHUD ISS toggle + facts (SPEC-EARTH-003 REQ-E3-202/203)', () => {
  it('renders the ISS toggle defaulting to ON (cheap marker, unlike aircraft polling)', () => {
    const hud = new EarthHUD();
    expect(hud.el.querySelector('[data-toggle="iss"]').textContent).toBe(STR.earthIssOn);
  });

  it('routes the ISS toggle click through onToggleISS', () => {
    const hud = new EarthHUD();
    const onToggleISS = vi.fn();
    hud.onToggleISS = onToggleISS;
    hud.el.querySelector('[data-toggle="iss"]').click();
    expect(onToggleISS).toHaveBeenCalledTimes(1);
  });

  it('setISSEnabled flips the toggle label', () => {
    const hud = new EarthHUD();
    hud.setISSEnabled(false);
    expect(hud.el.querySelector('[data-toggle="iss"]').textContent).toBe(STR.earthIssOff);
    hud.setISSEnabled(true);
    expect(hud.el.querySelector('[data-toggle="iss"]').textContent).toBe(STR.earthIssOn);
  });

  it('showISSFacts renders the given Korean facts (REQ-E3-203, no InfoPanel in this view)', () => {
    const hud = new EarthHUD();
    hud.showISSFacts(['우주인이 사는 우주 정거장이에요!', '지구를 92분마다 한 바퀴 돌아요.']);
    expect(hud.el.querySelector('[data-field="iss-facts"]').textContent)
      .toContain('우주인이 사는 우주 정거장이에요!');
  });
});

describe('EarthHUD meteor-shower notice (SPEC-EARTH-003 REQ-E3-104)', () => {
  it('renders an empty aria-live meteor-notice region', () => {
    const hud = new EarthHUD();
    const el = hud.el.querySelector('[data-field="meteor-notice"]');
    expect(el).not.toBeNull();
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.textContent).toBe('');
  });

  it('setMeteorNotice renders the given Korean text', () => {
    const hud = new EarthHUD();
    hud.setMeteorNotice(STR.earthMeteorNotice('페르세우스 유성우'));
    expect(hud.el.querySelector('[data-field="meteor-notice"]').textContent)
      .toBe('페르세우스 유성우가 쏟아져요!');
  });

  it('setMeteorNotice("") clears the region back to empty', () => {
    const hud = new EarthHUD();
    hud.setMeteorNotice(STR.earthMeteorNotice('페르세우스 유성우'));
    hud.setMeteorNotice('');
    expect(hud.el.querySelector('[data-field="meteor-notice"]').textContent).toBe('');
  });
});

describe('FLIGHT_DEFAULTS Seoul reference point (SPEC-EARTH-003 REQ-E3-301)', () => {
  it('points at Seoul/Incheon, not London', () => {
    expect(FLIGHT_DEFAULTS.lat).toBe(37.5);
    expect(FLIGHT_DEFAULTS.lon).toBe(126.9);
  });

  it('leaves every other tuning field byte-identical to the pre-Seoul baseline', () => {
    expect(FLIGHT_DEFAULTS.baseUrl).toBe('https://api.airplanes.live/v2/point');
    expect(FLIGHT_DEFAULTS.radiusNm).toBe(250);
    expect(FLIGHT_DEFAULTS.pollIntervalMs).toBe(12000);
    expect(FLIGHT_DEFAULTS.backoffStartMs).toBe(30000);
    expect(FLIGHT_DEFAULTS.backoffMaxMs).toBe(300000);
    expect(FLIGHT_DEFAULTS.maxInstances).toBe(500);
    expect(FLIGHT_DEFAULTS.altitudeScale).toBe(0.0001);
  });
});

describe('EarthHUD flight status Seoul wording (SPEC-EARTH-003 REQ-E3-302)', () => {
  it('names the Seoul sky in the LOADING/LIVE/LIVE-empty/OFFLINE lines', () => {
    const hud = new EarthHUD();
    const statusEl = hud.el.querySelector('[data-field="flight-status"]');
    const textFor = (state, info) => {
      hud.setFlightStatus(state, info);
      return statusEl.textContent;
    };

    expect(textFor('LOADING')).toContain('서울');
    expect(textFor('LIVE', { count: 3, updatedAgoSec: 12 })).toContain('서울');
    expect(textFor('LIVE', { count: 0 })).toContain('서울');
    expect(textFor('OFFLINE')).toContain('서울');
  });

  it('still keeps the empty sky worded apart from the OFFLINE error (REQ-480/490)', () => {
    const hud = new EarthHUD();
    const statusEl = hud.el.querySelector('[data-field="flight-status"]');
    hud.setFlightStatus('LIVE', { count: 0 });
    const emptyText = statusEl.textContent;
    hud.setFlightStatus('OFFLINE');
    const offlineText = statusEl.textContent;
    expect(emptyText).not.toBe(offlineText);
  });
});

describe('EarthHUD safe-area inset (REQ-PWA-103)', () => {
  it('adds safe-area-inset-top/right to the panel, additive to the base offsets', () => {
    new EarthHUD();
    const styleText = document.getElementById('earth-hud-styles').textContent;
    expect(styleText).toContain('top: calc(64px + env(safe-area-inset-top, 0px));');
    expect(styleText).toContain('right: calc(16px + env(safe-area-inset-right, 0px));');
  });

  it('adds safe-area-inset-top/right to the toggle button', () => {
    new EarthHUD();
    const styleText = document.getElementById('earth-hud-styles').textContent;
    expect(styleText).toContain('.earth-hud-toggle-btn {');
    expect(styleText).toMatch(/earth-hud-toggle-btn \{[^}]*top: calc\(16px \+ env\(safe-area-inset-top, 0px\)\);/);
  });
});
