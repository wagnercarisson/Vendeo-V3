## ADDED Requirements

### Requirement: BrandProfileSnapshot removes logoVariantUrl

The `BrandProfileSnapshot` TypeScript type (in `src/components/campaign/types.ts`) SHALL remove the `logoVariantUrl` field. Asset URLs for identity (logo or visual signature) SHALL be carried exclusively by `StoreIdentitySnapshot.signature.url`.

The `store_brand_profiles` database table SHALL NOT change — `logoVariantUrl` exists only in the in-memory snapshot type. No migration is needed.

#### Scenario: BrandProfileSnapshot consumed without logoVariantUrl

- **WHEN** a `BrandProfileSnapshot` is constructed
- **THEN** it SHALL NOT include `logoVariantUrl` or `logo_variant_url`
- **AND** consumers SHALL read asset URLs from `StoreIdentitySnapshot.signature.url`

### Requirement: Brand profile synced always delivered as creative direction

The brand profile `synced` SHALL always be included in `StoreIdentitySnapshot.brandProfile`, regardless of `identity_state`. The brand profile provides creative direction (`visual_style`, `visual_tone`, `brand_personality`, `campaign_guidelines`, `campaign_brief`, `safe_color_tokens`).

The profile SHALL NOT be filtered by source compatibility with `identity_state`. If `profile.source` is incompatible (e.g., `source = logo_analysis` with `identity_state = text_only` after logo removal), a diagnostic SHALL be logged but the profile SHALL be included normally.

No individual field of the brand profile is a mandatory visual instruction. Their translation in the campaign composition remains under the director's judgment.

#### Scenario: Brand profile included after logo removal

- **WHEN** a store has `identity_state = 'text_only'` and a `synced` profile with `source = 'logo_analysis'`
- **THEN** the brand profile SHALL be included in the snapshot
- **AND** `signature.url` SHALL be `null` (no active asset)
- **AND** the profile fields SHALL be available as creative direction

#### Scenario: Brand profile included for visual_signature state

- **WHEN** a store has `identity_state = 'visual_signature'` and a `synced` profile with `source = 'without_logo'`
- **THEN** the brand profile SHALL be included
- **AND** `signature.url` SHALL contain the VS URL
