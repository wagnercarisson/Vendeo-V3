## MODIFIED Requirements

### Requirement: Route migration from /minhas-campanhas to /campanhas

The campaign list page SHALL be moved from `src/app/minhas-campanhas/` to `src/app/(app)/campanhas/page.tsx`. The old route `/minhas-campanhas` SHALL redirect to `/campanhas` via next.config.ts 301.

#### Scenario: Campaign list moved to /campanhas

- **WHEN** a user visits `/campanhas`
- **THEN** the campaign list SHALL render
- **WHEN** a user visits `/minhas-campanhas`
- **THEN** the system SHALL respond with HTTP 301 to `/campanhas`

### Requirement: Server Component with auth and ownership

When `getCurrentStore()` returns `null`, the server component SHALL redirect to `/loja` (instead of `/store`).

#### Scenario: Usuário autenticado sem loja

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas`
- **THEN** o sistema SHALL redirecionar para `/loja`

### Requirement: Navigation links updated

All navigation links in the campaign list SHALL be updated:
- Link "Abrir" SHALL point to `/campanhas/[id]` (instead of `/campanha/[id]`)
- CTA estado vazio SHALL point to `/campanhas/nova` (instead of `/`)

#### Scenario: Card link points to new route

- **WHEN** a campaign card renders with status ready
- **THEN** the "Abrir" link SHALL point to `/campanhas/{campaignId}`

### Requirement: Empty state CTA updated

The CTA "Criar Primeira Campanha" in the empty state SHALL navigate to `/campanhas/nova` (instead of `/`).

#### Scenario: Empty state CTA navigates to nova

- **WHEN** the empty state is rendered
- **THEN** the CTA button SHALL link to `/campanhas/nova`

## REMOVED Requirements

### Requirement: AuthHeader link "Minhas Campanhas"

**Reason**: The `AuthHeader` component is removed in F18 (see auth-header spec). The sidebar (Dashboard, Campanhas, Loja, Conta) replaces its navigation responsibilities, so the individual "Minhas Campanhas" link is no longer needed.

**Migration**: The link "Minhas Campanhas" previously rendered by `AuthHeader` is removed alongside the component. Navigation to `/campanhas` is now provided by the sidebar.

### Requirement: Middleware matcher updated

The `config.matcher` in `src/middleware.ts` SHALL be updated to include `/campanhas/:path*` instead of `/minhas-campanhas`.

#### Scenario: Matcher includes campanhas

- **WHEN** the middleware is loaded
- **THEN** the `config.matcher` SHALL include `/campanhas/:path*` instead of `/minhas-campanhas`

### Requirement: Design tokens applied

All inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes in the migrated campaign list SHALL be replaced with design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`).

#### Scenario: Tokens replace raw Tailwind colors

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens instead of raw Tailwind color classes
