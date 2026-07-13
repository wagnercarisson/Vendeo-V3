## MODIFIED Requirements

### Requirement: Route migration from /store to /loja

The store identity page SHALL be moved from `src/app/store/page.tsx` (`/store`) to `src/app/(app)/loja/page.tsx` (`/loja`). The old route `/store` SHALL redirect to `/loja` via next.config.ts 301.

#### Scenario: Store page moved to /loja

- **WHEN** a user visits `/loja`
- **THEN** the store identity form SHALL render
- **WHEN** a user visits `/store`
- **THEN** the system SHALL respond with HTTP 301 to `/loja`

### Requirement: Store identity form UI

The system SHALL render a store identity form at `src/app/(app)/loja/page.tsx` (`/loja`) instead of at `/store`.

#### Scenario: Store page renders at /loja

- **WHEN** a user visits `/loja`
- **THEN** the store identity form SHALL render

### Requirement: Navigation between /campanhas/nova and /loja

The store page at `/loja` SHALL include a link to `/campanhas/nova` (instead of `/`). The campaign page at `/campanhas/nova` SHALL redirect to `/loja` when no store exists (instead of redirecting to `/store`).

#### Scenario: Store page has link to campaign page

- **WHEN** a user is on `/loja`
- **THEN** a link SHALL be present to navigate to `/campanhas/nova`

### Requirement: Design tokens confirmed

Tokens SHALL be confirmed/audited in the migrated `/loja` page — most are already applied. Any remaining inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes SHALL be replaced.

#### Scenario: Tokens are used consistently

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`)
