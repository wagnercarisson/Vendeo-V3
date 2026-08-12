## MODIFIED Requirements

### Requirement: GET /api/admin/ai-operation-runs (lista)

O sistema SHALL expor `GET /api/admin/ai-operation-runs` sob `requireAdmin` + zod (D4), usando snapshots econômicos quando disponíveis e nomenclatura estimada:

```
GET /api/admin/ai-operation-runs?period_start=&period_end=&store_id=&operation_run_type=&status=&provider=&model=&generation_type=&operation_run_id=&segment=&page=&page_size=
  → 200 { runs: [ { operationRunId, operationRunType, storeId, storeName,
                    createdAt, deliveryStatus, custoUsdTotal, custoBrl,
                    creditosDebitados, creditosEstornados, creditosLiquidos,
                    usdBrlRateAtGeneration, usdBrlRateSourceAtGeneration,
                    creditValueBrlAtGeneration, creditValueBrlSourceAtGeneration,
                    receitaEstimadaBrl, resultadoEstimadoBrl, margemEstimadaPct,
                    creditValueSource, revenueEstimationNote,
                    duracaoTotalMs, chamadas, chamadasSuccess, regeneracoes,
                    provider, model, costSource, badges } ],
          summary: { custoUsdTotal, custoBrl, creditosDebitados, creditosLiquidos,
                     receitaEstimadaBrl, resultadoEstimadoBrl, margemEstimadaPct,
                     tempoMedioMs, p95Ms, totalEntregas, entregasErro, entregasSucesso },
          aggregations: { bySegment, byDeliveryType, byStage, byProviderModel,
                          byStatus, byStore, byOwner, byHour },
          page, total }
  → 400 zod (datas/parâmetros inválidos, janela de período excedente)
  → 403 não-admin
  → 503 (fail-closed — erro de leitura)
```

- **`segment`** opcional — filtro por segmento econômico (`test`/`freemium/promotional`/`paid`/`manual/admin`/`unknown`, D9). O service classifica cada run pelas evidências brutas do RPC e **filtra ANTES de paginar**
- **Paginação consistente com segmento:** quando `segment` está presente, o service requisita do RPC o **conjunto base completo** (mesmos filtros não-segmento, com `page_size` coberto do período) e então aplica **classificação + filtro de segmento + paginação + `total` no service layer** — o `total` e a página refletem o conjunto **segmento-filtrado**
- **`summary`** (KPIs) sobre o **conjunto filtrado inteiro** (não sobre a página)
- **`aggregations`** (D3/D9) sobre o **conjunto filtrado inteiro**
- **`custoBrl`** derivado no **service layer** a partir do **snapshot** quando disponível: `custoBrl = custoUsdTotal × usd_brl_rate_at_generation`; fallback legacy: `custoBrl = custoUsdTotal × usd_brl_rate` (corrente) com sinalização explícita
- **`receitaEstimadaBrl`** = `creditosLiquidos × credit_value_brl_at_generation` (snapshot/backfill) OU `creditosLiquidos × credit_value_brl` (fallback) — **nomenclatura estimada, nunca "receita real"**
- **`creditValueSource`/`usdBrlRateSource`** expõem a **origem** do valor usado: `"captured_at_generation"` / `"backfilled_from_audit"` / `"backfilled_seed"` / `"economic_parameter_fallback"` — a origem vem da coluna `*_source_at_generation` quando persistida, ou `economic_parameter_fallback` quando o valor é derivado em leitura
- **`revenueEstimationNote`** (`"estimated_from_admin_credit_value"`) quando o valor de crédito é fallback; nota adicional `"backfilled_historical_approximation"` quando o valor usado é backfilled
- **`resultadoEstimadoBrl`** = `receitaEstimadaBrl − custoBrl`; **`margemEstimadaPct`** = `receitaEstimadaBrl > 0 ? (resultadoEstimadoBrl / receitaEstimadaBrl) × 100 : null`
- **`creditosEstornados`/`creditosLiquidos`** expostos por run (RPC 38-2-12) — estorno sempre descontado via líquidos
- **`badges`** (D5) derivados no service a partir dos **insumos agregados por run**
- **`storeName`** resolvido no service (join em `stores`)
- **Limite operacional de janela:** período default ≤ 90 dias, máximo 365 — janela excedente → `400`
- Paginação obrigatória com `page`/`total`

#### Scenario: GET lista resumo por entrega com snapshots e origens

- **WHEN** um admin chama `GET /api/admin/ai-operation-runs`
- **THEN** retorna `200` com `runs` contendo o resumo por entrega, incluindo `usdBrlRateAtGeneration`/`usdBrlRateSourceAtGeneration`/`creditValueBrlAtGeneration`/`creditValueBrlSourceAtGeneration` e derivados `custoBrl`/`receitaEstimadaBrl`/`resultadoEstimadoBrl`/`margemEstimadaPct`

#### Scenario: GET respeita filtros

- **WHEN** um admin chama com `period_start`/`period_end`, `store_id`, `operation_run_type`, `status`, `provider`, `model`, `generation_type`, `operation_run_id`
- **THEN** a listagem respeita todos os filtros

#### Scenario: GET filtra por segmento com paginação consistente

- **WHEN** um admin chama com `segment=test` e o conjunto base tem 60 runs (12 de teste)
- **THEN** retorna apenas runs de teste, `total: 12` e a página reflete o conjunto segmento-filtrado

#### Scenario: GET calcula summary/aggregations sobre o conjunto filtrado inteiro

- **WHEN** um admin chama com `page=2` e há 60 runs no conjunto filtrado
- **THEN** `summary` e `aggregations` refletem os 60 runs (não os da página 2)

#### Scenario: GET deriva custoBrl com snapshot do run

- **WHEN** um run tem `custoUsdTotal = 10` e `usd_brl_rate_at_generation = 5.20`
- **THEN** `custoBrl = 52.00` (usa o snapshot do run, não o parâmetro corrente)

#### Scenario: GET deriva receita estimada com créditos líquidos e snapshot

- **WHEN** um run tem `creditosLiquidos = 7` e `credit_value_brl_at_generation = 2.00`
- **THEN** `receitaEstimadaBrl = 14.00` (estorno já descontado) e `margemEstimadaPct` derivada

#### Scenario: GET usa fallback legacy com sinalização explícita

- **WHEN** um run legado (sem valor persistido após o backfill) é consultado
- **THEN** `custoBrl`/`receitaEstimadaBrl` usam os parâmetros correntes
- **AND** `creditValueSource = "economic_parameter_fallback"` e `revenueEstimationNote = "estimated_from_admin_credit_value"` são expostos (fallback explícito)

#### Scenario: GET expõe origem backfilled

- **WHEN** um run tem `credit_value_brl_at_generation` preenchido pelo backfill
- **THEN** `creditValueSource = "backfilled_from_audit"` ou `"backfilled_seed"` (origem persistida, não `captured_at_generation`)

#### Scenario: GET com janela de período excedente retorna 400

- **WHEN** um admin chama com `period_start`/`period_end` cobrindo mais de 365 dias
- **THEN** retorna `400`
- **AND WHEN** as datas não são informadas
- **THEN** o sistema aplica a janela default de até 90 dias (sem `400`)

#### Scenario: GET sem admin retorna 403

- **WHEN** um usuário não-admin chama `GET /api/admin/ai-operation-runs`
- **THEN** retorna `403`

#### Scenario: GET com falha de leitura retorna 503

- **WHEN** o RPC de leitura falha
- **THEN** retorna `503` (fail-closed)

### Requirement: GET /api/admin/ai-operation-runs/[operationRunId] (detalhe)

O sistema SHALL expor `GET /api/admin/ai-operation-runs/[operationRunId]` sob `requireAdmin` + zod (D4), usando snapshots econômicos:

```
GET /api/admin/ai-operation-runs/[operationRunId]
  → 200 { run: { ...resumo com snapshots },
          events: [ { generationType, provider, model, status, errorType,
                      attemptNumber, durationMs,
                      promptTokens, completionTokens, totalTokens,
                      cachedInputTokens, imageTokens,
                      estimatedCostUsd, estimatedCostBrl,
                      textComponentUsd, imageToolComponentUsd,
                      usdBrlRateAtGeneration, usdBrlRateSourceAtGeneration,
                      creditValueBrlAtGeneration, creditValueBrlSourceAtGeneration,
                      costSource, costFormulaVersion, costEstimationNote,
                      metadata } ] }
  → 400 zod (operationRunId inválido)
  → 403 não-admin
  → 503 (fail-closed — erro de leitura)
```

- **`estimatedCostBrl`** derivado no **service layer** — `estimatedCostUsd × usd_brl_rate_at_generation` (snapshot do evento/run) quando disponível; fallback: `× usd_brl_rate` corrente
- **`textComponentUsd`** e **`imageToolComponentUsd`** expostos no detalhe (persistidos pela F38.2/D5) para a tela explicar gargalos/distorções de custo
- **`badges`** (D5) por evento a partir de `cost_source` + `cost_estimation_note`
- **`usdBrlRateAtGeneration`/`creditValueBrlAtGeneration`** expostos por evento (snapshot no momento da chamada), sempre com as origens `usdBrlRateSourceAtGeneration`/`creditValueBrlSourceAtGeneration` correspondentes

#### Scenario: GET detalhe retorna eventos call-level com snapshots e origens

- **WHEN** um admin chama `GET /api/admin/ai-operation-runs/[id]`
- **THEN** retorna `200` com `run` (resumo) e `events` (cada etapa com tokens/duração/custo/status/cost_source/notas e `usdBrlRateAtGeneration`/`usdBrlRateSourceAtGeneration`/`creditValueBrlAtGeneration`/`creditValueBrlSourceAtGeneration` por evento)

#### Scenario: GET detalhe expõe componentes de custo

- **WHEN** um evento tem `text_component_usd` e `image_tool_component_usd` persistidos
- **THEN** o detalhe expõe `textComponentUsd` e `imageToolComponentUsd` (soma ≈ `estimatedCostUsd`)

#### Scenario: GET detalhe deriva BRL no service com snapshot

- **WHEN** um admin chama o detalhe e um evento tem `estimatedCostUsd = 1` e `usd_brl_rate_at_generation = 5.20`
- **THEN** `estimatedCostBrl = 5.20` (usa o snapshot, não o parâmetro corrente)

#### Scenario: GET detalhe sem admin retorna 403

- **WHEN** um usuário não-admin chama o detalhe
- **THEN** retorna `403`

#### Scenario: GET detalhe com operationRunId inválido retorna 400

- **WHEN** `operationRunId` não é UUID válido
- **THEN** retorna `400` (zod)
