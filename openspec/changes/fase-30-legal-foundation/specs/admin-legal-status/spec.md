## ADDED Requirements

### Requirement: Legal status badges on /admin/users/[id]

The system SHALL display legal status badges on the admin user detail page:

**Privacy acknowledgement badge:**
- "✅ Ciente" — user has valid privacy acknowledgement matching current version
- "❌ Não registrado" — no privacy acknowledgement record

**Contractual acceptance badge:**
- "✅ Vigente" — store has current acceptance for all required documents
- "⏳ Pendente" — store has acceptance but not for the current version (outdated)
- "❌ Nunca aceitou" — no acceptance records for the store

**Communications consent badge:**
- "✅ Consentimento ativo" — effective consent is "granted"
- "⏳ Consentimento revogado" — effective consent is "revoked"
- "❌ Nunca definido" — effective consent is "never_set"

#### Scenario: Admin sees privacy badge

- **WHEN** admin views a user with valid privacy acknowledgement
- **THEN** the badge SHALL display "✅ Ciente"

#### Scenario: Admin sees acceptance badge

- **WHEN** admin views a user with current contractual acceptance
- **THEN** the badge SHALL display "✅ Vigente"

#### Scenario: Admin sees consent badge

- **WHEN** admin views a user with active communications consent
- **THEN** the badge SHALL display "✅ Consentimento ativo"

### Requirement: Acceptance detail and history on admin

The admin user detail page SHALL show:
- Acceptance details per document: version, accepted_at, accepted_by_user_id, IP, UA
- Full acceptance history ordered by accepted_at DESC
- Action: "Reenviar notificação de re-aceite" (logged in admin_audit_log)

#### Scenario: Admin sees acceptance history

- **WHEN** admin views a user with multiple acceptances
- **THEN** the history SHALL be ordered by `accepted_at DESC`

### Requirement: No bulk acceptance by admin

The admin SHALL NOT be able to accept legal documents on behalf of a store. `bulk_migration` is out of scope for F30. Each acceptance is personal and non-transferable.

#### Scenario: Admin cannot bulk-accept

- **WHEN** admin accesses user detail
- **THEN** there SHALL be no "Accept on behalf" action available
