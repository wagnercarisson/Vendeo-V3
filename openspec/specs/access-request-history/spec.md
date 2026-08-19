# Access Request History

> Synced from `fase-42-signup-controlado-elegibilidade-freemium` (ADDED).

## Purpose

A tabela `access_requests` preservada como histórico, fila comercial e canal de contato/contingência operacional — NÃO como mecanismo de autorização. Landing e `/signup` passam a responder conforme a flag `VENDEO_PUBLIC_SIGNUP_ENABLED` (D4/D5).

## Requirements

### Requirement: CTA da landing conforme a flag

A seção de acesso da landing (`src/components/landing/access-request-section.tsx`) SHALL apresentar CTAs conforme `VENDEO_PUBLIC_SIGNUP_ENABLED` — D4/D5:

- **Flag on:** CTA principal "Continuar com Google" (→ `signInWithOAuth('google')`) + CTA secundário "Continuar com email" (→ `/signup`).
- **Flag off (estado atual):** "Solicitar acesso free" + formulário de solicitação, comportamento idêntico ao atual.
- A flag SHALL ser validada **server-side** na rota/página que controla (não só no cliente).

#### Scenario: Flag on renderiza CTAs de signup

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED=true` está configurado
- **THEN** a landing exibe "Continuar com Google" (principal) e "Continuar com email" (secundário)

#### Scenario: Flag off preserva solicitação de acesso

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED` está desligado (default)
- **THEN** a landing exibe "Solicitar acesso free" + formulário de solicitação (comportamento atual idêntico)

### Requirement: access_requests preservado como histórico, fila comercial e canal de contato — NÃO autorização

A tabela `access_requests` SHALL ser preservada como **histórico, fila comercial e canal de contato/contingência operacional** — D4.

- Com signup público ligado, qualquer pessoa pode criar conta (não depende de `access_requests`).
- Com signup desligado, o sistema não identifica o visitante antes da autenticação.
- **Sem token/allowlist:** um registro `approved` em `access_requests` NÃO concede privilégio técnico algum (não autoriza criar conta em `/signup`, não concede crédito, não dá acesso a funcionalidades).
- Admin pode reativar/consultar a fila (canal comercial/contingência).
- **Sem migração destrutiva** e sem alteração de schema em `access_requests`.

#### Scenario: Approved em access_requests não bloqueia novo signup

- **WHEN** um email já possui registro `approved` em `access_requests` (histórico de convite manual)
- **AND** o usuário tenta criar conta pelo signup público (flag on)
- **THEN** o signup não é bloqueado pelo registro histórico
- **AND** nenhum privilégio adicional é concedido pelo `approved`

#### Scenario: Access request permanece como fila comercial

- **WHEN** admin consulta `/admin/access-requests`
- **THEN** a fila continua disponível (histórico + canal de contato/contingência operacional)

### Requirement: /signup com flag off — "Beta fechado" preservado

Com a flag off, o acesso a `/signup` SHALL exibir a página de "Beta fechado" atual (comportamento preservado, inalterado) — D4/D5.

#### Scenario: Flag off exibe Beta fechado

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED` está desligado
- **AND** o usuário acessa `/signup`
- **THEN** a página "Beta fechado" atual é exibida (comportamento preservado, inalterado)
- **AND** nenhum formulário de signup nem botão OAuth é exposto