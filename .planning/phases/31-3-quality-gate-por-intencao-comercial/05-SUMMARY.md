# Summary 31-3-05: Automated Tests

**Objective:** Criar testes automatizados de contrato/drift para verificar ImageReviewService intent-aware, maintain compatibility, e validatePrompts improvements.

## Changes

### `src/__tests__/f31-3-review-quality-gate.test.ts` (novo)
- Contract tests: ImageReviewInput default offer, exclusive sem discountedPrice, ReviewIssueType aceita commercial_tone_mismatch, failureType aceita null

### `src/lib/image-generation/services/__tests__/image-review-service.test.ts`
- Testes: expectedBadgeBehavior para offer/exclusive, expectedPriceBehavior por intent, expectedImageTreatment por intent+preserve, sem placeholders vazios, parseResult empty_review estruturado
- Teste de regressão offer com comportamento equivalente ao anterior

### `src/lib/image-generation/services/__tests__/image-generation-service.test.ts`
- Testes: validatePrompts com campaignIntent, validação com spotlight/exclusive, detecção de placeholder antigo `{{discountedPrice}}`

## Verification
- TypeScript: Clean
- Tests: 1071 passing (131 files) — zero regressão
