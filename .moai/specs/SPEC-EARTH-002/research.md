---
id: SPEC-EARTH-002
document: research
version: "0.1.0"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, earth-view, flight-data, adsb, eclipse, aurora, brownfield]
depends_on: [SPEC-EARTH-001, SPEC-SIM-001]
---

# SPEC-EARTH-002: Research — 지구 시뮬레이션 (항공기·일식/월식·오로라)

Architect 설계(§4 일식, §5 오로라, §6 항공기)와 Analyst 요구사항(REQ-410~470, 510~550, 610~650), 코드 조사에서 F5+F6+F7 범위로 정제.

## 1. 의존 사실 (선행 필수)

- **F6 그림자·F7 야간면 발광은 relight 선행**: 모든 천체가 무광 `MeshBasicMaterial`(`PlanetFactory.js:127/182/186`)이면 그림자·야간면 개념 자체가 없음. SPEC-SIM-001의 `MeshStandardMaterial` 이관 + 셰도우맵 활성이 물리적 선행 조건(Fact A).
- **비 스케일 좌표계(Fact C)**: 태양·지구·달 크기·거리가 상징적(달 15 units / 지구 8 units, 실제 ~60:1). 기하학적 umbra 원뿔은 이 좌표계에서 무의미 → F6는 EarthView 내 로컬·상대 스케일 리그.
- **동일 Keplerian 데이터 재사용**: `OrbitalMechanics.calculatePosition`(`OrbitalMechanics.js:19`)이 이미 궤도를 구동 → 정렬 검출은 이 데이터를 읽음(별도 ephemeris 없음, REQ-510).

## 2. F5 항공기 API 조사 (제공자 비교)

| 제공자 | 키 | CORS | 조건 | 판정 |
|--------|-----|------|------|------|
| **adsb.lol** (`api.adsb.lol`) | 불필요 | **미확인** | 커뮤니티 운영, 1 req/s, 비상업, ADSBExchange 호환 스키마 | 선호 후보 |
| **adsb.fi** | 불필요 | **미확인** | 1 req/s, 비상업, **귀속 필요** | 후보 |
| **OpenSky** (`opensky-network.org`) | **OAuth2 client-credentials 필요(2026-03~)** | 미확인 | 익명 400 credits/day(불충분), 운영/라이브 제품 사용 서면 동의 요구 | **반려** |

- **OpenSky 반려 근거**: 2026-03부터 OAuth2 client-credentials 요구 → 정적 사이트에 시크릿 배포 불가. 익명 티어 400 credits/day는 불충분하고, 공개 GitHub Pages 배포는 ToS "operational use in live product"에 해당하여 서면 라이선스 필요.
- **CORS 미확인(전 후보)**: 브라우저 강제 규칙은 server-side 문서 페치로 확인 불가. **배포 origin에서 라이브 브라우저 `fetch()` 스모크 테스트가 수락 전제**. 실패 시 F5 드롭(REQ-450) — F6/F7 무영향.
- **폴링**: 10–15초(ADS-B 위치 갱신은 초 단위, 더 빠르면 레이트 낭비). EARTH 활성 + 탭 보임(`document.visibilitychange`)에만. 종료/숨김 즉시 중단(레이트+배터리).
- **렌더**: `(lat,lon,baro_altitude,track)` → 지구 구 위 위치(+고도 오프셋), 단일 `InstancedMesh`(수천 인스턴스 1 draw call), heading 정렬. 폴 사이 dead-reckoning, 새 폴에서 추정→실측 lerp.
- **트러스트 경계**: 외부 신뢰불가 입력 → 인스턴스 행렬 생성 전 좌표 검증/클램프(렌더 루프 throw 금지).
- **상태 기계**(REQ-480): OFF/LOADING/LIVE/RATE_LIMITED/OFFLINE. 429 시 지수 백오프(30초 시작) + dead-reckoning 유지. 빈 하늘(해양/비수기)과 API-down 시각 구별 필수.

### Sources (F5)
- adsb.lol: https://api.adsb.lol/docs , https://www.adsb.lol/docs/open-data/ (무료, 키/계정 불필요, 커뮤니티, ADSBExchange-RapidAPI 호환 스키마)
- OpenSky REST: https://openskynetwork.github.io/opensky-api/rest.html (익명 400 credits/day, 10s 해상도, bounding-box)
- OpenSky ToS: https://opensky-network.org/about/terms-of-use (운영/라이브 제품 서면 라이선스 요구)

## 3. F6 일식 설계 (Hybrid, 사용자 승인)

- **왜 스크립트/프리셋인가**: 비 스케일 좌표(Fact C)에서 자유 재생 중 깔끔한 정렬은 사실상 발생 안 함. 교육용 시뮬레이터의 역할은 "일식이 무엇인지"를 온디맨드로 보여주는 것 → 실제 이벤트 큐레이션 목록이 우월.
- **HYBRID(승인)**: (a) 실제 역사적/예정 일식 날짜 프리셋 원클릭 시간 점프 + (b) Keplerian 정렬 검출(시간 스텝 독립 샘플링) + (c) "다음 일식 찾기" 검색.
- **로컬 리그**: EarthView 내 Sun–Earth–Moon 서브 배치(제어 가능한 상대 스케일), Three.js 셰도우맵.
  - 일식: 달 `castShadow` / 지구 `receiveShadow` → 달 그림자가 지표에 낙하, umbral spot 추적.
  - 월식: 지구 `castShadow` / 달 `receiveShadow` → 지구 그림자가 달을 삼킴, umbral core 붉은 틴트(blood moon, Rayleigh 굴절).
  - umbra/penumbra: `PCFSoftShadowMap` + `light.shadow.radius` 단일 soft falloff, 선택적 수신면 방사 그라디언트 데칼(core→ring→clear). 모바일은 평 soft shadow / flat 디스크로 우아 저하.
- **500x 미스킵**(REQ-530): 정렬 창이 단일 프레임 시간 스텝보다 짧을 수 있음 → 렌더 프레임률 독립 고정 서브스텝 샘플, "다음 일식 찾기"는 작은 증분 내부 스텝.
- **스케일 정직성**: UI에 "예시적, 비 스케일" 표기(Fact C — 전체 앱 비 스케일).

## 4. F7 오로라 설계

- **왜 커튼, 레이마칭 아님**: 볼류메트릭 레이마칭은 무거운 per-pixel 프래그먼트 비용으로 통합/모바일 GPU(Adreno/Mali) 침몰 — 앱이 이미 특수 처리하는 저사양 기기(`SceneManager.js:114-123`). 커튼은 GPU가 좋아하는 저렴한 지오메트리.
- **기법**: 수직 리본 메시/얇은 원통 밴드, 지리극에서 자기극 쪽 오프셋 부분 링, 축 기울기(23.44°, `planetData.js:54`) 정렬. `ShaderMaterial`:
  - Vertex: 스크롤 FBM/simplex 노이즈 변위(춤추는 리플).
  - Fragment: 수직 그라디언트(녹색 core→마젠타/바이올렛 tip), `AdditiveBlending`/`depthWrite:false`/`transparent:true`/`side:DoubleSide`. 발광이 기존 bloom 패스로 피드.
  - 야간면 바인딩: `dot(surfaceNormal, sunDirection)` 페이드(F3 relight 선행 이유).
- **예산**: ≤1.5ms/frame(중급 데스크탑). 노브: 커튼 수, 리본 세그먼트, 노이즈 옥타브.
- **모바일 티어**: (1) 커튼/옥타브 감소 → (2) 정적 스크롤 텍스처 메시 → (3) 최저 티어 하드 off(`isMobile || isLowEnd` 게이트). 장식용 → 드롭이 EarthView 절대 안 깸.
- **왜 데이터 비의존**: 오로라는 실제 지자기 현상이나 의미있는 오프라인 시뮬 근거 없음(일식은 순수 궤도 기하와 달리). 라이브 데이터 연결은 F5와 별개의 두 번째 외부 의존 → 모든 F5 저하 복잡성 가중. REQ-620이 명시적 장식용 스코핑.

## 5. 리스크 (Analyst 발췌)

- **High — F5 외부 의존**: 미확인 CORS, 모호 ToS, 공유 무료 티어 레이트. 전체 확장에서 최고 불확실성. Optional/degradable로 올바르게 스코핑, F1-F4/F6/F7 블록 금지.
- **Medium — 프레임 예산 경합**: 위성/LOD/오로라/일식 오버레이가 같은 60/30fps 실링 경합 → REQ-240 우선순위 저하(오로라 먼저).
- **Medium — 고 시간가속 일식 엣지케이스**: 500x 실행 시에만 표면화, 쉽게 간과. 고정 서브스텝 샘플링 필수.
- **Low — 오로라 데이터 미근거**: 장식용 명시로 의도적·저위험 결정.
