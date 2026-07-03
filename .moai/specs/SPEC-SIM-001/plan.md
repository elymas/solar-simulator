---
id: SPEC-SIM-001
document: plan
version: "0.1.0"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, solar-system, dwarf-planets, moons, rendering-quality, brownfield]
---

# SPEC-SIM-001: Implementation Plan — 태양계 콘텐츠 확장 및 렌더링 품질 개선

## Overview

브라운필드 확장. 기존 단일 씬 구조를 유지하며 (1) 왜소행성 5종·신규 위성 5종을 데이터 중심으로 추가하고, (2) 사장된 AA를 복구하며 재질을 조명 반응형으로 이관한다. Architect 밀스톤 M1(F1+F2) + M2(F3)에 대응한다.

DELTA 범례: `[EXISTING]` 기존 파일 무변경 참조, `[MODIFY]` 기존 파일 수정, `[NEW]` 신규 파일.

---

## Milestone M1 — 콘텐츠 확장 (F1 + F2)

가장 낮은 리스크, 즉시 가시적 가치, 아키텍처 무변경. 순수 데이터 + 텍스처 + PlanetList 카테고리 1개 + InfoPanel 분기 1개. **먼저 구현.**

### Task M1.1 — 왜소행성 데이터 (F1)
- `[MODIFY]` `src/planets/planetData.js` — `PLANET_DATA`에 5개 왜소행성 항목 추가(`category: 'dwarf'`, 실 이심률/경사 포함). Reference: `src/planets/planetData.js:4-138` (PLANET_DATA 스키마).
- `[MODIFY]` `src/utils/constants.js` — 왜소행성 텍스처 맵 추가, 카메라 `maxDistance` 상향. Reference: `src/utils/constants.js:21` (maxDistance:5000), `:30` (TEXTURE_MAP).
- `[MODIFY]` `src/planets/OrbitalMechanics.js` — 고경사/고이심률 검증(Ω/ω 확장은 선택). Reference: `src/planets/OrbitalMechanics.js:19-51` (calculatePosition).
- `[NEW]` `public/textures/` — Ceres/Eris/Makemake/Haumea (Solar System Scope, 각 ≤512KB), Pluto (USGS, 포맷 변환).

### Task M1.2 — 왜소행성 UI/피킹 (F1)
- `[MODIFY]` `src/ui/PlanetList.js` — "Dwarf Planets" 카테고리 구분자 추가(기존 "Stars" 구분자 패턴 재사용). Reference: `src/ui/PlanetList.js:224-248` (_createDOM 카테고리 패턴).
- `[MODIFY]` `src/ui/InfoPanel.js` — 왜소행성 분기(분류 표기 "Dwarf Planet", 발견 연도).
- `[MODIFY]` `src/controls/InteractionManager.js` — 왜소행성 히트 타깃(팩토리 자동 등록으로 대부분 자동).

### Task M1.3 — 신규 위성 (F2)
- `[MODIFY]` `src/planets/planetData.js` — `MOON_DATA`에 Callisto(목성) + Mimas/Tethys/Dione/Iapetus(토성) 추가. 토성 7종 `distanceFromParent` 전체 재검증. Reference: `src/planets/planetData.js:140-274` (MOON_DATA, Io:190/Titan:234).
- `[MODIFY]` `src/planets/PlanetFactory.js` — 위성 생성/궤도선/라벨(대부분 기존 루프 자동). Reference: `src/planets/PlanetFactory.js:177-207` (_createSatellite pivot-Group), `:337-354` (_updateSatellites).
- `[NEW/OPTIONAL]` `public/textures/` — Titan/Europa 등 hero 위성 경량 텍스처(REQ-150, 선택).

---

## Milestone M2 — 렌더링 품질 (F3)

M1 이후. 안전한 순서: AA/톤/이방성(코스메틱) → relight(고위험, 룩 변경) → 텍스처 티어/LOD.

### Task M2.1 — Composer MSAA + SMAA + 톤 매핑 (안전)
- `[MODIFY]` `src/scene/SceneManager.js` — `EffectComposer`를 `WebGLRenderTarget(w,h,{type:HalfFloatType, samples:4})`로 구성, `SMAAPass` 삽입, `toneMapping = ACESFilmicToneMapping`. Reference: `src/scene/SceneManager.js:37` (NoToneMapping), `:83` (EffectComposer), `:229` (composer.render).
- `[MODIFY]` `src/utils/constants.js` — bloom/tone/AA/텍스처-티어 설정 상수.

### Task M2.2 — 재질 relight (고위험, 격리)
- `[MODIFY]` `src/planets/PlanetFactory.js` — 행성/위성 `MeshBasicMaterial → MeshStandardMaterial`. 태양(`:75`)/별(`:272`)은 발광 유지. Reference: `src/planets/PlanetFactory.js:127`(행성), `:160`(구름), `:182/:186`(위성).
- `[MODIFY]` `src/scene/SceneManager.js` — `AmbientLight` 하향 튜닝(야간면 가시적 어둠). Reference: `src/scene/SceneManager.js:68` (AmbientLight 0.8), `:71` (PointLight).

### Task M2.3 — 이방성 + 텍스처 티어 + LOD
- `[MODIFY]` `src/planets/PlanetFactory.js` — `_loadTexture`에 `anisotropy`, 초점 시 4K/8K 지연 로드 티어 로더, 거리 기반 세그먼트 LOD(히스테리시스). Reference: `src/planets/PlanetFactory.js:50-54` (_loadTexture), `:120/:178` (세그먼트 임계값).
- `[MODIFY]` `src/scene/SceneManager.js` — 동적 픽셀 비율 하향/회복. Reference: `src/scene/SceneManager.js:114-123` (기존 모바일 저하).

---

## Technology Specs

| 항목 | 사양 |
|------|------|
| AA | multisampled composer target `samples: 4` (WebGL2) + `SMAAPass` (FXAA/TAA 반려) |
| 재질 | `MeshStandardMaterial` (행성/위성), `MeshBasicMaterial` 발광 (태양/별) |
| 톤 매핑 | `ACESFilmicToneMapping` + 튜닝 exposure |
| 텍스처 티어 | 2K 초기, 4K/8K 초점 지연 로드, 8K 초기 번들 금지 |
| LOD | 초점 96–128 세그먼트 / 원거리 축소, 거리 스왑 + 히스테리시스 |
| 궤도 | JPL SSD 정적 테이블, Newton-Raphson(기존), Ω/ω 생략(알려진 한계) |

---

## Risk Analysis

| 리스크 | 가능성 | 영향 | 완화 |
|--------|--------|------|------|
| relight 회귀 — "전부 빛나는" 시그니처 룩이 사라짐 | 높음 | 높음 | `AmbientLight` 튜닝, 태양/별 발광 확인, before/after 시각 체크. M2에서 격리 검증 |
| 로드/텍스처 메모리 예산 초과 | 중간 | 높음 | 12MB 초기 실링, 초점 지연 로드, 저사양 2K 캡 |
| 확장 씬 프레임 회귀(기존 60fps 조용히 하락) | 중간 | 중간 | 신규 기능만이 아닌 **전체 씬** 재벤치, p95 롤링 60초 검증 |
| LOD pop-in | 중간 | 낮음 | 세그먼트 스왑에 히스테리시스/크로스페이드 |
| 토성 7위성 z-fighting/겹침 | 중간 | 낮음 | 7종 전체 간격 재검증(개별 추가 금지) |
| 명왕성/에리스 도식적 궤도(Ω/ω 생략) | 확정 | 낮음 | 교육용 허용, research.md 기록. 선택적 Ω/ω 확장 |

---

## mx_plan (@MX 주석 대상)

| 태그 | 대상 | 사유 |
|------|------|------|
| `@MX:ANCHOR` | `OrbitalMechanics.calculatePosition` (`OrbitalMechanics.js:19`) | 고 fan_in — 모든 행성/왜소행성/위성 위치가 여기를 경유. 불변 계약. Ω/ω 생략 한계도 함께 명시. |
| `@MX:NOTE` | 스케일 상수 (`constants.js` displayDistance/displayRadius, SCALE) | 상징적 스케일 의도 전달 — 물리값 아님을 후속 개발자에게 명시. |
| `@MX:NOTE` | 텍스처 소스 provenance (`constants.js` TEXTURE_MAP 왜소행성 항목) | Solar System Scope(CC BY 4.0) vs USGS(public domain) 출처·라이선스 구분. |
| `@MX:WARN` | `PlanetFactory` relight 지점 (`:127/:182/:186`) | `MeshBasic→MeshStandard` 이관은 야간면을 어둡게 만드는 룩 변경(회귀 위험). @MX:REASON 동반. |
| `@MX:WARN` | `SceneManager` 동적 픽셀 비율 하향 (render 루프 인접) | 렌더 루프 내 setPixelRatio 변동 — 프레임 예산 초과 시에만. @MX:REASON 동반. |

---

## Dependencies

- 선행 의존성 없음 (3-SPEC 체인의 루트).
- 후행: SPEC-EARTH-001이 본 SPEC의 조명 반응 재질 + 텍스처 티어 인프라에 의존.

---

## Expert Consultation

| 도메인 | 에이전트 | 사유 |
|--------|---------|------|
| Frontend 3D | expert-frontend | relight, composer MSAA/SMAA, LOD, 텍스처 티어 로더 |
| Performance | expert-performance | 프레임 예산 회귀, 동적 픽셀 비율, VRAM 실링 |
