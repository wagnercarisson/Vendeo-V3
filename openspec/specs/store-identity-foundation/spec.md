> **Nota de escopo**: Esta spec define apenas a fundação técnica de dados, API e fallbacks para identidade da loja. Não cria página, formulário, step navigation, preview visual, seletor de cor, upload de logo ou fluxo de interface.

## Requirements

### Requirement: Store data schema

The system SHALL have a `stores` table in the public Supabase schema created via a versioned migration file.

The `stores` table SHALL contain the following columns:

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | Yes | `gen_random_uuid()` | Primary key |
| `name` | `text` | Yes | — | Min 2 chars, max 60 chars |
| `segment` | `text` | Yes | — | Must match one of the defined segment values |
| `city` | `text` | No | `null` | Optional, does not block flow |
| `state` | `text` | No | `null` | Optional, does not block flow |
| `brand_color` | `text` | No | `null` | Hex color code (e.g., `#22C55E`) |
| `logo_url` | `text` | No | `null` | URL to store logo (set by future logo-upload spec) |
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

- `moda-vestuario`
- `alimentacao-bebidas`
- `beleza-estetica`
- `saude-farmacia`
- `casa-decoracao`
- `eletronicos-tecnologia`
- `petshop`
- `servicos`
- `variedades`
- `outros`

The segment value SHALL be stored as-is (kebab-case slug). A constraint or enum SHALL prevent invalid values at the database level.

#### Scenario: Valid segment is stored

- **WHEN** a store is created with segment `moda-vestuario`
- **THEN** the value SHALL be stored exactly as `moda-vestuario`

#### Scenario: Invalid segment is rejected

- **WHEN** a store is created with segment `invalid-segment`
- **THEN** the system SHALL return a validation error
- **AND** the store SHALL NOT be created

### Requirement: Fallback for missing logo

When `logo_url` is `null` or empty, the store identity resolver SHALL return the store name as the fallback textual value. This SHALL NOT block store creation, update, or campaign generation.

#### Scenario: No logo URL returns name fallback

- **WHEN** the store identity is resolved for a store with `logo_url = null`
- **THEN** the resolver SHALL return the store `name` as the fallback value
- **AND** no error SHALL be raised

### Requirement: Simple fallback for missing brand color

The system SHALL resolve a simple default hex color based on the store's segment when `brand_color` is `null` or empty. This is a basic temporary fallback, not a brand color system or intelligent palette.

The fallback color map SHALL be:

- `moda-vestuario` → `#F43F5E` (rose)
- `alimentacao-bebidas` → `#DC2626` (red)
- `beleza-estetica` → `#D946EF` (fuchsia)
- `saude-farmacia` → `#10B981` (emerald)
- `casa-decoracao` → `#84CC16` (lime)
- `eletronicos-tecnologia` → `#3B82F6` (blue)
- `petshop` → `#F97316` (orange)
- `servicos` → `#0EA5E9` (sky)
- `variedades` → `#A855F7` (purple)
- `outros` → `#22C55E` (green — default)

The fallback color SHALL NOT block store creation, update, or campaign generation.

#### Scenario: Segment-based color fallback

- **WHEN** the brand color is resolved for a store with `brand_color = null` and `segment = alimentacao-bebidas`
- **THEN** the resolver SHALL return `#DC2626`

#### Scenario: Fallback color for outros segment

- **WHEN** the brand color is resolved for a store with `brand_color = null` and `segment = outros`
- **THEN** the resolver SHALL return `#22C55E`

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

The system SHALL expose a `GET /api/store/[id]` endpoint that returns a single store record by its UUID.

If the store is not found, the endpoint SHALL return HTTP 404.

#### Scenario: Existing store is retrieved

- **WHEN** a GET request is sent to `/api/store/{existing-uuid}`
- **THEN** the response status SHALL be 200
- **AND** the response body SHALL contain the full store record

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
