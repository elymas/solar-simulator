---
id: SPEC-EARTH-001
document: acceptance
version: "0.1.1"
status: implemented
created: "2026-07-03"
updated: "2026-07-05"
author: limbowl
tags: [three.js, earth-view, view-manager, state-machine, hash-routing, brownfield]
depends_on: [SPEC-SIM-001]
---

# SPEC-EARTH-001: Acceptance Criteria — 지구 상세 뷰 플랫폼

## AC-EARTH-01: ViewManager 상태 기계 및 렌더러 공유 (F4)

**Related Requirements**: REQ-310, REQ-315, REQ-385

```gherkin
Scenario: 전용 지구 뷰가 명시적 선택으로만 진입된다
  Given 개요 씬(SOLAR 상태)에서 시뮬레이션 실행 중
  When 사용자가 지구를 선택하지 않음
  Then 지구 전용 뷰는 활성화되지 않아야 한다
  And 오직 명시적 지구 선택으로만 EARTH 상태에 진입해야 한다
```

```gherkin
Scenario: 단일 WebGL 컨텍스트가 뷰 간 공유된다
  Given ViewManager가 초기화됨
  When SOLAR와 EARTH 상태를 오감
  Then 하나의 WebGLRenderer + EffectComposer만 존재해야 한다
  And 두 번째 WebGL 컨텍스트가 생성되지 않아야 한다
  And 활성 뷰의 (scene, camera)만 렌더링되어야 한다
```

## AC-EARTH-02: 뷰 전환 및 hash 라우팅 (F4)

**Related Requirements**: REQ-320, REQ-325

```gherkin
Scenario: 지구 선택 시 전용 뷰가 열린다
  Given 개요 씬에서 실행 중
  When 사용자가 지구를 클릭함
  Then 400ms 페이드 전환으로 EARTH 상태로 전이해야 한다
  And 전환은 2초 이내에 완료되어야 한다
  And URL hash가 #/earth로 변경되어야 한다
```

```gherkin
Scenario: hash 및 브라우저 뒤로가기가 뷰를 구동한다
  Given 사용자가 #/earth로 직접 진입함
  When 페이지가 로드됨
  Then 시스템은 EARTH 상태로 전이해야 한다
  When 사용자가 브라우저 뒤로가기를 누름
  Then hash가 #/로 변경되고 SOLAR 상태로 복귀해야 한다
```

## AC-EARTH-03: 풍부한 지구 정보 밀도 (F4)

**Related Requirements**: REQ-330, REQ-370

```gherkin
Scenario: 지구 뷰가 실시간 주야 경계와 구름을 표시한다
  Given EARTH 상태가 활성
  When 지구 뷰가 렌더링됨
  Then 실시간 주야 경계(terminator)가 태양 상대 회전으로 표시되어야 한다
  And 구름 레이어가 표시되어야 한다
  And 달이 상대 공전 주기 27.32일(±5%)·궤도 경사 5.14°(±0.5°)로 지구를 공전해야 한다
  And EarthHUD가 sub-solar point / 터미네이터 시각을 표시해야 한다
```

```gherkin
Scenario: 선택적 보조 레이어 (도시 불빛, rim-glow)
  Given REQ-370 보조 레이어가 구현된 경우
  When 지구 야간면이 보임
  Then 야간면 도시 불빛과 대기 rim-glow가 렌더링되어야 한다
```

## AC-EARTH-04: 종료 및 라이프사이클 (F4)

**Related Requirements**: REQ-340, REQ-355

```gherkin
Scenario: 지구 뷰 종료가 개요로 복귀한다
  Given EARTH 상태가 활성
  When 사용자가 Escape 키를 누름 (또는 뒤로가기 버튼/다른 천체 선택)
  Then 카메라가 이전 개요 위치로 복귀해야 한다
  And 지구 뷰 전용 UI 오버레이가 제거되어야 한다
  And hash가 #/로 복귀해야 한다
```

```gherkin
Scenario: 모바일 종료 시 EarthView가 dispose된다
  Given 모바일 기기에서 EARTH 상태 활성
  When 사용자가 지구 뷰를 종료함
  Then EarthView 지오메트리/재질/텍스처/렌더타깃이 dispose되어야 한다
  And F5 폴링(존재 시)이 플랫폼 무관하게 중단되어야 한다
  And VRAM이 회수되어야 한다
```

## AC-EARTH-05: F5/F6/F7 마운트 포인트 (F4 계약)

**Related Requirements**: REQ-350, REQ-360

```gherkin
Scenario: EarthView가 하위 시뮬레이션 마운트 포인트를 제공한다
  Given EARTH 상태가 활성
  When 항공기 레이어(F5) 또는 일식(F6)/오로라(F7) 효과가 사용 가능
  Then EarthView는 이들이 얹힐 마운트 포인트와 HUD 훅을 노출해야 한다
  And View 인터페이스(mount/unmount/onEnter/onExit/update/getScenePass)가 동결되어 SPEC-EARTH-002가 병렬 구현 가능해야 한다
```

## AC-EARTH-06: 권한 없음 (F4)

**Related Requirements**: REQ-380

```gherkin
Scenario: 지구 뷰가 지오로케이션을 요구하지 않는다
  Given 임의 위치의 사용자
  When 지구 뷰에 진입함
  Then 지오로케이션이나 추가 권한/데이터가 요구되지 않아야 한다
  And 동작은 모든 사용자에게 위치와 무관하게 동일해야 한다
```

---

## Performance Gate Criteria (NFR)

| 게이트 | 기준 | 통과 조건 |
|--------|------|-----------|
| 전환 예산 | 지구 진입/종료 전환 완료 시간 | ≤ 2초 (페이드 400ms) |
| 초기 로드 | 지구 4K/8K 텍스처 계상 | 초기 로드 미포함, 진입 시 지연 로드 |
| VRAM (모바일) | 종료 후 dispose 회수 | ≤ 128MB 유지 |
| 프레임 (데스크탑) | 지구 뷰 활성 목표 60fps, 회귀 게이트 p95 프레임 타임 | ≤ 25ms |
| 프레임 (모바일) | 지구 뷰 활성 목표 30fps, 회귀 게이트 p95 프레임 타임 | ≤ 50ms |
| 접근성 | WCAG 2.1 AA, 키보드 진입/종료, prefers-reduced-motion | 전환 이징 비활성 동작 |
| 컨텍스트 로스 | webglcontextlost 후 복원 | 검은 화면 없이 재로드 |

---

## Edge Cases

- **카메라 초점 오해**: 기존 초점(fc5855f)이 dolly일 뿐이면 "전용 뷰"는 더 큰 작업 — Run 추정 전 확인.
- **WebGL 컨텍스트 로스**: 무거운 결합 씬은 제약 기기에서 로스 확률↑, 핸들러 부재 → 검은 화면. 복원 재로드 필수.
- **전역→스코프 전이**: `window.__solarSim` 참조가 남으면 이중 진실원. shim은 전이기만.
- **hash 딥링크**: `#/earth`로 첫 로드 시 태양계 씬 준비 전 진입 → 로드 순서 처리.
- **모바일 재진입**: dispose 후 재진입 시 지연 빌드 재실행 — 첫 프레임 스톨 가능.

---

## Definition of Done

- [ ] ViewManager 상태 기계(SOLAR/TO_EARTH/EARTH/TO_SOLAR) 동작 (REQ-315)
- [ ] 단일 렌더러+composer 공유, 2컨텍스트 없음 (REQ-315, REQ-385)
- [ ] 지구 선택 시 400ms 페이드 전환, 2초 이내 (REQ-320)
- [ ] hash 라우팅(#/, #/earth) + 브라우저 뒤로가기 (REQ-325)
- [ ] 실시간 터미네이터 + 구름 + 상대 궤도 달 + 풍부한 HUD (REQ-330)
- [ ] Escape/back/다른 천체 선택 종료 → 개요 복귀 (REQ-340)
- [ ] 모바일 종료 dispose + F5 폴링 중단 훅 (REQ-355)
- [ ] F5/F6/F7 마운트 포인트 + View 인터페이스 동결 (REQ-350, REQ-360)
- [ ] 지오로케이션/권한 없음 (REQ-380)
- [ ] WebGL 컨텍스트 로스/복원 핸들러
- [ ] SPEC-SIM-001 조명 반응 재질 + 텍스처 티어 재사용 확인
