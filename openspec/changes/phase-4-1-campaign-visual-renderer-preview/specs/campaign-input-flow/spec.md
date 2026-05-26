> **Propósito**: This spec defines the delta behavior for the campaign input flow after successful API generation. It modifies the existing `campaign-input-ui` spec by replacing the local-only submit with API generation + preview navigation.

## MODIFIED Requirements

### Requirement: Store identity passed through form props

`CampaignPageClient` SHALL resolve the store identity once and pass a `storeIdentity` prop into `CampaignInputForm`. `CampaignInputForm` SHALL forward it to `useCampaignForm`. The hook SHALL use the snapshot only to compose the preview payload after successful generation.

#### Scenario: Store identity flows through component hierarchy

- **WHEN** `CampaignPageClient` renders `CampaignInputForm`
- **THEN** a `StoreIdentitySnapshot` SHALL be passed as a prop
- **AND** `CampaignInputForm` SHALL forward it to `useCampaignForm`
- **AND** no additional fetch SHALL be made

### Requirement: Submit triggers API generation

The submit behavior SHALL be modified. Instead of displaying a local success banner without an API call, the system SHALL:

1. Validate all required fields
2. Create or reuse the product image object URL from the selected image file
3. Call `POST /api/campaign/generate` with form data
4. On success: compose a `PreviewPayload` and store in sessionStorage
5. Navigate to `/campaign/preview`
6. On error: display error state with retry option

#### Scenario: Valid submit calls API and navigates to preview

- **WHEN** all required fields are valid and the user clicks "Criar Campanha"
- **THEN** the system SHALL call `POST /api/campaign/generate`
- **AND** on success, store the preview payload in sessionStorage
- **AND** navigate to `/campaign/preview`

#### Scenario: API error shows error state

- **WHEN** the API returns an error response
- **THEN** the form SHALL display an error message
- **AND** the user SHALL be able to retry

## ADDED Requirements

### Requirement: Submit loading state during API call

While the API call is in progress, the submit button SHALL show a loading state with a spinner. The submit button and all form fields SHALL be disabled during generation.

#### Scenario: Loading state during generation

- **WHEN** the user clicks "Criar Campanha"
- **AND** the API call is in progress
- **THEN** the submit button SHALL show a spinner
- **AND** the button and all form fields SHALL be disabled
- **AND** the submitted payload SHALL be frozen from the form state at submit time — edits during in-flight generation SHALL NOT affect the preview payload

### Requirement: Preview payload cleared when navigating back

When the user navigates back to the campaign input route from the preview, the preview payload SHALL be cleared from sessionStorage.

#### Scenario: Back navigation clears payload

- **WHEN** the user navigates from `/campaign/preview` back to the campaign input route
- **THEN** the preview payload SHALL be removed from sessionStorage
