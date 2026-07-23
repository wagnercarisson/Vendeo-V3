## MODIFIED Requirements

### Requirement: Account page at /conta (MODIFIED)

The system SHALL provide an account page at `src/app/(app)/conta/page.tsx` inside the `(app)` route group with:
- `<PageHeader title="Conta" />` with breadcrumbs (Dashboard > Conta)
- Email display resolved from `claims.email`, with fallback to a short userId display
- Seção de créditos: `BalanceCard` com saldo + `TransactionHistory` com extrato paginado + `CreditCta` condicional
- Link to `/update-password` (existing route)
- "Sair" button reusing the `LogoutButton` component
- UI sections in Cards: Informações da Conta, Créditos, Segurança, Sessão
- **Seção de status legal** (new card "Privacidade e Termos"):
  - Status de ciência de privacidade: "Ciente" with current version or "Pendente" with action button
  - Status de consentimento comercial: toggle/button to revoke or re-activate
  - Status de aceite contratual: "Vigente", "Pendente" (with link to `/legal/reaccept`), or "Nunca aceitou"
- **Communications consent toggle** in the legal section:
  - Calls `POST /api/legal/communications-consent` to grant or revoke
  - Shows current effective state
  - On change, updates UI optimistically

#### Scenario: Account page shows legal status section

- **WHEN** an authenticated user visits `/conta`
- **THEN** the page SHALL display a legal status card with privacy, consent, and acceptance statuses

#### Scenario: User can revoke communications consent from conta

- **WHEN** user clicks the revoke button on communications consent
- **THEN** `POST /api/legal/communications-consent` SHALL be called with `action: "revoked"`
- **AND** the UI SHALL update to show revoked state

#### Scenario: User can re-activate communications consent

- **WHEN** user clicks the activate button on revoked communications consent
- **THEN** `POST /api/legal/communications-consent` SHALL be called with `action: "granted"`
- **AND** the UI SHALL update to show granted state
