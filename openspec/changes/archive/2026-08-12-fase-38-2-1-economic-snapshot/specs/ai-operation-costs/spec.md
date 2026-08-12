## MODIFIED Requirements

### Requirement: Página /admin/ai-operation-costs — "Custos de Operação"

O sistema SHALL manter a página `src/app/(app)/admin/ai-operation-costs/page.tsx` (Server Component, `force-dynamic`, `requireAdmin`) com as mesmas seções da F38.2 (D3), ajustando os contratos para a nomenclatura estimada e o uso de snapshots:

- **Filtros:** período (início/fim, presets 7/30/90 dias respeitando o limite de janela da API), loja, tipo de entrega, status, provider, model, `generation_type`, `operation_run_id` e **segmento econômico** (D9)
- **KPIs:** custo estimado total USD · custo estimado BRL · créditos debitados · **receita estimada BRL** · **resultado estimado BRL** · **margem estimada %** · tempo médio / P95 · total de entregas · entregas com erro / sucesso
- **Tabela por entrega:** data · tipo · loja · status · custo (USD/BRL) · créditos (breakdown bruto/estorno/líquido) · **receita estimada/resultado estimado** por run · tempo · chamadas · regenerações · provider/model · confiança (badge)
- **Drilldown:** detalhe call-level por etapa (via `GET /api/admin/ai-operation-runs/[id]`) com `estimated_cost_brl` (snapshot), badges e componentes de custo por chamada
- **Agregados por segmento econômico (D9):** custo por segmento · **resultado estimado por segmento** · **margem estimada % por segmento** · taxa de erro por segmento
- **Origem do valor exibida:** quando um valor derivado usa fallback (sem valor persistido), a UI sinaliza (ex.: tooltip/badge "estimado de parâmetro atual"); quando o valor é **backfilled** (origem `backfilled_from_audit`/`backfilled_seed`), a UI sinaliza "reconstruído de histórico" — `creditValueSource`/`usdBrlRateSource`/`revenueEstimationNote` do contrato
- **Aviso de semântica:** a UI exibe que **alterar parâmetros econômicos vale para novas gerações e não recalcula o histórico exibido**
- **Estado de erro 503** → "Serviço indisponível no momento" (fail-closed, padrão F38); **estado vazio** → "aguardando dados de geração"
- Link na navegação admin (`src/app/(app)/admin/layout.tsx` → "Custos de Operação")
- A UI exibe badge de confiança junto de cada valor + legend "estimativas operacionais, não custo financeiro reconciliado" e prepara o placeholder F38.3
- **Nunca** apresenta `receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct` como receita/resultado/lucro real

#### Scenario: Página renderiza KPIs e tabela com nomes estimados

- **WHEN** um admin acessa `/admin/ai-operation-costs` com dados
- **THEN** a página exibe KPIs e tabela com "Receita estimada", "Resultado estimado" e "Margem estimada" (não "Receita real"/"Lucro")

#### Scenario: Página mostra origem do valor quando fallback

- **WHEN** um run legado (sem snapshot) é exibido
- **THEN** a UI sinaliza que o valor de receita estimada veio do parâmetro econômico atual (fallback), via tooltip/badge

#### Scenario: Página informa que alteração de parâmetro não recalcula histórico

- **WHEN** a página (ou a tela de Configurações Econômicas) é exibida
- **THEN** há um aviso de que alterações em `usd_brl_rate`/`credit_value_brl` valem para novas gerações e não recalculam o histórico

#### Scenario: Drilldown abre detalhe call-level com snapshot

- **WHEN** um admin clica numa entrega
- **THEN** abre o detalhe call-level por etapa com custo BRL derivado do snapshot e badges

#### Scenario: Estado vazio exibe "aguardando dados de geração"

- **WHEN** não há runs no período filtrado
- **THEN** a página exibe o estado vazio

#### Scenario: Erro 503 exibe estado indisponível

- **WHEN** a leitura falha (fail-closed)
- **THEN** a página exibe "Serviço indisponível no momento" sem presumir custo

#### Scenario: Link na navegação admin

- **WHEN** um admin abre a navegação admin
- **THEN** há um link "Custos de Operação" para `/admin/ai-operation-costs`

### Requirement: Segmentação econômica da entrega (origem operacional do consumo)

O sistema SHALL manter a classificação de cada entrega quanto à **origem operacional do consumo** (D9) — derivada no service layer, exibida como "origem operacional do consumo", **não** como receita financeira definitiva:

| Segmento | Critério (best-effort, por evidência disponível) |
|----------|-----------------------------------------------|
| `test` | `stores.is_test_store = true` (loja de teste — F32/F33) |
| `freemium/promotional` | consumo coberto por grant (`bonus_onboarding`/`bonus_monthly`) — deduction com `metadata->>'bonus_amount' > 0` e `purchased_amount = 0` |
| `paid` | consumo coberto por crédito comprado — deduction com `metadata->>'purchased_amount' > 0`; mostra **zero/indisponível** enquanto não houver Stripe (F39) nem origem de compra rastreável |
| `manual/admin` | consumo coberto por `admin_grant` — shape real confirmado em `credit_transactions`; sem evidência confiável → `unknown`, nunca inferir errado |
| `unknown` | sem origem clara no ledger (fallback) |

- **Sem alteração no ledger** e **sem nova tabela de segmento**
- `paid`/`unknown` exibem **indicador de baixa confiança** quando derivados sem origem clara
- Resultado/margem continuam **estimados**: **resultado estimado / margem estimada %** — nunca lucratividade real
- **Preparação futura (sem implementar agora):** quando houver pacotes de créditos (F39), a receita real por segmento virá do lote/pacote/compra que originou o crédito consumido — o modelo atual de `receitaEstimadaBrl` via `credit_value_brl_at_generation` é **fallback** e será substituído

#### Scenario: loja de teste → segmento test

- **WHEN** a loja da entrega tem `is_test_store = true`
- **THEN** o segmento classificado é `test`

#### Scenario: deduction com bonus_amount > 0 e purchased_amount = 0 → freemium/promotional

- **WHEN** a deduction da entrega tem `metadata->>'bonus_amount' > 0` e `purchased_amount = 0`
- **THEN** o segmento classificado é `freemium/promotional`

#### Scenario: deduction com purchased_amount > 0 → paid

- **WHEN** a deduction da entrega tem `metadata->>'purchased_amount' > 0`
- **THEN** o segmento classificado é `paid` (com indicador de baixa confiança até Stripe/F39)

#### Scenario: admin_grant confirmado → manual/admin; shape não encontrado → unknown

- **WHEN** a evidência de `admin_grant` existe em `credit_transactions` (shape real confirmado)
- **THEN** o segmento classificado é `manual/admin`
- **AND WHEN** o shape de `admin_grant` não é encontrado (shape real divergente)
- **THEN** o segmento classificado é `unknown` (nunca inferir errado)

#### Scenario: sem evidência suficiente → unknown com baixa confiança

- **WHEN** não há evidência clara no ledger para a entrega
- **THEN** o segmento classificado é `unknown` com indicador de baixa confiança
