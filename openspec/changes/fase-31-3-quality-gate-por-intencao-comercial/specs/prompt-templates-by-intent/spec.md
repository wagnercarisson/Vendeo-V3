## MODIFIED Requirements

### Requirement: validatePrompts valida director por intent com reviewer intent-aware

O sistema SHALL validar o prompt correto em `ImageGenerationService.validatePrompts()` usando `campaign-image-director-${brief.campaignInput.campaignIntent}`.

Se o prompt não existir, `validatePrompts` retorna `{ valid: false, errors: [...] }`.

O reviewer (`campaign-image-reviewer.md`) é único e intent-aware via variáveis contextuais. O `validatePrompts` SHALL:
- Incluir `campaignIntent` nas variáveis do reviewer
- Verificar que `campaignIntentLabel`, `expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone` estão presentes
- Verificar que placeholders antigos (`{{discountedPrice}}`, `{{badgeText}}`) NÃO estão no corpo dos critérios
- Testar o prompt do revisor com cada intent (offer, spotlight, exclusive) para garantir que não há placeholders não resolvidos

#### Scenario: validatePrompts valida prompt correto por intent

- **WHEN** `validatePrompts()` é chamado com brief de intent "exclusive"
- **THEN** valida `campaign-image-director-exclusive.md`
- **AND** valida `campaign-image-reviewer.md` com variáveis contextuais de exclusive
- **AND** `reviewerVars` contém `expectedPriceBehavior` já resolvido como "A imagem NÃO deve exibir preço. Qualquer preço inventado é problema CRÍTICO."
- **AND** `reviewerVars` NÃO contém `discountedPrice` como placeholder — o valor não é passado ao prompt; o que chega é a expectativa já traduzida em linguagem natural
- **AND** `validatePrompts` confirma que `{{discountedPrice}}` não aparece no prompt final

#### Scenario: validatePrompts falha se variável contextual está ausente

- **WHEN** `validatePrompts()` monta as variáveis do reviewer
- **AND** `campaignIntentLabel` ou `expectedPriceBehavior` está ausente
- **THEN** `validatePrompts` retorna `{ valid: false, errors: [...] }`

#### Scenario: validatePrompts verifica que placeholders antigos não estão no prompt

- **WHEN** `validatePrompts()` carrega `campaign-image-reviewer.md`
- **THEN** verifica que `{{discountedPrice}}` e `{{badgeText}}` NÃO aparecem no corpo dos critérios
- **AND** reporta erro se esses placeholders ainda existirem no prompt
