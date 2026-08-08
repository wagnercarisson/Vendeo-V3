## MODIFIED Requirements

### Requirement: traceId gerado por request

O sistema SHALL gerar um `traceId` via `randomUUID()` no início de cada request a `POST /api/campaign/generate-image` e propagá-lo em todas as chamadas a `logPipelineEvent()` e inserts de telemetria.

> **Delta F38.1 (D1/D7):** O pipeline passa a usar o `AiCostTracker` como **único caminho de escrita** de telemetria de custo. `tracker.startRun("campaign_delivery")` no início do request gera `operation_run_id` (UUID, agrupador econômico) + `trace_id` (rastreio técnico) **distintos**; ambos são propagados a todas as chamadas filhas via contexto `opts.telemetry`. O `operation_run_id` cobre **todas as tentativas** da entrega (validação → copy → imagem → revisão → recomposição) até a aprovação final. Nesta fase, o run é criado por request e reutilizado nas regenerações **internas** do loop de qualidade/revisão (attempt 2..n). O reaproveitamento do mesmo `operation_run_id` em um request **posterior** de reprovação/recomposição explícita do usuário (F37) é **preparado** nesta fase: a rota persiste o `operation_run_id` na campanha (`campaigns.operation_run_id` — coluna adicionada na migration, D2) no momento da criação, de modo que a F37 possa reabrir o mesmo run ao re-compor a campanha. A mecânica de reabertura cross-request em si é escopo da F37 — nesta fase a coluna nasce preenchida e disponível.

#### Scenario: traceId único por request

- **WHEN** dois requests simultâneos chegam a `POST /api/campaign/generate-image`
- **THEN** cada request tem um `traceId` diferente

#### Scenario: operation_run_id propagado da rota até imagem/review/copy

- **WHEN** o pipeline executa com sucesso
- **THEN** todos os eventos call-level gravados (copy, input_validation, image, image_review) compartilham o mesmo `operation_run_id`
- **AND** o delivery marker `campaign_pipeline` usa o mesmo `operation_run_id`

#### Scenario: regeneração mantém o mesmo operation_run_id

- **WHEN** a revisão reprova e o pipeline recompoe/regenera (attempt 2..n)
- **THEN** os novos eventos usam o **mesmo** `operation_run_id` (sem novo run — D1)

#### Scenario: operation_run_id persistido na campanha na criação

- **WHEN** o pipeline cria uma campanha com sucesso
- **THEN** `campaigns.operation_run_id` da campanha é igual ao `operation_run_id` dos eventos do run (persistido na criação — preparo reuso F37, D1/D2)

#### Scenario: request posterior nesta fase ainda cria novo run

- **WHEN** um request independente posterior reprova/recompõe a campanha (nesta fase, sem a mecânica F37 de reabertura)
- **THEN** um novo `operation_run_id` é criado para esse request (mesmo run apenas dentro do request/loop interno — D1)

### Requirement: Telemetria persistida no pipeline

O sistema SHALL persistir telemetria em `generation_events` após:
- Copy Director completar ou falhar (`campaign_copy`)
- Image Director completar ou falhar (`campaign_image`)
- Pipeline completo finalizar (`campaign_pipeline`)

A inserção SHALL ser best-effort (try/catch), nunca bloqueando o pipeline.

> **Delta F38.1 (D5/D7):** O pipeline passa a gravar **todas** as chamadas call-level via `AiCostTracker` (substituindo os 4 inserts inline): `campaign_copy`, `campaign_input_validation`, `campaign_image` e `campaign_image_review` (furo 4 sanado — revisão e validação não somem mais). O delivery `campaign_pipeline` é gravado **sem custo e sem tokens** (anti-dupla-contagem D1/D6).

#### Scenario: Telemetria após Copy Director

- **WHEN** Copy Director completa com sucesso
- **THEN** um registro `campaign_copy` é inserido em `generation_events` com **usage real** e `estimated_cost_usd` preenchido (furo 1 sanado)

#### Scenario: Telemetria após Image Director

- **WHEN** Image Director completa com sucesso
- **THEN** um registro `campaign_image` é inserido em `generation_events` com custo, modelo, provedor

#### Scenario: Telemetria de revisão e validação registrada

- **WHEN** o pipeline executa input validation (vision) e image review (vision)
- **THEN** registros `campaign_input_validation` e `campaign_image_review` são inseridos com custo/tokens (furo 4 sanado)

#### Scenario: Telemetria pipeline completo (delivery marker)

- **WHEN** o pipeline finaliza (sucesso)
- **THEN** um registro `campaign_pipeline` é inserido com `duration_ms` (pipeline), `metadata.duration_is_pipeline: true` e **custo/tokens NULL** (anti-dupla-contagem D1/D6)

#### Scenario: Falha de INSERT não quebra pipeline

- **WHEN** a gravação em `generation_events` falha (ex: timeout de rede)
- **THEN** o erro é logado via `console.error`
- **AND** o pipeline continua normalmente
- **AND** o usuário recebe a resposta normalmente

### Requirement: Attempt granular e duration_ms por chamada

O sistema SHALL registrar, nos eventos call-level do pipeline, o `attempt_number` granular e o `duration_ms` da chamada individual.

> **Delta F38.1 (D6/D11):** O `attempt_number` passa a refletir a tentativa **real** do loop de revisão/recomposição (furo 6 sanado): `campaign_image` e `campaign_image_review` gravam `attempt_number` 1..n conforme o `generateWithRetry` avança. O `duration_ms` passa a ser a duração da **chamada individual** (furo 7 sanado), medido no ponto de execução de cada chamada — não o pipeline inteiro.

#### Scenario: review gravado por tentativa com attempt 1..n

- **WHEN** a revisão reprova na tentativa 1 e passa na tentativa 2
- **THEN** existem eventos `campaign_image_review` com `attempt_number: 1` e `attempt_number: 2` (furo 6 sanado)

#### Scenario: duration_ms por chamada (copy ≠ pipeline)

- **WHEN** o pipeline roda copy e imagem
- **THEN** `campaign_copy.duration_ms` é a duração da chamada de copy (não o pipeline inteiro — furo 7 sanado)

### Requirement: metadata.totalCost correto

O sistema SHALL gravar `metadata.totalCost` do evento `campaign_pipeline` como a soma real das chamadas do run.

> **Delta F38.1 (D7):** O `metadata.totalCost` do delivery `campaign_pipeline` passa a gravar a **soma real das chamadas** em USD (via `resolveAiCost`), em vez do nome do provider (furo 2 sanado). **Ressalva anti-dupla-contagem:** `metadata.totalCost` é **metadata operacional** — as views e o RPC de apuração (`admin_ai_*`, `admin_cost_vs_credits`, `admin_get_ai_costs`) **NUNCA usam `metadata.totalCost` como fonte contábil**; o valor contábil é sempre somado a partir dos eventos call-level (`COALESCE(provider_reported_cost_usd, estimated_cost_usd)`) por `operation_run_id` (D1/D6/D10).

#### Scenario: totalCost = soma real das chamadas

- **WHEN** o pipeline conclui com copy (0.01) + image (0.02) + review (0.007)
- **THEN** `metadata.totalCost` do `campaign_pipeline` é `0.037` (soma numérica, não nome do provider — furo 2 sanado)

### Requirement: Reconciliação via views — anti-dupla-contagem

O sistema SHALL garantir que a apuração de custo da entrega via views some apenas eventos call-level.

> **Delta F38.1 (D10):** O custo e a duração econômicos da entrega são apurados **exclusivamente** somando eventos call-level por `operation_run_id` nas views (`admin_ai_operation_costs`, `admin_campaign_delivery_costs`, etc.). O delivery marker tem custo/tokens NULL — nenhum valor é contado duas vezes.

#### Scenario: delivery marker com custo/tokens NULL

- **WHEN** o evento `campaign_pipeline` é inspecionado
- **THEN** `estimated_cost_usd`/`provider_reported_cost_usd` e tokens são NULL
- **AND** o custo da entrega via view = soma dos eventos call-level (anti-dupla-contagem D1/D6/D10)
