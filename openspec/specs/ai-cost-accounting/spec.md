# AI Cost Accounting

> Synced from `fase-38-1-ai-cost-accounting` (ADDED) + `fase-38-2-admin-custos-operacionais` (ADDED) + `fase-46-gateway-unico-de-ia-e-registry-de-modelos` (ADDED).

## Purpose

Apuração e reconciliação do custo real de IA (USD) por operação, loja, provider/model e etapa, com views admin (D10) sobre `generation_events` (call-level) e o RPC `admin_get_ai_costs` exposto via `GET /api/admin/ai-costs`. As views excluem delivery markers para evitar dupla contagem, e a view `admin_cost_vs_credits` reconcilia custo USD × créditos debitados (ponte com a F38), mantendo dados brutos com receita/margem derivadas apenas quando `p_credit_unit_usd_value` é fornecido. A capability preserva o RPC `admin_get_metrics` (F28) intacto.

## Requirements

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
- Saída por entrega: `operation_run_id`, `domain`, `custo_usd_total`, `creditos_debitados`, `etapas_mais_caras` (top `generation_type`), `regeneracoes`
- **Ajuste pós-UAT (migration `20260809000002`):** a view expõe **dados brutos** — `receita_estimada_usd`/`margem_estimada` sempre **NULL** (não assume 1 crédito = USD 1); a derivação de receita/margem ocorre no RPC `admin_get_ai_costs` quando `p_credit_unit_usd_value` é fornecido
- Valor contábil: `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` — evento com só `provider_reported` **não some** da apuração (D3)

#### Scenario: view reconcilia USD × créditos por campanha

- **WHEN** uma campanha debitou 1 crédito e seus eventos call-level somam US$ 0.037
- **THEN** `admin_cost_vs_credits` retorna `creditos_debitados: 1` e `custo_usd_total: 0.037`, com `margem_estimada`/`receita_estimada_usd` **NULL** (dados brutos; margem derivada no RPC com `p_credit_unit_usd_value`)

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
  p_generation_type TEXT, p_hours INTEGER,
  p_credit_unit_usd_value NUMERIC
) RETURNS JSONB
```

- Retorna agrupamentos por `operation_run`, `store`, `provider/model`, `generation_type`, com `custo_usd_total`, `creditos_debitados` (reconciliação), `margem_estimada` e `regeneracoes`
- Filtros opcionais: store, user, provider, model, generation_type, período (`p_hours`), operation_run_id
- **`p_credit_unit_usd_value` (ajuste pós-UAT, migration `20260809000002`):** valor monetário por crédito para derivar receita/margem. Configurado server-side via env `VENDEO_AI_CREDIT_UNIT_USD_VALUE` (default: não configurado)
- Acesso via admin; **sem página/tela** nesta fase (decisão Q&A D10)

#### Scenario: RPC filtra por store/provider/model/tipo/período

- **WHEN** `admin_get_ai_costs` é chamado com filtros `p_store_id`/`p_provider`/`p_model`/`p_generation_type`/`p_hours`
- **THEN** retorna agrupamentos respeitando os filtros

#### Scenario: RPC retorna reconciliação com margem condicional

- **WHEN** `admin_get_ai_costs` é chamado para um run **sem** `p_credit_unit_usd_value`
- **THEN** retorna `custo_usd_total` e `creditos_debitados` (quando o vínculo com o ledger existe), com `receita_estimada_usd` e `margem_estimada` **NULL** (a view não assume mais 1 crédito = USD 1)
- **AND WHEN** `p_credit_unit_usd_value` é fornecido
- **THEN** `receita_estimada_usd = creditos_debitados * p_credit_unit_usd_value` e `margem_estimada = receita_estimada_usd - custo_usd_total`

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

### Requirement: admin_get_ai_costs (F38.1) permanece inalterado e compatível

O sistema SHALL **não alterar** o RPC `admin_get_ai_costs` (F38.1) — ele continua servindo o `GET /api/admin/ai-costs` existente e permanece a fonte de agregado; os RPCs novos de operation runs (`admin_get_ai_operation_runs` / `admin_get_ai_operation_run_events`, especificados na capability `ai-operation-runs-api`) são **adicionais**, sem modificar a assinatura nem o comportamento do RPC antigo.

#### Scenario: admin_get_ai_costs segue respondendo com filtros antigos

- **WHEN** `admin_get_ai_costs` é chamado com os filtros existentes (`p_store_id`/`p_provider`/`p_model`/`p_generation_type`/`p_hours`/`p_operation_run_id`)
- **THEN** retorna as agregações de sempre (compat — sem mudança de contrato)

#### Scenario: novos RPCs coexistem sem conflito

- **WHEN** `admin_get_ai_operation_runs` é usado pela nova UI
- **THEN** `admin_get_ai_costs` continua disponível e compatível (sem duplicação de nomes nem quebra)

### Requirement: Telemetria call-level obrigatória emitida pela camada única

Cada **tentativa HTTP real** de IA SHALL produzir exatamente **um envelope de telemetria** (`AiCallEnvelope extends AiCallInfo`, aditivo — `AiCallInfo` legado intacto — com `capability`, `protocol`, `status`, `errorType?`), que a camada única encaminha para gravação call-level em `generation_events` com provider, **modelo real** da chamada, tokens normalizados e duração. Nenhum serviço SHALL ser responsável por emitir sua própria telemetria; a ausência de envelope SHALL indicar que não houve tentativa real. A **persistência é best-effort** (o `AiCostTracker` é fail-open por design) — um envelope pode não chegar ao banco sem bloquear a geração.

#### Scenario: Tentativa real gera um envelope

- **WHEN** uma tentativa HTTP de IA é executada em qualquer capacidade
- **THEN** exatamente um envelope de telemetria é emitido para ela
- **AND** o envelope contém `capability`, `protocol`, status, modelo real, tokens e duração

#### Scenario: Persistência best-effort

- **WHEN** a gravação do evento falha (indisponibilidade de banco, etc.)
- **THEN** a geração prossegue normalmente
- **AND** a falha é apenas logada (fail-open)

#### Scenario: Fase sem chamada real não gera evento

- **WHEN** uma fase é pulada (ex.: validação de entrada dispensada por confirmação humana)
- **THEN** nenhum evento call-level é gravado para essa fase

### Requirement: Mapeamento canônico de capacidade para o tipo persistido

O sistema SHALL manter um mapa canônico (`CAPABILITY_GENERATION_TYPE`) que traduz cada uma das **11 capacidades** do registry para um `GenerationEventType` válido do CHECK `chk_generation_events_type`. Capacidades sem literal próprio no enum SHALL ser mapeadas para o tipo da etapa correspondente — em particular `campaign_image_edit → campaign_image` (fallback de edição pertence à etapa de imagem) — preservando a `capability` e o `protocol` originais no `metadata` do evento. O mapa SHALL cobrir as 11 capacidades e SHALL ser coberto por teste.

#### Scenario: Fallback de edição mapeado para a etapa de imagem

- **WHEN** a capacidade `campaign_image_edit` emite telemetria
- **THEN** o evento é gravado com `generation_type = campaign_image`
- **AND** o `metadata` preserva `capability = campaign_image_edit` e `protocol = images`

#### Scenario: Cobertura completa do mapa

- **WHEN** as 11 capacidades são mapeadas
- **THEN** todas resolvem para um literal aceito pelo CHECK `chk_generation_events_type`
- **AND** o teste falha se uma capacidade ficar sem mapeamento

### Requirement: Modelo real reportado por chamada

O evento call-level SHALL registrar o **modelo real** resolvido para a chamada, e não um modelo fixo do pipeline. As chamadas de visão de validação e de revisão SHALL registrar o modelo de visão configurado (ex.: `gpt-4o`), nunca o modelo de geração de imagem.

#### Scenario: Validação e revisão registram o modelo de visão

- **WHEN** as fases `campaign_input_validation` e `campaign_image_review` são executadas com o modelo de visão
- **THEN** os eventos registram o modelo de visão real
- **AND** não registram o modelo de imagem

#### Scenario: Custo usa o pricing do modelo real

- **WHEN** o custo é resolvido para uma chamada de visão
- **THEN** o pricing aplicado é o do modelo de visão
- **AND** o valor não é calculado com o pricing do modelo de imagem

### Requirement: Cobertura de telemetria em todos os caminhos de chamada

Todos os caminhos produtivos que executam IA SHALL emitir telemetria **pelo caminho único** (caller fornece `AiTelemetryContext` → gateway gera o envelope → sink persiste), incluindo os que hoje não o fazem: o upload de logo (`POST /api/store/[id]/logo`), o retry do Brand Director (`retry-brand-director`), as ações de assinatura visual (`visual-signature/server-actions.ts` — `generateVariations`/`generateAutomatic`) e as rotas `visual-signature/approve` (2 call sites) e `visual-signature/restore` (via `BrandProfilerWithoutLogoService.generate`). **Callers já instrumentados** que passam a usar o sink (removendo `resolveAiCost`/`AiCostTracker.record` manuais): `brand-profile/{infer,realign,generate-without-logo}`, `visual-signature/generate-without-logo` (buffering até `visual_signature_id`) e `correction-reports.ts`. Nenhum caller produtivo resolve custo ou grava call-level manualmente; um gate global proíbe `resolveAiCost`/`AiCostTracker.record` de IA fora do sink. O fallback `images.edit` SHALL ser registrado mesmo sem usage (com duração e **estimativa** por unidade/`not_available`), como uma **segunda tentativa real** (um envelope próprio — não reaproveita o envelope da chamada que falhou). O componente da tool de imagem SHALL ser somado à **estimativa** em `campaign_image` **e** `visual_signature_image`.

#### Scenario: Caller já instrumentado passa a usar o sink único

- **WHEN** `brand-profile/realign`, `brand-profile/generate-without-logo`, `visual-signature/generate-without-logo` ou `correction-reports.ts` executam IA
- **THEN** eles fornecem `AiTelemetryContext`/sink ao serviço migrado
- **AND** não chamam `resolveAiCost`/`AiCostTracker.record` manualmente para a chamada de IA (delivery markers preservados)

#### Scenario: Nenhum caller produtivo fora do caminho único

- **WHEN** o gate global de arquitetura varre `src/`
- **THEN** não há `resolveAiCost`/`AiCostTracker.record` de IA fora de `src/lib/ai/**` (sink)
- **AND** o inventário de cobertura cobre todos os callers produtivos

#### Scenario: Upload de logo emite telemetria

- **WHEN** `POST /api/store/[id]/logo` analisa o logo com visão
- **THEN** um evento call-level é gravado com custo e duração
- **AND** o caminho de retry do Brand Director também emite telemetria

#### Scenario: Ações e rotas de assinatura visual emitem telemetria

- **WHEN** `generateVariations`/`generateAutomatic` (`server-actions.ts`) ou as rotas `visual-signature/approve`/`restore` executam IA
- **THEN** cada chamada real emite um envelope e grava um evento call-level com modelo real e duração
- **AND** nenhum desses caminhos fica fora da apuração

#### Scenario: Fallback de imagem registrado sem tokens

- **WHEN** a geração usa o fallback `images.edit` que não retorna usage
- **THEN** o evento é gravado com duração e custo por unidade (ou `not_available`)
- **AND** o evento não é silenciado

#### Scenario: Componente da tool somado em campaign_image e visual_signature_image

- **WHEN** a geração usa a tool `image_generation` da Responses API em `campaign_image` ou `visual_signature_image`
- **THEN** a **estimativa** de custo soma o componente da tool ao componente textual, para **ambas** as capacidades
- **AND** a fórmula provisória é sinalizada (`costEstimationNote`) enquanto não houver custo reportado pelo provedor (`provider_reported_cost_usd`)

#### Scenario: Fallback de imagem é segunda tentativa com envelope próprio

- **WHEN** a chamada primária (Responses) falha e o orquestrador aciona `images.edit` com sucesso
- **THEN** dois envelopes de telemetria são emitidos (um da falha, um do sucesso)
- **AND** a estimativa não é atribuída a uma única chamada

### Requirement: Views e RPC existentes permanecem inalterados

As views (`admin_ai_operation_costs`, `admin_campaign_delivery_costs`, `admin_ai_cost_by_provider_model`, `admin_ai_cost_by_stage`, `admin_ai_cost_by_store`, `admin_cost_vs_credits`) e o RPC `admin_get_ai_costs` SHALL permanecer com assinatura e comportamento inalterados. Esta fase apenas garante que os dados call-level cheguem completos e corretos.

#### Scenario: Apuração continua compatível

- **WHEN** `admin_get_ai_costs` é chamado com os filtros existentes após a F46
- **THEN** retorna as agregações de sempre
- **AND** os novos eventos corrigidos (modelo real) aparecem corretamente na apuração por provider/model
