## ADDED Requirements

### Requirement: Store visual signatures table

The system SHALL have a `store_visual_signatures` table in the public Supabase schema created via a versioned migration file.

The `store_visual_signatures` table SHALL contain the following columns:

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | Yes | Primary key, `gen_random_uuid()` |
| `store_id` | `uuid` | Yes | Foreign key to `stores(id)` |
| `storage_path` | `text` | Yes | Stable path within bucket (e.g., `{store_id}/{uuid}.png`). Bucket name is `visual-signatures`, so the full Storage reference is `visual-signatures/{store_id}/{uuid}.png`. |
| `asset_url` | `text` | Yes | Resolved public URL at time of upload |
| `type` | `text` | Yes | `ai_generated`, `automatic_generated`, `fallback_typographic` |
| `status` | `text` | Yes | `draft`, `active`, `archived` |
| `generation_mode` | `text` | No | `user_choice`, `automatic`, `fallback` |
| `prompt` | `text` | No | Prompt used for AI generation, if applicable |
| `metadata` | `jsonb` | No | Additional metadata (e.g., generation params, model used) |
| `created_at` | `timestamptz` | Yes | `now()`, auto-set on create |
| `updated_at` | `timestamptz` | Yes | `now()`, auto-updated on change |

The migration SHALL include CHECK constraints for controlled enum-like columns:
```sql
CHECK (type IN ('ai_generated', 'automatic_generated', 'fallback_typographic')),
CHECK (status IN ('draft', 'active', 'archived')),
CHECK (generation_mode IS NULL OR generation_mode IN ('user_choice', 'automatic', 'fallback'))
```

The migration SHALL include a function and trigger to auto-update `updated_at`:
```sql
CREATE OR REPLACE FUNCTION update_store_visual_signatures_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_store_visual_signatures_updated_at BEFORE UPDATE ON store_visual_signatures
FOR EACH ROW EXECUTE FUNCTION update_store_visual_signatures_updated_at();
```

The migration SHALL include a partial unique index to guarantee at most one active signature per store:
```sql
CREATE UNIQUE INDEX ON store_visual_signatures (store_id) WHERE status = 'active';
```

#### Scenario: Migration exists with correct schema

- **WHEN** migrations are listed
- **THEN** there SHALL be a file matching `supabase/migrations/*_create_store_visual_signatures.sql`
- **AND** the file SHALL contain the `CREATE TABLE public.store_visual_signatures (...)` statement with all columns
- **AND** the file SHALL include the partial unique index for `status = 'active'`

#### Scenario: Partial unique index enforces one active per store

- **WHEN** a store already has an `active` signature
- **AND** a second signature is inserted with `status = 'active'` for the same store
- **THEN** the insert SHALL fail with a unique constraint violation

#### Scenario: Migration includes CHECK constraints

- **WHEN** inspecting the migration file
- **THEN** it SHALL contain CHECK constraints for `type`, `status`, and `generation_mode`

#### Scenario: updated_at auto-updates on change

- **WHEN** a row in `store_visual_signatures` is updated
- **THEN** the `updated_at` column SHALL be set to the current timestamp automatically

### Requirement: Detect absence of logo on store save

After a store is saved (created or updated), if the system detects `logo_url IS NULL` and there is no active visual signature for that store, the system SHALL offer the lojista the option to create a visual signature.

This detection SHALL NOT block the save operation. The save completes normally.

#### Scenario: Logo absent triggers offer

- **WHEN** a store is saved with `logo_url = NULL`
- **AND** no active visual signature exists for that store
- **THEN** the system SHALL present an option to create a visual signature (e.g., modal)

#### Scenario: Logo present skips offer

- **WHEN** a store is saved with a non-null `logo_url`
- **THEN** the system SHALL NOT offer visual signature creation

### Requirement: Generate visual signature variations via AI

The system SHALL generate visual signature variations using Abordagem A (IA describes, renderer builds):
1. A prompt sends store data (name, segment, brand_color, tone of voice) requesting a JSON description of a simple visual signature.
2. The AI returns structured JSON with renderable parameters (symbol, typography, layout, colors).
3. A programmatic renderer (SVG) executes the design and outputs a PNG.

The generated visual signature SHALL: be simple, lightweight, transparent or simple background, include store name, and optionally include a symbol/initial/simple seal.

#### Scenario: Generate 3 variations for user choice

- **WHEN** the lojista clicks "Criar Agora" in the modal
- **THEN** the system SHALL generate 3 distinct visual signature variations
- **AND** display them for the lojista to choose from

#### Scenario: Generate 1 variation for automatic mode

- **WHEN** the lojista selects "Deixar o Vendeo Criar"
- **THEN** the system SHALL generate 1 visual signature with best-effort and short timeout
- **AND** if generation succeeds, persist it as `active`
- **AND** if generation fails or times out, generate and persist typographic fallback as `active`

#### Scenario: Fallback typographic generation

- **WHEN** AI generation fails or exceeds timeout
- **THEN** the system SHALL generate a typographic signature locally (initials circle + store name)
- **AND** persist it to Storage as `fallback_typographic`
- **AND** set status to `active`

### Requirement: Visual signature quality criteria

The visual signature generated by Abordagem A SHALL look like a simple, publishable brand mark — not merely decorative initials. If the result is visually generic ("looks like it was made by a system"), the implementation SHALL stop and reassess before integrating into the campaign pipeline.

The VisualSignatureGenerator service SHALL abstract the generation approach behind an interface to allow future replacement (e.g., Abordagem B - direct image generation).

#### Scenario: Quality assessment before integration

- **WHEN** the first visual signature is generated
- **THEN** the team SHALL evaluate whether it meets the "simple publishable brand mark" standard
- **AND** if it does not, the integration with the campaign pipeline SHALL be postponed

### Requirement: Persist signature to Storage

Each generated visual signature SHALL be uploaded to Supabase Storage in bucket `visual-signatures`, folder `{store_id}/`.

The asset SHALL be stored as PNG with transparent or simple background, maximum dimensions ~400×200px.

#### Scenario: Asset uploaded to correct path

- **WHEN** a visual signature is generated
- **THEN** the asset SHALL be uploaded to bucket `visual-signatures` with path `{store_id}/{uuid}.png`
- **AND** `storage_path` SHALL be `{store_id}/{uuid}.png`
- **AND** `asset_url` SHALL be the resolved public URL
- **AND** both SHALL be saved in the database record

### Requirement: Active signature lifecycle

Status transitions SHALL follow these rules:
- Generated variations start as `draft`
- The chosen variation becomes `active`
- Previous active signature becomes `archived`
- Automatic/fallback generation without user choice starts as `active`
- Archived signatures are never reactivated (future feature)

#### Scenario: User choice promotes draft to active

- **WHEN** the lojista selects one of 3 draft variations
- **THEN** the chosen one SHALL be set to `active`
- **AND** the other 2 SHALL remain `draft`
- **AND** if there was a previous active signature, it SHALL be set to `archived`

#### Scenario: Automatic generation creates active directly

- **WHEN** the system generates a signature without user choice ("Deixar o Vendeo Criar")
- **THEN** the signature SHALL be created with status `active` directly
- **AND** it SHALL NOT pass through `draft`

### Requirement: Visual signature injection into campaign pipeline

The `CampaignRenderParams` SHALL include a `visualSignatureUrl` field and a `visualSignatureType` field.

The renderer SHALL use this priority for the store identity zone:
1. `storeLogoUrl` (if provided) — highest priority
2. `visualSignatureUrl` (if no logo and visual signature exists)
3. Typographic fallback (initials + store name) — lowest priority

The visual signature SHALL be passed as a fixed asset — it SHALL NOT be regenerated per campaign.

#### Scenario: Campaign uses visual signature when no logo

- **WHEN** a campaign is generated for a store with no logo but with an active visual signature
- **THEN** the `CampaignRenderParams` SHALL include `visualSignatureUrl`
- **AND** the visual signature SHALL appear in the store identity zone
- **AND** the visual signature SHALL be the same across all campaigns of that store

#### Scenario: Logo takes priority over visual signature

- **WHEN** a store has both `logo_url` and an active visual signature
- **THEN** the renderer SHALL use `logo_url` for the store identity zone
- **AND** the visual signature SHALL be ignored
