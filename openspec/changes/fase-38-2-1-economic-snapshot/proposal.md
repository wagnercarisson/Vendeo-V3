## Why

Na F38.2, `usd_brl_rate` e `credit_value_brl` são lidos como valores **correntes** em `economic_parameters` a cada consulta (`EconomicParameterService.getParameter`, `src/lib/ai-cost/operation-runs-service.ts:550-566`) e aplicados retroativamente a **todo** o histórico de métricas em BRL (`custoBrl`, `receitaOpBrl`, `resultadoOpBrl`, `margemOpPct`, KPIs, agregados, `/admin/metrics`). Isso faz com que alterar a cotação USD→BRL ou o valor estimado do crédito **mude resultados passados** — incorreto para a base contábil/resultado operacional que a F38.2 deveria servir antes da precificação beta. Descoberto em UAT da F38.2.

## What Changes

- **Snapshot econômico na geração**: persistir `usd_brl_rate_at_generation` e `credit_value_brl_at_generation` em `generation_events` no momento da geração/entrega (via `AiCostTracker.record`), tornando o histórico imutável.
- **Semântica separada dos dois snapshots**:
  - `usd_brl_rate_at_generation` = snapshot **contábil** do câmbio conhecido na geração; usado para converter `custoUsdTotal` → `custoBrl`. Estrutural, continua válido em fases futuras.
  - `credit_value_brl_at_generation` = snapshot **estimativo/fallback** do valor configurado do crédito na geração; usado **somente** para `receitaEstimadaBrl`, `resultadoEstimadoBrl`, `margemEstimadaPct`. **Nunca** nomeado/tratado como receita real. Futuro: receita real virá do lote/pacote/compra que originou o crédito (F39/Stripe), não deste fallback.
- **Nomenclatura/contrato**: renomear derivados de crédito para `receitaEstimadaBrl` / `resultadoEstimadoBrl` / `margemEstimadaPct`; evitar `receitaRealBrl`. Adicionar `creditValueSource` (`"economic_parameter_fallback"`) e `revenueEstimationNote` (`"estimated_from_admin_credit_value"`) quando o valor vier do fallback.
- **RPCs/services consomem snapshot quando existente**: `/api/admin/ai-operation-runs` (lista + detalhe) e `OperationRunsService` (`deriveBrl`, `deriveSummary`, `deriveAggregations`) usam as taxas snapshotadas por run quando presentes.
- **Fallback explícito para histórico antigo**: eventos sem snapshot usam parâmetro corrente **apenas como fallback marcado como estimado/legacy** (`creditValueSource`/`revenueEstimationNote` ou equivalente). Backfill aproximado via `economic_parameter_audit.created_at` se viável sem inflar o escopo; caso contrário documentado como fallback legacy.
- **`/admin/metrics`**: parar de recalcular histórico com parâmetro corrente quando houver snapshot disponível (card "Custo Médio IA" passa a derivar dos `custo_brl` snapshotados quando presentes).
- **UI**: deixar claro que alterar parâmetros econômicos vale para **novas gerações** e não recalcula histórico; labels diferenciam custo convertido BRL de receita estimada.
- **Estornos permanecem via créditos líquidos**: `receitaEstimadaBrl = creditosLiquidos × credit_value_brl_at_generation` (floor 0 já aplicado no RPC 38-2-12).
- **Fora de escopo**: pacotes de créditos / receita real por lote (fase futura); o modelo apenas se prepara para substituir o fallback depois.
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros.

## Capabilities

### New Capabilities

- `economic-snapshot`: Snapshot econômico por evento/entrega em `generation_events` (`usd_brl_rate_at_generation`, `credit_value_brl_at_generation`), persistido pelo tracker no momento da geração; semântica contábil vs estimada; fallback legacy explícito; backfill aproximado via audit; contrato de nomenclatura `receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct` + campos de origem/confiança.

### Modified Capabilities

- `ai-cost-tracker`: `AiCostTracker.record` passa a persistir os snapshots econômicos (`usd_brl_rate_at_generation`, `credit_value_brl_at_generation`) junto dos campos de confiança de custo.
- `ai-operation-runs-api`: RPCs/services de lista e detalhe passam a expor e usar os snapshots por run; derivações BRL passam a usar taxa snapshotada quando presente, com fallback legacy explícito; renomear derivados de crédito para `*Estimado*`.
- `ai-operation-costs`: UI do painel usa os valores renomeados (`receitaEstimadaBrl` etc.), mostra origem do valor (snapshot vs fallback) e indica que alteração de parâmetros vale para novas gerações.
- `pipeline-metrics`: `getAvgCost`/card "Custo Médio IA" do `/admin/metrics` usa `custo_brl` snapshotado quando disponível, não o parâmetro corrente.
- `economic-parameters`: documentar que o valor corrente vale para novas gerações (sem alteração de tabela/RPC — apenas contrato de interpretação e aviso na UI de Configurações Econômicas).

## Impact

- **Migrations novas**: `supabase/migrations/2026XXXXXX_f38_2_1_economic_snapshot.sql` — `ALTER TABLE generation_events ADD COLUMN IF NOT EXISTS usd_brl_rate_at_generation NUMERIC, credit_value_brl_at_generation NUMERIC` (+ opcional `custo_brl NUMERIC` materializado); backfill aproximado via janelas do `economic_parameter_audit` (LAG) com fallback para a seed `1.00`; revert commands.
- **Código modificado**: `src/lib/ai-cost/tracker.ts` (persiste snapshots), `src/lib/ai-cost/types.ts` (campos no `CostResolution`/event), `src/lib/ai-cost/operation-runs-service.ts` (`deriveBrl`/`deriveSummary`/`deriveAggregations` consomem snapshot; rename `receitaOpBrl`→`receitaEstimadaBrl`, etc.; `creditValueSource`/`revenueEstimationNote`), `src/lib/admin/schemas.ts` (se necessário para contratos), `src/app/(app)/admin/ai-operation-costs/*` (labels/UI), `src/app/(app)/admin/metrics/page.tsx` + `src/lib/metrics/pipeline-metrics.ts` (custo médio com snapshot), `src/app/(app)/admin/operation-costs/*` (aviso "vale para novas gerações").
- **Código novo**: testes de snapshot/fallback/renaming; ajuste nos testes existentes de service/UI/API; verificação SQL/integrada (estabilidade temporal).
- **RPCs**: `admin_get_ai_operation_runs`/`admin_get_ai_operation_run_events` passam a expor os campos de snapshot por run (campos adicionados, contrato backward-compatible). `admin_set_economic_parameter` **inalterado** (valor corrente continua sendo o alvo das edições; só muda a semântica de uso).
- **DB/dependências**: baseia-se em F38.1 (`generation_events`), F38.2 (`economic_parameters` + audit + RPCs + tracker). **Não** cria `operation_runs`; **não** altera ledger de créditos; **não** implementa pacotes de créditos (F39). Backfill usa somente `economic_parameter_audit` (append-only) e a seed `1.00`.
- **Riscos notáveis**: backfill é aproximado (eventos anteriores à 1ª alteração caem na seed 1.00); migração de rename de campos pode quebrar consumidores — mitigado por compat de contrato (manter campos antigos como alias ou atualizar consumidores no mesmo PR); UI nunca apresenta receita estimada como receita real.
