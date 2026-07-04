// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { InfoPanel } from './InfoPanel.js';

const earthData = {
  name: 'Earth',
  nameKo: '지구',
  radius: 6378,
  distance: 1,
  orbitalPeriod: 365.25,
  rotationPeriod: 23.93,
  axialTilt: 23.44,
  eccentricity: 0.0167,
  moons: 1,
};

describe('InfoPanel close button', () => {
  it('routes the close button through onClose (camera reset path)', () => {
    const panel = new InfoPanel();
    const onClose = vi.fn();
    panel.onClose = onClose;

    panel.el.querySelector('.info-panel-close').click();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to hide() when onClose is not wired', () => {
    const panel = new InfoPanel();
    panel.show('earth', earthData);
    expect(panel.isOpen).toBe(true);

    panel.el.querySelector('.info-panel-close').click();

    expect(panel.isOpen).toBe(false);
  });
});
