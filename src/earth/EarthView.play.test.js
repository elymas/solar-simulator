import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EarthView } from './EarthView.js';
import { onPlayEvent, resetPlayEvents } from '../play/playEvents.js';

// EarthView.onEnter builds a full three.js rig, which is not what this test is
// about — the play-event emission is. The lifecycle method is therefore invoked
// against a stub of the three fields it touches.
function enter(fromState = 'SOLAR') {
  const stub = { _build: vi.fn(), _hud: { show: vi.fn() }, controls: { enabled: false } };
  EarthView.prototype.onEnter.call(stub, fromState);
  return stub;
}

describe('EarthView play events (REQ-PLAY-402, plan §A.3)', () => {
  let events;

  beforeEach(() => {
    resetPlayEvents();
    events = [];
    onPlayEvent((event) => events.push(event));
  });

  afterEach(() => resetPlayEvents());

  it('emits view-enter for EARTH when the view becomes active', () => {
    enter('SOLAR');
    expect(events).toEqual([{ type: 'view-enter', view: 'EARTH' }]);
  });

  it('still builds and shows the view', () => {
    const stub = enter();
    expect(stub._build).toHaveBeenCalledTimes(1);
    expect(stub._hud.show).toHaveBeenCalledTimes(1);
    expect(stub.controls.enabled).toBe(true);
  });

  it('emits once per entry, so a return trip counts again', () => {
    enter('SOLAR');
    enter('SOLAR');
    expect(events).toHaveLength(2);
  });
});
