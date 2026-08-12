// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfoPanel } from './InfoPanel.js';
import { speakBody, isAvailable } from '../audio/tts.js';
import { STR } from './strings.js';

vi.mock('../audio/tts.js', () => ({
  speakBody: vi.fn(),
  isAvailable: vi.fn(() => true),
}));

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

// A body carrying the SPEC-KIDS-001 kid-facts fields.
const marsData = {
  ...earthData,
  name: 'Mars',
  nameKo: '화성',
  emoji: '🔴',
  factsKo: [
    '붉은 먼지로 덮여 있어서 빨갛게 보여요.',
    '태양계에서 가장 큰 화산이 있어요.',
    '로봇 탐사차가 화성을 달리고 있어요.',
  ],
  sizeComparisonKo: '화성은 지구의 절반 크기예요!',
};

beforeEach(() => {
  vi.clearAllMocks();
  isAvailable.mockReturnValue(true);
});

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

describe('InfoPanel kid view (REQ-KIDS-302)', () => {
  it('puts the Korean name before the English name in DOM order', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    const ko = panel.el.querySelector('.planet-name-ko');
    const en = panel.el.querySelector('.planet-name');
    expect(ko.textContent).toBe('화성');
    expect(en.textContent).toBe('Mars');
    // Node.DOCUMENT_POSITION_FOLLOWING === 4: `en` comes after `ko`.
    expect(ko.compareDocumentPosition(en) & 4).toBeTruthy();
  });

  it('renders the Korean name strictly larger than the English secondary', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    const size = (el) => parseFloat(getComputedStyle(el).fontSize);
    expect(size(panel.el.querySelector('.planet-name-ko')))
      .toBeGreaterThan(size(panel.el.querySelector('.planet-name')));
  });

  it('renders facts as text, never as markup (SPEC-EARTH-003 feeds this from an API)', () => {
    const panel = new InfoPanel();
    panel.show('mars', { ...marsData, factsKo: ['<img src=x onerror=alert(1)>', 'b', 'c'] });

    const first = panel.el.querySelector('.kid-fact');
    expect(first.querySelector('img')).toBeNull();
    expect(first.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('renders the emoji and the size comparison', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    expect(panel.el.querySelector('.kid-emoji').textContent).toBe('🔴');
    expect(panel.el.querySelector('.kid-size').textContent).toBe(marsData.sizeComparisonKo);
  });

  it('renders all three facts at 18px or larger', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    const facts = panel.el.querySelectorAll('.kid-fact');
    expect(facts).toHaveLength(3);
    expect([...facts].map((f) => f.textContent)).toEqual(marsData.factsKo);
    const size = parseFloat(getComputedStyle(facts[0]).fontSize);
    expect(size).toBeGreaterThanOrEqual(18);
  });

  it('keeps the scientific table markup intact inside the expander', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    const grid = panel.el.querySelector('.info-details .info-grid');
    expect(grid).not.toBeNull();
    expect(grid.querySelectorAll('.info-item').length).toBeGreaterThan(0);
    expect(grid.querySelector('.info-label')).not.toBeNull();
    expect(grid.querySelector('.info-value')).not.toBeNull();
  });
});

describe('InfoPanel Korean labels and units (REQ-KIDS-103, REQ-KIDS-105)', () => {
  it('labels the table in Korean and attaches Korean unit words to values', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    const rows = [...panel.el.querySelectorAll('.info-item')].map((r) => [
      r.querySelector('.info-label').textContent,
      r.querySelector('.info-value').textContent,
    ]);

    expect(rows).toContainEqual([STR.infoOrbitalPeriod, '1.00년']);
    expect(rows).toContainEqual([STR.infoRotationPeriod, '23.9시간']);
    expect(rows.map(([label]) => label)).toContain(STR.infoDiameter);
    // No space before a Korean unit, and no English unit words left.
    expect(panel.el.querySelector('.info-details').textContent).not.toMatch(/years|days|hours/);
  });

  it('marks a retrograde rotation in Korean', () => {
    const panel = new InfoPanel();
    panel.show('venus', { ...marsData, rotationPeriod: -5832.5 });

    const values = [...panel.el.querySelectorAll('.info-value')].map((v) => v.textContent);
    expect(values).toContain(`243.0${STR.unitDay}${STR.infoRetrogradeSuffix}`);
  });
});

describe('InfoPanel details expander (REQ-KIDS-303)', () => {
  it('starts collapsed for a body that has facts', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    expect(panel.el.querySelector('.info-details').hidden).toBe(true);
  });

  it('reveals the table on click without closing the panel', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    panel.el.querySelector('.kid-details-toggle').click();

    expect(panel.el.querySelector('.info-details').hidden).toBe(false);
    expect(panel.isOpen).toBe(true);
  });

  it('starts expanded for a fact-less body, whose table is all it has', () => {
    const panel = new InfoPanel();
    panel.show('mimas', { name: 'Mimas', nameKo: '미마스', radius: 198.2, axialTilt: 0 });

    expect(panel.el.querySelector('.info-details').hidden).toBe(false);
    expect(panel.el.querySelectorAll('.kid-fact')).toHaveLength(0);
  });
});

describe('InfoPanel replay button (REQ-KIDS-204, REQ-KIDS-206)', () => {
  it('re-speaks the current body when clicked', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);
    speakBody.mockClear(); // show() itself must not narrate; only the gesture does

    panel.el.querySelector('.kid-replay').click();

    expect(speakBody).toHaveBeenCalledTimes(1);
    expect(speakBody.mock.calls[0][0]).toMatchObject({ nameKo: '화성' });
  });

  it('hides the button entirely when no speech engine exists', () => {
    isAvailable.mockReturnValue(false);
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    expect(panel.el.querySelector('.kid-replay').hidden).toBe(true);
    // Scenario 4: the kid view still renders in full.
    expect(panel.el.querySelectorAll('.kid-fact')).toHaveLength(3);
  });

  it('never narrates from show() alone (no page-load speech)', () => {
    const panel = new InfoPanel();
    panel.show('mars', marsData);

    expect(speakBody).not.toHaveBeenCalled();
  });
});
