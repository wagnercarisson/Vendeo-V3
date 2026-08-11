---
phase: 38.2-admin-custos-operacionais
plan: 02
subsystem: core-library
tags: [economic-parameters, typescript, server-only, supabase, fail-open, fail-closed, vitest]

# Dependency graph
requires:
  - phase: 38.2-admin-custos-operacionais (plan 38-2-01)
    provides: "economic_parameters (key PK, value NUMERIC CHECK > 0, updated_by) + audit append-only + seeds 1.00/1.00 + RPC admin_set_economic_parameter + RLS service_role-only"
  - phase: 38-credit-operation-costs
    provides: "padrão OperationCostService F38: service server-only com SupabaseClient injetável + erro fail-closed + fallback fail-open"
  - phase: 38-1-ai-cost-accounting
    provides: "padrão AiCostAdminUnavailableError + constructor client injectable (src/lib/ai-cost/admin-service.ts)"
provides:
  - "src/lib/economic/types.ts sem server-only: ECONOMIC_PARAMETER_KEYS = ['usd_brl_rate','credit_value_brl'], EconomicParameterKey (type derived), EconomicParameterResolution { key, value, source: 'table'|'fallback' } — D1/D2"
  - "src/lib/economic/economic-parameter-service.ts server-only: EconomicParameterService.getParameter (fail-open fallback 1.00 p/ linha inexistente; EconomicParameterUnavailableError fail-closed p/ erro real) + getAll (mescla tabela+fallback com source) — única camada de leitura de parâmetros"
  - "src/lib/economic/__tests__/economic-parameter-service.test.ts: 10 testes (5 casos do spec 12.1 + defesa value<=0/não-finito + sem escrita + ordem getAll)"
affects: [38-2-04 economic-parameters-api (GET/PUT), 38-2-05 operation-runs-service (custoBrl = custoUsdTotal × usd_brl_rate), 38-2-06 ai-operation-runs-api, 38-2-09 admin-metrics-correcao (usd_brl_rate fonte única), 38-2-10 verificacao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Padrão F38 de service server-only: import 'server-only' + constructor(private readonly client: SupabaseClient = supabaseAdmin) — cliente injetável para mocks em testes"
    - "Fail-open/fail-closed: linha inexistente → default seguro 1.00 com console.warn; erro real de leitura → throw classe de erro dedicada (→ 503 na API)"
    - "Defesa de valor inválido no service (value <= 0 ou não-finito → log + fallback 1.00) complementar ao CHECK value > 0 do banco (T-38.2-10)"
    - "Testes com vi.mock('@/lib/supabase/server') + table-dispatcher mockFrom + cliente mock injetado no constructor (padrão operation-cost-service.test.ts)"
    - "Normalização NUMERIC do Postgres: Number(data.value) + Number.isFinite (string | number)"

key-files:
  created:
    - "src/lib/economic/types.ts"
    - "src/lib/economic/economic-parameter-service.ts"
    - "src/lib/economic/__tests__/economic-parameter-service.test.ts"
  modified: []

key-decisions:
  - "Default/fallback de AMBOS os parâmetros = 1.00 (conservador — D1), via constante DEFAULT_ECONOMIC_PARAMETER_VALUE exportada do service"
  - "Defesa value <= 0 implementada no service (log + fallback 1.00, nunca propaga inválido) como complemento ao CHECK value > 0 do banco — T-38.2-10 mitigado em 3 camadas (service + CHECK + zod na rota 38-2-04)"
  - "getAll usa ordem fixa de ECONOMIC_PARAMETER_KEYS com .find() por chave — source visível por resolução para o admin"

patterns-established:
  - "Pattern 1: service de leitura de parâmetros econômicos (D2) — padrão OperationCostService F38, fail-open só para linha inexistente, fail-closed para erro real (→ 503)"
  - "Pattern 2: tipos compartilhados sem server-only no diretório src/lib/economic/ (importáveis por zod/UI/route tests)"
  - "Pattern 3: mock de teste com table-dispatcher (economic_parameters → { select }) + cliente injetado no constructor"

requirements-completed: [F38.2-01, F38.2-04]

# Metrics
duration: 3min
completed: 2026-08-11
---

# Phase 38.2 Plan 02: Types econômicos + EconomicParameterService Summary

**Tipos econômicos compartilhados (ECONOMIC_PARAMETER_KEYS/EconomicParameterKey/EconomicParameterResolution sem server-only) + EconomicParameterService server-only com fail-open (fallback 1.00) e fail-closed (EconomicParameterUnavailableError → 503), cobertos por 10 testes — fonte única de leitura dos parâmetros econômicos para toda a fase**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-11T00:09:57Z
- **Completed:** 2026-08-11T00:12:48Z
- **Tasks:** 3
- **Files modified:** 3 (3 arquivos criados)

## Accomplishments
- `src/lib/economic/types.ts` (sem server-only, D1): `ECONOMIC_PARAMETER_KEYS = ["usd_brl_rate", "credit_value_brl"] as const` (padrão const-array de `src/lib/ai-cost/types.ts`), `type EconomicParameterKey` derivado (chave inválida → erro de compile time), `interface EconomicParameterResolution { key, value, source: "table" | "fallback" }` — contrato entre banco, service, API (zod) e UI
- `src/lib/economic/economic-parameter-service.ts` (server-only, D2): `EconomicParameterService` com `constructor(private readonly client: SupabaseClient = supabaseAdmin)` (padrão OperationCostService F38); `getParameter` — linha existente → `{ key, value, source: "table" }` (NUMERIC normalizado com `Number()` + `Number.isFinite`), linha inexistente → fallback 1.00 fail-open com `console.warn`, erro real de leitura → `EconomicParameterUnavailableError` fail-closed (→ API 503); `getAll` — mescla tabela + fallback 1.00 com source visível na ordem fixa das chaves; defesa value <= 0 / não-finito → log + fallback 1.00 (T-38.2-10, complementa o CHECK value > 0 do banco); NENHUM método de escrita (escrita é via RPC `admin_set_economic_parameter` — 38-2-04)
- `src/lib/economic/__tests__/economic-parameter-service.test.ts`: 10 testes passando — os 5 casos do spec (tarefa 12.1): linha existente → source table; linha inexistente → fallback 1.00; erro real → rejects EconomicParameterUnavailableError; getAll mescla tabela+fallback com source; value <= 0 → defesa fallback — mais 5 extras: value não-finito (NaN), sem métodos de escrita expostos, ordem do getAll = ECONOMIC_PARAMETER_KEYS, value <= 0 no getAll, chamadas de mock verificadas (from/select/eq)
- Threat model atendido: T-38.2-08 (leitura só via service server-only/service_role; tipos sem server-only só com chaves), T-38.2-09 (fail-closed → 503; fail-open apenas linha inexistente com default conservador), T-38.2-10 (defesa tripla: service + CHECK banco + zod rota 38-2-04), T-38.2-SC (nenhum pacote instalado)

## Task Commits

Each task was committed atomically:

1. **Task 1: Tipos — src/lib/economic/types.ts (D1/D2)** - `c75ba76` (feat)
2. **Task 2: EconomicParameterService — getParameter fail-open/fail-closed + getAll (D2)** - `362f7be` (feat)
3. **Task 3: Testes completos do service (tarefa 12.1)** - `de9d5e8` (test)

**Plan metadata:** pendente (docs commit)

## Files Created/Modified
- `src/lib/economic/types.ts` - Chaves versionadas (`ECONOMIC_PARAMETER_KEYS` as const) + `EconomicParameterKey` + `EconomicParameterResolution` — sem server-only, importável por zod/UI/route tests (D1)
- `src/lib/economic/economic-parameter-service.ts` - `EconomicParameterService` (getParameter fail-open/fail-closed + getAll com source) + `EconomicParameterUnavailableError` + `DEFAULT_ECONOMIC_PARAMETER_VALUE = 1.0` — server-only, única camada de leitura (D2)
- `src/lib/economic/__tests__/economic-parameter-service.test.ts` - 10 testes (tarefa 12.1) — padrão vi.mock + table-dispatcher + client injetado

## Decisions Made
- **Default/fallback 1.00 para ambos os parâmetros** (D1 conservador): centralizado na constante `DEFAULT_ECONOMIC_PARAMETER_VALUE` exportada do service — consumidores futuros (38-2-05/06/09) não reimplementam o fallback
- **Defesa value <= 0 no service** (T-38.2-10): mesmo com CHECK `value > 0` no banco, o service valida `Number.isFinite(value) && value > 0` e cai em fallback 1.00 com log — nunca propaga valor inválido para a UI (defesa em profundidade)
- **getAll com ordem fixa das chaves** (`ECONOMIC_PARAMETER_KEYS.map` + `.find()` por linha): a UI sempre renderiza na ordem determinística usd_brl_rate → credit_value_brl, com source por resolução

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] grep verify `server-only` contava comentários JSDoc no types.ts**
- **Found during:** Task 1 (verificação de aceite `grep -c "server-only" == 0`)
- **Issue:** O JSDoc do types.ts mencionava "sem server-only" no texto — o grep do verify (`grep -c "server-only"` == 0) contava 1 ocorrência de comentário, falhando a checagem (que é sobre o import, não texto)
- **Fix:** Reformulada a frase do JSDoc para "módulo compartilhado, sem camada de servidor" (sem a string "server-only")
- **Files modified:** src/lib/economic/types.ts
- **Verification:** `grep -c "server-only" src/lib/economic/types.ts` = 0; typecheck limpo
- **Committed in:** c75ba76 (parte do commit da Task 1)

**2. [Rule 1 - Bug] grep verify `server-only` contava comentário no service**
- **Found during:** Task 2 (verificação de aceite `grep -c "server-only" == 1`)
- **Issue:** O JSDoc do service dizia "server-only, padrão OperationCostService F38" — grep contava 2 (import + comentário) em vez de 1
- **Fix:** Reformulado JSDoc para "módulo de servidor (padrão OperationCostService F38)"
- **Files modified:** src/lib/economic/economic-parameter-service.ts
- **Verification:** `grep -c "server-only" src/lib/economic/economic-parameter-service.ts` = 1; typecheck limpo
- **Committed in:** 362f7be (parte do commit da Task 2)

---

**Total deviations:** 2 auto-fixed (2 bugs de texto em comentários — Rule 1)
**Impact on plan:** Desvios cosméticos — os greps de verify do plano medem presença/ausência de `import "server-only"` por string matching; os comentários JSDoc casavam com o padrão. Nenhum impacto funcional; todos os 3 arquivos entregues conforme o contrato.

## Issues Encountered
- **PowerShell 5.1 não roda `npm` em pipeline** (`CantActivateDocumentInPipeline`): `npm run typecheck 2>&1 | Select-Object` falha nativamente — contornado com `cmd /c "npm run typecheck"`. Sem impacto na execução.
- **`requirements.mark-complete F38.2-01 F38.2-04` não aplicável**: a seção F38.2 de REQUIREMENTS.md ainda é placeholder (nota de 2026-08-10 — requisitos entram quando os specs OpenSpec forem aprovados). Os IDs do frontmatter do plano foram copiados para `requirements-completed` do SUMMARY (obrigatório pelo template), mas o check-off em REQUIREMENTS.md fica para quando a fase cadastrar os requisitos (38-2-10). Sem impacto na execução.
- **`state.add-decision --summary-file` gravou o SUMMARY inteiro como decisão**: o handler espera o texto da decisão em `--summary` (não o caminho de arquivo do SUMMARY). Corrigido removendo o bloco duplicado do STATE.md e adicionando as 3 decisões reais via `--summary`.

## Authentication Gates
Nenhum — plano sem operações de rede/deploy (só código + testes locais).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Base pronta para 38-2-04 (API economic-parameters):** `EconomicParameterService` é a camada de leitura do `GET /api/admin/economic-parameters` (lista com source) e o zod da rota valida `key` contra `ECONOMIC_PARAMETER_KEYS` (enum TS já exportado); `EconomicParameterUnavailableError` → 503 (fail-closed)
- **Pronto para 38-2-05/06/09:** `getParameter("usd_brl_rate")` será a fonte única de conversão USD→BRL do service de custos de operação (custoBrl = custoUsdTotal × usd_brl_rate), da API de runs e da correção do `/admin/metrics` (D1/D2)
- **Nenhum bloqueador** — schema econômico no remoto (38-2-01) + leitura testada (38-2-02) completam a fundação de parâmetros

---
*Phase: 38.2-admin-custos-operacionais*
*Completed: 2026-08-11*

## Self-Check: PASSED
- Arquivos: 3 arquivos de código + SUMMARY.md encontrados no disco (4/4 FOUND)
- Commits: c75ba76 (types), 362f7be (service), de9d5e8 (testes) presentes no git log (3/3 FOUND)
- Verificação: typecheck limpo; 10 testes verdes; types.ts sem `server-only` (0); service com `import "server-only"` (1)
