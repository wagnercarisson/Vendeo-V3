## ADDED Requirements

### Requirement: Legal document versions table

The system SHALL have a `legal_document_versions` table:

```sql
CREATE TABLE public.legal_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('terms_of_service', 'privacy_policy', 'acceptable_use')),
  version TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  UNIQUE(document_type, version)
);
```

#### Scenario: Legal document versions table exists

- **WHEN** running migrations
- **THEN** `legal_document_versions` SHALL exist with all required columns and constraints

### Requirement: Seed v1.0 of legal documents

The system SHALL seed the initial versions of all three legal documents:

| Document | Version | Summary |
|----------|---------|---------|
| `terms_of_service` | v1.0 | "Versão inicial dos Termos de Uso" |
| `privacy_policy` | v1.0 | "Versão inicial da Política de Privacidade" |
| `acceptable_use` | v1.0 | "Versão inicial da Política de Uso Aceitável" |

#### Scenario: Seed creates initial versions

- **WHEN** running seed migration
- **THEN** `legal_document_versions` SHALL contain v1.0 entries for all three document types

### Requirement: getCurrentVersion()

The system SHALL provide `getCurrentVersion(documentType)` that returns the current published version (the one with the most recent `effective_at` ≤ now()).

```typescript
export async function getCurrentVersion(
  documentType: DocumentType
): Promise<{ version: string; effectiveAt: string; summary: string | null } | null>
```

#### Scenario: Current version returns published version

- **WHEN** a version is published with `effective_at` in the past
- **THEN** `getCurrentVersion()` SHALL return that version

#### Scenario: No published version returns null

- **WHEN** no version exists for the document type
- **THEN** `getCurrentVersion()` SHALL return `null`

### Requirement: getVersionHistory()

The system SHALL provide `getVersionHistory(documentType)` that returns all versions for a document type ordered by `effective_at DESC`.

#### Scenario: History returns ordered versions

- **WHEN** querying version history
- **THEN** versions SHALL be ordered by `effective_at DESC`

### Requirement: isVersionCurrent()

The system SHALL provide `isVersionCurrent(documentType, version)` that returns `true` if the given version matches the current published version.

#### Scenario: Matching version returns true

- **WHEN** checking the current published version
- **THEN** `isVersionCurrent()` returns `true`

#### Scenario: Non-matching version returns false

- **WHEN** checking an older version
- **THEN** `isVersionCurrent()` returns `false`
