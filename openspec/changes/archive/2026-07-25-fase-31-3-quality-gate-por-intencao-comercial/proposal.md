## Why

O `ImageReviewService` e seu prompt `campaign-image-reviewer.md` continuam calibrados exclusivamente para campanha promocional (`offer`). Esperam preço com desconto, badge promocional, CTA de urgência. Para `spotlight` e `exclusive`, isso gera falsos negativos (rejeitar exclusive por "falta de preço") e falso rigor promocional (criticar spotlight por não ter DE/POR). Sem esta fase, campanhas não-promocionais geradas pelos diretores da F31.2 são barradas na revisão de qualidade — o que torna `spotlight` e `exclusive` não-publicáveis de fato.

## What Changes

1. `ImageReviewInput` recebe `campaignIntent?: CampaignIntent` (default "offer") e `preserveImageContext?: boolean`; `badgeText`, `discountedPrice`, `originalPrice` tornam-se opcionais
2. Prompt `campaign-image-reviewer.md` reestruturado: recebe variáveis contextuais pré-resolvidas (`expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone`, `campaignIntentLabel`) — elimina placeholders vazios no prompt
3. `ImageReviewService.review()` monta as variáveis contextuais em duas etapas: resolve placeholders comerciais → monta strings finais sem `{{...}}`
4. `expectedBadgeBehavior` tem três variantes por intent (offer obrigatório / spotlight/exclusive com badge / spotlight/exclusive sem badge) — o serviço escolhe a correta
5. Novo tipo de issue `commercial_tone_mismatch` adicionado ao prompt e ao `ImageReviewResult` — `minor` se peça ainda publicável, `critical` se contradiz intent ou inventa condição comercial
6. `validatePrompts` testa o prompt do revisor com variáveis de intent; verifica que variáveis contextuais estão presentes e que placeholders antigos (`discountedPrice`, `badgeText`) não estão no corpo dos critérios
7. 5 cenários E2E executados com IA real (não mock): A (offer regressão), B (spotlight + badge), C (spotlight sem badge), D (exclusive sem badge, preserve), E (exclusive + badge, preserve), cada um com evidência auditável conforme micro-runbook
8. `InputValidationService` verificado quanto à ausência de presunção de preço/badge — sem alteração de código

**Nenhuma mudança breaking.** `campaignIntent` em `ImageReviewInput` é opcional com default "offer", mantendo compatibilidade com chamadas existentes.

## Capabilities

### New Capabilities

- `intent-aware-review`: Serviço de revisão de qualidade adaptado por intenção comercial. Define como o `ImageReviewService` recebe `campaignIntent`, monta variáveis contextuais no prompt, e avalia a imagem contra expectativas específicas de `offer`, `spotlight` e `exclusive`. Inclui o novo tipo de issue `commercial_tone_mismatch`.

### Modified Capabilities

- `image-quality-review`: `ImageReviewInput` ganha `campaignIntent` e `preserveImageContext`; `badgeText`, `discountedPrice`, `originalPrice` tornam-se opcionais; prompt muda de variáveis diretas para variáveis contextuais pré-resolvidas; novo issue type `commercial_tone_mismatch`
- `validation-review-alignment`: `commercial_tone_mismatch` adicionado à lista de issues que nunca são removidas por override; `applyValidationContextToReviewResult` reconhece o novo tipo
- `prompt-templates-by-intent`: A nota "reviewer permanece único — sem validação por intent (F31.3)" é substituída pela especificação de como o reviewer é adaptado por intent via variáveis contextuais

## Impact

- **Código**: `src/lib/image-generation/services/image-review-service.ts` — lógica de montagem de variáveis contextuais; `prompts/campaign-image-reviewer.md` — reestruturação completa; `src/lib/image-generation/services/image-generation-service.ts` — `buildReviewInput` e `validatePrompts` adaptados; `src/lib/image-generation/schema.ts` — tipo `ReviewIssueType` estendido
- **Testes**: `src/lib/image-generation/services/__tests__/image-review-service.test.ts` (novos testes de intent); `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` (validatePrompts com intent); `src/__tests__/f31-3-review-quality-gate.test.ts` (novo arquivo de regressão de contrato)
- **Prompts**: `campaign-image-reviewer.md` — reestruturado com seções de comportamento esperado por intent
- **Nenhuma dependência nova**: usa OpenAI existente via `PromptLoader`
