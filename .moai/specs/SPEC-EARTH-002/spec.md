---
id: SPEC-EARTH-002
version: "0.1.1"
status: implemented
created: "2026-07-03"
updated: "2026-07-05"
author: limbowl
priority: medium
issue_number: 3
tags: [three.js, earth-view, flight-data, adsb, eclipse, aurora, brownfield]
depends_on: [SPEC-EARTH-001, SPEC-SIM-001]
---

## HISTORY

- 2026-07-03 (v0.1.1): plan-audit iteration 1 FAIL 대응. (1) REQ-540에 정규 modality 부여(평서형 "빨리 감는다/스텝한다" → "감아야 한다/스텝해야 한다"), 내부 증분을 "1 시뮬레이션 시간 이하"로 정량화. (2) 3개 modality 혼합 REQ-640을 분리 — REQ-640(Optional 커스텀 셰이더) + REQ-645(State-Driven 모바일 빌보드 폴백). (3) State-Driven 헤더의 IF/THEN 정정 — REQ-530/REQ-630 → WHILE, 실패 처리 REQ-430/440/450은 "Unwanted Behavior (IF/THEN)" 헤더로 재분류. (4) REQ-480(HUD 상태)을 Ubiquitous 헤더로 이동·정렬, 선언 범위를 REQ-410~490으로 정정. (5) REQ 텍스트의 구현 식별자(document.visibilitychange, api.adsb.lol 호스트명, FBM/simplex, additive 블렌딩) 제거 → §4로 이동, 제공자 후보는 Assumptions에 유지. (6) 추적성 REQ-450 → CORS Precondition으로 매핑. (7) REQ-640/645 DoD 추가. (8) "작은 증분"/"중급 데스크탑" 정량화. (9) REQ-610 "항상"을 지원 가능 기기로 스코핑(하드-오프 최저 티어 제외). (10) 빈-하늘 vs API-오류 구별 backing REQ-490 신설.
- 2026-07-03 (v0.1.0): 최초 초안. Architect 기술 설계(`refactored-tumbling-barto-agent-a891797d8e48deffc.md` §4~§6)와 Analyst EARS 요구사항(REQ-410~490, REQ-510~550, REQ-610~650)을 통합. F5(실시간 항공기) + F6(일식/월식) + F7(오로라) 3개 요구사항 모듈. F6는 사용자 승인 HYBRID 방식(프리셋 + Keplerian 검출 + "다음 일식 찾기")으로 적응. 3-SPEC 체인의 세 번째(EarthView 시뮬레이션 레이어).

---

# SPEC-EARTH-002: 지구 시뮬레이션 — 실시간 항공기·일식/월식·오로라

## 1. Environment (환경)

### 1.1 개요

SPEC-EARTH-001이 구축한 EarthView 위에 세 개의 가산 시뮬레이션 레이어를 얹는다: (F5) 선택적/우아하게 저하되는 실시간 항공기 위치, (F6) 프리셋 + Keplerian 검출 하이브리드 일식/월식, (F7) 장식용 노이즈 커튼 오로라. 세 기능 모두 EarthView의 마운트 포인트·HUD·라이프사이클·모바일 저하 정책을 공유한다.

### 1.2 3-SPEC 의존성 체인 내 위치

본 SPEC은 3-SPEC 체인의 **세 번째(마지막)** 이며 SPEC-EARTH-001에 직접 의존하고 SPEC-SIM-001에 전이적으로 의존한다.

```
SPEC-SIM-001 (F1+F2+F3)  ── 전이 의존: 조명 반응 재질(F6 그림자/F7 야간면 발광), 텍스처 티어
      ▼
SPEC-EARTH-001 (F4)  ── 직접 의존: EarthView 마운트 포인트, EarthHUD, 라이프사이클, 셰도우맵 인프라
      ▼
SPEC-EARTH-002 (본 SPEC, F5+F6+F7)  ── EarthView 위 3개 가산 레이어
```

- **직접 의존(SPEC-EARTH-001)**: F5/F6/F7은 모두 EarthView 씬/UI 표면 *안에서만* 의미가 있다. EarthView 마운트 포인트(REQ-350/REQ-360)와 HUD 훅, 종료 시 F5 폴링 중단 라이프사이클(REQ-355)이 선행되어야 한다.
- **전이 의존(SPEC-SIM-001)**: F6 그림자와 F7 야간면 발광은 SPEC-SIM-001의 `MeshStandardMaterial` relight가 있어야 물리적으로 가능하다(무광 재질에서는 그림자·야간면 개념이 없음).

### 1.3 기술 스택

Three.js r175 유지. 신규: 로컬 일식 리그(DirectionalLight + `PCFSoftShadowMap`), 항공기 `InstancedMesh`, 오로라 `ShaderMaterial`(additive). 외부 데이터는 F5 항공기만(키리스 ADS-B), F6/F7은 외부 API 없음.

### 1.4 브라운필드 사실

- 일식/월식 그림자는 `MeshStandardMaterial` relight(SPEC-SIM-001) + 셰도우맵 활성(`SceneManager.js` 셰도우맵 enable)이 선행되어야 함. 무광 재질에서는 불가.
- 스케일이 상징적(Fact C)이므로 기하학적 umbra 원뿔 수학은 태양계 좌표계에서 성립 불가 → F6는 EarthView 내 **로컬·상대 스케일 리그**로 렌더.
- **[CORRECTED 2026-07-05]** `OrbitalMechanics.calculatePosition`(`OrbitalMechanics.js:19`)은 승교점 경도(Ω)를 생략한다(SPEC-SIM-001 §1.4 기지 한계) — 이는 F6가 원안대로 "동일 Keplerian 위치 데이터로부터 정렬을 검출"할 수 없음을 의미한다. Ω 없는 궤도 모델로 진짜 node-crossing 정렬을 계산하면 결과가 조작(fabricated)될 수밖에 없으며, 이는 REQ-550("진짜 기하 정렬에 대응하지 않는 일식 조작 금지")을 그 자체로 위반한다. 실제 구현은 **실제 카탈로그 일식 테이블**(NASA Five Millennium Canon of Solar/Lunar Eclipses, Espenak & Meeus)을 소스 오브 트루스로 사용해 시뮬레이션 시각을 실제 일식 순간과 범위 검사(range-test)한다 — 상세 §4.2, `src/utils/eclipseData.js`의 `@MX:NOTE` 참조. 이 설계 치환은 quality-earth-002 및 evaluator-earth-002가 각각 독립적으로 검토하여 타당하다고 확인했다(REQ-550 위반을 피하기 위한 근거 있는 대체이며, 조용한 변경이 아니다).
- WebGL 트러스트 경계: 항공기 좌표는 외부 신뢰불가 입력 → 인스턴스 행렬 생성 전 검증/클램프 필수.

---

## 2. Assumptions (가정)

- **A-401**: SPEC-EARTH-001이 선행 완료되어 EarthView·HUD·마운트 포인트·라이프사이클이 존재한다.
- **A-402**: SPEC-SIM-001의 relight로 셰도우맵 기반 F6 그림자와 F7 야간면 페이드가 성립한다.
- **A-403 (F5 핵심 불확실성)**: 키리스·CORS 가능·클라이언트 호출 가능 무료 항공기 API가 구현 시점에 존재한다 — **미확인**. 후보: adsb.lol / adsb.fi(키 불필요, 1 req/s, 비상업 조건, adsb.fi 귀속 필요). OpenSky는 **반려**(2026-03부터 OAuth2 client-credentials 필요 — 정적 사이트에 시크릿 배포 불가, 익명 400 credits/day 불충분). **CORS는 모든 후보에 대해 미확인** — 배포 origin에서의 라이브 브라우저 스모크 테스트가 수락 전제조건.
- **A-404**: F6 일식은 실제 역사적/예정 일식 날짜 프리셋(예: 2027-08-02 개기일식)으로 원클릭 시간 점프하며, 동시에 Keplerian 정렬 검출로 자유 재생 중에도 이벤트를 놓치지 않는다.
- **A-405**: F7 오로라는 실시간 우주기상 API 없이 장식용으로만 렌더한다(F5와 별개의 두 번째 외부 의존 회피).

---

## 3. Requirements (요구사항 — EARS)

요구사항 모듈 3개(F5, F6, F7).

### 3.1 F5 — 실시간 항공기 위치 (Optional / Degradable)

**Ubiquitous (필수)**
- **REQ-480**: 시스템은 **항상** 항공기 레이어의 명시적 HUD 상태를 표시해야 한다: OFF(기본, 폴링 없음, 옵트인 토글) / LOADING(첫 페치) / LIVE(성공, "live · N aircraft · updated Xs ago") / RATE_LIMITED(레이트 한도, 백오프 + 마지막 dead-reckoning 유지) / OFFLINE(네트워크·CORS·불량 페이로드, 항공기 0으로 지구 뷰 계속).
- **REQ-490**: 시스템은 **항상** 항공기가 0대인 정상 "빈 하늘" 상태를 API 오류/불가 상태와 시각적으로 구별되는 표시로 나타내야 한다(사용자가 "데이터 없음"을 "고장"으로 오독하지 않도록).

**Optional (핵심 프레이밍 — 이 기능 전체가 조건부)**
- **REQ-410**: **Where** 무료·키리스·CORS 가능·클라이언트 호출 가능 항공기 위치 API가 구현 시점에 존재하는 경우, 시스템은 지구 뷰에 라이브 항공기 위치 마커를 오버레이**해야 한다**. (제공자 후보 및 반려 근거: Assumptions A-403, Solution §4.1)

**Event-Driven (이벤트 기반)**
- **REQ-420**: **WHEN** 지구 뷰가 활성이고 항공기 기능이 활성이며 탭이 보이는 동안 **THEN** 시스템은 선택 제공자를 10–15초 간격(문서/공정 사용 한도 이상)으로 폴링하고 항공기 마커를 갱신해야 한다. (탭 가시성 감지 메커니즘: §4.1)

**Unwanted Behavior (IF/THEN 조건부)**
- **REQ-430**: **IF** 항공기 요청이 실패하면(네트워크 오류, CORS 거부, HTTP 4xx/5xx, 레이트 한도 소진) **THEN** 시스템은 항공기 레이어를 우아하게 비활성화하고, 비차단 "live flight data unavailable" 표시자를 보이며, 다른 모든 지구 뷰 기능을 영향 없이 계속해야 한다.
- **REQ-440**: **IF** 브라우저가 오프라인이면 **THEN** 시스템은 항공기 요청을 시도하지 않고 재시도 루프 없이 즉시 unavailable 표시자를 보여야 한다.
- **REQ-450**: **IF** 무료·CORS 호환 항공기 API가 구현 중 실현 가능하다고 확인되지 않으면 **THEN** F5 기능 전체가 F1–F4·F6·F7을 블록하지 않고 출하 SPEC에서 생략되어야 한다.

**Unwanted (금지)**
- **REQ-460**: 시스템은 클라이언트 소스에 사설/유료 API 키를 임베드하지 **않아야 한다**. 완전 공개·키리스·클라이언트-안전 API만 허용(정적/백엔드리스/시크릿 없음 아키텍처 보존, SPEC-UI-001 REQ-020).
- **REQ-470**: 시스템은 실패한 항공기 요청을 고정 백오프 창(30초 시작 지수 백오프)보다 자주 재시도하지 **않아야 한다**(공유 무료 커뮤니티 API 보호).

### 3.2 F6 — 일식/월식 (Hybrid: 프리셋 + Keplerian 검출)

**Ubiquitous (필수)**
- **REQ-510**: 시스템은 **항상** 하이브리드 일식 시스템을 제공해야 한다: (a) 실제 역사적/예정 일식 날짜 프리셋 목록의 원클릭 시간 점프, **그리고** (b) 동일 프리셋 목록(실제 카탈로그 일식 테이블)을 소스로 시뮬레이션 시각을 범위 검사(range-test)하여 Sun-Earth-Moon 정렬 이벤트를 검출(별도 일식 전용 ephemeris 도입 없음). **[CORRECTED 2026-07-05]** 원안의 "Keplerian 위치 데이터로부터 정렬 검출"은 `OrbitalMechanics`의 Ω(승교점) 생략으로 인해 실현 불가능하며(§1.4), 실제 구현은 §4.2에 기술된 테이블 기반 검출로 대체되었다 — REQ-550 준수는 동일하게 유지된다.

**Event-Driven (이벤트 기반)**
- **REQ-520**: **WHEN** 프리셋이 선택되거나 계산된 Sun-Earth-Moon 정렬이 일식 임계값 내에 들면 **THEN** 시스템은 EarthView 내 로컬 그림자 리그로 대응 시각을 렌더해야 한다(일식 = 지구 표면 그림자 오버레이, 월식 = 달 붉은-틴트 umbra).

**State-Driven (상태 기반)**
- **REQ-530**: **WHILE** 시뮬레이션이 고 시간 가속(기존 0.1x–500x 범위)으로 실행되는 동안, 시스템은 큰 프레임 당 시간 스텝으로 인해 정렬 교차를 건너뛰지 않고 검출해야 한다. **[CORRECTED 2026-07-05]** 원안은 "고정 서브스텝 샘플링"을 전제했으나, 실제 구현(테이블 기반 검출, §4.2)은 반개구간 `(prevDay, currDay]` 범위 검사로 프레임 스텝 크기와 무관하게 그 구간에 속한 모든 카탈로그 일식을 포착한다 — 별도의 서브스텝 샘플링 루프가 필요 없다(500x에서 한 프레임이 여러 해를 건너뛰어도 동일하게 안전).

**Optional (선택적)**
- **REQ-540**: **Where** "다음 일식 찾기(find next eclipse)" 컨트롤이 포함되는 경우, 시스템은 이를 제공해야 하며, 활성화 시 경계 검색 창(다음 5 시뮬레이션 연도 이내) 내 다음 일식 발생으로 시뮬레이션 시계를 빨리 감아**야 한다**. 내부 검색은 1 시뮬레이션 시간(hour) 이하 증분으로 스텝**해야 한다**.

**Unwanted (금지)**
- **REQ-550**: 시스템은 시뮬레이션 천체의 진짜 기하학적 정렬에 대응하지 않는 일식 이벤트를 조작하지 **않아야 한다**. 프리셋은 실제 역사적/예정 이벤트에 대응하며, 검출은 물리적으로 근거해야 한다(기저 Keplerian 정확도 유지).

### 3.3 F7 — 오로라 (장식용)

**Ubiquitous (필수)**
- **REQ-610**: 시스템은 **항상** 지원 가능 기기(하드-오프 최저 티어 제외)에서 지구 뷰 활성 시 지구 극지방에 오로라 시각 효과를 렌더링할 수 있어야 한다.

**Event-Driven (이벤트 기반)**
- **REQ-620**: **WHEN** 지구 뷰가 활성이면 **THEN** 시스템은 오로라를 라이브 외부 태양활동 데이터에 묶이지 않은 장식용 극지 시각(자기극 주변, 야간면 한정)으로 렌더해야 한다. (렌더 기법: §4.3)

**State-Driven (상태 기반)**
- **REQ-630**: **WHILE** 기기가 저사양/모바일(기존 휴리스틱)로 분류된 동안, 시스템은 단순화 오로라(커튼 감소 → 정적 텍스처 메시 → off 티어)를 전체 셰이더 버전 대신 렌더해야 한다.
- **REQ-645**: **WHILE** 기기가 저사양/모바일로 분류된 동안, 시스템은 커스텀 정점-노이즈 셰이더 대신 빌보드/스프라이트 폴백으로 오로라를 렌더링해야 한다(모바일에서 폴백 필수).

**Optional (선택적)**
- **REQ-640**: **Where** GPU 프레임 예산이 오로라 ≤ 1.5ms/frame(REQ-650) 이내를 허용하는 경우, 시스템은 커스텀 셰이더(정점 변위 반투명 밴드)로 오로라를 렌더링**해야 한다**. (셰이더 기법: §4.3)

**Unwanted (금지)**
- **REQ-650**: 시스템은 오로라 효과가 프레임률을 Section 5 NFR 하한 아래로 떨어뜨리게 하지 **않아야 한다**. 그럴 경우 REQ-240(SPEC-SIM-001)의 우선순위 저하 순서가 적용되어 오로라가 먼저 저하된다. 오로라 예산 ≤ 1.5ms/frame(중급 데스크탑 GPU — 예: 2020년 이후 통합 그래픽 또는 동급 이상).

---

## 4. Solution (해결 방안)

### 4.1 F5 — 항공기 데이터 서비스

- `[NEW]` `src/data/FlightDataService.js`. 폴링 아키텍처: 10–15초 간격, **EARTH 상태 활성 AND 탭 보임** 일 때만. 종료/탭 숨김 시 즉시 중단(레이트+배터리).
- **데이터 → 렌더**: 각 항공기 `(lat, lon, baro_altitude, track)`을 지구 구 위 위치(+고도 오프셋)로 매핑, 단일 `InstancedMesh`(인스턴스당 행렬, heading 정렬). 수천 인스턴스 = 1 draw call.
- **보간**: 폴 사이 dead-reckoning(reported velocity + track으로 매 프레임 전진), 새 폴에서 추정→실측 lerp(스냅 방지).
- **트러스트 경계**: 모든 수신 좌표를 인스턴스 행렬 생성 전 검증/클램프(불량 페이로드가 렌더 루프에서 throw 금지).
- **HUD 상태 기계**(REQ-480): OFF/LOADING/LIVE/RATE_LIMITED/OFFLINE. 429 시 지수 백오프 + dead-reckoning 유지.
- **CORS 미확인**: 라이브 브라우저 스모크 테스트가 수락 전제(server-side 페치는 CORS 확인 불가). 실패 시 F5 드롭(REQ-450), 다른 기능 무영향.

### 4.2 F6 — 하이브리드 일식/월식 리그

- `[NEW]` `src/effects/EclipseRig.js`. EarthView 내 로컬·상대 스케일 Sun–Earth–Moon 서브 배치 + Three.js 셰도우맵.
  - `DirectionalLight`(태양 방향), `castShadow=true`, `PCFSoftShadowMap`.
  - **일식**: Moon `castShadow`, Earth `receiveShadow` → 달 그림자가 지구 표면에 낙하, umbral spot 추적. soft shadow radius로 penumbra 자연 falloff.
  - **월식**: Earth `castShadow`, Moon `receiveShadow` → 지구 그림자가 달을 삼킴, umbral core를 붉게 틴트(blood moon, Rayleigh 굴절광).
  - umbra/penumbra: `PCFSoftShadowMap` + 튜닝된 `light.shadow.radius`(단일 soft falloff) + 선택적 수신면 방사 그라디언트 데칼(불투명 core → 그라데이션 ring → clear). 모바일은 평 soft shadow 또는 flat 어둡기 디스크로 우아 저하.
- **하이브리드 컨트롤 [CORRECTED 2026-07-05, as-built]**: `[NEW]` `src/utils/eclipseData.js` — 실제 카탈로그 일식 테이블(NASA Five Millennium Canon of Solar/Lunar Eclipses, Espenak & Meeus; 10건, 2026–2030)을 소스 오브 트루스로 사용. 프리셋 목록(원클릭 시간 점프) + 자유 재생 중 `detectEclipsesInRange(prevDay, currDay)` 범위 검사(별도 Keplerian 정렬 계산 없음) + "다음 일식 찾기" 검색(`findNextEclipse`, REQ-540). 원안이 전제한 "궤도 위치 데이터 기반 Sun-Earth-Moon 정렬 검출"은 `OrbitalMechanics`의 Ω 생략으로 실현 불가능해 채택하지 않았다(근거: §1.4, REQ-510/530 정정).
- **시간 스텝 독립성**(REQ-530, as-built): 원안의 "고정 서브스텝 샘플링" 대신, 반개구간 `(prevDay, currDay]` 범위 검사가 구조적으로 프레임 스텝 크기에 면역이다 — 한 프레임이 몇 년을 건너뛰어도 그 구간의 모든 테이블 엔트리를 포착하므로 500x에서도 미스킵 없음. 별도 서브스텝 루프 불필요.
- **스케일 정직성**: UI에 일식 기하가 예시적(비 스케일)임을 표기 — 전체 앱이 비 스케일(Fact C). `EclipseRig`는 실제 궤도 위치를 참조하지 않는 고정 배치 diorama(`@MX:NOTE` 참조)이며, 검출 결과(REQ-550 준수, 실제 일식에만 대응)에 의해서만 트리거된다.

### 4.3 F7 — 오로라 효과

- `[NEW]` `src/effects/AuroraEffect.js`. 수직 리본 메시(또는 얇은 원통 밴드), 지리극에서 자기극 쪽 오프셋 부분 링, 축 기울기(23.44°, `planetData.js:54`) 정렬. 커스텀 `ShaderMaterial`:
  - **Vertex**: 스크롤 FBM/simplex 노이즈로 커튼 높이/곡선 변위(춤추는 리플).
  - **Fragment**: 수직 그라디언트(녹색 core → 마젠타/바이올렛 tip), `AdditiveBlending`, `depthWrite:false`, `transparent:true`, `side:DoubleSide`. 발광 기여가 기존 bloom 패스로 피드.
  - **야간면 바인딩**: `dot(surfaceNormal, sunDirection)`으로 페이드 → 어둠에만 표시(F3 relight 선행 이유).
- **예산**: ≤ 1.5ms/frame(중급 데스크탑). 노브: 커튼 수, 리본 세그먼트, 노이즈 옥타브.
- **모바일 티어 폴백**(REQ-630): (1) 커튼/옥타브 감소 → (2) 정적 스크롤 텍스처 메시(정점 노이즈 없음) → (3) 최저 티어 하드 off(기존 `isMobile || isLowEnd` 게이트). 장식용이므로 드롭이 EarthView를 절대 깨지 않음.

---

## 5. Non-Functional Requirements (NFR)

| 범주 | 요구 |
|------|------|
| 프레임 레이트 | 데스크탑 60fps / 모바일 30fps. 세 신규 GPU-비용 기능이 동시 활성일 때도 유지. |
| 프레임 스무스니스 | p95 ≤ 25ms 데스크탑 / ≤ 50ms 모바일, 롤링 60초(SPEC-SIM-001 상속). |
| 오로라 예산 | ≤ 1.5ms/frame(중급 데스크탑). 초과 시 REQ-240 순서로 먼저 저하. |
| F5 폴 예산 | 10–15초 간격, EARTH 활성 + 탭 보임에만. 실패 지수 백오프 30초 시작. |
| F5 트러스트 경계 | 모든 수신 좌표 검증/클램프. 렌더 루프 throw 금지. |
| 접근성 | `aria-live="polite"` for F5 unavailable 표시자. `prefers-reduced-motion` 시 오로라 애니메이션·일식 그림자 전환 이징 비활성(SPEC-EARTH-001 상속). |

---

## 6. Exclusions (What NOT to Build)

- **라이브 우주기상 API 없음**: 오로라는 장식용이며 실시간 태양활동/지자기 데이터에 묶지 않는다(F5와 별개의 두 번째 외부 의존 회피, REQ-620/A-405).
- **유료/키 필요 항공기 API 없음**: 클라이언트에 시크릿을 임베드하지 않는다. OpenSky(OAuth2)는 반려. 키리스 공개 API만(REQ-460).
- **서버 프록시 없음**: CORS 회피용 백엔드 프록시를 두지 않는다(정적/백엔드리스 아키텍처 유지). CORS 미해결 시 F5 드롭(REQ-450).

> **[SUPERSEDED 2026-08-13]** 위 두 항목의 전제가 실측으로 무너졌다. `api.airplanes.live` 키리스 엔드포인트는 403으로 폐지되었고, 남은 키리스 후보(adsb.fi / adsb.lol)는 **어느 것도 CORS 헤더를 보내지 않아** 브라우저 직접 호출이 불가능하다. Cloudflare Worker 프록시도 해법이 아니다 — adsb.fi와 OpenSky 모두 Cloudflare 뒤에 있어 Worker 서브리퀘스트가 403(WAF) / 522로 차단된다(실측). 현재 구현은 **프록시가 아니라 스케줄 스냅샷**이다: GitHub Actions 러너가 OpenSky 전역 질의를 받아 트림한 뒤 orphan `flight-data` 브랜치로 force-push하고, raw.githubusercontent.com이 `access-control-allow-origin: *`로 서빙한다. 시크릿은 여전히 클라이언트에 없고(REQ-460의 의도는 유지), 백엔드도 없다(서버 프로세스 0). 대가는 신선도로, 스냅샷은 수십 분 지난 것일 수 있으며 HUD가 그 나이를 그대로 표시한다. 세부: `.github/workflows/flights.yml`, CHANGELOG [Unreleased].
- **조작된 일식 없음**: 진짜 기하학적 정렬에 대응하지 않는 일식을 렌더하지 않는다(REQ-550).
- **기하학적 정밀 umbra 수학 없음(태양계 뷰)**: 비 스케일 좌표계에서 물리 umbra 원뿔을 계산하지 않는다. F6는 EarthView 로컬 리그로 예시 렌더.
- **볼류메트릭 레이마칭 오로라 없음**: 저사양/모바일 GPU를 침몰시키는 per-pixel 프래그먼트 레이마칭 대신 커튼 지오메트리 사용.
- **EarthView/ViewManager 재작업 없음**: SPEC-EARTH-001 범위이며 본 SPEC은 마운트 포인트만 소비한다.

---

## 7. Traceability (추적성)

| 요구사항 | 모듈 | Solution 참조 | Acceptance |
|----------|------|--------------|------------|
| REQ-410, REQ-460, REQ-480 | F5 | §4.1 | AC-FLIGHT-01 |
| REQ-420 | F5 | §4.1 | AC-FLIGHT-01 |
| REQ-450 | F5 | §4.1 | Precondition (CORS 스모크 테스트) |
| REQ-430, REQ-440, REQ-470, REQ-490 | F5 | §4.1 | AC-FLIGHT-02 |
| REQ-510, REQ-520, REQ-550 | F6 | §4.2 | AC-ECLIPSE-01 |
| REQ-530, REQ-540 | F6 | §4.2 | AC-ECLIPSE-02 |
| REQ-610, REQ-620 | F7 | §4.3 | AC-AURORA-01 |
| REQ-630, REQ-640, REQ-645, REQ-650 | F7 | §4.3, §5 | AC-AURORA-02 |

---

## 8. Expert Consultation

| 도메인 | 에이전트 | 사유 |
|--------|---------|------|
| Frontend 3D | expert-frontend | 셰도우맵 일식 리그, 오로라 셰이더, InstancedMesh 항공기 |
| Backend / Data | expert-backend | FlightDataService 폴링·백오프·상태 기계, CORS 스모크 테스트 설계 |
| Security | expert-security | 외부 항공기 입력 트러스트 경계, 좌표 검증/클램프, 키리스 준수 |

---

## 9. Implementation Notes (2026-07-05)

TASK-F6-0~F7-3 (10개 태스크) 전부 GREEN. 총 160 tests 통과(97 baseline + 신규 63), 회귀 0건. `npm run build` 정상(40 modules).

- **F5 항공기**: A-403의 후보(adsb.lol/adsb.fi)와 달리 **`api.airplanes.live`**로 CORS 라이브 스모크 테스트를 통과하여 채택(키리스, 무료, `src/data/FlightDataService.js`). 상태 기계(OFF/LOADING/LIVE/RATE_LIMITED/OFFLINE) + 30초 시작 지수 백오프 + dead-reckoning + 좌표 클램프 구현.
- **F6 일식/월식**: 위 CORRECTED 정정 참조 — 원안의 Keplerian 정렬 검출을 실제 카탈로그 테이블 range-test로 대체(`src/utils/eclipseData.js`). `EclipseRig`는 궤도 위치를 참조하지 않는 고정 배치 diorama.
- **F7 오로라**: 커스텀 정점-노이즈 셰이더(데스크탑) + 빌보드/스프라이트 폴백(모바일), 야간면 한정, REQ-240 저하 순서에서 오로라 우선 저하.
- 계획대로 신규: `src/utils/eclipseData.js`, `src/effects/EclipseRig.js`, `src/effects/AuroraEffect.js`, `src/effects/AircraftLayer.js`, `src/data/FlightDataService.js`.
- 계획대로 수정: `EarthView.js`, `EarthHUD.js`, `SceneManager.js`(셰도우맵), `performance.js`(EARTH_DEGRADE_STEPS), `ViewManager.js`(저하 스텝/오로라 셰드 콜백), `constants.js`(SIM_EPOCH_MS 등), `main.js`.
- src 스코프 드리프트 0% — 계획된 파일만 수정, 신규 디렉터리 `src/effects/`, `src/data/`만 추가.
- 검증 수준: AC-FLIGHT-02(백오프/오프라인/클램프), AC-ECLIPSE-02(500x 미스킵+find-next), REQ-550(조작 없음), AC-AURORA-02 순서(오로라 우선 저하), 야간면/극지 배치 수학, 모바일 티어 선택 등은 순수 로직으로 코드 검증됨. CORS 스모크(이미 airplanes.live로 확인 완료), 항공기 InstancedMesh 렌더, 일식 그림자/umbra 비주얼, 오로라 외관, 실기기 fps는 수동/실사용 네트워크 검증 대상.
