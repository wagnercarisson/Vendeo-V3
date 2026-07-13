## MODIFIED Requirements

### Requirement: Dashboard renders has_store_with_campaigns state

The dashboard SHALL render real content when `getUserOnboardingState` returns `"has_store_with_campaigns"`, replacing the previous placeholder `<EmptyState>`.

#### Scenario: Dashboard renders real content for store with campaigns
- **WHEN** `getUserOnboardingState` returns `"has_store_with_campaigns"`
- **THEN** the dashboard SHALL render `<PageHeader title="Dashboard" />`, greeting with store name and time-of-day, 3 metric cards (total, ready, success rate), recent campaigns section with 3-5 items, adaptive next-step card, link "Ver todas as campanhas →" to `/campanhas`, and link "Configurar loja" to `/loja`
- **AND** no `<EmptyState>` with placeholder text SHALL be rendered
- **AND** the dashboard SHALL call `getCurrentStore(user.userId)` to obtain `store.id` and `store.name` after confirming `has_store_with_campaigns`

## ADDED Requirements

### Requirement: Dashboard greeting shows time-appropriate salutation

The system SHALL display a greeting in the `has_store_with_campaigns` state based on the server's current hour: "Bom dia" (6h-12h), "Boa tarde" (12h-18h), or "Boa noite" (18h-6h), followed by the store name. When `storeName` is null, it SHALL fall back to "Bem-vindo ao Vendeo".

#### Scenario: Greeting shows "Bom dia" between 6h and 12h
- **WHEN** the server hour is 10 (between 6 and 12)
- **THEN** the greeting SHALL start with "Bom dia"

#### Scenario: Greeting shows "Boa tarde" between 12h and 18h
- **WHEN** the server hour is 14 (between 12 and 18)
- **THEN** the greeting SHALL start with "Boa tarde"

#### Scenario: Greeting shows "Boa noite" between 18h and 6h
- **WHEN** the server hour is 21 (between 18 and 6)
- **THEN** the greeting SHALL start with "Boa noite"

#### Scenario: Greeting includes store name when available
- **WHEN** the store has a name
- **THEN** the greeting SHALL include the store name after the salutation (e.g., "Bom dia, Loja XYZ")

#### Scenario: Greeting shows fallback when store name is null
- **WHEN** the store name is null
- **THEN** the greeting SHALL display "Bem-vindo ao Vendeo"

### Requirement: Dashboard displays 3 metric cards

The system SHALL display 3 metric cards in a responsive grid (`grid-cols-1 md:grid-cols-3`) when in `has_store_with_campaigns` state: Total de Campanhas (count), Campanhas Prontas (ready count), and Taxa de Sucesso (success rate percentage).

#### Scenario: Metric cards render with correct values
- **WHEN** the store has campaigns
- **THEN** the dashboard SHALL render 3 `Card` components showing total, ready, and success rate values

#### Scenario: Metric grid is responsive
- **WHEN** the dashboard renders metric cards
- **THEN** the container SHALL have CSS classes `grid-cols-1 md:grid-cols-3 gap-4`

### Requirement: Dashboard shows recent campaigns section

The system SHALL display a "Campanhas Recentes" section when in `has_store_with_campaigns` state, listing 3-5 most recent campaigns with product name, formatted date (dd/mm), status badge, and an "Abrir" link to `/campanhas/[id]`.

#### Scenario: Recent campaigns section renders with campaign items
- **WHEN** the store has campaigns
- **THEN** recent campaigns SHALL be displayed with name, date, status badge, and "Abrir" link

#### Scenario: Recent campaigns section has "Ver todas" link
- **WHEN** recent campaigns are displayed
- **THEN** a link "Ver todas as campanhas →" SHALL link to `/campanhas`

### Requirement: Dashboard shows adaptive next-step card

The system SHALL display an adaptive next-step card in the `has_store_with_campaigns` state. If `recentCampaigns[0]` exists, it SHALL show "Revise sua última campanha" with the product name and a CTA to `/campanhas/[últimoId]`. If the recent list is empty (edge case), it SHALL show "Criar nova campanha" with CTA to `/campanhas/nova`. A secondary "Nova" CTA SHALL always be available.

#### Scenario: Next-step card shows "Revise sua última campanha" when campaigns exist
- **WHEN** `recentCampaigns[0]` exists
- **THEN** the next-step card SHALL show "Revise sua última campanha" with the product name and a CTA link to `/campanhas/[latestId]`

#### Scenario: Next-step card falls back to "Criar nova campanha" when empty
- **WHEN** `recentCampaigns` is empty
- **THEN** the next-step card SHALL show "Criar nova campanha" with CTA to `/campanhas/nova`

### Requirement: Dashboard preserves F19 empty states

The system SHALL preserve the F19 behavior for `no_store` (empty state "Configure sua loja" + CTA → `/loja`) and `has_store_no_campaigns` (empty state "Crie sua primeira campanha" + CTA → `/campanhas/nova`) without any modification.

#### Scenario: no_store state preserves F19 empty state
- **WHEN** `getUserOnboardingState` returns `"no_store"`
- **THEN** the dashboard SHALL render `<EmptyState>` with title "Configure sua loja" and CTA to `/loja` (identical to F19)

#### Scenario: has_store_no_campaigns state preserves F19 empty state
- **WHEN** `getUserOnboardingState` returns `"has_store_no_campaigns"`
- **THEN** the dashboard SHALL render `<EmptyState>` with title "Crie sua primeira campanha" and CTA to `/campanhas/nova` (identical to F19)
