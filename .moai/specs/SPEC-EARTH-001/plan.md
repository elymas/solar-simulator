---
id: SPEC-EARTH-001
document: plan
version: "0.1.0"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, earth-view, view-manager, state-machine, hash-routing, brownfield]
depends_on: [SPEC-SIM-001]
---

# SPEC-EARTH-001: Implementation Plan — 지구 상세 뷰 플랫폼

## Overview

Architect 밀스톤 M3에 대응. 앱의 코어 루프를 단일 god-loop에서 `ViewManager` 뷰-디스패치 상태 기계로 리팩터링하고, EarthView + 지구 리그 + EarthHUD + hash 라우팅을 구축한다. F5/F6/F7 없이도 "지구 클릭 → 전용 뷰"로 독립 출하 가능한 하나의 불가분 리팩터.

DELTA 범례: `[EXISTING]` 무변경 참조, `[MODIFY]` 수정, `[NEW]` 신규.

---

## Milestone M3 — 지구 뷰 플랫폼 (F4)

### Task M3.1 — ViewManager 상태 기계 (척추)
- `[NEW]` `src/core/ViewManager.js` — 상태 기계(SOLAR/TO_EARTH/EARTH/TO_SOLAR), 공유 렌더러+composer 소유, hash 라우팅, 전환 오케스트레이션, UI 마운트. god-loop 대체. Reference: `src/main.js:145-170` (기존 RAF 루프 — 대체 대상), `src/scene/SceneManager.js:198-226` (start() ease-out-cubic 트윈 — 전환 재사용).
- `[MODIFY]` `src/main.js` — god-loop 제거 → ViewManager 부트스트랩. `window.__solarSim`은 전이기 thin shim으로 유지 후 제거. Reference: `src/main.js:14,22-31,34,145` (SceneManager/전역/factory/루프).

### Task M3.2 — SolarSystemView 래퍼
- `[NEW]` `src/views/SolarSystemView.js` — 기존 배선(PlanetFactory, InteractionManager, InfoPanel, PlanetList, TimeControls, 초점/해제)을 View 인터페이스(`mount/unmount/onEnter/onExit/update/getScenePass`) 뒤로 이동. Reference: `src/main.js:57-142` (selectPlanet/deselectPlanet 초점 로직).
- `[MODIFY]` `src/ui/PlanetList.js`, `src/ui/InfoPanel.js`, `src/ui/TimeControls.js`, `src/controls/InteractionManager.js` — SolarSystemView 소유로 스코프 조정, EARTH 상태에서 숨김/분리.

### Task M3.3 — EarthView 스캐폴드 + 카메라 프레임
- `[NEW]` `src/earth/EarthView.js` — 자체 Scene, 지구-로컬 near/far PerspectiveCamera, 자체 하늘, F5/F6/F7 마운트 포인트. Reference: `src/scene/SceneManager.js:44-50` (기존 카메라 far:100000 — EarthView는 별도 프레임).
- `[MODIFY]` `src/utils/constants.js` — EarthView near/far/scale 상수, 지구-로컬 CONTROLS 한계. Reference: `src/utils/constants.js:13` (far:100000), `:17-22` (CONTROLS_DEFAULTS), `:24` (SCALE placeholder).
- `[MODIFY]` `src/scene/SceneManager.js` — 렌더러를 뷰 간 공유하도록 노출(2컨텍스트 금지). Reference: `src/scene/SceneManager.js:30-38` (renderer/canvas 생성).

### Task M3.4 — 지구 리그 (EarthRig)
- `[NEW]` `src/earth/EarthRig.js` — 고상세 지구: day↔night 터미네이터 블렌드, normal/bump, specular, 구름(부드러운 그림자), 대기 rim-glow(선택). 미사용 nightmap 활용. Reference: `src/utils/constants.js:35` (earthNight 텍스처, 현재 미사용), SPEC-SIM-001 텍스처 티어 로더(재사용).

### Task M3.5 — EarthHUD + 종료 처리
- `[NEW]` `src/earth/EarthHUD.js` — 풍부한 정보(sub-solar/터미네이터/선택 항공기/일식 컨트롤/오로라 토글) + "← Solar System" 뒤로가기 버튼. Escape/뒤로가기/다른 천체 선택 종료.
- `[MODIFY]` `src/main.js` (또는 ViewManager) — Escape/back/hashchange 종료 핸들링, 카메라 개요 복귀.

### Task M3.6 — 자산 라이프사이클 + WebGL 컨텍스트 로스
- `[MODIFY]` `src/earth/EarthView.js` — 첫 onEnter 지연 빌드, 모바일 종료 dispose(지오/재질/텍스처/렌더타깃), F5 폴링 중단 훅. Reference: `src/scene/SceneManager.js:114-123` (기존 모바일 저하 게이트).
- `[NEW]` WebGL 컨텍스트 로스 핸들러 — `webglcontextlost`/`webglcontextrestored`, 복원 시 재로드. (현재 부재, grep 확인.)

---

## Technology Specs

| 항목 | 사양 |
|------|------|
| 뷰 아키텍처 | 1 렌더러 + 1 EffectComposer 공유, 뷰별 Scene/Camera/update |
| 상태 기계 | SOLAR / TO_EARTH / EARTH / TO_SOLAR |
| 라우팅 | hash (`#/`, `#/earth`), 서버 rewrite 불필요, 뒤로가기 지원 |
| 전환 | 전화면 DOM 오버레이 크로스페이드 400ms, 불투명 중점 스왑, 추가 렌더타깃 0 |
| EarthView 카메라 | 지구-로컬 near/far(태양 0.1–100000 아님) |
| 지구 리그 | day/night 블렌드, normal/specular, 구름, rim-glow(선택) |
| 라이프사이클 | 데스크탑 유지, 모바일 dispose, F5 폴링 플랫폼 무관 중단 |
| 컨텍스트 로스 | webglcontextlost/restored 핸들러(신규) |

---

## Risk Analysis

| 리스크 | 가능성 | 영향 | 완화 |
|--------|--------|------|------|
| god-loop 리팩터가 기존 동작 회귀 | 중간 | 높음 | `window.__solarSim` thin shim 유지(전이기), View 인터페이스 계약 우선 동결, 개요 뷰 특성화 테스트 |
| 카메라 초점(fc5855f)이 dolly일 뿐 별도 뷰 아님 | 확정 가능성 | 중간 | Run 추정 전 확인 — "전용 뷰"는 초점 재사용보다 큰 작업(Analyst) |
| WebGL 컨텍스트 로스(핸들러 부재) | 중간 | 높음 | F4 일부로 설계, 복원 재로드 동작, 모바일 dispose로 압박 완화 |
| 두 컨텍스트 실수 생성 → 컨텍스트 로스 | 중간 | 높음 | 렌더러 공유 강제(REQ-385), SceneManager 이중 생성 금지 |
| 전환 프레임 스톨(모바일) | 중간 | 중간 | DOM 오버레이 크로스페이드(추가 렌더타깃 0), 불투명 중점 스왑 |
| 전역→스코프 이동 중 이중 진실원 | 중간 | 중간 | shim은 전이기만, 이후 제거 |

---

## mx_plan (@MX 주석 대상)

| 태그 | 대상 | 사유 |
|------|------|------|
| `@MX:ANCHOR` | `ViewManager` 상태 전이 함수(TO_EARTH/TO_SOLAR 트랜지션) | 앱의 모든 렌더/입력이 여기를 경유하는 불변 계약. 상태 기계 무결성. |
| `@MX:ANCHOR` | EarthView `getScenePass()` / View 인터페이스 | composer RenderPass가 의존하는 계약. SPEC-EARTH-002 3종이 여기에 의존. |
| `@MX:WARN` | 렌더 루프 에러 핸들링(ViewManager update 디스패치) | 활성 뷰 update 예외가 전체 루프를 죽이지 않도록 격리 필요. @MX:REASON 동반. |
| `@MX:WARN` | WebGL 컨텍스트 로스/복원 핸들러 | 복원 실패 시 검은 화면 위험. @MX:REASON 동반. |
| `@MX:NOTE` | EarthView near/far/scale 상수(`constants.js`) | 지구-로컬 스케일이 태양계 상징 스케일과 다름을 명시. |
| `@MX:NOTE` | 모바일 dispose 라이프사이클(EarthView onExit) | 데스크탑 유지 vs 모바일 dispose 정책 의도 전달. |

---

## Dependencies

- **선행**: SPEC-SIM-001 (조명 반응 재질 + 텍스처 티어). 지구 리그 셰이딩과 4K 지연 로드가 이에 의존.
- **후행**: SPEC-EARTH-002(F5/F6/F7)가 본 SPEC의 EarthView 마운트 포인트·HUD 훅·라이프사이클 계약에 의존.

---

## Expert Consultation

| 도메인 | 에이전트 | 사유 |
|--------|---------|------|
| Frontend 3D | expert-frontend | ViewManager, 렌더러 공유, 지구 셰이딩, hash 라우팅, 컨텍스트 로스 |
| Performance | expert-performance | 모바일 dispose, VRAM, 전환 프레임 예산 |
