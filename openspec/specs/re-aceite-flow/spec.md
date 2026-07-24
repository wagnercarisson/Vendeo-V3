> **Propósito**: Tela de re-aceite contratual com sumário de mudanças, bloqueio operacional de capabilities até re-aceite, e banner não-bloqueante para atualizações de privacidade.

## Requirements

### Requirement: Re-aceite page at /legal/reaccept

The system SHALL provide a re-acceptance page at `/legal/reaccept` when the user's store has outdated contractual document acceptances:

- Route: `src/app/(app)/legal/reaccept/page.tsx`
- Detects pending documents from `requireLegalClearance()` result
- Displays: "Os Termos de Uso foram atualizados" message
- Displays summary of changes from the new version (`summary` field)
- Provides link to the full document
- Button "Aceitar nova versão"
- Button "Revisar documento" opens the full document
- After acceptance: INSERT into `legal_acceptances` with new version, guard releases
- Requires auth (middleware allows through)

#### Scenario: Re-aceite page shows when acceptance is outdated

- **WHEN** user accesses `/legal/reaccept` with outdated acceptances
- **THEN** the page SHALL display the version summary and acceptance button

#### Scenario: After re-aceite, guard returns ok

- **WHEN** user re-accepts the new version
- **THEN** `registerAcceptance()` inserts new records
- **AND** subsequent `requireLegalClearance()` returns `{ ok: true }`

### Requirement: Operational block (not absolute)

When a user's store does NOT have valid contractual acceptance, the system SHALL enforce an operational block at the route handler level (not middleware-level):

- The user SHALL retain access to: re-aceite screen, legal docs (/termos, /privacidade, /uso-aceitavel), account/profile, support, account cancellation
- The system SHALL block access to: campaign generation, visual signature creation, commercial export

#### Scenario: User without acceptance can access account

- **WHEN** a user's store has no valid contractual acceptance
- **THEN** the user SHALL still be able to access `/conta`

#### Scenario: User without acceptance cannot generate campaign

- **WHEN** a user's store has no valid contractual acceptance
- **THEN** `POST /api/campaign/generate-image` SHALL return 403 before any operation

### Requirement: Privacy policy change — non-blocking banner

When the privacy policy version changes, the system SHALL:
- Display a non-blocking banner: "A Política de Privacidade foi atualizada. [Ler]"
- NOT block any functionality
- Open the new version when user clicks "Ler"
- Update `privacy_acknowledgements` when user dismisses the banner as acknowledgement

#### Scenario: Privacy update shows banner

- **WHEN** a new privacy policy version is published
- **THEN** a non-blocking banner SHALL be displayed to the user

### Requirement: Acceptance history preserved on re-aceite

When a user re-accepts a new version, the old acceptance records SHALL NOT be deleted. The UNIQUE constraint ensures each user-version pair is recorded once.

#### Scenario: Re-aceite preserves old acceptance records

- **WHEN** a user re-accepts a new version
- **THEN** the old acceptance records SHALL remain in `legal_acceptances`
