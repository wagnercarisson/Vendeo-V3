## ADDED Requirements

### Requirement: Telemetria persistida em generation_events

O sistema SHALL persistir dados de telemetria de IA em `generation_events` após a execução de Copy Director, Image Director e ao final do pipeline completo. A inserção SHALL ser best-effort (try/catch, nunca bloqueia o pipeline).

#### Scenario: INSERT após Copy Director com sucesso

- **WHEN** Copy Director completa com sucesso
- **THEN** um registro é inserido em `generation_events` com:
  - `generation_type = 'campaign_copy'`
  - `provider`, `model`, `duration_ms`, `estimated_cost_usd`, `status = 'success'`
  - `prompt_tokens`, `completion_tokens`, `total_tokens`
  - `campaign_id`, `store_id`, `user_id`, `trace_id`, `phase = 'copy_generation'`

#### Scenario: INSERT após Copy Director com falha

- **WHEN** Copy Director falha
- **THEN** um registro é inserido em `generation_events` com:
  - `generation_type = 'campaign_copy'`
  - `provider`, `model`, `duration_ms`, `status = 'failed'`
  - `error_type` em metadata
  - `campaign_id`, `store_id`, `trace_id`

#### Scenario: INSERT após Image Director com sucesso

- **WHEN** Image Director completa com sucesso
- **THEN** um registro é inserido em `generation_events` com:
  - `generation_type = 'campaign_image'`
  - `provider`, `model`, `duration_ms`, `estimated_cost_usd`, `status = 'success'`
  - `campaign_id`, `store_id`, `trace_id`, `phase = 'image_generation'`

#### Scenario: INSERT após Image Director com falha

- **WHEN** Image Director falha
- **THEN** um registro é inserido em `generation_events` com:
  - `generation_type = 'campaign_image'`
  - `provider`, `model`, `duration_ms`, `status = 'failed'`
  - `campaign_id`, `store_id`, `trace_id`

#### Scenario: INSERT pipeline completo ao final

- **WHEN** o pipeline completo finaliza (sucesso ou falha)
- **THEN** um registro é inserido em `generation_events` com:
  - `generation_type = 'campaign_pipeline'`
  - `provider`, `model`, `total_cost_usd`, `total_duration_ms`, `status = 'success'|'failed'`
  - `campaign_id`, `store_id`, `user_id`, `trace_id`
  - `metadata` contendo `{ hadCopyRetry, hadImageRetry, phases: [...] }`

#### Scenario: Falha na inserção não bloqueia o pipeline

- **WHEN** o INSERT em `generation_events` falha (ex: violação de constraint, timeout)
- **THEN** o pipeline continua normalmente
- **AND** a falha é logada via `console.error` local

### Requirement: Inserção sem campaign_id é válida

O sistema SHALL aceitar INSERT em `generation_events` sem `campaign_id` (nullable).

#### Scenario: INSERT sem campaign_id

- **WHEN** um INSERT é feito em `generation_events` sem `campaign_id`
- **THEN** o registro é criado com `campaign_id = null`
- **AND** a operação não lança erro de constraint

### Requirement: Custo estimado via estimateAiCost()

O sistema SHALL usar `estimateAiCost()` para calcular `estimated_cost_usd` antes de inserir telemetria. Se `estimateAiCost()` retornar `null`, o campo `estimated_cost_usd` SHALL ser `null`.

#### Scenario: Custo calculado e populado

- **WHEN** `estimateAiCost()` retorna `{ estimatedCostUsd: 0.0075 }`
- **THEN** o INSERT em `generation_events` contém `estimated_cost_usd = 0.0075`

#### Scenario: Custo não disponível → null

- **WHEN** `estimateAiCost()` retorna `null` (modelo desconhecido)
- **THEN** o INSERT em `generation_events` contém `estimated_cost_usd = null`
