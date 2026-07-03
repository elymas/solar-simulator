---
id: SPEC-SIM-001
version: "0.1.1"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
priority: high
issue_number: 1
tags: [three.js, solar-system, dwarf-planets, moons, rendering-quality, brownfield]
---

## HISTORY

- 2026-07-03 (v0.1.1): plan-audit iteration 1 FAIL 대응. (1) REQ-260-A 번호 충돌 제거 — 이방성 요구를 REQ-255로 재배정(접미사 hack 제거). (2) ACES 톤 매핑 REQ-285 신설(무 근거 커밋 defect 해소), acceptance DoD 추적을 REQ-285로 수정. (3) State-Driven REQ-040/REQ-140/REQ-240을 IF/THEN → WHILE로 재작성. (4) Optional REQ-050/REQ-150/REQ-250/REQ-255를 EARS "Where … 해야 한다" 정규형으로 재작성(비정규 "가능하면/할 수 있다" 제거). (5) REQ-240 저하 래더의 오로라·일식 단계 제거(본 SPEC Exclusions와의 모순 해소) — 본 SPEC 범위는 bloom→LOD→픽셀비율, cross-SPEC 순서는 주석화. (6) REQ 텍스트의 API-레벨 구현 식별자를 §4.3로 이동. (7) acceptance에 REQ-130/150/250 검증 시나리오 및 측정 가능 프록시 추가.
- 2026-07-03 (v0.1.0): 최초 초안. Architect 기술 설계(`refactored-tumbling-barto-agent-a891797d8e48deffc.md`)와 Analyst EARS 요구사항 초안(`refactored-tumbling-barto-agent-a0fc21d5a14ba1ac3.md`)을 통합하여 작성. F1(왜소행성) + F2(목성/토성 위성) + F3(렌더링 품질) 3개 요구사항 모듈로 구성. Architect의 3-SPEC 분할(SPEC-SIM-001 → SPEC-EARTH-001 → SPEC-EARTH-002)을 따름.

---

# SPEC-SIM-001: 태양계 콘텐츠 확장 및 렌더링 품질 개선

## 1. Environment (환경)

### 1.1 프로젝트 개요

기존 SPEC-UI-001로 구축된 GitHub Pages 정적 3D 태양계 시뮬레이션(`elymas.github.io/solar-simulator`)의 **브라운필드 확장** SPEC이다. 기존 단일 씬/카메라/렌더러 구조를 그대로 유지하면서, 왜소행성 5종·신규 위성 5종을 추가하고, 사장(dead)되어 있던 안티에일리어싱을 복구하며, 무광(unlit) 재질을 조명 반응 재질로 이관하여 렌더링 품질을 끌어올린다.

### 1.2 3-SPEC 의존성 체인 내 위치

본 SPEC은 3-SPEC 확장 체인의 **첫 번째(루트)** 이며 선행 의존성이 없다.

```
SPEC-SIM-001 (본 SPEC, F1+F2+F3)  ── 선행 의존성 없음, 최우선 구현
      │  (조명 반응 재질 + 텍스처 티어 인프라 제공)
      ▼
SPEC-EARTH-001 (F4)  ── SPEC-SIM-001에 의존
      │
      ▼
SPEC-EARTH-002 (F5+F6+F7)  ── SPEC-EARTH-001(+ SPEC-SIM-001 전이) 에 의존
```

- F3의 `MeshBasicMaterial → MeshStandardMaterial` 이관(relight)은 SPEC-EARTH-002의 일식/월식 그림자(F6)와 오로라 야간면 발광(F7)의 **하드 선행 조건**이다. 따라서 본 SPEC에서 조명 반응 씬을 먼저 검증한 뒤 하위 SPEC이 이를 상속한다.
- 텍스처 티어(2K 기본 + 초점 시 지연 로드) 인프라도 본 SPEC에서 도입되어 SPEC-EARTH-001의 지구 4K 지연 로드가 재사용한다.

### 1.3 기술 스택 (변경 없음 — 엔진 교체 반려)

| 구성 요소 | 기술 | 비고 |
|-----------|------|------|
| 3D 엔진 | Three.js r175 (`WebGLRenderer`) | 유지. WebGPU / react-three-fiber / Babylon / Cesium 전부 반려 (Solution §4.4) |
| 후처리 | `EffectComposer` + `UnrealBloomPass` + `SMAAPass` + `OutputPass` | SMAA 추가 (FXAA/TAA 대신 — 궤도 운동 중 TAA 재투영 고스팅 회피) |
| 안티에일리어싱 | multisampled composer target (`samples: 4`) | 현재 사장된 AA 복구 |
| 재질 | `MeshStandardMaterial` (행성/위성), `MeshBasicMaterial`(태양/별 — 발광 광원) | relight |
| 톤 매핑 | `ACESFilmicToneMapping` | 현재 `NoToneMapping`에서 변경 |
| 텍스처 소스 | Solar System Scope (CC BY 4.0), USGS Astrogeology (public domain) | research.md 참조 |
| 궤도 데이터 | NASA JPL SSD 정적 테이블 (오프라인) | 런타임 API 없음 |

### 1.4 브라운필드 사실 (구현이 반드시 반영해야 함)

- **모든 천체가 `MeshBasicMaterial`(무광)** 을 사용한다: `PlanetFactory.js:127`(행성), `:160`(구름), `:182/:186`(위성), `:219`(고리), `:272`(별), `:75`(태양). `PointLight`(`SceneManager.js:71`)와 `AmbientLight`(`:68`)는 어떤 행성에도 기여하지 않는다. [DELTA] 브라운필드 relight 대상.
- **AA는 사장 상태**: `EffectComposer` 기본 타깃의 `samples`가 0이고, 렌더러 `antialias: true`(`SceneManager.js:31`)는 사용되지 않는 기본 프레임버퍼에만 적용된다. 모든 출력은 `composer.render()`(`:229`)를 거치므로 화면은 현재 멀티샘플되지 않는다.
- **위성은 pivot-Group 패턴**(`PlanetFactory.js:177-207` 생성, `:337-354` 갱신)을 사용한다 — 신규 위성 5종의 참조 구현.
- **스케일은 상징적**: `displayRadius`/`distanceDisplay`가 물리값이 아닌 수작업 튜닝값이다(해왕성 850 units). 해왕성 바깥 왜소행성은 `distanceDisplay > 850`과 카메라 `maxDistance`(현재 `constants.js:21` = 5000) 조정이 필요하다.
- `OrbitalMechanics.calculatePosition`(`OrbitalMechanics.js:19`)은 승교점 경도(Ω)와 근일점 인수(ω)를 생략한다 → 명왕성/에리스는 도식적으로 보인다(알려진 한계로 명시).
- 현재 텍스처 총량 7.0MB(2K JPG).

---

## 2. Assumptions (가정)

- **A-101**: IAU가 공식 인정한 5개 왜소행성(Ceres, Pluto, Eris, Makemake, Haumea) 목록은 안정적이고 명확한 범위 경계 기준이다.
- **A-102**: Io/Europa/Ganymede(목성)와 Titan/Enceladus/Rhea(토성)는 이미 `planetData.js:187-274`에 존재하고 렌더된다. 따라서 F2의 실제 신규 작업은 5종(Callisto + Mimas/Tethys/Dione/Iapetus)뿐이다.
- **A-103**: 기존 Mars/Uranus/Neptune 위성은 본 SPEC의 변경 범위 밖이며 건드리지 않는다.
- **A-104**: WebGL2(멀티샘플 렌더 타깃)는 대상 브라우저(SPEC-UI-001 §1.4)에서 보편 지원된다.
- **A-105**: `MeshStandardMaterial` 이관 시 야간면이 어두워지는 것은 의도된 결과이며, `AmbientLight` 튜닝으로 "완전 검정"이 아닌 "가시적으로 어두움"을 보장할 수 있다.
- **A-106**: 왜소행성 텍스처는 Solar System Scope(Ceres·Eris·Makemake·Haumea)와 USGS(Pluto)에서 확보 가능하며, USGS 모자이크는 포맷 변환이 필요하다.
- **A-107**: 신규 위성은 기존 위성과 동일한 flat-color 재질(텍스처 페이로드 0)로 렌더하는 것이 충분하다.

---

## 3. Requirements (요구사항 — EARS)

요구사항 모듈은 3개(F1, F2, F3)이며 각 100 단위 블록으로 그룹화한다(Analyst 초안 번호 체계 유지).

### 3.1 F1 — 왜소행성 (Dwarf Planets)

**Ubiquitous (필수)**
- **REQ-010**: 시스템은 **항상** IAU 공인 5개 왜소행성(Ceres, Pluto, Eris, Makemake, Haumea)을 각각 구별되는 3D 천체로 렌더링해야 한다.
- **REQ-020**: 시스템은 **항상** Ceres를 소행성대 영역(~2.77 AU 스케일, 화성 300 ~ 목성 450 units 사이)에, 나머지 4개 해왕성 바깥 천체(TNO)를 해왕성 궤도(850 units) 바깥의 스케일된 평균 거리에 배치해야 한다.

**Event-Driven (이벤트 기반)**
- **REQ-030**: **WHEN** 사용자가 왜소행성을 클릭하면 **THEN** 시스템은 기존 InfoPanel 컴포넌트를 재사용하여 물리 데이터(지름, 거리, 공전 주기, 발견 연도, "Dwarf Planet" 분류 표기)를 표시해야 한다.

**State-Driven (상태 기반)**
- **REQ-040**: **WHILE** 시뮬레이션이 재생 중인 동안, 왜소행성은 기존 궤도 역학 모듈로 Keplerian 궤도를 따라 애니메이션되어야 하며, 각 천체의 실제 이심률·경사를(특히 명왕성 이심률 0.248 / 경사 17°) 원형으로 단순화하지 않고 반영해야 한다.

**Optional (선택적)**
- **REQ-050**: **Where** Charon 렌더링이 포함되는 경우, 시스템은 기존 위성 렌더링 파이프라인(pivot-Group)으로 명왕성의 위성 Charon을 궤도 위성으로 렌더링**해야 한다**.

**Unwanted (금지)**
- **REQ-060**: 시스템은 IAU 5개 왜소행성을 제외한 어떤 TNO·소행성·미소행성체도 렌더링하지 **않아야 한다**.

### 3.2 F2 — 목성/토성 주요 위성 (Major Moons)

**Ubiquitous (필수)**
- **REQ-110**: 시스템은 **항상** 기존 Io/Europa/Ganymede에 더해 Callisto를 네 번째 목성 위성으로 렌더링하여 갈릴레이 위성 4종을 완성해야 한다.
- **REQ-120**: 시스템은 **항상** 기존 Titan/Enceladus/Rhea에 더해 Mimas, Tethys, Dione, Iapetus를 추가 토성 위성으로 렌더링하여 토성의 유체정역학 평형(둥근) 위성 7종을 완성해야 한다.

**Event-Driven (이벤트 기반)**
- **REQ-130**: **WHEN** 사용자가 목성/토성 주요 위성을 클릭하면 **THEN** 시스템은 기존 달·Phobos·Deimos에 사용하는 것과 동일한 패턴으로 InfoPanel을 표시해야 한다.

**State-Driven (상태 기반)**
- **REQ-140**: **WHILE** 시뮬레이션이 재생 중인 동안, 각 신규 위성은 기존 위성 궤도 스키마(공전 주기, 이심률, 모행성으로부터의 거리)를 따르는 궤도 데이터로 모행성을 공전해야 한다. (스키마 필드명: §4.2)

**Optional (선택적)**
- **REQ-150**: **Where** hero 위성(예: Titan, Europa)의 시각적 정체성이 경량 텍스처를 요구하는 경우, 시스템은 flat-color 재질 대신 해당 경량 텍스처를 적용**해야 한다**. 그 외 위성에는 요구되지 않는다.

**Unwanted (금지)**
- **REQ-160**: 시스템은 본 기능의 일부로 목성·토성 외 천체의 위성을 추가하지 **않아야 한다**. 이미 배포된 Mars/Uranus/Neptune 위성은 변경 범위 밖이다.

### 3.3 F3 — 부드러움·해상도·성능 (Rendering Quality)

**Ubiquitous (필수)**
- **REQ-210**: 시스템은 **항상** 확장된 전체 씬(행성 + 왜소행성 + 주요 위성 + 궤도선 + bloom 동시 활성)에서 Section 5의 프레임 타임 기준(NFR)을 충족해야 한다.
- **REQ-220**: 시스템은 **항상** 구(sphere) 지오메트리에 거리 기반 LOD를 적용하여 카메라에 근접한 천체만 증가된 세그먼트 수로 렌더링해야 한다.
- **REQ-270**: 시스템은 **항상** 멀티샘플 렌더 타깃과 SMAA 안티에일리어싱을 적용하여, 현재 사장된 안티에일리어싱을 실제 화면 출력에 반영해야 한다. (구현 세부: §4.3)
- **REQ-280**: 시스템은 **항상** 행성/위성 표면을 조명 반응(lit) 재질로 렌더링하되, 태양과 별은 발광(emissive) 광원으로 유지해야 한다. (재질 매핑: §4.3)
- **REQ-285**: 시스템은 **항상** ACES 필름 톤 매핑으로 최종 출력을 톤 매핑해야 한다. (구현: §4.3)

**Event-Driven (이벤트 기반)**
- **REQ-230**: **WHEN** 기기가 저사양으로 분류되면 **THEN** 시스템은 텍스처 해상도를 제한하고 LOD 업그레이드를 비활성화하여 기존 저하 패턴(SPEC-UI-001 REQ-018)을 확장해야 한다. (저사양 판정 휴리스틱: §4.3, Assumptions)
- **REQ-290**: **WHEN** 사용자가 천체를 초점(선택/포커스)하면 **THEN** 시스템은 해당 천체의 고해상도 텍스처 티어(4K/8K day/night/normal/specular)를 지연 로드(lazy load)해야 하며, 이 티어는 초기 번들에 포함하지 않아야 한다.

**State-Driven (상태 기반)**
- **REQ-240**: **WHILE** 프레임 타임 예산(Section 5)이 30 연속 프레임 이상 초과되는 동안, 시스템은 본 SPEC 범위의 비핵심 효과를 다음 순서로 점진 비활성화해야 한다: bloom 반경 → 지오메트리 LOD 업그레이드 → 동적 픽셀 비율 하향. 핵심 상호작용(카메라 컨트롤, 클릭/호버 피킹)은 마지막까지 보존해야 한다. (SPEC-EARTH-002의 오로라·일식 레이어가 존재하는 경우, 해당 SPEC이 정의하는 확장 저하 순서에서 그 레이어들이 bloom보다 먼저 저하된다 — 이 레이어들은 본 SPEC 범위에 포함되지 않는다.)

**Optional (선택적)**
- **REQ-250**: **Where** GPU가 압축 텍스처를 지원하는 경우, 시스템은 hero 천체에 대해 JPEG 대신 KTX2/Basis 압축 텍스처를 적용하여 디코드 텍스처 메모리를 절감**해야 한다**.
- **REQ-255**: **Where** 근접·초점 천체가 렌더링되는 경우, 시스템은 이방성 필터링을 적용하여 스침각(grazing angle) 텍스처 번짐을 줄여**야 한다**. (구현: §4.3)

**Unwanted (금지)**
- **REQ-260**: 시스템은 본 기능의 일부로 렌더링 백엔드를 WebGL 렌더러에서 다른 것으로 전환하지 **않아야 한다** (WebGPU 이관 금지).

---

## 4. Solution (해결 방안 및 상세 사양)

### 4.1 왜소행성 데이터·배치 (F1)

| 천체 | 분류 | displayDistance (units, 근사) | 이심률/경사 (JPL) | 텍스처 소스 |
|------|------|------|------|------|
| Ceres | Dwarf (belt) | ~400 (화성300 ~ 목성450 사이) | e=0.076 / i=10.6° | Solar System Scope |
| Pluto | Dwarf (TNO) | >850 | e=0.248 / i=17.16° | USGS (포맷 변환) |
| Eris | Dwarf (TNO) | >850 (명왕성보다 외곽) | e=0.44 / i=44° | Solar System Scope |
| Makemake | Dwarf (TNO) | >850 | e=0.16 / i=29° | Solar System Scope |
| Haumea | Dwarf (TNO) | >850 | e=0.19 / i=28° | Solar System Scope |

- 기존 `PLANET_DATA`-형 구조에 `category: 'dwarf'` 필드로 항목 추가. 별도 서브시스템을 만들지 않고 `PlanetFactory`/`OrbitalMechanics`를 재사용한다.
- 카메라 `maxDistance`(constants.js:21)를 왜소행성이 화면 밖으로 벗어나지 않도록 상향 조정.
- 알려진 한계: `calculatePosition`이 Ω/ω를 생략하므로 고경사/고이심률 궤도(명왕성·에리스)는 도식적으로 보인다. UI에서 별도 표기하지 않되 research.md에 기록.

### 4.2 신규 위성 (F2)

- 실제 신규 작업 = 5종: Callisto(목성), Mimas·Tethys·Dione·Iapetus(토성).
- pivot-Group 패턴(`PlanetFactory.js:177-207`)을 그대로 재사용. `MOON_DATA`에 항목 추가.
- 토성 위성 7종의 `distanceFromParent` 간격을 개별 추가가 아닌 7종 전체로 재검증하여 저줌 z-fighting/겹침을 방지(Edge Case).
- 기본 flat-color 재질. Titan/Europa 등 hero 위성만 REQ-150에 따라 선택적 경량 텍스처.

### 4.3 렌더링 품질 업그레이드 (F3, 영향÷비용 순)

1. **Composer 멀티샘플 (사장 AA 복구)** — `new THREE.WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 })` + `SMAAPass`. 비용 최소, 효과 높음.
2. **재질 relight** — 행성/위성 `MeshBasicMaterial → MeshStandardMaterial`. 태양/별은 발광 유지. `AmbientLight` 하향으로 야간면 가시적 어둠 확보. F6/F7의 선행 조건.
3. **톤 매핑** — `ACESFilmicToneMapping` + 튜닝된 `toneMappingExposure`. 기존 `OutputPass` 유지.
4. **이방성 필터링** — `_loadTexture`에서 `texture.anisotropy = maxAnisotropy`.
5. **텍스처 티어 + 지연 로드** — 2K 초기 페이로드 유지, 초점 시 4K/8K 지연 페치. 8K는 초기 번들 금지.
6. **지오메트리 LOD** — 초점/근접 천체 96–128 세그먼트, 원거리 천체 축소. 거리 기반 스왑 + 히스테리시스로 pop-in 방지.
7. **동적 픽셀 비율** — `min(devicePixelRatio, 2)` 캡 유지 + 프레임 예산 초과 시 단계적 하향/회복.

### 4.4 기술 스택 판정 (엔진 교체 반려 근거)

| 옵션 | 판정 | 근거 |
|------|------|------|
| (a) Vanilla three + EffectComposer + 고해상도 자산 | **채택** | 재작성 0, 순수 정적 호환, 성숙한 WebGL 경로 유지 |
| (b) react-three-fiber | 반려 | +130–150KB gz, 11개 모듈 전체 JSX 재작성, 렌더링 이득 0 |
| (c) Babylon.js | 반려 | +300KB+ gz, 전면 재작성, 기존 궤도/씬 코드 재사용 불가 |
| (d) Cesium / globe.gl | 반려 | Cesium +3–4MB(백엔드형 의존), globe.gl은 좌표계 이중화 |
| WebGPU (`three.webgpu.js`) | 반려 | 별도 빌드 + TSL 후처리 재작성, 브라우저 보편성 미달 |

---

## 5. Non-Functional Requirements (NFR)

| 범주 | 요구 |
|------|------|
| 프레임 레이트 | 데스크탑 60fps / 모바일 30fps 지속. 원본 10-body 씬이 아닌 **확장 전체 씬**에 대해 회귀 검증. |
| 프레임 스무스니스 (검증 가능) | p95 프레임 타임 ≤ 25ms 데스크탑 / ≤ 50ms 모바일, 재생(1x–100x) 중 임의의 롤링 60초 창에서. |
| 초기 로드 예산 | 총 초기 로드 텍스처 페이로드 하드 실링 **12MB** (현재 7MB 대비 여유). 신규 왜소행성 텍스처 각 ≤ 512KB(1K). 4K/8K는 초점 시 지연 로드로 초기 로드에 미포함. |
| 텍스처 메모리 (VRAM) | 디코드 텍스처 예산 ≤ 256MB 데스크탑 / ≤ 128MB 모바일. 저사양 캡(REQ-230)은 선택 폴리시가 아니라 모바일 NFR을 위한 필수 가드. |

---

## 6. Exclusions (What NOT to Build)

- **소행성대·TNO 미포함**: IAU 5개 왜소행성을 넘어서는 어떤 소행성·트랜스넵튠 천체·미소행성체도 렌더링하지 않는다 (REQ-060). 시각적 소행성 벨트 밴드도 본 SPEC 범위 밖.
- **WebGPU / 엔진 교체 없음**: `WebGLRenderer`를 유지하며 WebGPU·r3f·Babylon·Cesium으로 이관하지 않는다 (REQ-260).
- **기존 위성 미변경**: 이미 배포된 Mars(Phobos/Deimos)·Uranus·Neptune 위성은 건드리지 않는다 (REQ-160).
- **지구 상세 뷰 미포함**: 지구 전용 뷰·ViewManager·hash 라우팅은 SPEC-EARTH-001로 이연한다.
- **일식/월식·항공기·오로라 미포함**: SPEC-EARTH-002로 이연한다. 본 SPEC은 이들이 의존하는 조명 반응 재질·텍스처 티어 인프라만 제공한다.
- **물리적 정확 스케일 없음**: 거리·크기는 기존과 동일하게 상징적 스케일을 유지한다(A-009 상속). Ω/ω 궤도 요소 완전 구현은 선택적 스트레치이며 필수 아님.

---

## 7. Traceability (추적성)

| 요구사항 | 모듈 | Solution 참조 | Acceptance |
|----------|------|--------------|------------|
| REQ-010, REQ-020, REQ-060 | F1 | §4.1 | AC-SIM-01 |
| REQ-030 | F1 | §4.1 | AC-SIM-01 |
| REQ-040, REQ-050 | F1 | §4.1 | AC-SIM-02 |
| REQ-110, REQ-120, REQ-160 | F2 | §4.2 | AC-SIM-03 |
| REQ-130, REQ-140, REQ-150 | F2 | §4.2 | AC-SIM-03 |
| REQ-210, REQ-270, REQ-280, REQ-285 | F3 | §4.3 | AC-SIM-04 |
| REQ-220, REQ-290, REQ-255 | F3 | §4.3 | AC-SIM-05 |
| REQ-230, REQ-240 | F3 | §4.3, §5 | AC-SIM-06 |
| REQ-250, REQ-260 | F3 | §4.4 | AC-SIM-04 |

---

## 8. Expert Consultation

| 도메인 | 에이전트 | 사유 |
|--------|---------|------|
| Frontend 3D | expert-frontend | `MeshStandard` relight, composer MSAA/SMAA, LOD, 텍스처 티어 로더 |
| Performance | expert-performance | 프레임 예산 회귀 검증, 동적 픽셀 비율, VRAM 실링 |
