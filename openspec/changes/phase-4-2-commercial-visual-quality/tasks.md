## 1. Commercial Art Direction (4.2.0)

- [ ] 1.1 Run UI/UX Pro Max skill to produce the visual contract for `produto-oferta-comercial`
- [ ] 1.2 Define zone composition, hierarchy, and proportions for the single template
- [ ] 1.3 Define product image treatment (contain/crop, shadow, vignette, overlay)
- [ ] 1.4 Define price block styling (hero treatment, positioning, background accent)
- [ ] 1.5 Define CTA styling as campaign element (pill, integrated, non-interactive)
- [ ] 1.6 Define store identity positioning and professional presentation
- [ ] 1.7 Define hook/benefício placement and visual weight
- [ ] 1.8 Define background visual treatment per segment
- [ ] 1.9 Define fallback visual rules for missing data
- [ ] 1.10 Review and approve contract before any renderer code changes
- [ ] 1.11 Persist approved contract in `openspec/design-system/CAMPAIGN_ART_DIRECTION.md`

## 2. Content, Types & Mock (4.2.1)

- [ ] 2.1 Expand `CampaignAdjustments` type with `hook?: string` and `cta?: string`
- [ ] 2.2 Expand `mergedSpec` logic in PreviewPage to merge hook and CTA adjustments into the spec
- [ ] 2.3 Add hook field to `CampaignAdjustmentsPanel` (label "Texto do Benefício", maxLength=120, character counter, undo, original display)
- [ ] 2.4 Add CTA field to `CampaignAdjustmentsPanel` (label "Chamada para Ação", maxLength=60, character counter, undo, original display)
- [ ] 2.5 Update MockProvider to generate contextual hooks per segment (not generic text)
- [ ] 2.6 Update MockProvider to generate varied CTAs per segment
- [ ] 2.7 Run `npm run typecheck` and fix any type errors

## 3. Commercial Renderer (4.2.2)

- [ ] 3.1 Rewrite `CampaignRenderer` internal layout to implement the `produto-oferta-comercial` template per the 4.2.0 contract
- [ ] 3.2 Implement professional product image treatment (contain/crop, shadow, vignette) per 4.2.0 contract
- [ ] 3.3 Implement background with visual treatment (gradient, overlay) per segment per 4.2.0 contract
- [ ] 3.4 Implement hook/benefício as visible element in the composition
- [ ] 3.5 Implement price block as visual hero element with accent color
- [ ] 3.6 Implement CTA as campaign element (non-interactive, integrated styling)
- [ ] 3.7 Implement store identity with professional presentation per 4.2.0 contract
- [ ] 3.8 Implement product image missing/error state (explicit, no placeholder, not publishable)
- [ ] 3.9 Ensure logo failure fallback renders initials professionally (not broken image)
- [ ] 3.10 Ensure all fallbacks (no logo, no badge, no subtitle, no hook, no cta) render without breakage
- [ ] 3.11 Preserve responsive 1080×1080 container with 1:1 aspect ratio scaling
- [ ] 3.12 Preserve `CampaignRendererProps` interface unchanged (no breaking changes)
- [ ] 3.13 Run `npm run typecheck` and fix any type errors

## 4. Visual Validation Gate (4.2.3)

- [ ] 4.1 Validate composition renders correctly with mock data (minimum fields)
- [ ] 4.2 Validate composition renders correctly with mock data (complete fields)
- [ ] 4.3 Validate composition renders with real OpenAI-generated spec (if API available)
- [ ] 4.4 Validate hook appears in the rendered composition
- [ ] 4.5 Validate CTA appears as campaign element (not UI button)
- [ ] 4.6 Validate adjustments panel renders hook and CTA fields with undo
- [ ] 4.7 Validate hook and CTA adjustments update the rendered art locally
- [ ] 4.8 Validate image missing shows explicit error (not a publishable art)
- [ ] 4.9 Validate logo missing shows professional initials fallback
- [ ] 4.10 Validate badge missing renders no empty space
- [ ] 4.11 Run `npm run typecheck` with zero errors
- [ ] 4.12 Run `npm run lint` with zero errors
- [ ] 4.13 Run `npm run build` with zero errors
- [ ] 4.14 Apply manual publishability gate: answer "sim" to all 7 criteria before marking phase complete
