# Privacy Acknowledgement

## ADDED Requirements

### Requirement: Política de Privacidade v1.3 publicada (ADDED F42)

O sistema SHALL publicar `privacy_policy` versão `"v1.3"` em `legal_document_versions` — D12.

- Remove a expressão "beta, gratuita e fechada" (fim do beta fechado).
- Descreve o **captcha (Cloudflare Turnstile)** e a **confirmação de email** no cadastro.
- Descreve a **autenticação por terceiros (Google OAuth)**:
  - dados recebidos do Google: identificador, email, nome e eventualmente avatar;
  - finalidade **exclusivamente autenticacional**;
  - **nenhuma permissão adicional** sobre Gmail/Drive/outros produtos do Google.
- A versão passa a exigir reaceite de privacidade (`hasValidPrivacyAcknowledgement` false para quem tem v1.2) — via PrivacyGate (D16), sem retroatividade destrutiva (D12).

#### Scenario: Privacy v1.3 é vigente

- **WHEN** `getCurrentVersion("privacy_policy")` é chamado
- **THEN** retorna `"v1.3"`

#### Scenario: Usuário com v1.2 fica sem acknowledgment vigente

- **WHEN** um usuário reconheceu a Privacy v1.2
- **AND** a v1.3 é publicada
- **THEN** `hasValidPrivacyAcknowledgement(userId)` retorna `false` (outdated)
- **AND** o PrivacyGate é exigido no próximo acesso autenticado

### Requirement: PrivacyGate obrigatório pós-OAuth — consentimento autenticado (D16)

O sistema SHALL exigir o **PrivacyGate existente** (`src/components/legal/privacy-gate.tsx:18`) para o usuário OAuth **sem acknowledgment vigente** após `/auth/callback`, registrando a ciência da Política de Privacidade e o opt-in comercial opcional **autenticados** — D12/D16.

- O gate NÃO é um novo componente em `components/auth/` — reuso do gate já montado no layout `(app)` (`layout.tsx:35`).
- A ciência é registrada em `privacy_acknowledgements`; o opt-in comercial em `consent_events` (fonte da verdade).
- **NUNCA usar `user_metadata.communicationsOptIn` como evidência legal.**
- O consentimento comercial opcional SHALL ser registrado nessa etapa autenticada (pós-callback), não na criação.

#### Scenario: OAuth sem acknowledgment passa pelo PrivacyGate

- **WHEN** usuário OAuth cai no layout `(app)` após `/auth/callback`
- **AND** `hasValidPrivacyAcknowledgement(userId)` é `false`
- **THEN** o PrivacyGate é renderizado obrigatoriamente
- **AND** a ciência da Privacidade é registrada autenticada em `privacy_acknowledgements`
- **AND** se o usuário optou por comunicações, um evento `granted` é registrado em `consent_events`

#### Scenario: Consentimento comercial registrado autenticado, não em user_metadata

- **WHEN** o opt-in comercial é concedido no PrivacyGate
- **THEN** o registro ocorre em `consent_events`/`privacy_acknowledgements`
- **AND** `user_metadata.communicationsOptIn` NÃO é usado como evidência legal

#### Scenario: OAuth com acknowledgment vigente segue direto ao onboarding

- **WHEN** usuário OAuth já tem ciência de privacidade vigente
- **THEN** o PrivacyGate não é renderizado
- **AND** o fluxo segue para onboarding (F36)

### Requirement: Signup email/senha — ciência declarada no formulário, registrada autenticada (D2/D12)

O sistema SHALL registrar a ciência da Política de Privacidade do caminho email/senha **na primeira autenticação pós-confirmação** — **não "na criação"** (sem sessão no momento do signup) — D2/D12.

- No signup, o usuário declara ciência (modal `PrivacyAcknowledgeModal`) e o estado `privacyPending`/consentimento é salvo em `sessionStorage` (padrão original).
- Após a confirmação de email, no primeiro acesso autenticado, o `PrivacyRecovery`/PrivacyGate processa a pendência e registra a ciência autenticada em `privacy_acknowledgements` e o opt-in em `consent_events`.
- O endpoint de registro usa `requireUser()` (userId de `claims.sub`) — nunca do client body (padrão existente).

#### Scenario: Ciência declarada no signup e registrada após confirmação

- **WHEN** o usuário cria conta email/senha declarando ciência da Privacidade
- **AND** confirma o email e faz o primeiro acesso autenticado
- **THEN** a ciência é registrada autenticada em `privacy_acknowledgements` (pós-confirmação)
- **AND** o opt-in comercial (se concedido) é registrado em `consent_events`