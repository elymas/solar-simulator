# EPIC-KIDS 병렬 구현 플레이북 (2026-08-12)

근거 데이터: 6개 SPEC frontmatter `depends_on` + plan.md §G run-order + §D 파일 목록 실측.

## 의존성 그래프 (관측)

- 하드(`depends_on`, run 게이트가 KIDS `completed` 요구): EVENTS-001, EARTH-003, PLAY-001 ← KIDS-001
- 소프트(§G run-order): EVENTS-001, EARTH-003 ← MOBILE-001
- 무의존: KIDS-001, MOBILE-001, PWA-001

## 파일 겹침 (병렬 판단 근거)

- KIDS ∩ MOBILE = 5파일 (index.html, InteractionManager, PlanetList, TimeControls, main.js) → **병렬 금지, 순차**
- KIDS ∩ PWA = index.html 1파일(상이 hunk) → 병렬 안전
- EVENTS ∩ EARTH ∩ PLAY = planetData.js(가산 블록), main.js(배선), performance.js(EVENTS·EARTH) → 병렬 가능, 병합 순서로 해결

## 웨이브 구조

| Wave | 구성 | 방식 |
|---|---|---|
| 1 | KIDS-001 ∥ PWA-001 | 워크트리 2개, 터미널 2개 |
| 2 | MOBILE-001 | 메인 세션 단독 (트렁크 직커밋) |
| 3 | EVENTS-001 ∥ EARTH-003 ∥ PLAY-001 | 워크트리 3개, 터미널 3개 |

병합 순서: W1 = KIDS → PWA. W3 = EVENTS → EARTH → PLAY (degrader 사다리 정의는 EVENTS 우선, EARTH가 확장).

운영 주의: 각 레인은 자기 feat 브랜치에만 커밋, push 금지(병합 프롬프트가 수행) · 워크트리는 npm install 필요 · 병렬 세션 = 토큰 배수 소모 · 레인 실행 중 메인 checkout은 읽기 전용 유지.

공통 /goal (각 세션에서 구현 착수 승인 후 **별도 메시지로 단독 전송**, `<ID>` 치환):

```
/goal SPEC-<ID> run+sync 완료: acceptance.md AC 전부 구현되어 npm test가 exit 0으로 통과하고 spec.md status가 completed로 전환된 증거가 트랜스크립트에 제시되면 종료, 늦어도 30턴 후 중단
```

---

## W1-A — 터미널 A (KIDS-001)

새 터미널에서:
```bash
git -C /Users/masterp/Projects/superwork/solar-simulator worktree add ../solar-kids -b feat/spec-kids-001 main
cd /Users/masterp/Projects/superwork/solar-kids && npm install && claude
```

```text
✂──── 여기부터 복사 ────✂

ultrathink. SPEC-KIDS-001 run 진입.
applied lessons: env_browse_verification.md
source_session_id: 2f317c64-2820-49d7-98c7-bb0c04bf0165

전제 검증:
0) git rev-parse --show-toplevel → .../solar-kids (워크트리)
1) git branch --show-current → feat/spec-kids-001
2) ls .moai/specs/SPEC-KIDS-001 → spec/plan/acceptance/progress.md 4파일
3) npm test → 기존 vitest 스위트 통과

실행: /moai run SPEC-KIDS-001

후속: run 완료 후 같은 세션에서 /moai sync SPEC-KIDS-001 (status: completed 전환 필수 — Wave 3 게이트). 커밋은 feat/spec-kids-001에만, push·병합 금지(메인 세션 W1-M이 수행).

✂──── 여기까지 복사 ────✂
```

## W1-B — 터미널 B (PWA-001)

새 터미널에서:
```bash
git -C /Users/masterp/Projects/superwork/solar-simulator worktree add ../solar-pwa -b feat/spec-pwa-001 main
cd /Users/masterp/Projects/superwork/solar-pwa && npm install && claude
```

```text
✂──── 여기부터 복사 ────✂

ultrathink. SPEC-PWA-001 run 진입.
applied lessons: env_browse_verification.md
source_session_id: 2f317c64-2820-49d7-98c7-bb0c04bf0165

전제 검증:
0) git rev-parse --show-toplevel → .../solar-pwa (워크트리)
1) git branch --show-current → feat/spec-pwa-001
2) grep -c "DECISION (2026-08-12" .moai/specs/SPEC-PWA-001/plan.md → 1 (폰트 셀프호스팅 확정)
3) npm test → 기존 vitest 스위트 통과

실행: /moai run SPEC-PWA-001

후속: run 완료 후 같은 세션에서 /moai sync SPEC-PWA-001. 커밋은 feat/spec-pwa-001에만, push·병합 금지(W1-M이 수행).

✂──── 여기까지 복사 ────✂
```

## W1-M — 메인 세션 (Wave 1 병합)

```text
✂──── 여기부터 복사 ────✂

ultrathink. Wave 1 병합 (KIDS → PWA).

전제 검증:
1) 터미널 A/B 세션 종료, git log feat/spec-kids-001 / feat/spec-pwa-001 에 sync 커밋 존재
2) grep "^status:" ../solar-kids/.moai/specs/SPEC-KIDS-001/spec.md → completed
3) git status --porcelain → 메인 작업트리 깨끗

실행: git merge --no-ff feat/spec-kids-001 후 npm test, 이어서 git merge --no-ff feat/spec-pwa-001 (index.html 충돌 시 양쪽 hunk 모두 보존) 후 npm test, 통과 시 git push origin main, git worktree remove ../solar-kids ../solar-pwa + 브랜치 삭제.

후속: 같은 세션에서 W2 프롬프트 (MOBILE-001).

✂──── 여기까지 복사 ────✂
```

## W2 — 메인 세션 (MOBILE-001, 단독)

```text
✂──── 여기부터 복사 ────✂

ultrathink. SPEC-MOBILE-001 run 진입.
applied lessons: env_browse_verification.md

전제 검증:
1) git log --oneline -5 → KIDS·PWA 병합 커밋 존재
2) grep "^status:" .moai/specs/SPEC-KIDS-001/spec.md → completed
3) npm test → 통과 (병합 후 기준선)

실행: /moai run SPEC-MOBILE-001

후속: /moai sync SPEC-MOBILE-001 (트렁크 직커밋 + push) 완료 후 Wave 3 터미널 3개 투입.

✂──── 여기까지 복사 ────✂
```

## W3-A — 터미널 A (EVENTS-001)

새 터미널에서:
```bash
git -C /Users/masterp/Projects/superwork/solar-simulator worktree add ../solar-events -b feat/spec-events-001 main
cd /Users/masterp/Projects/superwork/solar-events && npm install && claude
```

```text
✂──── 여기부터 복사 ────✂

ultrathink. SPEC-EVENTS-001 run 진입.
applied lessons: env_browse_verification.md

전제 검증:
0) git rev-parse --show-toplevel → .../solar-events (워크트리)
1) grep "^status:" .moai/specs/SPEC-KIDS-001/spec.md → completed (depends_on 충족)
2) git log --oneline -8 | grep -i mobile → MOBILE-001 sync 커밋 존재 (§G run-order 충족)
3) npm test → 통과

실행: /moai run SPEC-EVENTS-001

후속: /moai sync SPEC-EVENTS-001 후 종료. 커밋은 feat 브랜치에만, push·병합 금지(W3-M이 수행).

✂──── 여기까지 복사 ────✂
```

## W3-B — 터미널 B (EARTH-003)

새 터미널에서:
```bash
git -C /Users/masterp/Projects/superwork/solar-simulator worktree add ../solar-earth -b feat/spec-earth-003 main
cd /Users/masterp/Projects/superwork/solar-earth && npm install && claude
```

```text
✂──── 여기부터 복사 ────✂

ultrathink. SPEC-EARTH-003 run 진입.
applied lessons: env_browse_verification.md

전제 검증:
0) git rev-parse --show-toplevel → .../solar-earth (워크트리)
1) grep "^status:" .moai/specs/SPEC-KIDS-001/spec.md → completed (depends_on 충족)
2) git log --oneline -8 | grep -i mobile → MOBILE-001 sync 커밋 존재 (§G run-order 충족)
3) npm test → 통과

실행: /moai run SPEC-EARTH-003

후속: /moai sync SPEC-EARTH-003 후 종료. 커밋은 feat 브랜치에만, push·병합 금지(W3-M이 수행).

✂──── 여기까지 복사 ────✂
```

## W3-C — 터미널 C (PLAY-001)

새 터미널에서:
```bash
git -C /Users/masterp/Projects/superwork/solar-simulator worktree add ../solar-play -b feat/spec-play-001 main
cd /Users/masterp/Projects/superwork/solar-play && npm install && claude
```

```text
✂──── 여기부터 복사 ────✂

ultrathink. SPEC-PLAY-001 run 진입.
applied lessons: env_browse_verification.md

전제 검증:
0) git rev-parse --show-toplevel → .../solar-play (워크트리)
1) grep "^status:" .moai/specs/SPEC-KIDS-001/spec.md → completed (depends_on 충족)
2) grep -c "DECISION (2026-08-12" .moai/specs/SPEC-PLAY-001/plan.md → 1 (2D 라인업 확정)
3) npm test → 통과

실행: /moai run SPEC-PLAY-001

후속: /moai sync SPEC-PLAY-001 후 종료. 커밋은 feat 브랜치에만, push·병합 금지(W3-M이 수행).

✂──── 여기까지 복사 ────✂
```

## W3-M — 메인 세션 (Wave 3 병합, 에픽 종결)

```text
✂──── 여기부터 복사 ────✂

ultrathink. Wave 3 병합 (EVENTS → EARTH → PLAY) + 에픽 종결.

전제 검증:
1) 터미널 A/B/C 세션 종료, 세 feat 브랜치에 각 sync 커밋 존재
2) git status --porcelain → 메인 작업트리 깨끗

실행: git merge --no-ff feat/spec-events-001 → npm test → git merge --no-ff feat/spec-earth-003 (performance.js 충돌 시 EVENTS의 사다리 정의 유지 + EARTH 확장 이어붙임, planetData.js/main.js는 양쪽 가산 블록 모두 보존) → npm test → git merge --no-ff feat/spec-play-001 (동일 원칙) → npm test → git push origin main → 워크트리 3개 remove + 브랜치 삭제.

후속: 에픽 6/6 완료 보고 + 실기기(iPhone) 검증 라운드 제안.

✂──── 여기까지 복사 ────✂
```
