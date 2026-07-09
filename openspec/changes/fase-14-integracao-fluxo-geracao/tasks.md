## 1. Plano 14-01 — Image Processor + Publication Copy

- [ ] 1.1 Instalar sharp como runtime dependency (`npm install sharp`)
- [ ] 1.2 Criar `src/lib/campaign/image-processor.ts` com `transcodeToJpeg(buffer, mimeType)` usando sharp: converte PNG/WEBP/JPEG para JPEG sRGB qualidade 90, resize para 1080×1080 com `fit=contain` e background branco `#FFFFFF` para garantir canvas final sem distorção
- [ ] 1.3 Implementar `buildPublicationCopySnapshot(data)` que retorna `{ caption, hashtags, cta_post }` no shape da milestone
- [ ] 1.4 Ajustar interface `PublicationCopySnapshot` em `src/lib/campaign/types.ts` para `caption: string`, `hashtags: string[]`, `cta_post: string` (snake_case, shape da milestone)
- [ ] 1.5 Criar `src/__tests__/lib/campaign/processor.test.ts` com testes de transcode (PNG→JPEG, WEBP→JPEG, JPEG→JPEG, formato inválido) e buildPublicationCopySnapshot (shape correto, dados mínimos)

## 2. Plano 14-02 — Orquestração em generate-image

- [ ] 2.1 Adicionar `export const runtime = "nodejs"` em `src/app/api/campaign/generate-image/route.ts`
- [ ] 2.2 Após auth/ownership/identidade/validação de conflito, inserir `createCampaign(storeId, { productName, inputSnapshot, identitySnapshot })` — capturar `{ id: campaignId, storagePath }`
- [ ] 2.3 No sucesso da geração IA: `dataUrlToCampaignImage` → `transcodeToJpeg` → `uploadCampaignImage` sequencialmente
- [ ] 2.4 Montar `generationMetadata` no handler: usar `provider.name` da mesma instância do provider criada para `ImageGenerationService`, `IMAGE_GENERATION_RESPONSES_MODEL` como model, `performance.now()` para durationMs, `new Date().toISOString()` para generatedAt, `result.inputCorrections` para corrections
- [ ] 2.5 Montar `publicationCopySnapshot` com `buildPublicationCopySnapshot` de forma determinística: caption a partir de productName + hook/description do input com correções da IA, hashtags do segmento da loja + termos do input, cta_post do campo cta do input com correções da IA. Chamar `updateCampaignReady` com generationMetadata, renderSnapshot, publicationCopySnapshot
- [ ] 2.6 Estender NDJSON de resultado: emitir `{ type: "result", campaignId, campaignUrl }` onde `campaignUrl` = `/campanha/${campaignId}`
- [ ] 2.7 Implementar compensação de erro: IA/transcode/upload falha → `updateCampaignError`; updateReady falha após upload OK → `deleteCampaignImage` + `updateCampaignError`
- [ ] 2.8 Garantir que erros de validação (400/409) continuem sem INSERT (antes do `createCampaign`)
- [ ] 2.9 Criar `src/__tests__/api/campaign-generate.test.ts` com 6 cenários: sucesso completo, erro IA, erro upload, erro updateReady, sem auth (401), ownership mismatch (404)

## 3. Plano 14-03 — Consumer no Cliente

- [ ] 3.1 Em `src/components/flow/use-campaign-form.ts`: remover montagem do `PreviewPayload` e gravação de `campaign_preview` em sessionStorage
- [ ] 3.2 Após receber `{ type: "result", campaignId, campaignUrl }` no NDJSON, navegar para `campaignUrl` usando `router.push`
- [ ] 3.3 Manter rascunho do formulário: `campaign_draft_image` e `useInputPreservation` no sessionStorage (inalterados)
- [ ] 3.4 Criar `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` validando que sucesso com `campaignUrl` chama `router.push(campaignUrl)` e não escreve `campaign_preview` no sessionStorage

## 4. Type Check & Build

- [ ] 4.1 Rodar `npm run typecheck` — zero erros
- [ ] 4.2 Rodar `npm run lint` — zero erros
- [ ] 4.3 Rodar `npx vitest run` — todos os testes passando (processor + persistence + download + generate)
- [ ] 4.4 Rodar `npm run build` — build bem-sucedido