## MODIFIED Requirements

### Requirement: Funções de métricas agregadas

O sistema SHALL manter as funções em `src/lib/metrics/pipeline-metrics.ts` consultando `generation_events`, `credit_transactions` e `generation_rate_events` via `supabaseAdmin`, com `getAvgCost` ajustada para a semântica de snapshot econômico:

- `getAvgCost` continua retornando a média **em USD** (base call-level, F38.1) — a conversão BRL acontece na página de métricas (ver delta `admin-metrics-dashboard`)
- `getAvgCost` SHALL expor (ou a página derivar) a média de custo com os snapshots disponíveis: quando os eventos têm `usd_brl_rate_at_generation`, a conversão BRL usa os snapshots por evento (ou a média das taxas snapshotadas); quando não há snapshot, o fallback é o parâmetro corrente, **sinalizado**
- `getAvgCost` NÃO lê `campaign_pipeline.estimated_cost_usd` (delivery marker — NULL por desenho desde F38.1; anti-dupla-contagem D1/D6) — mantém a apuração call-level

#### Scenario: getAvgCost usa apuração call-level em USD

- **WHEN** `getAvgCost(24)` é chamado e há registros call-level com custos USD 0.01, 0.02, 0.03
- **THEN** retorna `0.02` (média 0.02, em USD)

#### Scenario: getAvgCost não lê delivery marker

- **WHEN** há delivery markers `campaign_pipeline` com `estimated_cost_usd` NULL
- **THEN** `getAvgCost` ignora os delivery markers (apuração call-level, não NULL por desenho)

#### Scenario: getAvgCost sem custos

- **WHEN** `getAvgCost(24)` é chamado e nenhum registro tem custo populado
- **THEN** retorna `null`

### Requirement: MetricCard types

O sistema SHALL manter os tipos em `src/lib/metrics/types.ts` sem alteração:

```typescript
export type HealthState = "healthy" | "attention" | "pause";

export type TimeRange = "1h" | "24h" | "7d";

export interface MetricCard {
  label: string;
  value: number | string | null;
  unit?: string;
  timeRange: TimeRange;
}
```

#### Scenario: Tipos exportados corretamente

- **WHEN** importado de `@/lib/metrics/types`
- **THEN** `HealthState`, `TimeRange` e `MetricCard` estão disponíveis
