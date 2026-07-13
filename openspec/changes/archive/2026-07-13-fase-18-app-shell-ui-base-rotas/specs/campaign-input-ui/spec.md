## MODIFIED Requirements

### Requirement: Route migration from / to /campanhas/nova

The campaign input form SHALL be moved from `src/app/page.tsx` (`/`) to `src/app/(app)/campanhas/nova/page.tsx` (`/campanhas/nova`). The root route `/` SHALL redirect to `/dashboard` via next.config.ts 301.

#### Scenario: Campaign form moved to /campanhas/nova

- **WHEN** a user visits `/campanhas/nova`
- **THEN** the campaign input form SHALL render
- **WHEN** a user visits `/`
- **THEN** the system SHALL respond with HTTP 301 to `/dashboard`

### Requirement: Campaign input form UI

The system SHALL render a campaign input form at `src/app/(app)/campanhas/nova/page.tsx` (`/campanhas/nova`) instead of at the root route.

#### Scenario: Campaign form renders at /campanhas/nova

- **WHEN** a user visits `/campanhas/nova`
- **THEN** the campaign input form SHALL render

### Requirement: No-store redirect updated

When no store exists, the system SHALL redirect from `/campanhas/nova` to `/loja` (instead of `/store`).

#### Scenario: Usuário sem loja redirecionado para /loja

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas/nova`
- **THEN** o sistema SHALL redirecionar para `/loja`

### Requirement: Navigation links updated

All internal links in the campaign input form SHALL be updated to point to new routes:
- `/store` SHALL become `/loja`
- `/campanha/[id]` SHALL become `/campanhas/[id]`
- `/minhas-campanhas` SHALL become `/campanhas`
- `/campaign/preview` SHALL become `/campanhas/nova`

#### Scenario: Links point to new routes

- **WHEN** a user interacts with navigation elements in the campaign form
- **THEN** all internal links SHALL point to the new route paths

### Requirement: Design tokens applied

All inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes in the migrated campaign input form SHALL be replaced with design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`).

#### Scenario: Tokens replace raw Tailwind colors

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens instead of raw Tailwind color classes
