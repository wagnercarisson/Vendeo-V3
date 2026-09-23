# Product Events

## Purpose

Registrar telemetria de produto do funil da demonstração para medir aquisição, ativação, esgotamento, expiração e solicitações de suporte.

## Requirements

### Requirement: Tabela product_events

O sistema SHALL criar `product_events` append-only com `id`, loja, usuário, `event_type`, `dedup_key`, `properties`, `created_at`, índice único `(event_type, dedup_key)` e escrita via service role.

#### Scenario: Evento único por dedup key

- **WHEN** dois registros usam o mesmo tipo e dedup key
- **THEN** o segundo é no-op

### Requirement: Eventos da demonstração

De forma best-effort e fail-open, SHALL registrar `demo_granted`, `first_generation`, `demo_exhausted`, `demo_expired` e `support_credit_request`, com `store_id`, `user_id`, segmento e timestamps/saldos relevantes no momento. `first_generation` ocorre na primeira geração concluída com sucesso após o grant e solicitações múltiplas usam `operationId`.

#### Scenario: Grant e primeira geração

- **WHEN** demo é concedida
- **THEN** registra `demo_granted` por `grant_tx_id`
- **WHEN** primeira geração após grant conclui com sucesso
- **THEN** registra `first_generation` deduplicado por `grant_tx_id`

#### Scenario: Esgotamento e expiração

- **WHEN** deduction zera demo ativa
- **THEN** registra `demo_exhausted` por `deduction_tx_id`
- **WHEN** expiração é materializada
- **THEN** registra `demo_expired` por `expiration_tx_id`

#### Scenario: Solicitações múltiplas

- **WHEN** usuário solicita créditos
- **THEN** registra `support_credit_request` por `operationId` e permite nova solicitação posterior

### Requirement: Falha não bloqueia o fluxo

Falha de escrita SHALL nunca bloquear concessão, geração, expiração ou solicitação; deve ser registrada para diagnóstico.
