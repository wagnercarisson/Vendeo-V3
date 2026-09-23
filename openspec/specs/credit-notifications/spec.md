# Credit Notifications

## Purpose

Prover outbox in-app e email transacional para marcos da demonstração e solicitações de suporte, com deduplicação, leases e envio assíncrono.

## Requirements

### Requirement: Tabela de notificações

O sistema SHALL criar `credit_notifications` com `id UUID PK`, `store_id`, `user_id`, os seis tipos, `dedup_key`, `payload`, timestamps de entrega/leitura, `email_status`, tentativas, lease, erro e provider id. O índice único `(store_id, kind, dedup_key)` assegura dedup. Owner lê suas notificações, exceto `support_notice` via service role; mutações são service role.

#### Scenario: Dedup lógico

- **WHEN** duas inserções usam a mesma loja, kind e dedup key
- **THEN** a segunda é no-op

#### Scenario: Owner lê somente as próprias

- **WHEN** o lojista consulta notificações
- **THEN** recebe apenas as próprias via RLS

### Requirement: Auto-ack durável

`support_ack`, deduplicado por `operationId`, SHALL ser gravado atomicamente com a solicitação, nunca suprimido pela flag de email e permanecer pending/retry.

#### Scenario: support_ack persiste com email desligado

- **WHEN** a solicitação é registrada com `VENDEO_EMAIL_ENABLED=false`
- **THEN** `support_ack` é gravado na mesma transação e permanece pending/retry

### Requirement: Aviso ao suporte durável

`support_notice`, com destinatário `SUPPORT_EMAIL` e snapshot da loja/segmento, SHALL ser gravado atomicamente, nunca suprimido e não ser exposto ao owner.

#### Scenario: support_notice persiste atomicamente

- **WHEN** a solicitação é registrada
- **THEN** aviso com destinatário e snapshot é gravado atomicamente e nunca é suprimido

#### Scenario: Falha durável não confirma

- **WHEN** solicitação, ack ou notice não pode ser gravado
- **THEN** o endpoint falha sem afirmar recebimento

### Requirement: Notificação de concessão

O grant SHALL enfileirar `demo_granted` best-effort, e o reconciliador SHALL repará-la a partir da transação `demo`.

#### Scenario: Grant não é revertido por falha do outbox

- **WHEN** inserção da notificação falha no grant
- **THEN** concessão não reverte e reconciliador repara por `grant_tx_id`

### Requirement: Vencimento e encerramento idempotentes

O sistema SHALL derivar `demo_expiring_24h`, `demo_expired` e `demo_exhausted` de evidências duráveis, usando instante de expiração truncado à hora e lookahead Hobby 48h/Pro 24h.

#### Scenario: Lookahead por cadência

- **WHEN** o cron roda
- **THEN** Hobby usa `(now, now+48h]` e comunica aproximadamente 24 horas; Pro usa `(now, now+24h]` e comunica 24 horas

#### Scenario: Expiração deriva de evidência

- **WHEN** `expiration` é materializada
- **THEN** `demo_expired` usa `expiration_tx_id` e o reconciliador repara ausências

### Requirement: Email transacional via Resend

Email SHALL usar Resend somente com `VENDEO_EMAIL_ENABLED=true`, ser assíncrono via outbox e nunca bloquear concessão, consumo ou expiração. `support_ack` e `support_notice` nunca são suprimidos pela flag.

#### Scenario: Flag off não envia demo

- **WHEN** `VENDEO_EMAIL_ENABLED=false`
- **THEN** emails de demonstração não são enviados, mas ack/notice permanecem pending/retry

#### Scenario: Falha retryable não afeta operação

- **WHEN** envio falha de forma retryable
- **THEN** operação já persistida permanece intacta e registro volta a pending com backoff

### Requirement: Claim e estados do envio

Workers SHALL fazer claim atômico de pending e processing com lease vencido, com estados `pending → processing → sent|failed|suppressed`, retryable retornando a pending com backoff e `failed` como dead-letter visível no admin.

#### Scenario: Dois workers não duplicam envio

- **WHEN** dois workers disputam pending
- **THEN** claim atômico permite somente um envio

#### Scenario: Lease vencido é reclaimable

- **WHEN** registro processing tem lease vencido
- **THEN** pode ser reclamado sem duplicação lógica

#### Scenario: Falha permanente é dead-letter

- **WHEN** max attempts é atingido ou erro é terminal
- **THEN** fica `failed`, sem retry e visível no admin

#### Scenario: Retryable volta a pending

- **WHEN** envio falha de modo retryable
- **THEN** estado volta a `pending`, define `next_attempt_at` com backoff e incrementa tentativas

#### Scenario: Provider message id em sucesso

- **WHEN** provedor aceita a mensagem
- **THEN** registra `provider_message_id` e `email_sent_at`

### Requirement: Cadência do cron

Hobby SHALL usar cron diário/lookahead 48h e Pro cron horário/lookahead 24h. Confirmação in-app com protocolo é síncrona e independe do cron.

#### Scenario: Protocolo independe do cron

- **WHEN** usuário solicita créditos
- **THEN** confirmação com protocolo ocorre no POST, mesmo entre execuções do cron

#### Scenario: Email de suporte pode aguardar Hobby

- **WHEN** Hobby grava ack/notice entre execuções diárias
- **THEN** protocolo é imediato e email pode aguardar o próximo cron

### Requirement: Política de supressão

A flag desligada e janelas perdidas suprimem somente notificações de demonstração; `support_ack` e `support_notice` permanecem pending/retry.

#### Scenario: Janela perdida suprime somente demo

- **WHEN** expiração de `demo_expiring_24h` já passou
- **THEN** registro demo é suppressed, sem suprimir mensagens de suporte

### Requirement: Semântica de entrega

`email_sent_at` significa aceitação pelo provedor; entrega só pode ser afirmada com webhook.

#### Scenario: Aceitação não é entrega

- **WHEN** Resend aceita mensagem
- **THEN** status é sent e nenhuma afirmação de entrega é feita sem webhook

### Requirement: Superfície in-app

O sistema SHALL exibir badge/lista de `credit_notifications` e marcar `inapp_read_at` idempotentemente.

#### Scenario: Badge reflete não lidas

- **WHEN** há notificações com `inapp_read_at IS NULL`
- **THEN** badge/bell indica pendências

#### Scenario: Leitura idempotente

- **WHEN** usuário marca notificação como lida
- **THEN** `inapp_read_at` é preenchido uma única vez
