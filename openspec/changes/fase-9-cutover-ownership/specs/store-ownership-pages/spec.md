## ADDED Requirements

### Requirement: /store page is server component with auth + store resolution

The system SHALL update `src/app/store/page.tsx` to be a server component that validates authentication and resolves the store.

- MUST call `await requirePageUser()` — redirects to `/login` if not authenticated
- MUST call `const store = await getCurrentStore(user.userId)` — passes userId to avoid duplicate auth (D11)
- If store is found: MUST pass `initialStore={store}` to `<StorePageClient />` (edit mode)
- If store is null: MUST pass `initialStore={null}` to `<StorePageClient />` (create mode)
- SHALL NOT use `localStorage("store_id")` anywhere in the page or its children

#### Scenario: Authenticated user with store sees edit mode

- **WHEN** an authenticated user visits `/store`
- **AND** the user has a store
- **THEN** `StorePageClient` receives `initialStore` with store data
- **AND** the form renders in edit mode

#### Scenario: Authenticated user without store sees create mode

- **WHEN** an authenticated user visits `/store`
- **AND** the user has no store
- **THEN** `StorePageClient` receives `initialStore={null}`
- **AND** the form renders in create mode

#### Scenario: Unauthenticated user is redirected to /login

- **WHEN** an unauthenticated user visits `/store`
- **THEN** `requirePageUser()` redirects to `/login`

### Requirement: / page is server component with store resolution + conditional redirect

The system SHALL update `src/app/page.tsx` to be a server component that resolves store and redirects to `/store` if none exists.

- MUST call `await requirePageUser()` — redirects to `/login` if not authenticated
- MUST call `const store = await getCurrentStore(user.userId)`
- If store is null: MUST call `redirect("/store")` — user must create a store first
- If store exists: MUST pass `store={store}` to `<CampaignPageClient />`
- SHALL NOT use localStorage for store resolution

#### Scenario: Authenticated user without store is redirected

- **WHEN** an authenticated user visits `/`
- **AND** the user has no store
- **THEN** the server redirects to `/store`

#### Scenario: Authenticated user with store sees campaign page

- **WHEN** an authenticated user visits `/`
- **AND** the user has a store
- **THEN** `CampaignPageClient` receives `store` as a prop
- **AND** the campaign page renders normally

#### Scenario: Unauthenticated user is redirected to /login

- **WHEN** an unauthenticated user visits `/`
- **THEN** `requirePageUser()` redirects to `/login`

### Requirement: /campaign/preview with server wrapper

The system SHALL restructure `/campaign/preview` into a server wrapper page + client component.

- `src/app/campaign/preview/page.tsx` SHALL become a server component (wrapper)
- MUST call `await requirePageUser()` — redirects to `/login` if not authenticated
- MUST call `const store = await getCurrentStore(user.userId)`
- If store is null: MUST call `redirect("/store")`
- If store exists: MUST render `<CampaignPreviewClient />`
- The existing client logic SHALL be extracted to `src/app/campaign/preview/preview-client.tsx`

#### Scenario: Authenticated user with store sees preview

- **WHEN** an authenticated user visits `/campaign/preview`
- **AND** the user has a store
- **THEN** `CampaignPreviewClient` is rendered

#### Scenario: Authenticated user without store is redirected

- **WHEN** an authenticated user visits `/campaign/preview`
- **AND** the user has no store
- **THEN** the server redirects to `/store`

#### Scenario: Unauthenticated user is redirected to /login

- **WHEN** an unauthenticated user visits `/campaign/preview`
- **THEN** `requirePageUser()` redirects to `/login`
