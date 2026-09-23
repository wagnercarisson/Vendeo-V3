# Credit Notifications

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos`. Define notificações in-app + email transacional (Resend) para os marcos da demonstração, com outbox, dedup/idempotência e envio assíncrono não-bloqueante.

## ADDED Requirements

### Requirement: Tabela de notificações (outbox)

O sistema SHALL criar a tabela `credit_notifications` com `id UUID PK`, `store_id UUID`, `user_id UUID`, `kind TEXT CHECK (kind IN ('demo_granted','demo_expiring_24h','demo_expired','demo_exhausted','support_ack','support_notice'))`, `dedup_key TEXT`, `payload JSONB`, `inapp_delivered_at TIMESTAMPTZ`, `inapp_read_at TIMESTAMPTZ`, `email_status TEXT DEFAULT 'pending'`, `attempt_count INTEGER DEFAULT 0`, `next_attempt_at TIMESTAMPTZ`, `lease_expires_at TIMESTAMPTZ`, `last_error TEXT`, `provider_message_id TEXT`, `email_sent_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ`, e índice único `(store_id, kind, dedup_key)` para dedup lógico. RLS: leitura pelo owner (excluindo `support_notice`, que é lido pelo suporte via service_role); mutações via service_role.

#### Scenario: Dedup lógico por (store_id, kind, dedup_key)

- **WHEN** duas inserções com mesmo `(store_id, kind, dedup_key)`
- **THEN** a segunda é no-op (unique index)

#### Scenario: Owner lê as próprias notificações

- **WHEN** o lojista consulta as notificações da própria loja
- **THEN** recebe apenas as suas (RLS)

### Requirement: Auto-ack de solicitação de suporte (exceção durável)

O sistema SHALL gravar a confirmação de recebimento da solicitação de créditos (`kind = 'support_ack'`, dedup_key = `operationId`, `payload.recipient_email` = email do usuário) **atomicamente com a solicitação** (mesma transação), para envio por email — cumprindo a cláusula 12.3 dos Termos. Diferente das notificações de demonstração (best-effort), o `support_ack` é **durável**: **nunca** é marcado `suppressed` por flag desligada; permanece `pending`/retry até o envio.

#### Scenario: support_ack gravado atomicamente e nunca suprimido

- **WHEN** `POST /api/support/credit-request` registra a solicitação
- **THEN** o `support_ack` (dedup por `operationId`, destinatário = email do usuário) é gravado na mesma transação
- **AND** com `VENDEO_EMAIL_ENABLED=false`, o `support_ack` NÃO é marcado `suppressed` (permanece `pending`/retry)

### Requirement: Aviso ao suporte (support_notice)

O sistema SHALL gravar, **atomicamente com a solicitação**, o aviso ao suporte (`kind = 'support_notice'`, dedup_key = `operationId`, `payload.recipient_email` = `SUPPORT_EMAIL`, com snapshot da loja/segmento), para que o time de suporte receba a demanda. `support_notice` é **durável** (nunca suprimido, permanece `pending`/retry) e é lido pelo suporte via `service_role` (não é exposto ao owner).

#### Scenario: support_notice gravado atomicamente e não suprimido

- **WHEN** `POST /api/support/credit-request` registra a solicitação
- **THEN** um `support_notice` (dedup por `operationId`, destinatário `SUPPORT_EMAIL`) é gravado na mesma transação
- **AND** `support_notice` NUNCA é marcado `suppressed` (permanece `pending`/retry)

#### Scenario: Usuário não recebe confirmação sem que o suporte receba a demanda

- **WHEN** a gravação durável de solicitação + `support_ack` + `support_notice` falha
- **THEN** o endpoint falha explicitamente (não afirma ter recebido)

### Requirement: Notificação de concessão

O sistema SHALL enfileirar uma notificação `demo_granted` (dedup_key = grant_tx_id) na concessão da demonstração, de forma best-effort e não-bloqueante. O reconciliador SHALL **derivar e reparar** a notificação `demo_granted` a partir da transação `demo` quando ela estiver ausente (dedup por `grant_tx_id`).

#### Scenario: Concessão enfileira notificação sem bloquear

- **WHEN** `grant_demo_credits` concede a demonstração
- **THEN** uma notificação `demo_granted` é criada
- **AND** falha na inserção NÃO reverte a concessão

#### Scenario: Concessão sem outbox é reparada pelo reconciliador

- **WHEN** a outbox falhou durante o grant (existe transação `demo` mas não a notificação `demo_granted`)
- **THEN** o reconciliador deriva a notificação `demo_granted` da transação `demo` (dedup por `grant_tx_id`)

### Requirement: Notificações de vencimento e encerramento derivadas de evidência durável

O sistema SHALL derivar `demo_expiring_24h` (demo ativa ainda não notificada) e `demo_expired`/`demo_exhausted` (da transação `expiration`/deduction de esgotamento) de forma idempotente. O `dedup_key` SHALL usar o **instante de expiração** (`demo_expires_at` truncado à hora), **nunca** apenas `YYYY-MM-DD`. A **janela de lookahead segue a cadência** (D23): Hobby → `(now, now+48h]` (comunicado "aproximadamente 24 horas"); Pro → `(now, now+24h]` (comunicado "24 horas").

#### Scenario: Lookahead conforme a cadência

- **WHEN** o cron roda
- **THEN** enfileira `demo_expiring_24h` para demo ativa com expiração dentro do lookahead da cadência (48h no Hobby; 24h no Pro)
- **AND** dedup por instante de expiração impede duplicatas

#### Scenario: Encerramento derivado da transação expiration

- **WHEN** a expiração é materializada (por qualquer caller)
- **THEN** `demo_expired` é derivado da transação `expiration` (dedup = expiration_tx_id)
- **AND** o reconciliador repara ausências mesmo que `reserve_credit` tenha materializado antes

### Requirement: Email transacional via Resend (flag VENDEO_EMAIL_ENABLED)

O sistema SHALL prover um módulo `src/lib/email` que envia email via Resend, **somente** quando `VENDEO_EMAIL_ENABLED=true` (default `false`), com remetente `VENDEO_EMAIL_FROM` (default `noreply@vendeo.tech`) e templates próprios. O envio SHALL ser assíncrono e executado por um passo do cron (outbox), nunca inline no request de concessão/consumo/expiração. **Exceção:** com a flag desligada, `support_ack` e `support_notice` **não são suprimidos** — permanecem `pending`/retry até a flag ser ligada e o envio ocorrer.

#### Scenario: Flag off não envia email

- **WHEN** `VENDEO_EMAIL_ENABLED=false`
- **THEN** nenhum email é enviado (notificações de demonstração são suprimidas; `support_ack` e `support_notice` permanecem `pending`/retry)

#### Scenario: Falha de email não afeta a operação

- **WHEN** o envio de email falha (retryable)
- **THEN** a concessão/consumo/expiração já registrados não são afetados
- **AND** `email_status` volta a `pending` com `attempt_count`/`next_attempt_at`/`last_error` (retry via `pending`, **não** via `failed`)

### Requirement: Claim atômico e máquina de estados do envio

O sistema SHALL impedir que dois workers enviem o mesmo email: o worker SHALL fazer **claim atômico** de registros elegíveis — `email_status='pending'` com `(next_attempt_at IS NULL OR next_attempt_at <= now())` **OU** `email_status='processing'` com `lease_expires_at <= now()` (reclaim) — na mesma operação (`UPDATE ... WHERE (pending due) OR (processing com lease vencido)` com lock de linha), marcando `processing` + `lease_expires_at`. Estados: `pending → processing → sent | failed | suppressed`, com **falha retryable voltando a `pending` + `next_attempt_at`**; **`failed` é terminal/dead-letter (sem retry)**; **reclaim de `processing`** quando `lease_expires_at` venceu. `attempt_count` incrementado a cada tentativa; `provider_message_id` registrado em sucesso; `max attempts` + backoff definidos.

#### Scenario: Dois workers não enviam o mesmo email

- **WHEN** dois workers concorrem pelo mesmo registro `pending`
- **THEN** o claim atômico garante que apenas um envia

#### Scenario: Claim cobre processing com lease vencido

- **WHEN** um registro está `processing` com `lease_expires_at <= now()`
- **THEN** o claim atômico o reclassifica para novo `processing` (reclaim), sem duplicar envio

#### Scenario: Falha retryable volta a pending com next_attempt_at

- **WHEN** o envio falha com erro retryable
- **THEN** `email_status` volta a `pending` com `next_attempt_at` definido (backoff), **não** vai a `failed`

#### Scenario: Falha permanente é dead-letter

- **WHEN** o envio atinge `max attempts` ou falha terminal
- **THEN** `email_status='failed'` (terminal, sem retry) e fica **visível no admin**

#### Scenario: Reclaim de processing com lease vencido

- **WHEN** um registro `processing` tem `lease_expires_at <= now()`
- **THEN** o worker pode reclamar o registro (volta a ser processável)

### Requirement: Cadência do cron conforme o plano Vercel

O sistema SHALL confirmar o plano real da Vercel e aplicar **uma única regra por cadência**:

- **Hobby** (não aceita cron horário): **cron diário** com **lookahead de até 48h**, comunicado como **"aproximadamente 24 horas"**.
- **Pro** (ou superior): **cron horário** com **lookahead de 24h**, comunicado como **"24 horas"**.

A **confirmação in-app com protocolo não depende do cron**.

**Janela (testável):** enfileirar `demo_expiring_24h` para qualquer demo **ativa** com `demo_expires_at` dentro do lookahead da cadência, dedup por `demo_expires_at` truncado à hora — exatamente uma vez por instante de expiração.

#### Scenario: Hobby usa cron diário com lookahead de 48h

- **WHEN** o plano é Hobby
- **THEN** o cron é diário e enfileira `demo_expiring_24h` para demo ativa com expiração em até 48h (dedup por instante de expiração)
- **AND** a UI comunica prazo "aproximadamente 24 horas"

#### Scenario: Pro usa cron horário com lookahead de 24h

- **WHEN** o plano é Pro
- **THEN** o cron é horário e enfileira `demo_expiring_24h` para demo ativa com expiração em até 24h
- **AND** a UI comunica prazo "24 horas"

#### Scenario: Email de suporte pode aguardar a próxima execução diária (Hobby)

- **WHEN** o plano é Hobby e um `support_ack`/`support_notice` é gravado entre execuções do cron
- **THEN** o **protocolo é emitido imediatamente** (síncrono no POST), e o email pode aguardar a próxima execução diária

#### Scenario: Confirmação in-app independe do cron

- **WHEN** o usuário solicita créditos
- **THEN** a confirmação com protocolo é síncrona no POST (não aguarda o cron)

### Requirement: Política de supressão (sem backlog tardio)

O sistema SHALL marcar `suppressed` os registros **de demonstração** `pending` quando `VENDEO_EMAIL_ENABLED=false` (evita que mensagens acumuladas sejam enviadas muito depois de a flag ser ligada) e SHALL suprimir mensagens cuja **janela temporal já passou** (ex.: `demo_expiring_24h` cujo instante de expiração já venceu). **Exceção:** `support_ack` e `support_notice` NUNCA são suprimidos — permanecem `pending`/retry (sem janela temporal e juridicamente obrigatórios; falha permanente fica visível no admin).

#### Scenario: Flag off suprime registros de demonstração pendentes

- **WHEN** o worker processa um registro `demo_*` `pending` com `VENDEO_EMAIL_ENABLED=false`
- **THEN** marca `suppressed` (não deixa `pending` acumulando para envio tardio)

#### Scenario: support_ack não é suprimido pela flag off

- **WHEN** o worker processa um `support_ack` `pending` com `VENDEO_EMAIL_ENABLED=false`
- **THEN** NÃO marca `suppressed`; permanece `pending`/retry

#### Scenario: Janela temporal perdida é suprimida (apenas demo)

- **WHEN** um `demo_expiring_24h` tem seu instante de expiração já vencido
- **THEN** o worker marca `suppressed` (não envia aviso fora da janela relevante)

### Requirement: Semântica de entrega (sent ≠ delivered)

O sistema SHALL marcar `email_sent_at` quando o provedor **aceitou** a mensagem (aceitação ≠ entrega). `email_delivered_at` SHALL existir somente com **webhook de entrega do provedor** (fora do escopo da F50 — campo reservado/documentado). O sistema SHALL NOT afirmar "entregue" sem webhook.

#### Scenario: Aceitação registra email_sent_at

- **WHEN** o Resend aceita a mensagem
- **THEN** `email_status='sent'` e `email_sent_at` são registrados
- **AND** nenhuma alegação de entrega é feita

### Requirement: Superfície in-app

O sistema SHALL exibir as notificações in-app (badge/bell na navegação + lista) a partir de `credit_notifications`, com marcação de leitura idempotente (`inapp_read_at`).

#### Scenario: Badge reflete não-lidas

- **WHEN** existem notificações com `inapp_read_at IS NULL`
- **THEN** o badge/bell indica pendências

#### Scenario: Marcação de leitura idempotente

- **WHEN** o usuário marca a notificação como lida
- **THEN** `inapp_read_at` é preenchido uma única vez
