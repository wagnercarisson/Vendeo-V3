## 1. Reviewer Intent-Aware — ImageReviewInput + Schema

- [x] 1.1 Estender `ImageReviewInput` com `campaignIntent?: CampaignIntent` (default `"offer"`), `preserveImageContext?: boolean`; tornar `badgeText`, `discountedPrice`, `originalPrice` opcionais
- [x] 1.2 Criar tipo union `ReviewIssueType` em `schema.ts` com todos os valores conhecidos; substituir `ReviewIssue.type: string` por `ReviewIssue.type: ReviewIssueType`
- [x] 1.3 Migrar `ImageReviewResult.failureType` de opcional (`?`: `undefined`) para `string | null` explícito; atualizar `parseResult()` para retornar `null` em vez de omitir o campo quando não há failureType; atualizar consumidores em `image-generation-service.ts` que checam `failureType`
- [x] 1.4 Adicionar `commercial_tone_mismatch` ao union `ReviewIssueType`
- [x] 1.5 Atualizar `ImageReviewService.review()` para montar variáveis contextuais em duas etapas: resolver placeholders comerciais → montar strings finais sem `{{...}}`
- [x] 1.6 Implementar lógica de `expectedBadgeBehavior` com três variantes (offer obrigatório, spotlight/exclusive com badge, spotlight/exclusive sem badge)
- [x] 1.7 Implementar lógica de `expectedPriceBehavior`, `expectedImageTreatment`, `expectedCommercialTone`, `campaignIntentLabel` por intent
- [x] 1.8 Garantir que `review()` nunca passa placeholders `{{discountedPrice}}` ou `{{badgeText}}` dentro das variáveis contextuais para o `PromptLoader`
- [x] 1.9 Alinhar `callVisionModel()` com o spec: quando modelo retorna conteúdo vazio, retornar `{ passed: false, failureType: "empty_review", issues: [...] }` em vez de lançar exceção. O catch atual em `ImageGenerationService` (linha 373) que trata erro como `review_error` continuará valendo para erros reais de API (timeout, auth), não para `empty_review`

## 2. Reviewer Intent-Aware — Prompt

- [x] 2.1 Reestruturar `prompts/campaign-image-reviewer.md`: substituir `{{discountedPrice}}`, `{{badgeText}}`, `{{originalPrice}}` por `{{campaignIntentLabel}}`, `{{expectedPriceBehavior}}`, `{{expectedBadgeBehavior}}`, `{{expectedImageTreatment}}`, `{{expectedCommercialTone}}`
- [x] 2.2 Adicionar seção "## Comportamento Esperado" no prompt com as variáveis contextuais
- [x] 2.3 Adicionar `commercial_tone_mismatch` como novo critério de inspeção no prompt, com regras de severidade por intent
- [x] 2.4 Remover menções diretas a `{{discountedPrice}}`/`{{badgeText}}` do corpo dos critérios (ex: critério `wrong_price`)
- [x] 2.5 Verificar que `validationContextSection` continua funcionando (seção condicional existente)

## 3. Reviewer Intent-Aware — Pipeline

- [x] 3.1 Atualizar `buildReviewInput` em `ImageGenerationService` (linha 357) para incluir `campaignIntent` e `preserveImageContext`
- [x] 3.2 Atualizar `validatePrompts` (linha 569) para incluir `campaignIntent` nas variáveis do reviewer
- [x] 3.3 Adicionar verificação em `validatePrompts`: confirmar que `campaignIntentLabel`, `expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone` estão presentes
- [x] 3.4 Adicionar verificação em `validatePrompts`: `{{discountedPrice}}` e `{{badgeText}}` NÃO devem aparecer no prompt do revisor
- [x] 3.5 Verificar `InputValidationService`: confirmar que nenhuma chamada presume preço ou badge (sem alteração de código)

## 4. Automação de Contrato/Drift — Testes

- [x] 4.1 Criar `src/__tests__/f31-3-review-quality-gate.test.ts` com testes de contrato: `ImageReviewInput` com `campaignIntent` default `"offer"` mantém compatibilidade; exclusive sem `discountedPrice` aceito
- [x] 4.2 Adicionar testes em `image-review-service.test.ts`: `review()` monta variáveis contextuais corretas para cada intent; prompt não contém placeholders vazios; `expectedBadgeBehavior` varia conforme badge presente/ausente
- [x] 4.3 Adicionar teste em `image-generation-service.test.ts`: `validatePrompts` valida prompt do revisor com `campaignIntent`; falha se variável contextual ausente; falha se placeholders antigos ainda no prompt
- [x] 4.4 Adicionar teste de regressão: cenário A (offer) com comportamento equivalente ao anterior
- [x] 4.5 Executar `npx vitest run`, `npm run typecheck`, `npm run build` — tudo limpo

## 5. UAT Real Conclusivo — 5 Cenários E2E

- [x] 5.1 **Cenário A** (offer — Padaria Pão & Cia, Bolo de Cenoura, DE R$ 39,90/POR R$ 29,90, badge "Promoção"): gerar com IA real, registrar evidência conforme micro-runbook, validar regressão de comportamento
- [x] 5.2 **Cenário B** (spotlight + badge — Moda & Estilo, Vestido Floral, R$ 149,90, badge "Novidade"): gerar, registrar, validar preço único sem DE/POR, copy de desejo
- [x] 5.3 **Cenário C** (spotlight sem badge — Pet Shop AuAu, Ração Premium, R$ 89,90, sem badge): gerar, registrar, validar preço único, sem badge, copy de qualidade
- [x] 5.4 **Cenário D** (exclusive sem badge, preserve — Flores & Encanto, Buquê de Rosas, sem preço, preserve=true): gerar, registrar, validar sem preço, fundo preservado, copy de exclusividade
- [x] 5.5 **Cenário E** (exclusive + badge, preserve — Confeitaria Doce Sonho, Bolo de Chocolate Belga, sem preço, badge "Exclusivo", preserve=true): gerar, registrar, validar sem preço, badge sutil, tom premium
- [x] 5.6 Consolidar evidências dos 5 cenários: prints ou links internos, parecer do revisor, parecer manual, motivo, indicação de retry
