## 1. Types and interfaces

- [ ] 1.1 Add `IntendedPalette`, `ResolvedPalette`, `ColorUsage` interfaces to `src/lib/visual-signature/types.ts`
- [ ] 1.2 Add `ColorValidationEntry`, `ColorValidationResolved`, `ColorValidationFailed` (discriminated union), `VisionAdjudicationAudit` (discriminated union), `VisionFailureReason` types to `src/lib/visual-signature/types.ts`
- [ ] 1.3 Add `NormalizedVisionAdjudication`, `RawVisionAdjudication`, `RawVisionCorrections`, `SupportCorrection` types to `src/lib/visual-signature/types.ts`
- [ ] 1.4 Add `BrandProfilerInput` with `intendedPalette: IntendedPalette | null` and `previousBrandColors?: string[]` fields

## 2. ColorProbe shared module (mechanical extraction)

- [ ] 2.1 Create `src/lib/brand-assets/color-probe.ts` by extracting `probeColors()`, `ColorProbeResult`, `ColorCluster`, `deltaE`, `hexToLab`, `rgbToHex`, `findClosestProbeCluster`, `isLightNeutral`, and constants from `brand-director.ts` — purely mechanical, no logic changes
- [ ] 2.1a Add `edgeRatio: number` field to `ColorCluster` interface and preserve it in both classificaçao outputs (`toCluster()` calls) — this exposes already-calculated data without changing classification logic
- [ ] 2.1b Update `src/lib/brand-assets/types.ts` to include `edgeRatio: number` on `ColorCluster`
- [ ] 2.2 Update `brand-director.ts` to import all extracted symbols from `color-probe.ts` instead of local definitions
- [ ] 2.3 Verify `curateLogoColors` and `applyGuardrail` are unmodified and brand-director compiles without errors

## 3. Normalizer utilities

- [ ] 3.1 Implement `normalizeIntendedPalette(raw: unknown): IntendedPalette | null` — validates hex format, converts to uppercase, returns null on missing/invalid required fields
- [ ] 3.2 Implement `intendedToResolved(intended: IntendedPalette, supportResolved: string[]): ResolvedPalette` — derives secondary from `supportResolved[0] ?? primary`
- [ ] 3.3 Implement `normalizeAdjudication(raw: unknown, fallback: IntendedPalette, contestedRoles, contestedSupportIndices): NormalizedVisionAdjudication` — validates RawVisionAdjudication contract, applies resolveRole() per role, validates cobertura total for support, filters invalid indices
- [ ] 3.4 Implement `composeSupport(original: string[], contestedIndices: number[], corrections: SupportCorrection[]): string[]` — applies corrections only at contested indices, preserves confirmed supports
- [ ] 3.5 Implement `RawVisionAdjudicationSchema` (Zod or manual) — validates all keys present, rejects duplicate indices, validates hex format

## 4. Store Identity Art Director — intended_palette and color_usage

- [ ] 4.1 Integrate `normalizeIntendedPalette` into the Art Director normalizer — extract `intended_palette` and `color_usage` from IA JSON response
- [ ] 4.2 Persist `intended_palette` and `color_usage` in `metadata.artDirectorOutput` alongside existing fields
- [ ] 4.3 Ensure generation proceeds normally when normalization returns null (intended_palette omitted, not blocking)

## 5. Brand Profiler — presence validation and vision arbitration

- [ ] 5.1 Update `BrandProfilerInput` to accept `intendedPalette: IntendedPalette | null` and `previousBrandColors: string[]`
- [ ] 5.2 Implement presence validation flow: run `probeColors()` on VS image, for each intended role call `findClosestProbeCluster()`, classify presence by ∆E thresholds (≤18 confirmed, 18 < ∆E ≤ 25 ambiguous, >25 not_confirmed)
- [ ] 5.3 Implement happy path: no contested roles → `global_status = 'all_confirmed'`, `safe_color_tokens = intendedToResolved(intendedPalette, intendedPalette.support)`, vision called for semantic analysis only
- [ ] 5.4 Implement `observed_colors` selection from non-artifact probe clusters: closest per contested color + best per classification + frequency fill up to 12 + dedup by ∆E ≤ 6
- [ ] 5.5 Implement conditional prompt logic: happy path → `prompt_suffix = 'analyze_only'` (semantic analysis only); divergence → `prompt_suffix` with contested role names, receives `observed_colors`; retry/legado → `prompt_suffix = 'analyze_only'` (no color arbitration)
- [ ] 5.6 Implement vision arbitration integration: call vision with divergence prompt, receive `RawVisionAdjudication`, normalize via `normalizeAdjudication()` — handle all failure modes (api_error, invalid_json, no_choice, hex_outside_observed_colors)
- [ ] 5.7 Implement HEX free revalidation: if vision returns HEX outside `observed_colors`, run `findClosestProbeCluster()` — accept if ∆E ≤ 18, reject if ∆E > 18 → `vision_failed`
- [ ] 5.8 Implement fallback matrix (intendedPalette null): probe valid → first dominant non-neutral as primary, second dominant or first structural as accent, secondary = accent, background = first background_candidate or highest edgeRatio cluster. Probe empty → primary = secondary = brandColor ?? SEGMENT_FALLBACK, accent = brandColor ?? SEGMENT_FALLBACK, background = #FFFFFF
- [ ] 5.9 Compose `color_validation` discriminated union with per-role `ColorValidationEntry` after resolution
- [ ] 5.10 Persist profile with `status = 'failed'` when vision fails — `safe_color_tokens = {}`, `color_validation.vision_adjudication` with failure audit

## 6. Brand Profiler — sync and brand_colors_chosen

- [ ] 6.1 Sync `stores.brand_color` ← `safe_color_tokens.primary` and `stores.accent_color` ← `safe_color_tokens.accent` after successful profile creation
- [ ] 6.2 Update `profile.inferred_primary_color` ← `safe_color_tokens.primary` and `profile.inferred_accent_color` ← `safe_color_tokens.accent`
- [ ] 6.3 Preserve `brand_colors_chosen` from previous synced profile only when `manual_color_override.enabled === true`; otherwise `[]`
- [ ] 6.4 Skip store sync when profile status is `failed`

## 7. Approval route — intendedPalette wiring

- [ ] 7.1 In `POST /api/store/[id]/visual-signature/approve/route.ts`, extract `intended_palette` from `signature.metadata.artDirectorOutput`
- [ ] 7.2 Re-apply `normalizeIntendedPalette()` on extracted value (idempotent)
- [ ] 7.3 Load `previousBrandColors` from last synced profile — only if `manual_color_override.enabled === true`
- [ ] 7.4 Pass `intendedPalette` and `previousBrandColors` to `brandProfiler.generate()`
- [ ] 7.5 Handle profiler failure gracefully: signature remains `active`, previous synced profile (if exists) unchanged
- [ ] 7.6 Ensure `identity_state` is set to `visual_signature` on approval regardless of profiler outcome

## 8. Tests — ColorProbe (fixture PNG, pure function)

- [ ] 8.1 Write test: PNG sólido #B96F63 → `findClosestProbeCluster('#B96F63')` returns ∆E ≈ 0 (confirmed)
- [ ] 8.2 Write test: PNG sólido #B96F63 → `findClosestProbeCluster('#B96F50')` returns ∆E ≤ 18 (confirmed)
- [ ] 8.3 Write test: PNG sólido #B96F63 → `findClosestProbeCluster('#FF0000')` returns ∆E > 25 (not_confirmed)
- [ ] 8.4 Write test: PNG gradiente → `findClosestProbeCluster` for existing and non-existing colors
- [ ] 8.5 Write test: Buffer corrompido → probe returns empty result (graceful error)
- [ ] 8.6 Write test: regressão do fluxo de logo — `brand-director.ts` compiles and `curateLogoColors`/`applyGuardrail` unchanged after extraction
- [ ] 8.7 Write test: regressão do BrandDirector — usar fixture controlada (PNG conhecido + store data) e comparar deterministicResult (logo_colors_detected, safe_color_tokens, inferred_*) contra resultados golden definidos no teste. Refatoração não altera output do BrandDirector para mesma entrada

## 9. Tests — normalizeIntendedPalette

- [ ] 9.1 Write test: valid input → returns IntendedPalette with uppercase hex
- [ ] 9.2 Write test: invalid primary → returns null
- [ ] 9.3 Write test: support with invalid entries → filters out invalid hexes
- [ ] 9.4 Write test: idempotent — calling twice on same input returns identical result
- [ ] 9.5 Write test: null/undefined/empty input → returns null

## 10. Tests — normalizeAdjudication

- [ ] 10.1 Write test: all keys present, non-contested null → passes, preserves intended
- [ ] 10.2 Write test: contested role with null → throws VisionAdjudicationError('no_choice')
- [ ] 10.3 Write test: confirmed role ignores vision correction → resolveRole returns fallback
- [ ] 10.4 Write test: support cobertura total — every contested index has matching correction
- [ ] 10.5 Write test: support cobertura incompleta — missing correction → throws no_choice
- [ ] 10.6 Write test: invalid support indices filtered (ignored, not failed)
- [ ] 10.7 Write test: duplicate indices → invalid_json
- [ ] 10.8 Write test: HEX livre ∆E ≤ 18 accepted, ∆E > 18 rejected

## 11. Tests — palette resolution (probe mockado, sem IA real)

- [ ] 11.1 Write test: todas as cores ∆E ≤ 18 → `global_status = 'all_confirmed'`, primary == intended.primary, secondary == support[0] ?? primary
- [ ] 11.2 Write test: primary 18 < ∆E ≤ 25 → `global_status = 'vision_adjudicated'`, vision receives observed_colors
- [ ] 11.3 Write test: primary ∆E > 25 → `global_status = 'vision_adjudicated'`
- [ ] 11.4 Write test: support[0] ∆E ≤ 18 → `global_status = 'all_confirmed'`, secondary == support[0]
- [ ] 11.5 Write test: support[0] 18 < ∆E ≤ 25 → `global_status = 'vision_adjudicated'`, vision arbitrates support
- [ ] 11.6 Write test: probe vazio + intendedPalette válido → `global_status = 'probe_unavailable'`, primary == intended.primary
- [ ] 11.7 Write test: primary ambíguo + visão falha simulada → `global_status = 'vision_failed'`, profile `failed`
- [ ] 11.8 Write test: probe vazio + intendedPalette null + brandColor set → `global_status = 'fallback_heuristic'`, primary == brandColor
- [ ] 11.9 Write test: probe vazio + intendedPalette null + brandColor null → `global_status = 'fallback_heuristic'`, primary == SEGMENT_FALLBACK
- [ ] 11.10 Write test: support[1] contestado, support[0] preservado → secondary == support[0] original
- [ ] 11.11 Write test: background identificado por edgeRatio — cluster com maior edgeRatio vira background quando não há background_candidate explícito
- [ ] 11.12 Write test: background cromático preservado — cluster cromático de fundo não é descartado como artefato e permanece elegível para validação de presença via findClosestProbeCluster
- [ ] 11.13 Write test: HEX livre ∆E ≤ 18 aceito, HEX livre ∆E > 18 rejeitado
- [ ] 11.14 Write test: happy path chama visão com analyze_only — vision mock verifica prompt_suffix = 'analyze_only' e sem instruções de correção
- [ ] 11.15 Write test: fallback_heuristic chama visão com analyze_only — vision mock verifica prompt_suffix = 'analyze_only' e sem instruções de correção
- [ ] 11.16 Write test: divergência chama visão com prompt de arbitragem — vision mock recebe observed_colors e contested roles
- [ ] 11.17 Write test: índice duplicado → invalid_json → vision_failed
- [ ] 11.18 Write test: observed_colors selection — closest contest cluster included, max 12, dedup preserves mandatory
- [ ] 11.19 Write test: observed_colors dedup — ∆E ≤ 6 removes duplicates but keeps mandatory candidates

## 12. Tests — integration (VS approval → brand profile)

- [ ] 12.1 Write test: VS approval happy path → `color_validation.global_status === 'all_confirmed'`, all roles match intended
- [ ] 12.2 Write test: VS approval with brand_colors_chosen preservation (manual_color_override.enabled)
- [ ] 12.3 Write test: VS approval without previous colors → brand_colors_chosen = []
- [ ] 12.4 Write test: profiler failure → signature still active, profile status = failed
- [ ] 12.5 Write test: VS approval with retry (null intendedPalette) → fallback_heuristic
- [ ] 12.6 Verify `stores.brand_color` and `stores.accent_color` synced correctly on success, not synced on failure
- [ ] 12.7 Write test: intended_palette and color_usage persisted in signature metadata after generation
- [ ] 12.8 Write test: intended_palette omitted when normalization returns null (generation not blocked)
- [ ] 12.9 Write test: text_only → logo transição — fluxo de logo intacto, não contaminado pelo ColorProbe compartilhado
- [ ] 12.10 Write test: logo → text_only transição — identity_state = text_only, direção preservada
- [ ] 12.11 Write test: VS approval — sem intended_palette nem profile anterior → fallback roda, `global_status = 'fallback_heuristic'`
- [ ] 12.12 Write test: VS approval — sem intended_palette mas com profile synced anterior → profile reutilizado, fallback NÃO roda, profile.status reativado

## 13. Manual verification

- [ ] 13.1 Gerar VS real → aprovar → inspecionar `color_validation` no banco — cores fazem sentido visualmente?
- [ ] 13.2 Gerar VS → rejeitar → gerar nova → aprovar — paleta da segunda VS independente da primeira
- [ ] 13.3 Calibrar thresholds ∆E com imagens VS reais se necessário (baseline CIE76)

## 14. Final verification

- [ ] 14.1 Run TypeScript typecheck — zero errors
- [ ] 14.2 Run lint — zero warnings
- [ ] 14.3 Run full test suite — all existing + new tests pass
- [ ] 14.4 Run `npm run build` or equivalent — build succeeds
- [ ] 14.5 Record results of all checks above
