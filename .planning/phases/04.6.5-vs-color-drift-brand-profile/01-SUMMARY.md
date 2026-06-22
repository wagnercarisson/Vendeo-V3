# Plan 01: Foundation — Types & ColorProbe Extraction

## Objective
Create the foundational data types for the entire VS Color Drift phase and mechanically extract `probeColors()` from `brand-director.ts` into a shared module.

## Tasks Executed

### Task 1: New Types in visual-signature/types.ts
- `IntendedPalette` — interface with primary, accent, background, support
- `ResolvedPalette` — interface with primary, secondary, accent, background
- `ColorUsage` — interface with primary, accent, support, background
- `ColorValidationEntry` — interface with intended, resolved, presence, delta_e, role_source, resolution, resolved_from_cluster, note
- `VisionFailureReason` — union type: 'api_error' | 'invalid_json' | 'no_choice' | 'hex_outside_observed_colors'
- `VisionAdjudicationAudit` — discriminated union (success | failed)
- `ColorValidationResolved` / `ColorValidationFailed` / `ColorValidation` — discriminated union for validation state
- `SupportCorrection`, `RawVisionCorrections`, `RawVisionAdjudication`, `NormalizedVisionAdjudication`
- Updated `VisualSignatureMetadataArtDirectorOutput.intended_palette` and `.color_usage` from `Record<string, unknown>` to typed interfaces

### Task 2: BrandProfilerInput Expansion
- Added `intendedPalette: IntendedPalette | null` and `previousBrandColors?: string[]` to `BrandProfilerInput`
- Changed `BrandProfilerWithoutLogoResult.safe_color_tokens` from `Record<string, string>` to `ResolvedPalette`

### Task 3: ColorCluster edgeRatio in brand-assets/types.ts
- Added `edgeRatio: number` field to `ColorCluster` interface

### Task 4: color-probe.ts Extraction
- Created `src/lib/brand-assets/color-probe.ts` by mechanically extracting from `brand-director.ts`
- Exports: `probeColors`, `ColorProbeResult`, `ColorCluster` (imported from types), `deltaE`, `hexToLab`, `rgbToHex`, `findClosestProbeCluster`, `isLightNeutral`, and constants (STRONG_MATCH_DELTA_E=12, ACCEPTABLE_MATCH_DELTA_E=18, LOOSE_MATCH_DELTA_E=25)
- No logic changes in extracted functions — exact original signatures preserved

### Task 5: brand-director.ts Import Update
- Removed all local definitions of extracted functions
- Added imports from `./color-probe`
- `curateLogoColors` and `applyGuardrail` completely unchanged

## Quality Gate
- `npm run typecheck` PASSES with zero errors
- All 13 new types defined and exported
- ColorProbe extraction is purely mechanical — no logic changes
- BrandProfilerInput expanded with intendedPalette and previousBrandColors
- BrandProfilerWithoutLogoResult.safe_color_tokens typed as ResolvedPalette
