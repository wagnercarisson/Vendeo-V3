---
phase: quick-260717-okh
plan: 01
subsystem: image-generation
tags:
  - bugfix
  - guardrail
  - prompt-validation
  - badgeText
requires: []
provides:
  - badgeText interpolation in ImageReviewService
  - validatePrompts preflight guardrail in route.ts
affects:
  - src/lib/image-generation/services/image-review-service.ts
  - src/lib/image-generation/services/image-generation-service.ts
  - src/app/api/campaign/generate-image/route.ts
tech-stack:
  added: []
  patterns:
    - validatePrompts synchronous preflight before parallel IA calls
key-files:
  created:
    - src/lib/image-generation/services/__tests__/image-review-service.test.ts
    - src/lib/image-generation/services/__tests__/image-generation-service.test.ts
  modified:
    - src/lib/image-generation/services/image-review-service.ts
    - src/lib/image-generation/services/image-generation-service.ts
    - src/app/api/campaign/generate-image/route.ts
    - src/app/api/campaign/generate-image/__tests__/route.test.ts
decisions: []
metrics:
  duration: ~3min
  completed_date: "2026-07-17"
---

# Phase quick-260717-okh Plan 01: Corrigir bug de placeholder não resolvido no pipeline de geração e adicionar guardrail de preflight

**One-liner:** Corrige `badgeText` não interpolado no ImageReviewService e adiciona preflight `validatePrompts()` que bloqueia `Promise.all` paralelo no route.ts se qualquer prompt tiver placeholders não resolvidos — evitando chamadas IA desperdiçadas e garantindo estorno de crédito.

## Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Corrigir ImageReviewService para aceitar/interpolar badgeText | `0dcdeda` | image-review-service.ts, image-generation-service.ts |
| 2 | Adicionar preflight validatePrompts() e guardrail no route.ts | `e0cf768` | image-generation-service.ts, route.ts, route.test.ts |
| 3 | Adicionar testes automatizados (5 novos) | `c76ee33` | image-review-service.test.ts, image-generation-service.test.ts |

## Verification Results

| Check | Result |
|-------|--------|
| `vitest` — services/__tests__ | ✅ 5/5 passing (2 review + 3 validatePrompts) |
| `vitest` — route.test.ts | ✅ 25/25 passing (existing, no regressions) |
| `npx tsc --noEmit` | ✅ Clean, no type errors |
| `{{badgeText}}` in service code | ✅ Not found (only in .md prompt files) |

## Deviations from Plan

None — plan executed exactly as written.

### Auto-fixed Issues

None.

### Additional Changes

**route.test.ts mock update:** Added `validatePrompts` to the `ImageGenerationService` mock (`mockValidatePrompts`) in the route test file. This was required because route.ts now calls `imageService.validatePrompts(brief)` inside the stream `start()` — without this mock, all 25 existing route tests would break. The mock returns `{ valid: true, errors: [] }` in all test setups to preserve existing test behavior through the happy path.

## Threat Surface Scan

No new threat flags — the preflight guardrail actually mitigates T-quick-01 (Tampering), T-quick-02 (Information Disclosure), and T-quick-03 (Denial of Service) per the threat model in the plan.

## Self-Check: PASSED

- [x] `image-review-service.ts` — `ImageReviewInput.badgeText` field added
- [x] `review()` — passes `badgeText` to `promptLoader.load()`
- [x] `image-generation-service.ts` — `badgeText` in `reviewInput`
- [x] `validatePrompts()` — public method checks director + reviewer prompts
- [x] `route.ts` — preflight before `Promise.all` with refund on failure
- [x] Tests pass (30/30)
- [x] TypeScript clean
