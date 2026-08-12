import { describe, it, expect, vi, afterEach } from 'vitest';
import { EarthHUD } from '../src/earth/EarthHUD.js';
import { STR } from '../src/ui/strings.js';

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
