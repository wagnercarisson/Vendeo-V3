## ADDED Requirements

### Requirement: View admin_ai_operation_costs — agrupamento por run

O sistema SHALL criar a view `admin_ai_operation_costs` (D10) que agrupa por `operation_run_id` e retorna, para cada entrega: `operation_run_id`, `operation_run_type`, `store_id`, `campaign_id`/`visual_signature_id`, custo total (USD), duração total, nº de chamadas (call-level), nº de tentativas (recomposições) e status da entrega.

- **Soma APENAS eventos call-level** — delivery markers (tipos `campaign_pipeline`/`visual_signature`/`brand_profile_without_logo`/`brand_profile_with_logo`) são **excluídos** (custo/tokens NULL, D1/D6) para evitar dupla contagem
- Valor contábil por evento: `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` (D3)
- Acesso via RPC admin (D10); sem GRANT direto ao cliente

#### Scenario: view soma apenas call-level por run

- **WHEN** um `operation_run_id` tem 1 delivery marker (custo NULL) + 2 eventos call-level com custo 0.01 cada
- **THEN** `admin_ai_operation_costs` retorna custo total 0.02 e 2 chamadas (sem dupla contagem)

#### Scenario: view exclui delivery markers

- **WHEN** eventos `campaign_pipeline`/`visual_signature` com custo NULL são contabilizados
- **THEN** eles NÃO entram na soma de custo/chamadas (anti-dupla-contagem — D1/D6/D10)

### Requirement: View admin_campaign_delivery_costs — detalhe por etapa

O sistema SHALL criar a view `admin_campaign_delivery_costs` (D10) que agrupa por `campaign_id` e detalha o custo da campanha **por etapa** (`generation_type`): copy, input validation, image, image_review — com custo por etapa e nº de tentativas.

#### Scenario: view detalha custo por etapa

- **WHEN** uma campanha tem eventos de copy, image e image_review
- **THEN** `admin_campaign_delivery_costs` retorna o custo por `generation_type` daquela campanha

### Requirement: Views admin_ai_cost_by_provider_model e admin_ai_cost_by_stage

O sistema SHALL criar as views de gargalos (D10):

- `admin_ai_cost_by_provider_model` — agrupa por `provider` + `model`: custo total, nº de chamadas, duração média
- `admin_ai_cost_by_stage` — agrupa por `generation_type`: custo total por etapa (copy vs review vs imagem)

#### Scenario: view por provider/model agrega custo

- **WHEN** eventos de `openai/gpt-4o` e `openai/gpt-image-2` existem
- **THEN** `admin_ai_cost_by_provider_model` retorna agrupamento por provider+model com custo total e nº de chamadas

#### Scenario: view por etapa agrega custo

- **WHEN** eventos de `campaign_copy`, `campaign_image` e `campaign_image_review` existem
- **THEN** `admin_ai_cost_by_stage` retorna o custo total por `generation_type`

### Requirement: View admin_ai_cost_by_store

O sistema SHALL criar a view `admin_ai_cost_by_store` (D10) que agrupa por `store_id`: custo total de IA por loja (apuração).

#### Scenario: view por loja agrega custo

- **WHEN** eventos existem para lojas distintas
- **THEN** `admin_ai_cost_by_store` retorna o custo total por `store_id`

### Requirement: View admin_cost_vs_credits — reconciliação USD × créditos

O sistema SHALL criar a view `admin_cost_vs_credits` (D10) — a ponte com a F38 — que reconcilia o custo real de IA (USD) com os créditos debitados:

- **Por campanha:** `generation_events` (call-level, `SUM(COALESCE(provider_reported_cost_usd, estimated_cost_usd))` por `operation_run`/`campaign_id`) JOIN `credit_transactions` (`type='deduction'`, `campaign_id`, `metadata.feature='campaign_pipeline'`)
- **Por VS:** `generation_events.visual_signature_id` JOIN `store_visual_signatures.metadata->>'credit_tx_id'` = `credit_transactions.id`
- Saída por entrega: `operation_run_id`, `domain`, `custo_usd_total`, `creditos_debitados`, `margem_estimada`, `etapas_mais_caras` (top `generation_type`), `regeneracoes`
- Valor contábil: `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` — evento com só `provider_reported` **não some** da apuração (D3)

#### Scenario: view reconcilia USD × créditos por campanha

- **WHEN** uma campanha debitou 1 crédito e seus eventos call-level somam US$ 0.037
- **THEN** `admin_cost_vs_credits` retorna `creditos_debitados: 1`, `custo_usd_total: 0.037` e `margem_estimada` calculada

#### Scenario: view inclui evento com só provider_reported

- **WHEN** um evento tem `provider_reported_cost_usd` preenchido e `estimated_cost_usd` NULL
- **THEN** o valor contábil usa o `provider_reported_cost_usd` (via `COALESCE` — não some da apuração, D3)

#### Scenario: view reconcilia VS via credit_tx_id

- **WHEN** a VS foi debitada via `reserveCredit` e `store_visual_signatures.metadata.credit_tx_id` aponta para a transação
- **THEN** `admin_cost_vs_credits` liga o custo dos eventos de VS aos créditos debitados

### Requirement: RPC admin_get_ai_costs — apuração filtrada

O sistema SHALL criar o RPC `admin_get_ai_costs` (SECURITY DEFINER, `SET search_path=''`, padrão `admin_get_metrics` — D10) com assinatura:

```
admin_get_ai_costs(
  p_operation_run_id UUID, p_campaign_id UUID, p_store_id UUID,
  p_user_id UUID, p_provider TEXT, p_model TEXT,
  p_generation_type TEXT, p_hours INTEGER
) RETURNS JSONB
```

- Retorna agrupamentos por `operation_run`, `store`, `provider/model`, `generation_type`, com `custo_usd_total`, `creditos_debitados` (reconciliação), `margem_estimada` e `regeneracoes`
- Filtros opcionais: store, user, provider, model, generation_type, período (`p_hours`), operation_run_id
- Acesso via admin; **sem página/tela** nesta fase (decisão Q&A D10)

#### Scenario: RPC filtra por store/provider/model/tipo/período

- **WHEN** `admin_get_ai_costs` é chamado com filtros `p_store_id`/`p_provider`/`p_model`/`p_generation_type`/`p_hours`
- **THEN** retorna agrupamentos respeitando os filtros

#### Scenario: RPC retorna reconciliação

- **WHEN** `admin_get_ai_costs` é chamado para um run
- **THEN** retorna `custo_usd_total`, `creditos_debitados` e `margem_estimada` (quando o vínculo com o ledger existe)

### Requirement: GET /api/admin/ai-costs — apuração (sem UI)

O sistema SHALL expor `GET /api/admin/ai-costs` (requireAdmin — D10) que repassa os filtros ao RPC `admin_get_ai_costs`:

```
GET /api/admin/ai-costs?store_id=&provider=&model=&generation_type=&hours=24
→ 200 { aggregations } (JSONB do RPC)
→ 403 (não-admin)
```

- **Sem página** nesta fase — endpoint de leitura para operação/observabilidade

#### Scenario: GET /api/admin/ai-costs retorna agregações

- **WHEN** um admin chama `GET /api/admin/ai-costs` com filtros
- **THEN** retorna 200 com as agregações do RPC

#### Scenario: GET /api/admin/ai-costs sem admin retorna 403

- **WHEN** um usuário não-admin chama `GET /api/admin/ai-costs`
- **THEN** retorna 403 Forbidden

### Requirement: admin_get_metrics (F28) permanece inalterado

O sistema SHALL **não alterar** o RPC `admin_get_metrics` (F28) — ele continua consumindo os delivery markers `campaign_pipeline`/`visual_signature` para as métricas operacionais existentes; os dados novos (colunas, tipos call-level) não quebram o RPC.

#### Scenario: admin_get_metrics segue respondendo com dados novos

- **WHEN** novos eventos (call-level + colunas novas) existem em `generation_events`
- **THEN** `admin_get_metrics` continua retornando as métricas operacionais de sempre (compat — I6)
