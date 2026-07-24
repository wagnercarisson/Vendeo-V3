## ADDED Requirements

### Requirement: Legal acceptances table

The system SHALL have a `legal_acceptances` table:

```sql
CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  accepted_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('terms_of_service', 'acceptable_use')),
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  acceptance_source TEXT NOT NULL CHECK (acceptance_source IN ('onboarding', 'login_reacceptance', 'admin_invite')),
  UNIQUE(store_id, accepted_by_user_id, document_type, document_version)
);

CREATE INDEX idx_legal_acceptances_store ON legal_acceptances(store_id, document_type);
```

RLS SHALL be enabled. INSERT via service role (server-only). SELECT for own store via RLS. Admin reads via server component with `requireAdmin()`.

#### Scenario: Legal acceptances table exists

- **WHEN** running migrations
- **THEN** `legal_acceptances` table SHALL exist with all required columns and constraints

### Requirement: registerAcceptance()

The system SHALL provide `registerAcceptance(params)` that records a contractual acceptance:

```typescript
export interface RegisterAcceptanceParams {
  storeId: string;
  userId: string;
  documentType: DocumentType;  // "terms_of_service" | "acceptable_use"
  ipAddress: string;
  userAgent: string;
  source: AcceptanceSource;    // "onboarding" | "login_reacceptance" | "admin_invite"
}
```

- Resolves current version from `legal_document_versions` automatically
- Throws if no version is published for the document type
- Ignores unique violation (23505) — re-acceptance of same version by same user is idempotent
- Each user of a store must accept individually: the UNIQUE includes `accepted_by_user_id`, so different users can each accept the same version

#### Scenario: Register acceptance with valid data inserts record

- **WHEN** `registerAcceptance()` is called with valid params
- **THEN** a record SHALL be inserted into `legal_acceptances`

#### Scenario: Same version re-acceptance is idempotent

- **WHEN** `registerAcceptance()` is called twice for the same version
- **THEN** the second call SHALL succeed without throwing (unique violation suppressed)

#### Scenario: No published version throws error

- **WHEN** `registerAcceptance()` is called for a document type with no published version
- **THEN** it SHALL throw an error

### Requirement: registerAllContractAcceptances()

The system SHALL provide `registerAllContractAcceptances(params)` as a convenience that registers both `terms_of_service` and `acceptable_use` in sequence:

```typescript
export async function registerAllContractAcceptances(
  params: Omit<RegisterAcceptanceParams, "documentType">
): Promise<void>
```

#### Scenario: registerAllContractAcceptances creates both records

- **WHEN** `registerAllContractAcceptances()` is called
- **THEN** both `terms_of_service` and `acceptable_use` acceptances SHALL be registered

### Requirement: getAcceptanceStatus()

The system SHALL provide `getAcceptanceStatus(storeId, documentType)` that returns:
- `"current"` — store has accepted the current published version
- `"outdated"` — store has accepted an older version
- `"never"` — store has no acceptance record

#### Scenario: Current acceptance returns current

- **WHEN** the store has accepted the current published version
- **THEN** `getAcceptanceStatus()` returns `"current"`

#### Scenario: Outdated acceptance returns outdated

- **WHEN** the store has accepted an older version than current
- **THEN** `getAcceptanceStatus()` returns `"outdated"`

### Requirement: getStoreAcceptanceHistory()

The system SHALL provide `getStoreAcceptanceHistory(storeId)` that returns all acceptance records for a store, ordered by `accepted_at DESC`.

#### Scenario: History returns ordered records

- **WHEN** querying acceptance history for a store with multiple acceptances
- **THEN** records SHALL be ordered by `accepted_at DESC`
