> **Nota de escopo**: Esta spec define apenas a fundação técnica de dados, API e fallbacks para identidade da loja. Não cria página, formulário, step navigation, preview visual, seletor de cor, upload de logo ou fluxo de interface.

## Requirements

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
| → `logo_status` | `text` | No | `null` | `uploaded`, `generated`, `explicit_none`, `failed`, `exhausted`, or null |
| → `visual_signature_attempts` | `integer` | Yes | `0` | Counts visual signature versions generated (1-3). Reset to 0 on approval. |
| `created_at` | `timestamptz` | Yes | `now()` | Auto-set on create |
| `updated_at` | `timestamptz` | Yes | `now()` | Auto-updated on change |

The migration SHALL be a single `.sql` file in `supabase/migrations/` named with a timestamp prefix (e.g., `20260524000001_create_stores.sql`).

#### Scenario: Migration file exists with correct schema

- **WHEN** migrations are listed
- **THEN** there SHALL be a file matching `supabase/migrations/*_create_stores.sql`
- **AND** the file SHALL contain a `CREATE TABLE public.stores (...)` statement with all required columns

#### Scenario: Migration is idempotent

- **WHEN** the migration is applied to a fresh database
- **THEN** it SHALL succeed and create the `stores` table
- **WHEN** the migration is applied again to the same database
- **THEN** it SHALL NOT error (use `IF NOT EXISTS` or Supabase migration tracking)

### Requirement: Segment values

The system SHALL accept only the following predefined segment values:

- `moda-calcados-acessorios`
- `bebidas-adegas-conveniencia`
- `padaria-confeitaria-doces`
- `beleza-estetica`
- `petshop`
- `variedades-utilidades`
- `mercados-mercearias`
- `restaurantes-lanchonetes`
- `farmacia-saude`
- `casa-decoracao`
- `eletronicos-tecnologia`
- `servicos-locais`
- `outros`

The segment value SHALL be stored as-is (kebab-case slug). A constraint or enum SHALL prevent invalid values at the database level.

#### Scenario: New valid segment is stored

- **WHEN** a store is created with segment `moda-calcados-acessorios`
- **THEN** the value SHALL be stored exactly as `moda-calcados-acessorios`

#### Scenario: Old segment value is rejected

- **WHEN** a store is created with segment `moda-vestuario` (old value)
- **THEN** the system SHALL return a validation error
- **AND** the store SHALL NOT be created

#### Scenario: Invalid segment is rejected

- **WHEN** a store is created with segment `invalid-segment`
- **THEN** the system SHALL return a validation error
- **AND** the store SHALL NOT be created

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

### Requirement: Simple fallback for missing brand color

The system SHALL resolve a simple default hex color based on the store's segment when `brand_color` is `null` or empty. This is a basic temporary fallback, not a brand color system or intelligent palette.

The fallback color map SHALL be:

- `moda-calcados-acessorios` → `#EC4899` (rosa — moda)
- `bebidas-adegas-conveniencia` → `#DC2626` (vermelho — bebidas)
- `padaria-confeitaria-doces` → `#F59E0B` (âmbar — padaria)
- `beleza-estetica` → `#D946EF` (fúcsia — beleza)
- `petshop` → `#F97316` (laranja — pet)
- `variedades-utilidades` → `#A855F7` (roxo — variedades)
- `mercados-mercearias` → `#22C55E` (verde — mercado)
- `restaurantes-lanchonetes` → `#EF4444` (vermelho — restaurante)
- `farmacia-saude` → `#10B981` (verde — saúde)
- `casa-decoracao` → `#84CC16` (verde lima — lar)
- `eletronicos-tecnologia` → `#3B82F6` (azul — tecnologia)
- `servicos-locais` → `#0EA5E9` (azul claro — serviço)
- `outros` → `#22C55E` (verde — padrão)

The fallback color SHALL NOT block store creation, update, or campaign generation.

#### Scenario: Segment-based color fallback for new segment

- **WHEN** the brand color is resolved for a store with `brand_color = null` and `segment = bebidas-adegas-conveniencia`
- **THEN** the resolver SHALL return `#DC2626`

#### Scenario: Fallback color for outros segment

- **WHEN** the brand color is resolved for a store with `brand_color = null` and `segment = outros`
- **THEN** the resolver SHALL return `#22C55E`

### Requirement: Migration updates CHECK constraint

The system SHALL provide a migration that drops the existing CHECK constraint on `stores.segment` and creates a new one with the 13 updated values.

#### Scenario: Old CHECK constraint is dropped

- **WHEN** the migration is applied
- **THEN** the old `stores_segment_check` constraint SHALL be removed

#### Scenario: New CHECK constraint is created

- **WHEN** the migration is applied
- **THEN** a new CHECK constraint SHALL enforce the 13 updated segment values

### Requirement: City and state are optional

The system SHALL allow `city` and `state` to be `null`. A null value for either field SHALL NOT block store creation, update, or campaign generation.

#### Scenario: Store created without city or state

- **WHEN** a POST request to the store API omits `city` and `state`
- **THEN** the store SHALL be created successfully
- **AND** `city` and `state` SHALL be `null` in the stored record

### Requirement: Create store API

The system SHALL expose a `POST /api/store` endpoint that creates a new store record in the `stores` table.

The endpoint SHALL accept a JSON body with the following optional and required fields:

- `name` (required, text, 2-60 chars)
- `segment` (required, text, must be a valid segment)
- `city` (optional, text)
- `state` (optional, text)
- `brand_color` (optional, text, hex color)
- `logo_url` (optional, text)

On success, the endpoint SHALL return HTTP 201 with the created store record as JSON.

On validation failure, the endpoint SHALL return HTTP 400 with an error object describing the invalid fields.

#### Scenario: Successful store creation

- **WHEN** a POST request is sent to `/api/store` with `{ "name": "Minha Loja", "segment": "moda-vestuario" }`
- **THEN** the response status SHALL be 201
- **AND** the response body SHALL contain the created store with an `id`, `name`, `segment`, and auto-set `created_at`

#### Scenario: Missing required field

- **WHEN** a POST request is sent to `/api/store` with `{ "segment": "moda-vestuario" }`
- **THEN** the response status SHALL be 400
- **AND** the error body SHALL indicate that `name` is required

#### Scenario: Invalid segment value

- **WHEN** a POST request is sent to `/api/store` with `{ "name": "Loja", "segment": "invalid" }`
- **THEN** the response status SHALL be 400
- **AND** the error body SHALL indicate that `segment` is invalid

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

### Requirement: Update store API

The system SHALL expose a `PATCH /api/store/[id]` endpoint that updates one or more fields of an existing store record.

Only the fields provided in the request body SHALL be updated. Omitted fields SHALL retain their current values.

On success, the endpoint SHALL return HTTP 200 with the updated store record.

#### Scenario: Partial update succeeds

- **WHEN** a PATCH request is sent to `/api/store/{existing-uuid}` with `{ "name": "Novo Nome" }`
- **THEN** the response status SHALL be 200
- **AND** only the `name` field SHALL be updated
- **AND** `updated_at` SHALL reflect the current timestamp

#### Scenario: Update non-existing store

- **WHEN** a PATCH request is sent to `/api/store/{non-existing-uuid}`
- **THEN** the response status SHALL be 404

### Requirement: Migration is versioned

The migration file SHALL follow the naming convention `YYYYMMDDHHmmss_description.sql` and SHALL be placed in `supabase/migrations/`. The migration SHALL be self-contained (no external dependencies) and SHALL be reversible (provide a `DROP TABLE IF EXISTS public.stores;` as the rollback statement in comments).

#### Scenario: Migration naming convention

- **WHEN** inspecting `supabase/migrations/`
- **THEN** the store migration file SHALL match the pattern `^[0-9]{14}_create_stores\.sql$`

#### Scenario: Migration is reversible

- **WHEN** reading the migration file
- **THEN** it SHALL contain a commented rollback statement: `-- REVERT: DROP TABLE IF EXISTS public.stores;`

#### Scenario: New columns exist after migration

- **WHEN** the migration is inspected
- **THEN** the `stores` table SHALL have columns `subsegment`, `tone_of_voice`, `positioning`, `short_description`, and `slogan` added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

#### Scenario: Logo status columns exist after migration

- **WHEN** the migration is inspected
- **THEN** the `stores` table SHALL have columns `logo_status` and `visual_signature_attempts`
- **AND** `logo_status` SHALL be nullable TEXT
- **AND** `visual_signature_attempts` SHALL be INTEGER NOT NULL DEFAULT 0

#### Scenario: Existing data preserved

- **WHEN** the migration runs on a database with existing stores
- **THEN** existing rows SHALL have `null` for all new columns
- **AND** existing functionality SHALL NOT be affected

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
- CHECK constraint for `status`
- CHECK constraint for `source IN ('logo_analysis', 'without_logo')`
- Partial unique index: `(store_id)` WHERE status = 'synced'
- Trigger for auto-updating `updated_at`

Additionally, a subsequent migration SHALL alter the CHECK constraint to include `'without_logo'` as a valid source value, and SHALL add the columns `visual_signature_id`, `inferred_primary_color`, `inferred_accent_color`, and `identity_art_director_output`. See `store-brand-profile` spec for full column details.

#### Scenario: Migration exists with correct schema

- **WHEN** migrations are listed
- **THEN** there SHALL be a file matching `supabase/migrations/*_create_store_brand_profiles.sql`
- **AND** the file SHALL contain the complete `CREATE TABLE` for `store_brand_profiles`

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
