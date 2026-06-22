> **Delta spec for fase 4.6.5 — VS Color Drift & Brand Profile Alignment**
> 
> Referenced canonical spec: `openspec/specs/store-brand-profile/spec.md`

## MODIFIED Requirements

### Requirement: brand_colors_chosen semantic clarification

The system SHALL treat `brand_colors_chosen` exclusively as the user's chosen colors.

**Correct usage:**
- User chose colors via color picker → `brand_colors_chosen = ["#userPrimary", "#userAccent"]`
- User did not choose colors → `brand_colors_chosen = []`

**Preservation on visual signature approval (fase 4.6.5):**
When a new brand profile is generated from visual signature approval:
- `brand_colors_chosen` SHALL be preserved from the **previous synced profile** ONLY IF `manual_color_override.enabled === true` on that profile
- If `manual_color_override.enabled === false` or no previous synced profile exists → `brand_colors_chosen = []`
- Legacy profiles (created before this phase) without `manual_color_override` field SHALL be treated as `manual_color_override.enabled === false` → `brand_colors_chosen = []`

For campaign rendering, the color resolution priority SHALL be:
`safe_color_tokens.primary > inferred_primary_color > store.brand_color > SEGMENT_COLOR_FALLBACK[segment]`

`brand_colors_chosen` is used only for UI pre-fill in the color pickers and as input signal to the inference service.

#### Scenario: brand_colors_chosen NOT populated by logo upload

- **WHEN** a logo upload creates a synced brand profile
- **THEN** `brand_colors_chosen` SHALL be `[]` (unless the user had previously chosen colors)
- **AND** `logo_colors_detected` SHALL contain the extracted colors
- **AND** the final palette SHALL be in `safe_color_tokens`

#### Scenario: brand_colors_chosen populated only by manual picker

- **WHEN** the user changes colors via PATCH brand-profile with `{ "colors": ["#FF6600"] }`
- **THEN** `brand_colors_chosen` SHALL be updated to `["#FF6600"]`

#### Scenario: brand_colors_chosen preserved with manual override on VS approval

- **WHEN** a new brand profile is generated from visual signature approval
- **AND** the previous synced profile has `manual_color_override.enabled === true` with `brand_colors_chosen = ["#FF6600"]`
- **THEN** the new profile SHALL have `brand_colors_chosen = ["#FF6600"]`

#### Scenario: brand_colors_chosen empty without manual override

- **WHEN** a new brand profile is generated from visual signature approval
- **AND** the previous synced profile has `manual_color_override` either `false` or absent
- **THEN** the new profile SHALL have `brand_colors_chosen = []`

## ADDED Requirements

### Requirement: safe_color_tokens as ResolvedPalette

The `safe_color_tokens` jsonb column SHALL store a `ResolvedPalette` structure:

```typescript
interface ResolvedPalette {
  primary: string;
  secondary: string;      // supportResolved[0] ?? primary
  accent: string;
  background: string;
}
```

`secondary` SHALL be explicitly stored (not computed at query time) via `intendedToResolved()`:
- `secondary = supportResolved[0] ?? primary`
- `supportResolved` is the resolved support array — either confirmed intended supports or vision-corrected supports

#### Scenario: ResolvedPalette includes secondary

- **WHEN** a brand profile is created with `safe_color_tokens` in the new format
- **THEN** the JSON SHALL include `primary`, `secondary`, `accent`, and `background` keys
- **AND** `secondary` SHALL equal `supportResolved[0] ?? primary`

#### Scenario: Match exato — individual role comparison

- **WHEN** `safe_color_tokens` is created from `intendedToResolved(intendedPalette, intendedPalette.support)`
- **THEN** `safe_color_tokens.primary` SHALL equal `intendedPalette.primary`
- **AND** `safe_color_tokens.accent` SHALL equal `intendedPalette.accent`
- **AND** `safe_color_tokens.background` SHALL equal `intendedPalette.background`
- **AND** `safe_color_tokens.secondary` SHALL equal `intendedPalette.support[0] ?? intendedPalette.primary`

### Requirement: ColorValidation metadata structure

The `metadata` jsonb column SHALL support a `color_validation` field as a discriminated union:

```typescript
interface ColorValidationEntry {
  intended: string | null;          // null when fallback_heuristic (no prior intent)
  resolved: string;
  presence: 'confirmed' | 'ambiguous' | 'not_confirmed' | 'unchecked';
  delta_e: number | null;           // null when probe_unavailable or fallback_heuristic
  role_source: 'art_director' | 'vision_adjudication' | 'heuristic';
  resolution: 'accepted' | 'accepted_unverified' | 'corrected_by_vision' | 'selected_by_heuristic';
  resolved_from_cluster?: {
    hex: string;
    classification: string;
    frequency: number;
    delta_e: number;
  } | null;
  note?: string;
}

type VisionAdjudicationAudit =
  | { status: 'success'; reason: string; prompt_suffix: string }
  | { status: 'failed'; reason: VisionFailureReason; details?: string; attemptedAt: string };

// Resolved states
interface ColorValidationResolved {
  global_status: 'all_confirmed' | 'vision_adjudicated' | 'probe_unavailable' | 'fallback_heuristic';
  primary: ColorValidationEntry;
  accent: ColorValidationEntry;
  secondary: ColorValidationEntry;
  background: ColorValidationEntry;
  support_colors: string[];
  support_details?: ColorValidationEntry[];
  vision_adjudication?: VisionAdjudicationAudit;
}

// Failed state
interface ColorValidationFailed {
  global_status: 'vision_failed';
  vision_adjudication: VisionAdjudicationAudit;
}

type ColorValidation = ColorValidationResolved | ColorValidationFailed;
```

Relationships:
- `metadata.color_validation.<role>.resolved` SHALL equal `safe_color_tokens.<role>` (same hex value)
- `safe_color_tokens` is a separate column — not part of `color_validation`

For `vision_failed` state:
- `safe_color_tokens` SHALL be `{}`
- `stores.brand_color` and `stores.accent_color` SHALL NOT be updated
- The approved visual signature SHALL remain `active` (profile failure is isolated)

#### Scenario: ColorValidation populated on all_confirmed

- **WHEN** a brand profile is created with `global_status = 'all_confirmed'`
- **THEN** `metadata.color_validation.primary.presence` SHALL be `'confirmed'`
- **AND** `metadata.color_validation.primary.resolved` SHALL equal `safe_color_tokens.primary`

#### Scenario: Failed profile stores audit only

- **WHEN** profile is created with `global_status = 'vision_failed'`
- **THEN** `metadata.color_validation.global_status` SHALL be `'vision_failed'`
- **AND** `metadata.color_validation.vision_adjudication.status` SHALL be `'failed'`
- **AND** `safe_color_tokens` SHALL be `{}`
- **AND** `metadata.color_validation` SHALL NOT contain `primary`, `accent`, `secondary`, or `background` entries

### Requirement: Store accent_color sync on profile creation

When a brand profile is created with `status = 'synced'`, the system SHALL synchronize:
- `stores.brand_color ← safe_color_tokens.primary`
- `stores.accent_color ← safe_color_tokens.accent`

The `inferred_primary_color` and `inferred_accent_color` fields on the profile record SHALL also be updated to match `safe_color_tokens.primary` and `safe_color_tokens.accent` respectively, but these are profile fields, NOT store-level fields.

When `status = 'failed'`, store fields SHALL NOT be updated.

#### Scenario: Stores synced on profile success

- **WHEN** a brand profile is created with `status = 'synced'`
- **THEN** `stores.brand_color` SHALL equal `safe_color_tokens.primary`
- **AND** `stores.accent_color` SHALL equal `safe_color_tokens.accent`
- **AND** `profile.inferred_primary_color` SHALL equal `safe_color_tokens.primary`
- **AND** `profile.inferred_accent_color` SHALL equal `safe_color_tokens.accent`

#### Scenario: Stores NOT synced on profile failure

- **WHEN** profile is created with `status = 'failed'`
- **THEN** `stores.brand_color` SHALL NOT be updated
- **AND** `stores.accent_color` SHALL NOT be updated

### Requirement: intended_palette consumption (not storage)

The `intended_palette` field originates in `store_visual_signatures.metadata.artDirectorOutput.intended_palette`. The brand profile SHALL NOT store `intended_palette` in its own metadata.

At profile generation time (visual signature approval), the approval route:
1. Reads `intended_palette` from the approved signature's `metadata.artDirectorOutput`
2. Reapplies `normalizeIntendedPalette()` for safety (idempotent)
3. Passes the normalized value to `BrandProfilerInput.intendedPalette`
4. The profiler consumes it for presence validation

#### Scenario: intendedPalette read from signature, not stored in profile

- **WHEN** the approval route processes a visual signature
- **THEN** `intendedPalette` SHALL be read from `signature.metadata.artDirectorOutput.intended_palette`
- **AND** SHALL be passed to the profiler as input
- **AND** SHALL NOT be persisted in the brand profile's metadata

### Requirement: Profile fallback matrix

The brand profiler SHALL follow this decision matrix when resolving colors:

| intendedPalette | Probe | global_status | safe_color_tokens |
|---|---|---|---|
| Válido | OK + todas ≤ 18 ∆E | `all_confirmed` | `intendedToResolved(intended, intended.support)` |
| Válido | OK + alguma > 18 ∆E | `vision_adjudicated` or `vision_failed` | Resolved by vision or `{}` |
| Válido | Vazio/exceção | `probe_unavailable` | `intendedToResolved(intended, intended.support)` |
| Nulo (retry/legado) | OK | `fallback_heuristic` | Probe-based heuristic |
| Nulo (retry/legado) | Vazio | `fallback_heuristic` | `{ primary: brandColor ?? SEGMENT_FALLBACK, secondary: brandColor ?? SEGMENT_FALLBACK, accent: brandColor ?? SEGMENT_FALLBACK, background: '#FFFFFF' }` |

Retry and legacy signatures (null intendedPalette) SHALL NOT invoke vision for color arbitration — the vision SHALL be called for semantic analysis only.

When probe is valid and intendedPalette is null (fallback_heuristic com probe):
- `primary` ← first dominant non-neutral cluster (luminance ≥ 0.25 and saturation ≥ 0.1)
- `accent` ← second dominant non-neutral cluster, or first structural cluster if only one dominant exists
- `secondary` ← accent
- `background` ← first background_candidate, or cluster with highest edgeRatio if no background candidates

When probe is empty and intendedPalette is null (fallback_heuristic sem probe):
- `primary` ← `store.brandColor ?? SEGMENT_FALLBACK`
- `secondary` ← same as primary
- `accent` ← derived from brandColor (same as primary if brandColor set, else SEGMENT_FALLBACK)
- `background` ← `'#FFFFFF'`

#### Scenario: Happy path — all_confirmed

- **WHEN** intendedPalette is valid and all colors have ∆E ≤ 18
- **THEN** `global_status` SHALL be `'all_confirmed'`
- **AND** `safe_color_tokens` SHALL match intended palette via `intendedToResolved()`
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)

#### Scenario: Heuristic fallback for legacy with valid probe

- **WHEN** `intendedPalette` is null
- **AND** probe returns valid non-artifact clusters
- **THEN** `global_status` SHALL be `'fallback_heuristic'`
- **AND** `safe_color_tokens.primary` SHALL be the first dominant non-neutral cluster hex
- **AND** `safe_color_tokens.accent` SHALL be the second dominant or first structural cluster hex
- **AND** `safe_color_tokens.secondary` SHALL equal `safe_color_tokens.accent`
- **AND** `safe_color_tokens.background` SHALL be the first background_candidate or highest edgeRatio cluster
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)

#### Scenario: Heuristic fallback for legacy with empty probe

- **WHEN** `intendedPalette` is null
- **AND** probe returns all empty arrays
- **AND** `store.brandColor` is `"#B96F63"`
- **THEN** `global_status` SHALL be `'fallback_heuristic'`
- **AND** `safe_color_tokens.primary` SHALL be `"#B96F63"`
- **AND** `safe_color_tokens.secondary` SHALL be `"#B96F63"`
- **AND** `safe_color_tokens.accent` SHALL be `"#B96F63"`
- **AND** `safe_color_tokens.background` SHALL be `"#FFFFFF"`
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)
