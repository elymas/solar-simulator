// Rocket destination travel facts (SPEC-PLAY-001 REQ-PLAY-202/203).
//
// HONESTY NOTE (REQ-PLAY-203): the rocket's flight in the scene is a SCHEMATIC
// curve — a stylized arc drawn over a few real-time seconds. It is NOT a
// transfer orbit: no Hohmann geometry, no launch window, no delta-v anywhere in
// this feature. The animation is theatre; the SPOKEN fact is where the truth lives,
// which is why every entry below is anchored to a real mission or a real cruise
// speed in its `// 참고:` comment. Ages-5 wording rounds those durations, never
// invents them (SPEC-KIDS-001 §8.1 rule 3).
//
// Reference basis for the bodies no spacecraft has visited (하우메아, 마케마케,
// 에리스): New Horizons' post-Jupiter cruise of roughly 3.4 AU per year, applied to
// each body's semi-major axis in planetData.js.

import { PLANET_DATA, MOON_DATA } from '../planets/planetData.js';

/** Earth is the launch pad, so it cannot also be a destination. */
const LAUNCH_SITE = 'earth';

/**
 * Korean travel fact per destination. Ordered outward from Earth.
 * Every duration is one-way and approximate — see the reference beside each row.
 */
export const TRAVEL_FACTS_KO = {
  moon: '달까지는 삼 일이면 갈 수 있어요!', // 참고: 아폴로 11호 3일 3시간
  venus: '금성까지는 넉 달쯤 날아가야 해요!', // 참고: 마리너 2호 110일 / 비너스 익스프레스 153일
  mercury: '수성까지는 다섯 달쯤 날아가야 해요!', // 참고: 마리너 10호 147일
  mars: '화성까지는 반년을 날아가야 해요!', // 참고: 퍼서비어런스 203일 / 마스 익스프레스 201일
  ceres: '세레스까지는 네 해쯤 날아가야 해요!', // 참고: 던 탐사선, 베스타 경유 구간을 뺀 순항 기준
  jupiter: '목성까지는 한 해 반을 날아가야 해요!', // 참고: 보이저 1호 546일
  saturn: '토성까지는 세 해를 날아가야 해요!', // 참고: 보이저 1호 3년 2개월
  uranus: '천왕성까지는 여덟 해나 날아가야 해요!', // 참고: 보이저 2호 8년 5개월
  neptune: '해왕성까지는 열두 해나 날아가야 해요!', // 참고: 보이저 2호 12년 1개월
  pluto: '명왕성까지는 열 해 가까이 날아가야 해요!', // 참고: 뉴호라이즌스 9년 6개월
  haumea: '하우메아까지는 열세 해쯤 날아가야 해요!', // 참고: 43.1 AU / 연 3.4 AU 순항 환산
  makemake: '마케마케까지는 열네 해쯤 날아가야 해요!', // 참고: 45.8 AU / 연 3.4 AU 순항 환산
  eris: '에리스까지는 스무 해가 넘게 걸려요!', // 참고: 67.8 AU / 연 3.4 AU 순항 환산
};

// @MX:NOTE: [AUTO] Derived, never hand-listed. "Orbits the Sun" is read as "has a
// `distance` field", which is what separates the planets and dwarf planets from the
// Sun inside PLANET_DATA; stars live in STAR_DATA and so are excluded structurally
// rather than by name. Adding a dwarf planet to planetData therefore fails the
// completeness test in travelFacts.test.js until its fact is written.
/**
 * Every body the rocket may fly to: sun-orbiting planets and dwarf planets except
 * Earth, plus Earth's Moon. Not the Sun, not stars (REQ-PLAY-201).
 * @returns {string[]}
 */
export function eligibleDestinations() {
  const orbiting = Object.entries(PLANET_DATA)
    .filter(([key, body]) => key !== LAUNCH_SITE && typeof body.distance === 'number')
    .map(([key]) => key);
  const earthMoons = (MOON_DATA[LAUNCH_SITE] ?? []).map((moon) => moon.key);
  return [...earthMoons, ...orbiting];
}

/**
 * @param {string} destinationKey
 * @returns {string|null} the Korean travel fact, or null for an ineligible body
 */
export function travelFactKo(destinationKey) {
  return TRAVEL_FACTS_KO[destinationKey] ?? null;
}
