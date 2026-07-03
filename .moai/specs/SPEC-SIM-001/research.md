---
id: SPEC-SIM-001
document: research
version: "0.1.0"
status: draft
created: "2026-07-03"
updated: "2026-07-03"
author: limbowl
tags: [three.js, solar-system, dwarf-planets, moons, rendering-quality, brownfield]
---

# SPEC-SIM-001: Research — 태양계 콘텐츠 확장 및 렌더링 품질 개선

Architect 설계와 Analyst 요구사항 초안, 코드베이스 조사에서 본 SPEC(F1+F2+F3) 범위로 정제한 연구 결과.

## 1. 브라운필드 코드 사실 (구현 제약)

- **모든 천체가 `MeshBasicMaterial`(무광)**: `PlanetFactory.js:75`(태양), `:127`(행성), `:160`(구름), `:182/:186`(위성), `:219`(고리), `:272`(별). `PointLight`(`SceneManager.js:71`)/`AmbientLight`(`:68`)가 행성에 전혀 기여하지 않음. F3 relight가 F6/F7의 하드 선행 조건인 근거.
- **AA 사장**: `EffectComposer` 기본 렌더 타깃 `samples=0`. 렌더러 `antialias:true`(`SceneManager.js:31`)는 사용 안 되는 기본 프레임버퍼에만 적용. 모든 출력은 `composer.render()`(`:229`) 경유 → 화면 멀티샘플 안 됨. 최저비용·최고효과 F3 수정.
- **위성 pivot-Group 패턴**: `_createSatellite`(`PlanetFactory.js:177-207`)가 `THREE.Group()` pivot에 mesh를 넣고 씬에 추가, `_updateSatellites`(`:337-354`)가 pivot을 부모 위치로 이동시키고 회전. 신규 위성 5종의 참조 구현.
- **스케일 상징적**: `displayRadius`/`distanceDisplay` 수작업 튜닝. 해왕성 `distanceDisplay`=850. 카메라 `far`=100000(`constants.js:13`), `maxDistance`=5000(`:21`). 해왕성 바깥 왜소행성은 >850 배치 + maxDistance 상향 필요.
- **`calculatePosition`(`OrbitalMechanics.js:19-51`)**: 평균근점이각 → Kepler 방정식(Newton-Raphson) → 진근점이각 → 경사 회전. **승교점 경도(Ω)·근일점 인수(ω) 생략** — 고경사 궤도(명왕성/에리스)는 도식적. 알려진 한계.
- **텍스처 현황**: `public/textures/` 7.0MB, 전부 2K JPG. 지구 nightmap(`2k_earth_nightmap.jpg`, `constants.js:35`)은 로드되어 있으나 현재 미사용(F4에서 활용).

## 2. 범위 결정 근거

### F1 — 왜소행성 = IAU 5종
- IAU 공인이 유일하게 안정적·명확한 경계 기준. 수백 개 TNO 후보를 매번 재논쟁하지 않기 위함.
- 5종 모두 뚜렷한 표면 이미지(명왕성 Tombaugh Regio, Ceres Occator 분화구)로 교육/시각 가치가 있어 flat-color 위성과 달리 각자 텍스처 가치가 있음.
- 배치는 기존 스케일 압축 선례 재사용: Ceres = 소행성대(~2.77 AU), 나머지 = 해왕성 바깥.
- Charon(명왕성 위성)은 이 스케일에서 시각적으로 유의미한 유일한 왜소행성 위성 → 선택적 스트레치.

### F2 — 실제 신규 작업 5종
- 목성 95위성 중 갈릴레이 4종만 유의미(>1,500km, 유체정역학 평형, 1610 발견). 나머지 ~91개는 불규칙 포획체.
- 토성 146위성 중 정확히 7종이 유체정역학 평형(Mimas/Enceladus/Tethys/Dione/Rhea/Titan/Iapetus).
- **이미 존재**: Io/Europa/Ganymede(`planetData.js:190/204/218`), Titan/Enceladus/Rhea. → 신규 = Callisto + Mimas/Tethys/Dione/Iapetus = **5종**.

### F3 — 검증 가능한 "부드러움/해상도" 기준
- "smoother/higher-resolution"은 직접 검증 불가 → p95 프레임 타임(≤25ms/≤50ms 롤링 60초), 거리 기반 LOD, 역할별 텍스처 티어로 구체화.
- **엔진 교체 반려**: WebGPU/r3f/Babylon/Cesium 모두 이 자산 규모에 과잉. 98% 브라우저 커버리지 회귀 리스크. `THREE.LOD`·KTX2(선택)·오브젝트 풀링 등 가산 기법만 권장.

## 3. 자산 출처 (Sources)

| 자산 | 출처 | 라이선스 | 비고 |
|------|------|----------|------|
| 행성 텍스처 (기존) | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 (귀속 필요) | 2K JPEG |
| 왜소행성 텍스처 (Ceres, Eris, Makemake, Haumea) | Solar System Scope | CC BY 4.0 | **Pluto 없음, 목성/토성 위성 없음** |
| Pluto, hero 위성 텍스처 | [USGS Astrogeology](https://astrogeology.usgs.gov/) | Public Domain | 모자이크, 포맷 변환 필요 |
| 궤도 요소 (행성 근사 위치) | [NASA JPL SSD approx_pos](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Public (US Gov) | 정적 테이블, 런타임 API 없음 |
| 위성 평균 궤도 요소 | NASA JPL SSD satellite mean elements | Public (US Gov) | 정적 |
| 소천체 테이블 (왜소행성) | NASA JPL SSD small-body database | Public (US Gov) | 정적 |

## 4. 리스크 (Analyst 랭킹 발췌)

- **High — 로드/텍스처 메모리 예산 크립**: 정적 GitHub Pages, 10s/10Mbps 타이트한 로드 목표. 기능별이 아닌 누적 페이로드 추적 필수. → 12MB 초기 실링, 초점 지연 로드.
- **Medium — 프레임 예산 경합**: 위성/LOD/(하위 SPEC의)오로라/일식이 같은 60/30fps 실링 경합. REQ-240 우선순위 저하 순서를 본 SPEC에서 선설계.
- **Low — 시각 혼잡/z-fighting**: 11 위성 + 5 왜소행성 기본 줌에서. 거리 스케일 튜닝으로 해결(아키텍처 리스크 아님).
- **확정 한계 — 궤도 도식성**: Ω/ω 생략으로 명왕성/에리스 궤도가 도식적. 교육용 허용, 기록.

## 5. SPEC-UI-001 문서 드리프트 (주의)

배포 코드가 이미 자체 SPEC을 초과함(8행성 위성 다수, 외부 별 Sirius/Betelgeuse 등, 카메라 초점 시스템 — REQ-001~022에 미문서화). 본 SPEC이 "현재 상태 = SPEC-UI-001"로 가정하면 이미 배포된 동작과 충돌/중복 가능. 경량 SPEC-UI-001 재기준선(addendum)을 첫 Run phase 전/중에 권장(Analyst High 리스크 #4).
