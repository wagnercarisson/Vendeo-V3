## ADDED Requirements

### Requirement: Generation events table

The system SHALL have a `generation_events` table in the public Supabase schema created via a versioned migration file. This table SHALL record structured events for all generation types: visual signatures, brand profiles (with and without logo), and any future generation types.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | Yes | Primary key, `gen_random_uuid()` |
| `store_id` | `uuid` | Yes | FK → stores(id) |
| `generation_type` | `text` | Yes | `visual_signature`, `brand_profile_without_logo`, `brand_profile_with_logo` |
| `provider` | `text` | No | Provider name (e.g., `openai`) |
| `model` | `text` | No | Model identifier used for generation |
| `duration_ms` | `integer` | No | Wall-clock time in milliseconds |
| `estimated_cost_usd` | `real` | No | Approximate cost in USD |
| `attempt_number` | `integer` | Yes | `1` | Which attempt this event represents (1-3) |
| `status` | `text` | Yes | `success`, `failed`, `rejected`, `timeout` |
| `error_type` | `text` | No | Sanitized error code on failure |
| `prompt_version` | `text` | No | Hash or version tag of the prompt used |
| `approved` | `boolean` | No | Whether the lojista approved the result |
| `rejected` | `boolean` | No | Whether the lojista rejected the result |
| `asset_generated` | `boolean` | No | Whether an asset was generated |
| `asset_id` | `uuid` | No | ID of the generated asset (store_visual_signatures or similar) |
| `has_logo` | `boolean` | No | Whether the store had a logo at generation time |
| `has_generated_signature` | `boolean` | No | Whether a generated visual signature exists |
| `has_brand_profile` | `boolean` | No | Whether a brand profile exists |
| `input_data_hash` | `text` | No | Hash of the input data for reproducibility |
| `metadata` | `jsonb` | No | Additional structured data |
| `created_at` | `timestamptz` | Yes | `now()`, auto-set on create |

Each record SHALL be best-effort — failure to record SHALL NOT block generation.

#### Scenario: Migration file exists

- **WHEN** migrations are listed
- **THEN** there SHALL be a file matching `supabase/migrations/*_create_generation_events.sql`
- **AND** the file SHALL contain the `CREATE TABLE public.generation_events (...)` statement with all columns

#### Scenario: Record created on visual signature generation

- **WHEN** a visual signature generation completes
- **THEN** a `generation_events` record SHALL be created with `generation_type = 'visual_signature'`
- **AND** `attempt_number` SHALL match the current attempt
- **AND** `has_logo` SHALL be `false`

#### Scenario: Record created on brand profile generation (without logo)

- **WHEN** a brand profile generation completes for source `without_logo`
- **THEN** a `generation_events` record SHALL be created with `generation_type = 'brand_profile_without_logo'`
- **AND** `approved` SHALL be `true` (automatic after signature approval)

#### Scenario: Metrics failure does not block generation

- **WHEN** the generation events insert fails (database error, constraint violation)
- **THEN** the error SHALL be logged
- **AND** the generation pipeline SHALL continue normally
- **AND** no exception SHALL be thrown to the caller

### Requirement: Approval/rejection updates generation event

When the lojista approves or rejects a visual signature, the system SHALL update the corresponding `generation_events` record (matched by `asset_id` and `attempt_number`) rather than creating a new event.

- On approval: set `approved = true`
- On rejection: set `rejected = true`

This update happens after the generation event was already created at generation time, so `approved` and `rejected` start as `null` and are filled in only when the lojista decides.

#### Scenario: Event updated on approval

- **WHEN** the lojista clicks "Aprovar"
- **THEN** the `generation_events` record with matching `asset_id` and `attempt_number` SHALL have `approved = true`

#### Scenario: Event updated on rejection

- **WHEN** the lojista clicks "Não gostei, gerar outra versão"
- **THEN** the `generation_events` record with matching `asset_id` and `attempt_number` SHALL have `rejected = true`

The system SHALL support the following generation types:

| generation_type | When recorded |
|----------------|---------------|
| `visual_signature` | When a visual signature is generated via Store Identity Art Director |
| `brand_profile_without_logo` | When a brand profile is generated from store data + identity art director outputs |
| `brand_profile_with_logo` | When a brand profile is generated from logo analysis (existing, now with metrics) |

#### Scenario: Brand profile with logo also records events

- **WHEN** a logo is uploaded and the Store Brand Director analyzes it
- **THEN** a `generation_events` record SHALL be created with `generation_type = 'brand_profile_with_logo'`
- **AND** `has_logo` SHALL be `true`
