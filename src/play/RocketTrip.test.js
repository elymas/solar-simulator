import { describe, it, expect, vi, afterEach } from 'vitest';
import { RocketTrip, bodyEntry, tripDistanceKm, formatDistanceKo } from './RocketTrip.js';
import { rocketX, LANE_HALF, BODY_RADIUS } from './RocketTripScene.js';
import { eligibleDestinations, travelFactKo } from './travelFacts.js';
import { PLANET_DATA } from '../planets/planetData.js';
import { STR } from '../ui/strings.js';

const AU_KM = 149597870.7;

afterEach(() => {
  document.body.innerHTML = '';
});

/** A scene stub: jsdom has no WebGL, and the overlay must work without one. */
function sceneStub() {
  const scene = {
    shown: null,
    show: vi.fn((trip) => { scene.shown = trip; }),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  return scene;
}

function makeTrip(overrides = {}) {
  const scene = overrides.scene === undefined ? sceneStub() : overrides.scene;
  const speak = vi.fn();
  const emit = vi.fn();
  const trip = new RocketTrip({
    speak,
    emit,
    doc: document,
    win: null,
    createScene: (opts) => {
      if (overrides.throwOnCreate) throw new Error('no webgl');
      scene.opts = opts;
      return scene;
    },
    ...(overrides.reducedMotion !== undefined ? { reducedMotion: overrides.reducedMotion } : {}),
  });
  return { trip, scene, speak, emit };
}

describe('trip distance — the only number this overlay adds', () => {
  it('reads a planet as the gap between the two orbits, not its distance from the Sun', () => {
    // Mars sits 1.524 AU out and Earth 1.0, so the trip is 0.524 AU — quoting
    // 1.524 would tell a child the rocket flies past the Sun to get there.
    const expected = Math.abs(PLANET_DATA.mars.distance - PLANET_DATA.earth.distance) * AU_KM;
    expect(tripDistanceKm('mars')).toBeCloseTo(expected, 0);
    expect(tripDistanceKm('mars')).toBeLessThan(PLANET_DATA.mars.distance * AU_KM);
  });

  it('reads the Moon as its own orbit radius, since it circles Earth rather than the Sun', () => {
    expect(tripDistanceKm('moon')).toBe(384400);
  });

  it('orders every destination the same way the durations do — further is longer', () => {
    // The spoken facts claim Mars takes longer than Venus and Jupiter longer than
    // Mars. If the distances disagreed with that ordering, the picture would be
    // arguing with the sentence above it.
    const km = (key) => tripDistanceKm(key);
    expect(km('moon')).toBeLessThan(km('venus'));
    expect(km('venus')).toBeLessThan(km('mars'));
    expect(km('mars')).toBeLessThan(km('jupiter'));
    expect(km('jupiter')).toBeLessThan(km('neptune'));
  });

  it('has an honest number for every body the rocket offers to visit', () => {
    for (const key of eligibleDestinations()) {
      expect(tripDistanceKm(key), key).toBeGreaterThan(0);
      expect(formatDistanceKo(tripDistanceKm(key)), key).not.toBe('');
    }
  });

  it('returns null rather than a fake number for a body with no single distance', () => {
    expect(tripDistanceKm('sun')).toBeNull();
    expect(tripDistanceKm('nope')).toBeNull();
    expect(bodyEntry('nope')).toBeNull();
  });
});

describe('formatDistanceKo — magnitudes a Korean child hears', () => {
  it('reads below 억 in 만', () => {
    expect(formatDistanceKo(384400)).toBe(`38만 ${STR.playTripKm}`);
  });

  it('switches to 억 at a hundred million and keeps one decimal', () => {
    expect(formatDistanceKo(1e8)).toBe(`1억 ${STR.playTripKm}`);
    expect(formatDistanceKo(6.28e8)).toBe(`6.3억 ${STR.playTripKm}`);
  });

  it('drops the decimal once the number is large enough not to need it', () => {
    expect(formatDistanceKo(1e10)).toBe(`100억 ${STR.playTripKm}`);
  });

  it('says nothing rather than "0" when there is no distance', () => {
    expect(formatDistanceKo(null)).toBe('');
    expect(formatDistanceKo(0)).toBe('');
  });
});

describe('rocketX — the rocket stays on the road', () => {
  it('starts on the launch body edge and ends on the destination edge', () => {
    expect(rocketX(0)).toBeCloseTo(-LANE_HALF + BODY_RADIUS, 6);
    expect(rocketX(1)).toBeCloseTo(LANE_HALF - BODY_RADIUS, 6);
  });

  it('never flies inside either body, however the clock overshoots', () => {
    for (const t of [-5, 0, 0.5, 1, 9]) {
      expect(Math.abs(rocketX(t))).toBeLessThanOrEqual(LANE_HALF - BODY_RADIUS + 1e-9);
    }
  });
});

describe('RocketTrip overlay', () => {
  it('offers exactly the destinations travelFacts can speak for', () => {
    const { trip } = makeTrip();
    for (const key of eligibleDestinations()) expect(trip.canLaunch(key), key).toBe(true);
    expect(trip.canLaunch('earth')).toBe(false);
    expect(trip.canLaunch('sun')).toBe(false);
    expect(trip.canLaunch('halley')).toBe(false);
  });

  it('opens with the spoken duration fact, the distance and both names', () => {
    const { trip, speak } = makeTrip();
    expect(trip.launch('mars')).toBe(true);

    const panel = document.querySelector('.rockettrip-panel');
    expect(panel.querySelector('.rockettrip-fact').textContent).toBe(travelFactKo('mars'));
    expect(panel.querySelector('.rockettrip-distance').textContent)
      .toBe(STR.playTripDistanceNear(formatDistanceKo(tripDistanceKm('mars'))));
    const names = [...panel.querySelectorAll('.rockettrip-name')].map((el) => el.textContent);
    expect(names).toEqual([PLANET_DATA.earth.nameKo, PLANET_DATA.mars.nameKo]);
    expect(speak).toHaveBeenCalledWith(travelFactKo('mars'));
  });

  it('words the Moon distance as fixed, not as a closest approach', () => {
    const { trip } = makeTrip();
    trip.launch('moon');
    expect(document.querySelector('.rockettrip-distance').textContent)
      .toBe(STR.playTripDistanceFixed(formatDistanceKo(384400)));
  });

  it('refuses a body it cannot speak for, without opening anything', () => {
    const { trip, emit } = makeTrip();
    expect(trip.launch('sun')).toBe(false);
    expect(document.querySelector('.rockettrip')).toBeNull();
    expect(emit).not.toHaveBeenCalled();
  });

  it('hands the two bodies to the scene and frees the context on close', () => {
    const { trip, scene } = makeTrip();
    trip.launch('jupiter');
    expect(scene.shown.from.key).toBe('earth');
    expect(scene.shown.to.key).toBe('jupiter');
    expect(trip.isOpen).toBe(true);

    trip.close();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.rockettrip')).toBeNull();
    expect(trip.isOpen).toBe(false);
  });

  it('reports the arrival once, so a looping flight cannot re-tick a mission', () => {
    const { trip, scene, emit } = makeTrip();
    trip.launch('venus');
    scene.opts.onArrive();
    scene.opts.onArrive();
    const arrivals = emit.mock.calls.filter(([type]) => type === 'rocket-arrived');
    // The scene guards the repeat; this asserts the overlay passes it straight
    // through rather than adding its own emit per lap.
    expect(arrivals.length).toBe(2);
    expect(arrivals[0][1]).toEqual({ body: 'venus' });
  });

  it('still arrives when the scene cannot be built, so missions never stall on WebGL', () => {
    const { trip, emit } = makeTrip({ throwOnCreate: true });
    expect(trip.launch('mars')).toBe(true);
    expect(document.querySelector('.rockettrip-fact').textContent).toBe(travelFactKo('mars'));
    expect(emit.mock.calls.some(([type]) => type === 'rocket-arrived')).toBe(true);
  });

  it('cancel closes it — the seam the view already calls on a new pick', () => {
    const { trip } = makeTrip();
    trip.launch('mars');
    trip.cancel();
    expect(document.querySelector('.rockettrip')).toBeNull();
  });
});
