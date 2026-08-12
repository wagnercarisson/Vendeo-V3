---
phase: 38.2.1-economic-snapshot
plan: 04
subsystem: api
tags: [operation-runs-service, snapshot, economic-parameters, brl, receita-estimada, fallback-legacy, tdd, origem, estabilidade-temporal]

# Dependency graph
requires:
  - phase: 38.2.1-economic-snapshot (38-2-1-01)
    provides: "4 colunas de snapshot em generation_events (usd_brl_rate_at_generation/credit_value_brl_at_generation + origens *_source_at_generation) com backfill aplicado no remoto"
  - phase: 38.2.1-economic-snapshot (38-2-1-03)
    provides: "RPCs admin_get_ai_operation_runs/_events expõem os 4 campos de snapshot/origem por run (1º evento com valor) e por evento — payload bruto que o service consome"
provides:
  - "OperationRunsService derivando BRL com SNAPSHOT do run/evento (snapshot ?? corrente), fallback legacy EXPLÍCITO e marcado (economic_parameter_fallback + revenueEstimationNote)"
  - "Contrato renomeado para nomenclatura estimada (D8): receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct + usdBrlRateSource/creditValueSource (union 4 valores) + revenueEstimationNote em OperationRun/OperationRunsSummary/SegmentAggregation"
  - "deriveSummary soma BRL JÁ derivados por run (sumValues(runs.map)) — taxas snapshotadas distintas não se misturam (D5); origens agregadas por regra de prevalência (fallback > backfilled > captured)"
  - "mapEvent/mapDetailRun com snapshot por evento: estimatedCostBrl = estimatedCostUsd × (snapshot do evento ?? corrente); run do detalhe carrega snapshots/origens do 1º evento"
  - "38 testes no arquivo do service (was 20+41): snapshot captured 5.20/2.00, backfilled com origem, fallback sinalizado, margem null com receita 0, líquidos como base, mistura de taxas 52+60, ESTABILIDADE TEMPORAL (corrente 6.00 não muda histórico snapshotted)"
affects: [38-2-1-05 api-ui-labels, 38-2-1-06 admin-metrics-snapshot, 38-2-1-07 verificacao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot ?? corrente com origem sempre explícita: deriveBrl aplica toNumber(raw.usd_brl_rate_at_generation) ?? params.usdBrlRate; origem = normalizeSource(raw.*_source_at_generation) ?? 'economic_parameter_fallback'; revenueEstimationNote derivada da origem do crédito (fallback → estimated_from_admin_credit_value; backfilled → backfilled_historical_approximation; captured → null)"
    - "deriveSummary soma derivados por run (D5): sumValues(runs.map(r => r.custoBrl)) em vez de custoUsdTotal × taxa única — taxas distintas não se misturam; margem derivada das somas (receita > 0 senão null)"
    - "Origem dominante do conjunto (aggregateSource): qualquer economic_parameter_fallback prevalece > backfilled_from_audit > backfilled_seed > captured_at_generation — determinístico para o summary"

key-files:
  created: []
  modified:
    - "src/lib/ai-cost/operation-runs-service.ts — tipos renomeados (D8) + snapshots + origens + note; deriveBrl com snapshot ?? corrente; deriveSummary soma por run; mapRun/mapDetailRun/mapEvent com snapshot; aggregateSource"
    - "src/lib/ai-cost/__tests__/operation-runs-service.test.ts — 38 testes (9 novos + 29 renomeados/atualizados); fixtures makeRawRun/makeDetailRun/makeEvent com defaults null de snapshot; estabilidade temporal"
    - "src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx — propagação mecânica do rename (receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct) [Rule 3]"
    - "src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx — propagação mecânica do rename [Rule 3]"
    - "src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx — propagação mecânica do rename [Rule 3]"
    - "src/app/(app)/admin/ai-operation-costs/segment-aggregations.tsx — propagação mecânica do rename [Rule 3]"
    - "src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx — fixture tipada OperationRun/OperationRunsSummary com campos novos [Rule 3]"

key-decisions:
  - "Origem do valor exposta com union de 4 valores em OperationRun/summary: captured_at_generation / backfilled_from_audit / backfilled_seed / economic_parameter_fallback — um valor backfilled NUNCA se apresenta como captured; fallback de leitura sempre sinalizado (T-38.2.1-11)"
  - "deriveSummary passa a somar os BRL JÁ derivados por run (D5/T-38.2.1-12): re-derivação do total USD com taxa única removida — alterar parâmetro corrente não recalcula histórico com snapshot (estabilidade temporal testada com corrente 6.00)"
  - "Agregação de origem do summary com precedência determinística: fallback > backfilled_from_audit > backfilled_seed > captured; revenueEstimationNote derivada da origem agregada do crédito"
  - "Evento call-level expõe snapshots/origens cruas (nullable) + estimatedCostBrl com snapshot do evento ?? corrente; run do detalhe usa os snapshots do RPC (1º evento do run — D6)"
  - "Os 3 campos agregados do summary (usdBrlRateSource/creditValueSource/revenueEstimationNote) são obrigatórios no contrato — planos 05/06 os consomem"

patterns-established:
  - "Pattern 1: derivação BRL centralizada com snapshot ?? corrente + origem derivada da persistência (normalizeSource) — fallback nunca silencioso (D4/D5)"
  - "Pattern 2: agregação de BRL no summary sempre por soma dos derivados por run — nunca re-derivar do total com taxa única (D5)"
  - "Pattern 3: TDD por camada: Task 1 (deriveBrl) RED→GREEN, Task 2 (deriveSummary) RED→GREEN — cada behavior testado antes da implementação"

requirements-completed: [F38.2.1-04, F38.2.1-05, F38.2.1-06, F38.2.1-07, F38.2.1-09, F38.2.1-13]

# Metrics
duration: 15min
completed: 2026-08-12
---

# Phase 38.2.1 Plan 04: Service deriva BRL com snapshot Summary

**`OperationRunsService` passa a derivar BRL com o snapshot econômico do run/evento (`snapshot ?? corrente`), fallback legacy explícito e marcado (`economic_parameter_fallback` + `revenueEstimationNote`), contrato renomeado para nomenclatura estimada (`receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct` + origens de 4 valores) e `deriveSummary` somando BRL já derivados por run (taxas snapshotadas distintas não se misturam — D5/D8, 38 testes verdes)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-12T13:18:00Z (aprox.)
- **Completed:** 2026-08-12T13:32:45Z
- **Tasks:** 3 (2 TDD com RED→GREEN + 1 teste/regressão)
- **Files modified:** 7 (service + test + 5 consumidores UI via Rule 3)

## Accomplishments

- **Contrato estimado (D8) no service:** `OperationRun`/`OperationRunsSummary`/`SegmentAggregation` renomeados — `receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct`; novos `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` (number|null), `usdBrlRateSource`/`creditValueSource` (union de 4: `captured_at_generation`/`backfilled_from_audit`/`backfilled_seed`/`economic_parameter_fallback`) e `revenueEstimationNote` (`estimated_from_admin_credit_value`/`backfilled_historical_approximation`/null). `OperationRunEvent` expõe snapshots/origens por evento. `RawOperationRun`/`RawEvent`/`RawDetailRun` espelham os 4 campos do RPC (plano 03). **Nenhum nome proibido residual** no escopo do plano (grep gate 0).
- **deriveBrl com snapshot (D1/D5/T-38.2.1-12):** `custoBrl = custoUsd × (usd_brl_rate_at_generation ?? corrente)`; `receitaEstimadaBrl = creditosLiquidos × (credit_value_brl_at_generation ?? corrente)` (estorno descontado — líquidos, nunca bruto); `resultadoEstimadoBrl = receita − custo`; `margemEstimadaPct = receita > 0 ? (resultado/receita)×100 : null`; origem = `normalizeSource(raw source) ?? "economic_parameter_fallback"`; note derivada da origem do crédito. Fallback **nunca silencioso** (T-38.2.1-11).
- **deriveSummary soma por run (D5/T-38.2.1-12):** `custoBrl = sumValues(runs.map(r => r.custoBrl))` (idem receita/resultado) — re-derivação `custoUsdTotal × params.usdBrlRate` removida; margem derivada das somas. Origens agregadas por `aggregateSource` (fallback prevalece > backfilled_from_audit > backfilled_seed > captured) + note derivada da origem agregada do crédito.
- **mapEvent/mapDetailRun (D6):** `estimatedCostBrl` do evento usa snapshot do evento (`1 × 5.20 = 5.20` no teste); run do detalhe carrega snapshots/origens do 1º evento do RPC de eventos; `deriveAggregations` renomeado (mesma lógica — soma BRL por run).
- **Testes (38 no arquivo do service):** snapshot captured 5.20/2.00 vence corrente; backfilled reflete origem (nunca captured) + note; fallback com `economic_parameter_fallback` + note; margem null com receita 0; líquidos como base (7 → 14, nunca 20); mistura de taxas 52+60 no summary; agregação de origens (captured+backfilled / snapshot+fallback / só captured); **ESTABILIDADE TEMPORAL** (corrente 6.00/3.00 alterada depois não muda o histórico snapshotted 5.20/2.00); detalhe com snapshot por evento; fixtures `makeDetailRun`/`makeEvent` com defaults null.

## Task Commits

Each task was committed atomically (TDD com RED→GREEN):

1. **Task 1: deriveBrl com snapshot + fallback explícito; tipos renomeados** — `89f0d92` (test: RED — rename assertions + 5 testes de snapshot/backfill/fallback/margem/líquidos) + `d9eca74` (feat: GREEN — tipos, deriveBrl, mapRun/mapDetailRun/mapEvent, propagação UI)
2. **Task 2: deriveSummary soma BRL por run; mapEvent/DetailRun com snapshot** — `0d251e8` (test: RED — 4 testes de summary agregado + detail snapshot) + `0ef4375` (feat: GREEN — sumValues por run + aggregateSource + origens obrigatórias no summary)
3. **Task 3: Testes de estabilidade temporal + fallback legacy + regressão** — `e71bd1d` (test — estabilidade temporal, backfilled_seed, fallback no summary, detail via fixtures)

## Files Created/Modified

- `src/lib/ai-cost/operation-runs-service.ts` - Tipos renomeados (D8) + `EconomicValueSource`/`RevenueEstimationNote`/`normalizeSource`/`aggregateSource`; `deriveBrl(raw, params)` com snapshot ?? corrente e origens; `deriveSummary` soma por run + origens agregadas; `mapRun`/`mapDetailRun`/`mapEvent` propagam snapshots; `deriveAggregations` renomeado
- `src/lib/ai-cost/__tests__/operation-runs-service.test.ts` - 38 testes; fixtures `makeRawRun`/`makeDetailRun`/`makeEvent` com defaults null de snapshot; estabilidade temporal
- `src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx` - [Rule 3] campos renomeados (labels inalterados — plano 05)
- `src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx` - [Rule 3] campos renomeados
- `src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx` - [Rule 3] campos renomeados
- `src/app/(app)/admin/ai-operation-costs/segment-aggregations.tsx` - [Rule 3] campos renomeados
- `src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx` - [Rule 3] fixture tipada com campos novos

## Decisions Made

- **Origem sempre explícita (T-38.2.1-11):** union de 4 valores derivada da persistência (`normalizeSource`) com fallback `economic_parameter_fallback` apenas em leitura — um valor backfilled nunca aparece como captured e o fallback nunca é silencioso.
- **deriveSummary por soma de derivados (D5/T-38.2.1-12):** remover `custoUsdTotal × params.usdBrlRate` (re-derivação com taxa única) em favor de `sumValues(runs.map(r => r.custoBrl))` — matematicamente correto para conjuntos com taxas snapshotadas distintas; parâmetro `params` removido da assinatura (call site atualizado).
- **Precedência determinística na agregação de origens:** fallback > backfilled_from_audit > backfilled_seed > captured (backfilled_from_audit precede backfilled_seed por ser evidência de audit mais forte); note derivada da origem agregada do crédito.
- **Evento expõe snapshot cru + derivado:** `OperationRunEvent` carrega os 4 campos de snapshot/origem do evento (nullable — evento pode não ter valor persistido) e `estimatedCostBrl` usa snapshot do evento ?? corrente; o run do detalhe usa os snapshots do RPC (1º evento do run — D6).
- **`deriveSummary` sem `params`:** a assinatura passou de `(runs, params)` para `(runs)` — a soma dos derivados não precisa dos correntes (o fallback já foi aplicado por run no deriveBrl).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Typecheck quebrado nos consumidores UI após o rename do contrato**
- **Found during:** Task 1 (GREEN — após renomear os campos do service)
- **Issue:** `npm run typecheck` (critério de aceite das Tasks 1-3) falhava: os 4 componentes UI tipados (`kpis-grid.tsx`, `operation-runs-table.tsx`, `run-detail-dialog.tsx`, `segment-aggregations.tsx`) acessavam `summary.receitaOpBrl`/`run.resultadoOpBrl`/`agg.margemOpPct` etc. e a fixture tipada `makeRun(): OperationRun`/`OperationRunsSummary` em `components.test.tsx` não tinha os campos novos obrigatórios. O plano lista apenas o service + seu teste em `files_modified`, mas a renomeação do contrato (D8) quebra o typecheck dos consumidores existentes — o gate não pode ser satisfeito sem propagar.
- **Fix:** Propagação MECÂNICA do rename nos 5 arquivos (somente acesso de campos/fixtures; **labels e textos inalterados** — "Receita operacional", tooltips, avisos ficam para o plano 05 que faz o trabalho de labels/origens na UI). Fixture `OperationRun` ganhou `usdBrlRateAtGeneration/creditValueBrlAtGeneration: null` + `usdBrlRateSource/creditValueSource: "economic_parameter_fallback"` + `revenueEstimationNote: "estimated_from_admin_credit_value"` (defaults de fallback).
- **Files modified:** kpis-grid.tsx, operation-runs-table.tsx, run-detail-dialog.tsx, segment-aggregations.tsx, __tests__/components.test.tsx
- **Verification:** `npm run typecheck` exit 0 após a propagação; teste de regressão dos 5 arquivos afetados verde (69 testes)
- **Committed in:** `d9eca74` (Task 1 GREEN)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** A propagação foi necessária para satisfazer o gate de typecheck — nenhuma mudança de label/comportamento de UI; o trabalho de labels "estimado" e badges de origem permanece no plano 05 (escopo correto).

## Issues Encountered

- **Falha de `Get-Content -Raw` no PowerShell 5.1** ao executar o grep gate global via script — contornado usando a ferramenta grep (0 ocorrências de nomes "Real" em src/). Nenhum impacto em código.
- **Nomes antigos remanescentes em fixtures de rotas (plano 05):** `route.test.ts`/`[operationRunId]/route.test.ts` e `page.test.tsx` ainda usam `receitaOpBrl`/`margemOpPct` em **fixtures de objeto literais não tipados** (mock do service nas rotas) — não quebram typecheck nem testes (regressão 69 verdes) e são atualizados no plano 05 (`tasks.md` 5.1/5.2 — contratos das rotas renomeiam os campos). Escopo deste plano (`src/lib/ai-cost/`) está 100% limpo (grep 0).
- **Detail snapshot test passou no RED da Task 2:** o teste de detalhe com snapshot (Task 2 Test 5) já passava no estado RED porque a Task 1 GREEN (conforme o plano — "mapEvent: estimatedCostBrl = ... snapshot do evento") implementou o wiring completo antes da Task 2. Não é violação de fail-fast (a implementação existia de task anterior); o teste documenta o contrato.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Contrato definido para API/UI (planos 05/06):** `OperationRun`/`OperationRunsSummary`/`SegmentAggregation`/`OperationRunEvent` com nomenclatura estimada + snapshots + origens de 4 valores + `revenueEstimationNote`; `deriveSummary` com origens agregadas obrigatórias.
- **Grep gate D8 satisfeito:** zero nomes proibidos (`receitaRealBrl`/`resultadoRealBrl`/`margemRealPct`) em src/; zero nomes antigos (`*OpBrl`/`*OpPct`) em `src/lib/ai-cost/`; remanescentes apenas em fixtures de testes das rotas/UI (escopo plano 05).
- **Estabilidade temporal comprovada por teste:** alterar `usd_brl_rate`/`credit_value_brl` corrente não recalcula custoBrl/receita/resultado/margem de runs com snapshot (teste 8.4 do design).
- **Pronto para:** 38-2-1-05 (api-ui-labels — renomear contratos nas rotas/UI + labels "estimado" + badges de origem), 38-2-1-06 (admin-metrics-snapshot), 38-2-1-07 (verificação final).

---
*Phase: 38.2.1-economic-snapshot*
*Completed: 2026-08-12*

## Self-Check: PASSED
- Arquivo `src/lib/ai-cost/operation-runs-service.ts` encontrado no disco (1/1 FOUND)
- Arquivo `src/lib/ai-cost/__tests__/operation-runs-service.test.ts` encontrado no disco (1/1 FOUND)
- Arquivo `.planning/phases/38.2.1-economic-snapshot/38-2-1-04-SUMMARY.md` encontrado no disco (1/1 FOUND)
- Commits presentes no git log (5/5 FOUND): `89f0d92` (Task 1 RED), `d9eca74` (Task 1 GREEN), `0d251e8` (Task 2 RED), `0ef4375` (Task 2 GREEN), `e71bd1d` (Task 3)
- `npx vitest run src/lib/ai-cost/__tests__/operation-runs-service.test.ts` → 38/38 verdes
- Regressão dos 5 arquivos consumidores (service + 2 rotas + 2 UI) → 69/69 verdes
- `npm run typecheck` → exit 0; `npm run lint` → exit 0
- Grep gate: `receitaRealBrl|resultadoRealBrl|margemRealPct` em src/ → 0; nomes antigos `*OpBrl/*OpPct` em src/lib/ai-cost/ → 0
