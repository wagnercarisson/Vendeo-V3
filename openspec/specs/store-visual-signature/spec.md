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

After a store is saved (created or updated), the system SHALL check for active store_brand_assets before offering visual signature creation. If `store_brand_assets` has at least one active record with asset_type `logo`, the system SHALL NOT offer visual signature creation.

If there are no active store_brand_assets and no active visual signature, the system SHALL offer the option to create a visual signature.

This detection SHALL NOT block the save operation. The save completes normally.

#### Scenario: Logo in brand assets skips offer

- **WHEN** a store is saved with active store_brand_assets records
- **THEN** the system SHALL NOT offer visual signature creation
- **AND** no modal SHALL appear

#### Scenario: No brand assets and no signature triggers offer

- **WHEN** a store is saved without active store_brand_assets
- **AND** no active visual signature exists
- **THEN** the system SHALL present an option to create a visual signature

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

### Requirement: Metadata includes input_snapshot and content_used

The `metadata` JSONB column SHALL be expanded to include:

1. `input_snapshot` — a snapshot of the store's 10 visual fields at the time of generation:
   - `name`, `segment`, `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`, `city`, `state`, `brand_color`

2. `artDirectorOutput` — the structured output from the art director prompt:
   - `visual_direction`: string
   - `content_used`: `{ store_name: boolean, city: boolean, state: boolean, slogan: boolean }`
   - `visual_elements`: string[]
   - `intended_palette`: object
   - `color_usage`: object

On first attempt (full art director prompt), the JSON SHALL be extracted from the AI response `response.output.message` and persisted.

On retry (simplified prompt that does not return JSON), `content_used` SHALL be inferred by conservative heuristic: all available input fields marked as `true`.

#### Scenario: input_snapshot captured on first generation

- **WHEN** a visual signature is generated via AI (first attempt)
- **THEN** `metadata.input_snapshot` SHALL contain the 10 store fields at generation time
- **AND** `metadata.artDirectorOutput.content_used` SHALL reflect the AI's composition decisions

#### Scenario: content_used inferred conservatively on retry

- **WHEN** a visual signature is generated via retry (simplified prompt)
- **THEN** `metadata.artDirectorOutput.content_used` SHALL have all fields set to `true`

#### Scenario: pre-feature signatures have null metadata

- **WHEN** inspecting a signature created before this feature
- **THEN** `metadata.input_snapshot` SHALL be absent
- **AND** `metadata.artDirectorOutput.content_used` SHALL be absent

### Requirement: Metadata includes credit_tx_id

Every `store_visual_signatures` record persisted via the `generate-without-logo` flow SHALL include a `credit_tx_id` field inside its `metadata` JSONB column for rastreabilidade da transação de crédito.

The `metadata` object SHALL include the following additional field:

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `credit_tx_id` | `string` | Yes (for credit-charged generations) | UUID returned by `reserveCredit()` |

The `credit_tx_id` SHALL be populated AFTER successful generation and BEFORE returning the response, by updating the persisted signature's metadata:

```typescript
await supabase
  .from("store_visual_signatures")
  .update({
    metadata: {
      ...existingMetadata,
      credit_tx_id: creditTxId,
    },
  })
  .eq("id", signature.id);
```

#### Scenario: credit_tx_id populated on successful generation

- **WHEN** a visual signature is generated via `POST /generate-without-logo`
- **AND** generation succeeds
- **THEN** the `metadata.credit_tx_id` SHALL contain the credit transaction UUID

#### Scenario: credit_tx_id absent on non-credit flow

- **WHEN** a visual signature is generated with `creditsChargingEnabled=false`
- **THEN** `metadata.credit_tx_id` SHALL be absent

### Requirement: GET /api/store/[id]/visual-signature — history response

The GET endpoint SHALL serve as the history/list of visual signatures for the store. The response SHALL be expanded beyond the current simple list.

The response SHALL include for each signature:
- `id`, `status`, `assetUrl`, `type`, `attempt`
- `created_at`, `approved_at` (null if never active, or if archived)
- `art_direction`: object containing `visual_direction`, `content_used`, `intended_palette` (from `metadata.artDirectorOutput`), or `null` if unavailable
- `restore_eligibility`: object computed server-side by comparing `metadata.input_snapshot` against current store data using `content_used` (same drift rules as POST /restore):
  - `can_restore: boolean` — true only if no drift AND metadata exists
  - `drift_fields: string[]` — list of fields with drift (empty if can_restore)
  - `requires_regeneration: boolean` — true if drift detected OR metadata is missing
  - `reason: 'ok' | 'critical_drift' | 'missing_metadata'`
- `critical_drift`: object | null — computed server-side, non-null ONLY when this signature is the active signature:

```
critical_drift: {
  status: 'none' | 'new' | 'dismissed'
  fields: string[]
  reason: 'ok' | 'critical_drift' | 'missing_metadata'
} | null
```

`critical_drift` SHALL be null for non-active signatures.

Calculation of status:
- `reason` = `restore_eligibility.reason`
- If `reason === 'ok'` -> `status = 'none'`
- If `reason === 'critical_drift' | 'missing_metadata'`: compare `visual_signature_drift_dismissed_snapshot` (if exists) with current store values. If match -> `status = 'dismissed'`. If no match or snapshot absent -> `status = 'new'`

The frontend SHALL select the active item as `activeVsSummary` and consume `critical_drift.status`.

`approved_at` SHALL be reliably populated only for the currently active signature (its `updated_at` reflects the approval time). For archived signatures that were previously active, `updated_at` has been overwritten by archival — `approved_at` SHALL be `null`. Signatures that were never active (`draft`) SHALL also have `null`.

The GET endpoint SHALL accept optional `limit` and `offset` query parameters for pagination. The response SHALL respect:
- `limit`: maximum number of signatures to return (default: 12, max: 100)
- `offset`: number of signatures to skip (default: 0)

The response format SHALL remain `{ signatures, total }` where `signatures` respects `limit` and `offset`, and `total` is the total count of signatures for the store.

#### Scenario: GET respects limit parameter

- **WHEN** `GET /api/store/{id}/visual-signature?limit=6` is called
- **THEN** the response SHALL contain at most 6 signatures in `signatures`
- **AND** `total` SHALL reflect the complete count

#### Scenario: GET respects offset parameter

- **WHEN** `GET /api/store/{id}/visual-signature?limit=6&offset=6` is called
- **THEN** the response SHALL return signatures 7-12 (if available)
- **AND** `total` SHALL reflect the complete count

#### Scenario: Default limit is 12

- **WHEN** `GET /api/store/{id}/visual-signature` is called without `limit`
- **THEN** `signatures` SHALL contain up to 12 signatures

#### Scenario: Active signature includes approved_at and critical_drift

- **WHEN** GET /api/store/{store_id}/visual-signature returns the currently active signature
- **THEN** `approved_at` SHALL contain a timestamp
- **AND** `art_direction` SHALL contain the metadata from `artDirectorOutput`
- **AND** `critical_drift` SHALL be non-null

#### Scenario: Archived signature returns null for approved_at and critical_drift

- **WHEN** GET /api/store/{store_id}/visual-signature returns an archived signature
- **THEN** `approved_at` SHALL be `null`
- **AND** `critical_drift` SHALL be `null`

#### Scenario: Pre-feature signature returns null for art_direction

- **WHEN** GET /api/store/{store_id}/visual-signature returns a signature without `artDirectorOutput`
- **THEN** `art_direction` SHALL be `null`
- **AND** `critical_drift` SHALL be `null` (only non-null on active)

#### Scenario: Active VS with no drift returns status none

- **WHEN** a store has an active VS with `restore_eligibility.reason === 'ok'`
- **THEN** `critical_drift.status` SHALL be `'none'`
- **AND** `critical_drift.reason` SHALL be `'ok'`

#### Scenario: Critical drift detected returns status new

- **WHEN** a store has an active VS with `restore_eligibility.reason === 'critical_drift'`
- **AND** no `visual_signature_drift_dismissed_snapshot` exists
- **THEN** `critical_drift.status` SHALL be `'new'`
- **AND** `critical_drift.fields` SHALL contain the drifted fields

#### Scenario: Critical drift dismissed returns status dismissed

- **WHEN** a store has an active VS with `restore_eligibility.reason === 'critical_drift'`
- **AND** `visual_signature_drift_dismissed_snapshot` exists with values matching current store
- **THEN** `critical_drift.status` SHALL be `'dismissed'`

#### Scenario: Missing metadata treated as new (conservative)

- **WHEN** a store has an active VS with `restore_eligibility.reason === 'missing_metadata'`
- **AND** no `visual_signature_drift_dismissed_snapshot` exists
- **THEN** `critical_drift.status` SHALL be `'new'`
- **AND** `critical_drift.reason` SHALL be `'missing_metadata'`

#### Scenario: restore_eligibility indicates ok when no drift

- **WHEN** GET /api/store/{store_id}/visual-signature returns a signature
- **AND** metadata.input_snapshot matches current store data
- **THEN** `restore_eligibility.can_restore` SHALL be `true`
- **AND** `restore_eligibility.drift_fields` SHALL be `[]`
- **AND** `restore_eligibility.requires_regeneration` SHALL be `false`
- **AND** `restore_eligibility.reason` SHALL be `'ok'`

#### Scenario: restore_eligibility blocks restore on drift with reason critical_drift

- **WHEN** GET /api/store/{store_id}/visual-signature returns a signature
- **AND** metadata.input_snapshot differs from current store data
- **THEN** `restore_eligibility.can_restore` SHALL be `false`
- **AND** `restore_eligibility.drift_fields` SHALL list the drifted fields
- **AND** `restore_eligibility.requires_regeneration` SHALL be `true`
- **AND** `restore_eligibility.reason` SHALL be `'critical_drift'`

#### Scenario: restore_eligibility blocks restore on missing metadata with reason missing_metadata

- **WHEN** GET /api/store/{store_id}/visual-signature returns a signature
- **AND** metadata has no `input_snapshot`
- **THEN** `restore_eligibility.can_restore` SHALL be `false`
- **AND** `restore_eligibility.drift_fields` SHALL be `[]`
- **AND** `restore_eligibility.requires_regeneration` SHALL be `true`
- **AND** `restore_eligibility.reason` SHALL be `'missing_metadata'`

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
- Archived signatures are reactivable via `POST /visual-signature/restore` (see visual-signature-restore spec)

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

### Requirement: Resolution priority with store_brand_assets

The visual signature resolution logic SHALL be updated to consider store_brand_assets as the primary source. When a store has active store_brand_assets with variant_type `original`, the system SHALL use that asset and SHALL NOT generate, suggest, or reference visual signature creation in this phase.

This phase does NOT generate visual signatures — it only adjusts the priority chain to recognize logo assets as the highest priority.

#### Scenario: Logo assets suppress visual signature

- **WHEN** a store has active store_brand_assets
- **THEN** the resolution chain SHALL return the logo asset
- **AND** no visual signature operation SHALL be triggered

#### Scenario: No logo assets fall through to existing logic

- **WHEN** a store has no active store_brand_assets
- **THEN** the existing resolution chain (visual signature → name text) SHALL apply unchanged

### Requirement: POST /api/store/[id]/visual-signature/dismiss-critical-drift

The system SHALL expose a POST endpoint that dismisses critical drift for the active visual signature.

Endpoint: POST /api/store/[id]/visual-signature/dismiss-critical-drift
Request body: empty
Response: 204 No Content

The backend SHALL:
1. Verify the store has an active visual signature
2. Read current store values (store.name, store.segment, store.slogan, store.city, store.state)
3. Merge into metadata preserving all existing fields
4. Persist `visual_signature_drift_dismissed_snapshot` with the current store values

Only `visual_signature_drift_dismissed_snapshot` SHALL be persisted. `critical_drift` is a calculated field on GET, never stored.

#### Scenario: Dismiss persists current store snapshot

- **WHEN** POST /dismiss-critical-drift is called
- **AND** the store has an active visual signature
- **THEN** `metadata.visual_signature_drift_dismissed_snapshot` SHALL contain store.name, store.segment, store.slogan, store.city, store.state
- **AND** existing metadata fields SHALL be preserved
- **AND** HTTP 204 SHALL be returned

#### Scenario: Dismiss fails when no active VS

- **WHEN** POST /dismiss-critical-drift is called
- **AND** the store has no active visual signature
- **THEN** HTTP 404 SHALL be returned

### Requirement: Guardas do backend no generate-without-logo (mode: substitution)

Quando generate-without-logo is called with mode:'substitution', the endpoint SHALL validate before generating:

1. Loja exists and is active
2. Generation lock per store (process-local/best effort)
3. identity_state === 'visual_signature' and active VS exists
4. Critical drift confirmed (revalidated via drift-revalidator.ts)
5. Existence of historical drafts does NOT block substitution

Guard failure -> 4xx with specific code and userMessage.

If guard 4 fails (critical drift not confirmed on revalidation), the frontend SHALL reload/recalculate the drift diagnosis from GET /visual-signature. The frontend SHALL NOT automatically assume sensitive drift flow — sensitive drift may not exist.

#### Scenario: Substitution guard blocks when no VS active

- **WHEN** POST /generate-without-logo is called with mode:'substitution'
- **AND** store has identity_state !== 'visual_signature' or no active VS
- **THEN** HTTP 4xx SHALL be returned with error code

#### Scenario: Substitution guard revalidates critical drift

- **WHEN** POST /generate-without-logo is called with mode:'substitution'
- **THEN** drift-revalidator.ts SHALL be called server-side
- **AND** if critical drift is not confirmed, HTTP 4xx SHALL be returned
- **AND** the frontend SHALL NOT automatically fall back to sensitive drift flow
- **AND** the frontend SHALL recalculate drift diagnosis from GET /visual-signature

### Requirement: logo_status on generation failure SHALL respect mode and error type

When `POST /generate-without-logo` fails, `logo_status` behavior SHALL depend on the generation mode and error type:

- **mode: 'standard', non-storage error**: `logo_status` SHALL be set to `'failed'`. A failed attempt in standard mode means the store has no active VS (`identity_state = 'text_only'`), so `'failed'` accurately reflects the attempt outcome.
- **mode: 'standard', storage error**: `logo_status` SHALL NOT be modified. Storage errors are infrastructure failures that do not reflect the viability of VS generation.
- **mode: 'substitution', any error**: `logo_status` SHALL NOT be modified. The store has an active VS (`identity_state = 'visual_signature'`), and the generation failure does not change that the VS remains active.

#### Scenario: Standard mode non-storage error sets logo_status to failed

- **WHEN** POST /generate-without-logo is called with mode:'standard'
- **AND** the generation fails with a non-storage error or timeout
- **THEN** `logo_status` SHALL be set to `'failed'`

#### Scenario: Standard mode storage error preserves logo_status

- **WHEN** POST /generate-without-logo is called with mode:'standard'
- **AND** the generation fails with a storage error
- **THEN** `logo_status` SHALL NOT be modified

#### Scenario: Substitution mode error preserves logo_status

- **WHEN** POST /generate-without-logo is called with mode:'substitution'
- **AND** the generation fails (any error type)
- **THEN** `logo_status` SHALL NOT be modified
- **AND** `identity_state` SHALL remain `'visual_signature'`

### Requirement: Generate-without-logo mode parameter

POST /generate-without-logo SHALL accept an optional mode field in the request body: 'standard' | 'substitution'. Default: 'standard'.

- 'standard' (current): normal VS creation flow for text_only stores
- 'substitution': exceptional flow for visual_signature stores with critical drift. Revalidates drift server-side.

#### Scenario: Standard mode unchanged

- **WHEN** POST /generate-without-logo is called with mode:'standard'
- **THEN** the existing behavior SHALL apply unchanged

#### Scenario: Substitution mode revalidates drift

- **WHEN** POST /generate-without-logo is called with mode:'substitution'
- **THEN** drift-revalidator.ts SHALL be called before generation
- **AND** the response SHALL indicate substitution mode is in progress

### Requirement: HistoryModal — lista curta de VS aplicáveis

The VisualSignatureHistoryModal SHALL display a paginated list of applicable visual signatures for the store.

The component SHALL accept these props:
- `isOpen: boolean` — controls modal visibility
- `onClose: () => void` — called when modal is dismissed
- `storeId: string` — store identifier for API calls
- `identityState: string | null` — current identity state (`'text_only'`, `'visual_signature'`, `'logo'`, or null)
- `onApplied?: () => void` — called after successfully applying a VS

The component SHALL load signatures via `GET /api/store/[id]/visual-signature` with pagination parameters.

#### Scenario: Loading state shows spinner

- **WHEN** the modal opens
- **THEN** the component SHALL display a loading spinner
- **AND** SHALL call GET /visual-signature?limit=6&offset=0

#### Scenario: Error state shows error message

- **WHEN** the API call fails
- **THEN** the component SHALL display an error state with a descriptive message

#### Scenario: Empty state shows "Nenhuma assinatura anterior"

- **WHEN** the API returns zero applicable signatures
- **THEN** the component SHALL display "Nenhuma assinatura anterior"

### Requirement: HistoryModal — filtro client-side de aplicabilidade

The component SHALL filter the API response client-side before rendering. Only signatures where `restore_eligibility.reason === "ok"` SHALL appear in the list.

| `restore_eligibility.reason` | Aparece na lista? |
|---|---|
| `ok` | Sim |
| `critical_drift` | Não — oculto |
| `missing_metadata` | Não — oculto |

The component SHALL display only the count of visible applicable signatures loaded so far. It SHALL NOT claim to know the total applicable signatures across all pages — the raw API total may include ineligible records that the client only discovers when loading each batch.

#### Scenario: Filters out critical_drift signatures

- **WHEN** API returns 8 signatures (6 ok, 2 critical_drift)
- **THEN** the list SHALL display 6 signatures
- **AND** the critical_drift signatures SHALL NOT appear

#### Scenario: All ok signatures displayed

- **WHEN** API returns 8 signatures (all ok)
- **THEN** the list SHALL display all 8 signatures

### Requirement: HistoryModal — grid de 3 colunas com badge de status

The component SHALL display signatures in a 3-column grid layout (same layout as the review phase in ApprovalModal).

Each grid card SHALL show:
- The visual signature preview image
- A status badge: "Ativa" for `active`, "Arquivada" for `archived`, "Rascunho" for `draft`
- An action button or info indicator

#### Scenario: Card shows preview, badge, and action

- **WHEN** a signature is rendered in the grid
- **THEN** the card SHALL display the preview image
- **AND** a status badge SHALL be visible
- **AND** an action button or info indicator SHALL be present

### Requirement: HistoryModal — ações condicionais ao identity_state

The action available for each signature SHALL depend on the store's `identity_state` prop.

If `identityState === "text_only"`:
- `archived` signatures SHALL show an enabled "Aplicar" button
- `draft` signatures SHALL show an enabled "Aplicar" button
- `active` signatures SHALL NOT show an action — only badge "Ativa" (this state should not occur under text_only, but handled for consistency)

If `identityState !== "text_only"` (including `"visual_signature"`, `"logo"`, `null`):
- `archived` and `draft` signatures SHALL show a disabled "Indisponível" button with a tooltip
- The tooltip SHALL be contextual:
  - `"visual_signature"`: "Remova a assinatura ativa antes de aplicar outra versão"
  - `"logo"`: "Remova o logotipo ativo antes de aplicar uma assinatura visual"
  - `null` or other: "Aguarde o carregamento da identidade da loja"
- `active` signatures SHALL NOT show an action — only badge "Ativa"

The action logic SHALL use:
```typescript
function canApply(identityState: string | null): boolean {
  return identityState === "text_only";
}
```

#### Scenario: text_only shows enabled Aplicar for archived

- **WHEN** `identityState` is `'text_only'`
- **AND** the signature status is `'archived'`
- **THEN** an enabled "Aplicar" button SHALL be displayed

#### Scenario: text_only shows enabled Aplicar for draft

- **WHEN** `identityState` is `'text_only'`
- **AND** the signature status is `'draft'`
- **THEN** an enabled "Aplicar" button SHALL be displayed

#### Scenario: visual_signature blocks with tooltip

- **WHEN** `identityState` is `'visual_signature'`
- **THEN** the action button SHALL be disabled
- **AND** the tooltip SHALL read "Remova a assinatura ativa antes de aplicar outra versão"

#### Scenario: active signature shows no action

- **WHEN** the signature status is `'active'`
- **THEN** no action button SHALL be displayed
- **AND** a badge "Ativa" SHALL indicate it is in use

### Requirement: HistoryModal — ação "Aplicar" via POST /approve

When the user clicks "Aplicar" on an archived or draft signature, the component SHALL call `POST /api/store/[id]/visual-signature/approve` with `{ signatureId: "uuid" }`.

This call SHALL NOT reserve or consume credit (`reserveCredit` SHALL NOT be called).

On success (`{ success: true }`), the component SHALL call `onApplied()` (if provided) and may close or show a success state.

On drift error (`{ error, drift: { critical: true } }`), the component SHALL display the drift error message returned by the API.

#### Scenario: Apply archived calls POST /approve

- **WHEN** user clicks "Aplicar" on an archived signature
- **THEN** POST /approve SHALL be called with the signature's ID
- **AND** no credit SHALL be reserved or consumed

#### Scenario: Apply draft calls POST /approve

- **WHEN** user clicks "Aplicar" on a draft signature
- **THEN** POST /approve SHALL be called with the signature's ID
- **AND** no credit SHALL be reserved or consumed

#### Scenario: Apply success calls onApplied

- **WHEN** POST /approve returns success
- **THEN** `onApplied()` SHALL be called

#### Scenario: Apply drift error shows error

- **WHEN** POST /approve returns drift error
- **THEN** the drift error message SHALL be displayed

### Requirement: HistoryModal — paginação simples "Carregar versões anteriores"

The component SHALL paginate with a simple "Carregar versões anteriores" pattern using the raw API total (not the filtered count) as trigger.

Carga inicial: `limit=6`, `offset=0`. The component SHALL load up to 6 raw signatures from the API, then filter client-side to show only applicable ones.

**Auto-load (pre-fetch after filter):** After the initial batch is loaded and filtered, if the number of applicable (visible) signatures is fewer than 6 AND there are more raw records in the API, the component SHALL automatically load the second batch (`limit=6`, `offset=6`). This ensures the grid doesn't appear sparse when many signatures are hidden due to ineligibility.

A single button "Carregar versões anteriores" SHALL appear below the grid when **both** conditions are true:
1. `apiTotal > rawSignaturesLoaded` — there are more records in the API
2. The second batch has not been loaded yet (at most one pagination step)

When clicked (or auto-loaded), the component SHALL load the next batch (`limit=6`, `offset=6`), filter client-side (removing ineligible signatures), and append to the current list. After loading the second batch (total maximum 12 raw signatures loaded), the button SHALL disappear permanently — even if the raw API total exceeds 12.

The component SHALL display the count of visible applicable signatures loaded so far (e.g., "6 de 12" or "4 assinaturas"). It SHALL NOT compute or display a global filtered total.

If the second batch contains no applicable signatures (all filtered out), the button SHALL disappear without adding visible items. No additional feedback is required in this phase.

#### Scenario: apiTotal = 6, first batch loads all — no button

- **WHEN** `apiTotal` is 6
- **AND** the first batch loads 6 raw signatures
- **THEN** no "Carregar versões anteriores" button SHALL appear

#### Scenario: apiTotal = 20, first batch loads 6 raw — button visible

- **WHEN** `apiTotal` is 20
- **AND** 6 raw signatures have been loaded (first batch)
- **THEN** "Carregar versões anteriores" SHALL be visible

#### Scenario: Click loads second batch, button disappears

- **WHEN** user clicks "Carregar versões anteriores"
- **THEN** the second batch SHALL be loaded (6 more raw signatures)
- **AND** after loading, the button SHALL disappear (maximum 12 raw reached)

#### Scenario: apiTotal = 20 — max 12 raw loaded, button gone

- **WHEN** `apiTotal` is 20
- **AND** user clicks "Carregar versões anteriores"
- **THEN** at most 12 raw signatures SHALL be loaded total
- **AND** the button SHALL disappear (no further loading)

#### Scenario: Auto-load when first batch has <6 applicable signatures

- **WHEN** the first batch of 6 raw signatures has fewer than 6 `reason === "ok"` after filtering
- **AND** `raw.length < total` (more records exist in API)
- **AND** `raw.length < 12` (second batch not yet loaded)
- **THEN** the second batch SHALL be automatically loaded (`limit=6`, `offset=6`)
- **AND** the button "Carregar versões anteriores" SHALL be hidden (both batches reached)

#### Scenario: Second batch all filtered out — button disappears

- **WHEN** the second batch is loaded (either by click or auto-load)
- **AND** the second batch's raw signatures are all ineligible (critical_drift or missing_metadata)
- **THEN** no new visible items SHALL be added
- **AND** the button SHALL disappear

### Requirement: HistoryModal — sem consumo de crédito

Viewing or reactivating a previous visual signature SHALL never consume credit. Credit SHALL only be consumed by `POST /generate-without-logo` (new generation). The POST /approve flow for archived or draft signatures SHALL NOT call `reserveCredit`, `refundCredit`, or any credit-related function.

Drift validation SHALL use `validateDrift()` — a local calculation with no AI cost.

#### Scenario: Apply does not consume credit

- **WHEN** a signature is applied via HistoryModal
- **THEN** no credit SHALL be consumed
- **AND** no `reserveCredit` SHALL be called
