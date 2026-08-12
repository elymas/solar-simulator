# Solar System 3D Simulator

## Product Vision

Interactive 3D solar system simulation for educational exploration of planetary orbits, sizes, and astronomical data.

## Target Users

- Astronomy enthusiasts exploring the solar system
- Students learning about planetary motion and orbital mechanics
- Educators using it for classroom demonstrations
- General public curious about space and the scale of the solar system

## Core Features

- 3D visualization of the Sun, 8 planets, and the Moon
- Keplerian orbital animation with Newton-Raphson eccentric anomaly solver
- Adjustable time controls (0.1x to ~500x speed)
- Planet information panel with real astronomical data
- Saturn's ring system with alpha-transparent texture
- Earth cloud layer with independent rotation
- Bloom post-processing for the Sun
- Milky Way starfield background
- Responsive design for desktop and mobile

## Deployment

- Static site hosted on GitHub Pages
- Auto-deploys via GitHub Actions on push to `main`
- Production URL: https://elymas.github.io/solar-simulator/
- Repository: https://github.com/elymas/solar-simulator

## Constraints

- No backend, no API calls at runtime — fully client-side
- No user data collection or tracking
- Must load within 10 seconds on a 10 Mbps connection (~15 MB textures)
- Targets 60 fps on desktop, 30 fps on mobile
- WebGL required (98%+ browser coverage)

## 확장 기능 (SPEC-SIM-001 / SPEC-EARTH-001 / SPEC-EARTH-002, 2026-07-05)

기존 태양 + 8행성 + 달 구성 위에 3개의 브라운필드 확장 SPEC으로 다음 기능이 추가되었다.

- **IAU 왜소행성 5종**: Ceres, Pluto, Eris, Makemake, Haumea를 구별되는 3D 천체로 렌더링하며, 클릭 시 기존 정보 패널에 "Dwarf Planet" 분류가 표기된다.
- **목성/토성 위성 세트 완성**: 갈릴레이 위성 4종(Io/Europa/Ganymede/Callisto)과 토성의 유체정역학 평형 위성 7종(Titan/Enceladus/Rhea/Mimas/Tethys/Dione/Iapetus).
- **지구 전용 상세 뷰**: 지구를 클릭하면(또는 `#/earth`로 직접 딥링크하면) 전용 시뮬레이션 뷰로 전환된다. 실시간 주야 경계(day/night terminator), 구름 레이어, 달의 상대 궤도를 표시한다.
- **실시간 항공기 오버레이**: 지구 뷰에서 옵트인 시 실제 항공기 위치를 표시한다(가용한 경우에만 — API 접근 불가 시 다른 기능에 영향 없이 우아하게 비활성화됨).
- **일식/월식 시뮬레이션**: 실제 역사적/예정 일식 날짜 프리셋으로 원클릭 시간 점프하거나, 재생 중 실제 일식 순간에만 대응하는 검출로 이벤트를 표시한다(조작된 이벤트 없음).
- **장식용 오로라 효과**: 지구 극지방 야간면에 오로라 커튼을 렌더링한다(실시간 우주기상 데이터에 의존하지 않음).
- **렌더링 품질 개선**: 사장되어 있던 안티에일리어싱 복구(멀티샘플), 행성/위성의 무광 재질을 조명 반응 재질로 전환(주야 명암 대비 발생), ACES 필름 톤 매핑 적용.

## 어린이용 한국어 경험 (SPEC-KIDS-001, 2026-08-12)

주 사용자가 **영어를 읽지 못하고 한글도 아직 더듬거리는 5세 한국 아동**으로 확장되었다. 이 아이에게 정보가 도달하는 경로는 소리와 그림이다. 그에 맞춰 세 가지 제품 역량이 추가되었다.

- **한국어 우선 표현**: 모든 사용자 노출 표면에서 한국어가 1차 라벨이고 영어가 보조다 — 행성 목록, 정보 패널 헤더, 호버 툴팁, 로딩 화면, 시간 컨트롤, 지구 뷰 HUD, 일식 설명. 단위와 날짜도 한국어 형태를 쓴다("1.88년", "2026년 3월 30일"). 모바일에서 한국어 이름을 숨기던 규칙은 삭제되었다.
- **한국어 음성 내레이션**: 천체를 선택하면 한국어 이름과 짧은 사실 한 줄을 소리로 읽어준다. 다시 들을 수 있는 🔊 버튼과, 재생 여부를 기억하는 "소리" 토글이 있다. 음성 엔진이 없는 브라우저에서는 관련 버튼이 사라지고 나머지는 그대로 동작한다 — 소리는 부가 기능이지 전제 조건이 아니다.
- **아이 눈높이 사실 데이터**: 29개 천체(태양·8행성·5왜소행성·주요 위성 11개·항성 4개)마다 5세가 이해하는 한국어 사실 3줄, 아이가 그려볼 수 있는 크기 비교 한 문장, 이모지 하나. 정보 패널은 이 아이용 화면을 **먼저** 보여주고, 기존 과학 데이터 표는 "자세히 보기" 뒤로 접어둔다.

이는 다국어 지원 기능이 **아니다.** 언어 전환 스위치는 없으며, 한국어 우선은 설정이 아니라 고정된 제품 정책이다.

**미해결**: 실기기 음성 품질, iOS 첫 탭 발화, 한국어 모어 화자의 사실 문장 낭독 검수는 아직 확인되지 않았다(`.moai/specs/SPEC-KIDS-001/spec.md` §10.3).

## License

MIT License. Texture assets licensed under CC BY 4.0 by Solar System Scope.
