## ADDED Requirements

### Requirement: Preview payload stored in sessionStorage on successful generation

On successful campaign generation, the system SHALL compose a `PreviewPayload` and store it in sessionStorage before navigating to `/campaign/preview`. The payload SHALL contain:

```typescript
interface PreviewPayload {
  campaignSpec: CampaignSpec;
  storeIdentity: StoreIdentitySnapshot;
  productImageUrl: string | null;
  generatedAt: string;
}
```

The `productImageUrl` SHALL be the existing client-side object URL from `URL.createObjectURL`. No file, blob, or base64 data SHALL be stored in sessionStorage.

#### Scenario: Payload stored after successful generation

- **WHEN** the API returns a successful `CampaignSpec`
- **THEN** the system SHALL compose a `PreviewPayload` with the spec, store identity, product image URL, and current timestamp
- **AND** store it in sessionStorage

#### Scenario: Payload cleared on new campaign

- **WHEN** the user starts a new campaign from the campaign input
- **THEN** the existing preview payload SHALL be removed from sessionStorage

### Requirement: Object URL lifecycle management

The object URL created via `URL.createObjectURL` for the product image SHALL NOT be revoked when navigating from campaign input to preview. It SHALL remain valid for the preview route. The object URL SHALL only be revoked when:
- Starting a new campaign
- Clearing the preview payload
- Navigating back through an application-controlled preview exit action

On tab close or full page reload, the browser document cleanup is sufficient — no explicit revocation logic is required for those cases.

#### Scenario: Object URL persists during navigation to preview

- **WHEN** the user navigates from campaign input to `/campaign/preview`
- **THEN** the product image object URL SHALL remain valid
- **AND** the preview SHALL display the product image

#### Scenario: Object URL revoked on new campaign

- **WHEN** the user starts a new campaign
- **THEN** the previous object URL SHALL be revoked via `URL.revokeObjectURL`

### Requirement: Navigation to preview route

After storing the payload in sessionStorage, the system SHALL navigate the user to `/campaign/preview` using client-side navigation (`next/navigation` `router.push`).

#### Scenario: Navigates to preview after generation

- **WHEN** the preview payload is successfully stored in sessionStorage
- **THEN** the system SHALL navigate to `/campaign/preview`
- **AND** the current tab SHALL remain active (no new tab or window)
