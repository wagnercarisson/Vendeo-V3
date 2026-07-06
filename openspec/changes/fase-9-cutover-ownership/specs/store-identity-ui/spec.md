## MODIFIED Requirements

### Requirement: Auto-load existing store

The system SHALL pre-fill the store identity form when the user returns.

**MODIFIED**: The store data SHALL come from the server component via `initialStore` prop, not from localStorage.

- `StorePageClient` SHALL receive `initialStore: Store | null` from the server component
- `useStoreForm({ initialStore })` SHALL initialize state from the `initialStore` parameter
- If `initialStore` is null: form starts in create mode (empty)
- If `initialStore` is provided: form starts in edit mode with pre-filled data
- SHALL NOT read `localStorage("store_id")`

#### Scenario: Form pre-filled from server prop

- **WHEN** `StorePageClient` mounts with `initialStore`
- **THEN** the form fields are pre-filled from `initialStore`
- **AND** no localStorage call is made

#### Scenario: Form starts empty for new store

- **WHEN** `StorePageClient` mounts with `initialStore={null}`
- **THEN** the form fields are empty
- **AND** the form is in create mode

### Requirement: Create store (first save)

**MODIFIED**: On first save, `POST /api/store` is called. After success, the returned `id` SHALL be kept in local state, not in localStorage.

#### Scenario: POST on first save

- **WHEN** the user saves the form
- **AND** `initialStore` was null
- **THEN** POST /api/store is called
- **AND** on success, the returned `id` updates local state

#### Scenario: No localStorage after creation

- **WHEN** POST /api/store succeeds
- **THEN** `localStorage.setItem("store_id", ...)` is NOT called

### Requirement: Edit store (subsequent saves)

**MODIFIED**: On subsequent saves, `PATCH /api/store/[id]` is called using local `storeId` state (initialized from `initialStore?.id`, updated after POST).

#### Scenario: PATCH on subsequent saves

- **WHEN** the user modifies the form and saves
- **AND** local `storeId` is set (from initialStore or previous POST)
- **THEN** PATCH /api/store/{storeId} is called

### Requirement: localStorage as temporary persistence

**REMOVED**: `localStorage` is no longer used for store identity persistence.

**Reason**: Store identity is now resolved by the server via `claims.sub` → `stores.user_id`. The server component handles persistence by resolving the store on every request.

**Migration**: All code that reads `localStorage("store_id")` has been replaced with server-side store resolution. Client components receive store data via props.

### Requirement: Navigation between `/` and `/store`

**MODIFIED**: The `/` page no longer has a blocking/loading state for store resolution. If the user has no store, the server redirects to `/store` before rendering any client content.

#### Scenario: No loading state for store resolution

- **WHEN** an authenticated user visits `/`
- **AND** the user has a store
- **THEN** the campaign page renders immediately (no loading state)
- **WHEN** an authenticated user visits `/`
- **AND** the user has no store
- **THEN** the server redirects to `/store` before any client rendering

### Requirement: Store identity form UI

**MODIFIED**: The form at `/store` is embedded in `StorePageClient`, which receives `initialStore` from the server component. The form logic (create vs edit) is determined by `storeId` state (initialized from `initialStore`, updated after POST), not by localStorage.

#### Scenario: Server drives create vs edit mode

- **WHEN** `StorePageClient` renders with `initialStore={null}`
- **THEN** the form is in create mode
- **WHEN** `StorePageClient` renders with `initialStore` containing store data
- **THEN** the form is in edit mode
