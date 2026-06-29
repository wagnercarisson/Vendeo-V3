> **Purpose**: Delta spec for logo-upload capability — remove `/logo/versions` endpoint and document the retry technical endpoint.

## REMOVED Requirements

### Requirement: Logo versions history — GET /api/store/[id]/logo/versions

**Reason**: Endpoint without callers. The version history was used by the logo restore modal, which has been removed. No frontend component or API consumer depends on this endpoint.

**Migration**: No migration needed — the endpoint can be safely removed. The underlying data in `store_brand_assets` remains intact.

## ADDED Requirements

### Requirement: BrandDirector retry — POST /api/store/[id]/logo/retry-brand-director

The upload lifecycle SHALL include a retry mechanism for BrandDirector analysis failures. When the initial analysis fails during upload, the system SHALL provide a dedicated endpoint (defined in `logo-retry` spec) for re-running the analysis on the active asset without re-uploading the file.

#### Scenario: Retry available after failed analysis

- **WHEN** a logo upload succeeds (file stored, variants generated)
- **AND** the BrandDirector analysis fails
- **THEN** the store SHALL be in `identity_state = 'logo'` with the asset `active`
- **AND** a failed profile SHALL exist linked to the asset
- **AND** the retry endpoint SHALL be available to re-run the analysis
