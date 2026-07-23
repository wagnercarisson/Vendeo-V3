## MODIFIED Requirements

### Requirement: Store identity form UI (MODIFIED)

The system SHALL render a store identity form at `src/app/(app)/loja/page.tsx` (`/loja`).

**When creating a store** (store is null / `isCreating` is true):
- The form SHALL include a required legal acceptance checkbox at the bottom:
  - Label: "Li e aceito os **Termos de Uso** e a **Política de Uso Aceitável**."
  - "Termos de Uso" links to `/termos`, "Política de Uso Aceitável" links to `/uso-aceitavel`
  - Submit is blocked if unchecked: "Você precisa aceitar os Termos de Uso e a Política de Uso Aceitável."
  - Must pass only `acceptedTerms: true` to the API call — versions are resolved server-side
- The form SHALL NOT send version strings or IP/UA; those are resolved/collected by the server handler
- After success: legal acceptances are registered by the atomic RPC (not the client)

**When editing a store** (store exists):
- The legal acceptance checkbox SHALL NOT be displayed

#### Scenario: Creating store requires legal acceptance

- **WHEN** user is creating a store (no existing store)
- **AND** the legal acceptance checkbox is unchecked
- **THEN** submit SHALL be blocked with legal acceptance error message

#### Scenario: Creating store with acceptance calls API with legal params

- **WHEN** user is creating a store with the acceptance checkbox checked
- **THEN** POST /api/store SHALL be called with `acceptedTerms: true` (versions resolved server-side)

#### Scenario: Editing store does not show acceptance checkbox

- **WHEN** user is editing an existing store
- **THEN** the legal acceptance checkbox SHALL NOT be displayed
