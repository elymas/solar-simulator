// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBanner, BANNER_DISPLAY_MS } from './EventBanner.js';
import { speak } from '../audio/tts.js';
import { STR } from './strings.js';

// The banner must speak through the shared SPEC-KIDS-001 channel, which is
// already mute-aware and cancels before speaking. Mocking the module is how the
// test proves it did not build an utterance of its own.
vi.mock('../audio/tts.js', () => ({ speak: vi.fn() }));

const setReducedMotion = (reduce) => {
  window.matchMedia = vi.fn((query) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
  }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  setReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('EventBanner celebration (REQ-EVT-303, AC-EVT-303)', () => {
  it('renders the Korean alignment line', () => {
    const banner = new EventBanner();
    banner.show(STR.eventAlignment);

    expect(STR.eventAlignment).toBe('행성들이 줄을 섰어요!');
    expect(banner.el.textContent).toContain('행성들이 줄을 섰어요!');
    expect(banner.el.classList.contains('visible')).toBe(true);
  });

  it('announces itself politely to a screen reader', () => {
    const banner = new EventBanner();
    expect(banner.el.getAttribute('aria-live')).toBe('polite');
    expect(banner.el.getAttribute('role')).toBe('status');
  });

  it('emits exactly one callout, and it is the banner line itself', () => {
    const banner = new EventBanner();
    banner.show(STR.eventAlignment);

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(STR.eventAlignment);
  });

  it('auto-dismisses after its display window', () => {
    const banner = new EventBanner();
    banner.show(STR.eventAlignment);

    vi.advanceTimersByTime(BANNER_DISPLAY_MS - 1);
    expect(banner.el.classList.contains('visible')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(banner.el.classList.contains('visible')).toBe(false);
  });

  it('restarts the window instead of stacking timers when shown again', () => {
    const banner = new EventBanner();
    banner.show(STR.eventAlignment);
    vi.advanceTimersByTime(BANNER_DISPLAY_MS - 100);
    banner.show(STR.eventAlignment);

    vi.advanceTimersByTime(100);
    expect(banner.el.classList.contains('visible')).toBe(true);

    vi.advanceTimersByTime(BANNER_DISPLAY_MS);
    expect(banner.el.classList.contains('visible')).toBe(false);
  });
});

describe('EventBanner reduced motion (REQ-EVT-305, AC-EVT-305)', () => {
  it('animates and sparkles by default', () => {
    const banner = new EventBanner();
    banner.show(STR.eventAlignment);
    expect(banner.el.classList.contains('animated')).toBe(true);
    expect(banner.el.querySelector('.event-banner-spark')).not.toBeNull();
  });

  it('presents statically under prefers-reduced-motion', () => {
    setReducedMotion(true);
    const banner = new EventBanner();
    banner.show(STR.eventAlignment);

    expect(banner.el.classList.contains('animated')).toBe(false);
    expect(banner.el.querySelector('.event-banner-spark')).toBeNull();
    // Still fully present: reduced motion removes the flourish, not the news.
    expect(banner.el.classList.contains('visible')).toBe(true);
    expect(banner.el.textContent).toContain(STR.eventAlignment);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('defaults to animations-on when matchMedia is unavailable (old jsdom)', () => {
    delete window.matchMedia;
    const banner = new EventBanner();
    expect(() => banner.show(STR.eventAlignment)).not.toThrow();
    expect(banner.el.classList.contains('animated')).toBe(true);
  });
});
