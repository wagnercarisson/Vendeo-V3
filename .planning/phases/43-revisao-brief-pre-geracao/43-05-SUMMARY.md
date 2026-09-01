---
phase: 43-revisao-brief-pre-geracao
plan: 05
subsystem: api
tags: [schema, override, input-validation, brief-review-confirmed, d5]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (D5 — novo override brief_review_confirmed com semântica distinta)
provides:
  - GenerateImageRequestSchema.inputValidationOverride.productImageCheck aceita "brief_review_confirmed" via z.union (.strict preservado)
  - ValidationContext.overrides.productImageCheck tipado com ambos literais
  - InputValidationService.validate aceita o novo literal (skip inalterado)
affects: [43-06 (serviço skipped), 43-08 (rota), 43-12 (testes 17-23), 43-14 (co-migração)]

# Tech tracking
tech-stack:
  added: []
  patterns: [z.union de literais de override, .strict preservado, matriz de semântica documentada no schema]

key-files:
  created: []
  modified: [src/lib/image-generation/schema.ts, src/lib/image-generation/services/input-validation-service.ts]

key-decisions:
  - "brief_review_confirmed tem semântica distinta de user_confirmed_continue (revisou+confirmou vs 409+insistiu) — ambas pulam a IA de visão"

patterns-established:
  - "Matriz de semântica do override documentada inline no schema (single source of truth para testes 17+)"

requirements-completed: [F43-11, F43-12, F43-13]

# Metrics
duration: 20min
completed: 2026-08-21
---

# Plan 43-05: Schema + Validação Override brief_review_confirmed Summary

**Schema de transporte e tipos do override ampliados — `productImageCheck` aceita `brief_review_confirmed` via `z.union` com `.strict()` preservado, `ValidationContext.overrides` e `InputValidationService.validate` tipados com ambos literais; lógica de skip inalterada (D5)**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- **`schema.ts` (`GenerateImageRequestSchema.inputValidationOverride.productImageCheck`)**: `z.literal("user_confirmed_continue").optional()` → `z.union([z.literal("user_confirmed_continue"), z.literal("brief_review_confirmed")]).optional()` — `.strict()` preservado; matriz de semântica documentada inline (brief_review_confirmed / user_confirmed_continue / sem override)
- **`schema.ts` (`ValidationContext.overrides.productImageCheck`)**: `"user_confirmed_continue"` → `"user_confirmed_continue" | "brief_review_confirmed"` — demais campos de `ValidationContext` inalterados
- **`input-validation-service.ts` (`validate`)**: parâmetro `override` aceita `productImageCheck?: "user_confirmed_continue" | "brief_review_confirmed"`; lógica de skip inalterada (pula para qualquer override truthy — cobre ambos literais); doc do serviço atualizada

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Schema — literal brief_review_confirmed no override (z.union, .strict preservado)** - (parte do commit do plano, feat)
2. **Task 2: ValidationContext.overrides.productImageCheck aceita ambos literais** - (parte do commit do plano, feat)
3. **Task 3: InputValidationService.validate aceita o novo literal** - (parte do commit do plano, feat)

## Files Created/Modified
- `src/lib/image-generation/schema.ts` - Union de literais + ValidationContext + matriz de semântica
- `src/lib/image-generation/services/input-validation-service.ts` - Tipo do override + doc atualizada

## Decisions Made
- Matriz de semântica documentada inline no schema (fonte única para os testes 17+ do 43-12)
- Lógica de skip inalterada (já cobria override truthy)

## Deviations from Plan

Nenhuma - plano executado como escrito.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- Schema e tipos aceitam `brief_review_confirmed` (D5 backend ponto 1 e 2)
- Capacidade `InputValidationService` intacta; sem mudança de lógica de skip
- Validações: typecheck limpo, 74 testes de image-generation passando
- Próximo: 43-06 (serviço `input_validation` skipped + GenerationProgress), que depende deste 43-05

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*