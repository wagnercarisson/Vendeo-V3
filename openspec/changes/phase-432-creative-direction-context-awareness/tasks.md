## 1. Input Validation — Inferência de Categoria do Produto

- [ ] 1.1 Estender o prompt `campaign-input-visual-check.md` para solicitar `inferredCategory` no JSON de resposta
- [ ] 1.2 Adicionar `inferredCategory?: string` ao tipo `InputValidationResult` no schema
- [ ] 1.3 Atualizar `InputValidationService.parseResult()` para extrair `inferredCategory` do retorno do modelo
- [ ] 1.4 Propagar `inferredCategory` pelo pipeline: `InputValidationService.validate()` → `ImageGenerationService.generateImage()`

## 2. Creative Direction — Evolução do Prompt e Context Awareness

- [ ] 2.1 Adicionar seções de direção criativa contextual ao final do `campaign-image-director.md` (persona, categoria inferida, conflito segmento×categoria, repertório comercial)
- [ ] 2.2 Implementar `ImageGenerationService.buildCommercialRepertoire()` — extrai argumentos comercialmente acionáveis de `additionalDetails`, `availabilityNotes`, `validity` e `campaignDetails`
- [ ] 2.3 Implementar `ImageGenerationService.buildValidationSummary()` — resumo sanitizado da validação para incluir no prompt
- [ ] 2.4 Estender `ImageGenerationService.buildPromptVariables()` com as novas variáveis de direção criativa (`creativePersona`, `inferredCategory`, `hasCategoryConflict`, `categoryConflictDirective`, `commercialRepertoire`, `inputValidationSummary`)
- [ ] 2.5 Atualizar `ImageGenerationService.assemblePrompt()` para usar o prompt evoluído com as novas variáveis

## 3. Validation → Review Alignment

- [ ] 3.1 Definir tipo `ValidationContext` com `inputCorrection`, `allowedConflicts`, `overrides`
- [ ] 3.2 Estender `ImageReviewInput` com campo `validationContext?: ValidationContext`
- [ ] 3.3 Implementar `applyValidationContextToReviewResult(result, context): ImageReviewResult` como função pura
- [ ] 3.4 Integrar chamada de `applyValidationContextToReviewResult()` no `ImageGenerationService.generateImage()` imediatamente após `this.imageReview.review()`
- [ ] 3.5 Atualizar o prompt `campaign-image-reviewer.md` para incluir seção de contexto de validação (nome corrigido, overrides do usuário)
- [ ] 3.6 Passar `validationContext` na chamada a `this.imageReview.review()` dentro do pipeline

## 4. Eventos Técnicos Sanitizados (Carryover Detalhes Técnicos)

- [ ] 4.1 Emitir `detail` sanitizado no fim da fase `input_validation` com classificação e nome corrigido (se houver)
- [ ] 4.2 Emitir `detail` sanitizado no fim da fase `prompt_assembly` com persona e categoria inferida
- [ ] 4.3 Emitir `detail` sanitizado no início da fase `image_generation` em cada tentativa (tentativa N/N, modelo, tempo decorrido)
- [ ] 4.4 Emitir `detail` sanitizado no fim da fase `quality_review` com resumo de issues encontradas
- [ ] 4.5 Emitir `detail` sanitizado na fase `done` com métricas finais (tempo total, tentativas, correções aplicadas)

## 5. Verificação e Testes

- [ ] 5.1 Verificar se o painel "Detalhes técnicos" aparece durante toda geração com os novos eventos
- [ ] 5.2 Testar fluxo com produto de categoria diferente do segmento da loja (ex: loja de moda + energético)
- [ ] 5.3 Testar fluxo de auto-fix na validação: revisão não deve reportar nome corrigido como erro
- [ ] 5.4 Testar fluxo de override: revisão não deve reportar conflito produto×imagem como erro
- [ ] 5.5 Testar fluxo de `generated_product_mismatch`: deve continuar bloqueando mesmo com override
- [ ] 5.6 Testar fallback: se `inferredCategory` não for retornado, comportamento deve ser idêntico ao anterior

## 6. Gates Técnicos

- [ ] 6.1 Rodar validação OpenSpec da mudança (`openspec validate --change phase-432-creative-direction-context-awareness`)
- [ ] 6.2 Rodar `npm run typecheck`
- [ ] 6.3 Rodar `npm run lint`
- [ ] 6.4 Rodar `npm run build`
- [ ] 6.5 Confirmar que nenhuma alteração de banco foi necessária
- [ ] 6.6 Atualizar tasks.md com os itens concluídos antes do complete/archive
