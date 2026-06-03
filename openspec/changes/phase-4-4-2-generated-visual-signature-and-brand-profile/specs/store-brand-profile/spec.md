## MODIFIED Requirements

### Requirement: Store Brand Profiles table

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | Yes | `gen_random_uuid()` | Primary key |
| `store_id` | `uuid` | Yes | — | FK → stores(id) |
| `source` | `text` | Yes | — | `logo_analysis`, `without_logo` |
| `active_logo_asset_id` | `uuid` | No | `null` | FK → store_brand_assets(id), points to the active original asset. Null when source = without_logo |
| `logo_colors_detected` | `jsonb` | No | `null` | Array of hex color strings detected from logo analysis or suggested by identity art director |
| `brand_colors_chosen` | `jsonb` | No | `null` | Array of hex color strings chosen by the lojista |
| `safe_color_tokens` | `jsonb` | No | `null` | `{ primary, secondary, accent, ... }` — safe usage tokens |
| `visual_style` | `text` | No | `null` | Inferred visual style description |
| `visual_tone` | `text` | No | `null` | Inferred visual tone (e.g., "moderno e clean") |
| `typography_direction` | `text` | No | `null` | Typography direction inferred from brand |
| `brand_personality` | `text` | No | `null` | Brand personality description |
| `campaign_guidelines` | `text` | No | `null` | Guidelines for campaign generation |
| `campaign_brief` | `text` | No | `null` | Structured brief for the Campaign Director |
| `confidence_score` | `float` | No | `null` | 0–1, confidence of the AI analysis |
| → `visual_signature_id` | `uuid` | No | `null` | FK → store_visual_signatures(id). The approved visual signature that originated this profile (for source = without_logo) |
| → `inferred_primary_color` | `text` | No | `null` | Primary color inferred by AI (may differ from brand_colors_chosen[0]) |
| → `inferred_accent_color` | `text` | No | `null` | Accent color inferred by AI |
| → `identity_art_director_output` | `jsonb` | No | `null` | Creative metadata from identity art director: creative_description, suggested_colors, visual_direction, elements_used |
| `metadata` | `jsonb` | No | `null` | Model, provider, elapsedMs, error details, etc |
| `version` | `int` | Yes | `1` | Incremented on regeneration |
| `status` | `text` | Yes | `processing` | `processing`, `synced`, `outdated`, `failed`, `archived` |
| `created_at` | `timestamptz` | Yes | `now()` | Auto-set on create |
| `updated_at` | `timestamptz` | Yes | `now()` | Auto-updated on change |

The migration SHALL include:
- CHECK constraint: `status IN ('processing', 'synced', 'outdated', 'failed', 'archived')`
- CHECK constraint: `source IN ('logo_analysis', 'without_logo')`
- Partial unique index: `(store_id)` WHERE `status = 'synced'` — enforces at most one active profile per store
- Trigger for auto-updating `updated_at`

#### Scenario: Migration includes new source

- **WHEN** inspecting the migration
- **THEN** the CHECK constraint for `source` SHALL include `'without_logo'`
- **AND** the new columns `visual_signature_id`, `inferred_primary_color`, `inferred_accent_color`, `identity_art_director_output` SHALL exist

#### Scenario: Profile with source without_logo has null active_logo_asset_id

- **WHEN** a profile is created with `source = 'without_logo'`
- **THEN** `active_logo_asset_id` SHALL be null
- **AND** `visual_signature_id` SHALL reference the approved visual signature

### Requirement: Brand profile lifecycle

Profiles SHALL follow this lifecycle:

1. Created directly with status `synced` when analysis completes successfully (V1)
2. Created directly with status `failed` when analysis fails (V1)
3. Previous `synced` profile becomes `outdated` ONLY when a NEW profile is created with status `synced` — if the new profile fails, the previous synced profile SHALL remain unchanged
4. Profile becomes `archived` when logo is soft-deleted

If a new logo is uploaded for a store that previously had a brand profile with source `without_logo`, and the new profile is created with status `synced`, the without_logo profile SHALL be marked `outdated`.

#### Scenario: Previous profile marked outdated only on new synced profile

- **WHEN** a new brand profile is created with `status = 'synced'`
- **AND** a previous synced profile exists
- **THEN** the previous profile SHALL be set to `outdated`

#### Scenario: Failed new profile preserves previous

- **WHEN** a new brand profile is created with `status = 'failed'`
- **AND** a previous synced profile exists
- **THEN** the previous profile SHALL remain `synced` unchanged
- **AND** the store SHALL continue using the previous profile

#### Scenario: Without-logo profile outdated by new logo

- **WHEN** a new logo is uploaded for a store with a `synced` profile from source `without_logo`
- **AND** the new profile analysis completes with `status = 'synced'`
- **THEN** the previous profile SHALL be set to `outdated`
- **AND** a new profile SHALL be created with `source = 'logo_analysis'`

## ADDED Requirements

### Requirement: Brand profile generation for without-logo flow

The system SHALL expose a `POST /api/store/[id]/brand-profile/generate-without-logo` endpoint that generates a brand profile from store cadastral data + approved Store Identity Art Director outputs.

The endpoint SHALL process inline: call the LLM with store data and creative metadata, persist the new profile, and mark the previous synced profile as outdated only when the new profile is successfully created with status `synced`.

This endpoint SHALL be called automatically after visual signature approval — it SHALL NOT be triggered by the lojista directly.

#### Scenario: Generate-without-logo creates synced profile

- **WHEN** the generate-without-logo endpoint completes successfully
- **THEN** a new brand profile SHALL be created with `source = 'without_logo'`
- **AND** `status = 'synced'`

#### Scenario: Previous profile marked outdated on success

- **WHEN** a new without-logo profile is created with `status = 'synced'`
- **AND** a previous synced profile exists
- **THEN** the previous profile SHALL be set to `outdated`

#### Scenario: Previous profile preserved on failure

- **WHEN** a new without-logo profile is created with `status = 'failed'`
- **AND** a previous synced profile exists
- **THEN** the previous profile SHALL remain `synced`
- **AND** the store SHALL continue using the previous profile
