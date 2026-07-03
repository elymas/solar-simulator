---
id: SPEC-SIM-001
document: spec-compact
version: "0.1.1"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, solar-system, dwarf-planets, moons, rendering-quality, brownfield]
---

# SPEC-SIM-001 (Compact): 태양계 콘텐츠 확장 및 렌더링 품질 개선

priority: high · depends_on: (none, root of 3-SPEC chain) · modules: F1, F2, F3

## Requirements

### F1 — 왜소행성
- REQ-010 (U): IAU 5종(Ceres, Pluto, Eris, Makemake, Haumea)을 구별되는 3D 천체로 항상 렌더링.
- REQ-020 (U): Ceres = 소행성대(~400 units, 화성300~목성450 사이), 나머지 4 TNO = 해왕성(850) 바깥 스케일 거리.
- REQ-030 (E): WHEN 왜소행성 클릭 THEN InfoPanel(지름/거리/공전주기/발견연도/"Dwarf Planet").
- REQ-040 (S): WHILE 재생 중 실 이심률/경사(명왕성 e=0.248/i=17°) Keplerian 궤도, 원형 단순화 금지.
- REQ-050 (O): Where Charon 포함 시 위성 pivot 파이프라인으로 렌더해야 함.
- REQ-060 (Un): IAU 5종 외 TNO/소행성/미소행성체 렌더 금지.

### F2 — 목성/토성 위성
- REQ-110 (U): Callisto 추가 → 갈릴레이 4종 완성(기존 Io/Europa/Ganymede).
- REQ-120 (U): Mimas/Tethys/Dione/Iapetus 추가 → 토성 둥근 위성 7종 완성(기존 Titan/Enceladus/Rhea).
- REQ-130 (E): WHEN 위성 클릭 THEN 기존 달/Phobos/Deimos 패턴 InfoPanel.
- REQ-140 (S): WHILE 재생 중 위성 궤도 스키마(공전주기/이심률/모행성 거리)로 공전.
- REQ-150 (O): Where hero 위성(Titan/Europa) 시각 정체성 요구 시 경량 텍스처 적용해야 함.
- REQ-160 (Un): 목성/토성 외 위성 추가 금지. 기존 Mars/Uranus/Neptune 위성 무변경.

### F3 — 렌더링 품질
- REQ-210 (U): 확장 전체 씬에서 NFR 프레임 타임 기준 충족.
- REQ-220 (U): 거리 기반 LOD — 근접 천체만 증가된 세그먼트.
- REQ-270 (U): 멀티샘플 렌더 타깃 + SMAA로 AA 복구(구현 §4.3).
- REQ-280 (U): 행성/위성 조명 반응(lit) 재질, 태양/별 발광 유지(재질 매핑 §4.3).
- REQ-285 (U): ACES 필름 톤 매핑으로 최종 출력 톤 매핑(구현 §4.3).
- REQ-230 (E): WHEN 저사양 분류 THEN 텍스처 캡 + LOD 업그레이드 비활성.
- REQ-290 (E): WHEN 천체 초점 THEN 4K/8K 텍스처 지연 로드, 초기 번들 금지.
- REQ-240 (S): WHILE 프레임 예산 30연속 초과 동안 본 SPEC 범위 저하 bloom→LOD→픽셀비율, 핵심 상호작용 보존(오로라/일식은 EARTH-002 범위, cross-SPEC서 먼저 저하).
- REQ-250 (O): Where GPU 압축 지원 시 hero 천체 KTX2/Basis 적용해야 함.
- REQ-255 (O): Where 근접·초점 천체 렌더 시 이방성 필터링 적용해야 함(구현 §4.3).
- REQ-260 (Un): WebGL 렌더러 백엔드 유지(WebGPU 이관 금지).

## Acceptance Criteria
- AC-SIM-01: 5 왜소행성 렌더 + 위치 + 클릭 정보 패널 (REQ-010/020/030/060).
- AC-SIM-02: 명왕성 이심 궤도 반영, Charon 선택 (REQ-040/050).
- AC-SIM-03: Callisto + 토성 7위성 완성, 겹침 없음, 기존 위성 무변경 (REQ-110~160).
- AC-SIM-04: samples≥4 AA, relight 주야 경계, ACES 톤 매핑, KTX2 폴백, WebGL 유지 (REQ-270/280/285/210/250/260).
- AC-SIM-05: 초점 시 4K/8K 지연 로드, LOD pop-in 없음 (REQ-220/290/255).
- AC-SIM-06: p95 데스크탑≤25ms/모바일≤50ms, 회귀 없음, 저사양 저하, 우선순위 저하 (REQ-210/230/240).

## Files to Modify
- `[MODIFY]` src/planets/planetData.js — 왜소행성 5행 + 위성 5종 + category
- `[MODIFY]` src/utils/constants.js — 텍스처 맵, maxDistance↑, bloom/tone/AA/티어 설정
- `[MODIFY]` src/planets/PlanetFactory.js — 왜소행성/위성 루프, MeshStandard relight, anisotropy, LOD, 텍스처 티어
- `[MODIFY]` src/planets/OrbitalMechanics.js — 고경사/고이심 검증 (Ω/ω 선택)
- `[MODIFY]` src/ui/PlanetList.js — "Dwarf Planets" 카테고리 구분자
- `[MODIFY]` src/ui/InfoPanel.js — 왜소행성 분기
- `[MODIFY]` src/scene/SceneManager.js — composer MSAA, ACES 톤, AmbientLight 튜닝, 동적 픽셀 비율
- `[MODIFY]` src/controls/InteractionManager.js — 왜소행성 히트 타깃(대부분 자동)
- `[NEW]` public/textures/ — 왜소행성 4종(Solar System Scope) + Pluto(USGS) + hero 위성 선택

## Exclusions (What NOT to Build)
- IAU 5종 외 소행성/TNO/미소행성체·시각적 소행성 벨트 없음 (REQ-060).
- WebGPU/r3f/Babylon/Cesium 엔진 교체 없음 (REQ-260).
- 기존 Mars/Uranus/Neptune 위성 무변경 (REQ-160).
- 지구 상세 뷰/ViewManager/hash 라우팅 없음 → SPEC-EARTH-001.
- 일식/월식·항공기·오로라 없음 → SPEC-EARTH-002 (본 SPEC은 relight + 텍스처 티어 인프라만 제공).
- 물리적 정확 스케일 없음(상징적 스케일 유지). Ω/ω 완전 구현은 선택.
