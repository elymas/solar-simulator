// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SizeCompare,
  comparisonRows,
  canCompareSize,
  MAX_COUNT,
} from './SizeCompare.js';
import { layoutLineup, LANE_WIDTH } from './SizeCompareScene.js';
import { PLANET_DATA, MOON_DATA, STAR_DATA } from '../planets/planetData.js';

const moon = MOON_DATA.earth[0];

function build(opts = {}) {
  const speak = vi.fn();
  const emit = vi.fn();
  const view = new SizeCompare({ speak, emit, ...opts });
  return { view, speak, emit };
}

/** The lineup laid out for a body's first comparison row. */
function lineupFor(key, data) {
  const [row] = comparisonRows(key, data);
  return { row, layout: layoutLineup(row.ratio, row.count) };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('size ratio math (REQ-PLAY-102, AC-PLAY-102)', () => {
  it('derives Jupiter/Earth from the real radius fields, within 5% of 10.97', () => {
    const [row] = comparisonRows('jupiter', PLANET_DATA.jupiter);
    expect(row.ratio).toBeCloseTo(PLANET_DATA.jupiter.radius / PLANET_DATA.earth.radius, 10);
    expect(Math.abs(row.ratio / 10.97 - 1)).toBeLessThan(0.05);
    expect(row.count).toBe(11);
  });

  it('derives Sun/Earth within 5% of 109', () => {
    const [row] = comparisonRows('sun', PLANET_DATA.sun);
    expect(Math.abs(row.ratio / 109 - 1)).toBeLessThan(0.05);
    expect(row.count).toBe(109);
  });

  it('never reads the symbolic displayRadius', () => {
    const fake = { ...PLANET_DATA.jupiter, displayRadius: 1 };
    const [a] = comparisonRows('jupiter', PLANET_DATA.jupiter);
    const [b] = comparisonRows('jupiter', fake);
    expect(b.ratio).toBe(a.ratio);
  });

  it('always puts the larger body on the big side, whichever was selected', () => {
    const [row] = comparisonRows('mars', PLANET_DATA.mars);
    expect(row.big.key).toBe('earth');
    expect(row.small.key).toBe('mars');
    expect(row.ratio).toBeGreaterThan(1);
  });
});

describe('lineup composition (REQ-PLAY-101, AC-PLAY-101)', () => {
  it('compares a planet against Earth first, Sun second where countable', () => {
    const rows = comparisonRows('mercury', PLANET_DATA.mercury);
    expect(rows.map((r) => r.big.key === 'mercury' ? r.small.key : r.big.key)).toEqual(['earth']);
  });

  it('compares Earth against the Sun only — never against itself', () => {
    const rows = comparisonRows('earth', PLANET_DATA.earth);
    expect(rows).toHaveLength(1);
    expect(rows[0].big.key).toBe('sun');
    expect(rows[0].small.key).toBe('earth');
  });

  it('compares the Sun against Earth only — never against itself', () => {
    const rows = comparisonRows('sun', PLANET_DATA.sun);
    expect(rows).toHaveLength(1);
    expect(rows.every((r) => r.big.key !== r.small.key)).toBe(true);
  });

  it('allows a star where its diameter makes a countable lineup', () => {
    expect(canCompareSize('siriusB', STAR_DATA.siriusB)).toBe(true);
    const rows = comparisonRows('siriusB', STAR_DATA.siriusB);
    expect(rows.map((r) => (r.big.key === 'siriusB' ? r.small.key : r.big.key))).toEqual([
      'earth',
      'sun',
    ]);
  });

  it('drops a row no child could count rather than rendering sub-pixel discs', () => {
    const rows = comparisonRows('betelgeuse', STAR_DATA.betelgeuse);
    expect(rows).toEqual([]);
    expect(comparisonRows('sun', PLANET_DATA.sun)[0].count).toBeLessThanOrEqual(MAX_COUNT);
  });

  it('drops a row no half can state honestly rather than rounding a lie', () => {
    // Sirius A is 1.71 suns: "1개 반" is 12% off and "2개" is 17% off, both past
    // the §8.1 window. The InfoPanel's authored "1.7배쯤" fact still covers it.
    expect(comparisonRows('siriusA', STAR_DATA.siriusA)).toEqual([]);
    expect(canCompareSize('siriusA', STAR_DATA.siriusA)).toBe(false);
  });
});

describe('eligibility is data-driven (acceptance §3)', () => {
  it('hides the entry point for a body carrying no real diameter', () => {
    expect(canCompareSize('mystery', { nameKo: '수수께끼' })).toBe(false);
    expect(canCompareSize('mystery', { nameKo: '수수께끼', radius: 0 })).toBe(false);
    expect(canCompareSize('nothing', null)).toBe(false);
  });

  it('offers it for every body that has one', () => {
    expect(canCompareSize('earth', PLANET_DATA.earth)).toBe(true);
    expect(canCompareSize('moon', moon)).toBe(true);
    expect(canCompareSize('pluto', PLANET_DATA.pluto)).toBe(true);
  });

  it('refuses to open when nothing is comparable', () => {
    const { view, speak, emit } = build();
    expect(view.open('mystery', { nameKo: '수수께끼' })).toBe(false);
    expect(view.isOpen).toBe(false);
    expect(speak).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('rendered widths match the true ratio (AC-PLAY-102)', () => {
  // The picture moved from DOM discs to an orthographic 3D lineup, so the width
  // claim is asserted where it is now decided: in the layout maths the scene
  // builds spheres from. Orthographic is what keeps this arithmetic equal to what
  // reaches the screen — under perspective the near end of the row would be wider
  // and none of these spans would hold.
  it('sizes the small body at exactly 1/ratio of the big one', () => {
    const { layout } = lineupFor('jupiter', PLANET_DATA.jupiter);
    const trueRatio = PLANET_DATA.jupiter.radius / PLANET_DATA.earth.radius;

    expect(layout.bigRadius * 2).toBe(LANE_WIDTH);
    expect(Math.abs(layout.bigRadius / layout.unitRadius / trueRatio - 1)).toBeLessThan(0.05);
  });

  it('lays out exactly `count` units, so the row IS the width claim', () => {
    const { row, layout } = lineupFor('sun', PLANET_DATA.sun);

    expect(row.count).toBe(109);
    expect(layout.unitCentersX).toHaveLength(109);
    const spanned = layout.unitRadius * 2 * row.count;
    expect(Math.abs(spanned / LANE_WIDTH - 1)).toBeLessThan(0.05);
  });

  it('lays the units edge to edge, with no gap to inflate the span', () => {
    const { layout } = lineupFor('sun', PLANET_DATA.sun);
    const step = layout.unitCentersX[1] - layout.unitCentersX[0];
    expect(step).toBeCloseTo(layout.unitRadius * 2, 6);
  });

  it('draws a half count as a half-width unit, so the row still spans the claim', () => {
    const { row, layout } = lineupFor('mercury', PLANET_DATA.mercury);

    expect(row.count).toBe(2.5);
    expect(layout.unitCentersX).toHaveLength(3); // 2개 반
    expect(layout.halfUnit).toBe(true);
    const spanned = layout.unitRadius * 2 * row.count;
    expect(Math.abs(spanned / LANE_WIDTH - 1)).toBeLessThan(0.05);
  });
});

describe('the 3D lineup replaces the discs without touching the main scene (REQ-PLAY-103)', () => {
  it('gives every row one canvas and starts one scene per row', () => {
    const scenes = [];
    const { view } = build({
      createScene: (opts) => {
        const scene = { ...opts, shown: null, disposed: false,
          show(row) { this.shown = row; }, resize() {}, dispose() { this.disposed = true; } };
        scenes.push(scene);
        return scene;
      },
    });

    view.open('sun', PLANET_DATA.sun);

    const canvases = view.el.querySelectorAll('.sizecompare-canvas');
    expect(canvases).toHaveLength(view.rows.length);
    expect(scenes).toHaveLength(view.rows.length);
    expect(scenes[0].shown.count).toBe(109);
  });

  it('disposes every scene on close, so no GPU context outlives the overlay', () => {
    const scenes = [];
    const { view } = build({
      createScene: () => {
        const scene = { shown: null, disposed: false,
          show(row) { this.shown = row; }, resize() {}, dispose() { this.disposed = true; } };
        scenes.push(scene);
        return scene;
      },
    });

    view.open('sun', PLANET_DATA.sun);
    view.close();

    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((s) => s.disposed)).toBe(true);
  });

  it('still shows the fact when the scene cannot start at all (no WebGL)', () => {
    const { view, speak } = build({
      createScene: () => { throw new Error('no webgl'); },
    });

    expect(view.open('sun', PLANET_DATA.sun)).toBe(true);
    expect(view.el.querySelector('.sizecompare-fact').textContent).toContain('109');
    expect(speak).toHaveBeenCalledTimes(1);
  });
});

describe('the count fact (REQ-PLAY-101, AC-PLAY-101)', () => {
  it('renders the fact at a display-dominant size', () => {
    const { view } = build();
    view.open('sun', PLANET_DATA.sun);

    const fact = view.el.querySelector('.sizecompare-fact');
    expect(fact.textContent).toContain('109');
    const size = (el) => parseFloat(getComputedStyle(el).fontSize);
    expect(size(fact)).toBeGreaterThanOrEqual(24);
    for (const other of view.el.querySelectorAll('.sizecompare-name, .sizecompare-close')) {
      expect(size(fact), other.className).toBeGreaterThan(size(other));
    }
  });

  it('speaks the fact exactly once per open', () => {
    const { view, speak } = build();
    view.open('sun', PLANET_DATA.sun);

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toBe(view.el.querySelector('.sizecompare-fact').textContent);
  });

  it('speaks once more on a re-open, never twice on one', () => {
    const { view, speak } = build();
    view.open('sun', PLANET_DATA.sun);
    view.close();
    view.open('jupiter', PLANET_DATA.jupiter);

    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('words a near-equal pair as "거의 같아요" instead of "1개"', () => {
    const [row] = comparisonRows('venus', PLANET_DATA.venus);
    expect(row.count).toBe(1);
    expect(row.factKo).not.toContain('1개');
    expect(row.factKo).toContain('거의 같아요');
  });

  it('rounds to a half rather than lying by a whole body', () => {
    // Earth/Mercury is 2.61: "3개" would be 15% off, past the §8.1 ±10% window.
    const [row] = comparisonRows('mercury', PLANET_DATA.mercury);
    expect(row.count).toBe(2.5);
    expect(row.factKo).toBe('수성 2개 반을 나란히 놓으면 지구 폭이에요!');
  });

  it('passes the SPEC-KIDS-001 §8.1 checklist for every body it can render', () => {
    const bodies = [
      ...Object.entries(PLANET_DATA),
      ...MOON_DATA.earth.map((m) => [m.key, m]),
      ...Object.entries(STAR_DATA),
    ];
    for (const [key, data] of bodies) {
      for (const row of comparisonRows(key, data)) {
        expect(row.factKo.length, `${key}: ${row.factKo}`).toBeLessThanOrEqual(45);
        expect(row.factKo, key).toMatch(/요!$/); // 해요체
        expect(row.factKo, key).not.toMatch(/[A-Za-z]{2,}/); // no English word
        // Rule 3: the spoken count must be within 10% of the real ratio.
        if (row.count > 1) {
          expect(Math.abs(row.count / row.ratio - 1), `${key} count honesty`).toBeLessThan(0.1);
        }
      }
    }
  });
});

describe('close restores the prior state (REQ-PLAY-103, AC-PLAY-103)', () => {
  it('removes itself from the document and leaves nothing behind', () => {
    const { view } = build();
    view.open('sun', PLANET_DATA.sun);
    expect(document.body.contains(view.el)).toBe(true);

    view.close();

    expect(view.isOpen).toBe(false);
    expect(document.querySelector('.sizecompare')).toBeNull();
  });

  it('closes from the close button and from Escape', () => {
    const { view } = build();
    view.open('sun', PLANET_DATA.sun);
    view.el.querySelector('.sizecompare-close').click();
    expect(view.isOpen).toBe(false);

    view.open('sun', PLANET_DATA.sun);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(view.isOpen).toBe(false);
  });

  it('touches no 3D scene: the module imports neither three.js nor a renderer', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/play/SizeCompare.js'), 'utf8');
    // Comments stripped: the claim is about code, and the honesty note itself
    // names the camera it promises never to touch.
    const code = source.replace(/^\s*(\/\/|\/\*|\*).*$/gm, '');
    expect(code).not.toMatch(/from ['"]three/);
    expect(code).not.toMatch(/sceneManager|WebGLRenderer|camera|renderer/i);
  });
});

describe('reduced motion (REQ-PLAY-104, AC-PLAY-104)', () => {
  it('carries no animation class and identical content', () => {
    const loud = build();
    loud.view.open('sun', PLANET_DATA.sun);
    const loudText = loud.view.el.textContent;
    const loudDiscs = loud.view.el.querySelectorAll('.sizecompare-disc').length;
    loud.view.dispose();

    const quiet = build({ reducedMotion: true });
    quiet.view.open('sun', PLANET_DATA.sun);

    expect(loud.view.el.className).toContain('sizecompare--animated');
    expect(quiet.view.el.className).not.toContain('sizecompare--animated');
    expect(quiet.view.el.textContent).toBe(loudText);
    expect(quiet.view.el.querySelectorAll('.sizecompare-disc')).toHaveLength(loudDiscs);
  });
});

describe('play-event seam (plan §A.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits size-compare with the body that was opened', () => {
    const { view, emit } = build();
    view.open('sun', PLANET_DATA.sun);

    expect(emit).toHaveBeenCalledWith('size-compare', { body: 'sun' });
  });
});

describe('accessibility (spec §5)', () => {
  it('labels the dialog and its close button in Korean', () => {
    const { view } = build();
    view.open('sun', PLANET_DATA.sun);

    expect(view.el.getAttribute('role')).toBe('dialog');
    expect(view.el.getAttribute('aria-label')).toMatch(/[가-힣]/);
    const close = view.el.querySelector('.sizecompare-close');
    expect(close.getAttribute('aria-label')).toMatch(/[가-힣]/);
    expect(close.tagName).toBe('BUTTON');
    expect(parseFloat(getComputedStyle(close).minWidth)).toBeGreaterThanOrEqual(44);
    expect(parseFloat(getComputedStyle(close).minHeight)).toBeGreaterThanOrEqual(44);
  });
});
