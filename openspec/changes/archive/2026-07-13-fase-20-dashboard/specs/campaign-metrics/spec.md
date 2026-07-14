## ADDED Requirements

### Requirement: countCampaigns returns total campaign count for a store

The system SHALL provide `countCampaigns(storeId: string): Promise<number>` that returns the total number of campaigns for a given store, counting both `ready` and `error` statuses.

#### Scenario: countCampaigns returns combined count of ready + error campaigns
- **WHEN** `countCampaigns` is called with a valid store ID
- **THEN** it SHALL return the count of campaigns with status IN ('ready', 'error')

#### Scenario: countCampaigns returns 0 when no campaigns exist
- **WHEN** the store has no campaigns
- **THEN** `countCampaigns` SHALL return 0

### Requirement: countReadyCampaigns returns count of ready campaigns

The system SHALL provide `countReadyCampaigns(storeId: string): Promise<number>` that returns the count of campaigns with status `ready` for a given store.

#### Scenario: countReadyCampaigns filters by status='ready'
- **WHEN** `countReadyCampaigns` is called with a valid store ID
- **THEN** it SHALL return only campaigns with status 'ready'

### Requirement: getCampaignSuccessRate calculates success rate

The system SHALL provide `getCampaignSuccessRate(storeId: string): Promise<number>` that calculates the percentage of ready campaigns over total (ready + error) campaigns, returning an integer 0-100.

#### Scenario: getCampaignSuccessRate returns 0 when no campaigns
- **WHEN** the store has zero campaigns
- **THEN** `getCampaignSuccessRate` SHALL return 0

#### Scenario: getCampaignSuccessRate returns 100 when all campaigns are ready
- **WHEN** all campaigns for the store have status 'ready'
- **THEN** `getCampaignSuccessRate` SHALL return 100

#### Scenario: getCampaignSuccessRate returns rounded integer for mixed statuses
- **WHEN** some campaigns are ready and some are error
- **THEN** `getCampaignSuccessRate` SHALL return `Math.round((ready / total) * 100)`

### Requirement: getRecentCampaigns returns recent campaigns ordered by date

The system SHALL provide `getRecentCampaigns(storeId: string, limit?: number): Promise<RecentCampaignItem[]>` that returns the most recent campaigns (ready + error) ordered by `created_at` descending, limited to the specified number (default 5). Each item SHALL contain `id`, `productName`, `status`, and `createdAt` — no `storagePath` or thumbnail data.

#### Scenario: getRecentCampaigns returns N items in descending order
- **WHEN** `getRecentCampaigns` is called with a store that has campaigns
- **THEN** it SHALL return an array of `RecentCampaignItem` ordered by `created_at` descending, limited to the specified limit

#### Scenario: getRecentCampaigns returns empty array when no campaigns
- **WHEN** the store has no campaigns
- **THEN** `getRecentCampaigns` SHALL return an empty array

### Requirement: countCampaigns is reexported from onboarding/count

The system SHALL reexport `countCampaigns` from `@/lib/onboarding/count` pointing to `@/lib/campaign/metrics` to maintain backwards compatibility with `getUserOnboardingState` from F19.

#### Scenario: onboarding/count exports countCampaigns from campaign/metrics
- **WHEN** `@/lib/onboarding/count` is imported
- **THEN** `countCampaigns` SHALL be available and function identically to `@/lib/campaign/metrics`

### Requirement: RecentCampaignItem type

The system SHALL export a `RecentCampaignItem` interface with fields `id: string`, `productName: string`, `status: CampaignStatus`, and `createdAt: string`.

#### Scenario: RecentCampaignItem has correct shape
- **WHEN** `RecentCampaignItem` is imported
- **THEN** it SHALL contain `id`, `productName`, `status`, and `createdAt` fields
