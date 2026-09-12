# AI Cost Accounting (delta F46)

> Delta da capability existente `ai-cost-accounting` pela `fase-46-gateway-unico-de-ia-e-registry-de-modelos`. Adiciona a exigência de telemetria call-level **obrigatória e correta** emitida pela camada única, e a correção de furos de cobertura. Views/RPC existentes permanecem inalterados.

## ADDED Requirements

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
