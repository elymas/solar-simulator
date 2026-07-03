---
id: SPEC-EARTH-001
document: research
version: "0.1.0"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, earth-view, view-manager, state-machine, hash-routing, brownfield]
depends_on: [SPEC-SIM-001]
---

# SPEC-EARTH-001: Research — 지구 상세 뷰 플랫폼

Architect 설계(§2 뷰 전환 아키텍처, §7 파일 영향)와 Analyst 요구사항(REQ-310~380), 코드 조사에서 F4 범위로 정제.

## 1. 왜 ViewManager 상태 기계인가 (아키텍처 판정)

Architect 3개 대안 평가:
- **반려 — "단일 씬 / 카메라 존"**: 태양계 개요에서 8-unit 폭 지구의 대기/오로라/항공기 상세로 dolly 불가. 스케일이 화해 불가능(Fact C).
- **반려 — "두 SceneManager 인스턴스"**: 각 `SceneManager`가 자체 `WebGLRenderer`를 생성하고 canvas를 append(`SceneManager.js:30-38`). 두 WebGL 컨텍스트는 낭비이며 컨텍스트 로스 리스크.
- **채택 — 렌더러 공유 + 뷰별 scene/camera/update**: 하나의 렌더러+composer, `ViewManager`가 활성 뷰·라우팅·전환·UI 마운트 소유. `main.js:145` god-loop 대체.

## 2. 브라운필드에서 F4가 깨는 하드코딩 가정

| 위치 | 가정 | 깨짐 |
|------|------|------|
| `main.js:14,34,145` | SceneManager/factory/loop 각 1개 | 루프가 뷰-디스패치로 |
| `main.js:22-31` | `window.__solarSim` 전역이 모든 상태 | 뷰 스코프로 이동(전이기 shim) |
| `main.js:57-81` | `selectPlanet`이 카메라 초점만 | 지구 선택은 뷰 전환 |
| `SceneManager.js:44-50` | 단일 카메라 far:100000 | EarthView 자체 near/far |
| `constants.js:17-22` | 단일 min/max 거리 | EarthView 지구-로컬 한계 |
| `InteractionManager`(`main.js:92`) | 태양계 factory 위 1회 구성 | EarthView 자체 피킹 또는 없음 |
| starfield r=10000 | 공유 씬 상주 | EarthView 자체/공유 하늘 |
| `SCALE`(`constants.js:24-28`) | placeholder identity, 미사용 | EarthView 실 로컬 스케일 도입 |

## 3. 전환·라우팅·라이프사이클

- **전환**: 전화면 DOM 오버레이 크로스페이드(~400ms 블랙). 추가 렌더 타깃 0, 모바일 동일. `SceneManager.start()`(`:198-226`) ease-out-cubic 재사용. 선택 업그레이드: dolly 후 불투명 프레임 핸드오프.
- **라우팅**: `#/`→SOLAR, `#/earth`→EARTH. `hashchange` 리슨으로 딥링크·브라우저 뒤로가기 지원. Vite `base:'/solar-simulator/'`는 hash 라우팅에 영향 없음(서버 rewrite 불필요 — GitHub Pages 이상적).
- **자산 라이프사이클**: 태양계 씬 상주(7MB, 저렴), EARTH에서 update 일시정지. EarthView 첫 onEnter 지연 빌드. 종료 시 데스크탑 유지 / 모바일 dispose(`SceneManager.js:115` navigator 체크 재사용). F5 폴링 플랫폼 무관 중단.

## 4. 위험 (Analyst 발췌)

- **High — WebGL 컨텍스트 로스 처리 부재**(grep 확인, `src/` 전역). 무거운 결합 씬(더 많은 텍스처/재질/셰이더)은 로스 확률↑. F4 일부로 복원 재로드 설계 필수, 프로덕션에서 발견 금지.
- **확인 필요 — 카메라 초점 실체**: commit `fc5855f`가 카메라 dolly일 뿐 별도 씬/뷰가 아닐 수 있음. 그렇다면 "훨씬 풍부한 정보의 전용 뷰"는 초점 인프라 재사용이 시사하는 것보다 큰 작업. 가정 말고 확인.
- **Medium — 첫 접근성 요구**: WCAG 2.1 AA(프로젝트 최초). 여기서 미확보 시 모든 후속 UI 작업의 갭으로 남음.

## 5. 지구 리그 자산 (기존 활용)

- `2k_earth_daymap.jpg`, `2k_earth_nightmap.jpg`(`constants.js:35`, **현재 미사용**), `2k_earth_clouds.jpg` 이미 `public/textures/`에 존재. F4에서 day↔night 터미네이터 블렌드 + 구름에 활용.
- 4K/8K day/night/normal/specular는 지구 뷰 진입 시에만 SPEC-SIM-001 텍스처 티어 로더로 지연 로드. 초기 로드 미계상.

## 6. 접근성 (NFR)

- WCAG 2.1 AA. Enter/Space 진입, Escape 종료(기존 패턴). `prefers-reduced-motion` 시 전환 이징·장식 애니메이션 비활성. 색 대비는 기존 토큰(#e0e0e0/#888888 on #1a1a2e — 본문 AA 충족) 재사용.
