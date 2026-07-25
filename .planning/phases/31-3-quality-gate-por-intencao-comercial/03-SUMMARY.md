# Summary 31-3-03: Prompt Restructuring

**Objective:** Reestruturar `prompts/campaign-image-reviewer.md` para usar variáveis contextuais pré-resolvidas, adicionar seção "Comportamento Esperado", novo critério `commercial_tone_mismatch`, remover placeholders antigos.

## Changes

### `prompts/campaign-image-reviewer.md`
- Tabela de dados: removidos `{{discountedPrice}}` e `{{badgeText}}`; mantidos `{{storeName}}`, `{{productName}}`, `{{originalPrice}}`
- Nova **seção "## Comportamento Esperado"** com tabela de 5 variáveis contextuais:
  - `{{campaignIntentLabel}}`, `{{expectedPriceBehavior}}`, `{{expectedBadgeBehavior}}`, `{{expectedImageTreatment}}`, `{{expectedCommercialTone}}`
- **Critério 8: `commercial_tone_mismatch`** — critical se contradiz intent, minor se publicável
- Critério `wrong_price` agora referencia `{{expectedPriceBehavior}}` em vez de `{{discountedPrice}}`
- `{{validationContextSection}}` mantida
- Formato de resposta atualizado para listar `commercial_tone_mismatch` como type válido

## Verification
- TypeScript: Clean
- Tests: 4/4 passing (image-generation-service)
