# Plan 31-2-06: Tests + Verification — Summary

**Status:** ✅ Complete
**Date:** 2026-07-25

## Changes Made

### New test file: src/__tests__/f31-2-intent-tests.test.ts
**15 new tests** covering:

**Schema Tests (7):**
1. GenerateImageRequestSchema aceita spotlight sem discountedPriceCents
2. GenerateImageRequestSchema aceita exclusive sem discountedPriceCents
3. GenerateImageRequestSchema aceita offer com discountedPriceCents (regressão)
4. CampaignSpecSchema aceita discounted_price_display null
5. CampaignSpecSchema rejeita product_name vazio (obrigatório mantido)
6. CampaignGenerationInputSchema aceita exclusive sem discountedPriceCents
7. CampaignGenerationInputSchema aceita offer com discountedPriceCents (regressão)

**Copy Director Tests (8):**
8. CopyDirectorInputSchema rejeita commercialFrame vazio
9. CopyDirectorInputSchema aceita input mínimo com commercialFrame
10. CopyDirectorInputSchema não contém campo offer
11. buildCommercialFrame retorna texto correto por intent (5 variações)
12. buildDeterministicCopy gera texto diferente por intent
13. buildDeterministicCopy spotlight inclui preço quando disponível
14. buildDeterministicCopy spotlight sem preço não exibe valor
15. buildDeterministicCopy exclusive sem preço

### Updated: src/__tests__/api/campaign-intent-guard.test.ts
- Test "maintains discountedPriceCents as required" → "discountedPriceCents is now optional" (expect success: true)

### Updated: src/lib/image-generation/services/__tests__/image-generation-service.test.ts
- Mock prompt names updated from "campaign-image-director" to "campaign-image-director-offer"

## Verification
- `npx vitest run` — 1051 passing (15 novos, 1036 baseline)
- `npx tsc --noEmit` — zero errors
- `npx next lint` — zero warnings/errors
- `npx next build` — compiled successfully in 7.9s
