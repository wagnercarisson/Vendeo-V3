## MODIFIED Requirements

### Requirement: Read store API

The system SHALL expose a `GET /api/store/[id]` endpoint that returns a single store record **enriched with the resolved `StoreIdentitySnapshot`** in a single response.

The response format SHALL be `{ ...store, identity: StoreIdentitySnapshot }` — all existing store fields SHALL remain at the top level. The `identity` field SHALL contain the full resolved snapshot. Existing consumers of the endpoint SHALL NOT break.

If the store is not found, the endpoint SHALL return HTTP 404.

#### Scenario: Existing store returns enriched response

- **WHEN** a GET request is sent to `/api/store/{existing-uuid}`
- **THEN** the response status SHALL be 200
- **AND** the response body SHALL contain all existing store fields at the top level
- **AND** the response body SHALL include an `identity` field with the resolved `StoreIdentitySnapshot`
- **AND** `identity.identityState` SHALL be present

#### Scenario: Non-existing store returns 404

- **WHEN** a GET request is sent to `/api/store/{non-existing-uuid}`
- **THEN** the response status SHALL be 404

### Requirement: Brand assets pre-resolved in StoreIdentitySnapshot

Active store_brand_assets SHALL be pre-resolved at the `StoreIdentitySnapshot` level. The snapshot SHALL include `identityState` and `signature: { url: string | null, type: "logo" | "visual_signature" | null }` in place of separate `logoUrl`, `visualSignatureUrl`, and `visualSignatureType`.

`resolveStoreIdentity` SHALL perform async database calls (the previous constraint that it must be synchronous is removed). The snapshot SHALL NOT include `logo_variant_url` in `BrandProfileSnapshot`.

The resolution order SHALL be:
1. `identity_state` from store row — canonical source
2. If `identity_state = 'logo'`: resolve `signature.url` from active store_brand_assets
3. If `identity_state = 'visual_signature'`: resolve `signature.url` from active visual signature
4. If `identity_state = 'text_only'`: `signature.url = null`
5. If asset is expected but not found: `signature.url = null`, log diagnostic, do not alter state
6. Resolve brandProfile from the single `synced` profile (any source)

#### Scenario: Identity snapshot includes identityState and signature

- **WHEN** a campaign is being prepared for a store
- **THEN** the snapshot SHALL include `identityState` and `signature: { url, type }`
- **AND** SHALL NOT include standalone `logoUrl`, `visualSignatureUrl`, or `visualSignatureType`

#### Scenario: BrandProfileSnapshot does not include logo_variant_url

- **WHEN** a `BrandProfileSnapshot` is constructed
- **THEN** it SHALL NOT include `logo_variant_url` or `logoVariantUrl`
- **AND** asset URLs SHALL only be carried by `signature.url` at the snapshot level

#### Scenario: Logo state resolves from brand_assets

- **WHEN** `identity_state = 'logo'` and active store_brand_assets exist
- **THEN** `signature.url` SHALL be the active asset URL
- **AND** `signature.type` SHALL be `'logo'`

#### Scenario: VS state resolves from visual_signatures

- **WHEN** `identity_state = 'visual_signature'` and an active visual signature exists
- **THEN** `signature.url` SHALL be the visual signature `asset_url`
- **AND** `signature.type` SHALL be `'visual_signature'`

### Requirement: Fallback for missing logo

When `logo_url` is `null` or empty, the store identity resolver SHALL use `identity_state` as the primary decision source:

1. If `identity_state = 'logo'`: attempt to read from store_brand_assets
2. If `identity_state = 'visual_signature'`: read from active visual signature
3. If `identity_state = 'text_only'`: do not look up assets — `signature.url = null`
4. If asset is expected but not found: `signature.url = null`, log diagnostic, do not transition state
5. Brand profile (single `synced`, any source) is always included as creative direction

The `logo_status` field SHALL inform UI behavior but SHALL NOT block the resolution chain.

#### Scenario: identity_state = text_only skips asset lookup

- **WHEN** `identity_state = 'text_only'`
- **THEN** the resolver SHALL NOT search for store_brand_assets or visual signatures
- **AND** `signature.url` SHALL be `null`
- **AND** the brand profile SHALL still be resolved and included

#### Scenario: identity_state = logo with no assets returns null URL

- **WHEN** `identity_state = 'logo'` but no active logo assets exist
- **THEN** `signature.url` SHALL be `null`
- **AND** `identity_state` SHALL remain `'logo'` (not degraded)
- **AND** a diagnostic SHALL be logged

## REMOVED Requirements

### Requirement: Logo takes priority over visual signature

**Reason**: Replaced by `identity_state` lookup. `identity_state` determines which asset type to use — logo and visual signature are mutually exclusive per state.

**Migration**: All consumers SHALL use `signature.url` from `StoreIdentitySnapshot` instead of comparing `logoUrl` vs `visualSignatureUrl`.

#### Scenario: Removed — logo no longer compared to VS

- **WHEN** resolving store identity
- **THEN** `identity_state` SHALL determine the asset type
- **AND** no consumer SHALL compare `logoUrl` and `visualSignatureUrl` independently
