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
| → `subsegment` | `text` | No | `null` | Optional, free text for subsegment refinement |
| → `tone_of_voice` | `text` | No | `null` | Optional, tone of voice for marketing direction |
| → `positioning` | `text` | No | `null` | Optional, market positioning description |
| → `short_description` | `text` | No | `null` | Optional, brief store description |
| → `slogan` | `text` | No | `null` | Optional, store slogan |
| `created_at` | `timestamptz` | Yes | `now()` | Auto-set on create |
| `updated_at` | `timestamptz` | Yes | `now()` | Auto-updated on change |

The migration SHALL be a single `.sql` file in `supabase/migrations/` adding the new columns via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

**Reason**: Subsegment, tone_of_voice, positioning, short_description, and slogan are needed to provide richer context to the Store Brand Director for brand identity inference. They are all optional to maintain backward compatibility.

#### Scenario: New columns exist after migration

- **WHEN** the migration is inspected
- **THEN** the `stores` table SHALL have columns `subsegment`, `tone_of_voice`, `positioning`, `short_description`, and `slogan` added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

#### Scenario: Existing data preserved

- **WHEN** the migration runs on a database with existing stores
- **THEN** existing rows SHALL have `null` for all new columns
- **AND** existing functionality SHALL NOT be affected

## ADDED Requirements

### Requirement: Store Brand Assets table

The system SHALL have a `store_brand_assets` table in the public Supabase schema created via a versioned migration file. See `logo-upload` spec for full column details.

The migration SHALL be a single `.sql` file in `supabase/migrations/` with the complete table definition including:
- CHECK constraints for `status` and `variant_type`
- Partial unique index: `(store_id, asset_type, variant_type)` WHERE status = 'active'
- Trigger for auto-updating `updated_at`

#### Scenario: Migration exists with correct schema

- **WHEN** migrations are listed
- **THEN** there SHALL be a file matching `supabase/migrations/*_create_store_brand_assets.sql`
- **AND** the file SHALL contain the complete `CREATE TABLE` for `store_brand_assets`

### Requirement: Store Brand Profiles table

The system SHALL have a `store_brand_profiles` table in the public Supabase schema created via a versioned migration file. See `store-brand-profile` spec for full column details.

The migration SHALL be a single `.sql` file in `supabase/migrations/` with the complete table definition including:
- CHECK constraints for `status`
- Partial unique index: `(store_id)` WHERE status = 'synced'
- Trigger for auto-updating `updated_at`

#### Scenario: Migration exists with correct schema

- **WHEN** migrations are listed
- **THEN** there SHALL be a file matching `supabase/migrations/*_create_store_brand_profiles.sql`
- **AND** the file SHALL contain the complete `CREATE TABLE` for `store_brand_profiles`

### Requirement: Brand assets pre-resolved in StoreIdentitySnapshot

Active store_brand_assets SHALL be pre-resolved at the `StoreIdentitySnapshot`/context level, before calling `resolveStoreIdentity` or the renderer. The snapshot SHALL include `logo_variant_url` when brand assets are available.

`resolveStoreIdentity` SHALL remain synchronous and SHALL NOT perform async database calls. It receives its data from the pre-resolved snapshot.

The resolution order SHALL be:

1. Pre-resolved `logo_variant_url` from store_brand_assets (if exists) — highest priority
2. Active visual signature asset_url (if exists and no logo)
3. Store name as textual fallback

The `logo_url` column in stores table is deprecated in favor of store_brand_assets but maintained for backward compatibility during the migration period.

#### Scenario: Brand assets resolved before renderer

- **WHEN** a campaign is being prepared for a store with active store_brand_assets
- **THEN** the logo_variant_url SHALL be resolved at the StoreIdentitySnapshot level
- **AND** passed to the renderer without async queries during rendering

#### Scenario: No brand assets falls through correctly

- **WHEN** the store identity is resolved for a store without store_brand_assets
- **THEN** the resolver SHALL check for active visual signature from the snapshot
- **AND** fall back to store name text if no signature exists

### Requirement: Update store API extended

The `PATCH /api/store/[id]` endpoint SHALL accept the new fields: `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`. All new fields are optional.

#### Scenario: New fields accepted in PATCH

- **WHEN** a PATCH request is sent to /api/store/{store_id} with `{ "subsegment": "moda feminina", "tone_of_voice": "sofisticado" }`
- **THEN** the store record SHALL be updated with the new values
- **AND** omitted new fields SHALL retain their current values
