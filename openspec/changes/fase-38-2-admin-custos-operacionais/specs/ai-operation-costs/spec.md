## ADDED Requirements

### Requirement: Página /admin/ai-operation-costs — "Custos de Operação"

O sistema SHALL criar a página `src/app/(app)/admin/ai-operation-costs/page.tsx` (Server Component, `force-dynamic`, `requireAdmin`, padrão das páginas admin — D3):

- **Filtros:** período (início/fim, com **presets 7/30/90 dias** respeitando o limite de janela da API), loja (`store_id`), tipo de entrega (`operation_run_type`), status (`delivery_status`), provider, model, `generation_type`, `operation_run_id` e **segmento econômico** (D9)
- **KPIs:** custo estimado total USD · custo estimado BRL · créditos debitados · receita operacional BRL · resultado operacional estimado BRL · margem operacional estimada % · tempo médio / P95 · total de entregas · entregas com erro / sucesso
- **Tabela por entrega:** data · tipo · loja · status · custo (USD/BRL) · créditos · tempo · chamadas · regenerações · provider/model principal · confiança (badge)
- **Drilldown:** ao clicar numa entrega, abre o detalhe call-level por etapa (via `GET /api/admin/ai-operation-runs/[id]`) com `estimated_cost_brl`, badges e **componentes de custo por chamada** (`text_component_usd`/`image_tool_component_usd`) para explicar gargalos/distorções (ex.: imagem dominando o custo)
- **Agregados por segmento econômico (D9):** gerações por hora · por owner (dono da loja, via `stores.user_id` — não o executor técnico) · por loja · por tipo de entrega · por status · por segmento · custo por segmento · resultado operacional estimado por segmento · margem operacional estimada % por segmento · taxa de erro por segmento
- **Custo por:** tipo de entrega · etapa (`generation_type`) · provider/model — com os mesmos badges de confiança
- **KPIs e agregados vêm do contrato `GET /api/admin/ai-operation-runs`** (spec `ai-operation-runs-api`): `summary` alimenta os KPIs e `aggregations` alimenta os agregados — a página **nunca** calcula KPIs/agregados sobre a página atual de `runs`
- **Estado de erro 503** → "Serviço indisponível no momento" (fail-closed, padrão F38); **estado vazio** → "aguardando dados de geração"
- Link na navegação admin (`src/app/(app)/admin/layout.tsx` → "Custos de Operação")
- A UI exibe badge de confiança junto de cada valor + legend "estimativas operacionais, não custo financeiro reconciliado" e **prepara o placeholder F38.3**: "Custo estimado Vendeo" / "Custo reconciliado provider: ainda indisponível" / "Diferença: pendente"

#### Scenario: Página renderiza KPIs e tabela com badges

- **WHEN** um admin acessa `/admin/ai-operation-costs` com dados
- **THEN** a página exibe os KPIs e a tabela por entrega com badges de confiança

#### Scenario: Drilldown abre detalhe call-level

- **WHEN** um admin clica numa entrega
- **THEN** abre o detalhe call-level por etapa (via endpoint de detalhe) com custo BRL, badges e os componentes `text_component_usd`/`image_tool_component_usd` por chamada

#### Scenario: Estado vazio exibe "aguardando dados de geração"

- **WHEN** não há runs no período filtrado
- **THEN** a página exibe o estado vazio

#### Scenario: Filtros atualizam a listagem

- **WHEN** um admin altera filtros (período, loja, tipo, status, segmento, etc.)
- **THEN** a listagem de entregas/KPIs atualiza respeitando os filtros

#### Scenario: Período usa presets respeitando o limite de janela

- **WHEN** um admin usa os presets de período (7/30/90 dias) ou seleciona datas
- **THEN** a UI envia `period_start`/`period_end` dentro do limite da API e exibe erro claro se a janela exceder 365 dias

#### Scenario: Erro 503 exibe estado indisponível

- **WHEN** a leitura falha (fail-closed)
- **THEN** a página exibe "Serviço indisponível no momento" sem presumir custo

#### Scenario: Link na navegação admin

- **WHEN** um admin abre a navegação admin
- **THEN** há um link "Custos de Operação" para `/admin/ai-operation-costs`

### Requirement: Segmentação econômica da entrega (origem operacional do consumo)

O sistema SHALL classificar cada entrega do painel `/admin/ai-operation-costs` quanto à **origem operacional do consumo** (D9) — **derivada no service layer** (nunca no RPC de apuração), exibida como "origem operacional do consumo", **não** como receita financeira definitiva:

| Segmento | Critério (best-effort, por evidência disponível) |
|----------|-----------------------------------------------|
| `test` | `stores.is_test_store = true` (loja de teste — F32/F33) |
| `freemium/promotional` | consumo coberto por grant (`bonus_onboarding`/`bonus_monthly`) — deduction com `metadata->>'bonus_amount' > 0` e `purchased_amount = 0` |
| `paid` | consumo coberto por crédito comprado — deduction com `metadata->>'purchased_amount' > 0`; mostra **zero/indisponível** enquanto não houver Stripe (F39) nem origem de compra rastreável |
| `manual/admin` | consumo coberto por `admin_grant` — **a implementação DEVE confirmar o shape real em `credit_transactions`** (pode ser `type`, `metadata.reason`, `metadata.source`, etc.); sem evidência confiável → cai em `unknown`, nunca inferir errado |
| `unknown` | sem origem clara no ledger (fallback) |

- **Sem alteração no ledger** e **sem nova tabela de segmento** — classificação derivada (join de evidência por `operation_run_id`)
- `paid`/`unknown` exibem **indicador de baixa confiança** quando derivados sem origem clara
- Resultado/margem continuam **estimados** (nomenclatura da fase): **resultado operacional estimado / margem operacional estimada %** — nunca lucratividade real

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

### Requirement: Agregados por segmento econômico na página

O sistema SHALL exibir agregados por segmento econômico (D9) no painel `/admin/ai-operation-costs`:

- Custo por segmento · **resultado operacional estimado por segmento** · margem operacional estimada % por segmento · taxa de erro por segmento
- Gerações por hora · por owner (dono da loja, via `stores.user_id`) · por loja · por tipo de entrega · por status · por segmento

#### Scenario: Agregados por segmento exibidos

- **WHEN** a página é renderizada com entregas classificadas
- **THEN** exibe custo, resultado operacional estimado, margem operacional estimada % e taxa de erro por segmento (`test`/`freemium/promotional`/`paid`/`manual/admin`/`unknown`)

#### Scenario: Gerações por hora e por owner exibidos

- **WHEN** a página é renderizada
- **THEN** exibe distribuição de gerações por hora e por owner (dono da loja, via `stores.user_id`)
