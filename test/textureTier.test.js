import { describe, it, expect } from 'vitest';
import { TextureTierManager } from '../src/planets/TextureTierManager.js';

describe('TextureTierManager (REQ-290 lazy hi-res tier, TASK-009)', () => {
  it('returns the hi-res path the first time a body is focused', () => {
    const mgr = new TextureTierManager({ earth: 'hi/earth.jpg' });
    expect(mgr.requestUpgrade('earth')).toBe('hi/earth.jpg');
  });

  it('caches: a second focus on the same body loads nothing', () => {
    const mgr = new TextureTierManager({ earth: 'hi/earth.jpg' });
    expect(mgr.requestUpgrade('earth')).toBe('hi/earth.jpg');
    expect(mgr.requestUpgrade('earth')).toBeNull();
    expect(mgr.isUpgraded('earth')).toBe(true);
  });

  it('has no upgrade for a body without a hi-res entry', () => {
    const mgr = new TextureTierManager({ earth: 'hi/earth.jpg' });
    expect(mgr.hasUpgrade('mercury')).toBe(false);
    expect(mgr.requestUpgrade('mercury')).toBeNull();
  });

  it('reports availability only until upgraded', () => {
    const mgr = new TextureTierManager({ mars: 'hi/mars.jpg' });
    expect(mgr.hasUpgrade('mars')).toBe(true);
    mgr.requestUpgrade('mars');
    expect(mgr.hasUpgrade('mars')).toBe(false);
  });
});
