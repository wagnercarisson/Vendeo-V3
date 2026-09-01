---
phase: 43-revisao-brief-pre-geracao
plan: 08
subsystem: api
tags: [feature-flag, route, normalization, force-brief-vision-check, d5]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (D5 — flag administrativa + normalização ponta a ponta na rota)
  - phase: 43-07 (migration)
    provides: tabela feature_flags + RPC (aplicada no remoto pelo usuário)
  - phase: 43-06 (serviço skipped)
    provides: ImageGenerationService emite input_validation como skipped quando override pula
provides:
  - Serviço de leitura da flag force_brief_vision_check (server-only, fallback enabled=false, env var emergencial)
  - Rota generate-image com normalização effectiveParsedData quando flag ligada (remove brief_review_confirmed; user_confirmed_continue nunca removido)
affects: [43-12 (testes 17-23), 43-13 (testes 24-26), 43-14 (co-migração fixtures), 43-15 (UAT)]

# Tech tracking
tech-stack:
  added: [src/lib/feature-flags/feature-flag-service.ts]
  patterns: [server-only flag service with safe fallback, effectiveParsedData normalization in route]

key-files:
  created: [src/lib/feature-flags/feature-flag-service.ts]
  modified: [src/app/api/campaign/generate-image/route.ts]

key-decisions:
  - "Fallback de leitura da flag = false (não derruba geração); env var VENDEO_FORCE_BRIEF_VISION_CHECK=true apenas como fail-safe emergencial"
  - "Normalização remove APENAS brief_review_confirmed do inputValidationOverride — user_confirmed_continue nunca removido"

patterns-established:
  - "Capacidade InputValidationService reativável ponta a ponta sem redeploy (flag admin em banco)"

requirements-completed: [F43-20, F43-21]

# Metrics
duration: 40min
completed: 2026-08-21
---

# Plan 43-08: Rota skip + Normalização Flag + Serviço de Leitura Summary

**Serviço de leitura da flag `force_brief_vision_check` (server-only, fallback `enabled=false` que não derruba geração, env var emergencial) + rota `generate-image` com normalização `effectiveParsedData` ponta a ponta quando a flag está ligada — remove `brief_review_confirmed` do override antes do pré-stream; `user_confirmed_continue` nunca removido (D5)**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 2
- **Files modified:** 2 (1 criado + 1 modificado)

## Accomplishments
- **`feature-flag-service.ts`** (novo, server-only, padrão `OperationCostService`): constante `FORCE_BRIEF_VISION_CHECK_KEY`; classe `FeatureFlagService` + função `isForceBriefVisionCheckEnabled()` — lê `enabled` da tabela `feature_flags`; **fallback de leitura → `false`** (não derruba a geração, log warning/erro operacional); **env var emergencial `VENDEO_FORCE_BRIEF_VISION_CHECK=true`** pode forçar `true` (fail-safe infra, nunca decisão principal)
- **`route.ts`** (normalização ponta a ponta): após parse/intent-normalization, lê `isForceBriefVisionCheckEnabled()`; se **flag ligada** + `brief_review_confirmed` presente → monta `effectiveParsedData` removendo `brief_review_confirmed` do `inputValidationOverride` (antes do gate `:338`); usa o **mesmo `effectiveParsedData`** para `campaignInput`/`buildCampaignBrief`, `buildCampaignBriefFromFlat` e o gate pré-stream — pré-stream E Phase 1 do serviço executam a IA de visão (via `context.campaignInput` sem override); `user_confirmed_continue` **nunca removido**; flag desligada → usa `parsed.data` direto (comportamento padrão F43: `brief_review_confirmed` pula nos dois pontos); log de evento `feature_flag_force_vision_check` quando normaliza

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Serviço de leitura da flag force_brief_vision_check (fallback enabled=false)** - (parte do commit do plano, feat)
2. **Task 2: Route.ts — normalização ponta a ponta da flag (effectiveParsedData)** - (parte do commit do plano, feat)

## Files Created/Modified
- `src/lib/feature-flags/feature-flag-service.ts` - Serviço de leitura da flag (novo)
- `src/app/api/campaign/generate-image/route.ts` - Normalização effectiveParsedData + import do serviço

## Decisions Made
- Serviço como classe (padrão `OperationCostService`) + função auxiliar exportada — ambos reutilizáveis em teste
- `effectiveParsedData` é `parsed.data` (referência) quando flag off (zero overhead); shallow copy quando normaliza

## Deviations from Plan

Nenhuma - plano executado como escrito.

## Issues Encountered
None

## User Setup Required
None (migration já aplicada no remoto pelo usuário — 43-07 resolvido)

## Next Phase Readiness
- Capacidade `InputValidationService` reativável ponta a ponta sem redeploy (flag admin em banco)
- Validações: typecheck limpo, 129 testes (route 55 + image-generation 74) passando
- Próximo: 43-09 (admin — rota `PUT /api/admin/feature-flags` + página "Controles operacionais"), que consome o RPC da 43-07

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*