## MODIFIED Requirements

### Requirement: Account page at /conta

The system SHALL provide an account page at `src/app/(app)/conta/page.tsx` inside the `(app)` route group with:
- `<PageHeader title="Conta" />` with breadcrumbs (Dashboard > Conta)
- Email display resolved from `claims.email`, with fallback to a short userId display (`claims.sub?.slice(0, 8)`)
- Seção de créditos: `BalanceCard` com saldo + `TransactionHistory` com extrato paginado + `CreditCta` condicional
- Link to `/update-password` (existing route)
- "Sair" button reusing the `LogoutButton` component
- UI sections in Cards: Informações da Conta, Créditos (saldo + extrato + CTA), Segurança, Sessão
- Styled with design tokens

#### Scenario: Conta page shows email

- **WHEN** an authenticated user visits `/conta`
- **THEN** the page SHALL display the user's email address from `claims.email`

#### Scenario: Conta page has logout button

- **WHEN** an authenticated user visits `/conta`
- **THEN** a "Sair" button using `LogoutButton` SHALL be present

#### Scenario: Conta page shows credit section

- **WHEN** an authenticated user with store visits `/conta`
- **THEN** the page SHALL display the credit section with balance card and paginated extract

## ADDED Requirements

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
