---
id: SPEC-UI-001
version: "1.0.0"
status: draft
created: "2026-03-30"
updated: "2026-03-30"
author: limbowl
priority: high
issue_number: 0
lifecycle: spec-first
tags: [three.js, solar-system, 3d-simulation, github-pages]
---

# SPEC-UI-001: Solar System 3D Simulation Website

## 1. Environment (환경)

### 1.1 프로젝트 개요

GitHub Pages에 호스팅되는 3D 태양계 시뮬레이션 웹사이트. Three.js를 활용한 완전 정적(static) 사이트로, 백엔드 없이 클라이언트 사이드에서 모든 연산을 수행한다.

### 1.2 기술 스택

| 구성 요소 | 기술 | 버전/사양 |
|-----------|------|-----------|
| 3D 엔진 | Three.js | r175 (~160KB gzipped) |
| 빌드 도구 | Vite | latest stable |
| 배포 플랫폼 | GitHub Pages | GitHub Actions workflow |
| 텍스처 소스 | Solar System Scope | 2K JPEG (CC BY 4.0) |
| 스카이박스 | NASA Deep Star Maps | 2K |
| 라이선스 | MIT | - |

### 1.3 배포 제약

- GitHub Pages 사이트 최대 크기: 1GB
- 월간 대역폭: 100GB (소프트 리밋)
- 빌드 시간: 10분 제한
- 정적 파일만 서빙 가능 (서버 사이드 로직 불가)

### 1.4 브라우저 지원

- WebGL 지원 브라우저 (98%+ 커버리지)
- 최소 Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- 모바일 브라우저 지원 (iOS Safari, Chrome Android)

---

## 2. Assumptions (가정)

### 2.1 기술적 가정

- **A-001**: 사용자의 브라우저가 WebGL을 지원한다
- **A-002**: 2K 텍스처 로딩에 일반 인터넷 환경에서 10초 이내 소요 (총 ~15MB)
- **A-003**: Keplerian 궤도 요소를 사용한 오프라인 계산이 시뮬레이션 정확도에 충분하다 (JPL 데이터 기반)
- **A-004**: 별도의 실시간 천문 데이터 API 호출이 필요하지 않다
- **A-005**: Solar System Scope 텍스처의 CC BY 4.0 라이선스가 프로젝트 전체 기간 동안 유효하다

### 2.2 사용자 가정

- **A-006**: 사용자는 기본적인 웹 브라우저 조작(클릭, 스크롤, 드래그)이 가능하다
- **A-007**: 대부분의 사용자는 데스크탑 환경에서 접근하나, 모바일 접근도 지원해야 한다
- **A-008**: 사용자는 천문학 전문 지식이 없으며, 정보 패널은 교육적 목적으로 제공된다

### 2.3 스케일 가정

- **A-009**: 실제 비율로 렌더링하면 행성이 보이지 않으므로, 거리와 크기에 별도의 스케일을 적용한다
- **A-010**: 클릭 가능성을 위해 최소 4px 반지름을 보장한다

---

## 3. Requirements (요구사항)

### 3.1 필수 요구사항 (Ubiquitous)

- **REQ-001**: 시스템은 **항상** Three.js를 사용하여 태양, 8개 행성(수성, 금성, 지구, 화성, 목성, 토성, 천왕성, 해왕성), 그리고 달을 3D로 렌더링해야 한다
- **REQ-002**: 시스템은 **항상** 각 천체에 해당하는 2K 텍스처 맵을 적용해야 한다
- **REQ-003**: 시스템은 **항상** 다크 테마와 별밭(starfield) 배경을 표시해야 한다
- **REQ-004**: 시스템은 **항상** 반응형 디자인을 적용하여 다양한 화면 크기에 대응해야 한다

### 3.2 이벤트 기반 요구사항 (Event-Driven)

- **REQ-005**: **WHEN** 사용자가 행성을 클릭하면 **THEN** 시스템은 해당 행성의 물리적 데이터(지름, 거리, 공전 주기, 자전 주기, 축 기울기, 위성 수)를 포함한 정보 패널을 표시해야 한다
- **REQ-006**: **WHEN** 사용자가 행성 위에 마우스를 올리면 **THEN** 시스템은 해당 행성을 시각적으로 하이라이트해야 한다
- **REQ-007**: **WHEN** 사용자가 재생/일시정지 버튼을 클릭하면 **THEN** 시스템은 궤도 애니메이션을 전환해야 한다
- **REQ-008**: **WHEN** 페이지가 처음 로딩될 때 **THEN** 시스템은 텍스처 로딩 진행률을 보여주는 로딩 화면을 표시해야 한다
- **REQ-009**: **WHEN** 사용자가 키보드 단축키를 누르면 **THEN** 시스템은 해당 기능을 실행해야 한다 (Space=일시정지, R=리셋)

### 3.3 상태 기반 요구사항 (State-Driven)

- **REQ-010**: **IF** 시뮬레이션이 재생 상태이면 **THEN** 시스템은 JPL Keplerian 궤도 요소에 기반하여 행성 궤도를 애니메이션해야 한다
- **REQ-011**: **IF** 정보 패널이 열려 있으면 **THEN** 시스템은 선택된 행성까지 카메라를 부드럽게 이동해야 한다
- **REQ-012**: **IF** 시뮬레이션 속도가 변경되면 **THEN** 시스템은 궤도 애니메이션 속도를 즉시 반영해야 한다

### 3.4 선택적 요구사항 (Optional)

- **REQ-013**: **가능하면** 토성 고리를 투명도가 적용된 텍스처로 렌더링해야 한다
- **REQ-014**: **가능하면** 궤도 경로 라인을 반투명하게 표시해야 한다
- **REQ-015**: **가능하면** 태양에 Bloom/Glow 포스트프로세싱 효과를 적용해야 한다
- **REQ-016**: **가능하면** 행성 라벨을 표시해야 한다
- **REQ-017**: **가능하면** 날짜/시간 표시 기능을 제공해야 한다

### 3.5 복합 요구사항 (Complex)

- **REQ-018**: **IF** 사용자가 모바일 기기에서 접속 중이고 **AND WHEN** 성능 저하가 감지되면 **THEN** 시스템은 포스트프로세싱 효과를 비활성화하고 텍스처 해상도를 낮추어 핵심 기능을 유지해야 한다
- **REQ-019**: **IF** 속도 슬라이더가 활성화된 상태에서 **AND WHEN** 사용자가 속도를 조절하면 **THEN** 시스템은 0.1x에서 500x 범위 내에서 시뮬레이션 속도를 조절해야 한다

### 3.6 금지 요구사항 (Unwanted)

- **REQ-020**: 시스템은 외부 API에 런타임 의존성을 가지지 **않아야 한다** (완전 오프라인 계산)
- **REQ-021**: 시스템은 사용자 데이터를 수집하거나 추적하지 **않아야 한다**
- **REQ-022**: 시스템은 초기 로딩 완료 전에 불완전한 3D 씬을 표시하지 **않아야 한다**

---

## 4. Specifications (상세 사양)

### 4.1 3D 렌더링 사양

| 항목 | 사양 |
|------|------|
| 렌더러 | Three.js WebGLRenderer (antialias: true) |
| 카메라 | PerspectiveCamera + OrbitControls (줌, 회전, 팬) |
| 조명 | PointLight (태양 위치), AmbientLight (미세 조명) |
| 지오메트리 | SphereGeometry (세그먼트 수: 행성 크기에 비례) |
| 텍스처 | 2K JPEG/PNG (Solar System Scope CC BY 4.0) |
| 포스트프로세싱 | EffectComposer + UnrealBloomPass (태양), OutlinePass (호버) |

### 4.2 천체 데이터 사양

| 천체 | 표시 반지름 (units) | 표시 거리 (units) | 텍스처 |
|------|---------------------|-------------------|--------|
| Sun | 50 (캡 적용) | 0 | 2k_sun.jpg |
| Mercury | 4 (최소) | 80 | 2k_mercury.jpg |
| Venus | 7 | 150 | 2k_venus_surface.jpg |
| Earth | 8 | 200 | 2k_earth_daymap.jpg |
| Moon | 3 | Earth로부터 15 | 2k_moon.jpg |
| Mars | 5 | 300 | 2k_mars.jpg |
| Jupiter | 28 | 450 | 2k_jupiter.jpg |
| Saturn | 24 | 600 | 2k_saturn.jpg |
| Uranus | 14 | 730 | 2k_uranus.jpg |
| Neptune | 13 | 850 | 2k_neptune.jpg |

### 4.3 UI 사양

| 요소 | 사양 |
|------|------|
| 레이아웃 | 전체 화면 3D 캔버스 + 슬라이드인 사이드바(우측) + 하단 컨트롤 바 |
| 배경색 | #0a0a0f (깊은 우주 블랙) |
| UI 표면 | #1a1a2e |
| 강조색 | #16c7ff (시안) 또는 #4a9eff (블루) |
| 텍스트 | Primary: #e0e0e0, Secondary: #888888 |
| 폰트 | UI: Inter/Space Grotesk, 데이터: JetBrains Mono |
| 시간 제어 | 재생/일시정지 버튼, 속도 슬라이더 (0.1x - 500x), 날짜 표시 |

### 4.4 성능 사양

| 항목 | 목표 |
|------|------|
| 초기 로딩 | 표준 연결(10Mbps)에서 10초 이내 |
| 프레임 레이트 | 데스크탑 60fps, 모바일 30fps |
| 텍스처 총 크기 | ~15MB (2K 텍스처) |
| 번들 크기 | Three.js ~160KB gzipped + 앱 코드 |

### 4.5 Traceability (추적성)

| 요구사항 | 관련 Phase | 구현 우선순위 |
|----------|-----------|-------------|
| REQ-001 ~ REQ-004 | Phase 2: Solar System Core | Primary Goal |
| REQ-005 ~ REQ-009 | Phase 3: UI & Interaction | Primary Goal |
| REQ-010 ~ REQ-012 | Phase 2-3 | Primary Goal |
| REQ-013 ~ REQ-017 | Phase 2-4 | Secondary Goal |
| REQ-018 ~ REQ-019 | Phase 4: Polish | Secondary Goal |
| REQ-020 ~ REQ-022 | 전체 Phase | Primary Goal (제약사항) |
