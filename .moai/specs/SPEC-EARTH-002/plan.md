---
id: SPEC-EARTH-002
document: plan
version: "0.1.0"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, earth-view, flight-data, adsb, eclipse, aurora, brownfield]
depends_on: [SPEC-EARTH-001, SPEC-SIM-001]
---

# SPEC-EARTH-002: Implementation Plan — 지구 시뮬레이션 (항공기·일식/월식·오로라)

## Overview

Architect 밀스톤 M4에 대응. SPEC-EARTH-001의 EarthView 위에 세 가산 레이어를 얹는다. 각 레이어는 밀스톤 내에서 독립 데모/출하 가능하며, F5는 CORS 스모크 테스트 실패 시 다른 둘을 블록하지 않고 드롭된다.

DELTA 범례: `[EXISTING]` 무변경 참조, `[MODIFY]` 수정, `[NEW]` 신규.

---

## Milestone M4 — 지구 시뮬레이션 (F5 + F6 + F7)

### Task M4.1 — CORS 스모크 테스트 (F5 게이트, 최우선)
- **선행 게이트**: 배포 origin(`elymas.github.io`)에서 adsb.lol / adsb.fi에 대한 라이브 브라우저 `fetch()` 스모크 테스트. 통과 시 F5 진행, 실패 시 F5 드롭(REQ-450) — F6/F7는 무영향 진행.
- Reference: research.md §2 (제공자 비교), Analyst Sources (adsb.lol/adsb.fi/OpenSky).

### Task M4.2 — 항공기 데이터 서비스 (F5)
- `[NEW]` `src/data/FlightDataService.js` — 폴링(10–15초, EARTH 활성 + 탭 보임), 지수 백오프, HUD 상태 기계(OFF/LOADING/LIVE/RATE_LIMITED/OFFLINE), 좌표 검증/클램프, dead-reckoning 보간. Reference: `document.visibilitychange`, SPEC-EARTH-001 REQ-355(종료 시 폴링 중단 훅).
- `[MODIFY]` `src/earth/EarthView.js` — 항공기 `InstancedMesh` 마운트(heading 정렬, 고도 오프셋). Reference: SPEC-EARTH-001 EarthView 마운트 포인트(REQ-350).
- `[MODIFY]` `src/earth/EarthHUD.js` — 항공기 상태/선택(callsign/altitude/velocity), `aria-live="polite"` unavailable 표시자. Reference: SPEC-EARTH-001 EarthHUD 훅.

### Task M4.3 — 하이브리드 일식/월식 리그 (F6)
- `[NEW]` `src/effects/EclipseRig.js` — EarthView 로컬 상대-스케일 Sun–Earth–Moon 리그, DirectionalLight + PCFSoftShadowMap, 일식(달 castShadow/지구 receiveShadow), 월식(지구 castShadow/달 receiveShadow, 붉은 umbra), 선택 방사 그라디언트 데칼. Reference: `src/planets/OrbitalMechanics.js:19` (calculatePosition — 정렬 검출 입력), `src/scene/SceneManager.js` (셰도우맵 enable, SPEC-EARTH-001에서 활성화).
- `[NEW]` 일식 프리셋 데이터 + 정렬 검출 + "다음 일식 찾기" — 실제 일식 날짜 목록, 시간 스텝 독립 고정 서브스텝 샘플링. Reference: `src/planets/OrbitalMechanics.js` (동일 Keplerian 데이터 재사용, 별도 ephemeris 없음).
- `[MODIFY]` `src/earth/EarthHUD.js` — 일식 프리셋 피커 + "find next eclipse" 컨트롤.
- `[MODIFY]` `src/scene/SceneManager.js` — 셰도우맵 활성(SPEC-EARTH-001과 조율). Reference: `src/scene/SceneManager.js:68/71` (조명).

### Task M4.4 — 오로라 효과 (F7)
- `[NEW]` `src/effects/AuroraEffect.js` — 노이즈 커튼 지오메트리 + ShaderMaterial(vertex FBM 변위, fragment 그라디언트, AdditiveBlending/depthWrite:false/DoubleSide), 자기극 링, 축 기울기 정렬, 야간면 페이드(`dot(normal, sunDir)`). Reference: `src/planets/planetData.js:54` (지구 axialTilt 23.44°), SPEC-SIM-001 relight(야간면 발광 선행).
- `[MODIFY]` `src/earth/EarthHUD.js` — 오로라 토글.
- `[MODIFY]` `src/earth/EarthView.js` — 오로라 마운트, 모바일 티어 폴백(커튼 감소 → 정적 텍스처 → off). Reference: `src/scene/SceneManager.js:114-123` (isMobile/isLowEnd 게이트 재사용).

---

## Technology Specs

| 항목 | 사양 |
|------|------|
| 항공기 API | adsb.lol / adsb.fi (키리스, 1 req/s, 비상업, adsb.fi 귀속). OpenSky 반려(OAuth2). CORS 미확인 → 스모크 테스트 전제 |
| 항공기 렌더 | 단일 InstancedMesh, heading 정렬, dead-reckoning 보간 |
| 항공기 상태 | OFF / LOADING / LIVE / RATE_LIMITED / OFFLINE, 지수 백오프 30초 시작 |
| 일식 | 하이브리드: 프리셋 원클릭 점프 + Keplerian 검출 + "다음 일식 찾기", 시간 스텝 독립 샘플링 |
| 일식 렌더 | 로컬 리그, DirectionalLight + PCFSoftShadowMap, 월식 붉은 umbra, 선택 그라디언트 데칼 |
| 오로라 | 노이즈 커튼 ShaderMaterial, AdditiveBlending, 야간면 한정, ≤1.5ms/frame |
| 오로라 폴백 | 커튼 감소 → 정적 텍스처 → off (모바일 필수) |

---

## Risk Analysis

| 리스크 | 가능성 | 영향 | 완화 |
|--------|--------|------|------|
| F5 CORS 브라우저 차단(미확인) | 높음 | 중간 | 배포 origin 라이브 스모크 테스트 전제. 실패 시 F5 드롭, F6/F7 무영향(REQ-450) |
| F5 ToS 모호(커뮤니티 API 정책 변경) | 중간 | 중간 | 구현 시 재확인, 귀속 표시(adsb.fi), 비상업 조건 준수 |
| F5 레이트 한도 소진 중 세션 | 중간 | 낮음 | 지수 백오프 + dead-reckoning 유지, RATE_LIMITED 상태(REQ-470) |
| F5 불량 페이로드 렌더 루프 throw | 중간 | 높음 | 인스턴스 행렬 생성 전 좌표 검증/클램프(트러스트 경계) |
| F6 고 시간가속 일식 미스킵(500x) | 높음 | 중간 | 렌더 프레임률 독립 고정 서브스텝 샘플링, "다음 일식 찾기"는 작은 증분 스텝(REQ-530) |
| F6 스케일 부정직(비 스케일에 물리 함의) | 중간 | 낮음 | UI에 "예시적, 비 스케일" 표기. 로컬 상대 리그 명시 |
| F7 프래그먼트 셰이더가 모바일 GPU 침몰 | 높음 | 중간 | 커튼 지오메트리(레이마칭 금지), 모바일 폴백 하드 요구(REQ-650) |
| F5/F6/F7 프레임 예산 경합 | 중간 | 중간 | REQ-240 우선순위 저하(오로라 먼저), 오로라 ≤1.5ms 예산 |

---

## mx_plan (@MX 주석 대상)

| 태그 | 대상 | 사유 |
|------|------|------|
| `@MX:WARN` | `FlightDataService` 입력 검증(좌표 클램프) | 외부 신뢰불가 입력 트러스트 경계 — 불량 페이로드가 인스턴스 행렬/렌더 루프에서 throw 금지. @MX:REASON 동반. |
| `@MX:WARN` | 렌더 루프 에러 핸들링(FlightDataService 폴 콜백, EclipseRig update) | 폴/셰도우 예외가 EarthView 루프를 죽이지 않도록 격리. @MX:REASON 동반. |
| `@MX:ANCHOR` | 일식 정렬 검출 샘플러(시간 스텝 독립) | 500x에서 이벤트 미스킵 불변 계약. F6 정확도 핵심. |
| `@MX:ANCHOR` | `OrbitalMechanics.calculatePosition` 소비(정렬 검출 입력) | SPEC-SIM-001에서 앵커된 함수를 F6가 소비 — 계약 의존 명시. |
| `@MX:NOTE` | 일식 프리셋 데이터 provenance | 실제 역사적/예정 일식 날짜 출처(NASA/천문 카탈로그) 명시 — 조작 아님 근거(REQ-550). |
| `@MX:NOTE` | 항공기 API 제공자·CORS·귀속 상수(FlightDataService) | adsb.lol/adsb.fi 선택 근거, OpenSky 반려 사유, 귀속 요구 provenance. |
| `@MX:NOTE` | 오로라 자기극/축 기울기 상수 | 장식용·비 데이터 근거임을 명시(REQ-620). |

---

## Dependencies

- **직접 선행**: SPEC-EARTH-001 (EarthView 마운트 포인트, HUD 훅, 라이프사이클, 셰도우맵 인프라).
- **전이 선행**: SPEC-SIM-001 (relight — F6 그림자/F7 야간면 발광 물리적 성립).
- **후행**: 없음(3-SPEC 체인 말단).
- **F5 내부 게이트**: CORS 스모크 테스트 통과가 F5 진행 전제. 실패 시 F5만 드롭.

---

## Expert Consultation

| 도메인 | 에이전트 | 사유 |
|--------|---------|------|
| Frontend 3D | expert-frontend | 셰도우맵 일식 리그, 오로라 셰이더, InstancedMesh |
| Backend / Data | expert-backend | 폴링·백오프·상태 기계, CORS 스모크 테스트 설계 |
| Security | expert-security | 외부 좌표 트러스트 경계, 키리스 준수 |
