# Admin Metrics Dashboard

> Synced from `fase-28-observabilidade-operacao-launch-controls` (ADDED) + `fase-38-2-admin-custos-operacionais` (MODIFIED) + `fase-38-2-1-economic-snapshot` (MODIFIED).

## Purpose

Página `/admin/metrics` com cards de métricas operacionais (taxa de sucesso, erro rate, custo médio, tempo médio, créditos concedidos, estorno rate, users ativos) e health state banner, acessível apenas via admin.

## Requirements

### Requirement: Página /admin/metrics com proteção admin

O sistema SHALL criar a página `src/app/(app)/admin/metrics/page.tsx` como Server Component SSR, acessível apenas via `requireAdmin()`.

#### Scenario: Acesso negado sem role admin

- **WHEN** um usuário não-admin acessa `/admin/metrics`
- **THEN** o sistema retorna 403 ou redireciona (comportamento do admin guard existente)

#### Scenario: Página renderiza com dados frescos

- **WHEN** um usuário admin acessa `/admin/metrics`
- **THEN** a página consulta `generation_events`, `credit_transactions`, `generation_rate_events` via `supabaseAdmin`
- **AND** renderiza cards com valores dos períodos última hora, 24h e 7d

### Requirement: Cards de métricas (última hora / 24h / 7d)

A página SHALL exibir cards para cada métrica nos 3 períodos:

| Card | Descrição |
|------|-----------|
| Taxa de Sucesso | Percentual de `status=success` em `generation_events` |
| Erro Rate | Percentual de `status=failed` em `generation_events` |
| Custo Médio IA | Média de `estimated_cost_usd` em USD (apuração call-level), convertida para BRL com os snapshots disponíveis |
| Tempo Médio | Média de `duration_ms` em segundos |
| Créditos Concedidos | Total de transações `type=grant` em `credit_transactions` |
| Estorno Rate | Percentual de refunds sobre transações não-grant |
| Users Ativos | Contagem de `user_id` distintos em `generation_events` |

- O card de custo permanece "**Custo Médio IA**" (renomeado na F38.2) e é derivado da apuração call-level por entrega (média de `custo_usd_total` por `operation_run_id`), **não** do delivery marker `campaign_pipeline.estimated_cost_usd` (NULL por desenho desde a F38.1 — anti-dupla-contagem D1/D6)
- **Conversão USD→BRL com snapshot (F38.2.1):** quando os eventos do período têm `usd_brl_rate_at_generation`, a conversão usa os snapshots por evento (ou a taxa snapshotada média); **não recalcula histórico com o parâmetro corrente** quando há snapshot disponível
- **Fallback legacy (F38.2.1):** quando os eventos do período não têm snapshot (histórico anterior à fase), a conversão usa `economic_parameters.usd_brl_rate` corrente como fallback explícito — nunca usa o env `VENDEO_USD_BRL_RATE` (fonte única D2)
- **Estabilidade temporal (F38.2.1):** alterar `usd_brl_rate` no admin NÃO muda o "Custo Médio IA" de períodos cujos eventos já têm snapshot

#### Scenario: Cards exibem valores para 3 períodos

- **WHEN** a página `/admin/metrics` é renderizada
- **THEN** cada métrica aparece com valores para `1h`, `24h` e `7d`
- **AND** cards sem dados mostram "N/D"

#### Scenario: Card renomeado para "Custo Médio IA" (F38.2 D6)

- **WHEN** o card de custo médio é renderizado
- **THEN** o label exibido é "**Custo Médio IA**" e o valor é a média do custo de IA por entrega (apuração call-level)

#### Scenario: Custo exibido em BRL com conversão por economic_parameters (F38.2 D6)

- **WHEN** o card de Custo Médio IA é renderizado
- **THEN** o valor USD é convertido para BRL usando `economic_parameters.usd_brl_rate` (fonte única — D2), **não** o env `VENDEO_USD_BRL_RATE`
- **AND** exibido como "R$ 0,11" (formatação brasileira)

#### Scenario: Custo Médio IA usa snapshot da taxa quando disponível

- **WHEN** os eventos do período têm `usd_brl_rate_at_generation` e o admin altera `usd_brl_rate` depois
- **THEN** o card "Custo Médio IA" em BRL continua usando as taxas snapshotadas (não recalcula histórico)

#### Scenario: Custo Médio IA usa fallback do parâmetro corrente sem snapshot

- **WHEN** os eventos do período não têm `usd_brl_rate_at_generation` (histórico antigo)
- **THEN** a conversão usa `economic_parameters.usd_brl_rate` corrente como fallback explícito

#### Scenario: Custo Médio IA nunca usa env deprecado

- **WHEN** a página é renderizada
- **THEN** a conversão USD→BRL usa `economic_parameters.usd_brl_rate` (ou snapshot), nunca `VENDEO_USD_BRL_RATE`

### Requirement: Health state banner

O sistema SHALL exibir um banner no topo da página com o health state geral.
O health state geral é o **pior** entre todos os indicadores das últimas 24h.

#### Scenario: Todas as métricas saudáveis → healthy

- **WHEN** todas as métricas de 24h estão em zona healthy
- **THEN** o banner mostra "● Healthy" em verde

#### Scenario: Uma métrica em attention → attention

- **WHEN** qualquer métrica de 24h está em attention e nenhuma em pause
- **THEN** o banner mostra "● Attention" em amarelo

#### Scenario: Uma métrica em pause → pause

- **WHEN** qualquer métrica de 24h está em pause
- **THEN** o banner mostra "● Pause" em vermelho
