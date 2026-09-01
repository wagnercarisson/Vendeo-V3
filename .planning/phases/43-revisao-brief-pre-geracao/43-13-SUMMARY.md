---
phase: 43-revisao-brief-pre-geracao
plan: 13
subsystem: testing
tags: [admin-tests, feature-flag, audit, fallback, d5]

# Dependency graph
requires:
  - phase: fase-43-revisao-brief-pre-geracao
    provides: OpenSpec F43 source of truth (tasks.md §13 — Testes 24-26)
  - phase: 43-09 (admin feature-flags)
    provides: rota PUT + página Controles operacionais + form
  - phase: 43-08 (serviço de leitura)
    provides: FeatureFlagService com fallback enabled=false + env var emergencial
  - phase: 43-07 (migration)
    provides: RPC admin_update_feature_flag (auditoria na mesma transação)
provides:
  - Suíte de testes 24-26 (admin da flag)
affects: [43-14 (regressão), 43-15 (verificação)]

# Tech tracking
tech-stack:
  added: [admin feature-flags route/page/form tests]
  patterns: [mockRpc/mockFrom para RPC de auditoria, FeatureFlagService com env var emergencial]

key-files:
  created: [src/app/api/admin/feature-flags/__tests__/route.test.ts, src/app/(app)/admin/feature-flags/feature-flags-form.test.tsx, src/app/(app)/admin/feature-flags/__tests__/page.test.tsx, src/lib/feature-flags/__tests__/feature-flag-service.test.ts]
  modified: []

key-decisions:
  - "Auditoria (action/target_type/metadata) validada pelo contrato do RPC admin_update_feature_flag (rota delega corretamente; auditoria na mesma transação do RPC)"

patterns-established:
  - "Cobertura D5 admin da flag: exibição, motivo obrigatório, persistência, auditoria e fallback de leitura"

requirements-completed: [F43-27]

# Metrics
duration: 40min
completed: 2026-08-21
---

# Plan 43-13: Testes 24-26 Admin da Flag Summary

**Suíte de testes 24-26 validando a flag administrativa `force_brief_vision_check` (D5): tela "Controles operacionais" exibe/permite alterar com motivo obrigatório, auditoria `feature_flag_update`/`feature_flag` via RPC e fallback de leitura que não derruba a geração + env var emergencial**

## Performance

- **Duration:** 40 min
- **Started:** 2026-08-21
- **Completed:** 2026-08-21
- **Tasks:** 2
- **Files modified:** 4 (criados)

## Accomplishments
- **Teste 24 (rota admin):** `PUT /api/admin/feature-flags` persiste a alteração via RPC `admin_update_feature_flag` (p_key/p_enabled/p_reason/p_actor_id/p_operation_id); motivo ausente → 400 sem RPC
- **Teste 24 (form):** tela exibe chave + descrição + estado "Desligada — padrão recomendado"; alteração com motivo dispara `PUT` com `enabled: true`; sem motivo → "Motivo obrigatório" + sem PUT
- **Teste 24 (page):** página "Controles operacionais" renderiza `force_brief_vision_check` com descrição; erro claro quando migration não aplicada (flag não encontrada)
- **Teste 25 (rota + form):** auditoria via RPC `admin_update_feature_flag` (action `feature_flag_update`, target_type `feature_flag`, target_id = feature_flags.id, metadata key/old_value/new_value/reason — na mesma transação do RPC); form envia `operationId` (idempotência)
- **Teste 26 (FeatureFlagService):** leitura normal retorna `enabled` da tabela; falha de leitura → `false` (não bloqueia geração, log warning); env var `VENDEO_FORCE_BRIEF_VISION_CHECK=true` força `true` (fail-safe emergencial)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Testes 24-25 (tela + motivo obrigatório persistido + auditoria)** - (parte do commit do plano, test)
2. **Task 2: Teste 26 (fallback de leitura + env var emergencial)** - (parte do commit do plano, test)

## Files Created/Modified
- `src/app/api/admin/feature-flags/__tests__/route.test.ts` - Testes 24/25 (API)
- `src/app/(app)/admin/feature-flags/feature-flags-form.test.tsx` - Testes 24/25 (UI)
- `src/app/(app)/admin/feature-flags/__tests__/page.test.tsx` - Teste 24 (page)
- `src/lib/feature-flags/__tests__/feature-flag-service.test.ts` - Teste 26

## Decisions Made
- Auditoria validada via contrato do RPC (a rota delega corretamente; a auditoria na mesma transação é responsabilidade do RPC — validado na migration 43-07)
- Fallback de leitura testado com erro de DB simulado (data null + error)

## Deviations from Plan

Nenhuma - plano executado como escrito.

## Issues Encountered
- `require("../route")` em `.test.ts` não resolve em vitest → `await import("../route")` (padrão do operation-costs)
- Import `afterEach` ausente no form test → typecheck falhou → corrigido

## User Setup Required
None

## Next Phase Readiness
- D5 admin da flag validado (exibição/persistência/auditoria/fallback)
- Validações: typecheck limpo, 159 testes admin/feature-flags passando
- Próximo: 43-14 (regressão e co-migração de fixtures)

---
*Phase: 43-revisao-brief-pre-geracao*
*Completed: 2026-08-21*