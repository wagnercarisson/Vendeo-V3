---
phase: 43-revisao-brief-pre-geracao
plan: 12
subsystem: testing
tags: [backend-tests, schema, route, service, skipped, d5]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (tasks.md §12 — Testes 17-23)
  - phase: 43-05 (schema + tipos)
    provides: literal brief_review_confirmed + ValidationContext com ambos literais
  - phase: 43-08 (rota + flag)
    provides: isForceBriefVisionCheckEnabled + normalização effectiveParsedData
  - phase: 43-06 (serviço skipped)
    provides: ImageGenerationService emite input_validation skipped
provides:
  - Suíte de testes 17-23 (schema/rota/serviço)
affects: [43-14 (regressão), 43-15 (verificação)]

# Tech tracking
tech-stack:
  added: [src/lib/image-generation/__tests__/schema.test.ts]
  patterns: [mockInputValidationValidate compartilhado na rota, mock isForceBriefVisionCheckEnabled, verificação de phase events skipped]

key-files:
  created: [src/lib/image-generation/__tests__/schema.test.ts]
  modified: [src/app/api/campaign/generate-image/__tests__/route.test.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts]

key-decisions:
  - "Observabilidade do pré-stream na rota via spy compartilhado do InputValidationService.validate"
  - "Observabilidade da normalização da flag via campaignInput capturado no mock do buildCampaignBrief"

patterns-established:
  - "Teste 22 valida pré-stream (validate chamado) + Phase 1 (override removido do campaignInput repassado) — consistência ponta a ponta"

requirements-completed: [F43-27]

# Metrics
duration: 50min
completed: 2026-08-21
---

# Plan 43-12: Testes 17-23 Backend/Schema/Rota/Serviço Summary

**Suíte de testes 17-23 validando o override `brief_review_confirmed` + flag `force_brief_vision_check` ponta a ponta: schema aceita/rejeita, rota pula/valida conforme override+flag, serviço emite `input_validation` como `skipped` sem fase falsa (D5)**

## Performance

- **Duration:** 50 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 2
- **Files modified:** 3 (1 criado + 2 modificados)

## Accomplishments
- **Teste 17 (`schema.test.ts`, novo):** Zod aceita `brief_review_confirmed` e `user_confirmed_continue` no `inputValidationOverride`; rejeita valor desconhecido (`.strict()`)
- **Teste 18 (`route.test.ts`):** rota com `brief_review_confirmed` + flag off → **pula** a IA de visão pré-stream (`mockInputValidationValidate` não chamado), 200
- **Teste 19 (`route.test.ts`):** rota com `user_confirmed_continue` → pula (comportamento atual preservado)
- **Teste 20 (`route.test.ts`):** rota sem override → validação IA **roda** (rede de segurança)
- **Teste 21 (`route.test.ts`):** flag **desligada** → `brief_review_confirmed` pula nos dois pontos (pré-stream não roda; override chega intacto no `campaignInput` repassado ao serviço via `buildCampaignBrief`)
- **Teste 22 (`route.test.ts`):** flag **ligada** → rota **normaliza** (remove `brief_review_confirmed` antes da checagem pré-stream); pré-stream **valida**; `campaignInput` repassado sem override (Phase 1 valida); `user_confirmed_continue` **nunca removido**
- **Teste 23 (`image-generation-service.test.ts`):** `ImageGenerationService` com override (ambos literais) → fase `input_validation` emitida **obrigatoriamente** `status: "skipped"` (via phase events), **nunca** `running → complete`; sem chamada real → sem evento de métrica `input_validation`

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Testes 17-20 (schema + rota skip/valida)** - (parte do commit do plano, test)
2. **Task 2: Testes 21-23 (flag desligada/ligada + serviço skipped)** - (parte do commit do plano, test)

## Files Created/Modified
- `src/lib/image-generation/__tests__/schema.test.ts` - Teste 17 (novo)
- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - Testes 18-22 + mocks (input validation spy, flag service)
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - Teste 23

## Decisions Made
- Rota: `mockInputValidationValidate` compartilhado (vi.hoisted) para observar quando a validação pré-stream roda/pula
- Rota: flag mockada via `mockIsForceBriefVisionCheckEnabled` (default false no beforeEach)
- Normalização observada via `campaignInput` capturado no mock do `buildCampaignBrief` (Phase 1 recebe `context.campaignInput`)

## Deviations from Plan

Nenhuma - plano executado como escrito. Ajustes de tipagem (casts `as any` para `.mock.calls` e literal `as const`) foram necessários para o typecheck.

## Issues Encountered
- Typecheck: `.mock` não tipado no import real de `buildCampaignBrief` → casts `as any`
- Typecheck: literal `string` vs união no `inputValidationOverride` do service test → `as const`

## User Setup Required
None

## Next Phase Readiness
- Override + flag validados ponta a ponta (schema/rota/serviço) — D5 coberto
- Validações: typecheck limpo, 93 testes (schema/route/service) passando
- Próximo: 43-13 (testes 24-26 admin da flag)

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*