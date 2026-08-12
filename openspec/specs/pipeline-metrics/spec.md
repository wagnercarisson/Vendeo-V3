# Pipeline Metrics

> Synced from `fase-28-observabilidade-operacao-launch-controls` (ADDED) + `fase-38-2-admin-custos-operacionais` (MODIFIED) + `fase-38-2-1-economic-snapshot` (MODIFIED).

## Purpose

Funções de consulta agregada em `generation_events`, `credit_transactions` e `generation_rate_events` para alimentar o dashboard operacional, sem cache ou agregação prévia.

## Requirements

### Requirement: Funções de métricas agregadas

O sistema SHALL prover funções em `src/lib/metrics/pipeline-metrics.ts` que consultam `generation_events`, `credit_transactions` e `generation_rate_events` via `supabaseAdmin`. Cada função aceita um argumento `hours: number` (1, 24, 168 para 7 dias).

Todas as funções SHALL ser queries diretas via `supabaseAdmin` (sem cache em memória, sem agregação recomputada em JavaScript sobre dados brutos) — quando há agregação, ela ocorre **no banco** (SQL ou via RPC de apuração call-level), nunca por pós-processamento JS.

**F38.2 (D6):** `getAvgCost` deixa de ler o delivery marker `campaign_pipeline.estimated_cost_usd` (NULL por desenho desde a F38.1 — anti-dupla-contagem D1/D6) e passa a apurar o **custo médio de IA por entrega** a partir da **apuração call-level** (`admin_get_ai_costs` `by_operation_run` → média de `custo_usd_total`; ou o RPC de resumo novo `admin_get_ai_operation_runs`). O card correspondente é renomeado para "Custo Médio IA". `admin_get_metrics` (F28) permanece **inalterado** — a correção é na camada de leitura do front.

**F38.2.1 (snapshot econômico):** `getAvgCost` continua retornando a média **em USD** (base call-level, F38.1) — a conversão BRL acontece na página de métricas (ver spec `admin-metrics-dashboard`). Quando os eventos têm `usd_brl_rate_at_generation`, a conversão BRL usa os snapshots por evento (ou a média das taxas snapshotadas); quando não há snapshot, o fallback é o parâmetro corrente, **sinalizado**.

#### Scenario: getSuccessRate() com dados de sucesso

- **WHEN** `getSuccessRate(24)` é chamado e há 80 registros `success` e 20 `failed` em `generation_events` nas últimas 24h
- **THEN** retorna `80` (percentual 80%)

#### Scenario: getErrorRate() com dados mistos

- **WHEN** `getErrorRate(24)` é chamado e há 10 `failed` em 100 registros
- **THEN** retorna `10` (percentual 10%)

#### Scenario: getErrorRate() sem dados

- **WHEN** `getErrorRate(24)` é chamado e não há registros no período
- **THEN** retorna `0`

#### Scenario: getAvgCost() apura por entrega via call-level (F38.2 D6)

- **WHEN** `getAvgCost(24)` é chamado
- **THEN** apura o custo médio de IA **por entrega** a partir da apuração call-level (média de `custo_usd_total` por `operation_run_id`), **não** do delivery marker `campaign_pipeline.estimated_cost_usd`

#### Scenario: getAvgCost() NÃO lê mais campaign_pipeline.estimated_cost_usd (F38.2 D6)

- **WHEN** `getAvgCost(24)` é chamado
- **THEN** a função não consulta `campaign_pipeline.estimated_cost_usd` (delivery marker — NULL por desenho) para compor o custo médio

#### Scenario: getAvgCost() usa apuração call-level em USD

- **WHEN** `getAvgCost(24)` é chamado e há registros call-level com custos USD 0.01, 0.02, 0.03
- **THEN** retorna `0.02` (média 0.02, em USD)

#### Scenario: getAvgCost() sem custos retorna null

- **WHEN** `getAvgCost(24)` é chamado e não há entregas com custo call-level no período
- **THEN** retorna `null`

#### Scenario: getAvgDuration() com durações variadas

- **WHEN** `getAvgDuration(24)` é chamado e há registros com durações 10s, 20s, 30s
- **THEN** retorna `20` (média 20s)

#### Scenario: getCreditsGranted() retorna total de grants

- **WHEN** `getCreditsGranted(24)` é chamado e há 15 transações do tipo `grant` nas últimas 24h
- **THEN** retorna `15`

#### Scenario: getRefundRate() calcula percentual de estornos

- **WHEN** `getRefundRate(24)` é chamado e há 2 refunds em 10 transações não-grant nas últimas 24h
- **THEN** retorna `20` (percentual 20%)

#### Scenario: getActiveUsers() conta lojistas distintos

- **WHEN** `getActiveUsers(24)` é chamado e há registros de 3 `user_id` distintos nas últimas 24h
- **THEN** retorna `3`

### Requirement: MetricCard types

O sistema SHALL definir tipos em `src/lib/metrics/types.ts`:

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
