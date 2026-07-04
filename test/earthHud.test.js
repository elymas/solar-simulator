import { describe, it, expect, vi, afterEach } from 'vitest';
import { EarthHUD } from '../src/earth/EarthHUD.js';

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
