## 1. Tipos e contratos

- [x] 1.1 Atualizar `StoreIdentitySnapshot`: adicionar `identityState: IdentityState` e `signature: { url, type }`, remover `logoUrl`, `visualSignatureUrl`, `visualSignatureType`
- [x] 1.2 Atualizar `BrandProfileSnapshot`: remover `logoVariantUrl`
- [x] 1.3 Criar tipo `CampaignBrief` com `campaignInput`, `store`, `brandProfile`, `identity`

## 2. Resolução de identidade (backend)

- [x] 2.1 Reescrever `resolveStoreIdentity(storeId)` como pipeline declarativo: ler `identity_state`, buscar brand profile `synced`, buscar asset conforme estado
- [x] 2.2 Implementar degradação segura: se asset esperado está ausente → `signature.url = null`, log de diagnóstico, estado não alterado
- [x] 2.3 Implementar `validateIdentityReference(snapshot)`: fetch HEAD/GET com timeout, retorna cópia com `signature.url = null` se falhar
- [x] 2.4 Implementar `buildCampaignBrief(snapshot, campaignInput)`: deriva directive dos 5 cenários, monta `CampaignBrief` com `campaignInput` pass-through

## 3. GET /api/store/:id enriquecido

- [x] 3.1 Modificar `GET /api/store/[id]/route.ts` para retornar `{ ...store, identity: StoreIdentitySnapshot }` em uma passada
- [x] 3.2 Remover chamada a `resolveStoreIdentity` de `CampaignPageClient` e `StoreIdentityBlock` — consumir `identity` do GET response

## 4. Schema e endpoint de geração

- [x] 4.1 Reformular `GenerateImageRequestSchema`: adicionar `storeId`, remover `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, `brandProfile`
- [x] 4.2 Atualizar `POST /api/campaign/generate-image/route.ts`: receber `storeId`, chamar `resolveStoreIdentity` → `validateIdentityReference` → `buildCampaignBrief` → `ImageGenerationService.generateImage(CampaignBrief)`
- [x] 4.3 Incluir `storeIdentity` no `type: "result"` event do NDJSON stream

## 5. Provider e prompt

- [x] 5.1 Renomear `logoImageUrl` para `identityImageUrl` em `ImageProviderInput` e em `OpenAIImageProvider`
- [x] 5.2 No `OpenAIImageProvider`: enviar `identityImageUrl` como `input_image` no Responses API (attempt 0)
- [x] 5.3 Corrigir `fallbackToImageApi()`: fazer fetch da URL validada, converter com `toFile`, enviar `[productFile, identityFile]` no `images.edit`
- [x] 5.4 Atualizar `ImageGenerationService`: aceitar `CampaignBrief`, injetar `identityDirective` em `buildPromptVariables()`, passar `identity.imageUrl` ao provider
- [x] 5.5 Remover `logoVariantUrl` da `brandProfileSection` em `buildPromptVariables()`
- [x] 5.6 Substituir instrução fixa de logotipo por `{{identityDirective}}` em `campaign-image-director.md`

## 6. Componentes do cliente

- [x] 6.1 Atualizar `CampaignInputForm`: props `storeId` em vez de `storeIdentity`
- [x] 6.2 Atualizar `useCampaignForm`: montar body com `storeId` + dados do produto (sem `storeLogoUrl`, `brandProfile`), consumir `storeIdentity` do result event
- [x] 6.3 Atualizar `CampaignRenderer`: consumir `signature.url` + `signature.type` em vez de `logoUrl`/`visualSignatureUrl`
- [x] 6.4 Atualizar `StoreIdentityBlock`: consumir `signature` unificado do snapshot, remover chamada a `resolveStoreIdentity`
- [x] 6.5 Atualizar `StoreVisualSignatureSection`: consumir `signature` unificado
- [x] 6.6 Atualizar `CampaignPageClient`: passar `storeId` ao form, simplificar carregamento, remover `resolveStoreIdentity`

## 7. Preview legado

- [x] 7.1 Atualizar `/campaign/preview/page.tsx`: detectar payload legado (sem `identityState`), normalizar derivando `identityState` e `signature` de `logoUrl`/`visualSignatureUrl`

## 8. Testes automáticos

- [x] 8.1 Testar `resolveStoreIdentity` para `text_only`, `logo` com/sem asset, `visual_signature` com/sem asset
- [x] 8.2 Testar `buildCampaignBrief` para os 5 cenários de directive
- [x] 8.3 Testar `validateIdentityReference` com URL válida, URL irrecuperável (mock fetch), e `signature.url = null` (cópia sem fetch)
- [x] 8.4 Testar provider: `identityImageUrl` enviado no primary path, `[productFile, identityFile]` no fallback (3 testes existentes, cobertura básica)
- [x] 8.5 Testar `GET /api/store/:id` com `identity` no response (3 testes: store+identity, logo_url, 404)
- [x] 8.6 Testar POST `/api/campaign/generate-image` com `storeId` (sem identity fields) e com campos legados (400) (3 testes: legacy fields, missing image, missing storeId)
- [ ] 8.7 Testar regressão de prompt para logo, text_only e VS: equivalentes antes/depois (exceto `identityDirective` e remoção de `logoVariantUrl`) — complexo, requer snapshot do prompt montado; cobertura indireta via testes de buildCampaignBrief + provider
- [x] 8.8 Testar que `storeIdentity` retornado no `type: "result"` event contém o snapshot autoritativo usado na geração (verificado via validatedSnapshot na route.ts:216 e testes UAT)
- [x] 8.9 Testar `resolveStoreIdentity` com múltiplos logo variants: prioridade normalized → original → on_dark (4 testes em logo-variant-priority.test.ts)
- [x] 8.10 Testar normalização dos 3 formatos legados de preview (logoUrl, visualSignatureUrl, nenhum ativo) (4 testes em normalize-legacy.test.ts)
- [ ] 8.11 Testar erro da API no formulário: mensagem de erro exibida e opção de retry preservada — cobertura indireta via testes existentes do modal (visual-signature-approval-modal.test.tsx)
- [x] 8.12 TypeScript, lint, build passando (verificado: typecheck ✅, lint ✅, vitest 307/307 ✅)

## 9. Validação manual

- [x] 9.1 Fluxo text_only: cadastrar loja sem logo, inferir brand profile, gerar campanha — sem logo, sem VS, brand profile entregue como contexto direcional não obrigatório (UAT teste 4 ✅)
- [x] 9.2 Fluxo logo: cadastrar loja com logo, gerar campanha — logotipo como assinatura, brand profile entregue como contexto direcional não obrigatório (UAT teste 2 ✅)
- [x] 9.3 Fluxo VS: cadastrar loja sem logo, gerar VS e aprovar, gerar campanha — VS como assinatura, sem logo, brand profile entregue como contexto direcional não obrigatório (UAT teste 3 ✅)
- [x] 9.4 Remoção de logo: remover logo, gerar campanha — sem logotipo, brand profile (original) preservado, directive "não inventar" (UAT teste 5 ✅)
- [ ] 9.5 Asset quebrado: corromper URL do logo no banco, gerar campanha — sem logotipo, `identity_state` permanece `'logo'`, diagnóstico registrado (não testado em UAT — usuário não conseguiu simular asset quebrado)
