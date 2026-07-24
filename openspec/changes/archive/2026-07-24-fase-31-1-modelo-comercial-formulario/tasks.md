## 1. CampaignIntent Type + InputSnapshot

- [x] 1.1 Adicionar `CampaignIntent = "offer" | "spotlight" | "exclusive"` em `src/lib/campaign/types.ts` — `src/lib/campaign/types.ts:1`
- [x] 1.2 Adicionar `campaignIntent?: CampaignIntent` e `preserveImageContext?: boolean` na interface `InputSnapshot` — `src/lib/campaign/types.ts:51,53`

## 2. Schemas do Pipeline

- [x] 2.1 Adicionar `campaignIntent: z.enum(["offer", "spotlight", "exclusive"]).optional().default("offer")` em `CampaignGenerationInputSchema` (`src/lib/campaign-intelligence/schema.ts`) — `src/lib/campaign-intelligence/schema.ts:19-22`
- [x] 2.2 Adicionar `campaignIntent: z.enum(["offer", "spotlight", "exclusive"]).optional().default("offer")` e `preserveImageContext: z.boolean().optional()` em `GenerateImageRequestSchema` (`src/lib/image-generation/schema.ts`) — `src/lib/image-generation/schema.ts:13-17`

## 3. BADGE_OPTIONS_BY_INTENT

- [x] 3.1 Criar `BADGE_OPTIONS_BY_INTENT: Record<CampaignIntent, readonly string[]>` em `src/lib/constants.ts` com badges para offer, spotlight e exclusive — `src/lib/constants.ts:185-189`
- [x] 3.2 Manter `BADGE_OPTIONS` como referência para `BADGE_OPTIONS_BY_INTENT["offer"]` (compatibilidade retroativa) — `src/lib/constants.ts:191`
- [x] 3.3 Atualizar `BadgeOption` type se necessário — já deriva de `BADGE_OPTIONS_OFFER` em `src/lib/constants.ts:193` (sem mudança necessária)

## 4. Form State — CampaignFormFields

- [x] 4.1 Alterar `CampaignFormFields.discountedPriceCents` para `number | undefined` (opcional no form) — `src/components/flow/use-campaign-form.ts:79`
- [x] 4.2 Adicionar `campaignIntent: CampaignIntent` e `preserveImageContext: boolean` em `CampaignFormFields` — `src/components/flow/use-campaign-form.ts:81-82`
- [x] 4.3 Atualizar `FieldErrors` e `EMPTY_FIELDS` com os novos campos — `src/components/flow/use-campaign-form.ts:87-100,133-143`
- [x] 4.4 Atualizar touched initial state com os novos campos — `src/components/flow/use-campaign-form.ts:223-233`

## 5. Inferência de Intent

- [x] 5.1 Implementar função `inferIntent(originalPriceCents: number, discountedPriceCents: number | undefined | null): CampaignIntent` — `src/components/flow/use-campaign-form.ts:208-218`
- [x] 5.2 Integrar `inferIntent` no `useCampaignForm` — `src/components/flow/use-campaign-form.ts:295-326`
- [x] 5.3 Garantir que o seletor de intent sincronize com a inferência automática — `src/components/flow/use-campaign-form.ts:300-326` (via `userChangedIntent` ref e auto-inference no `useEffect`)

## 6. Validação Condicional

- [x] 6.1 Modificar `validateDiscountedPrice`: bloquear apenas quando `campaignIntent === "offer"` e preço vazio — `src/components/flow/use-campaign-form.ts:152-163`
- [x] 6.2 Modificar `validateBadge`: usar `BADGE_OPTIONS_BY_INTENT[campaignIntent]` e tornar opcional para spotlight/exclusive — `src/components/flow/use-campaign-form.ts:166-173`
- [x] 6.3 Atualizar `validateField` dispatch para novos campos — `src/components/flow/use-campaign-form.ts:188-206` (campaignIntent e preserveImageContext caem no default → null)
- [x] 6.4 Atualizar `isValid` no hook para considerar intenção comercial e bloqueio de spotlight/exclusive — `src/components/flow/use-campaign-form.ts:696-709`

## 7. UI — Seletor de Intent

- [x] 7.1 Criar componente IntentSelector: radio group com opções filtradas, indicador "Em breve" para spotlight/exclusive — `src/components/flow/campaign-input-form.tsx:195-249`
- [x] 7.2 Adicionar IntentSelector no `campaign-input-form.tsx` entre badge select e botão "Criar Campanha" — `src/components/flow/campaign-input-form.tsx:459`
- [x] 7.3 Passar `campaignIntent` e `setField("campaignIntent")` para o seletor — `src/components/flow/campaign-input-form.tsx:460-461`
- [x] 7.4 Bloquear submit quando intent !== "offer" com tooltip "Disponível em breve" — `src/components/flow/campaign-input-form.tsx:523,525-526,540-541`

## 8. UI — Badge Condicional

- [x] 8.1 Modificar badge select em `campaign-input-form.tsx` para usar `BADGE_OPTIONS_BY_INTENT[campaignIntent]` — `src/components/flow/campaign-input-form.tsx:445`
- [x] 8.2 Resetar badge para vazio quando intent muda e o badge atual não pertence à nova lista — `src/components/flow/use-campaign-form.ts:329-332`
- [x] 8.3 Adicionar opção vazia ("Nenhum") no select para spotlight/exclusive — `src/components/flow/campaign-input-form.tsx:442-443`

## 9. UI — Checkbox Preserve Image Context

- [x] 9.1 Adicionar checkbox "Preservar imagem original" no `campaign-input-form.tsx` — `src/components/flow/campaign-input-form.tsx:475-488`
- [x] 9.2 Renderizar checkbox apenas quando `campaignIntent !== "offer"` — `src/components/flow/campaign-input-form.tsx:475`
- [x] 9.3 Resetar `preserveImageContext` para `false` quando intent muda para offer — `src/components/flow/use-campaign-form.ts:334-335`

## 10. Submit — Transporte no Body

- [x] 10.1 Incluir `campaignIntent` e `preserveImageContext` no body de `handleSubmit` — `src/components/flow/use-campaign-form.ts:638-639`
- [x] 10.2 Garantir que `preserveImageContext` seja omitido (ou `false`) quando `campaignIntent === "offer"` — `src/components/flow/use-campaign-form.ts:639-641`
- [x] 10.3 Bloquear serialização/submissão quando intent não for "offer" — `src/components/flow/use-campaign-form.ts:560-563`

## 11. Pipeline — Guard + InputSnapshot

- [x] 11.1 Adicionar guard no pré-stream: HTTP 400 se `campaignIntent !== "offer"` — `src/app/api/campaign/generate-image/route.ts:142-147`
- [x] 11.2 Incluir `campaignIntent` e `preserveImageContext` no `inputSnapshot` — `src/app/api/campaign/generate-image/route.ts:294-297`
- [x] 11.3 Normalização: `preserveImageContext = false` quando `campaignIntent === "offer"` — `src/app/api/campaign/generate-image/route.ts:295-297`

## 12. Component Types — CampaignInput

- [x] 12.1 `CampaignInput` (`Omit<GenerateImageRequest, 'storeId'>`) herda automaticamente os novos campos — `src/components/campaign/types.ts:35` (sem mudança manual necessária)

## 13. Testes de Inferência

- [x] 13.1 `inferIntent` com DE+POR → "offer" — `src/components/flow/__tests__/intent-inference.test.ts`
- [x] 13.2 `inferIntent` com só preço → "spotlight" — `src/components/flow/__tests__/intent-inference.test.ts`
- [x] 13.3 `inferIntent` sem preço (undefined/null) → "exclusive" — `src/components/flow/__tests__/intent-inference.test.ts`
- [x] 13.4 `inferIntent` com ambos preços zerados (0, 0) → "exclusive" — `src/components/flow/__tests__/intent-inference.test.ts`

## 14. Testes de Validação

- [x] 14.1 DE+POR com intent spotlight → bloqueado no submit — `src/components/flow/__tests__/intent-validation.test.ts`
- [x] 14.2 preço original sem preço com desconto → erro (quando intent=offer) — `src/components/flow/__tests__/intent-validation.test.ts`
- [x] 14.3 intent=offer sem badge → erro de validação — `src/components/flow/__tests__/intent-validation.test.ts`
- [x] 14.4 intent=spotlight sem badge → sem erro de validação — `src/components/flow/__tests__/intent-validation.test.ts`

## 15. Testes de Badge Condicional

- [x] 15.1 trocar intent de offer para spotlight limpa badge inválido — `src/components/flow/__tests__/intent-badge-preserve.test.ts`
- [x] 15.2 trocar intent de spotlight para exclusive limpa badge por incompatibilidade — `src/components/flow/__tests__/intent-badge-preserve.test.ts`

## 16. Testes de preserveImageContext

- [x] 16.1 preserveImageContext invisível em offer — `src/components/flow/__tests__/intent-badge-preserve.test.ts`
- [x] 16.2 preserveImageContext visível em spotlight — `src/components/flow/__tests__/intent-badge-preserve.test.ts`
- [x] 16.3 preserveImageContext reset ao voltar para offer — `src/components/flow/__tests__/intent-badge-preserve.test.ts`

## 17. Testes de Schema

- [x] 17.1 `GenerateImageRequestSchema` aceita `campaignIntent` e `preserveImageContext` opcionais — `src/__tests__/api/campaign-intent-guard.test.ts`
- [x] 17.2 `GenerateImageRequestSchema` mantém `discountedPriceCents` required — `src/__tests__/api/campaign-intent-guard.test.ts`
- [x] 17.3 `CampaignGenerationInputSchema` default `campaignIntent` = "offer" — `src/__tests__/api/campaign-intent-guard.test.ts`
- [x] 17.4 `GenerateImageRequestSchema` default `campaignIntent` = "offer" quando omitido — `src/__tests__/api/campaign-intent-guard.test.ts`

## 18. Testes de Pipeline Guard

- [x] 18.1 request com `campaignIntent: "spotlight"` → HTTP 400 — `src/__tests__/api/campaign-intent-guard.test.ts`
- [x] 18.2 request com `campaignIntent: "exclusive"` → HTTP 400 — `src/__tests__/api/campaign-intent-guard.test.ts`
- [x] 18.3 request sem `campaignIntent` → pipeline prossegue normalmente (default offer) — `src/__tests__/api/campaign-intent-guard.test.ts`

## 19. Verificação Final

- [x] 19.1 `npx vitest run` — 1036/1036 testes passando ✅
- [x] 19.2 `npx tsc --noEmit` — zero erros ✅
- [x] 19.3 `npx next lint` — zero erros ✅
- [x] 19.4 `npx next build` — compilado com sucesso ✅
