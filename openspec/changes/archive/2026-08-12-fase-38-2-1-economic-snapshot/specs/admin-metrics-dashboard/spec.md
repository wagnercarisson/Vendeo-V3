## MODIFIED Requirements

### Requirement: Cards de métricas (última hora / 24h / 7d)

O sistema SHALL manter os cards de métricas da página `/admin/metrics` com a semântica de snapshot econômico para o card de custo:

| Card | Descrição |
|------|-----------|
| Taxa de Sucesso | Percentual de `status=success` em `generation_events` |
| Erro Rate | Percentual de `status=failed` em `generation_events` |
| Custo Médio IA | Média de `estimated_cost_usd` em USD (apuração call-level), convertida para BRL com os snapshots disponíveis |
| Tempo Médio | Média de `duration_ms` em segundos |
| Créditos Concedidos | Total de transações `type=grant` em `credit_transactions` |
| Estorno Rate | Percentual de refunds sobre transações não-grant |
| Users Ativos | Contagem de `user_id` distintos em `generation_events` |

- O card de custo permanece "**Custo Médio IA**" (renomeado na F38.2) e é derivado da apuração call-level (não do delivery marker)
- **Conversão USD→BRL com snapshot:** quando os eventos do período têm `usd_brl_rate_at_generation`, a conversão usa os snapshots por evento (ou a taxa snapshotada média); **não recalcula histórico com o parâmetro corrente** quando há snapshot disponível
- **Fallback legacy:** quando os eventos do período não têm snapshot (histórico anterior à fase), a conversão usa `economic_parameters.usd_brl_rate` corrente como fallback explícito — nunca usa o env `VENDEO_USD_BRL_RATE` (fonte única D2)
- **Estabilidade temporal:** alterar `usd_brl_rate` no admin NÃO muda o "Custo Médio IA" de períodos cujos eventos já têm snapshot

#### Scenario: Cards exibem valores para 3 períodos

- **WHEN** a página `/admin/metrics` é renderizada
- **THEN** cada métrica aparece com valores para `1h`, `24h` e `7d`
- **AND** cards sem dados mostram "N/D"

#### Scenario: Custo Médio IA usa snapshot da taxa quando disponível

- **WHEN** os eventos do período têm `usd_brl_rate_at_generation` e o admin altera `usd_brl_rate` depois
- **THEN** o card "Custo Médio IA" em BRL continua usando as taxas snapshotadas (não recalcula histórico)

#### Scenario: Custo Médio IA usa fallback do parâmetro corrente sem snapshot

- **WHEN** os eventos do período não têm `usd_brl_rate_at_generation` (histórico antigo)
- **THEN** a conversão usa `economic_parameters.usd_brl_rate` corrente como fallback explícito

#### Scenario: Custo Médio IA nunca usa env deprecado

- **WHEN** a página é renderizada
- **THEN** a conversão USD→BRL usa `economic_parameters.usd_brl_rate` (ou snapshot), nunca `VENDEO_USD_BRL_RATE`
