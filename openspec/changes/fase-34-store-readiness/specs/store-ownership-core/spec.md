## MODIFIED Requirements

### Requirement: getCurrentStore resolves store by claims.sub

> **Delta F34:** O tipo `Store` SHALL receber novos campos CNPJ que antes eram acessados via cast. A interface SHALL incluir todos os campos de cadastro fiscal que existem no banco desde a F32/F33. Todos os casts `(store as unknown as Record<string, unknown>)` SHALL ser substituídos por acesso tipado direto.

The system SHALL add all CNPJ fields to the `Store` interface in `src/lib/store.ts`: `cnpj_normalized`, `cnpj_root_hash`, `razao_social`, `nome_fantasia`, `cnpj_validation_score`, `verification_status`, `verification_data`, `cnpj_official_data`, `cnpj_lookup_hash`, `verification_requested_at`, `verification_decided_at`, `verification_reasons`, and `is_test_store`. All existing casts `(store as unknown as Record<string, unknown>).campo` SHALL be replaced with direct typed access.

#### Scenario: Store type inclui campos CNPJ tipados

- **WHEN** o tipo `Store` em `src/lib/store.ts` é inspecionado
- **THEN** os seguintes campos SHALL estar presentes com tipos explícitos (não `unknown`):
  - `cnpj_normalized: string | null`
  - `cnpj_root_hash: string`
  - `razao_social: string | null`
  - `nome_fantasia: string | null`
  - `cnpj_validation_score: Record<string, unknown> | null`
  - `verification_status: string`
  - `verification_data: Record<string, unknown> | null`
  - `cnpj_official_data: Record<string, unknown> | null`
  - `cnpj_lookup_hash: string | null`
  - `verification_requested_at: string | null`
  - `verification_decided_at: string | null`
  - `verification_reasons: string[] | null`
  - `is_test_store: boolean`

#### Scenario: Cast removidos do código existente

- **WHEN** o código em `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/cadastro/cnpj/page.tsx`, `src/components/legacy/cnpj-update-banner.tsx`, `src/components/verification/verification-banners.tsx`, e `src/lib/store-identity-service.ts` é inspecionado
- **THEN** NENHUM cast `(store as unknown as Record<string, unknown>).campo` está presente
- **AND** todos os acessos a campos CNPJ usam o tipo `Store` diretamente (ex: `store.cnpj_normalized`)
