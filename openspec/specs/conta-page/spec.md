> **Propósito**: Esta spec define a página de conta do usuário (`/conta`) dentro do route group `(app)/`. Exibe informações básicas da conta, seção de créditos com saldo e extrato paginado, link para alterar senha e botão de logout.
>
> > Synced from `fase-18-app-shell-ui-base-rotas` (ADDED). Modified by `fase-27-conta-saldo-extrato` (MODIFIED): added credit section with BalanceCard, TransactionHistory, CreditCta.

## Requirements

### Requirement: Account page at /conta

The system SHALL provide an account page at `src/app/(app)/conta/page.tsx` inside the `(app)` route group with:
- `<PageHeader title="Conta" />` with breadcrumbs (Dashboard > Conta)
- Email display resolved from `claims.email`, with fallback to a short userId display (`claims.sub?.slice(0, 8)`)
- User display name: use email as primary identifier. If `JwtPayload` is extended to include a `name` field, it SHALL be shown when available as "Name (email)"; otherwise only the email SHALL be shown.
- Seção de créditos: `BalanceCard` com saldo + `TransactionHistory` com extrato paginado + `CreditCta` condicional
- Link to `/update-password` (existing route)
- "Sair" button reusing the `LogoutButton` component
- UI sections in Cards: Informações da Conta, Créditos (saldo + extrato + CTA), Segurança, Sessão
- Styled with design tokens
- **Seção de status legal** (new card "Privacidade e Termos"):
  - Status de ciência de privacidade: "Ciente" with current version or "Pendente" with action button
  - Status de consentimento comercial: toggle/button to revoke or re-activate
  - Status de aceite contratual: "Vigente", "Pendente" (with link to `/legal/reaccept`), or "Nunca aceitou"
- **Communications consent toggle** in the legal section:
  - Calls `POST /api/legal/communications-consent` to grant or revoke
  - Shows current effective state
  - On change, updates UI optimistically

#### Scenario: Conta page shows email

- **WHEN** an authenticated user visits `/conta`
- **THEN** the page SHALL display the user's email address from `claims.email`

#### Scenario: Conta page shows fallback when email unavailable

- **WHEN** an authenticated user visits `/conta`
- **AND** `claims.email` is undefined
- **THEN** the page SHALL display a short userId from `claims.sub` as fallback

#### Scenario: Conta page links to update-password

- **WHEN** an authenticated user visits `/conta`
- **THEN** a link to `/update-password` SHALL be present

#### Scenario: Conta page has logout button

- **WHEN** an authenticated user visits `/conta`
- **THEN** a "Sair" button using `LogoutButton` SHALL be present

#### Scenario: Conta page shows credit section

- **WHEN** an authenticated user with store visits `/conta`
- **THEN** the page SHALL display the credit section with balance card and paginated extract

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

### Requirement: Credit section on /conta page

O sistema SHALL exibir uma seção "Créditos" na página `/conta` com:
- `BalanceCard` — card de saldo com destaque visual, obtido via `CreditService.getBalance(store.id)` com cliente de sessão
- `TransactionHistory` — extrato paginado, obtido via `CreditService.getHistory(store.id, LIMIT, offset)` + `CreditService.countCreditTransactions(store.id)`
- `CreditCta` — CTA "Solicitar créditos" visível quando saldo é zero ou baixo
- Paginação real com 10 transações por página via `searchParams`

#### Scenario: Conta page shows credit section with balance

- **WHEN** usuário autenticado com loja acessa `/conta`
- **THEN** exibe seção "Créditos" com card de saldo e valor formatado

#### Scenario: Conta page shows paginated extract

- **WHEN** usuário acessa `/conta` com transações
- **THEN** exibe extrato paginado com transações

#### Scenario: Conta page shows CTA when balance is zero

- **WHEN** usuário acessa `/conta` com saldo zero
- **THEN** exibe CTA "Solicitar créditos" na seção de créditos

### Requirement: Conta page handles credit error states

O sistema SHALL exibir estado de erro distinto quando o carregamento do saldo ou extrato falha, sem confundir com saldo zero.

#### Scenario: Conta page shows credit error fallback

- **WHEN** carregamento do saldo ou extrato falha
- **THEN** exibe mensagem de erro amigável
- **AND** exibe fallback "—" no lugar do valor

### Requirement: Conta page handles no-store credit state

O sistema SHALL exibir estado distinto quando o usuário não possui loja, mostrando CTA de onboarding em vez de créditos.

#### Scenario: Conta page shows "Criar loja" when no store

- **WHEN** usuário sem loja acessa `/conta`
- **THEN** exibe "Você ainda não tem uma loja" com CTA "Criar loja" → `/loja`
- **AND** não exibe extrato
