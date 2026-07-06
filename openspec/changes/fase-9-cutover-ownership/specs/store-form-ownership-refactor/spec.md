## ADDED Requirements

### Requirement: store-page-client receives initialStore from server

The system SHALL update `src/components/flow/store-page-client.tsx` to receive `initialStore` as a prop from the server component.

- MUST accept `initialStore: Store | null` prop
- MUST pass `initialStore` to `StoreIdentityForm`
- SHALL NOT read `localStorage("store_id")` on mount
- SHALL NOT remove `localStorage("store_id")` on 404

#### Scenario: Server passes store data

- **WHEN** `store-page-client.tsx` receives `initialStore` with store data
- **THEN** it passes the store to `StoreIdentityForm`
- **AND** no localStorage call is made

#### Scenario: Server passes null for new store

- **WHEN** `store-page-client.tsx` receives `initialStore={null}`
- **THEN** it passes null to `StoreIdentityForm`
- **AND** the form renders in create mode

### Requirement: campaign-page-client receives store from server

The system SHALL update `src/components/flow/campaign-page-client.tsx` to receive `store` as a prop from the server component.

- MUST accept `store: Store` prop
- MUST use `store.id` for API calls to the store endpoints
- SHALL NOT read `localStorage("store_id")` on mount
- Loading/blocking states related to store resolution SHALL be removed (server decides before rendering)

#### Scenario: Server passes store to campaign page

- **WHEN** `campaign-page-client.tsx` receives `store` from server
- **THEN** it uses `store.id` for API calls
- **AND** no localStorage call is made

### Requirement: useStoreForm receives initialStore instead of reading localStorage

The system SHALL update `src/components/flow/use-store-form.ts` to receive `initialStore` as a parameter instead of reading from localStorage.

- MUST accept `initialStore: Store | null` as a hook parameter
- MUST initialize form state from `initialStore` on mount
- If `initialStore` is null: MUST start in create mode with empty form
- If `initialStore` is provided: MUST start in edit mode with pre-filled form
- `save()` function SHALL determine mode based on local `storeId` state, initialized from `initialStore?.id` (or null) and updated after successful POST
  - If storeId is null → `POST /api/store` (create)
  - If storeId exists → `PATCH /api/store/${storeId}` (edit)
- After successful POST create: MUST update local `storeId` state with returned `id` (no localStorage)
- SHALL NOT call `localStorage.getItem("store_id")`
- SHALL NOT call `localStorage.setItem("store_id")`
- SHALL NOT call `localStorage.removeItem("store_id")`

#### Scenario: useStoreForm initializes from initialStore

- **WHEN** `useStoreForm({ initialStore })` is called with store data
- **THEN** the form fields are pre-filled from the store data
- **AND** the mode is set to edit

#### Scenario: useStoreForm initializes empty for create

- **WHEN** `useStoreForm({ initialStore: null })` is called
- **THEN** the form starts empty
- **AND** the mode is set to create

#### Scenario: Save in create mode calls POST

- **WHEN** `save()` is called with `storeId === null` (initialStore was null, no POST done yet)
- **THEN** a POST request is sent to `/api/store`

#### Scenario: Save in edit mode calls PATCH

- **WHEN** `save()` is called with an existing `storeId` (from initialStore or from previous POST response)
- **THEN** a PATCH request is sent to `/api/store/{storeId}`

#### Scenario: Second save after POST uses PATCH

- **WHEN** `save()` is called a second time after a successful POST
- **THEN** storeId is now set from the POST response
- **AND** a PATCH request is sent (not POST)

#### Scenario: POST response updates local state without localStorage

- **WHEN** POST `/api/store` returns 201 with `{ id }`
- **THEN** form state is updated with the new id
- **AND** no localStorage call is made
