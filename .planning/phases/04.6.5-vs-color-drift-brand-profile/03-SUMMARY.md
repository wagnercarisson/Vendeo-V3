# Plan 03: Brand Profiler — Presence Validation & Vision Arbitration

## Objective
Refactor the `BrandProfilerWithoutLogoService` to replace heuristic `extractColorsFromBuffer` + `pickPrimaryFromPalette` with the new presence-validation flow: ColorProbe → ΔE classification → conditional vision arbitration → resolved palette with full audit trail.

## Tasks Executed

### Task 1: Conditional Prompt Variants (store-brand-profiler.md)
- Happy path (`analyze_only`): current semantic analysis — "A paleta de cores já está definida — não extraia, sugira ou corrija cores."
- Divergência (contested roles): enhanced prompt with contested roles, ΔE values, `observed_colors`, instruction to choose exclusively from observed colors
- Divergência variant specifies full response schema: semantic fields + `corrections` (RawVisionCorrections shape) + `reason`
- Retry/legacy (`analyze_only`): same as happy path — no color arbitration

### Task 2: Presence Validation Flow
- When `intendedPalette` is non-null: reads approved VS image buffer, calls `probeColors()`, collects ALL_NON_ARTIFACT_CLUSTERS (excludes suspected_transitions and frequency < 0.005)
- For each role (primary, accent, each support[index], background): calls `findClosestProbeCluster()`, classifies by ΔE (≤18 → confirmed, 18-25 → ambiguous, >25 → not_confirmed)
- Ambiguous or not_confirmed → marks role as contested
- Probe exception → empty result → `probe_unavailable` path

### Task 3: observed_colors Selection
- For each contested color: includes cluster with minimum ΔE (guarantees representation)
- For each relevant classification (dominant, dark_ink, neutral, background, structural): includes best cluster (highest frequency)
- Fills remaining slots by frequency descending, up to maximum 12
- Deduplicates clusters where ΔE ≤ 6 between them — preserves mandatory candidates

### Task 4: Conditional Prompt Logic
- No contested roles + intendedPalette valid → happy path (analyze_only)
- Contested roles + intendedPalette valid → divergence prompt with observed_colors
- intendedPalette null (retry/legacy) → analyze_only (no color arbitration)
- probe_unavailable → treated as happy path

### Task 5: Vision Arbitration with Semantic Preservation
- Divergence mode: vision API called with divergence prompt; full response parsed (semantic fields + corrections/reason)
- Corrections sub-object validated via RawVisionAdjudicationSchema
- normalizeAdjudication called with correct contested roles, indices, nonArtifactClusters
- Semantic fields preserved in brand profile output alongside resolved palette
- All failure modes caught (api_error, invalid_json, no_choice, hex_outside_observed_colors) → vision_failed state prepared

### Task 6: Fallback Matrix D7 (5 paths)
- **all_confirmed**: all ΔE ≤ 18, intended palette used directly
- **vision_adjudicated**: contested roles arbitrated by vision, confirmed roles preserved
- **probe_unavailable**: probe returned empty, intended palette treated as-all-confirmed
- **fallback_heuristic (with probe)**: no intendedPalette, probe available → primary = first dominant non-neutral, accent = second dominant, background = first background_candidate or highest edgeRatio
- **fallback_heuristic (empty probe)**: no intendedPalette, no probe → primary = store.brandColor ?? SEGMENT_FALLBACK, accent = primary, background = '#FFFFFF'

### Task 7: color_validation Composition
- After resolution: composes `ColorValidationResolved` with per-role `ColorValidationEntry` (intended, resolved, presence, delta_e, role_source, resolution, resolved_from_cluster, note)
- `support_colors` = resolved support array
- Vision audit attached when global_status = 'vision_adjudicated'
- `vision_failed`: composes `ColorValidationFailed` with only vision_adjudication audit

### Task 8: Failed Profile Persistence
- `status = 'failed'`, `safe_color_tokens = {}`, `color_validation.global_status = 'vision_failed'`
- No store sync executed
- Previous synced profile (if any) remains `synced`
- Visual signature remains `active` — profile failure does NOT roll back approval

### Task 9: logo_colors_detected + Store Sync
- `logo_colors_detected` composed from ColorProbe non-artifact clusters (up to 5) or falls back to suggested_colors
- On success: `stores.brand_color = safe_color_tokens.primary`, `stores.accent_color = safe_color_tokens.accent`
- `brand_colors_chosen` preserved only when `manual_color_override.enabled === true` from previous synced profile

## Quality Gate
- `npm run typecheck` PASSES with zero errors
- Presence validation replaces heuristic classification (extractColorsFromBuffer + pickPrimaryFromPalette removed)
- All 5 fallback matrix paths implemented correctly
- observed_colors selection guarantees contest cluster representation
- Failed profile preserves full audit trail without blocking signature
- Store sync happens ONLY on success
- brand_colors_chosen preserved ONLY with manual_color_override proof
