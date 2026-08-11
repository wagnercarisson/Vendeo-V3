## 1. Migration SQL — Snapshot econômico em generation_events

- [ ] 1.1 Criar `supabase/migrations/2026XXXXXX_f38_2_1_economic_snapshot.sql` com `ALTER TABLE public.generation_events ADD COLUMN IF NOT EXISTS` de 4 colunas: `usd_brl_rate_at_generation NUMERIC`, `credit_value_brl_at_generation NUMERIC`, `usd_brl_rate_source_at_generation TEXT`, `credit_value_brl_source_at_generation TEXT` — D1/D2
- [ ] 1.2 Backfill aproximado por chave: CTE (LAG/`ROW_NUMBER()` sobre `economic_parameter_audit`) reconstituindo o valor vigente por `created_at` do evento; sem audit anterior → seed `1.00`; **origem preenchida**: `backfilled_from_audit` (janela do audit) ou `backfilled_seed` (seed); **idempotente** (`WHERE valor IS NULL`) — D4
- [ ] 1.3 Revert commands por objeto; verificação: migration aplica em banco real (I1), backfill idempotente (rodar 2× não altera linhas preenchidas), **nenhum valor persistido sem origem**

## 2. Tipos + Tracker — snapshot no momento da geração

- [ ] 2.1 `src/lib/ai-cost/types.ts`: `AiCostEvent` ganha `usdBrlRateAtGeneration?: number | null`, `creditValueBrlAtGeneration?: number | null` e as origens `usdBrlRateSourceAtGeneration?: string | null`/`creditValueBrlSourceAtGeneration?: string | null` (opcionais — backward-compatible; delivery marker não exige) — D3
- [ ] 2.2 `src/lib/ai-cost/tracker.ts`: `record` persiste `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` do evento **com origem `captured_at_generation`** (nunca `backfilled_*`/`fallback`) — best-effort (snapshot NULL não bloqueia gravação) — D1/D3
- [ ] 2.3 Callers de início de run resolvem os parâmetros **uma vez no início** via `EconomicParameterService.getParameter` e propagam o snapshot nos `AiCostEvent` das chamadas filhas: `generate-image/route.ts:46`, `generate-without-logo/route.ts:61,236`, `brand-profile/*/route.ts:73,193,394,612`, `visual-signature/generate-without-logo/route.ts:236,365`, `src/lib/visual-signature/generation-events.ts:9` — D3

## 3. RPCs — expor snapshots e origens (contrato backward-compatible)

- [ ] 3.1 `admin_get_ai_operation_runs`: adicionar `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` **e origens** `usd_brl_rate_source_at_generation`/`credit_value_brl_source_at_generation` ao JSON de cada run (do evento de referência do run — primeiro evento com snapshot) — D6
- [ ] 3.2 `admin_get_ai_operation_run_events`: adicionar os snapshots e origens por evento call-level — D6
- [ ] 3.3 Sem leitura direta das views; `admin_get_ai_costs`/`admin_get_metrics` **inalterados**; verificação I2 (campos presentes, contrato não quebrado)

## 4. Service — derivar com snapshot e nomenclatura estimada

- [ ] 4.1 `src/lib/ai-cost/operation-runs-service.ts`: `deriveBrl` usa `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` do run com fallback aos parâmetros correntes; `custoBrl = custoUsd × (snapshot ?? corrente)` — D1/D5
- [ ] 4.2 `deriveBrl`: `receitaEstimadaBrl = creditosLiquidos × (credit_value_brl_at_generation ?? corrente)`, `resultadoEstimadoBrl = receitaEstimadaBrl − custoBrl`, `margemEstimadaPct = receitaEstimadaBrl > 0 ? (resultadoEstimadoBrl/receitaEstimadaBrl)×100 : null`; **expor `creditValueSource`/`usdBrlRateSource` com a origem real** (`captured_at_generation`/`backfilled_from_audit`/`backfilled_seed` do run, ou `economic_parameter_fallback` no fallback) e `revenueEstimationNote` — D2/D5
- [ ] 4.3 `deriveSummary`: somar BRL **já derivados por run** (não re-derivar do total USD com taxa única); manter `deriveAggregations` somando BRL por run — D5
- [ ] 4.4 `mapDetailRun`/`mapRun`/detalhe de eventos: aplicar o mesmo padrão de snapshot/origem por evento/run — D5

## 5. API — contratos de operation runs (renomear estimados + origens)

- [ ] 5.1 `src/app/api/admin/ai-operation-runs/route.ts` + `[operationRunId]/route.ts`: contratos expõem `receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct` (renomeados de `receitaOpBrl`/`resultadoOpBrl`/`margemOpPct`); `custoBrl` mantido; `creditValueSource`/`usdBrlRateSource`/`revenueEstimationNote` no fallback e nos backfilled — D8
- [ ] 5.2 Schemas/UI types atualizados (sem `receitaRealBrl` em nenhum contrato) — D8

## 6. /admin/metrics — custo médio com snapshot

- [ ] 6.1 `src/lib/metrics/pipeline-metrics.ts`: `getAvgCost` mantém média USD call-level (não lê delivery marker); expor/derivar conversão com snapshots quando disponíveis — D7
- [ ] 6.2 `src/app/(app)/admin/metrics/page.tsx` + `metrics-cards.tsx`: conversão BRL usa `usd_brl_rate_at_generation` (snapshot) quando disponível; fallback `economic_parameters.usd_brl_rate` corrente (explícito); nunca `VENDEO_USD_BRL_RATE` — D7

## 7. UI — painel e Configurações Econômicas

- [ ] 7.1 `src/app/(app)/admin/ai-operation-costs/*`: labels "Receita estimada"/"Resultado estimado"/"Margem estimada"; origem do valor sinalizada (capturado/backfilled/fallback — tooltip/badge); aviso "alteração vale para novas gerações" — D8
- [ ] 7.2 `src/app/(app)/admin/operation-costs/page.tsx`/`operation-costs-form.tsx`: aviso de que alterar `usd_brl_rate`/`credit_value_brl` vale para novas gerações e não recalcula histórico — D8
- [ ] 7.3 Atualizar fixtures/tests de UI para os novos labels/contratos/origens

## 8. Testes

- [ ] 8.1 Tracker: `record` persiste os 2 snapshots **com origem `captured_at_generation`**; evento sem snapshot grava NULL sem erro — D1/D3
- [ ] 8.2 Service: run com snapshot usa taxa snapshotada (não a corrente); **origem exposta** (`captured_at_generation`/`backfilled_from_audit`/`backfilled_seed`); run sem valor usa fallback com `creditValueSource`/`revenueEstimationNote`; `deriveSummary` soma BRL por run com taxas distintas; `margemEstimadaPct` null quando receita estimada 0 — D5
- [ ] 8.3 API: contratos renomeados (`receitaEstimadaBrl` etc.); snapshot do run usado; fallback legacy sinalizado; **origem backfilled não aparece como capturado** — D6/D8
- [ ] 8.4 Estabilidade temporal: alterar `usd_brl_rate`/`credit_value_brl` depois não muda `custoBrl`/`receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct` de runs com snapshot (critérios de aceite 1-2)
- [ ] 8.5 `/admin/metrics`: card "Custo Médio IA" usa snapshot quando disponível; não recalcula histórico (critério de aceite 4)
- [ ] 8.6 Backfill: migration reconstitui janelas do audit e seed 1.00 com origem `backfilled_*`; idempotente — D4
- [ ] 8.7 Contrato/nomenclatura: nenhum contrato afirma "receita real" para valores estimados (critério de aceite 5)

## 9. Verificação

- [ ] 9.1 Verificação SQL/integrada: migration aplica (4 colunas); snapshots e origens persistidos pelo tracker; RPCs expõem campos; backfill idempotente com origem; estabilidade temporal em banco real (alterar parâmetro → histórico não muda) — padrão F38/F38.1
- [ ] 9.2 Rodar `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — sem regressões (1839+ testes)
- [ ] 9.3 Regressão manual UAT: alterar `usd_brl_rate`/`credit_value_brl` em Configurações Econômicas → histórico do painel não muda; nova geração usa os valores vigentes; labels estimados; origem exibida (capturado vs reconstruído vs fallback); aviso "vale para novas gerações"; `/admin/metrics` estável
