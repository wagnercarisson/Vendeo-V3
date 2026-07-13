## ADDED Requirements

### Requirement: Account page at /conta

The system SHALL provide an account page at `src/app/(app)/conta/page.tsx` inside the `(app)` route group with:
- `<PageHeader title="Conta" />` with breadcrumbs (Dashboard > Conta)
- Email display resolved from `claims.email`, with fallback to a short userId display (`claims.sub?.slice(0, 8)`)
- User display name: use email as primary identifier (e.g., `claims.email`). If `JwtPayload` is extended in the future to include a `name` field, it SHALL be shown when available as "Name (email)"; otherwise only the email SHALL be shown.
- Link to `/update-password` (existing route)
- "Sair" button reusing the `LogoutButton` component
- Styled with design tokens

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
