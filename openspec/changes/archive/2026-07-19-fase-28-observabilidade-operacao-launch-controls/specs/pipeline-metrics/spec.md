## ADDED Requirements

### Requirement: Funções de métricas agregadas

O sistema SHALL prover funções em `src/lib/metrics/pipeline-metrics.ts` que consultam `generation_events`, `credit_transactions` e `generation_rate_events` via `supabaseAdmin`. Cada função aceita um argumento `hours: number` (1, 24, 168 para 7 dias).

Todas as funções SHALL ser queries SQL diretas (sem cache, sem agregação prévia).

#### Scenario: getSuccessRate() com dados de sucesso

- **WHEN** `getSuccessRate(24)` é chamado e há 80 registros `success` e 20 `failed` em `generation_events` nas últimas 24h
- **THEN** retorna `80` (percentual 80%)

#### Scenario: getErrorRate() com dados mistos

- **WHEN** `getErrorRate(24)` é chamado e há 10 `failed` em 100 registros
- **THEN** retorna `10` (percentual 10%)

#### Scenario: getErrorRate() sem dados

- **WHEN** `getErrorRate(24)` é chamado e não há registros no período
- **THEN** retorna `0`

#### Scenario: getAvgCost() com custos variados

- **WHEN** `getAvgCost(24)` é chamado e há registros com custos USD 0.01, 0.02, 0.03
- **THEN** retorna `0.02` (média 0.02)

#### Scenario: getAvgCost() sem custos

- **WHEN** `getAvgCost(24)` é chamado e nenhum registro tem `estimated_cost_usd` populado
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
