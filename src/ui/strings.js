// Korean-first UI strings (SPEC-KIDS-001 K1).
//
// One flat table so the whole chrome sweep is reviewable in a single file and
// testable for completeness. This is deliberately NOT an i18n framework: there
// is no locale switching, no per-locale file and no runtime language toggle
// (spec.md §6 excludes all three). English survives only as a secondary label
// rendered beside the Korean one.
//
// A few values are template functions because they interpolate a number; keeping
// them here rather than in the component is what stops literals from scattering.

export const STR = {
  // Loading screen
  loadingTitle: '태양계',
  loadingSubtitle: '3D 우주 여행',
  loadingProgress: (pct) => `별들을 준비하고 있어요 ${pct}%`,

  // Planet list sidebar
  listTitle: '태양계',
  listDividerDwarf: '왜소행성',
  listDividerComet: '혜성',
  // The category both belts share. Korean has no short kid-word for "belt" as a
  // class, and 소행성대 / 카이퍼 벨트 already say which band each row is.
  listDividerBelt: '띠',
  listDividerStars: '별',
  listToggleTitle: '행성 목록 열고 닫기',
  listMoonToggleTitle: '위성 보기',

  // Mobile icon strip. The visible label is already the body's Korean name, so
  // this only adds the verb a screen reader needs (SPEC-MOBILE-001 NFR a11y).
  stripSelect: (name) => `${name} 보기`,

  // Celebration banner. One string, two channels: the same sentence is both the
  // rendered banner and the spoken callout (SPEC-EVENTS-001 REQ-EVT-303).
  eventAlignment: '행성들이 줄을 섰어요!',

  // Time controls bar
  timeSpeed: '속도',
  timeDate: '날짜',
  timePlayPause: '재생 / 멈춤 (스페이스)',
  timeReset: '처음으로 (Home)',
  timeSoundOn: '소리 끄기',
  timeSoundOff: '소리 켜기',

  // Earth HUD
  earthTitle: '지구',
  earthSubSolar: '해가 바로 위인 곳',
  earthTerminator: '낮과 밤 경계',
  earthRotationSpeed: '도는 속도',
  // The slider's value is simulated days per real second, and one Earth day is
  // exactly one turn — so it is also turns per second. Shown inverted, as the
  // seconds one turn takes: at the 0.05 default "1초에 0.05바퀴" means nothing to
  // a child, while "20초에 한 바퀴" is something they can count out loud.
  earthRotationSpeedValue: (daysPerSecond) => {
    const seconds = 1 / daysPerSecond;
    return `${seconds >= 1 ? Math.round(seconds) : seconds.toFixed(1)}초에 한 바퀴`;
  },
  earthHudToggleTitle: '지구 정보 열고 닫기',
  earthBack: '← 태양계로',
  earthAircraftOn: '비행기 보기: 켬',
  earthAircraftOff: '비행기 보기: 끔',
  earthEclipseSelectLabel: '일식과 월식 골라 보기',
  earthEclipseSelectPlaceholder: '일식과 월식 골라 보기…',
  earthFindNextEclipse: '다음 일식과 월식 찾기',
  earthEclipseOn: '가림 현상: 켬',
  earthEclipseOff: '가림 현상: 끔',
  earthAuroraOn: '오로라: 켬',
  earthAuroraOff: '오로라: 끔',
  earthIssOn: 'ISS 보기: 켬',
  earthIssOff: 'ISS 보기: 끔',
  // Meteor-shower entry notice (REQ-E3-104). koreanName is the single source
  // (meteorData.js SHOWER_TABLE.koreanName) — never hardcode a shower name here.
  earthMeteorNotice: (koreanName) => `${koreanName}가 쏟아져요!`,

  // Earth HUD flight status. LIVE-with-zero-aircraft is a healthy state and must
  // stay worded apart from the error states (SPEC-EARTH-002 REQ-480/490).
  earthFlightOff: '꺼짐',
  earthFlightLoading: '지구 위에서 비행기를 찾고 있어요',
  // Never says "실시간". The data is a snapshot published by a scheduled job, and
  // GitHub runs that job every 30-45 min in practice, so claiming live would be a
  // lie a child cannot check. Minutes once past a minute — "2070초 전" is unreadable.
  earthFlightLive: (count, agoSec) =>
    `지구 위 비행기 ${count}대 · ${
      agoSec < 60 ? `${Math.round(agoSec)}초` : `${Math.round(agoSec / 60)}분`
    } 전`,
  earthFlightLiveEmpty: '지금은 보이는 비행기가 없어요',
  earthFlightRateLimited: '잠시 쉬는 중이에요 · 마지막 정보를 보여줘요',
  earthFlightOffline: '지금은 비행기 정보를 볼 수 없어요',
  // The data source is credited with a link because its terms ask for it, so
  // this line ships with the aircraft feature — not optional polish.
  earthFlightCredit: '비행기 정보: OpenSky Network',

  // InfoPanel property labels (consumed by the kid-first panel rework)
  infoType: '종류',
  infoRadius: '반지름',
  infoDistance: '거리',
  infoMass: '무게',
  infoLuminosity: '밝기',
  infoSurfaceTemp: '겉면 온도',
  infoConstellation: '별자리',
  infoApparentMag: '보이는 밝기',
  infoAbsoluteMag: '실제 밝기',
  infoDiameter: '지름',
  infoRotationPeriod: '한 바퀴 도는 시간',
  infoAxialTilt: '기울기',
  infoDistanceFromParent: '중심 천체와의 거리',
  infoOrbitalPeriod: '공전 시간',
  infoEccentricity: '궤도 찌그러짐',
  infoOrbit: '도는 방향',
  infoClassification: '분류',
  infoDistanceFromSun: '태양과의 거리',
  infoDiscovered: '발견한 해',
  infoMoons: '위성 수',
  infoDetailsToggle: '자세히 보기',
  infoReplay: '다시 듣기',
  infoValueDwarfPlanet: '왜소행성',
  infoValueBelt: '작은 돌과 얼음 띠',
  infoValueRetrograde: '거꾸로 돌아요',
  infoValueNone: '몰라요',
  infoRetrogradeSuffix: ' (거꾸로)',

  // Korean unit words
  unitYear: '년',
  unitDay: '일',
  unitHour: '시간',

  // --- Play layer (SPEC-PLAY-001 M2/M5) ---

  // InfoPanel entry points
  playCompare: '크기 비교',
  playCompareLabel: (name) => `${name} 크기 비교하기`,
  playRocket: '로켓 발사',
  // Particle-free like the comparison forms below: `${name}으로` is only correct
  // for a consonant-final name that does not end in ㄹ, so a screen reader spoke
  // 달으로 / 세레스으로 / 하우메아으로 / 마케마케으로 / 에리스으로 out loud.
  playRocketLabel: (name) => `${name} 로켓 발사하기`,
  playClose: '닫기',

  // Size comparison. Both forms are deliberately particle-free: the count form
  // borrows the wording already authored for jupiter/saturn/uranus/neptune in
  // planetData, and the near-equal form ends every noun with "크기", so no 은/는
  // 이/가 와/과 selection logic is needed for a body name we cannot see.
  playCompareTitle: '크기 비교',
  // `countPhrase` arrives already carrying its object particle ("109개를" /
  // "2개 반을"), because 개 and 반 take different ones.
  playCompareCount: (small, countPhrase, big) => `${small} ${countPhrase} 나란히 놓으면 ${big} 폭이에요!`,
  playCompareSame: (big, small) => `${big} 크기는 ${small} 크기와 거의 같아요!`,

  // Sticker book + mission HUD
  playStickerBookOpen: '스티커 책 열기',
  playStickerBookTitle: '내 스티커',
  playMissionsTitle: '오늘의 놀이',
  playDayComplete: '내일 또 만나요!',
  playStickerLocked: (prompt) => `${prompt} 아직 못 받았어요.`,

  // Mission praise (REQ-PLAY-404)
  playPraise: '참 잘했어요! 스티커를 받았어요!',
};

// @MX:ANCHOR: [AUTO] Every Korean unit-suffixed value in the UI is formatted here.
// @MX:SPEC: [AUTO] SPEC-KIDS-001 REQ-KIDS-105
// @MX:REASON: [AUTO] Four InfoPanel call sites depend on the no-space join. Adding a
// space to match English spacing would be wrong in Korean and would silently reformat
// every duration in the panel at once.
/**
 * Attach a Korean unit word straight onto a value: 1.88 + 년 -> "1.88년".
 * Korean takes no space before the unit, unlike the English "1.88 years".
 * @param {string|number} value
 * @param {string} unit - One of the STR.unit* words.
 * @returns {string}
 */
export function formatKoUnit(value, unit) {
  return `${value}${unit}`;
}

/**
 * Korean date form: "2026년 3월 30일". Month and day are unpadded, which is how
 * Korean dates are written. Read in UTC to match the simulation clock.
 * @param {Date} date
 * @returns {string}
 */
export function formatKoDate(date) {
  return `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
}
