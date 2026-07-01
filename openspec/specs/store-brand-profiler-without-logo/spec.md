> **Purpose**: Defines the Store Brand Profiler for stores without a logo — an AI service that infers a complete brand profile from store cadastral data and approved outputs from the Store Identity Art Director. Executed after visual signature approval.

## Requirements

### Requirement: Store Brand Profiler (without logo) prompt

The system SHALL have a dedicated prompt file at `prompts/store-brand-profiler.md` for inferring a complete brand profile for stores without a logo.

The prompt SHALL be separate from:
- The Store Identity Art Director (creates visual signatures)
- The Campaign Image Director (creates campaign images)
- The Store Brand Director with Logo (analyzes real logos)

The prompt SHALL be executed AFTER the lojista approves a visual signature.

#### Scenario: Prompt file exists

- **WHEN** inspecting `prompts/`
- **THEN** a file `store-brand-profiler.md` SHALL exist
- **AND** the file SHALL contain instructions for brand profile inference without logo analysis

#### Scenario: Prompt is separate from other roles

- **WHEN** the prompt is inspected
- **THEN** it SHALL NOT contain instructions for visual signature creation
- **AND** it SHALL NOT contain instructions for campaign generation

### Requirement: Brand profiler inputs

The Store Brand Profiler SHALL consume the following inputs:
1. Store cadastral data: name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state
2. Approved outputs from the Store Identity Art Director:
   - `creative_description` (textual direction adopted)
   - `suggested_colors` (array of hex values)
   - `visual_direction` (e.g., "Moderna e minimalista")
   - `elements_used` (array of design elements)
   - `asset_url` (approved visual signature URL)
   - `reference_card_url` (if generated)
3. **`intendedPalette: IntendedPalette | null`** — the declared color palette from `signature.metadata.artDirectorOutput.intended_palette`. Null for retry or pre-fase-4.6.5 signatures.
4. **`previousBrandColors: string[]`** — `brand_colors_chosen` from the previous synced profile, only when `brand_colors_chosen` has at least one valid HEX. Empty array otherwise.
5. **`mode: 'reuse' | 'regenerate'`** — controls profile cache behavior

The profiler SHALL use creative metadata as the primary source for brand inference.

#### Scenario: All inputs are consumed

- **WHEN** the brand profiler is invoked
- **THEN** it SHALL receive store cadastral data AND the Store Identity Art Director's approved outputs
- **AND** SHALL receive `intendedPalette`, `previousBrandColors`, and `mode` when available
- **AND** SHALL use creative metadata as primary input

#### Scenario: Without reference card

- **WHEN** no reference card was generated
- **THEN** the profiler SHALL proceed with the remaining inputs
- **AND** the missing reference card SHALL NOT block profile generation

#### Scenario: intendedPalette null for retry or legacy

- **WHEN** the brand profiler is invoked for a retry (prompt simplificado) or pre-fase-4.6.5 signature
- **THEN** `intendedPalette` SHALL be `null`
- **AND** the profiler SHALL fall back to heuristic classification — vision called for semantic analysis only (no color arbitration)

#### Scenario: Mode defaults to reuse

- **WHEN** the brand profiler is invoked without explicit mode
- **THEN** mode SHALL default to 'reuse'

### Requirement: Brand profiler output

The AI model SHALL return **only semantic analysis** — the service composes the palette programmatically.

**Model output (happy path or fallback):**
```json
{
  "visual_style": "descrição",
  "visual_tone": "descrição",
  "typography_direction": "descrição",
  "brand_personality": "descrição",
  "campaign_guidelines": "diretrizes criativas para campanhas",
  "campaign_brief": "brief conciso para o diretor de campanha",
  "confidence_score": 0.85
}
```

**Model output (divergência — visão arbitra):**
```json
{
  "visual_style": "...",
  "visual_tone": "...",
  "typography_direction": "...",
  "brand_personality": "...",
  "campaign_guidelines": "...",
  "campaign_brief": "...",
  "confidence_score": 0.85,
  "corrections": {
    "primary": "#B96F63",
    "accent": null,
    "background": null,
    "support": [{ "index": 0, "color": "#2E6B9E" }]
  },
  "reason": "primary not found, using closest observed color"
}
```

The **service** SHALL compose programmatically:
- `safe_color_tokens` as `ResolvedPalette` from `intendedToResolved()` or heuristic fallback
- `color_validation` as `ColorValidation` discriminated union tracking every role's provenance
- `inferred_primary_color` ← `safe_color_tokens.primary`
- `inferred_accent_color` ← `safe_color_tokens.accent`
- `logo_colors_detected` ← composed by existing service logic (not part of this phase scope — preserves current behavior derived from ColorProbe non-artifact clusters and/or suggested_colors)

The service SHALL NOT expect the model to return `safe_color_tokens`, `inferred_primary_color`, `inferred_accent_color`, or `color_validation`.

#### Scenario: Output matches expected format

- **WHEN** the brand profiler completes successfully
- **THEN** a brand profile SHALL be created with all required profile fields populated
- **AND** `safe_color_tokens` SHALL contain `primary`, `secondary`, `accent`, `background`
- **AND** `color_validation` SHALL contain the provenance for each role

#### Scenario: Inferred colors populated

- **WHEN** the brand profiler completes
- **THEN** `inferred_primary_color` SHALL equal `safe_color_tokens.primary`
- **AND** `inferred_accent_color` SHALL equal `safe_color_tokens.accent`

#### Scenario: AI returns semantic analysis only on happy path

- **WHEN** all colors are confirmed (happy path)
- **THEN** the model output SHALL contain only semantic fields (style, tone, typography, personality, guidelines, brief, confidence)
- **AND** the service SHALL compose `safe_color_tokens`, `color_validation`, `inferred_*`, and `logo_colors_detected` programmatically

#### Scenario: AI returns corrections on divergence

- **WHEN** the profiler detects divergence (one or more contested roles)
- **THEN** the model output SHALL contain semantic analysis PLUS `corrections` and `reason`
- **AND** the service SHALL apply corrections over intended palette via `normalizeAdjudication`

### Requirement: Brand profiler execution

The brand profiler SHALL execute inline after the lojista approves the visual signature. The flow is:

1. Lojista approves visual signature
2. `store_visual_signatures` updated to `active`
3. `stores.logo_status` set to `generated`
4. Store Brand Profiler invoked with store data + identity art director outputs
5. Brand profile persisted with source `without_logo`, status `synced` (or `failed` on error)
6. Previous brand profile, if any, SHALL be marked as `outdated` only when the new profile is successfully created with status = `synced`. If the new profile fails, the previous `synced` profile SHALL remain unchanged.

The profiler SHALL accept a mode parameter: `'reuse' | 'regenerate'`.

- `reuse` (current, default): searches existing profile by `visual_signature_id` and returns if found. Current behavior unchanged.
- `regenerate`: ignores existing profile cache, re-infers all brand fields. Persistence follows 3 branches based on BP state:
  - **Branch A (BP synced)**: UPDATE existing BP — no INSERT, no duplicate
  - **Branch B (BP failed/outdated + fallback synced)**: mark fallback outdated → UPDATE target to synced → restore fallback if fail
  - **Branch C (BP does not exist / Tier 2 never generated)**: mark fallback outdated (if exists) → INSERT new BP → restore fallback if fail
  Preserves `content_used`, `visual_signature_id`, and existing VS metadata in the BP.

The `'regenerate'` mode SHALL be used exclusively by VS-sensitive realinhamento (`POST /realign` when `identity_state === 'visual_signature'`).

NOTE: The unique index `(store_id, visual_signature_id, source)` for `without_logo` prevents INSERT duplicates when a BP already exists for the same VS. Branch A and B use UPDATE for this reason; only Branch C (no existing BP) performs INSERT.

Processing SHALL be inline (same request) — no queue, no polling. Status `processing` is reserved for future queue-based processing.

#### Scenario: Reuse mode returns existing profile (unchanged)

- **WHEN** the profiler is invoked with mode:'reuse'
- **AND** an existing profile exists for the visual_signature_id
- **THEN** the existing profile SHALL be returned
- **AND** no new inference SHALL be made

#### Scenario: Regenerate mode re-infers without cache, updates existing

- **WHEN** the profiler is invoked with mode:'regenerate'
- **AND** an existing profile exists for the visual_signature_id
- **THEN** a new inference SHALL be made
- **AND** the existing profile SHALL be updated (UPDATE) — no second record created

#### Scenario: Regenerate mode preserves VS metadata

- **WHEN** the profiler is invoked with mode:'regenerate'
- **THEN** `content_used` from the existing VS metadata SHALL be preserved
- **AND** `visual_signature_id` SHALL be preserved in the new profile

#### Scenario: Profile created as synced on success

- **WHEN** the brand profiler completes successfully
- **THEN** a brand profile SHALL be created with `source = 'without_logo'`
- **AND** `status = 'synced'`
- **AND** `active_logo_asset_id = null`

#### Scenario: Profile created as failed on error

- **WHEN** the brand profiler call fails
- **THEN** a brand profile SHALL be created with `status = 'failed'`
- **AND** error details SHALL be recorded in metadata
- **AND** the approved visual signature SHALL still be persisted (brand profile failure does not roll back the signature)

#### Scenario: Previous profile marked outdated only on success

- **WHEN** a new brand profile is created with source `without_logo`
- **AND** the new brand profile has `status = 'synced'`
- **AND** a previous `synced` profile exists
- **THEN** the previous profile SHALL have its status changed to `outdated`

#### Scenario: Previous profile preserved on failure

- **WHEN** a new brand profile is created with source `without_logo`
- **AND** the new brand profile has `status = 'failed'`
- **AND** a previous `synced` profile exists
- **THEN** the previous profile SHALL remain `synced`

### Requirement: Presence validation flow

When `intendedPalette` is non-null, the profiler SHALL:

1. Run `ColorProbe.probeColors()` on the approved visual signature image
2. For each role in the intended palette (primary, accent, each support[index], background):
   - Call `findClosestProbeCluster(intendedRoleHex, ALL_NON_ARTIFACT_CLUSTERS)`
   - `ALL_NON_ARTIFACT_CLUSTERS` SHALL exclude `suspected_transitions` and clusters with `frequency < 0.005`
   - Classify presence:
     - ∆E ≤ 18 → `confirmed` — accept intended color
     - 18 < ∆E ≤ 25 → `ambiguous` — mark role as contested
     - ∆E > 25 → `not_confirmed` — mark role as contested
3. If no role contested → happy path: `global_status = 'all_confirmed'`, vision called for semantic analysis only (prompt_suffix = 'analyze_only')
4. If any role contested → divergence: build `observed_colors`, invoke vision with conditional prompt

#### Scenario: All colors confirmed — semantic analysis only

- **WHEN** every intended color has ∆E ≤ 18 against a non-artifact probe cluster
- **THEN** `global_status` SHALL be `'all_confirmed'`
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)
- **AND** `safe_color_tokens` SHALL equal `intendedToResolved(intendedPalette, intendedPalette.support)`

#### Scenario: Contested color triggers divergence

- **WHEN** `intendedPalette.accent` has ∆E = 32 against the closest probe cluster
- **THEN** the accent role SHALL be marked contested
- **AND** `observed_colors` SHALL be built with selection rules
- **AND** the vision SHALL be invoked with conditional divergence prompt

#### Scenario: Probe vazio + intenção válida → probe_unavailable

- **WHEN** `intendedPalette` is valid
- **AND** `probeColors()` returns all empty arrays (exception or image with no extractable pixels)
- **THEN** `global_status` SHALL be `'probe_unavailable'`
- **AND** `safe_color_tokens` SHALL equal `intendedToResolved(intendedPalette, intendedPalette.support)`
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)

#### Scenario: Probe vazio + intenção nula → brandColor/SEGMENT_FALLBACK

- **WHEN** `intendedPalette` is null
- **AND** `probeColors()` returns all empty arrays
- **THEN** `global_status` SHALL be `'fallback_heuristic'`
- **AND** `safe_color_tokens.primary` SHALL equal `store.brandColor` if set, else `SEGMENT_FALLBACK`
- **AND** `safe_color_tokens.secondary` SHALL equal `safe_color_tokens.primary`
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)

#### Scenario: Somente support[1] contestado — support[0] preservado

- **WHEN** `intendedPalette.support = ["#B96F63", "#2E6B9E"]`
- **AND** `support[0]` has ∆E ≤ 18 (confirmed)
- **AND** `support[1]` has ∆E 22 (ambiguous, contested)
- **AND** the vision returns `corrections.support = [{ "index": 1, "color": "#F5A623" }]`
- **THEN** `global_status` SHALL be `'vision_adjudicated'`
- **AND** `safe_color_tokens.secondary` SHALL equal `"#B96F63"` (support[0] preserved)
- **AND** `metadata.color_validation.support_colors[1]` SHALL equal `"#F5A623"` (corrected)

### Requirement: observed_colors selection

When divergence is detected, the system SHALL build `observed_colors` from non-artifact probe clusters with these rules:
1. Include the cluster closest to each contested color (by ∆E) — guarantees representation even for clusters with low frequency
2. Include the best cluster of each relevant classification (dominant, dark_ink, neutral, background, structural)
3. Fill remaining slots by frequency descending, up to **maximum 12 clusters**
4. Deduplicate clusters where ∆E ≤ 6 between them, without removing mandatory candidates from rules 1 or 2
5. Return selected clusters ordered by frequency descending

#### Scenario: observed_colors includes closest contest cluster

- **WHEN** a contested color's closest cluster has frequency = 0.02 (2%)
- **THEN** that cluster SHALL still be included in `observed_colors`
- **AND** total SHALL NOT exceed 12

### Requirement: Conditional prompt

The brand profiler prompt SHALL be conditional:

- **Happy path** (no contested roles): prompt requests semantic analysis only — no color extraction or suggestion. `prompt_suffix = 'analyze_only'`
- **Divergence** (contested roles): prompt receives `observed_colors`, contested roles with their intended values and ∆E, and requests the vision to arbitrate by choosing from `observed_colors` only. `prompt_suffix` SHALL reflect contested roles (e.g., `'analyze_and_correct_primary'`)

#### Scenario: Happy path prompt has no color extraction

- **WHEN** `global_status = 'all_confirmed'`
- **THEN** the prompt SHALL exclude any instruction for color extraction, suggestion, or correction
- **AND** SHALL state that the palette is already defined

#### Scenario: Divergence prompt restricts to observed_colors

- **WHEN** divergence is detected
- **THEN** the prompt SHALL list each contested role with intended value and ∆E
- **AND** SHALL restrict the vision to choose exclusively from `observed_colors`
- **AND** SHALL instruct that HEX outside `observed_colors` is invalid

### Requirement: RawVisionAdjudication contract

The vision's JSON response in divergence mode SHALL follow the `RawVisionAdjudication` contract:

```typescript
interface RawVisionAdjudication {
  corrections: {
    primary: string | null;
    accent: string | null;
    background: string | null;
    support: SupportCorrection[];
  };
  reason: string;
}

interface SupportCorrection {
  index: number;
  color: string;
}
```

Contract rules:
1. **All keys SHALL be present** (`primary`, `accent`, `background`, `support`). Missing keys → parse fail → `invalid_json` → `vision_failed`
2. **Non-contested roles** SHALL return `null` — signals the vision did not opine. The normalizer SHALL preserve the intended value via `resolveRole()`
3. **Contested role with `null`** → `no_choice` → `vision_failed`
4. **Confirmed roles are immutable** — the normalizer's `resolveRole()` SHALL always return `fallback[role]` for non-contested roles, ignoring any non-null value from the vision
5. **`support: []`** means "keep original" — valid ONLY when no support indices are contested. If any support is contested and `support: []` → `no_choice` → `vision_failed`
6. **HEX free** (color not in `observed_colors`) passes through `findClosestProbeCluster()`:
   - ∆E ≤ 18 against any non-artifact probe cluster → accepted
   - ∆E > 18 against ALL non-artifact probe clusters → rejected → `vision_failed` with reason `hex_outside_observed_colors`
7. **Invalid indices** in `SupportCorrection` (< 0 or >= `intended.support.length`) are filtered (ignored) — do NOT cause failure
8. **Cobertura total**: after filtering invalid indices, every contested support index MUST have a matching `SupportCorrection`. Missing → `no_choice` → `vision_failed`
9. **Duplicate indices** violate the schema — parse fails → `invalid_json` → `vision_failed`
10. **API errors** (timeout, network) → `api_error` → `vision_failed`

The normalizer SHALL transform `RawVisionAdjudication` into `NormalizedVisionAdjudication` with `palette: IntendedPalette` (support already composed).

#### Scenario: All keys present — non-contested null

- **WHEN** only `primary` is contested
- **THEN** the vision response SHALL have all 4 keys
- **AND** `corrections.primary` SHALL be a hex string
- **AND** `corrections.accent`, `corrections.background` SHALL be `null`
- **AND** `corrections.support` SHALL be `[]`

#### Scenario: Contested role with null → vision_failed

- **WHEN** `primary` is contested
- **AND** `corrections.primary` is `null`
- **THEN** the normalizer SHALL throw `VisionAdjudicationError('no_choice: primary')`
- **AND** `global_status` SHALL be `'vision_failed'`

#### Scenario: Confirmed role ignores vision correction

- **WHEN** `accent` is NOT contested
- **AND** the vision returns `corrections.accent = "#FF0000"`
- **THEN** `resolveRole('accent')` SHALL return `fallback.accent` (intended value)
- **AND** the vision's value SHALL be discarded

#### Scenario: HEX livre com ∆E ≤ 18 aceito

- **WHEN** the vision returns `corrections.primary = "#C06040"` (not in observed_colors)
- **AND** `findClosestProbeCluster("#C06040", nonArtifactClusters)` returns ∆E = 12 (≤ 18)
- **THEN** the correction SHALL be accepted
- **AND** `safe_color_tokens.primary` SHALL be `"#C06040"`

#### Scenario: HEX livre com ∆E > 18 rejeitado

- **WHEN** the vision returns `corrections.primary = "#FF0000"` (not in observed_colors)
- **AND** `findClosestProbeCluster("#FF0000", nonArtifactClusters)` returns ∆E = 35 (> 18)
- **THEN** the correction SHALL be rejected
- **AND** `global_status` SHALL be `'vision_failed'` with reason `'hex_outside_observed_colors'`

#### Scenario: Índices duplicados → invalid_json

- **WHEN** the vision returns `corrections.support = [{ index: 0, color: "#B96F63" }, { index: 0, color: "#F5A623" }]`
- **THEN** the schema parse SHALL fail
- **AND** `global_status` SHALL be `'vision_failed'` with reason `'invalid_json'`

### Requirement: Vision failure handling

The system SHALL handle these vision failure scenarios:

| Failure | `VisionFailureReason` | Behavior |
|---|---|---|
| API timeout/network error | `api_error` | Profile persisted as `failed` |
| Invalid JSON from vision | `invalid_json` | Profile persisted as `failed` |
| Vision returns `null` for contested role | `no_choice` | Profile persisted as `failed` |
| HEX outside `observed_colors` with ∆E > 18 | `hex_outside_observed_colors` | Profile persisted as `failed` |
| Duplicate indices in SupportCorrection | `invalid_json` | Schema parse fails → `vision_failed` |

In ALL failure cases:
- Profile SHALL be persisted with `status = 'failed'`
- `color_validation.global_status` SHALL be `'vision_failed'`
- `color_validation.vision_adjudication` SHALL contain `{ status: 'failed', reason, attemptedAt }`
- The approved visual signature SHALL remain `active` (profile failure does NOT block signature)
- `safe_color_tokens` SHALL be `{}` (consumers ignore when `status === 'failed'`)
- `stores.brand_color` and `stores.accent_color` SHALL NOT be updated

#### Scenario: Profile failed preserves audit trail

- **WHEN** the vision fails with reason `no_choice`
- **THEN** a brand profile SHALL be created with `status = 'failed'`
- **AND** `metadata.color_validation.global_status` SHALL be `'vision_failed'`
- **AND** `metadata.color_validation.vision_adjudication.reason` SHALL be `'no_choice'`
- **AND** `safe_color_tokens` SHALL be `{}`
- **AND** `stores.brand_color` SHALL NOT be updated

### Requirement: ColorValidation composition

After resolution, the service SHALL compose `color_validation` as a discriminated union:

**Resolved states** — global_status in (`all_confirmed`, `vision_adjudicated`, `probe_unavailable`, `fallback_heuristic`):
- Each role (primary, accent, secondary, background) SHALL have a `ColorValidationEntry` with: `intended`, `resolved`, `presence`, `delta_e`, `role_source`, `resolution`, optionally `resolved_from_cluster` and `note`
- `support_colors` SHALL be the resolved support array
- `support_details` SHALL be present when any support was contested (optional otherwise)
- `vision_adjudication` SHALL be present when `global_status = 'vision_adjudicated'`

**Failed state** — `global_status = 'vision_failed'`:
- Only `vision_adjudication` SHALL be present (no role entries)
- `vision_adjudication.status` SHALL be `'failed'`

#### Scenario: ColorValidation matches safe_color_tokens

- **WHEN** profile is created with `global_status = 'all_confirmed'`
- **THEN** `color_validation.primary.resolved` SHALL equal `safe_color_tokens.primary`
- **AND** `color_validation.accent.resolved` SHALL equal `safe_color_tokens.accent`
- **AND** `color_validation.background.resolved` SHALL equal `safe_color_tokens.background`
- **AND** `color_validation.secondary.resolved` SHALL equal `safe_color_tokens.secondary`
