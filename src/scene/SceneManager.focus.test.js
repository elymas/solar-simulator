import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';

// The camera-arrival notification (AC-PLAY-301) has to fire exactly once per
// focus. SceneManager's constructor builds a real WebGLRenderer, which jsdom
// cannot provide, so the focus lerp is exercised on its own prototype against
// the handful of fields it actually touches.
function focusingStub(overrides = {}) {
  return {
    _isFocusing: true,
    _isResetting: false,
    _focusProgress: 0,
    _focusTarget: new THREE.Vector3(300, 0, 0),
    _focusCameraPos: new THREE.Vector3(320, 20, 20),
    camera: { position: new THREE.Vector3(0, 0, 1000) },
    controls: { target: new THREE.Vector3() },
    ...overrides,
  };
}

function step(subject, frames = 200) {
  for (let i = 0; i < frames; i += 1) SceneManager.prototype.stepCamera.call(subject, 0.016);
}

describe('SceneManager camera arrival (AC-PLAY-301)', () => {
  it('notifies exactly once when a focus completes', () => {
    const onFocusArrive = vi.fn();
    const subject = focusingStub({ onFocusArrive });

    step(subject);

    expect(onFocusArrive).toHaveBeenCalledTimes(1);
    expect(subject._isFocusing).toBe(false);
  });

  it('does not notify while the flight is still in progress', () => {
    const onFocusArrive = vi.fn();
    const subject = focusingStub({ onFocusArrive });

    step(subject, 5);

    expect(onFocusArrive).not.toHaveBeenCalled();
    expect(subject._isFocusing).toBe(true);
  });

  it('never notifies for a camera reset', () => {
    const onFocusArrive = vi.fn();
    const subject = focusingStub({
      onFocusArrive,
      _isFocusing: false,
      _isResetting: true,
      _resetProgress: 0,
      _resetTarget: new THREE.Vector3(0, 300, 800),
      _resetLookAt: new THREE.Vector3(),
    });

    step(subject);

    expect(onFocusArrive).not.toHaveBeenCalled();
  });

  it('stays a plain lerp when nothing listens', () => {
    const subject = focusingStub({ onFocusArrive: null });
    expect(() => step(subject)).not.toThrow();
    expect(subject._isFocusing).toBe(false);
  });
});
