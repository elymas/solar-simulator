---
id: SPEC-EARTH-001
document: spec-compact
version: "0.1.1"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, earth-view, view-manager, state-machine, hash-routing, brownfield]
depends_on: [SPEC-SIM-001]
---

# SPEC-EARTH-001 (Compact): 지구 상세 뷰 플랫폼

priority: high · depends_on: SPEC-SIM-001 · modules: F4

## Requirements

### F4 — 지구 상세 뷰
- REQ-310 (U): 개요 씬과 구별되는 전용 지구 뷰, 명시적 지구 선택으로만 진입.
- REQ-315 (U): 단일 공유 렌더링 컨텍스트로 모든 뷰 렌더, 개요⇄지구 전환을 명시적 상태 전이로 통치, 뷰별 씬·카메라·update(설계 §4.1/plan.md).
- REQ-320 (E): WHEN 지구 선택 THEN 400ms 페이드 전환, 2초 이내(AC-002).
- REQ-325 (E): WHEN hash #/earth 변경(딥링크/뒤로가기) THEN 클릭과 동일 전환(#/→개요, #/earth→지구).
- REQ-340 (E): WHEN 종료(닫기/Escape/다른 천체) THEN 개요 카메라 복귀 + 오버레이 제거.
- REQ-355 (E): WHEN 종료 THEN F5 폴링 중단(플랫폼 무관), 모바일 지구 뷰 dispose(VRAM 회수).
- REQ-330 (S): WHILE EARTH 활성 풍부 정보 — 터미네이터(daymap/nightmap+태양상대회전), 구름, 달(27.32일±5%/경사5.14°±0.5°).
- REQ-350 (S): WHILE EARTH 활성 AND F5 사용가능 시 항공기 마커 오버레이(마운트 포인트만).
- REQ-360 (S): WHILE EARTH 활성 F6/F7 트리거 시 이 뷰 내 렌더(마운트 포인트만).
- REQ-370 (O): Where 보조 레이어 포함 시 야간면 도시 불빛 + 대기 rim-glow 렌더해야 함.
- REQ-380 (Un): 지오로케이션/추가 권한/데이터 요구 금지, 위치 무관 동일 동작.
- REQ-385 (Un): 지구 뷰 활성 중 두 번째 WebGL 컨텍스트 생성 금지(단일 공유 컨텍스트).

## Acceptance Criteria
- AC-EARTH-01: 명시적 진입, 단일 컨텍스트 공유, 활성 뷰만 렌더 (REQ-310/315/385).
- AC-EARTH-02: 400ms 전환 2초 이내, hash+뒤로가기 (REQ-320/325).
- AC-EARTH-03: 터미네이터+구름+상대 궤도 달+HUD, 선택 보조 레이어 (REQ-330/370).
- AC-EARTH-04: Escape/back 종료 복귀, 모바일 dispose+폴링 중단 (REQ-340/355).
- AC-EARTH-05: F5/F6/F7 마운트 포인트, View 인터페이스 동결 (REQ-350/360).
- AC-EARTH-06: 지오로케이션/권한 없음 (REQ-380).

## Files to Modify
- `[NEW]` src/core/ViewManager.js — 상태 기계, 라우팅, 전환, UI 마운트
- `[NEW]` src/views/SolarSystemView.js — 기존 앱을 View 인터페이스로 래핑
- `[NEW]` src/earth/EarthView.js — 자체 scene/camera/HUD/리그 호스트, F5/F6/F7 마운트
- `[NEW]` src/earth/EarthRig.js — 고상세 지구(day/night/normal/spec/구름/rim-glow)
- `[NEW]` src/earth/EarthHUD.js — 풍부 정보 + 뒤로가기 버튼
- `[MODIFY]` src/main.js — god-loop 제거 → ViewManager 부트스트랩, __solarSim shim
- `[MODIFY]` src/scene/SceneManager.js — 렌더러 뷰 간 공유
- `[MODIFY]` src/utils/constants.js — EarthView near/far/scale, 지구-로컬 CONTROLS
- `[MODIFY]` src/ui/PlanetList.js, InfoPanel.js, TimeControls.js — SolarSystemView 소유
- `[MODIFY]` src/controls/InteractionManager.js — 태양계 스코프
- `[NEW]` WebGL 컨텍스트 로스/복원 핸들러

## Exclusions (What NOT to Build)
- F5/F6/F7 구현 없음(마운트 포인트+HUD 훅만) → SPEC-EARTH-002.
- 두 번째 WebGL 컨텍스트 없음(렌더러 공유 필수, REQ-385).
- 지오로케이션/사용자 권한/개인 데이터 없음(REQ-380).
- 엔진 교체 없음, 태양계 상징 스케일 유지(EarthView만 로컬 스케일).
- 서버 사이드 라우팅 없음(hash만, GitHub Pages 정적).
- 왜소행성/위성/렌더링 품질 재작업 없음(SPEC-SIM-001 범위).
