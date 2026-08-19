> **Propósito**: Registro de ciência da Política de Privacidade no signup (user-level, upsert por user_id). Declaração de conhecimento, não aceite contratual. F42 (D12/D16): v1.3 vigente, PrivacyGate pós-OAuth, ciência registrada na primeira autenticação pós-confirmação.

## Requirements

### Requirement: Privacy acknowledgement table

The system SHALL have a `privacy_acknowledgements` table:

```sql
CREATE TABLE public.privacy_acknowledgements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy_policy_version TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL
);
```

RLS SHALL be enabled. Policy: INSERT/UPDATE only via service role (server-only). SELECT for own `user_id` via RLS.

#### Scenario: Privacy acknowledgement table exists

- **WHEN** running migrations
- **THEN** `privacy_acknowledgements` table SHALL exist with PK = user_id and all required columns

#### Scenario: RLS restricts privacy acknowledgement access

- **WHEN** a user queries privacy acknowledgements
- **THEN** they SHALL only see their own record via RLS

### Requirement: registerPrivacyAcknowledgement()

The system SHALL provide `registerPrivacyAcknowledgement(params)` that upserts a privacy acknowledgement:

```typescript
export interface RegisterPrivacyAcknowledgementParams {
  userId: string;
  version: string;
  ipAddress: string;
  userAgent: string;
}
```

- Uses upsert with `onConflict: "user_id"` — one row per user, updated when version changes
- Only callable via service role (server-side only)
- Throws on error

#### Scenario: Register privacy acknowledgement creates record

- **WHEN** `registerPrivacyAcknowledgement()` is called with valid params
- **THEN** a record SHALL be inserted into `privacy_acknowledgements`

#### Scenario: Same version upsert is idempotent

- **WHEN** `registerPrivacyAcknowledgement()` is called twice with the same version
- **THEN** the operation SHALL succeed without duplication error

### Requirement: Política de Privacidade v1.1 publicada (ADDED F32)

O sistema SHALL publicar `privacy_policy` versão `"v1.1"` em `legal_document_versions`. A nova versão documenta explicitamente as finalidades da coleta de CNPJ:
- Identificar a loja/empresa contratante
- Habilitar benefícios gratuitos/freemium
- Prevenir abuso, fraude e múltiplos cadastros promocionais
- Processar cobranças e emitir notas fiscais
- Cumprir obrigações legais e regulatórias
- Suporte, auditoria e segurança da conta

Base legal: Contrato (execução de termos) + legítimo interesse (antifraude).

#### Scenario: Privacy v1.1 é vigente

- **WHEN** `getCurrentVersion("privacy_policy")` é chamado
- **THEN** retorna `"v1.1"`

### Requirement: hasValidPrivacyAcknowledgement()

The system SHALL provide `hasValidPrivacyAcknowledgement(userId)` that checks if the user's acknowledged version matches the current published version:

```typescript
export async function hasValidPrivacyAcknowledgement(userId: string): Promise<boolean>
```

- Returns `true` if privacy_policy_version matches current version from `legal_document_versions`
- Returns `false` if no acknowledgement exists or version is outdated

#### Scenario: User with valid acknowledgement returns true

- **WHEN** a user has acknowledged the current privacy policy version
- **THEN** `hasValidPrivacyAcknowledgement()` returns `true`

#### Scenario: User with no acknowledgement returns false

- **WHEN** a user has never acknowledged the privacy policy
- **THEN** `hasValidPrivacyAcknowledgement()` returns `false`

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
