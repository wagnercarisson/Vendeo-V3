## MODIFIED Requirements

### Requirement: Approval route — brand profiler invocation (updated)

When invoking the Store Brand Profiler during visual signature approval, the system SHALL:

1. Load `signature.metadata.artDirectorOutput.intended_palette` from the approved visual signature
2. Re-apply `normalizeIntendedPalette()` (idempotent)
3. If `intended_palette` is missing or normalization returns `null`, set `intendedPalette = null`
4. Load `previousBrandColors` from the last synced brand profile — only if that profile has `brand_colors_chosen` with at least one valid HEX, otherwise `previousBrandColors = []`
5. Pass both as `BrandProfilerInput.intendedPalette` and `BrandProfilerInput.previousBrandColors`

`manual_color_override.enabled` SHALL NOT be consulted for this decision.

#### Scenario: previousBrandColors loaded from brand_colors_chosen

- **WHEN** the last synced profile has `brand_colors_chosen = ["#FF6600", null]`
- **THEN** `previousBrandColors = ["#FF6600", null]` SHALL be passed to the profiler

#### Scenario: previousBrandColors empty when no user choice

- **WHEN** the last synced profile has `brand_colors_chosen = []`
- **THEN** `previousBrandColors = []` SHALL be passed to the profiler

#### Scenario: manual_color_override not consulted

- **WHEN** the last synced profile has `manual_color_override.enabled = false` but `brand_colors_chosen = ["#FF6600", null]`
- **THEN** `previousBrandColors = ["#FF6600", null]` SHALL be passed to the profiler
- **AND** `manual_color_override` SHALL NOT be checked
