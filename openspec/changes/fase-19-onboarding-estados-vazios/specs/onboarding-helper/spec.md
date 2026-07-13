## ADDED Requirements

### Requirement: OnboardingState type and EmptyStateCopy interface

The system SHALL define types in `src/lib/onboarding/types.ts`:
- `OnboardingState`: union type `"no_store" | "has_store_no_campaigns" | "has_store_with_campaigns"`
- `EmptyStateCopy`: interface with `icon` (LucideIcon), `title` (string), `description` (string), `ctaLabel` (optional string), `ctaHref` (optional string)

#### Scenario: OnboardingState has exactly 3 values

- **WHEN** `OnboardingState` type is referenced
- **THEN** it SHALL accept only `"no_store"`, `"has_store_no_campaigns"`, or `"has_store_with_campaigns"`

#### Scenario: EmptyStateCopy requires icon, title, description

- **WHEN** an `EmptyStateCopy` object is created
- **THEN** `icon`, `title`, and `description` SHALL be required
- **AND** `ctaLabel` and `ctaHref` SHALL be optional

### Requirement: countCampaigns with SELECT COUNT(*) and head:true

The system SHALL provide `countCampaigns(storeId: string): Promise<number>` in `src/lib/onboarding/count.ts` with `"server-only"` that:
- Uses `createServerClient()` from `@/lib/supabase/server`
- Executes `SELECT COUNT(*)` on `campaigns` table filtered by `store_id` and `status IN ('ready', 'error')`
- Uses `head: true` to avoid transferring row data
- Returns `count` or `0` if count is null
- Throws on error

#### Scenario: countCampaigns returns count for store with campaigns

- **WHEN** `countCampaigns` is called with a `storeId` that has 3 ready/error campaigns
- **THEN** it SHALL return `3`

#### Scenario: countCampaigns returns 0 for store without campaigns

- **WHEN** `countCampaigns` is called with a `storeId` that has 0 campaigns
- **THEN** it SHALL return `0`

#### Scenario: countCampaigns throws on query error

- **WHEN** the database query fails
- **THEN** `countCampaigns` SHALL throw an Error with the error message

### Requirement: getUserOnboardingState with 3 states

The system SHALL provide `getUserOnboardingState(userId: string): Promise<OnboardingState>` in `src/lib/onboarding/state.ts` with `"server-only"` that:
- Calls `getCurrentStore(userId)` from `@/lib/auth/store-ownership`
- If `getCurrentStore` returns null, returns `"no_store"`
- Calls `countCampaigns(store.id)` 
- If count is 0, returns `"has_store_no_campaigns"`
- Otherwise returns `"has_store_with_campaigns"`

#### Scenario: getUserOnboardingState returns no_store when no store

- **WHEN** `getCurrentStore` returns null
- **THEN** `getUserOnboardingState` SHALL return `"no_store"`
- **AND** `countCampaigns` SHALL NOT be called

#### Scenario: getUserOnboardingState returns has_store_no_campaigns when store exists but no campaigns

- **WHEN** `getCurrentStore` returns a store
- **AND** `countCampaigns` returns 0
- **THEN** `getUserOnboardingState` SHALL return `"has_store_no_campaigns"`

#### Scenario: getUserOnboardingState returns has_store_with_campaigns when store has campaigns

- **WHEN** `getCurrentStore` returns a store
- **AND** `countCampaigns` returns > 0
- **THEN** `getUserOnboardingState` SHALL return `"has_store_with_campaigns"`

### Requirement: Microcopy centralized in src/lib/onboarding/microcopy.ts

The system SHALL define the following `EmptyStateCopy` constants in `src/lib/onboarding/microcopy.ts`:

| Constant | icon | title | description | ctaLabel | ctaHref |
|----------|------|-------|-------------|----------|---------|
| `DASHBOARD_NO_STORE` | `Store` | Configure sua loja | Para começar a criar campanhas, primeiro precisamos conhecer sua loja. | Configurar loja | /loja |
| `DASHBOARD_NO_CAMPAIGNS` | `Megaphone` | Crie sua primeira campanha | Sua loja está pronta! Agora é hora de criar sua primeira campanha profissional. | Criar campanha | /campanhas/nova |
| `DASHBOARD_PLACEHOLDER` | `LayoutDashboard` | Seu dashboard está sendo preparado | Em breve você verá aqui suas métricas e campanhas recentes. | (sem CTA) | (sem CTA) |
| `CAMPAIGNS_NO_STORE` | `Store` | Configure sua loja | Suas campanhas aparecerão aqui depois que você configurar sua loja. | Configurar loja | /loja |
| `CAMPAIGNS_NO_CAMPAIGNS` | `Megaphone` | Nenhuma campanha ainda | Crie sua primeira campanha e ela aparecerá aqui. | Criar primeira campanha | /campanhas/nova |

#### Scenario: All constants have required fields filled

- **WHEN** any microcopy constant is accessed
- **THEN** `icon` SHALL be a LucideIcon component
- **AND** `title` SHALL be a non-empty string
- **AND** `description` SHALL be a non-empty string
- **AND** if `ctaLabel` is present, `ctaHref` SHALL also be present and non-empty
