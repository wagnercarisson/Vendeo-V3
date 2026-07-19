## ADDED Requirements

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
| Custo Médio | Média de `estimated_cost_usd` em USD |
| Tempo Médio | Média de `duration_ms` em segundos |
| Créditos Concedidos | Total de transações `type=grant` em `credit_transactions` |
| Estorno Rate | Percentual de refunds sobre transações não-grant |
| Users Ativos | Contagem de `user_id` distintos em `generation_events` |

#### Scenario: Cards exibem valores para 3 períodos

- **WHEN** a página `/admin/metrics` é renderizada
- **THEN** cada métrica aparece com valores para `1h`, `24h` e `7d`
- **AND** cards sem dados mostram "N/D"

#### Scenario: Custo exibido em BRL com conversão

- **WHEN** o card de Custo Médio é renderizado
- **THEN** o valor USD é convertido para BRL usando `VENDEO_USD_BRL_RATE` (default 5.50)
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

