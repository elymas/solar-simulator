---
id: SPEC-EARTH-002
document: acceptance
version: "0.1.1"
status: implemented
created: "2026-07-03"
updated: "2026-07-05"
author: limbowl
tags: [three.js, earth-view, flight-data, adsb, eclipse, aurora, brownfield]
depends_on: [SPEC-EARTH-001, SPEC-SIM-001]
---

# SPEC-EARTH-002: Acceptance Criteria — 지구 시뮬레이션

## Precondition (F5): CORS 스모크 테스트

**[HARD] 수락 전제조건** — F5 진행 전 배포 origin에서 확인:

```gherkin
Scenario: 배포 origin에서 항공기 API CORS가 실증된다
  Given 배포된 사이트(elymas.github.io/solar-simulator)에서 실행 중
  When 라이브 브라우저 fetch()로 adsb.lol(또는 adsb.fi) 엔드포인트를 호출함
  Then 브라우저가 CORS preflight를 통과하고 JSON 응답을 반환해야 한다
  And server-side 페치가 아닌 실제 브라우저 컨텍스트에서 검증되어야 한다
  When CORS가 어느 후보에서도 실증되지 않음
  Then F5 전체가 F6/F7을 블록하지 않고 SPEC에서 생략되어야 한다 (REQ-450)
```

## AC-FLIGHT-01: 항공기 마커 렌더 및 상태 (F5)

**Related Requirements**: REQ-410, REQ-420, REQ-460, REQ-480

```gherkin
Scenario: API 사용 가능 시 항공기 마커가 렌더된다
  Given 지구 뷰가 열리고 항공기 기능이 활성(옵트인 토글)
  And 선택 항공기 API가 성공 응답하고 탭이 보임
  When 항공기 위치 데이터가 10-15초 간격으로 수신됨
  Then 항공기 마커가 보고된 위치에 InstancedMesh로 나타나야 한다
  And HUD가 LIVE 상태("live · N aircraft · updated Xs ago")를 표시해야 한다
  And 폴 사이 dead-reckoning으로 60fps 부드러운 이동을 보여야 한다
```

```gherkin
Scenario: 클라이언트에 API 키가 임베드되지 않는다
  Given F5가 구현됨
  When 클라이언트 번들을 검사함
  Then 어떤 사설/유료 API 키도 소스에 존재하지 않아야 한다 (REQ-460)
  And 키리스 공개 제공자만 사용되어야 한다 (OpenSky OAuth2 반려)
```

## AC-FLIGHT-02: 우아한 저하 (F5)

**Related Requirements**: REQ-430, REQ-440, REQ-470, REQ-490

```gherkin
Scenario: 항공기 API 도달 불가 시 우아하게 저하된다
  Given 지구 뷰가 열리고 항공기 기능이 활성
  When 항공기 API 요청이 실패함(CORS, 네트워크 오류, 레이트 한도)
  Then 항공기 레이어가 비활성화되어야 한다
  And 작은 비차단 "live flight data unavailable" 표시자(aria-live=polite)가 나타나야 한다
  And 다른 모든 지구 뷰 기능이 완전히 사용 가능해야 한다
  And 재시도는 지수 백오프(30초 시작)보다 자주 발생하지 않아야 한다
```

```gherkin
Scenario: 오프라인 시 즉시 표시, 재시도 루프 없음
  Given 브라우저가 오프라인
  When 지구 뷰가 활성
  Then 시스템은 항공기 요청을 시도하지 않아야 한다
  And unavailable 표시자를 즉시 보여야 한다
  And 빈 하늘(해양/비수기)과 API-down 오류가 시각적으로 구별되어야 한다
```

## AC-ECLIPSE-01: 하이브리드 일식 렌더 (F6)

**Related Requirements**: REQ-510, REQ-520, REQ-550

```gherkin
Scenario: 프리셋 일식 날짜로 원클릭 점프한다
  Given 지구 뷰가 활성
  When 사용자가 프리셋 목록에서 실제 일식(예: 2027-08-02 개기일식)을 선택함
  Then 시뮬레이션 시계가 해당 날짜로 점프해야 한다
  And EarthView 로컬 리그가 지구 표면 그림자 오버레이(일식)를 렌더해야 한다
```

```gherkin
Scenario: 진짜 정렬에만 일식이 렌더된다
  Given 시뮬레이션이 재생 중
  When 시뮬레이션 시각이 실제 카탈로그 일식 테이블의 순간과 범위 검사로 일치함(as-built 검출 방식 — spec.md §1.4/§4.2 CORRECTED 참조; 원안의 "Keplerian 그림자 원뿔 교차"는 궤도 모델의 Ω 생략으로 대체됨)
  Then 일식 그림자 오버레이가 렌더되어야 한다
  And 다른 어떤 시각에도 일식이 렌더되지 않아야 한다
  And 진짜 정렬에 대응하지 않는 일식은 조작되지 않아야 한다 (REQ-550, 실제 카탈로그 테이블이 진위 근거)
```

```gherkin
Scenario: 월식이 붉은 umbra로 렌더된다
  Given 지구 뷰가 활성이고 월식 정렬(프리셋 또는 검출)
  When 지구 그림자가 달을 삼킴
  Then 달의 umbral core가 붉게 틴트(blood moon)되어야 한다
```

## AC-ECLIPSE-02: 고 시간가속 검출 및 검색 (F6)

**Related Requirements**: REQ-530, REQ-540

```gherkin
Scenario: 고 시간가속에서 일식 검출이 유지된다
  Given 시뮬레이션이 500x 속도로 재생 중
  When 실제 카탈로그 일식 순간이 그 재생 중 경과함
  Then 일식이 여전히 검출되고 렌더되어야 한다
  And 큰 프레임 당 시간 스텝으로 인해 조용히 건너뛰어지지 않아야 한다
  And 검출은 반개구간 (prevDay, currDay] range-test로 프레임률과 무관하게 이루어져야 한다(as-built — 별도 고정 서브스텝 샘플링 불필요, spec.md REQ-530 CORRECTED 참조)
```

```gherkin
Scenario: "다음 일식 찾기"가 다음 발생으로 빨리 감는다
  Given "find next eclipse" 컨트롤이 구현됨
  When 사용자가 이를 활성화함
  Then 시뮬레이션 시계가 경계 창(다음 5 시뮬레이션 연도 이내) 내 다음 일식으로 빨리 감겨야 한다
  And 내부 검색은 1 시뮬레이션 시간(hour) 이하 증분으로 스텝해야 한다
```

## AC-AURORA-01: 오로라 렌더 (F7)

**Related Requirements**: REQ-610, REQ-620

```gherkin
Scenario: 지구 뷰에서 오로라가 야간면 극지에 렌더된다
  Given 지구 뷰가 데스크탑급 기기에서 열림
  When 극지방이 시야에 들어옴
  Then 노이즈 구동 커튼 오로라가 additive 블렌딩으로 렌더되어야 한다
  And 오로라는 야간면(dot(normal, sunDir) 페이드)에만 표시되어야 한다
  And 라이브 외부 태양활동 데이터에 묶이지 않아야 한다 (장식용)
```

## AC-AURORA-02: 오로라 폴백 및 예산 (F7)

**Related Requirements**: REQ-630, REQ-640, REQ-645, REQ-650

```gherkin
Scenario: 저사양 기기에서 오로라가 폴백한다
  Given 지구 뷰가 저사양/모바일 기기에서 열림
  When 극지방이 시야에 들어옴
  Then 단순화 오로라(커튼 감소 → 정적 텍스처 → off 티어)가 렌더되어야 한다 (REQ-630)
  And 커스텀 정점-노이즈 셰이더 대신 빌보드/스프라이트 폴백이 사용되어야 한다 (REQ-645)
  And 프레임률이 30fps 모바일 하한 이상 유지되어야 한다
  And 오로라 드롭이 EarthView를 깨지 않아야 한다
```

```gherkin
Scenario: GPU 예산 허용 시 커스텀 셰이더 오로라가 렌더된다 (REQ-640)
  Given 지구 뷰가 데스크탑급 기기에서 열림
  And GPU 프레임 예산이 오로라 1.5ms/frame 이내를 허용함
  When 극지방이 시야에 들어옴
  Then 커스텀 셰이더(정점 변위 반투명 밴드) 오로라가 렌더되어야 한다
```

```gherkin
Scenario: 오로라가 프레임 예산을 넘으면 먼저 저하된다
  Given 오로라가 렌더 중이고 프레임 예산이 초과됨
  When 우선순위 저하가 적용됨
  Then 오로라가 REQ-240 순서에 따라 먼저 저하되어야 한다
  And 오로라 비용이 ≤1.5ms/frame(중급 데스크탑)이어야 한다
```

---

## Performance Gate Criteria (NFR)

| 게이트 | 기준 | 통과 조건 |
|--------|------|-----------|
| CORS 스모크 (F5 전제) | 배포 origin 라이브 브라우저 fetch | 통과 시 진행, 실패 시 F5 드롭 |
| 프레임 (데스크탑) | F5+F6+F7 동시 활성 p95 | ≤ 25ms |
| 프레임 (모바일) | F5+F6+F7 동시 활성 p95 | ≤ 50ms |
| 오로라 예산 | 중급 데스크탑 GPU(2020년 이후 통합 그래픽 또는 동급 이상) 프레임 비용 | ≤ 1.5ms/frame |
| F5 폴 간격 | 폴링 주기 | 10–15초, EARTH 활성+탭 보임에만 |
| F5 백오프 | 실패 재시도 | 지수 백오프, 30초 시작 이상 |
| F5 좌표 검증 | 인스턴스 행렬 생성 전 | 모든 좌표 검증/클램프, 렌더 루프 throw 0 |
| F6 고가속 검출 | 500x에서 진짜 정렬 | 미스킵 없음 |
| F7 모바일 폴백 | 저사양 프레임률 | ≥ 30fps |

---

## Edge Cases

- **F5 CORS 침묵 실패**: 브라우저 preflight가 server-side 체크와 다르게 조용히 실패 → 라이브 fetch로만 검증.
- **F5 빈 vs down**: 해양/비수기의 희소/제로 항공기는 정당한 빈 상태이며 API-down 오류와 시각 구별 필수(사용자 오독 방지).
- **F5 레이트 소진 중 세션**: 가시 반복 오류 아닌 조용한 저하(RATE_LIMITED, dead-reckoning 유지).
- **F6 500x 미스킵**: 정렬 창이 단일 프레임 시간 스텝보다 짧아 조용히 스킵 → 고정 서브스텝 샘플링.
- **F6 스케일 부정직**: 비 스케일 좌표에 물리 함의 → UI "예시적" 표기.
- **F7 프래그먼트 셰이더 침몰**: Adreno/Mali 저사양에서 프레임률 붕괴 → 커튼 폴백 하드 요구.

---

## Definition of Done

- [ ] CORS 스모크 테스트 통과(또는 F5 명시적 드롭, F6/F7 무영향) (REQ-450)
- [ ] 항공기 InstancedMesh 마커 + LIVE 상태 + dead-reckoning (REQ-410, REQ-420, REQ-480)
- [ ] HUD 상태 기계 OFF/LOADING/LIVE/RATE_LIMITED/OFFLINE (REQ-480)
- [ ] 빈-하늘 상태와 API-오류/불가 상태 시각 구별 (REQ-490)
- [ ] 우아한 저하 + aria-live 표시자 + 지수 백오프 (REQ-430, REQ-440, REQ-470)
- [ ] 클라이언트 키 없음, 키리스 제공자만 (REQ-460)
- [ ] 하이브리드 일식: 프리셋 점프 + Keplerian 검출 (REQ-510, REQ-520)
- [ ] 진짜 정렬에만 렌더, 조작 없음 (REQ-550)
- [ ] 월식 붉은 umbra (REQ-520)
- [ ] 500x 고가속 미스킵 없음 (시간 스텝 독립 샘플링) (REQ-530)
- [ ] "다음 일식 찾기" 검색 (REQ-540)
- [ ] 노이즈 커튼 오로라, 야간면 한정, 장식용, 지원 가능 기기 스코프 (REQ-610, REQ-620)
- [ ] GPU 예산 허용 시 커스텀 셰이더 오로라 (REQ-640)
- [ ] 모바일 빌보드/스프라이트 폴백 필수 (REQ-645)
- [ ] ≥30fps, 오로라 먼저 저하, ≤1.5ms (REQ-630, REQ-650)
- [ ] F5+F6+F7 동시 활성 p95 프레임 게이트 통과
