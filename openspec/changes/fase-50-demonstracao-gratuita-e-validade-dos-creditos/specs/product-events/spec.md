# Product Events

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos`. Define a telemetria de produto para o funil de demonstração (consumida pela F51), com identidade e propriedades suficientes para medir aquisição → ativação → esgotamento → expiração → solicitação de créditos.

## ADDED Requirements

### Requirement: Tabela product_events

O sistema SHALL criar a tabela `product_events` (`id UUID PK`, `store_id UUID`, `user_id UUID`, `event_type TEXT`, `dedup_key TEXT`, `properties JSONB`, `created_at TIMESTAMPTZ`) com índice único `(event_type, dedup_key)` para idempotência, append-only, escrita via service_role.

#### Scenario: Evento único por dedup_key

- **WHEN** dois registros com mesmo `(event_type, dedup_key)`
- **THEN** o segundo é no-op

### Requirement: Eventos da demonstração

O sistema SHALL registrar (best-effort, fail-open) os eventos `demo_granted`, `first_generation`, `demo_exhausted`, `demo_expired` e `support_credit_request`, com `properties` contendo ao menos `store_id`, `user_id`, segmento e timestamps/saldos relevantes no momento.

#### Scenario: demo_granted na concessão

- **WHEN** a demonstração é concedida
- **THEN** um evento `demo_granted` é registrado (dedup_key = grant_tx_id)
- **AND** se a gravação falhar (best-effort), o reconciliador repara o evento a partir da transação `demo` (dedup por `grant_tx_id`)

#### Scenario: first_generation na primeira geração após o grant

- **WHEN** a primeira geração é **concluída com sucesso após o grant da demo**
- **THEN** um evento `first_generation` é registrado, deduplicado por `grant_tx_id` (não "primeira por loja")

#### Scenario: demo_exhausted na transição demo_balance > 0 → 0

- **WHEN** uma reserva faz `demo_balance` passar de positivo para zero (demo ativa)
- **THEN** um evento `demo_exhausted` é registrado (dedup_key = deduction_tx_id)

#### Scenario: demo_expired na expiração materializada

- **WHEN** a demo expira (materializada, transação `expiration`)
- **THEN** um evento `demo_expired` é registrado (dedup_key = expiration_tx_id)

#### Scenario: support_credit_request permite múltiplas solicitações

- **WHEN** o usuário solicita créditos ao suporte
- **THEN** um evento `support_credit_request` é registrado (dedup_key = `operationId` por solicitação)
- **AND** múltiplas solicitações da mesma loja são permitidas (não deduplicada para sempre)

### Requirement: Falha não bloqueia o fluxo

O sistema SHALL gravar eventos de produto de forma best-effort: falha de escrita NUNCA bloqueia concessão, geração, expiração ou a própria solicitação.

#### Scenario: Falha de escrita não bloqueia

- **WHEN** a gravação de `product_events` falha
- **THEN** o fluxo produtivo continua normalmente
- **AND** a falha é logada
