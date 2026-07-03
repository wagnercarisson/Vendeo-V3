## MODIFIED Requirements

### Requirement: Store identity passed through form props

`CampaignPageClient` SHALL fetch store identity from `GET /api/store/{id}` (which now returns `{ ...store, identity }`). The page SHALL pass `storeId` (not `StoreIdentitySnapshot`) as a prop to `CampaignInputForm`. `CampaignInputForm` SHALL forward `storeId` to `useCampaignForm`. The hook SHALL use `storeId` only for the generation request body — identity data is resolved server-side.

The `StoreIdentityBlock` SHALL consume `identity` from the GET response directly, without calling `resolveStoreIdentity` as a separate server action.

#### Scenario: storeId passed instead of snapshot

- **WHEN** `CampaignPageClient` renders `CampaignInputForm`
- **THEN** a `storeId: string` SHALL be passed as a prop
- **AND** `StoreIdentitySnapshot` SHALL NOT be passed as a prop
- **AND** `StoreIdentityBlock` SHALL consume `identity` from the GET response

### Requirement: Submit triggers API generation

The submit behavior SHALL be updated. Instead of including identity fields in the request body, the system SHALL:

1. Validate all required fields
2. Create or reuse the product image object URL from the selected image file
3. Call `POST /api/campaign/generate-image` with form data including `storeId` — no identity fields
4. On success: compose a `PreviewPayload` and store in sessionStorage
5. Navigate to `/campaign/preview`
6. On error: display error state with retry option

#### Scenario: Valid submit sends storeId in body

- **WHEN** all required fields are valid and the user clicks "Criar Campanha"
- **THEN** the system SHALL call `POST /api/campaign/generate-image` with `storeId` in the body
- **AND** the body SHALL NOT include `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, or `brandProfile`
- **AND** on success, store the preview payload in sessionStorage
- **AND** navigate to `/campaign/preview`

#### Scenario: API error shows error state

- **WHEN** the API returns an error response
- **THEN** the form SHALL display an error message
- **AND** the user SHALL be able to retry
