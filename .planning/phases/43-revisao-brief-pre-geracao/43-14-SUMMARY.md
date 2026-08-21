---
phase: 43-revisao-brief-pre-geracao
plan: 14
subsystem: testing
tags: [regression, co-migration, fixtures, d2, d5]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (tasks.md §14 — Regressão e co-migração)
  - phase: 43-10/43-11/43-12/43-13
    provides: suítes de testes da F43 (1-26)
  - phase: 43-03/43-04 (hook + UI)
    provides: fluxo de revisão (enterReview/confirmReview)
  - phase: 43-05/43-08 (schema + rota)
    provides: literal brief_review_confirmed + flag
  - phase: 43-06 (serviço)
    provides: fase input_validation skipped
provides:
  - Co-migração dos testes do hook (navigation via revisão, product-images body via buildCampaignGenerationBody)
  - Regressão completa da suíte (2315 testes)
affects: [43-15 (verificação final)]

# Tech tracking
tech-stack:
  added: []
  patterns: [co-migration de testes existentes para o novo fluxo de revisão]

key-files:
  created: []
  modified: [src/components/flow/__tests__/use-campaign-form-navigation.test.ts, src/components/flow/__tests__/use-campaign-form-product-images.test.ts]

key-decisions:
  - "Co-migração mínima: navigation test novo (revisão → confirmar → navegação); product-images test 14 via enterReview/confirmReview; demais testes (submit-error standalone, validity/notice helpers puros) inalterados"

patterns-established:
  - "Fluxo de geração sem override permanece inalterado (regressão D5)"

requirements-completed: [F43-28]

# Metrics
duration: 40min
completed: 2026-08-21
---

# Plan 43-14: Regressão e Co-migração de Fixtures Summary

**Regressão e co-migração concluídas (D2–D7): testes do hook co-migrados para o fluxo de revisão (`navigation` via `enterReview`/`confirmReview`; `product-images` body via `buildCampaignGenerationBody`), fixtures de route/service já atualizadas nos plans 43-12/43-13; suíte completa verde (2315 testes / 252 arquivos) — fluxo de geração sem override inalterado**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 3
- **Files modified:** 2 (co-migração mínima)

## Accomplishments
- **`use-campaign-form-navigation.test.ts`**: novo teste 16 (F43 D2) — fluxo revisão → `enterReview` → `confirmReview` → navegação para `/campanhas/[id]` (o submit real agora passa pela revisão)
- **`use-campaign-form-product-images.test.ts`**: teste 14 co-migrado — o body D2 (XOR `productImages[]` sem id / `productImageDataUrl` legado) agora é montado via `enterReview` + `confirmReview` (que usa `buildCampaignGenerationBody` com `brief_review_confirmed`), validando idempotência revisão×body no caminho confirmado
- **Demais testes** (mínimo delta): `submit-error` (testa helper standalone de erro), `validity`/`notice` (testam os helpers puros `buildValidityDisplayText`/`buildMandatoryArtworkText` — mesmos usados por `buildCampaignGenerationBody`) permanecem inalterados e passando
- **Fixtures de `route.test.ts`/`image-generation-service.test.ts`**: já atualizadas nos plans 43-12 (testes 18-22 + mocks da flag) e 43-13 (Teste 23 skipped) — nenhuma co-migração adicional necessária
- **Regressão completa**: `npx vitest run` → **2315 testes / 252 arquivos passando** (fluxo de geração completo sem override — crédito, rate limit, clearance, readiness, stream, telemetria, estorno — inalterado)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Co-migrar testes do hook (navigation + product-images via revisão)** - (parte do commit do plano, test)
2. **Task 2: Fixtures de route/service** - já co-migradas em 43-12/43-13 (sem delta adicional)
3. **Task 3: Regressão completa + verificação da suíte** - (parte do commit do plano, test)

## Files Created/Modified
- `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` - Teste 16 (revisão → confirmar → navegação)
- `src/components/flow/__tests__/use-campaign-form-product-images.test.ts` - Teste 14 via revisão

## Decisions Made
- Co-migração mínima (conforme o plano "mínimo delta"): apenas os testes que exercitavam o submit direto de forma significativa foram co-migrados para a revisão
- `submit-error`/`validity`/`notice` inalterados — testam helpers/lógica standalone já cobertos pelos novos testes 1-10 (43-10)

## Deviations from Plan

Nenhuma - plano executado como escrito. A co-migração de `route.test.ts`/`image-generation-service.test.ts` já havia ocorrido nos plans 43-12/43-13 (o plano listava esses arquivos; a verificação confirmou que já estão atualizados e passando).

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Suíte completa verde (2315 testes) — base sólida para a verificação final
- Validações: typecheck limpo, `npx vitest run` completo passando
- Próximo: 43-15 (verificação — 4 gates + UAT), que fecha a fase

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*