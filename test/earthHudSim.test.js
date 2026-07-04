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
