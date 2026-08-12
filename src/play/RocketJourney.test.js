import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import {
  RocketJourney,
  bezierPoint,
  controlPoint,
  flightDurationMs,
  MIN_FLIGHT_MS,
  MAX_FLIGHT_MS,
} from './RocketJourney.js';
import { travelFactKo } from './travelFacts.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

describe('rocket path math (REQ-PLAY-201, AC-PLAY-201)', () => {
  describe('quadratic bezier', () => {
    it('starts exactly at P0', () => {
      const p = bezierPoint(v(200, 0, 0), v(300, 100, 0), v(-450, 0, 30), 0);
      expect(p.x).toBeCloseTo(200, 10);
      expect(p.y).toBeCloseTo(0, 10);
      expect(p.z).toBeCloseTo(0, 10);
    });

    it('ends exactly at P2', () => {
      const p = bezierPoint(v(200, 0, 0), v(300, 100, 0), v(-450, 0, 30), 1);
      expect(p.x).toBeCloseTo(-450, 10);
      expect(p.z).toBeCloseTo(30, 10);
    });

    it('is continuous and monotone in t along a straight arc', () => {
      const p0 = v(0, 0, 0);
      const p2 = v(100, 0, 0);
      const p1 = controlPoint(p0, p2);
      let previous = -Infinity;
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const x = bezierPoint(p0, p1, p2, t).x;
        expect(x).toBeGreaterThan(previous);
        previous = x;
      }
    });
  });

  describe('control point (apex above the ecliptic)', () => {
    it('lifts the curve above both endpoints', () => {
      const p0 = v(200, 0, 0);
      const p2 = v(-450, 0, 30);
      const apex = bezierPoint(p0, controlPoint(p0, p2), p2, 0.5);
      expect(apex.y).toBeGreaterThan(Math.max(p0.y, p2.y));
    });

    it('scales the arc height with the distance travelled', () => {
      const near = controlPoint(v(0, 0, 0), v(20, 0, 0)).y;
      const far = controlPoint(v(0, 0, 0), v(1200, 0, 0)).y;
      expect(far).toBeGreaterThan(near);
      expect(far / near).toBeCloseTo(60, 0);
    });
  });

  describe('flight duration (real time, not simulation time)', () => {
    it("holds the floor for the Moon's short hop (acceptance §3)", () => {
      expect(flightDurationMs(15)).toBeGreaterThanOrEqual(MIN_FLIGHT_MS);
    });

    it('clamps the longest trip in the scene', () => {
      expect(flightDurationMs(100000)).toBe(MAX_FLIGHT_MS);
      expect(MAX_FLIGHT_MS).toBe(6000);
    });

    it('grows with distance between the floor and the ceiling', () => {
      expect(flightDurationMs(600)).toBeGreaterThan(flightDurationMs(200));
      expect(flightDurationMs(600)).toBeLessThanOrEqual(MAX_FLIGHT_MS);
    });
  });
});

describe('RocketJourney (REQ-PLAY-201..205)', () => {
  let scene;
  let bodies;
  let celebration;
  let speak;
  let emit;
  let clock;
  let journey;

  function build({ reducedMotion = false } = {}) {
    return new RocketJourney({
      scene,
      getBody: (key) => bodies[key] ?? null,
      celebration,
      speak,
      emit,
      reducedMotion,
      now: () => clock.ms,
    });
  }

  beforeEach(() => {
    scene = new THREE.Scene();
    bodies = {
      earth: { position: v(200, 0, 0), radius: 8 },
      mars: { position: v(0, 0, 300), radius: 5 },
      moon: { position: v(215, 0, 0), radius: 3 },
      sun: { position: v(0, 0, 0), radius: 50 },
      sirius: { position: v(9000, 0, 0), radius: 20 },
    };
    celebration = { burst: vi.fn() };
    speak = vi.fn();
    emit = vi.fn();
    clock = { ms: 1000 };
    journey = build();
  });

  /** Advance the wall clock and pump the frame loop the way the view does. */
  function fly(ms, step = 16) {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.ms += step;
      journey.update();
    }
  }

  describe('eligible destinations (REQ-PLAY-201)', () => {
    it('accepts planets, the Moon and dwarf planets', () => {
      expect(journey.canLaunch('mars')).toBe(true);
      expect(journey.canLaunch('moon')).toBe(true);
      expect(journey.canLaunch('pluto')).toBe(true);
    });

    it('refuses the launch pad, the Sun and the stars', () => {
      expect(journey.canLaunch('earth')).toBe(false);
      expect(journey.canLaunch('sun')).toBe(false);
      expect(journey.canLaunch('sirius')).toBe(false);
      expect(journey.canLaunch(undefined)).toBe(false);
    });

    it('spawns nothing for an ineligible destination', () => {
      expect(journey.launch('sun')).toBe(false);
      expect(scene.children).toHaveLength(0);
      expect(journey.isFlying()).toBe(false);
    });

    it('refuses a destination the scene cannot place', () => {
      expect(journey.launch('pluto')).toBe(false); // eligible, but not in `bodies`
      expect(journey.isFlying()).toBe(false);
    });
  });

  describe('the flight (REQ-PLAY-201, AC-PLAY-201)', () => {
    it('spawns one rocket at Earth and flies it', () => {
      expect(journey.launch('mars')).toBe(true);
      expect(journey.isFlying()).toBe(true);
      expect(scene.children).toHaveLength(1);
      expect(journey.position().distanceTo(bodies.earth.position)).toBeLessThan(1e-6);
    });

    it('keeps P0 frozen at the launch position while Earth moves on', () => {
      journey.launch('mars');
      const launchedFrom = bodies.earth.position.clone();
      bodies.earth.position.set(-200, 0, 0); // half an orbit later

      fly(200);

      expect(journey.position().distanceTo(launchedFrom)).toBeLessThan(
        journey.position().distanceTo(bodies.earth.position),
      );
    });

    // @MX-adjacent: this is the moving-target landing (plan §A.5). P2 is re-read
    // every frame, so the curve bends onto wherever the body has drifted to.
    it('lands on the destination even though it moved during the flight', () => {
      journey.launch('mars');
      for (let i = 0; i < 500 && journey.isFlying(); i += 1) {
        clock.ms += 16;
        bodies.mars.position.x -= 0.4; // Mars keeps orbiting mid-flight
        bodies.mars.position.z += 0.2;
        journey.update();
      }

      expect(journey.isFlying()).toBe(false);
      const landed = celebration.burst.mock.calls.at(-1)[0];
      expect(landed.distanceTo(bodies.mars.position)).toBeLessThan(1e-6);
    });

    it('arcs above the ecliptic on the way (AC-PLAY-201)', () => {
      journey.launch('mars');
      let peak = -Infinity;
      while (journey.isFlying()) {
        clock.ms += 16;
        journey.update();
        peak = Math.max(peak, journey.position().y);
      }
      expect(peak).toBeGreaterThan(0);
    });

    it('is driven by the wall clock, not by the frame count', () => {
      journey.launch('mars');
      for (let i = 0; i < 2000; i += 1) journey.update(); // clock frozen
      expect(journey.isFlying(), 'a paused clock means a paused flight').toBe(true);
      expect(celebration.burst).not.toHaveBeenCalled();

      clock.ms += MAX_FLIGHT_MS;
      journey.update();
      expect(journey.isFlying()).toBe(false);
    });
  });

  describe('arrival (REQ-PLAY-202, AC-PLAY-202)', () => {
    beforeEach(() => {
      journey.launch('mars');
      fly(MAX_FLIGHT_MS + 100);
    });

    it('celebrates at the destination', () => {
      expect(celebration.burst).toHaveBeenCalledTimes(1);
      const [at, variant, radius] = celebration.burst.mock.calls[0];
      expect(at.distanceTo(bodies.mars.position)).toBeLessThan(1e-6);
      expect(variant).toBe('sparkle');
      expect(radius).toBe(bodies.mars.radius);
    });

    it("speaks the destination's Korean travel fact", () => {
      expect(speak).toHaveBeenCalledTimes(1);
      expect(speak).toHaveBeenCalledWith(travelFactKo('mars'));
      expect(speak).toHaveBeenCalledWith('화성까지는 반년을 날아가야 해요!');
    });

    it('emits rocket-arrived for the mission engine', () => {
      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith('rocket-arrived', { body: 'mars' });
    });

    it('cleans the rocket out of the scene and stops', () => {
      expect(scene.children).toHaveLength(0);
      expect(journey.isFlying()).toBe(false);
      expect(journey.destination).toBeNull();
    });

    it('arrives exactly once however long the loop keeps running', () => {
      fly(10000);
      expect(celebration.burst).toHaveBeenCalledTimes(1);
      expect(speak).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancellation (REQ-PLAY-204, AC-PLAY-204)', () => {
    it('disposes the rocket and its trail', () => {
      journey.launch('mars');
      const disposed = [];
      scene.children[0].traverse((child) => {
        if (child.geometry) vi.spyOn(child.geometry, 'dispose').mockImplementation(() => disposed.push('geometry'));
        if (child.material) vi.spyOn(child.material, 'dispose').mockImplementation(() => disposed.push('material'));
      });

      journey.cancel();

      expect(scene.children).toHaveLength(0);
      expect(disposed).toContain('geometry');
      expect(disposed).toContain('material');
      expect(journey.isFlying()).toBe(false);
      expect(journey.destination).toBeNull();
    });

    it('fires no callback after cancel, however far the clock runs', () => {
      journey.launch('mars');
      fly(500);
      journey.cancel();

      fly(MAX_FLIGHT_MS * 3);

      expect(celebration.burst).not.toHaveBeenCalled();
      expect(speak).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
      expect(scene.children).toHaveLength(0);
    });

    it('is safe to cancel when nothing is flying', () => {
      expect(() => journey.cancel()).not.toThrow();
      expect(() => journey.cancel()).not.toThrow();
    });

    it('relaunching mid-flight leaves exactly one rocket and one arrival', () => {
      journey.launch('mars');
      fly(500);
      journey.launch('moon');

      expect(scene.children).toHaveLength(1);
      expect(journey.destination).toBe('moon');

      fly(MAX_FLIGHT_MS + 100);

      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith('rocket-arrived', { body: 'moon' });
    });

    it('goes inert after dispose', () => {
      journey.launch('mars');
      journey.dispose();
      expect(scene.children).toHaveLength(0);
      expect(journey.launch('mars')).toBe(false);
      fly(MAX_FLIGHT_MS + 100);
      expect(celebration.burst).not.toHaveBeenCalled();
    });
  });

  describe('reduced motion (REQ-PLAY-205, AC-PLAY-205)', () => {
    beforeEach(() => {
      journey = build({ reducedMotion: true });
    });

    it('skips the flight and presents the arrival immediately', () => {
      expect(journey.launch('mars')).toBe(true);

      expect(journey.isFlying()).toBe(false);
      expect(scene.children, 'no rocket is ever built').toHaveLength(0);
      expect(celebration.burst).toHaveBeenCalledTimes(1);
      expect(speak).toHaveBeenCalledWith(travelFactKo('mars'));
      expect(emit).toHaveBeenCalledWith('rocket-arrived', { body: 'mars' });
    });

    it('still refuses an ineligible destination', () => {
      expect(journey.launch('sun')).toBe(false);
      expect(celebration.burst).not.toHaveBeenCalled();
    });
  });

  describe('honesty (REQ-PLAY-203, AC-PLAY-203)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/play/RocketJourney.js'), 'utf8');

    it('says in the code that the path is schematic, not a transfer orbit', () => {
      expect(source).toMatch(/schematic/i);
      expect(source).toMatch(/transfer orbit/i);
    });

    it('contains no transfer-orbit math', () => {
      expect(source).not.toMatch(/hohmann/i);
      expect(source).not.toMatch(/delta[-_ ]?v/i);
      expect(source).not.toMatch(/launch window/i);
    });
  });
});
