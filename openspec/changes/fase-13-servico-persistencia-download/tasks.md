## 1. Types — `src/lib/campaign/types.ts`

- [ ] 1.1 Criar diretório `src/lib/campaign/`
- [ ] 1.2 Definir type `CampaignStatus = "generating" | "ready" | "error"`
- [ ] 1.3 Definir interface `CampaignRecord` com todos os campos da tabela `public.campaigns` (id, store_id, status, product_name, input_snapshot, identity_snapshot, generation_metadata, render_snapshot, publication_copy_snapshot, storage_path, error_message, created_at, updated_at)
- [ ] 1.4 Definir interface `CreateCampaignInput` com productName, inputSnapshot, identitySnapshot?
- [ ] 1.5 Definir interface `CampaignReadyData` com generationMetadata, renderSnapshot, publicationCopySnapshot
- [ ] 1.6 Definir interface `InputSnapshot` com shape mínimo v1 (productName, originalPriceCents?, discountedPriceCents, badgeText?, hook?, cta?, description?, objective?, campaignDetails?, additionalDetails?, targetChannel?, format?, validity?, availabilityNotes?, sensitiveConstraints?, inputValidationOverride?, productImage: { provided: true; mimeType: string })
- [ ] 1.7 Definir interface `IdentitySnapshot` com shape mínimo v1 (storeName, storeSegment, brandColor, identityState, signature, storeInitials, brandProfile?, toneOfVoice?, subsegment?, positioning?, shortDescription?, slogan?)
- [ ] 1.8 Definir interface `RenderSnapshot` com shape mínimo v1 (format: "jpeg", width: 1080, height: 1080, aspectRatio: "1:1", mimeType: "image/jpeg", quality: 90, colorSpace: "srgb")
- [ ] 1.9 Definir interface `PublicationCopySnapshot` com shape mínimo v1 (title, subtitle?, hook, cta, badgeText, priceDisplay)
- [ ] 1.10 Definir interface `GenerationMetadata` com shape mínimo v1 (provider, model, durationMs, generatedAt, corrections?)

## 2. Persistence Service — `src/lib/campaign/persistence.ts`

- [ ] 2.1 Implementar `createCampaign(storeId: string, input: CreateCampaignInput)` — gerar UUID v4, computar `storage_path` como `{storeId}/{campaignId}.jpg`, INSERT via `supabaseAdmin.from('campaigns').insert()`, retornar `{ id, storagePath }`
- [ ] 2.2 Implementar `dataUrlToCampaignImage(dataUrl: string)` — validar data URL, extrair MIME e buffer base64, aceitar apenas `image/png`, `image/jpeg`, `image/webp`, rejeitar MIME não suportado/data URL malformada/payload vazio, retornar `{ buffer, mimeType }` sem transcodificação
- [ ] 2.3 Implementar `uploadCampaignImage(storeId: string, campaignId: string, image: { buffer: Buffer; mimeType: "image/jpeg" })` — validar mimeType, upload via `supabaseAdmin.storage.from('campaign-images').upload(path, buffer, { contentType: "image/jpeg", upsert: false })`, retornar `{ storagePath }`
- [ ] 2.4 Implementar `updateCampaignReady(campaignId: string, data: CampaignReadyData)` — UPDATE via `supabaseAdmin.from('campaigns').update({ status: 'ready', generation_metadata, render_snapshot, publication_copy_snapshot, error_message: null }).eq('id', campaignId)`
- [ ] 2.5 Implementar `updateCampaignError(campaignId: string, errorMessage: string)` — validar mensagem não vazia, UPDATE via `supabaseAdmin.from('campaigns').update({ status: 'error', error_message: errorMessage }).eq('id', campaignId)`
- [ ] 2.6 Implementar `getCampaign(id: string)` — SELECT via `supabaseAdmin.from('campaigns').select('*').eq('id', id).maybeSingle()`, retornar `CampaignRecord | null` (0 linhas → null, erro real → exceção)
- [ ] 2.7 Implementar `deleteCampaignImage(storagePath: string)` — remove via `supabaseAdmin.storage.from('campaign-images').remove([storagePath])`

## 3. Download Route — `src/app/api/campaign/[id]/download/route.ts`

- [ ] 3.1 Criar diretório `src/app/api/campaign/[id]/download/`
- [ ] 3.2 Implementar `GET` handler com pipeline: `requireApiUser()` → validar UUID v4 do `[id]` (regex ou `uuid` lib) → `getCampaign(id)` → 404 se null → `requireOwnership(campaign.store_id, user.userId)` → 404 se não pertencer → `createSignedUrl(storage_path, 3600)` → redirect 302 com Location header → 502 se signed URL falhar

## 4. Testes — Persistence Service

- [ ] 4.1 Criar `src/__tests__/lib/campaign/persistence.test.ts`
- [ ] 4.2 Testar `createCampaign`: gera UUID e storage_path, insere status=generating, rejeita storeId inválido
- [ ] 4.3 Testar `dataUrlToCampaignImage`: aceita PNG/JPEG/WEBP, rejeita MIME não suportado, string vazia, data URL malformada
- [ ] 4.4 Testar `uploadCampaignImage`: bucket campaign-images, path .jpg, upsert false, contentType image/jpeg, rejeita MIME não JPEG
- [ ] 4.5 Testar `updateCampaignReady`: status=ready, snapshots persistidos, error_message null
- [ ] 4.6 Testar `updateCampaignError`: status=error com mensagem, rejeita mensagem vazia
- [ ] 4.7 Testar `getCampaign`: retorna record quando existe, retorna null quando não existe

## 5. Testes — Download Route

- [ ] 5.1 Criar `src/__tests__/api/campaign-download.test.ts`
- [ ] 5.2 Testar sem sessão → 401
- [ ] 5.3 Testar [id] malformado (não-UUID) → 400
- [ ] 5.4 Testar campanha inexistente → 404
- [ ] 5.5 Testar campanha de outra loja → 404
- [ ] 5.6 Testar owner acessando → 302 com signed URL
- [ ] 5.7 Testar createSignedUrl falha → 502

## 6. Type Check & Build

- [ ] 6.1 Rodar `npm run typecheck` — zero erros
- [ ] 6.2 Rodar `npm run lint` — zero erros
- [ ] 6.3 Rodar `npm run build` — build bem-sucedido
- [ ] 6.4 Verificar que nenhum arquivo do fluxo de geração foi modificado (Fase 13 não toca `generate-image`)
