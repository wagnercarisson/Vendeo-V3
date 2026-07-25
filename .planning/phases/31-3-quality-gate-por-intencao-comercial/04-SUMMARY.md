# Summary 31-3-04: Pipeline Integration

**Objective:** Adaptar pipeline de geração para usar ImageReviewService intent-aware: buildReviewInput, validatePrompts com verificação de variáveis contextuais e placeholders antigos.

## Changes

### `src/lib/image-generation/services/image-generation-service.ts`
- `buildReviewInput` agora inclui `campaignIntent`, `preserveImageContext`, `badgeText` opcional, `discountedPrice` opcional
- `validatePrompts` usa `this.imageReview.buildReviewPromptVariables()` — single source of truth
- Adicionada verificação de variáveis contextuais obrigatórias (`campaignIntentLabel`, `expectedPriceBehavior`, etc.)
- Adicionada verificação de placeholders antigos (`{{discountedPrice}}`, `{{badgeText}}`) no prompt do revisor
- `InputValidationService` verificado — sem presunções de preço/badge (nenhuma alteração)

## Verification
- TypeScript: Clean
- Tests: 4/4 passing (image-generation-service)
