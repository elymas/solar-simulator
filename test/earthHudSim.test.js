import { describe, it, expect, vi, afterEach } from 'vitest';
import { EarthHUD } from '../src/earth/EarthHUD.js';
import { ECLIPSE_TABLE } from '../src/utils/eclipseData.js';

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

  it('shows an "illustrative / not to scale" label', () => {
    const hud = new EarthHUD();
    expect(hud.el.textContent.toLowerCase()).toContain('illustrative');
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
