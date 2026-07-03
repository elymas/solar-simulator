---
id: SPEC-EARTH-002
document: spec-compact
version: "0.1.1"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, earth-view, flight-data, adsb, eclipse, aurora, brownfield]
depends_on: [SPEC-EARTH-001, SPEC-SIM-001]
---

# SPEC-EARTH-002 (Compact): 지구 시뮬레이션 — 항공기·일식/월식·오로라

priority: medium · depends_on: SPEC-EARTH-001 (+SPEC-SIM-001 전이) · modules: F5, F6, F7

## Requirements

### F5 — 실시간 항공기 (Optional/Degradable)
- REQ-480 (U): 항상 명시적 HUD 상태 OFF/LOADING/LIVE/RATE_LIMITED/OFFLINE 표시.
- REQ-490 (U): 항상 "빈 하늘"(0대) 정상 상태를 API 오류/불가 상태와 시각 구별.
- REQ-410 (O): Where 무료·키리스·CORS·클라이언트 호출 가능 API 존재 시 항공기 마커 오버레이해야 함(제공자·반려 근거 A-403/§4.1).
- REQ-420 (E): WHEN EARTH 활성 AND 기능 활성 AND 탭 보임 THEN 10-15초 폴링(가시성 감지 §4.1).
- REQ-430 (Un-IF): IF 요청 실패(네트워크/CORS/4xx/5xx/레이트) THEN 레이어 비활성 + 비차단 표시자 + 다른 기능 무영향.
- REQ-440 (Un-IF): IF 오프라인 THEN 요청 안 함 + 즉시 표시자 + 재시도 루프 없음.
- REQ-450 (Un-IF): IF CORS 호환 API 미확인 THEN F5 전체 생략, F1-F4/F6/F7 무블록.
- REQ-460 (Un): 사설/유료 키 임베드 금지, 키리스만.
- REQ-470 (Un): 지수 백오프(30초 시작)보다 자주 재시도 금지.

### F6 — 일식/월식 (Hybrid)
- REQ-510 (U): 하이브리드 — (a) 실제 일식 날짜 프리셋 원클릭 점프 + (b) 동일 Keplerian 데이터 정렬 검출.
- REQ-520 (E): WHEN 프리셋 선택 OR 정렬 임계값 내 THEN EarthView 로컬 리그 렌더(일식=지표 그림자, 월식=붉은 umbra).
- REQ-530 (S): WHILE 고 시간가속(0.1x-500x) 동안 프레임률 독립 고정 서브스텝 샘플링으로 미스킵 없이 검출.
- REQ-540 (O): Where "다음 일식 찾기" 포함 시 제공해야 하며, 경계 창(5 시뮬레이션 연도) 내 다음 일식으로 빨리 감아야 함, 내부 검색 1 시뮬레이션 시간 이하 증분.
- REQ-550 (Un): 진짜 기하 정렬에 대응하지 않는 일식 조작 금지.

### F7 — 오로라 (장식용)
- REQ-610 (U): 지원 가능 기기(하드-오프 최저 티어 제외)에서 EARTH 활성 시 극지 오로라 렌더 가능.
- REQ-620 (E): WHEN EARTH 활성 THEN 장식용 극지 오로라(자기극 주변, 야간면 한정), 라이브 데이터 비의존(기법 §4.3).
- REQ-630 (S): WHILE 저사양/모바일 동안 단순화(커튼 감소→정적 텍스처→off).
- REQ-645 (S): WHILE 저사양/모바일 동안 커스텀 정점-노이즈 셰이더 대신 빌보드/스프라이트 폴백(모바일 필수).
- REQ-640 (O): Where GPU 예산이 오로라 ≤1.5ms/frame 허용 시 커스텀 셰이더(정점 변위 밴드) 사용해야 함(§4.3).
- REQ-650 (Un): NFR 하한 아래 프레임 저하 금지, 초과 시 REQ-240 순서로 오로라 먼저 저하. ≤1.5ms/frame(중급 데스크탑 GPU: 2020년 이후 통합 그래픽 이상).

## Acceptance Criteria
- Precondition: 배포 origin CORS 스모크 테스트, 실패 시 F5 드롭 (REQ-450).
- AC-FLIGHT-01: InstancedMesh 마커 + LIVE 상태 + dead-reckoning + 키 없음 (REQ-410/420/460/480).
- AC-FLIGHT-02: 우아한 저하 + aria-live + 백오프 + 오프라인 즉시 + 빈-하늘 vs 오류 구별 (REQ-430/440/470/490).
- AC-ECLIPSE-01: 프리셋 점프 + 진짜 정렬 검출 + 월식 붉은 umbra + 조작 없음 (REQ-510/520/550).
- AC-ECLIPSE-02: 500x 미스킵 없음 + "다음 일식 찾기" (REQ-530/540).
- AC-AURORA-01: 커튼 오로라 야간면 한정 장식용 (REQ-610/620).
- AC-AURORA-02: 모바일 빌보드 폴백 ≥30fps + 커스텀 셰이더 예산 시 + 오로라 먼저 저하 ≤1.5ms (REQ-630/640/645/650).

## Files to Modify
- `[NEW]` src/data/FlightDataService.js — 폴링/백오프/상태 기계/좌표 검증/dead-reckoning
- `[NEW]` src/effects/EclipseRig.js — 로컬 셰도우 리그, 프리셋+검출, 붉은 umbra, 서브스텝 샘플링
- `[NEW]` src/effects/AuroraEffect.js — 노이즈 커튼 셰이더, 야간면, 모바일 폴백
- `[MODIFY]` src/earth/EarthView.js — 항공기/오로라 마운트, 모바일 티어
- `[MODIFY]` src/earth/EarthHUD.js — 항공기 상태/선택, 일식 피커+"find next", 오로라 토글, aria-live
- `[MODIFY]` src/scene/SceneManager.js — 셰도우맵 활성(일식)
- `[EXISTING/read]` src/planets/OrbitalMechanics.js — 정렬 검출 입력(별도 ephemeris 없음)

## Exclusions (What NOT to Build)
- 라이브 우주기상 API 없음(오로라 장식용, F5와 별개 두 번째 외부 의존 회피, REQ-620).
- 유료/키 필요 항공기 API 없음, OpenSky(OAuth2) 반려, 키리스만(REQ-460).
- 서버 프록시 없음(CORS 회피용 백엔드 금지, 미해결 시 F5 드롭 REQ-450).
- 조작된 일식 없음(진짜 기하 정렬만, REQ-550).
- 기하학적 정밀 umbra 수학 없음(태양계 뷰) — EarthView 로컬 리그 예시 렌더.
- 볼류메트릭 레이마칭 오로라 없음(커튼 지오메트리).
- EarthView/ViewManager 재작업 없음(SPEC-EARTH-001 범위, 마운트 포인트만 소비).
