import { describe, it, expect } from 'vitest';
import { hashToView, viewToHash, canTransition, VIEW_STATES } from '../src/core/ViewManager.js';

describe('hash routing (E2, REQ-325)', () => {
  it('maps #/earth to the earth view', () => {
    expect(hashToView('#/earth')).toBe('earth');
  });

  it('maps #/, empty, and unknown hashes to the solar view', () => {
    expect(hashToView('#/')).toBe('solar');
    expect(hashToView('')).toBe('solar');
    expect(hashToView(undefined)).toBe('solar');
    expect(hashToView('#/mars')).toBe('solar');
  });

  it('round-trips view names to canonical hashes', () => {
    expect(viewToHash('earth')).toBe('#/earth');
    expect(viewToHash('solar')).toBe('#/');
    expect(hashToView(viewToHash('earth'))).toBe('earth');
    expect(hashToView(viewToHash('solar'))).toBe('solar');
  });
});

describe('state transition guard (E1, REQ-315)', () => {
  const { SOLAR, TO_EARTH, EARTH, TO_SOLAR } = VIEW_STATES;

  it('permits only the forward cycle SOLAR->TO_EARTH->EARTH->TO_SOLAR->SOLAR', () => {
    expect(canTransition(SOLAR, TO_EARTH)).toBe(true);
    expect(canTransition(TO_EARTH, EARTH)).toBe(true);
    expect(canTransition(EARTH, TO_SOLAR)).toBe(true);
    expect(canTransition(TO_SOLAR, SOLAR)).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition(SOLAR, EARTH)).toBe(false); // cannot skip the fade
    expect(canTransition(TO_EARTH, TO_EARTH)).toBe(false); // no self-loop
    expect(canTransition(EARTH, EARTH)).toBe(false);
    expect(canTransition(EARTH, SOLAR)).toBe(false); // must pass through TO_SOLAR
    expect(canTransition(SOLAR, TO_SOLAR)).toBe(false);
  });
});
