---
id: SPEC-EARTH-001
version: "0.1.1"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
priority: high
issue_number: 2
tags: [three.js, earth-view, view-manager, state-machine, hash-routing, brownfield]
depends_on: [SPEC-SIM-001]
---

## HISTORY

- 2026-07-03 (v0.1.1): plan-audit iteration 1 FAIL 대응. (1) REQ 순서 defect — REQ-355를 Event-Driven으로 이동(종료는 이벤트), REQ-330을 State-Driven으로 이동하여 State-Driven 블록을 330/350/360 오름차순으로 정렬(360 앞 355 역순 해소). (2) 선언 범위 "REQ-310~380"을 실제 집합 "REQ-310~385"로 정정. (3) EARS 키워드 정정 — REQ-330 WHEN→WHILE, REQ-350/360 IF→WHILE, REQ-370 비정규 "가능하면…할 수 있다" → "Where … 해야 한다". (4) REQ-315/385의 구현 클래스명(ViewManager/WebGLRenderer/EffectComposer/Scene·Camera/상태 enum)을 solution-neutral 서술로 대체(설계는 §4.1·plan.md). (5) REQ-330 "올바른 상대 궤도"를 측정 가능(27.32일 ±5%, 경사 5.14° ±0.5°)으로 구체화. (6) NFR fps와 acceptance p95 게이트를 양 문서에서 동일하게 병기(목표 fps + p95 프레임 타임).
- 2026-07-03 (v0.1.0): 최초 초안. Architect 기술 설계(`refactored-tumbling-barto-agent-a891797d8e48deffc.md` §2, §7)와 Analyst EARS 요구사항 초안(REQ-310~385)을 통합. F4(지구 상세 뷰 플랫폼) 단일 요구사항 모듈. Architect의 3-SPEC 분할에서 두 번째(아키텍처 척추) SPEC. SPEC-SIM-001의 조명 반응 재질 + 텍스처 티어 인프라에 의존.

---

# SPEC-EARTH-001: 지구 상세 뷰 플랫폼

## 1. Environment (환경)

### 1.1 개요

기존 단일 씬/카메라/렌더러/루프 구조를 **뷰/상태 계층으로 리팩터링**하여, 태양계 개요(SOLAR)와 지구 전용 상세 뷰(EARTH)를 오가는 `ViewManager` 상태 기계를 도입한다. 하나의 공유 렌더러+`EffectComposer`를 유지하되, 각 뷰는 자체 `Scene`/`Camera`/update 함수를 가진다. 이는 F5(항공기)·F6(일식/월식)·F7(오로라)이 얹힐 아키텍처 척추이다.

### 1.2 3-SPEC 의존성 체인 내 위치

본 SPEC은 3-SPEC 체인의 **두 번째** 이며 SPEC-SIM-001에 의존한다.

```
SPEC-SIM-001 (F1+F2+F3)  ── 선행. 조명 반응 재질 + 텍스처 티어 제공
      ▼
SPEC-EARTH-001 (본 SPEC, F4)  ── ViewManager 척추. EarthView 계약 정의
      │  (EarthView + HUD + 라이프사이클 계약 제공)
      ▼
SPEC-EARTH-002 (F5+F6+F7)  ── EarthView 마운트 포인트에 의존
```

- **의존 이유**: EarthView의 지구 리그(주야 경계, 구름 그림자, normal/specular)는 SPEC-SIM-001에서 도입된 `MeshStandardMaterial` 조명 반응 씬이 있어야 성립한다. 지구 4K 지연 로드는 SPEC-SIM-001의 텍스처 티어 로더를 재사용한다.
- **제공 계약**: 본 SPEC은 EarthView의 `mount/unmount/onEnter/onExit/update/getScenePass` 인터페이스와 EarthHUD 마운트 포인트, 모바일 dispose 라이프사이클을 확정하여 SPEC-EARTH-002의 세 시뮬레이션이 동결된 계약에 대해 병렬 구현될 수 있게 한다.

### 1.3 기술 스택 (변경 없음)

Three.js r175 `WebGLRenderer` 단일 컨텍스트 유지. 뷰 전환은 별도 WebGL 컨텍스트 생성 없이 **렌더러 공유**로 구현한다(2 컨텍스트는 낭비이며 컨텍스트 로스 리스크). 라우팅은 hash 기반(`#/earth`)으로 GitHub Pages 서버 rewrite 불필요.

### 1.4 브라운필드 사실 (F4에서 반드시 리팩터링됨)

| 위치 | 기존 가정 | F4에서 깨지는 지점 | DELTA |
|------|-----------|-------------------|-------|
| `main.js:14,34,145` | SceneManager 1개, factory 1개, RAF 루프 1개 | 루프가 뷰-디스패치로 변경 | [MODIFY] |
| `main.js:22-31` | `window.__solarSim` 전역이 모든 상태 보유 | 뷰/ViewManager 스코프로 이동(전이기 shim) | [MODIFY] |
| `main.js:57-81` | `selectPlanet`이 카메라 초점만 | 지구 선택은 *뷰 전환* 이어야 함 | [MODIFY] |
| `SceneManager.js:44-50` | 단일 카메라, `far:100000`(`constants.js:13`) | EarthView는 자체 near/far/프레임 필요 | [MODIFY] |
| `constants.js:17-22` CONTROLS_DEFAULTS | 단일 min/max 거리 체제 | EarthView 컨트롤은 지구-로컬 한계 | [MODIFY] |
| `InteractionManager`(`main.js:92`) | 태양계 factory 위에 1회 구성 | EarthView는 자체 피킹 또는 없음 | [MODIFY] |
| `SceneManager.js` starfield/스카이 | 공유 씬의 r=10000 별구 | EarthView는 자체(또는 뷰 무관 공유) 하늘 | [MODIFY] |
| **WebGL 컨텍스트 로스 처리 없음** (grep 확인) | `webglcontextlost/restored` 핸들러 부재 | 무거운 결합 씬은 로스 확률↑ → F4에서 설계 | [NEW] |

---

## 2. Assumptions (가정)

- **A-301**: SPEC-SIM-001이 선행 완료되어 행성/위성이 `MeshStandardMaterial`로 조명 반응하며, 텍스처 티어 로더가 존재한다.
- **A-302**: 기존 카메라 초점 기능(commit `fc5855f`)은 카메라 dolly일 뿐 별도 씬/뷰가 아닐 수 있다 → F4의 "전용 뷰"는 초점 인프라 재사용이 시사하는 것보다 큰 작업이며, Run phase 추정 전 확인 필요(Analyst edge case).
- **A-303**: hash 라우팅(`#/`, `#/earth`)은 Vite `base:'/solar-simulator/'`에 영향받지 않으며 서버 rewrite가 불필요하다.
- **A-304**: 태양계 씬(7MB)은 데스크탑에서 EARTH 상태 동안 상주 유지가 가능하다(저렴). 모바일은 dispose로 VRAM 회수한다.
- **A-305**: 지구 뷰는 지오로케이션·추가 권한/데이터 없이 모든 사용자에게 동일하게 동작한다.

---

## 3. Requirements (요구사항 — EARS)

요구사항 모듈 1개(F4). REQ-310~385.

### 3.1 F4 — 지구 상세 뷰 (Dedicated Earth View)

**Ubiquitous (필수)**
- **REQ-310**: 시스템은 **항상** 기본 개요 씬과 구별되는 전용 지구 시뮬레이션 뷰를 제공하되, 오직 명시적 지구 선택으로만 진입 가능해야 한다.
- **REQ-315**: 시스템은 **항상** 단일 공유 렌더링 컨텍스트(하나의 렌더러와 하나의 포스트프로세싱 파이프라인)를 통해 모든 뷰를 렌더링하고, 개요 뷰와 지구 뷰 사이 전환을 명시적 상태 전이(개요 / 지구-전환-중 / 지구 / 개요-전환-중)로 통치해야 한다. 각 뷰는 자체 씬·카메라·업데이트 루프를 가진다. (컴포넌트/클래스 설계: §4.1, plan.md)

**Event-Driven (이벤트 기반)**
- **REQ-320**: **WHEN** 사용자가 지구를 선택하면 **THEN** 시스템은 400ms 페이드 전환으로 전용 지구 뷰로 전이하되, 확립된 2초 전환 예산(SPEC-UI-001 AC-002) 내에 완료해야 한다.
- **REQ-325**: **WHEN** URL hash가 `#/earth`로 변경되면(직접 링크/브라우저 뒤로가기 포함) **THEN** 시스템은 클릭과 동일한 뷰 전환을 구동해야 한다(`#/` → 개요 뷰, `#/earth` → 지구 뷰).
- **REQ-340**: **WHEN** 사용자가 지구 뷰를 종료하면(닫기 컨트롤, Escape 키, 다른 천체 선택) **THEN** 시스템은 이전 개요 위치로 카메라를 복귀시키고 지구 뷰 전용 UI 오버레이를 제거해야 한다(SPEC-UI-001 AC-002 정합).
- **REQ-355**: **WHEN** 사용자가 지구 뷰를 종료하면(어느 플랫폼이든) **THEN** F5 폴링은 반드시 중단되어야 하며, 모바일에서는 지구 뷰의 지오메트리·재질·텍스처·렌더 타깃을 해제(dispose)하여 VRAM을 회수해야 한다.

**State-Driven (상태 기반)**
- **REQ-330**: **WHILE** 지구 뷰가 활성인 동안, 시스템은 표준 정보 패널보다 풍부한 정보를 표시해야 한다: 실시간 주야 경계(terminator, 기존 daymap/nightmap + 태양 상대 회전), 구름 레이어(기존 텍스처), 달의 상대 궤도(공전 주기 27.32일 ±5%, 궤도 경사 5.14° ±0.5°).
- **REQ-350**: **WHILE** 지구 뷰가 활성이고 항공기 위치 레이어(F5, SPEC-EARTH-002)가 사용 가능한 동안, 시스템은 지구 모델 위에 항공기 마커를 오버레이해야 한다(본 SPEC은 마운트 포인트만 제공, 구현은 SPEC-EARTH-002).
- **REQ-360**: **WHILE** 지구 뷰가 활성인 동안, 일식/월식(F6)·오로라(F7) 효과는 트리거 조건 충족 시 이 뷰 내에서 렌더링되어야 한다(본 SPEC은 마운트 포인트만 제공).

**Optional (선택적)**
- **REQ-370**: **Where** 보조 레이어가 포함되는 경우, 시스템은 야간면 도시 불빛과 단순 대기 rim-glow를 지구 뷰에 렌더링**해야 한다**.

**Unwanted (금지)**
- **REQ-380**: 시스템은 지구 뷰 표시를 위해 지오로케이션이나 추가 사용자 권한/데이터를 요구하지 **않아야 한다**. 동작은 위치와 무관하게 모든 사용자에게 동일해야 한다.
- **REQ-385**: 시스템은 지구 뷰 활성 중 두 번째 WebGL 렌더링 컨텍스트를 생성하지 **않아야 한다**(단일 공유 컨텍스트 유지).

---

## 4. Solution (해결 방안)

### 4.1 ViewManager 상태 기계

```
        selectPlanet('earth') / hashchange #/earth
  ┌──────────────────┐  ───────────────────────►  ┌─────────────┐
  │ SolarSystemView  │        (TO_EARTH)           │  EarthView  │
  │ (기존 앱 래핑)    │  ◄───────────────────────   │             │
  └──────────────────┘   back/Esc/#/  (TO_SOLAR)   └─────────────┘
States: SOLAR, TO_EARTH(전환중), EARTH, TO_SOLAR(전환중)
```

- **`ViewManager`** (`[NEW]` `src/core/ViewManager.js`): 공유 렌더러+composer, 활성 뷰, hash 라우팅, 전환 오케스트레이션, DOM UI 마운트를 소유. `main.js:145`의 god-loop를 대체. 활성 뷰의 `update(dt)`만 실행, 활성 `(scene, camera)`만 렌더.
- **`SolarSystemView`** (`[NEW]` `src/views/SolarSystemView.js`): 기존 배선(PlanetFactory, InteractionManager, InfoPanel, PlanetList, TimeControls, `main.js:57-142` 초점/해제 로직)을 View 인터페이스 뒤로 이동. 태양계 씬은 상주하나 EARTH 상태에서 `update()` 스킵(궤도 정지 허용, 또는 저렴하게 틱 유지).
- **`EarthView`** (`[NEW]` `src/earth/EarthView.js`): 자체 `Scene`, 지구-로컬 near/far의 `PerspectiveCamera`, 고상세 지구 리그, 자체 HUD, F5/F6/F7 마운트 포인트.

### 4.2 View 인터페이스 계약 (동결)

`mount(renderer, composer)` · `unmount()` · `onEnter(fromState)` · `onExit()` · `update(dtSeconds)` · `getScenePass()` → composer RenderPass용 `{scene, camera}`.

### 4.3 전환 애니메이션

전화면 DOM 오버레이 크로스페이드(`<div>` ~400ms 블랙 페이드), 불투명 중점에서 활성 뷰 스왑, 페이드 백. 추가 렌더 타깃 0, 모바일 동일 동작. 기존 ease-out-cubic 트윈 스타일(`SceneManager.start()`) 재사용. 선택 업그레이드: 태양 뷰에서 지구로 dolly 후 불투명 프레임에서 EarthView 핸드오프(연속 줌으로 읽힘).

### 4.4 자산 라이프사이클

- **태양계 씬**: 상주 유지(7MB). EARTH 상태에서 `update()` 일시정지.
- **EarthView**: 첫 진입 시 지연 빌드(사용자가 지구를 안 누르면 비용 0). 무거운 자산(4K/8K day/night/normal/specular, 구름, 오로라 셰이더, 항공기 InstancedMesh)은 첫 `onEnter`에 빌드.
- **종료 시**: 데스크탑 → EarthView 유지(즉시 재진입). 모바일(`SceneManager.js:115` navigator 체크) → `dispose()`로 VRAM 회수. F5 폴링은 플랫폼 무관 중단.

### 4.5 지구 리그 (EarthRig)

- `[NEW]` `src/earth/EarthRig.js`: 고상세 지구 — day↔night 블렌드(터미네이터), normal/bump(지형 기복), specular(해양 광택/육지 무광), 구름 레이어(부드러운 그림자), 대기 rim-glow(선택 REQ-370). 기존 미사용 `2k_earth_nightmap.jpg`(`constants.js:35`) 활용.

### 4.6 EarthHUD

- `[NEW]` `src/earth/EarthHUD.js`: 풍부한 정보 밀도(sub-solar point, 터미네이터 시각, 선택 항공기, 일식 컨트롤, 오로라 토글) + 상시 "← Solar System" 뒤로가기 버튼. `PlanetList`/`TimeControls`/`InfoPanel`은 SolarSystemView 소유이며 EARTH 상태에서 숨김/분리.

### 4.7 WebGL 컨텍스트 로스 처리 (신규 — 부재하던 갭)

`[NEW]` `webglcontextlost`/`webglcontextrestored` 핸들러. 무거운 결합 씬은 제약 기기에서 로스 확률↑. 복원 시 텍스처/지오메트리 재로드 동작을 F4 일부로 설계.

---

## 5. Non-Functional Requirements (NFR)

| 범주 | 요구 |
|------|------|
| 전환 예산 | 지구 진입/종료 전환 400ms 페이드, 2초 이내 완료(AC-002 상속). |
| 초기 로드 | 지구 4K/8K 텍스처는 **지구 뷰 진입 시에만** 지연 로드, 초기 로드에 미계상(대부분 사용자가 지구를 안 누를 수 있음). |
| VRAM | 모바일 종료 시 EarthView dispose로 ≤128MB 유지(SPEC-SIM-001 NFR 상속). |
| 접근성 | WCAG 2.1 AA 베이스라인. Enter/Space로 진입, Escape로 종료. `prefers-reduced-motion` 시 전환 이징/장식 애니메이션 비활성. |
| 프레임 | 지구 뷰 활성 시 목표 60fps(데스크탑)/30fps(모바일); 회귀 게이트는 p95 프레임 타임 ≤ 25ms(데스크탑)/≤ 50ms(모바일)로 측정(SPEC-SIM-001 NFR 상속, 양 문서 동일 기준). |

---

## 6. Exclusions (What NOT to Build)

- **F5/F6/F7 구현 없음**: 항공기·일식/월식·오로라 실제 구현은 SPEC-EARTH-002. 본 SPEC은 EarthView 내 **마운트 포인트와 HUD 훅**만 제공한다(REQ-350, REQ-360).
- **두 번째 WebGL 컨텍스트 없음**: 두 `SceneManager` 인스턴스로 렌더러를 이중 생성하지 않는다. 렌더러 공유 필수(REQ-385).
- **지오로케이션/사용자 권한 없음**: 위치·권한·개인 데이터를 요구하지 않는다(REQ-380).
- **엔진 교체·물리 스케일 없음**: WebGLRenderer 유지(SPEC-SIM-001 상속). EarthView는 로컬 스케일을 도입하나 태양계는 상징적 스케일 유지.
- **서버 사이드 라우팅 없음**: hash 라우팅만 사용(GitHub Pages 정적 제약).
- **왜소행성/위성/렌더링 품질 재작업 없음**: SPEC-SIM-001 범위이며 본 SPEC에서 중복하지 않는다.

---

## 7. Traceability (추적성)

| 요구사항 | Solution 참조 | Acceptance |
|----------|--------------|------------|
| REQ-310, REQ-315, REQ-385 | §4.1, §4.2 | AC-EARTH-01 |
| REQ-320, REQ-325 | §4.1, §4.3 | AC-EARTH-02 |
| REQ-330 | §4.5, §4.6 | AC-EARTH-03 |
| REQ-340, REQ-355 | §4.4, §4.6 | AC-EARTH-04 |
| REQ-350, REQ-360 | §4.1 (마운트 포인트) | AC-EARTH-05 |
| REQ-370 | §4.5 | AC-EARTH-03 |
| REQ-380 | §2 (A-305) | AC-EARTH-06 |

---

## 8. Expert Consultation

| 도메인 | 에이전트 | 사유 |
|--------|---------|------|
| Frontend 3D | expert-frontend | ViewManager 상태 기계, 렌더러 공유, 지구 리그 셰이딩, hash 라우팅, WebGL 컨텍스트 로스 |
| Performance | expert-performance | 모바일 dispose 라이프사이클, VRAM 회수, 전환 프레임 예산 |
