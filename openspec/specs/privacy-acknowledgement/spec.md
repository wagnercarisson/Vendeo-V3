> **Propósito**: Registro de ciência da Política de Privacidade no signup (user-level, upsert por user_id). Declaração de conhecimento, não aceite contratual.

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
