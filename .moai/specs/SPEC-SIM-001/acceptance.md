---
id: SPEC-SIM-001
document: acceptance
version: "0.1.0"
status: implemented
created: "2026-07-03"
updated: "2026-07-05"
author: limbowl
tags: [three.js, solar-system, dwarf-planets, moons, rendering-quality, brownfield]
---

# SPEC-SIM-001: Acceptance Criteria — 태양계 콘텐츠 확장 및 렌더링 품질 개선

## AC-SIM-01: 왜소행성 렌더링 및 정보 (F1)

**Related Requirements**: REQ-010, REQ-020, REQ-030, REQ-060

```gherkin
Scenario: 5개 IAU 왜소행성이 모두 렌더링된다
  Given 웹사이트가 완전히 로드됨
  When 3D 씬이 표시됨
  Then Ceres, Pluto, Eris, Makemake, Haumea가 각각 구별되는 천체로 보여야 한다
  And Ceres는 화성과 목성 사이(소행성대 영역)에 나타나야 한다
  And Pluto, Eris, Makemake, Haumea는 해왕성 궤도 바깥에 나타나야 한다
  And IAU 5종을 넘어서는 어떤 소행성/TNO도 렌더링되지 않아야 한다
```

```gherkin
Scenario: 왜소행성 클릭 시 정보 패널이 표시된다
  Given 시뮬레이션이 실행 중
  When 사용자가 Pluto를 클릭함
  Then 슬라이드인 정보 패널이 나타나야 한다
  And 분류가 "Dwarf Planet"으로 표기되어야 한다
  And 지름, 거리, 공전 주기, 발견 연도가 표시되어야 한다
```

## AC-SIM-02: 왜소행성 궤도 정확도 (F1)

**Related Requirements**: REQ-040, REQ-050

```gherkin
Scenario: 명왕성의 이심 궤도가 반영된다
  Given 시뮬레이션이 재생 중
  When 여러 시뮬레이션 연도에 걸쳐 Pluto의 궤도를 관찰함
  Then 궤도 경로가 타원형이어야 하며, 원일점/근일점 거리비가 이심률 0.248에 상응해야 한다(비율 ≈ 1.66, 허용오차 ±5%)
  And 황도면 대비 경사각이 17도(±1도)로 측정되어야 한다
```

```gherkin
Scenario: Charon이 선택적으로 명왕성을 공전한다
  Given Charon 옵션이 구현된 경우
  When Pluto를 확대함
  Then Charon이 기존 위성 pivot 파이프라인으로 Pluto를 공전해야 한다
```

## AC-SIM-03: 목성/토성 위성 완성 (F2)

**Related Requirements**: REQ-110, REQ-120, REQ-130, REQ-140, REQ-150, REQ-160

```gherkin
Scenario: Callisto가 목성 갈릴레이 위성 세트를 완성한다
  Given 3D 씬이 렌더링됨
  When 사용자가 목성을 확대함
  Then Io, Europa, Ganymede, Callisto가 모두 목성을 공전하며 보여야 한다
```

```gherkin
Scenario: 토성의 둥근 위성 7종이 모두 존재한다
  Given 3D 씬이 렌더링됨
  When 사용자가 토성을 확대함
  Then Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus가 모두 보여야 한다
  And 토성 기본 줌 레벨에서 어떤 두 위성도 시각적으로 겹치지 않아야 한다
  And 기존 Mars/Uranus/Neptune 위성은 변경되지 않아야 한다
```

```gherkin
Scenario: 신규 위성 클릭 시 정보 패널이 표시된다 (REQ-130)
  Given 3D 씬이 렌더링됨
  When 사용자가 Callisto(또는 Mimas/Tethys/Dione/Iapetus)를 클릭함
  Then 기존 달/Phobos/Deimos와 동일한 InfoPanel 컴포넌트가 열려야 한다
  And 위성 이름과 모행성으로부터의 거리·공전 주기가 표시되어야 한다
```

```gherkin
Scenario: hero 위성만 선택적 경량 텍스처를 가진다 (REQ-150)
  Given hero 위성 텍스처가 구현된 경우
  When Titan(또는 Europa)을 확대함
  Then 해당 hero 위성은 flat-color 대신 경량 텍스처로 렌더링되어야 한다
  And 나머지 신규 위성(Callisto/Mimas/Tethys/Dione/Iapetus)은 flat-color 재질을 유지해야 한다
```

## AC-SIM-04: 안티에일리어싱 복구·톤 매핑·압축 텍스처 (F3)

**Related Requirements**: REQ-270, REQ-280, REQ-285, REQ-210, REQ-250, REQ-260

```gherkin
Scenario: 화면이 실제로 멀티샘플된다
  Given 확장 씬이 데스크탑 브라우저에 로드됨
  When 행성 가장자리(limb)를 확대 관찰함
  Then composer 렌더 타깃 samples가 4 이상이어야 한다 (측정 가능 프록시)
  And 동일 가장자리 픽셀의 대비 계단(aliasing step)이 AA 적용 전 대비 감소해야 한다
```

```gherkin
Scenario: 재질 relight로 주야 경계가 생긴다
  Given 씬이 렌더링됨
  When 태양 반대편을 향한 행성 면을 관찰함
  Then 야간면이 가시적으로 어두워야 한다(완전 검정 아님)
  And 태양과 별은 여전히 발광하여 밝게 보여야 한다
  And 렌더링 백엔드는 WebGL 렌더러를 유지해야 한다(WebGPU 아님)
```

```gherkin
Scenario: ACES 톤 매핑이 출력에 적용된다 (REQ-285)
  Given 씬이 렌더링됨
  When 최종 출력 파이프라인을 검사함
  Then 톤 매핑이 ACES 필름 방식으로 설정되어야 한다(NoToneMapping 아님)
  And bloom과 lit 표면이 flat이 아닌 HDR로 읽혀야 한다
```

```gherkin
Scenario: GPU 지원 시 압축 텍스처가 사용된다 (REQ-250)
  Given GPU가 KTX2/Basis 압축 텍스처를 지원하는 경우
  When hero 천체 텍스처가 로드됨
  Then 해당 텍스처는 JPEG 대신 KTX2/Basis로 적용되어야 한다
  And 미지원 GPU에서는 JPEG로 우아하게 폴백되어야 한다
```

## AC-SIM-05: LOD 및 텍스처 티어 (F3)

**Related Requirements**: REQ-220, REQ-290, REQ-255

```gherkin
Scenario: 초점 천체가 고해상도 텍스처를 지연 로드한다
  Given 씬이 2K 초기 페이로드로 로드됨
  When 사용자가 한 천체를 초점(선택/포커스)함
  Then 해당 천체의 4K/8K 텍스처가 지연 로드되어야 한다
  And 이 고해상도 텍스처는 초기 번들에 포함되지 않았어야 한다
```

```gherkin
Scenario: 거리 기반 LOD가 pop-in 없이 동작한다
  Given 씬이 렌더링됨
  When 카메라가 LOD 거리 임계값을 전진·후진으로 반복 가로지름
  Then 세그먼트 전환은 히스테리시스 밴드 내에서 임계값당 최대 1회만 발생해야 한다(진입/이탈 임계값 분리로 깜빡임 방지)
```

## AC-SIM-06: 성능 게이트 및 저사양 저하 (F3, NFR)

**Related Requirements**: REQ-210, REQ-230, REQ-240

```gherkin
Scenario: 확장 씬이 목표 프레임 레이트를 지속한다
  Given 확장 전체 씬(행성 + 왜소행성 + 위성 + 궤도선 + bloom)이 데스크탑에 로드됨
  When 시뮬레이션이 1x, 10x, 100x 각 속도로 60초씩 재생됨
  Then 각 속도의 임의의 롤링 60초 창에서 p95 프레임 타임이 25ms를 초과하지 않아야 한다
  And 기존 10-body 씬 대비 프레임 회귀가 없어야 한다
```

```gherkin
Scenario: 저사양 기기가 우아하게 저하된다
  Given hardwareConcurrency <= 4 기기
  When 씬이 로드됨
  Then 텍스처 해상도가 캡되고 LOD 업그레이드가 비활성화되어야 한다
  And 핵심 상호작용(클릭, 호버, 카메라 컨트롤)은 완전히 동작해야 한다
```

```gherkin
Scenario: 프레임 예산 초과 시 우선순위 저하가 적용된다
  Given 프레임 타임이 30 연속 프레임 예산을 초과함
  When 시스템이 저하를 적용함
  Then bloom 반경 → LOD 업그레이드 → 동적 픽셀 비율 순으로 낮아져야 한다
  And 카메라 컨트롤과 클릭/호버 피킹은 마지막까지 보존되어야 한다
```

---

## Performance Gate Criteria (NFR)

| 게이트 | 기준 | 통과 조건 |
|--------|------|-----------|
| 프레임 스무스니스 (데스크탑) | p95 프레임 타임, 롤링 60초, 1x–100x | ≤ 25ms |
| 프레임 스무스니스 (모바일) | p95 프레임 타임, 롤링 60초 | ≤ 50ms |
| 초기 로드 페이로드 | 초기 텍스처 총량 | ≤ 12MB (4K/8K 미포함) |
| 왜소행성 텍스처 | 개별 텍스처 크기 | ≤ 512KB (1K) |
| VRAM (데스크탑) | 디코드 텍스처 예산 | ≤ 256MB |
| VRAM (모바일) | 디코드 텍스처 예산 | ≤ 128MB |
| AA 검증 | composer 렌더 타깃 samples | ≥ 4 |
| 회귀 | 기존 8행성+달 씬 프레임 | 60fps(데스크탑)/30fps(모바일) 유지 |

---

## Edge Cases

- **왜소행성 궤도 클리핑**: 명왕성/에리스/하우메아/마케마케의 고이심/고경사 궤도가 500x에서 다른 천체·궤도선과 시각적으로 교차 — 최근접 시각 체크 필요.
- **Ceres 재배치 리스크**: 미래에 소행성 벨트 추가 시 Ceres 위치 재조정 필요(현재 충돌 아님, 플래그).
- **토성 위성 추가 z-fighting**: 4종 추가 시 7종 전체 간격 재검증(개별 추가 시 겹침).
- **LOD pop-in**: 세그먼트 전환 시 히스테리시스 미적용 시 가시적 점프.
- **relight 회귀**: 기존 밝은 룩이 사라지는 것은 의도이나, 신규 기능만 벤치하면 기존 씬 프레임 하락을 놓칠 수 있음.

---

## Definition of Done

- [ ] IAU 5개 왜소행성이 올바른 스케일 위치에 렌더링됨 (REQ-010, REQ-020)
- [ ] 왜소행성 클릭 시 "Dwarf Planet" 분류 포함 정보 패널 표시 (REQ-030)
- [ ] 왜소행성이 실 이심률/경사로 Keplerian 궤도 애니메이션 (REQ-040)
- [ ] Callisto + 토성 4위성 추가, 갈릴레이 4 / 토성 7 완성 (REQ-110, REQ-120)
- [ ] 신규 위성이 겹침 없이 pivot 파이프라인으로 공전 (REQ-140)
- [ ] 기존 Mars/Uranus/Neptune 위성 무변경 (REQ-160)
- [ ] composer 멀티샘플(samples:4) + SMAA로 AA 복구 (REQ-270)
- [ ] 행성/위성 relight, 태양/별 발광 유지, 주야 경계 발생 (REQ-280)
- [ ] ACES 톤 매핑 적용 (REQ-285)
- [ ] 거리 기반 LOD + 초점 시 4K/8K 지연 로드 (REQ-220, REQ-290)
- [ ] p95 프레임 타임 게이트 통과, 확장 씬 회귀 없음 (REQ-210, NFR)
- [ ] 저사양 저하 및 우선순위 저하 순서 동작 (REQ-230, REQ-240)
- [ ] WebGLRenderer 유지 (REQ-260)
