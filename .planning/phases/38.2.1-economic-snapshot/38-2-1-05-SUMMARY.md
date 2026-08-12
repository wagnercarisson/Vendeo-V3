---
phase: 38.2.1-economic-snapshot
plan: 05
subsystem: api, ui
tags: [receita-estimada, origem-do-valor, fallback-legacy, backfill, aviso-semantica, kpis, tabela, drilldown, agregados, d8, tests]

# Dependency graph
requires:
  - phase: 38.2.1-economic-snapshot (38-2-1-04)
    provides: "OperationRunsService com contrato renomeado (D8): receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct + usdBrlRateSource/creditValueSource (union 4 valores) + revenueEstimationNote em OperationRun/OperationRunsSummary/SegmentAggregation; OperationRunEvent com snapshot/origem por evento; propagate mecânico do rename nos consumidores UI"
  - phase: 38.2.1-economic-snapshot (38-2-1-03)
    provides: "RPCs admin_get_ai_operation_runs/_events expõem os 4 campos de snapshot/origem por run e por evento — payload que o service consome e as rotas repassam"
provides:
  - "Testes das 2 rotas de operation runs sob o contrato renomeado (D8): receitaEstimadaBrl/resultadoEstimadaBrl/margemEstimadaPct + snapshots + origens (captured_at_generation/backfilled_from_audit/backfilled_seed/economic_parameter_fallback) + revenueEstimationNote; asserts negativos provam a ausência de receitaOpBrl/receitaRealBrl; route.ts × 2 intocadas (pass-through preservado)"
  - "Painel /admin/ai-operation-costs com nomenclatura estimada: KPIs 'Receita estimada (BRL)'/'Resultado estimado (BRL)'/'Margem estimada'; tabela com 'Receita estimada/Resultado estimado' por linha + badge de origem (parâmetro atual (fallback) / reconstruído de histórico); drilldown com labels estimados, origem do run e coluna Câmbio por evento (taxa snapshotada + origem; ausente → 'parâmetro atual (fallback)'); agregados por segmento 'Resultado estimado'/'Margem estimada'"
  - "Aviso de semântica F38.2.1-11 na página: 'Alterações nos parâmetros econômicos valem para novas gerações e não recalculam o histórico exibido' + legend CostBadgeLegend 'Estimativas operacionais — não custo financeiro reconciliado'"
  - "Testes de UI (components + page) sob o contrato renomeado com default snapshot captured: 22 testes verdes cobrindo labels, origem (fallback/backfilled) e aviso; 41 testes no run das 4 rotas/UI; 150 na regressão das áreas tocadas"
affects: [38-2-1-06 admin-metrics-snapshot, 38-2-1-07 verificacao, 7.2 operation-costs aviso]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Origem exibida na UI NUNCA inferida: sourceOriginLabel() mapeia EconomicValueSource do service (economic_parameter_fallback → 'estimado de parâmetro atual'/'parâmetro atual'; backfilled_* → 'reconstruído de histórico'; captured → null/'capturado') — a UI apenas exibe (T-38.2.1-14/15)"
    - "Fallback nunca sem marcação: badge/tooltip em KPI, linha da tabela, cabeçalho do run e câmbio do evento quando creditValueSource/usdBrlRateSource === 'economic_parameter_fallback' ou inicia com 'backfilled'"
    - "Contrato de teste por camada: fixtures de rota espelham o payload do service (mock pass-through — route.ts não muda); fixtures de UI usam default snapshot captured e divergem por cenário"

key-files:
  created: []
  modified:
    - "src/app/api/admin/ai-operation-runs/__tests__/route.test.ts — fixtures/asserts renomeados + snapshots/origens + 3 cenários (captured/backfilled/fallback) + asserts negativos D8"
    - "src/app/api/admin/ai-operation-runs/[operationRunId]/__tests__/route.test.ts — fixture de detalhe/evento com snapshot/origem + cenários fallback/backfilled + asserts negativos D8"
    - "src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx — labels estimados + badge de origem por card (sourceOriginLabel)"
    - "src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx — Receita estimada/Resultado estimado + badge de origem por linha"
    - "src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx — labels estimados + origem do run + coluna Câmbio por evento (snapshot ?? fallback explícito)"
    - "src/app/(app)/admin/ai-operation-costs/segment-aggregations.tsx — Resultado estimado/Margem estimada"
    - "src/app/(app)/admin/ai-operation-costs/page.tsx — aviso de semântica (F38.2.1-11) + legend CostBadgeLegend"
    - "src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx — fixtures com default snapshot + 4 cenários novos de origem + asserts renomeados + câmbio do evento"
    - "src/app/(app)/admin/ai-operation-costs/__tests__/page.test.tsx — fixtures renomeadas + snapshot + assert do aviso/legend"

key-decisions:
  - "Asserts negativos (not.toContain('receitaOpBrl'/'receitaRealBrl')) nos testes das rotas materializam o grep-gate D8 como contrato testável — a resposta NUNCA pode conter nomes proibidos; essas ocorrências nos arquivos de teste são intencionais (verificação), não fixtures"
  - "Fixtures de UI (makeRun/SUMMARY/makeListResult) passam a usar default snapshot captured (5.0/1.0, captured_at_generation, note null) — o cenário legado (fallback) vira divergência explícita, invertendo o default do plano 04 (fallback)"
  - "Origem exibida na UI exclusivamente do contrato do service (creditValueSource/usdBrlRateSource/usdBrlRateSourceAtGeneration): helper sourceOriginLabel por componente; a UI nunca infere origem (T-38.2.1-14)"
  - "Badge do design system não repassa props extras → data-testid/data-origin movidos para o wrapper div (Rule 1 — testes falhavam ao localizar o elemento)"
  - "Aviso de semântica colocado no page.tsx (F38.2.1-11) via componente SemanticNotice + legend CostBadgeLegend no caminho de dados — visível também no estado vazio"

patterns-established:
  - "Pattern 1: origem como dado de contrato na UI — EconomicValueSource mapeado por sourceOriginLabel (fallback/backfilled/captured); fallback sempre com badge (T-38.2.1-15)"
  - "Pattern 2: teste de pass-through sem tocar a rota — mocks do service carregam os campos novos e asserts provam o contrato na resposta (route.ts × 2 sem diff)"
  - "Pattern 3: fixture de UI com default realista (captured) e divergência por cenário (fallback/backfilled) — cada cenário de origem testado isoladamente"

requirements-completed: [F38.2.1-07, F38.2.1-11]

# Metrics
duration: 8min
completed: 2026-08-12
---

# Phase 38.2.1 Plan 05: API/UI — labels estimados, origem do valor e aviso de semântica Summary

**Testes das 2 rotas de operation runs sob o contrato renomeado (D8) com snapshots/origens (captured/backfilled/fallback) e painel /admin/ai-operation-costs com nomenclatura estimada (KPIs, tabela, drilldown, agregados), badge de origem do valor nunca inferida pela UI, aviso fixo 'valem para novas gerações' (F38.2.1-11) e legend de estimativas operacionais — 41 testes verdes no run-alvo, typecheck/lint limpos, route.ts × 2 intocadas**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-12T16:40:18Z
- **Completed:** 2026-08-12T16:48:32Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- **Rotas testadas sob o contrato renomeado (D8):** `route.test.ts` (lista) e `[operationRunId]/route.test.ts` (detalhe) tiveram fixtures/asserts migrados de `receitaOpBrl`/`resultadoOpBrl`/`margemOpPct` para `receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct`, com snapshots (`usdBrlRateAtGeneration`/`creditValueBrlAtGeneration`) e origens (`usdBrlRateSource`/`creditValueSource` — union de 4) + `revenueEstimationNote`. Três cenários por rota: **captured** (default 5.5/1.0, `captured_at_generation`, note null), **fallback legacy** (valores null → `economic_parameter_fallback` + `estimated_from_admin_credit_value` no run e evento) e **backfilled** (`backfilled_from_audit`/`backfilled_seed` + `backfilled_historical_approximation`). Asserts negativos (`not.toContain("receitaOpBrl")`/`"receitaRealBrl"`) provam o grep-gate D8 como contrato testável. **route.ts × 2 sem diff** (pass-through preservado — o serviço deriva, a rota repassa).
- **Painel com nomenclatura estimada (D8):** KPIs renomeados para "Receita estimada (BRL)"/"Resultado estimado (BRL)"/"Margem estimada" consumindo `summary.receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct`; tabela mostra "Receita estimada/Resultado estimado" por linha; drilldown usa "Receita estimada/Resultado estimado" no cabeçalho do run; agregados por segmento "Resultado estimado"/"Margem estimada". **Zero ocorrências** de "Receita operacional"/"Resultado operacional" nos `.tsx` de produção (grep gate 0 após remoção inclusive dos comentários).
- **Origem do valor exibida, nunca inferida (T-38.2.1-14/15):** helper `sourceOriginLabel` por componente mapeia a `EconomicValueSource` do service — `economic_parameter_fallback` → badge "estimado de parâmetro atual" (KPIs) / "parâmetro atual (fallback)" (tabela e câmbio do evento); `backfilled_*` → "reconstruído de histórico"; `captured_at_generation` → sem badge. KPIs: badge nos cards de custo BRL/receita/resultado/margem conforme `usdBrlRateSource`/`creditValueSource` do summary. Tabela: badge por linha via `creditValueSource` do run. Drilldown: origem do run no cabeçalho + **coluna Câmbio** por evento mostrando a taxa snapshotada e a origem (`5 · capturado`); evento sem snapshot → "parâmetro atual (fallback)" explícito. Fallback **nunca sem marcação**.
- **Aviso de semântica (F38.2.1-11):** `page.tsx` ganhou `SemanticNotice` fixo "Alterações nos parâmetros econômicos valem para novas gerações e não recalculam o histórico exibido" (visível com dados e no estado vazio) + legend `CostBadgeLegend` "Estimativas operacionais — não custo financeiro reconciliado" no caminho de dados.
- **Testes de UI sob o contrato novo:** fixtures `makeRun()`/`SUMMARY`/`makeListResult()` com default **snapshot captured** (5.0/1.0, `captured_at_generation`, note null — inverte o default fallback do plano 04); cenários novos: KPI fallback → badge "estimado de parâmetro atual"; KPI backfilled → "reconstruído de histórico"; run legado na tabela → "parâmetro atual (fallback)" com `data-origin="economic_parameter_fallback"`; run backfilled na tabela; run legado no detalhe → origem no cabeçalho + câmbio do evento fallback; fixtures de evento do drilldown com snapshot + assert "5 · capturado"; `page.test.tsx` asserta o aviso "valem para novas gerações" e a legend no SSR. 22 testes UI + 19 rotas = 41/41 no run-alvo; 150/150 na regressão das áreas tocadas.

## Task Commits

Each task was committed atomically:

1. **Task 1: Testes de rota — contratos renomeados + snapshot no run/evento** — `e44afd3` (test)
2. **Task 2: KPIs + tabela + drilldown + agregados com labels estimados e origem do valor** — `352af08` (feat)
3. **Task 3: Testes de UI — labels novos, origem, aviso** — `d08573c` (test)

## Files Created/Modified

- `src/app/api/admin/ai-operation-runs/__tests__/route.test.ts` - Fixtures/asserts renomeados (D8) + snapshots/origens/notes + cenários captured/backfilled/fallback + asserts negativos de nomenclatura
- `src/app/api/admin/ai-operation-runs/[operationRunId]/__tests__/route.test.ts` - Fixture de detalhe/evento com snapshot/origem por evento + cenários fallback/backfilled
- `src/app/(app)/admin/ai-operation-costs/kpis-grid.tsx` - Labels estimados + badge de origem por card (sourceOriginLabel sobre summary sources)
- `src/app/(app)/admin/ai-operation-costs/operation-runs-table.tsx` - Receita estimada/Resultado estimado + badge de origem por linha (fallback/backfilled)
- `src/app/(app)/admin/ai-operation-costs/run-detail-dialog.tsx` - Labels estimados + origem do run + coluna Câmbio por evento (snapshot ?? fallback explícito)
- `src/app/(app)/admin/ai-operation-costs/segment-aggregations.tsx` - Resultado estimado/Margem estimada
- `src/app/(app)/admin/ai-operation-costs/page.tsx` - SemanticNotice (F38.2.1-11) + legend CostBadgeLegend
- `src/app/(app)/admin/ai-operation-costs/__tests__/components.test.tsx` - Fixtures com default snapshot + cenários de origem + asserts renomeados + câmbio
- `src/app/(app)/admin/ai-operation-costs/__tests__/page.test.tsx` - Fixtures renomeadas + snapshot + assert aviso/legend

## Decisions Made

- **Asserts negativos como grep-gate testável:** `expect(runJson).not.toContain("receitaOpBrl")`/`"receitaRealBrl"` nos testes das rotas — as ocorrências dessas strings nos arquivos de teste são intencionais (verificação da ausência), não fixtures/contratos; documentado para o verificador.
- **Default de fixture invertido para captured:** as fixtures de UI passam a representar o snapshot real por padrão (5.0/1.0, `captured_at_generation`, note null); o cenário legado (fallback) diverge explicitamente — cada cenário de origem testado isoladamente.
- **Origem 100% do contrato:** a UI não possui lógica de inferência de origem — apenas mapeia `creditValueSource`/`usdBrlRateSource`/`usdBrlRateSourceAtGeneration` do service para rótulos visuais (T-38.2.1-14).
- **Coluna Câmbio no drilldown:** o evento expõe a taxa snapshotada + origem; evento sem valor persistido → "parâmetro atual (fallback)" — o fallback em leitura nunca aparece sem marcação no call-level.
- **data-testid no wrapper:** como o componente `Badge` do design system não repassa props extras, os atributos de teste foram colocados no wrapper div (Rule 1 — ver deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] data-testid/data-origin descartados pelo componente Badge**
- **Found during:** Task 3 (testes de UI — badge de origem)
- **Issue:** Os `data-testid`/`data-origin` passados ao `<Badge>` não eram renderizados: a `BadgeProps` do design system (`src/components/ui/badge.tsx`) só aceita `variant`/`children` e não repassa props extras → `getByTestId` falhava nos 2 testes novos de origem (KPI e tabela).
- **Fix:** Movidos `data-testid`/`data-origin` para o wrapper `<div>` que contém o badge, em `kpis-grid.tsx` e `operation-runs-table.tsx` (parte do commit da Task 3).
- **Files modified:** kpis-grid.tsx, operation-runs-table.tsx
- **Verification:** `npx vitest run` UI → 22/22 verdes (antes: 2 falhas).
- **Committed in:** `d08573c` (Task 3)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix necessário para os testes localizarem o indicador de origem; nenhuma mudança de comportamento/escopo. Todos os outros critérios do plano atendidos como escrito.

## Issues Encountered

- **Ocorrências residuais de `receitaRealBrl`/`receitaOpBrl` em src/:** apenas nos **asserts negativos** (`not.toContain`) dos testes das rotas (4 ocorrências) — são a materialização do grep-gate D8 exigida pelo plano ("o corpo da resposta NÃO contém receitaOpBrl/receitaRealBrl"), não contratos nem fixtures. Fixtures de teste 100% renomeadas (grep 0 em fixtures).
- **Grep gate global do plano 04 vs 05:** `receitaRealBrl|resultadoRealBrl|margemRealPct` em src/ → 0 em produção e fixtures; restam apenas as strings de verificação negativa citadas acima.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Contrato estimado consumido por completo (D8):** API testada sob `receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct` + snapshots + origens de 4 valores + `revenueEstimationNote`; UI com labels estimados, origem exibida (capturado/backfilled/fallback) e aviso F38.2.1-11; nenhum contrato/código/UI afirma receita real.
- **F38.2.1-07 e F38.2.1-11 satisfeitos** na camada de consumo (requisitos marcados para verificação).
- **Pronto para:** 38-2-1-06 (admin-metrics-snapshot — D7: `/admin/metrics` com `usd_brl_rate_at_generation`), 38-2-1-07 (verificação final), e o item 7.2 (aviso nas Configurações Econômicas `/admin/operation-costs`).

---
*Phase: 38.2.1-economic-snapshot*
*Completed: 2026-08-12*

## Self-Check: PASSED
- Arquivos no disco (10/10 FOUND): 9 arquivos-alvo modificados + SUMMARY.md
- Commits no git log (3/3 FOUND): `e44afd3` (Task 1 — testes das rotas), `352af08` (Task 2 — painel labels/origem/aviso), `d08573c` (Task 3 — testes de UI + fix data-testid)
- `npx vitest run` nas 2 rotas + UI do painel → 41/41 verdes (19 rotas + 22 UI)
- Regressão áreas tocadas (service + rotas + UI) → 150/150 verdes
- `npm run typecheck` → exit 0; `npm run lint` → exit 0
- Grep gates: labels "Receita estimada"/"Resultado estimado"/"Margem estimada" presentes nos .tsx de produção; "Receita operacional"/"Resultado operacional" 0 ocorrências nos .tsx de produção; `receitaOpBrl`/`resultadoOpBrl`/`margemOpPct` 0 ocorrências em .tsx de produção e fixtures de teste; aviso "valem para novas gerações" presente (page.tsx); `economic_parameter_fallback` referenciado nos componentes; route.ts × 2 sem diff
