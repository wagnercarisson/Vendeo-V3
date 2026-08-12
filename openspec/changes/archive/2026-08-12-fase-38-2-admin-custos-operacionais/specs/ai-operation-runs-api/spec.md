## ADDED Requirements

### Requirement: RPC admin_get_ai_operation_runs (lista por entrega)

O sistema SHALL criar o RPC `admin_get_ai_operation_runs` (SECURITY DEFINER, `SET search_path=''`, padrão `admin_get_ai_costs` — sem leitura direta das views, F38.1 proíbe `.from()` nas views):

```
admin_get_ai_operation_runs(
  p_period_start TIMESTAMPTZ, p_period_end TIMESTAMPTZ, p_store_id UUID,
  p_run_type TEXT, p_status TEXT, p_provider TEXT, p_model TEXT,
  p_generation_type TEXT, p_operation_run_id UUID,
  p_page INTEGER, p_page_size INTEGER
) RETURNS JSONB { runs, summary, page, total }
```

- Resumo por run (só call-level — delivery markers excluídos): `created_at`, `delivery_status` (success/failed), `custo_usd_total`, `creditos_debitados` (via `admin_cost_vs_credits`), `duracao_total_ms`, `chamadas`, `chamadas_success`, `regeneracoes`, `provider`/`model` principal, `cost_source`
- **Evidências brutas de segmentação (D9) por run** — o RPC NÃO classifica segmento (classificação é do service — D9), mas expõe as evidências: `store_is_test`, `deduction_purchased_amount`, `deduction_bonus_amount`, `admin_grant_evidence` (shape real confirmado em `credit_transactions`) — permitindo ao service classificar, filtrar e paginar de forma consistente
- **Insumos de badge de confiança agregados por run (D5)** — distribuição de `cost_sources` (array), `cost_estimation_notes` (distinct) e flags derivadas: `has_provider_reported`, `has_provisional_image_estimate`, `has_partial_estimate`, `has_not_available`, `has_estimated` — o service deriva o badge de nível da entrega a partir deles
- **`summary`** (sobre o conjunto filtrado, **antes** de paginar): `custo_usd_total`, `creditos_debitados`, `duracao_total_ms`, `tempo_medio_ms`, `p95_ms` (via `percentile_cont(0.95)`), `total`, `erros`, `sucessos` — a UI NUNCA calcula KPIs sobre a página
- **`period_start/period_end`** substitui o `hours` único da UI (o `admin_get_ai_costs` antigo continua para compat)
- **Paginação obrigatória** (`page`/`page_size`) com `total` (a tabela pode ter muitos runs em 90 dias)
- **Limite operacional de janela de período:** default `period_start/period_end` ≤ 90 dias; máximo 365 dias — janela excedente → `400` (impede o service de precisar paginar um conjunto base inviável quando há filtro por segmento)
- **P95 de duração** no resumo via `percentile_cont(0.95)`
- `delivery_status` e `created_at` expostos (a view `admin_ai_operation_costs` tem; o RPC antigo não expõe — finding F2)
- Acesso via admin; **sem leitura direta das views**

#### Scenario: RPC retorna resumo por run com data e status

- **WHEN** `admin_get_ai_operation_runs` é chamado em um período com runs
- **THEN** retorna `{ runs, summary, page, total }` onde cada run tem `created_at`, `delivery_status`, `custo_usd_total`, `creditos_debitados`, `duracao_total_ms`, `chamadas`, `chamadas_success`, `regeneracoes`, `provider`/`model`, `cost_source`, evidências de segmento e insumos de badge

#### Scenario: RPC retorna evidências brutas de segmento por run

- **WHEN** o RPC é chamado
- **THEN** cada run expõe `store_is_test`, `deduction_purchased_amount`, `deduction_bonus_amount` e `admin_grant_evidence` (evidência bruta — a classificação em `test`/`freemium/promotional`/`paid`/`manual/admin`/`unknown` é feita no service, D9)

#### Scenario: RPC retorna insumos agregados de badge por run

- **WHEN** o RPC é chamado
- **THEN** cada run expõe `cost_sources` (array), `cost_estimation_notes` (distinct) e as flags `has_provider_reported`/`has_provisional_image_estimate`/`has_partial_estimate`/`has_not_available`/`has_estimated` para o service derivar o badge da entrega

#### Scenario: RPC retorna summary sobre o conjunto filtrado (antes da página)

- **WHEN** o RPC é chamado com `p_page=2`
- **THEN** `summary` contém os KPIs (`custo_usd_total`, `creditos_debitados`, `tempo_medio_ms`, `p95_ms`, `total`, `erros`, `sucessos`) calculados sobre o conjunto filtrado inteiro, **não** sobre a página

#### Scenario: RPC respeita filtros (período, loja, tipo, status, provider, model, gen_type, run_id)

- **WHEN** o RPC é chamado com `p_period_start`/`p_period_end`, `p_store_id`, `p_run_type`, `p_status`, `p_provider`, `p_model`, `p_generation_type` e `p_operation_run_id`
- **THEN** retorna apenas os runs que respeitam todos os filtros

#### Scenario: RPC pagina com total

- **WHEN** o RPC é chamado com `p_page=2` e `p_page_size=25` e há 60 runs no período
- **THEN** retorna 25 runs do segundo bloco e `total: 60`

#### Scenario: RPC inclui P95 de duração

- **WHEN** o RPC é chamado
- **THEN** o resumo inclui o P95 de duração por run no período (percentile_cont 0.95)

#### Scenario: RPC exclui delivery markers da soma de custo

- **WHEN** runs têm delivery marker (custo NULL) + chamadas call-level com custo
- **THEN** `custo_usd_total` soma apenas call-level (anti-dupla-contagem — D1/D6)

### Requirement: RPC admin_get_ai_operation_run_events (detalhe call-level)

O sistema SHALL criar o RPC `admin_get_ai_operation_run_events` (SECURITY DEFINER, `SET search_path=''`):

```
admin_get_ai_operation_run_events(
  p_operation_run_id UUID
) RETURNS JSONB { run, events }
```

- **`run`**: resumo da entrega (reuso da apuração do `admin_get_ai_operation_runs` para um único run)
- **`events`**: eventos call-level do run — `generation_type`, `provider`, `model`, `status`, `error_type`, `attempt_number`, `duration_ms`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `cached_input_tokens`, `image_tokens`, `estimated_cost_usd`, `provider_reported_cost_usd`, `text_component_usd`, `image_tool_component_usd`, `cost_source`, `cost_formula_version`, `cost_estimation_note`, `metadata`
- **P95 de duração por chamada** no período
- Acesso via admin

#### Scenario: RPC retorna eventos call-level por run

- **WHEN** `admin_get_ai_operation_run_events` é chamado para um `operation_run_id` com chamadas
- **THEN** retorna `{ run, events }` onde `events` contém cada chamada com etapa/tokens/duração/custo/status/error_type/attempt/cost_source/notas

#### Scenario: RPC retorna run vazio quando id não existe

- **WHEN** o `operation_run_id` não tem eventos
- **THEN** retorna `{ run: null, events: [] }`

### Requirement: GET /api/admin/ai-operation-runs (lista)

O sistema SHALL expor `GET /api/admin/ai-operation-runs` sob `requireAdmin` + zod (D4):

```
GET /api/admin/ai-operation-runs?period_start=&period_end=&store_id=&operation_run_type=&status=&provider=&model=&generation_type=&operation_run_id=&segment=&page=&page_size=
  → 200 { runs: [ { operationRunId, operationRunType, storeId, storeName,
                    createdAt, deliveryStatus, custoUsdTotal, custoBrl,
                    creditosDebitados, receitaOpBrl, resultadoOpBrl, margemOpPct,
                    duracaoTotalMs, chamadas, chamadasSuccess, regeneracoes,
                    provider, model, costSource, badges } ],
          summary: { custoUsdTotal, custoBrl, creditosDebitados, receitaOpBrl,
                     resultadoOpBrl, margemOpPct, tempoMedioMs, p95Ms,
                     totalEntregas, entregasErro, entregasSucesso },
          aggregations: { bySegment, byDeliveryType, byStage, byProviderModel,
                          byStatus, byStore, byOwner, byHour },
          page, total }
  → 400 zod (datas/parâmetros inválidos, janela de período excedente)
  → 403 não-admin
  → 503 (fail-closed — erro de leitura)
```

- **`segment`** opcional — filtro por segmento econômico (`test`/`freemium/promotional`/`paid`/`manual/admin`/`unknown`, D9). O service classifica cada run pelas evidências brutas do RPC e **filtra ANTES de paginar**
- **Paginação consistente com segmento:** quando `segment` está presente, o service requisita do RPC o **conjunto base completo** (mesmos filtros não-segmento, com `page_size` coberto do período — ex.: bloco único suficiente para o período, ou paginação progressiva no service) e então aplica **classificação + filtro de segmento + paginação + `total` no service layer** — o `total` e a página refletem o conjunto **segmento-filtrado**, nunca o RPC paginado sem o filtro
- **`summary`** (KPIs) sobre o **conjunto filtrado inteiro** (não sobre a página): `custoUsdTotal`, `custoBrl`, `creditosDebitados`, `receitaOpBrl`, `resultadoOpBrl`, `margemOpPct`, `tempoMedioMs`, `p95Ms`, `totalEntregas`, `entregasErro`, `entregasSucesso` — a UI **nunca calcula KPIs sobre a página atual**
- **`aggregations`** (D3/D9) sobre o **conjunto filtrado inteiro**: `bySegment` (custo, resultado operacional estimado, margem operacional estimada %, taxa de erro), `byDeliveryType`, `byStage` (`generation_type`), `byProviderModel`, `byStatus`, `byStore`, `byOwner` (dono da loja via `stores.user_id`), `byHour` (gerações por hora)
- **`custoBrl`**, **`receitaOpBrl`**, **`resultadoOpBrl`**, **`margemOpPct`** derivados no **service layer** (D1/D2) — `custoBrl = custoUsdTotal × usd_brl_rate`; `receitaOpBrl = creditosDebitados × credit_value_brl`; `resultadoOpBrl = receitaOpBrl − custoBrl`; `margemOpPct = receitaOpBrl > 0 ? (resultadoOpBrl / receitaOpBrl) × 100 : null`
- **`badges`** (D5) derivados no service a partir dos **insumos agregados por run** (`cost_sources` + `cost_estimation_notes` + flags `has_*`)
- **`storeName`** resolvido no service (join em `stores`)
- **Limite operacional de janela:** período default ≤ 90 dias, máximo 365 — janela excedente → `400` (evita que um filtro por segmento exija paginar um conjunto base inviável em janela ampla); UI oferece presets (7/30/90 dias)
- Paginação obrigatória com `page`/`total`

#### Scenario: GET lista resumo por entrega

- **WHEN** um admin chama `GET /api/admin/ai-operation-runs`
- **THEN** retorna `200` com `runs` contendo o resumo por entrega (data/status/custo/créditos/duração/chamadas/regenerações/provider/model/costSource/badges), `summary`, `aggregations` e `page`/`total`

#### Scenario: GET respeita filtros

- **WHEN** um admin chama com `period_start`/`period_end`, `store_id`, `operation_run_type`, `status`, `provider`, `model`, `generation_type`, `operation_run_id`
- **THEN** a listagem respeita todos os filtros

#### Scenario: GET filtra por segmento com paginação consistente

- **WHEN** um admin chama com `segment=test` e o conjunto base tem 60 runs (12 de teste)
- **THEN** retorna apenas runs de teste, `total: 12` e a página reflete o conjunto segmento-filtrado (classificação + filtro no service, antes da página)

#### Scenario: GET calcula summary/aggregations sobre o conjunto filtrado inteiro

- **WHEN** um admin chama com `page=2` e há 60 runs no conjunto filtrado
- **THEN** `summary` e `aggregations` refletem os 60 runs (não os da página 2)

#### Scenario: GET deriva BRL no service

- **WHEN** um admin chama com runs com `custoUsdTotal` e `creditosDebitados`
- **THEN** `custoBrl = custoUsdTotal × usd_brl_rate`, `receitaOpBrl = creditosDebitados × credit_value_brl`, `resultadoOpBrl` e `margemOpPct` derivados (margem `null` quando receita = 0)

#### Scenario: GET deriva badges dos insumos agregados por run

- **WHEN** um run tem `cost_sources = ["provider_reported", "pricing_table"]` e `has_provider_reported = true`
- **THEN** o badge derivado da entrega é `provider_reported` (prioridade pelos insumos agregados, D5)

#### Scenario: GET com janela de período excedente retorna 400

- **WHEN** um admin chama com `period_start`/`period_end` cobrindo mais de 365 dias
- **THEN** retorna `400` (limite operacional de janela — evita conjunto base inviável no filtro por segmento)
- **AND WHEN** as datas não são informadas
- **THEN** o sistema aplica a janela default de até 90 dias (sem `400`)

#### Scenario: GET sem admin retorna 403

- **WHEN** um usuário não-admin chama `GET /api/admin/ai-operation-runs`
- **THEN** retorna `403`

#### Scenario: GET com falha de leitura retorna 503

- **WHEN** o RPC de leitura falha
- **THEN** retorna `503` (fail-closed)

### Requirement: GET /api/admin/ai-operation-runs/[operationRunId] (detalhe)

O sistema SHALL expor `GET /api/admin/ai-operation-runs/[operationRunId]` sob `requireAdmin` + zod (D4):

```
GET /api/admin/ai-operation-runs/[operationRunId]
  → 200 { run: { ...resumo },
          events: [ { generationType, provider, model, status, errorType,
                      attemptNumber, durationMs,
                      promptTokens, completionTokens, totalTokens,
                      cachedInputTokens, imageTokens,
                      estimatedCostUsd, estimatedCostBrl,
                      textComponentUsd, imageToolComponentUsd,
                      costSource, costFormulaVersion, costEstimationNote,
                      metadata } ] }
  → 400 zod (operationRunId inválido)
  → 403 não-admin
  → 503 (fail-closed — erro de leitura)
```

- **`estimatedCostBrl`** derivado no **service layer** (D1/D2) — `estimatedCostUsd × usd_brl_rate`
- **`textComponentUsd`** e **`imageToolComponentUsd`** expostos no detalhe (persistidos pela F38.2/D5 — `text_component_usd`/`image_tool_component_usd` em `generation_events`) para a tela explicar gargalos/distorções de custo (ex.: imagem dominando o custo da chamada)
- **`badges`** (D5) por evento a partir de `cost_source` + `cost_estimation_note`

#### Scenario: GET detalhe retorna eventos call-level

- **WHEN** um admin chama `GET /api/admin/ai-operation-runs/[id]`
- **THEN** retorna `200` com `run` (resumo) e `events` (cada etapa com tokens/duração/custo/status/error_type/attempt/cost_source/notas e os componentes `textComponentUsd`/`imageToolComponentUsd`)

#### Scenario: GET detalhe expõe componentes de custo

- **WHEN** um evento tem `text_component_usd` e `image_tool_component_usd` persistidos
- **THEN** o detalhe expõe `textComponentUsd` e `imageToolComponentUsd` (soma ≈ `estimatedCostUsd`)

#### Scenario: GET detalhe deriva BRL no service

- **WHEN** um admin chama o detalhe
- **THEN** cada evento tem `estimatedCostBrl = estimatedCostUsd × usd_brl_rate` derivado no service

#### Scenario: GET detalhe sem admin retorna 403

- **WHEN** um usuário não-admin chama o detalhe
- **THEN** retorna `403`

#### Scenario: GET detalhe com operationRunId inválido retorna 400

- **WHEN** `operationRunId` não é UUID válido
- **THEN** retorna `400` (zod)

### Requirement: Derivação de badges de confiança (service layer)

O sistema SHALL derivar o badge de confiança no service layer (D5):

- **Por evento (detalhe call-level):** a partir de `cost_source` + `cost_estimation_note` persistidos
- **Por entrega (lista):** a partir dos **insumos agregados por run** (`cost_sources`, `cost_estimation_notes`, flags `has_provider_reported`/`has_provisional_image_estimate`/`has_partial_estimate`/`has_not_available`/`has_estimated`) — a prioridade de badge segue a ordem de condição abaixo sobre os insumos presentes no run (ex.: `has_provider_reported = true` → `provider_reported`, mesmo com outros cost_sources mistos)

| Badge (UI) | Condição |
|-----------|----------|
| `provider_reported` | `cost_source = 'provider_reported'` |
| `provisional image tool estimate` | `cost_source = 'pricing_table'` E `cost_estimation_note = 'provisional_image_tool_unit_cost_until_provider_reconciliation'` |
| `partial` | `cost_source = 'manual_unknown'` OU `cost_source = 'pricing_table'` com `cost_estimation_note` de estimativa parcial (ex.: `responses_image_generation_tool_without_unit_pricing`) |
| `estimated` | `cost_source = 'pricing_table'` (sem nota) ou `fallback_static` |
| `not_available` | `cost_source = 'not_available'` |
| `estimated` (genérico) | histórico com `cost_source` presente mas nota NULL |

#### Scenario: provider_reported → badge provider_reported

- **WHEN** um evento tem `cost_source = 'provider_reported'`
- **THEN** o badge derivado é `provider_reported`

#### Scenario: nota provisional + pricing_table → badge provisional image tool estimate

- **WHEN** um evento tem `cost_source = 'pricing_table'` e `cost_estimation_note = 'provisional_image_tool_unit_cost_until_provider_reconciliation'`
- **THEN** o badge derivado é `provisional image tool estimate`

#### Scenario: manual_unknown → badge partial

- **WHEN** um evento tem `cost_source = 'manual_unknown'`
- **THEN** o badge derivado é `partial`

#### Scenario: pricing_table sem nota → badge estimated

- **WHEN** um evento tem `cost_source = 'pricing_table'` e nota NULL
- **THEN** o badge derivado é `estimated`

#### Scenario: not_available → badge not_available

- **WHEN** um evento tem `cost_source = 'not_available'`
- **THEN** o badge derivado é `not_available`
