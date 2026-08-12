import { describe, it, expect, vi, afterEach } from 'vitest';
import { EarthHUD } from '../src/earth/EarthHUD.js';
import { ECLIPSE_TABLE, ECLIPSE_DIAGRAM_INTRO, ECLIPSE_SCALE_NOTE, getEclipseTypeInfo } from '../src/utils/eclipseData.js';
import { STR } from '../src/ui/strings.js';
import { EARTH_VIEW_DEFAULTS } from '../src/utils/constants.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('EarthHUD flight status (F5-3, REQ-480/490)', () => {
  it('exposes an aria-live status region for the aircraft layer', () => {
    const hud = new EarthHUD();
    const el = hud.el.querySelector('[data-field="flight-status"]');
    expect(el).not.toBeNull();
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('renders every explicit state string (REQ-480)', () => {
    const hud = new EarthHUD();
    const el = hud.el.querySelector('[data-field="flight-status"]');
    hud.setFlightStatus('OFF');
    expect(el.dataset.state).toBe('OFF');
    hud.setFlightStatus('LOADING');
    expect(el.dataset.state).toBe('LOADING');
    hud.setFlightStatus('LIVE', { count: 3, updatedAgoSec: 4 });
    expect(el.dataset.state).toBe('LIVE');
    expect(el.textContent).toContain('3');
    hud.setFlightStatus('RATE_LIMITED');
    expect(el.dataset.state).toBe('RATE_LIMITED');
  });

  it('distinguishes a LIVE empty sky from an OFFLINE error (REQ-490)', () => {
    const hud = new EarthHUD();
    const el = hud.el.querySelector('[data-field="flight-status"]');
    hud.setFlightStatus('LIVE', { count: 0 });
    const emptyText = el.textContent;
    const emptyState = el.dataset.state;
    hud.setFlightStatus('OFFLINE');
    expect(el.textContent).not.toBe(emptyText);
    expect(el.dataset.state).not.toBe(emptyState);
    expect(emptyState).toBe('LIVE'); // empty sky is still LIVE, not an error
    expect(el.dataset.state).toBe('OFFLINE');
  });

  it('routes the aircraft opt-in toggle through onToggleAircraft', () => {
    const hud = new EarthHUD();
    const cb = vi.fn();
    hud.onToggleAircraft = cb;
    hud.el.querySelector('[data-toggle="aircraft"]').click();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('EarthHUD eclipse controls (F6-3, REQ-510/540)', () => {
  it('populates a preset picker from the real eclipse table', () => {
    const hud = new EarthHUD();
    const opts = hud.el.querySelectorAll('[data-field="eclipse-preset"] option[value]');
    // one option per eclipse (a leading placeholder is allowed without a value)
    expect(opts.length).toBe(ECLIPSE_TABLE.length);
  });

  it('routes a preset selection to onSelectEclipse with the eclipse entry', () => {
    const hud = new EarthHUD();
    const cb = vi.fn();
    hud.onSelectEclipse = cb;
    const select = hud.el.querySelector('[data-field="eclipse-preset"]');
    select.value = '0';
    select.dispatchEvent(new Event('change'));
    expect(cb).toHaveBeenCalledWith(ECLIPSE_TABLE[0]);
  });

  it('routes the find-next button through onFindNextEclipse', () => {
    const hud = new EarthHUD();
    const cb = vi.fn();
    hud.onFindNextEclipse = cb;
    hud.el.querySelector('[data-action="find-eclipse"]').click();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('shows the "not to scale" caveat in Korean', () => {
    const hud = new EarthHUD();
    expect(hud.el.textContent).toContain(ECLIPSE_SCALE_NOTE);
  });

  it('defaults the detail text to the generic diagram explanation', () => {
    const hud = new EarthHUD();
    expect(hud.el.querySelector('[data-field="eclipse-detail"]').textContent).toBe(ECLIPSE_DIAGRAM_INTRO);
  });

  it('routes the eclipse simulation toggle through onToggleEclipse', () => {
    const hud = new EarthHUD();
    const cb = vi.fn();
    hud.onToggleEclipse = cb;
    hud.el.querySelector('[data-toggle="eclipse"]').click();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('setEclipseEnabled flips the toggle label', () => {
    const hud = new EarthHUD();
    const btn = hud.el.querySelector('[data-toggle="eclipse"]');
    hud.setEclipseEnabled(false);
    expect(btn.textContent).toBe(STR.earthEclipseOff);
    hud.setEclipseEnabled(true);
    expect(btn.textContent).toBe(STR.earthEclipseOn);
  });

  it('setEclipseInfo describes the active eclipse by type, and reverts to the intro on null', () => {
    const hud = new EarthHUD();
    const detail = hud.el.querySelector('[data-field="eclipse-detail"]');
    const eclipse = ECLIPSE_TABLE[0];
    const { label, description } = getEclipseTypeInfo(eclipse.type);

    hud.setEclipseInfo(eclipse);
    expect(detail.textContent).toContain(label);
    expect(detail.textContent).toContain(eclipse.name);
    expect(detail.textContent).toContain(description);

    hud.setEclipseInfo(null);
    expect(detail.textContent).toBe(ECLIPSE_DIAGRAM_INTRO);
  });
});

describe('EarthHUD aurora toggle (F7, REQ-610)', () => {
  it('routes the aurora toggle through onToggleAurora', () => {
    const hud = new EarthHUD();
    const cb = vi.fn();
    hud.onToggleAurora = cb;
    hud.el.querySelector('[data-toggle="aurora"]').click();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('EarthHUD rotation-speed slider', () => {
  it('renders a slider with the correct min/max/step/default attributes', () => {
    const hud = new EarthHUD();
    const slider = hud.el.querySelector('[data-field="speed-slider"]');
    expect(slider).not.toBeNull();
    expect(slider.min).toBe('0.05');
    expect(slider.max).toBe('3');
    expect(slider.step).toBe('0.05');
    expect(slider.value).toBe(String(EARTH_VIEW_DEFAULTS.rotationSpeedDefault));
  });

  it('moving the slider invokes onSpeedChange with a numeric value', () => {
    const hud = new EarthHUD();
    const cb = vi.fn();
    hud.onSpeedChange = cb;
    const slider = hud.el.querySelector('[data-field="speed-slider"]');
    slider.value = '1.5';
    slider.dispatchEvent(new Event('input'));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1.5);
    expect(typeof cb.mock.calls[0][0]).toBe('number');
  });

  it('setSpeedDisplay(v) shows the Korean seconds-per-turn form (REQ-KIDS-105)', () => {
    const hud = new EarthHUD();
    const valueEl = hud.el.querySelector('[data-field="speed-value"]');
    // 1.5 turns/sec -> a turn takes 0.7s; 0.05 (the default) -> 20s.
    hud.setSpeedDisplay(1.5);
    expect(valueEl.textContent).toBe('0.7초에 한 바퀴');
    hud.setSpeedDisplay(0.05);
    expect(valueEl.textContent).toBe('20초에 한 바퀴');
  });
});

describe('EarthHUD collapsible panel (mirrors PlanetList toggle)', () => {
  it('has a toggle button and is not collapsed by default on a desktop-width window', () => {
    const hud = new EarthHUD();
    expect(hud._toggleBtn).toBeTruthy();
    expect(document.body.contains(hud._toggleBtn)).toBe(true);
    expect(hud.el.classList.contains('collapsed')).toBe(false);
  });

  it('clicking the toggle button adds/removes the collapsed class', () => {
    const hud = new EarthHUD();
    hud._toggleBtn.click();
    expect(hud.el.classList.contains('collapsed')).toBe(true);
    hud._toggleBtn.click();
    expect(hud.el.classList.contains('collapsed')).toBe(false);
  });

  it('auto-collapses on resize to <=768px (matches PlanetList\'s one-way threshold)', () => {
    const hud = new EarthHUD();
    expect(hud.el.classList.contains('collapsed')).toBe(false);
    window.innerWidth = 500;
    window.dispatchEvent(new Event('resize'));
    expect(hud.el.classList.contains('collapsed')).toBe(true);
    window.innerWidth = 1024;
  });

  it('dispose() removes both the panel and the toggle button, and removes the resize listener', () => {
    const hud = new EarthHUD();
    const toggleBtn = hud._toggleBtn;
    const panel = hud.el;
    hud.dispose();
    expect(document.body.contains(panel)).toBe(false);
    expect(document.body.contains(toggleBtn)).toBe(false);
    // resize listener must be removed — triggering resize after dispose should be a no-op, not throw
    expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
  });

  it('show()/hide() also control the toggle button visibility', () => {
    const hud = new EarthHUD();
    hud.hide();
    expect(hud._toggleBtn.style.display).toBe('none');
    hud.show();
    expect(hud._toggleBtn.style.display).toBe('');
  });
});
