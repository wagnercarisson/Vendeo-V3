# Store Visual Signature

## Purpose

Defines the visual signature generation system: a brand mark / logo-like asset created when the lojista has no logo, used as a render-time asset in the campaign store identity zone.

## Requirements

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
| `metadata` | `jsonb` | No | Additional metadata — SHALL include `generation_tier: "image_direct" \| "image_retry" \| "typographic"` to record the actual method used. Also includes model, provider, generation params, elapsedMs, fallbackReason. |
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

### Requirement: Generate visual signature via AI image generation (Abordagem B — main approach)

The system SHALL generate visual signature images using Abordagem B (AI generates image directly):
1. A prompt sends store data (name, segment, brand_color, tone of voice) requesting a simple brand mark image.
2. The AI image model (Responses API `image_generation` tool) generates a PNG image directly.
3. The resulting image SHALL be validated before persisting.

The generated visual signature image SHALL:
- Look like a real brand mark (professional, publishable)
- Contain the store name as the main element
- Use the brand color as an accent
- Have a transparent or simple/solid background
- Optionally include a symbol, icon, or monogram
- NOT contain pricing, products, offers, CTAs, or promotional copy
- NOT be generic "initials in circle" (that is fallback behavior)
- NOT be campaign art (no scene, no product images)

#### Scenario: Generate 3 variations for user choice (Criar Agora) — MUST produce 3 cards

- **WHEN** the lojista clicks "Gerar 3 opções para eu escolher" in the modal
- **THEN** the system SHALL attempt to produce exactly 3 visual signature variations
- **AND** the system SHALL attempt AI image generation for all 3, trying different tonalities (profissional, moderno, elegante)
- **AND** for each position that fails on first attempt (non-timeout), the system SHALL retry with a simplified prompt
- **AND** if a position times out, the system SHALL NOT retry that position
- **AND** if fewer than 3 variations succeed after AI image + retry, the system SHALL return an error: "Não foi possível gerar 3 opções. Tente novamente."
- **AND** typographic fallback SHALL NOT be used to fill gaps in the 3-card result — it is technical contingency only
- **AND** the picker SHALL allow selecting and activating any variation

#### Scenario: Generate 1 variation for automatic mode (Deixar o Vendeo Criar)

- **WHEN** the lojista selects "Deixar o Vendeo Escolher"
- **THEN** the system SHALL attempt to generate 1 visual signature via AI image with 120s timeout
- **AND** if that succeeds, persist it as `active` with type `automatic_generated`
- **AND** if it fails with validation error (image generated but failed visual check), SHALL retry once with simplified prompt
- **AND** if it fails with timeout, SHALL NOT retry — return controlled error
- **AND** if retry also fails, SHALL return controlled error instead of typographic fallback
- **AND** the error message SHALL be: "Não conseguimos criar sua assinatura visual agora. Tente novamente ou envie seu logotipo."
- **AND** full attempt metadata SHALL be logged (tier, provider, model, elapsedMs, error details)

#### Scenario: Generation cascade (2-tier fallback)

- **WHEN** AI image generation fails or exceeds timeout
- **THEN** the system SHALL log the failure with error details
- **AND** if timeout, SHALL return controlled error immediately (no retry, no fallback)
- **AND** if validation failure, SHALL retry once with a simplified prompt
- **AND** if retry also fails, SHALL return controlled error
- **AND** typographic fallback SHALL exist only as technical contingency (not surfaced as final product delivery)

### Requirement: Visual signature quality criteria

The visual signature generated by AI image SHALL look like a simple, publishable brand mark — not merely decorative initials and not campaign art. If the result fails visual validation, the system SHALL NOT persist it and SHALL try retry or typographic fallback.

The system SHALL include a visual validation step before persisting any generated signature:
- Verify the image is a valid PNG with content
- Verify the store name appears in the image (basic heuristic — exact matching not required in V1)
- Reject images that appear to be generic circle+initials (fallback-like)

If validation fails, the system SHALL log the rejection and proceed to the next fallback level.

### Requirement: Metadata includes generation_tier

Every persisted `store_visual_signatures` record SHALL include a `generation_tier` field inside its `metadata` JSONB column to track which method actually produced the asset.

The `metadata` object SHALL include:

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `generation_tier` | `string` | Yes | `"image_direct"` (AI image), `"image_retry"` (AI retry with simplified prompt), `"typographic"` (zero-AI) |
| `provider` | `string` | Yes | e.g., `"openai"` |
| `model` | `string` | No | e.g., `"gpt-4o-mini"`, `"gpt-5.5"` |
| `elapsedMs` | `number` | No | Generation time in milliseconds |
| `fallbackReason` | `string` | No | If this record was produced by a fallback tier, the reason (e.g., `"image_generation_failed"`, `"timeout"`, `"retry_failed"`) |
| `generationParams` | `object` | No | AI-generated or default design parameters |

The `type` column continues to represent the general context:
- `ai_generated` — any AI-assisted generation (image_direct or image_retry)
- `automatic_generated` — generated without user choice
- `fallback_typographic` — typographic only

The `generation_tier` inside metadata disambiguates which specific method was used.

#### Scenario: Quality assessment before integration

- **WHEN** the first visual signature is generated
- **THEN** the team SHALL evaluate whether it meets the "simple publishable brand mark" standard
- **AND** if it does not, the integration with the campaign pipeline SHALL be postponed

### Requirement: Persist signature to Storage

Each generated visual signature SHALL be uploaded to Supabase Storage in bucket `visual-signatures`, folder `{store_id}/`.

The asset format SHALL follow:
- AI-generated signatures (`image_direct`, `image_retry`): PNG
- Typographic fallback (`typographic`): SVG (no conversion required)

#### Scenario: AI-generated asset uploaded as PNG

- **WHEN** a visual signature is generated by AI (image_direct or image_retry)
- **THEN** the asset SHALL be uploaded to bucket `visual-signatures` with path `{store_id}/{uuid}.png`
- **AND** `storage_path` SHALL be `{store_id}/{uuid}.png`
- **AND** `asset_url` SHALL be the resolved public URL
- **AND** both SHALL be saved in the database record

#### Scenario: Typographic fallback uploaded as SVG

- **WHEN** a typographic fallback is generated (zero-AI)
- **THEN** the asset SHALL be uploaded to bucket `visual-signatures` with path `{store_id}/{uuid}.svg`
- **AND** `storage_path` SHALL be `{store_id}/{uuid}.svg`
- **AND** `asset_url` SHALL be the resolved public URL
- **AND** the MIME type SHALL be `image/svg+xml`

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
