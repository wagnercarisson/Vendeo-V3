## MODIFIED Requirements

### Requirement: Store data schema

The system SHALL have a `stores` table in the public Supabase schema created via a versioned migration file.

The `stores` table SHALL contain the following columns (new columns marked with →):

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | Yes | `gen_random_uuid()` | Primary key |
| `name` | `text` | Yes | — | Min 2 chars, max 60 chars |
| `segment` | `text` | Yes | — | Must match one of the defined segment values |
| `city` | `text` | No | `null` | Optional, does not block flow |
| `state` | `text` | No | `null` | Optional, does not block flow |
| `brand_color` | `text` | No | `null` | Hex color code (e.g., `#22C55E`) |
| `logo_url` | `text` | No | `null` | **Deprecated** — use store_brand_assets instead. Maintained for backward compatibility during migration. |
| `subsegment` | `text` | No | `null` | Optional, free text for subsegment refinement |
| `tone_of_voice` | `text` | No | `null` | Optional, tone of voice for marketing direction |
| `positioning` | `text` | No | `null` | Optional, market positioning description |
| `short_description` | `text` | No | `null` | Optional, brief store description |
| `slogan` | `text` | No | `null` | Optional, store slogan |
| → `logo_status` | `text` | No | `null` | `uploaded`, `generated`, `explicit_none`, `failed`, `exhausted`, or null |
| → `visual_signature_attempts` | `integer` | Yes | `0` | Counts visual signature versions generated (1-3). Reset to 0 on approval. |
| `created_at` | `timestamptz` | Yes | `now()` | Auto-set on create |
| `updated_at` | `timestamptz` | Yes | `now()` | Auto-updated on change |

#### Scenario: New columns exist after migration

- **WHEN** the migration is inspected
- **THEN** the `stores` table SHALL have columns `logo_status` and `visual_signature_attempts`
- **AND** `logo_status` SHALL be nullable TEXT
- **AND** `visual_signature_attempts` SHALL be INTEGER NOT NULL DEFAULT 0

#### Scenario: Existing data preserved

- **WHEN** the migration runs on a database with existing stores
- **THEN** existing rows SHALL have `null` for `logo_status`
- **AND** `0` for `visual_signature_attempts`
- **AND** existing functionality SHALL NOT be affected

### Requirement: Fallback for missing logo

When `logo_url` is `null` or empty, the store identity resolver SHALL check for store_brand_assets first, then active visual signature, then fall back to the store name text. The `logo_status` field SHALL inform UI behavior but SHALL NOT block the resolution chain.

The resolution order SHALL be:

1. `store_brand_assets` active (logo) → logoUrl, brandProfile (source=logo_analysis)
2. Active visual signature `asset_url` + brandProfile (source=without_logo) → visualSignatureUrl, brandProfile
3. `store_brand_profiles` active (source=without_logo) without active signature → store name text, brandProfile
4. Store `name` as textual fallback

#### Scenario: No logo with without-logo profile returns name

- **WHEN** the store identity is resolved for a store with `logo_url = null`
- **AND** no active store_brand_assets
- **AND** no active visual signature
- **AND** a brand profile exists with `source = 'without_logo'`
- **THEN** the resolver SHALL return the store `name` as the fallback value
- **AND** the brand profile SHALL still be included in the result

### Requirement: Update store API extended

The `PATCH /api/store/[id]` endpoint SHALL accept the new fields: `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`. All new fields are optional.

The endpoint SHALL also accept `logo_status` and `visual_signature_attempts` for internal updates (typically set by the visual signature approval flow, not by the lojista directly).

#### Scenario: New fields accepted in PATCH

- **WHEN** a PATCH request is sent to /api/store/{store_id} with `{ "subsegment": "moda feminina", "tone_of_voice": "sofisticado" }`
- **THEN** the store record SHALL be updated with the new values
- **AND** omitted new fields SHALL retain their current values

#### Scenario: Logo status accepted in PATCH

- **WHEN** a PATCH request is sent to /api/store/{store_id} with `{ "logo_status": "generated", "visual_signature_attempts": 0 }`
- **THEN** the store record SHALL be updated with the new logo status and attempts
