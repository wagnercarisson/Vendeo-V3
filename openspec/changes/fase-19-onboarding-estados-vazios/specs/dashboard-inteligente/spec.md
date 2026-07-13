## ADDED Requirements

### Requirement: Dashboard as async server component with 3-state rendering

The system SHALL provide a dashboard page at `src/app/(app)/dashboard/page.tsx` that:
- Is an async Server Component
- Calls `requirePageUser()` for authentication
- Calls `getUserOnboardingState(user.userId)` to detect the user's onboarding state
- Renders `<PageHeader title="Dashboard" />` in all states
- Switches rendering based on `OnboardingState`:
  - `"no_store"`: `<EmptyState>` with `DASHBOARD_NO_STORE` microcopy + CTA button → `/loja`
  - `"has_store_no_campaigns"`: `<EmptyState>` with `DASHBOARD_NO_CAMPAIGNS` microcopy + CTA button → `/campanhas/nova`
  - `"has_store_with_campaigns"`: `<EmptyState>` with `DASHBOARD_PLACEHOLDER` microcopy (no CTA)

#### Scenario: Dashboard renders no_store state

- **WHEN** `getUserOnboardingState` returns `"no_store"`
- **THEN** the dashboard SHALL render `<PageHeader title="Dashboard" />` + `<EmptyState>` with title "Configure sua loja"
- **AND** a CTA button "Configurar loja" SHALL link to `/loja`

#### Scenario: Dashboard renders has_store_no_campaigns state

- **WHEN** `getUserOnboardingState` returns `"has_store_no_campaigns"`
- **THEN** the dashboard SHALL render `<PageHeader title="Dashboard" />` + `<EmptyState>` with title "Crie sua primeira campanha"
- **AND** a CTA button "Criar campanha" SHALL link to `/campanhas/nova`

#### Scenario: Dashboard renders has_store_with_campaigns state

- **WHEN** `getUserOnboardingState` returns `"has_store_with_campaigns"`
- **THEN** the dashboard SHALL render `<PageHeader title="Dashboard" />` + `<EmptyState>` with title "Seu dashboard está sendo preparado"
- **AND** no CTA button SHALL be rendered
- **AND** no metrics SHALL be displayed

#### Scenario: PageHeader is present in all 3 states

- **WHEN** the dashboard renders any state
- **THEN** a `<PageHeader>` with title "Dashboard" SHALL be present

#### Scenario: Dashboard propagates errors to Next.js error boundary

- **WHEN** `getUserOnboardingState` throws an error
- **THEN** the error SHALL bubble up to the default Next.js error boundary
