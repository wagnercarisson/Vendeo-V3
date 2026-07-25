# Summary 31-3-02: Intent-Aware Review Service

**Objective:** Implementar lógica central de revisão intent-aware: montagem de variáveis contextuais em 2 etapas, `expectedBadgeBehavior` com 3 variantes, tratamento de `empty_review` como resultado estruturado.

## Changes

### `src/lib/image-generation/services/image-review-service.ts`
- **Métodos privados** de construção de variáveis contextuais por intent:
  - `buildCampaignIntentLabel()` → "Promoção" | "Destaque" | "Exclusivo"
  - `buildExpectedPriceBehavior()` — offer: preço promocional; spotlight: preço único; exclusive: sem preço
  - `buildExpectedBadgeBehavior()` — 3 variantes por intent/badge presence
  - `buildExpectedImageTreatment()` — controle preserveImageContext por intent
  - `buildExpectedCommercialTone()` — promocional/aspiracional/premium
  - `buildValidationContextSection()` — extraída para método próprio
- **`buildReviewPromptVariables(input)`** — método público single-source-of-truth
- **`review()`** — delegado a `buildReviewPromptVariables()`, sem montagem inline
- **`callVisionModel()`** — retorna JSON estruturado para `empty_review` em vez de exceção
- **Variáveis NUNCA** contêm `{{...}}` — strings 100% resolvidas

## Verification
- TypeScript: Clean
- Tests: 5/5 passing (image-review-service), 4/4 passing (image-generation-service)
