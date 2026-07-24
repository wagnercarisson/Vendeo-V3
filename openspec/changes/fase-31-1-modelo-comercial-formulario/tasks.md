## 1. CampaignIntent Type + InputSnapshot

- [ ] 1.1 Adicionar `CampaignIntent = "offer" | "spotlight" | "exclusive"` em `src/lib/campaign/types.ts`
- [ ] 1.2 Adicionar `campaignIntent?: CampaignIntent` e `preserveImageContext?: boolean` na interface `InputSnapshot`

## 2. Schemas do Pipeline

- [ ] 2.1 Adicionar `campaignIntent: z.enum(["offer", "spotlight", "exclusive"]).optional().default("offer")` em `CampaignGenerationInputSchema` (`src/lib/campaign-intelligence/schema.ts`)
- [ ] 2.2 Adicionar `campaignIntent: z.enum(["offer", "spotlight", "exclusive"]).optional().default("offer")` e `preserveImageContext: z.boolean().optional()` em `GenerateImageRequestSchema` (`src/lib/image-generation/schema.ts`)

## 3. BADGE_OPTIONS_BY_INTENT

- [ ] 3.1 Criar `BADGE_OPTIONS_BY_INTENT: Record<CampaignIntent, readonly string[]>` em `src/lib/constants.ts` com badges para offer, spotlight e exclusive
- [ ] 3.2 Manter `BADGE_OPTIONS` como referência para `BADGE_OPTIONS_BY_INTENT["offer"]` (compatibilidade retroativa)
- [ ] 3.3 Atualizar `BadgeOption` type se necessário

## 4. Form State — CampaignFormFields

- [ ] 4.1 Alterar `CampaignFormFields.discountedPriceCents` para `number | undefined` (opcional no form)
- [ ] 4.2 Adicionar `campaignIntent: CampaignIntent` e `preserveImageContext: boolean` em `CampaignFormFields`
- [ ] 4.3 Atualizar `FieldErrors` e `EMPTY_FIELDS` com os novos campos
- [ ] 4.4 Atualizar touched initial state com os novos campos

## 5. Inferência de Intent

- [ ] 5.1 Implementar função `inferIntent(originalPriceCents: number, discountedPriceCents: number | undefined | null): CampaignIntent` com normalização de undefined/null para 0; lógica: DE+POR → offer, só preço → spotlight, sem preço → exclusive
- [ ] 5.2 Integrar `inferIntent` no `useCampaignForm` — chamar sempre que `originalPriceCents` ou `discountedPriceCents` mudar
- [ ] 5.3 Garantir que o seletor de intent sincronize com a inferência automática

## 6. Validação Condicional

- [ ] 6.1 Modificar `validateDiscountedPrice`: bloquear apenas quando `campaignIntent === "offer"` e preço vazio
- [ ] 6.2 Modificar `validateBadge`: usar `BADGE_OPTIONS_BY_INTENT[campaignIntent]` e tornar opcional para spotlight/exclusive
- [ ] 6.3 Atualizar `validateField` dispatch para novos campos
- [ ] 6.4 Atualizar `isValid` no hook para considerar intenção comercial e bloqueio de spotlight/exclusive

## 7. UI — Seletor de Intent

- [ ] 7.1 Criar componente IntentSelector: radio group com opções filtradas, indicador "Em breve" para spotlight/exclusive
- [ ] 7.2 Adicionar IntentSelector no `campaign-input-form.tsx` entre badge select e botão "Criar Campanha"
- [ ] 7.3 Passar `campaignIntent` e `setField("campaignIntent")` para o seletor
- [ ] 7.4 Bloquear submit quando intent !== "offer" com tooltip "Disponível em breve"

## 8. UI — Badge Condicional

- [ ] 8.1 Modificar badge select em `campaign-input-form.tsx` para usar `BADGE_OPTIONS_BY_INTENT[campaignIntent]` em vez de `BADGE_OPTIONS`
- [ ] 8.2 Resetar badge para vazio quando intent muda e o badge atual não pertence à nova lista
- [ ] 8.3 Adicionar opção vazia ("Nenhum") no select para spotlight/exclusive

## 9. UI — Checkbox Preserve Image Context

- [ ] 9.1 Adicionar checkbox "Preservar imagem original" no `campaign-input-form.tsx`
- [ ] 9.2 Renderizar checkbox apenas quando `campaignIntent !== "offer"` (invisível para offer)
- [ ] 9.3 Resetar `preserveImageContext` para `false` quando intent muda para offer

## 10. Submit — Transporte no Body

- [ ] 10.1 Incluir `campaignIntent` e `preserveImageContext` no body de `handleSubmit` em `useCampaignForm`
- [ ] 10.2 Garantir que `preserveImageContext` seja omitido (ou `false`) quando `campaignIntent === "offer"`
- [ ] 10.3 Bloquear serialização/submissão quando intent não for "offer" — exibir mensagem "Disponível em breve"

## 11. Pipeline — Guard + InputSnapshot

- [ ] 11.1 Adicionar guard no pré-stream: se `body.campaignIntent` presente e !== "offer", retornar HTTP 400 com mensagem "Intenção comercial indisponível. Apenas ofertas podem ser geradas no momento." (antes de criar campanha ou consumir crédito)
- [ ] 11.2 Incluir `campaignIntent` e `preserveImageContext` do body no `inputSnapshot`
- [ ] 11.3 Aplicar normalização: se `campaignIntent === "offer"`, `preserveImageContext` = false (ou omitido)

## 12. Component Types — CampaignInput

- [ ] 12.1 Verificar que `CampaignInput` (Omit<GenerateImageRequest, 'storeId'>) em `src/components/campaign/types.ts` herda automaticamente os novos campos via tipo — sem mudança manual necessária

## 13. Testes de Inferência

- [ ] 13.1 Criar teste: `inferIntent` com DE+POR → "offer"
- [ ] 13.2 Criar teste: `inferIntent` com só preço → "spotlight"
- [ ] 13.3 Criar teste: `inferIntent` sem preço (undefined/null) → "exclusive"
- [ ] 13.4 Criar teste: `inferIntent` com ambos preços zerados (0, 0) → "exclusive"

## 14. Testes de Validação

- [ ] 14.1 Criar teste: DE+POR com intent spotlight → bloqueado no submit
- [ ] 14.2 Criar teste: preço original sem preço com desconto → erro (quando intent=offer)
- [ ] 14.3 Criar teste: intent=offer sem badge → erro de validação
- [ ] 14.4 Criar teste: intent=spotlight sem badge → sem erro de validação

## 15. Testes de Badge Condicional

- [ ] 15.1 Criar teste: trocar intent de offer para spotlight limpa badge inválido
- [ ] 15.2 Criar teste: trocar intent de spotlight para exclusive (badge "Destaque da Semana") limpa badge por incompatibilidade

## 16. Testes de preserveImageContext

- [ ] 16.1 Criar teste: preserveImageContext invisível em offer
- [ ] 16.2 Criar teste: preserveImageContext visível em spotlight
- [ ] 16.3 Criar teste: preserveImageContext reset ao voltar para offer

## 17. Testes de Schema

- [ ] 17.1 Criar teste: `GenerateImageRequestSchema` aceita `campaignIntent` e `preserveImageContext` opcionais
- [ ] 17.2 Criar teste: `GenerateImageRequestSchema` mantém `discountedPriceCents` required
- [ ] 17.3 Criar teste: `CampaignGenerationInputSchema` default `campaignIntent` = "offer"
- [ ] 17.4 Criar teste: `GenerateImageRequestSchema` default `campaignIntent` = "offer" quando omitido

## 18. Testes de Pipeline Guard

- [ ] 18.1 Criar teste: request com `campaignIntent: "spotlight"` → HTTP 400 antes de criar campanha
- [ ] 18.2 Criar teste: request com `campaignIntent: "exclusive"` → HTTP 400 antes de criar campanha
- [ ] 18.3 Criar teste: request sem `campaignIntent` → pipeline prossegue normalmente (default offer)

## 19. Verificação Final

- [ ] 19.1 Executar `npx vitest run` — testes existentes + novos passando
- [ ] 19.2 Executar `npm run typecheck` — zero erros
- [ ] 19.3 Executar `npm run lint` — zero erros
- [ ] 19.4 Executar `npm run build` — build bem-sucedido
