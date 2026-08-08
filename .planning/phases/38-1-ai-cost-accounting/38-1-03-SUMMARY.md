---
phase: 38-1-ai-cost-accounting
plan: 03
subsystem: api
tags: [admin, supabase-rpc, zod, ai-cost, pricing, reconciliation, nextjs]

# Dependency graph
requires:
  - phase: 38-1-01
    provides: RPCs admin_set_ai_model_price e admin_get_ai_costs + tabela ai_model_pricing versionada + views admin_ai_*/admin_cost_vs_credits
  - phase: 38-1-02
    provides: src/lib/ai-cost/types.ts (CostResolution/TokenUsage/AiCostEvent)
provides:
  - GET/PUT /api/admin/ai-model-pricing (versionamento imutável de preços — D8)
  - GET /api/admin/ai-costs (agregação por operation run/etapa + reconciliação USD × créditos — D3/D10)
  - AiCostAdminService (única via de leitura via RPC admin_get_ai_costs — sem .from() em views)
  - Schemas zod AiModelPricingQuery/Update + AiCostsQuery
  - 16 testes (6 pricing/API + 4 rota ai-costs + 6 contrato admin-service)
affects: [38-1-04 resolveAiCost, 38-1-10 views/RPCs apuração + UAT I1-I6, 38-1-11 trackings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rota admin financeira: requireAdmin + apiHandler + zod (400) + RPC definer + mapeamento de erro 400/500 (analog operation-costs)"
    - "Serviço de leitura admin com client injetável + erro fail-closed (AiCostAdminUnavailableError → 503)"
    - "Contrato RPC travado em teste: toHaveBeenCalledWith com os 8 p_* params exatos + mapeamento numerics→number"

key-files:
  created:
    - src/app/api/admin/ai-model-pricing/route.ts
    - src/app/api/admin/ai-model-pricing/__tests__/route.test.ts
    - src/app/api/admin/ai-costs/route.ts
    - src/app/api/admin/ai-costs/__tests__/route.test.ts
    - src/lib/ai-cost/admin-service.ts
    - src/lib/ai-cost/__tests__/admin-service.test.ts
  modified:
    - src/lib/admin/schemas.ts

key-decisions:
  - "Reconciliação (D10): o serviço repassa campos credit_tx_id/provider_reported_cost_usd/estimated_cost_usd quando presentes no JSONB do RPC (mapeamento por presença) — o RPC atual não os emite, mas o contrato do serviço já os suporta"
  - "GET ai-model-pricing: default = vigentes (effective_until IS NULL); includeHistory=true remove o filtro e ordena effective_from desc"
  - "Erro AiCostAdminUnavailableError definido no próprio admin-service.ts (padrão operation-cost-service), fail-closed → 503"

patterns-established:
  - "Pattern: rota admin + RPC definer financeiro com zod + requireAdmin + mapeamento msg.includes(...) → 400"
  - "Pattern: serviço com constructor(client = supabaseAdmin) injetável + toNumber() para NUMERIC do Postgres"
  - "Pattern: teste de rota com vi.mock de supabase/server (rpc/from) + chain builder para query GET"

requirements-completed: [F38.1-07, F38.1-08, F38.1-09, F38.1-10, F38.1-11, F38.1-12, F38.1-13, F38.1-14, F38.1-15, F38.1-16, F38.1-17, F38.1-18, F38.1-19]

# Metrics
duration: 8min
completed: 2026-08-08
---

# Phase 38.1 Plan 03: Admin — RPC Pricing + GET/PUT ai-model-pricing + ai-costs Summary

**Rotas admin de custo de IA: GET/PUT `/api/admin/ai-model-pricing` com versionamento imutável via RPC `admin_set_ai_model_price` (D8) e GET `/api/admin/ai-costs` via RPC `admin_get_ai_costs` (D3/D10), com AiCostAdminService, schemas zod e 16 testes de contrato.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-08T22:18:00Z
- **Completed:** 2026-08-08T22:26:21Z
- **Tasks:** 3
- **Files modified:** 7 (6 novos + 1 modificado)

## Accomplishments

- **GET/PUT `/api/admin/ai-model-pricing`** (D8): GET lista a estrutura vigente (1 linha por provider/model com `effective_until IS NULL`) com `includeHistory=true` trazendo as superseded ordenadas por `effective_from desc`; PUT valida zod (reason obrigatório + pelo menos uma dimensão de preço → 400), chama `admin_set_ai_model_price` com os 11 params (`p_actor_id` + `p_reason` + 5 dimensões + `p_source_url`/`p_source_note`) e responde `{ pricing: { id, provider, model, effectiveFrom, previousId } }` — o versionamento **nunca sobrescreve** (fecha a vigente + abre nova na mesma transação).
- **GET `/api/admin/ai-costs`** (D3/D10): `AiCostAdminService.getAiCosts` é a única via de leitura — **zero `.from()` em views** (D10); chama `admin_get_ai_costs` com os 8 params (`p_hours` default 24, mínimo 1) e mapeia o JSONB em 3 blocos: `operationRuns` (só call-level — delivery markers excluídos no SQL), `campaignStages` (por `generation_type`) e `reconciliation` (USD × créditos, com `credit_tx_id`/`provider_reported_cost_usd`/`estimated_cost_usd` repassados quando presentes).
- **Schemas zod** em `src/lib/admin/schemas.ts`: `AiModelPricingQuerySchema`, `AiModelPricingUpdateSchema` (p_reason antes dos opcionais, refine "pelo menos um custo") e `AiCostsQuerySchema` (`z.coerce` para hours, filtros `p_*`).
- **16 testes verdes**: 6 pricing/API (route ai-model-pricing) + 4 na rota ai-costs (403/400/200/503) + 6 contrato views/RPC no admin-service — todos com mockRpc/table-dispatcher no padrão operation-costs.
- **Gates**: 1626 testes passando (192 arquivos), typecheck/lint/build limpos.

## Task Commits

Cada tarefa foi commitada atomicamente com ciclo RED/GREEN:

1. **Task 1: Schemas + GET/PUT ai-model-pricing (versionamento D8)** - `bd907a8` (test: 6 casos) + `aa8663e` (feat: schemas + rota)
2. **Task 2: AiCostAdminService + GET ai-costs (agregação D3/D10)** - `2348e81` (test: 403/400/200/503) + `56e430f` (feat: admin-service + rota)
3. **Task 3: Testes 6.7 — contrato Views/RPC no admin-service** - `fc2bb9e` (test: 6 contrato)

**Ajuste pós-RED:** `7db8f2f` (test: isolate mockIs/mockOrder between GET calls)

## Files Created/Modified

- `src/lib/admin/schemas.ts` - Adicionados `AiModelPricingQuerySchema`, `AiModelPricingUpdateSchema` (reason obrigatório + refine de ao menos uma dimensão) e `AiCostsQuerySchema` (p_* filtros + hours coerced default 24)
- `src/app/api/admin/ai-model-pricing/route.ts` - GET (vigentes + histórico com includeHistory) + PUT (RPC versionado, mapeamento 400/500 por msg.includes)
- `src/app/api/admin/ai-model-pricing/__tests__/route.test.ts` - 6 testes (payload RPC, previousId, 400 reason/dimensão, 403, estrutura vigente + histórico + sourceUrl/sourceNote)
- `src/lib/ai-cost/admin-service.ts` - `AiCostAdminService` (client injetável), `AiCostAdminUnavailableError`, mapeamento 3 blocos com `toNumber`
- `src/app/api/admin/ai-costs/route.ts` - GET requireAdmin + zod (400) + service (503) + resposta `{ operationRuns, campaignStages, reconciliation }`
- `src/app/api/admin/ai-costs/__tests__/route.test.ts` - 4 casos (403/400/200/503)
- `src/lib/ai-cost/__tests__/admin-service.test.ts` - 6 testes de contrato (call-level only, campaignStages, provider_reported, credit_tx_id, 8 params exatos, numerics→number)

## Decisions Made

- **Reconciliação por presença (D10):** o serviço repassa `credit_tx_id`/`provider_reported_cost_usd`/`estimated_cost_usd` quando o JSONB do RPC os inclui — compatível com o RPC atual (que não os emite hoje) e com o contrato de teste do plano. Sem inventar campos.
- **GET default = vigentes:** `includeHistory=true` remove o filtro `.is("effective_until", null)` e ordena por `effective_from desc` — espelha o spec (vigentes + histórico).
- **`AiCostAdminUnavailableError` no próprio admin-service.ts** (padrão `OperationCostUnavailableError`) → 503 `ai_costs_unavailable` na rota.
- **toNumber local** para NUMERIC do Postgres (string|number → number) — sem inconsistência string/number no JSON de resposta (teste 18).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Teste GET combinado (Task 1):** ao consolidar os 6 cenários em um único `it`, os mocks `mockIs`/`mockOrder` acumulavam chamadas entre os dois GET do mesmo teste — corrigido com `mockClear()` antes do segundo GET (commit `7db8f2f`). Sem impacto em produção.
- **`admin_get_ai_costs` em 2 linhas do admin-service.ts:** o grep de verificação do plano exigia exatamente 1 ocorrência — o JSDoc da classe duplicava o nome do RPC; reescrito para citar apenas na chamada `.rpc()` (1 linha exata).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Rotas admin de preço e custos operacionais prontas para consumo por ferramentas de operação/observabilidade (sem página — HAS_UI 0).
- `AiCostAdminService` expõe o contrato para a F38.1-10 (verificação SQL/integrada I1-I6 e UAT) — as views/RPCs já estão no banco (38-1-01) e o contrato TS agora está travado em teste.
- Próximos plans: 38-1-04 (`resolveAiCost`), 38-1-05/06/07/08/09 (instrumentação), 38-1-10 (testes + gates), 38-1-11 (trackings).

---

*Phase: 38-1-ai-cost-accounting*
*Completed: 2026-08-08*

## Self-Check: PASSED

- 7/7 arquivos criados/modificados verificados em disco (`FOUND`)
- 6/6 commits verificados em `git log` (`bd907a8`, `aa8663e`, `2348e81`, `56e430f`, `fc2bb9e`, `7db8f2f`)
- Suíte do plano: 16 testes verdes nas 3 suítes; suíte completa 1626 testes (192 arquivos); typecheck/lint/build limpos
