## 1. Tipos e contratos

- [ ] 1.1 Atualizar `StoreIdentitySnapshot`: adicionar `identityState: IdentityState` e `signature: { url, type }`, remover `logoUrl`, `visualSignatureUrl`, `visualSignatureType`
- [ ] 1.2 Atualizar `BrandProfileSnapshot`: remover `logoVariantUrl`
- [ ] 1.3 Criar tipo `CampaignBrief` com `campaignInput`, `store`, `brandProfile`, `identity`

## 2. Resolução de identidade (backend)

- [ ] 2.1 Reescrever `resolveStoreIdentity(storeId)` como pipeline declarativo: ler `identity_state`, buscar brand profile `synced`, buscar asset conforme estado
- [ ] 2.2 Implementar degradação segura: se asset esperado está ausente → `signature.url = null`, log de diagnóstico, estado não alterado
- [ ] 2.3 Implementar `validateIdentityReference(snapshot)`: fetch HEAD/GET com timeout, retorna cópia com `signature.url = null` se falhar
- [ ] 2.4 Implementar `buildCampaignBrief(snapshot, campaignInput)`: deriva directive dos 5 cenários, monta `CampaignBrief` com `campaignInput` pass-through

## 3. GET /api/store/:id enriquecido

- [ ] 3.1 Modificar `GET /api/store/[id]/route.ts` para retornar `{ ...store, identity: StoreIdentitySnapshot }` em uma passada
- [ ] 3.2 Remover chamada a `resolveStoreIdentity` de `CampaignPageClient` e `StoreIdentityBlock` — consumir `identity` do GET response

## 4. Schema e endpoint de geração

- [ ] 4.1 Reformular `GenerateImageRequestSchema`: adicionar `storeId`, remover `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, `brandProfile`
- [ ] 4.2 Atualizar `POST /api/campaign/generate-image/route.ts`: receber `storeId`, chamar `resolveStoreIdentity` → `validateIdentityReference` → `buildCampaignBrief` → `ImageGenerationService.generateImage(CampaignBrief)`
- [ ] 4.3 Incluir `storeIdentity` no `type: "result"` event do NDJSON stream

## 5. Provider e prompt

- [ ] 5.1 Renomear `logoImageUrl` para `identityImageUrl` em `ImageProviderInput` e em `OpenAIImageProvider`
- [ ] 5.2 No `OpenAIImageProvider`: enviar `identityImageUrl` como `input_image` no Responses API (attempt 0)
- [ ] 5.3 Corrigir `fallbackToImageApi()`: fazer fetch da URL validada, converter com `toFile`, enviar `[productFile, identityFile]` no `images.edit`
- [ ] 5.4 Atualizar `ImageGenerationService`: aceitar `CampaignBrief`, injetar `identityDirective` em `buildPromptVariables()`, passar `identity.imageUrl` ao provider
- [ ] 5.5 Remover `logoVariantUrl` da `brandProfileSection` em `buildPromptVariables()`
- [ ] 5.6 Substituir instrução fixa de logotipo por `{{identityDirective}}` em `campaign-image-director.md`

## 6. Componentes do cliente

- [ ] 6.1 Atualizar `CampaignInputForm`: props `storeId` em vez de `storeIdentity`
- [ ] 6.2 Atualizar `useCampaignForm`: montar body com `storeId` + dados do produto (sem `storeLogoUrl`, `brandProfile`), consumir `storeIdentity` do result event
- [ ] 6.3 Atualizar `CampaignRenderer`: consumir `signature.url` + `signature.type` em vez de `logoUrl`/`visualSignatureUrl`
- [ ] 6.4 Atualizar `StoreIdentityBlock`: consumir `signature` unificado do snapshot, remover chamada a `resolveStoreIdentity`
- [ ] 6.5 Atualizar `StoreVisualSignatureSection`: consumir `signature` unificado
- [ ] 6.6 Atualizar `CampaignPageClient`: passar `storeId` ao form, simplificar carregamento, remover `resolveStoreIdentity`

## 7. Preview legado

- [ ] 7.1 Atualizar `/campaign/preview/page.tsx`: detectar payload legado (sem `identityState`), normalizar derivando `identityState` e `signature` de `logoUrl`/`visualSignatureUrl`

## 8. Testes automáticos

- [ ] 8.1 Testar `resolveStoreIdentity` para `text_only`, `logo` com/sem asset, `visual_signature` com/sem asset
- [ ] 8.2 Testar `buildCampaignBrief` para os 5 cenários de directive
- [ ] 8.3 Testar `validateIdentityReference` com URL válida, URL irrecuperável (mock fetch), e `signature.url = null` (cópia sem fetch)
- [ ] 8.4 Testar provider: `identityImageUrl` enviado no primary path, `[productFile, identityFile]` no fallback
- [ ] 8.5 Testar `GET /api/store/:id` com `identity` no response
- [ ] 8.6 Testar POST `/api/campaign/generate-image` com `storeId` (sem identity fields) e com campos legados (400)
- [ ] 8.7 Testar regressão de prompt para logo, text_only e VS: equivalentes antes/depois (exceto `identityDirective` e remoção de `logoVariantUrl`)
- [ ] 8.8 Testar que `storeIdentity` retornado no `type: "result"` event contém o snapshot autoritativo usado na geração
- [ ] 8.9 Testar `resolveStoreIdentity` com múltiplos logo variants: prioridade normalized → original → on_dark
- [ ] 8.10 Testar normalização dos 3 formatos legados de preview (logoUrl, visualSignatureUrl, nenhum ativo)
- [ ] 8.11 Testar erro da API no formulário: mensagem de erro exibida e opção de retry preservada
- [ ] 8.12 TypeScript, lint, build passando

## 9. Validação manual

- [ ] 9.1 Fluxo text_only: cadastrar loja sem logo, inferir brand profile, gerar campanha — sem logo, sem VS, brand profile entregue como contexto direcional não obrigatório
- [ ] 9.2 Fluxo logo: cadastrar loja com logo, gerar campanha — logotipo como assinatura, brand profile entregue como contexto direcional não obrigatório
- [ ] 9.3 Fluxo VS: cadastrar loja sem logo, gerar VS e aprovar, gerar campanha — VS como assinatura, sem logo, brand profile entregue como contexto direcional não obrigatório
- [ ] 9.4 Remoção de logo: remover logo, gerar campanha — sem logotipo, brand profile (original) preservado, directive "não inventar"
- [ ] 9.5 Asset quebrado: corromper URL do logo no banco, gerar campanha — sem logotipo, `identity_state` permanece `'logo'`, diagnóstico registrado
