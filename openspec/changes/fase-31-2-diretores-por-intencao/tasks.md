## 1. Contratos — Schemas Tolerantes por Intent

- [x] 1.1 `GenerateImageRequestSchema`: `discountedPriceCents` → `z.number().int().positive().optional()` (image-generation/schema.ts:12)
- [x] 1.2 `CampaignGenerationInputSchema`: `discountedPriceCents` → `z.number().int().positive().optional()` (campaign-intelligence/schema.ts:15-18)
- [x] 1.3 `CampaignSpecSchema`: `discounted_price_display` e `badge_text` → `z.string().nullable()` (campaign-intelligence/schema.ts:49-54)
- [x] 1.4 `InputSnapshot`: `discountedPriceCents` → `number | undefined` (campaign/types.ts:37)
- [x] 1.5 `MockProvider`: adaptar `offer.discounted_price_display` e `badge_text` para aceitar `null`
- [x] 1.6 `npx tsc --noEmit` — verificar sem erros após mudanças de schema

## 2. Desbloqueio — Remover Bloqueios de Intent

- [x] 2.1 UI `campaign-input-form.tsx:239-243`: remover badge "Em breve" do IntentSelector
- [x] 2.2 UI `campaign-input-form.tsx:523`: remover `fields.campaignIntent !== "offer"` do disabled do botão
- [x] 2.3 UI `campaign-input-form.tsx:540-541`: remover condicional "Disponível em breve" no texto do botão
- [x] 2.4 Form `use-campaign-form.ts:560-563`: remover guard early-return do handleSubmit para non-offer
- [x] 2.5 Route `route.ts:142-147`: remover guard HTTP 400 para `campaignIntent !== "offer"`
- [x] 2.6 Route `route.ts:149`: adicionar validação de offer — se `campaignIntent === "offer"` e `discountedPriceCents` ausente/zero, retornar HTTP 400
- [x] 2.7 Route `route.ts:149`: adicionar normalização de exclusive — se `campaignIntent === "exclusive"` e `discountedPriceCents` presente, normalizar para `undefined` com log
- [x] 2.8 `npx tsc --noEmit` — verificar sem erros

## 3. Prompts — 6 Templates por Intent

- [x] 3.1 `prompts/campaign-image-director-offer.md` — cópia do `campaign-image-director.md` atual (sem alterações) + `{{preserveImageDirective}}`
- [x] 3.2 `prompts/campaign-image-director-spotlight.md` — novo: vitrine, preço único opcional, badge opcional, sem urgência + `{{preserveImageDirective}}`
- [x] 3.3 `prompts/campaign-image-director-exclusive.md` — novo: sem preço, exclusividade, valor percebido, badge opcional + `{{preserveImageDirective}}`
- [x] 3.4 `prompts/campaign-copy-director-offer.md` — baseado no atual, trocando `{{offer}}` por `{{commercialFrame}}`
- [x] 3.5 `prompts/campaign-copy-director-spotlight.md` — novo: novidade/destaque, benefício, sem urgência
- [x] 3.6 `prompts/campaign-copy-director-exclusive.md` — novo: exclusividade, valor percebido, sem preço

## 4. Roteamento — ImageGenerationService

- [x] 4.1 `buildPromptVariables()`: adicionar `campaignIntent`, `preserveImageDirective`, `commercialFrame`, `discountedPrice` condicional às variáveis
- [x] 4.2 `assemblePrompt()`: carregar `campaign-image-director-${campaignIntent}`; sem fallback — prompt ausente = preflight falha
- [x] 4.3 `validatePrompts()`: validar `campaign-image-director-${campaignIntent}`; falhar se não existir; `discountedPrice` vazio para exclusive no reviewer
- [x] 4.4 `npx tsc --noEmit` — verificar sem erros

## 5. Roteamento — Copy Director

- [x] 5.1 `CopyDirectorInputSchema`: adicionar `campaignIntent: z.enum([...]).optional().default("offer")`; substituir `offer` por `commercialFrame: z.string().min(1)`
- [x] 5.2 `CopyDirectorService.generateCopy()`: carregar `campaign-copy-director-${input.campaignIntent}`; sem fallback silencioso
- [x] 5.3 `buildCommercialFrame()` (ex-`buildOfferText`): implementar por intent — offer="de X por Y", spotlight="R$ X"/vazio, exclusive=sem preço
- [x] 5.4 `mapBriefToCopyDirectorInput()`: montar `commercialFrame` por intent; propagar `campaignIntent` no retorno
- [x] 5.5 `npx tsc --noEmit` — verificar sem erros

## 6. Adaptação de Conteúdo

- [x] 6.1 `buildCommercialRepertoire()`: filtrar escassez e validade por intent (offer: sim, spotlight: não, exclusive: só escassez)
- [x] 6.2 `buildCreativeContextGuidance()`: substituir framing de preço por benefício (spotlight) ou valor percebido (exclusive)
- [x] 6.3 `buildDeterministicCopy()`: implementar fallback determinístico por intent (route.ts:380-394)
- [x] 6.4 `npx tsc --noEmit` — verificar sem erros

## 7. Testes

- [x] 7.1 Teste: `GenerateImageRequestSchema` aceita `spotlight` sem `discountedPriceCents`
- [x] 7.2 Teste: `GenerateImageRequestSchema` aceita `exclusive` sem `discountedPriceCents`
- [x] 7.3 Teste: `CampaignSpecSchema` aceita `discounted_price_display: null` para exclusive
- [x] 7.4 Teste: `CampaignSpecSchema` aceita `badge_text: null` para spotlight
- [x] 7.5 Teste: Endpoint aceita `campaignIntent: "spotlight"` (sem HTTP 400)
- [x] 7.6 Teste: Endpoint aceita `campaignIntent: "exclusive"` (sem HTTP 400)
- [x] 7.7 Teste: exclusive com preço → normalizado para ausente (com log)
- [x] 7.8 Teste: offer sem `discountedPriceCents` → retorna HTTP 400
- [x] 7.9 Teste: `CopyDirectorInputSchema` rejeita `commercialFrame: ""`
- [x] 7.10 Teste: offer sem regressão — mesmo input → mesmo output
- [x] 7.11 Teste: `CopyDirectorService` carrega prompt correto por intent
- [x] 7.12 Teste: `assemblePrompt` falha no preflight se prompt de intent válida não existe
- [x] 7.13 Teste: `buildDeterministicCopy` gera texto diferente por intent
- [x] 7.14 Teste: `buildCommercialFrame` retorna "de X por Y" para offer, "R$ X" para spotlight, sem preço para exclusive

## 8. Verificação Final

- [x] 8.1 `npx vitest run` — 130 test files, 1056 tests, todos passando
- [x] 8.2 `npm run typecheck` — zero erros
- [x] 8.3 `npm run lint` — zero erros
- [x] 8.4 `npm run build` — compila com sucesso
