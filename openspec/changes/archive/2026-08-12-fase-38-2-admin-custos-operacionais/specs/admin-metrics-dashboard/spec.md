## MODIFIED Requirements

### Requirement: Cards de métricas (última hora / 24h / 7d)

A página SHALL exibir cards para cada métrica nos 3 períodos:

| Card | Descrição |
|------|-----------|
| Taxa de Sucesso | Percentual de `status=success` em `generation_events` |
| Erro Rate | Percentual de `status=failed` em `generation_events` |
| **Custo Médio IA** (F38.2 D6) | Média do custo de IA **por entrega** (apuração call-level, `operation_run_id`), **não** delivery marker `campaign_pipeline.estimated_cost_usd` |
| Tempo Médio | Média de `duration_ms` em segundos |
| Créditos Concedidos | Total de transações `type=grant` em `credit_transactions` |
| Estorno Rate | Percentual de refunds sobre transações não-grant |
| Users Ativos | Contagem de `user_id` distintos em `generation_events` |

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
