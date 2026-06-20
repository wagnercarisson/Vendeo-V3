> **Delta spec for fase 4.6.5 — VS Color Drift & Brand Profile Alignment**
> 
> Referenced canonical spec: `openspec/specs/visual-signature-approval/spec.md`

## MODIFIED Requirements

### Requirement: Approval flow

When the lojista clicks "Aprovar", the system SHALL:

1. Set the current visual signature to `active` in `store_visual_signatures`
2. Set any previous active signature to `archived`
3. Set `stores.logo_status` to `generated`
4. Reset `stores.visual_signature_attempts` to 0
5. Set `stores.identity_state` to `'visual_signature'`
6. Update the `generation_events` record matching `asset_id` and `attempt_number` with `approved = true`
7. **Invoke the Store Brand Profiler with `intendedPalette` from `signature.metadata.artDirectorOutput.intended_palette` and `previousBrandColors` from the last synced profile (if `manual_color_override.enabled`)** — replaces unconditional profiler invocation
8. Close the modal
9. Return to the Logo e Cores screen
10. Display the approved visual signature in the store preview
11. Pre-fill primary and accent colors from `safe_color_tokens.primary`/`.accent` (or identity art director's suggested colors as fallback)
12. Allow the lojista to edit colors manually before saving
13. **If the brand profiler fails (`profile.status = 'failed'`)**: the visual signature approval SHALL still succeed. The previous synced profile (if any) SHALL remain valid. The UI SHALL use the previous profile's colors or segment fallback.

#### Scenario: Approval persists signature and profile

- **WHEN** the lojista clicks "Aprovar"
- **THEN** the visual signature SHALL become `active`
- **AND** `logo_status` SHALL become `generated`
- **AND** `identity_state` SHALL become `'visual_signature'`
- **AND** `visual_signature_attempts` SHALL reset to 0
- **AND** a brand profile SHALL be created with `source = 'without_logo'` and `intendedPalette` passed to the profiler

#### Scenario: Colors pre-filled after approval

- **WHEN** the lojista returns to Logo e Cores after approval
- **THEN** the primary color input SHALL be pre-filled with `safe_color_tokens.primary` (or suggested_colors as fallback)
- **AND** the accent color input SHALL be pre-filled with `safe_color_tokens.accent` (or suggested_colors as fallback)
- **AND** the color inputs SHALL be editable by the lojista

#### Scenario: Profile failure does not block signature approval

- **WHEN** the brand profiler returns `status = 'failed'`
- **THEN** the visual signature SHALL still be set to `active`
- **AND** `stores.logo_status` SHALL still be set to `generated`
- **AND** the previous synced profile (if exists) SHALL remain unchanged
- **AND** the UI SHALL show colors from the previous profile or segment fallback

## ADDED Requirements

### Requirement: intendedPalette extraction in approval route

Before invoking the brand profiler, the approval route SHALL:
1. Load `signature.metadata.artDirectorOutput.intended_palette` from the approved visual signature
2. Re-apply `normalizeIntendedPalette()` (idempotent)
3. If `intended_palette` is missing or normalization returns `null`, set `intendedPalette = null`
4. Load `previousBrandColors` from the last synced brand profile — only if that profile has `manual_color_override.enabled === true`, otherwise `previousBrandColors = []`
5. Pass both as `BrandProfilerInput.intendedPalette` and `BrandProfilerInput.previousBrandColors`

#### Scenario: intendedPalette extracted and reapplied

- **WHEN** the approval route processes a visual signature with `intended_palette` in metadata
- **THEN** `normalizeIntendedPalette()` SHALL be reapplied (idempotent)
- **AND** the normalized value SHALL be passed to the profiler

#### Scenario: previousBrandColors loaded conditionally

- **WHEN** the last synced profile has `manual_color_override.enabled = true` and `brand_colors_chosen = ["#FF6600"]`
- **THEN** `previousBrandColors = ["#FF6600"]` SHALL be passed to the profiler

- **WHEN** the last synced profile has `manual_color_override.enabled = false`
- **THEN** `previousBrandColors = []` SHALL be passed to the profiler

### Requirement: Visual signature remains active on profiler failure

When the brand profiler fails (`status = 'failed'`), the approved visual signature SHALL remain `active`. The profile failure is isolated from the signature approval. The system SHALL:
- Keep `store_visual_signatures` status as `active`
- Log the profile failure in the profile's `metadata.color_validation`
- NOT roll back the signature approval
- Keep the previous synced profile (if exists) unchanged
- Allow future retry of profile generation

#### Scenario: Signature active despite profile failure

- **WHEN** the brand profiler returns `status = 'failed'` with `global_status = 'vision_failed'`
- **THEN** the visual signature SHALL remain `active`
- **AND** `store_visual_signatures` SHALL NOT be rolled back
- **AND** the previous synced profile (if exists) SHALL remain `synced`
