## 1. PrÃ©-requisito de limpeza + Trackings â€” RenumeraÃ§Ã£o F41/F42 (D1 runbook)

- [x] 1.1 **PrÃ©-requisito F40:** arquivar/limpar a F40 â€” `openspec/changes/fase-40-campos-comerciais-avisos-brief/` nÃ£o pode mais constar como `in-progress` no `openspec list`; alinhar o rodapÃ© de `.planning/ROADMAP.md` ("Fase 40 ... em PLANEJAMENTO") com `.planning/STATE.md` (concluÃ­da 9/9, 1997 testes, UAT 6/6) **sem reescrever artefatos histÃ³ricos** â€” D1
- [x] 1.2 `ROADMAP.md` (raiz): linha 41 â†’ "MÃ­dia de Campanha Mobile | v1.5 | 0/0 | â—‹ Pending"; adicionar linha 42 â†’ "Stripe / MonetizaÃ§Ã£o PÃºblica | v1.7 | 0/0 | â—‹ Pending"; menÃ§Ãµes "F41 (Stripe)" â†’ "Stripe (F42)"; bullet da F41 no `<details open>` do v1.5 â€” D1
- [x] 1.3 `.planning/ROADMAP.md`: nota "Phase numbering" (F41 = MÃ­dia v1.5, F42 = Stripe v1.7); linha da tabela Progress 41 â†’ MÃ­dia; adicionar linha 42 â†’ Stripe; notas de renumeraÃ§Ã£o; menÃ§Ãµes "Phase 41 (Stripe)" em Dependencies â†’ F42; Dependency Graph; seÃ§Ã£o "### Phase 41 â€” MÃ­dia de Campanha Mobile"; rodapÃ© "Last updated" (inclui correÃ§Ã£o "Fase 40 ... em PLANEJAMENTO") â€” D1
- [x] 1.4 `.planning/STATE.md`: frontmatter `current_phase: 41`; tabela "Next Phases" (F41 in progress MÃ­dia, F42 future renumerada de F41); corpo "Current Position" + "Last updated" â€” D1
- [x] 1.5 `.planning/PROJECT.md`: menÃ§Ã£o "Stripe ... F41 (v1.7)" â†’ **F42**; rodapÃ© "Last updated" â€” D1
- [x] 1.6 `.planning/REQUIREMENTS.md`: seÃ§Ã£o v1.7 "Stripe... F41/v1.7" â†’ **F42/v1.7** â€” D1
- [x] 1.7 `.planning/MILESTONES.md`: "diferido para v1.7 (F41)" â†’ **(F42)** â€” D1
- [x] 1.8 VerificaÃ§Ã£o de consistÃªncia: grep-consistÃªncia "F41 (Stripe)"/"Phase 41 (Stripe)" nos 6 trackings â†’ zero resÃ­duos (padrÃ£o F40-01) â€” D1

## 2. Config e constantes de limites (D10)

- [x] 2.1 `src/lib/image-generation/config.ts`: `export const MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares) â€” D10
- [x] 2.2 `config.ts`: constante de **teto agregado** do `productImages[]` (soma dos dataUrls, em bytes â€” ex.: `MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE`), mantendo `MAX_PRODUCT_IMAGE_BASE64_SIZE`/`MAX_PRODUCT_IMAGE_FILE_SIZE` como referÃªncia â€” D10
- [x] 2.3 Verificar que `MAX_CAMPAIGN_IMAGES` Ã© a fonte Ãºnica do teto no transporte, no form e nos testes â€” D10

## 3. Transporte aditivo â€” schema.ts (D2/D10)

- [x] 3.1 `src/lib/image-generation/schema.ts`: exportar `ProductImageInputSchema` (item `{ role, source, mimeType, dataUrl }`, **sem `id`**) â€” D2
- [x] 3.2 `GenerateImageRequestSchema`: adicionar `productImages: z.array(ProductImageInputSchema).min(1).max(MAX_CAMPAIGN_IMAGES).superRefine(exactly-1-primary).optional()` â€” D2/D10
- [x] 3.3 `productImageDataUrl`: trocar `z.string().min(1, "...")` (required) por `z.string().min(1).optional()` â€” preservaÃ§Ã£o **comportamental** (obrigatoriedade vira regra de exclusividade da rota) â€” D2
- [x] 3.4 `.strict()` preservado â€” o campo novo Ã© aditivo; payload legado continua passando â€” D2

## 4. Mapper flatâ†’domÃ­nio multi-imagem (D2/D3)

- [x] 4.1 `src/lib/campaign/brief.ts` â€” `buildCampaignBriefFromFlat`: mapear `productImages[]` **item a item** (`role`/`source` do transporte, `id` uuid por item, `mimeType` **real derivado do dataUrl**) â€” corrige o quirk `"image/jpeg"` fixo da F39 (`:161-171`) â€” D2/D3
- [x] 4.2 Legado `productImageDataUrl` â†’ **equivalente a `productImages` de 1 elemento** (primary/upload, mimeType derivado) â€” reuso da mesma lÃ³gica, zero bifurcaÃ§Ã£o no pipeline â€” D2
- [x] 4.3 Derivar `mimeType` do dataUrl (png/jpeg/webp): helper `mimeTypeFromDataUrl(dataUrl)` (ou equivalente) â€” D2
- [x] 4.4 Invariante `exactly-1-primary` garantido pelo zod do domÃ­nio (sem lÃ³gica extra no mapper) â€” D3

## 5. Snapshot com storagePath (D5)

- [x] 5.1 `src/lib/campaign/brief.ts` â€” `buildCampaignBriefSnapshot`: copiar `storagePath` quando presente no runtime â€” `...(i.storagePath ? { storagePath: i.storagePath } : {})` â€” D5
- [x] 5.2 Snapshot serializa **N imagens** (array completo) sem base64 â€” type `CampaignBriefSnapshotImage` inalterado em shape â€” D5
- [x] 5.3 `src/lib/campaign/brief.ts` â€” `CampaignProductImageInput` ganha `storagePath?: string` (tipo runtime); a **rota** preenche o campo apÃ³s o upload do input (antes do snapshot); snapshot copia **sem cast/objeto paralelo** â€” D5

## 6. PersistÃªncia â€” createCampaign + helpers (D5)

- [x] 6.1 `src/lib/campaign/persistence.ts` â€” `createCampaign(storeId, input, campaignId?: string)`: aceitar id prÃ©-gerado; ausente â†’ UUID interno (regressÃ£o) â€” D5
- [x] 6.2 `persistence.ts` â€” novo `uploadCampaignInputImage(storeId, campaignId, imageId, { buffer, mimeType })`: transcoda para JPEG via `transcodeToJpeg` (reuso `image-processor.ts`), upload em `{storeId}/{campaignId}/inputs/{imageId}.jpg` (service_role, contentType `image/jpeg`, `upsert: false`) â€” D5
- [x] 6.3 `persistence.ts` â€” novo `removeCampaignInputs(storeId, campaignId)`: lista e remove objetos em `{storeId}/{campaignId}/inputs/` (no-op sem objetos) â€” D5
- [x] 6.4 `src/lib/campaign/types.ts` â€” `CreateCampaignInput` estendido com `campaignId?` e `storagePaths?` opcionais â€” D5

## 7. Rota â€” exclusividade, teto, campaignId prÃ©-gerado, upload de inputs, cleanup (D2/D5/D10)

- [x] 7.1 `src/app/api/campaign/generate-image/route.ts` â€” **regra de exclusividade** (D2): `productImages` + `productImageDataUrl` ausente â†’ usa `productImages`; legado â†’ `productImageDataUrl`; **ambos ausentes â†’ 400** "Imagem do produto Ã© obrigatÃ³ria" (`:118-123` co-migrado, nÃ£o mais erro do Zod); **ambos presentes â†’ 400** "payload ambÃ­guo" â€” D2
- [x] 7.2 Limites na rota (D10): por item `dataUrl.length <= MAX_PRODUCT_IMAGE_BASE64_SIZE` (4MB) + **teto agregado** da soma dos dataUrls â†’ 413 PT-BR indicando item/total; limite legado single permanece â€” D10
- [x] 7.3 **Ordem D5:** prÃ©-gerar `campaignId` (`crypto.randomUUID()`); gerar/normalizar `id` por imagem (uuid â€” cliente nÃ£o envia id); **upload dos inputs** via `uploadCampaignInputImage` ANTES de montar o snapshot; montar snapshot com `storagePath` por imagem; `createCampaign(storeId, input, campaignIdPreGerado)` â€” D2/D5
- [x] 7.4 **Limpeza prÃ©-stream:** falha no upload de inputs ou no fluxo prÃ©-stream â†’ `removeCampaignInputs` (sem Ã³rfÃ£os); falha pÃ³s-stream â†’ `deleteCampaignImage(storagePath)` atual permanece â€” D5
- [x] 7.5 `inputSnapshot` construÃ­do **apÃ³s** os uploads de inputs (mudanÃ§a de ordem em `route.ts:359-366`) â€” D5
- [x] 7.6 `recordCall`/telemetria (`AiCostTracker`) inalterada â€” a chamada continua 1 evento `campaign_image` (imagens entram como tokens do mesmo input) â€” D7

## 8. Provider â€” N input_image e fallback gated (D7)

- [x] 8.1 `src/lib/image-generation/providers/types.ts`: `ImageProviderInput` ganha `productImagesDataUrls?: string[]` (lista ordenada, Ã­ndice 0 = primary); `productImageDataUrl?` mantido para o legado â€” D7
- [x] 8.2 `src/lib/image-generation/providers/openai.ts` â€” mainline Responses path (`:71-73`): montar **N blocos `input_image`** (primary + auxiliares); identidade/logo continua `detail: "low"` â€” D7
- [x] 8.3 **Fallback `images.edit` gated** (`:58-61, 225-307`): SÃ“ com primary Ãºnica (1 imagem), enviando **apenas o `productFile`** (identidade/logo **fora do fallback** â€” limitaÃ§Ã£o prÃ©-existente `openai.ts:282-287`); com auxiliares â†’ retries permanecem no Responses path; Responses indisponÃ­vel â†’ erro explÃ­cito (sem descartar imagens) â€” D7

## 9. Service â€” ponte lista N, validaÃ§Ã£o primary-only, review com primary (D7/D8/D9)

- [x] 9.1 `src/lib/image-generation/services/image-generation-service.ts`: ponte `primaryImageDataUrl(brief)` â†’ **`mediaImagesDataUrls(brief)`** (lista ordenada; posiÃ§Ã£o 0 = primary) â€” D7
- [x] 9.2 Service monta `ImageProviderInput` com `productImagesDataUrls` (ou `productImageDataUrl` legado para 1 imagem) â€” D7
- [x] 9.3 `src/lib/image-generation/services/input-validation-service.ts`: `validate(nome, ...)` continua **primary-only** (recebe apenas a dataUrl da primary) â€” D8
- [x] 9.4 `src/lib/image-generation/services/image-review-service.ts`: `review` passa a receber, **opcionalmente**, a dataUrl da primary e envia ao prompt `campaign-image-reviewer` (bloco de imagem + linha fixa "Compare o produto da arte com a imagem de referÃªncia"); retrocompatÃ­vel (sem primary â†’ comportamento atual) â€” D9

## 10. Prompts â€” bloco descritivo 1+N referÃªncias (D6)

- [x] 10.1 `prompts/campaign-image-director.md`: substituir a linha Ãºnica ("A imagem do produto foi enviada como referÃªncia visual fiel") pelo **bloco descritivo** (1 primary = herÃ³i visual; N auxiliares = contexto/Ã¢ngulos/variaÃ§Ãµes; **sem inventar conteÃºdo**) â€” **sem placeholder/variÃ¡vel** â€” D6
- [x] 10.2 `prompts/campaign-image-director-offer.md`: idem â€” D6
- [x] 10.3 `prompts/campaign-image-director-spotlight.md`: idem â€” D6
- [x] 10.4 `prompts/campaign-image-director-exclusive.md`: idem â€” D6
- [x] 10.5 Golden por intent **inalterado**: `EXPECTED_KEYS = 38` por intent (o texto muda; o conjunto de variÃ¡veis nÃ£o) â€” D6

## 11. Form/UI â€” estado multi-imagem e body (D2/D3/D4/D10)

- [x] 11.1 `src/components/flow/use-campaign-form.ts` â€” state: `imageFile: File | null` â†’ **array** `productImages: Array<{ id, role, source, mimeType, file?, dataUrl? }>` (primeiro = primary; demais = `reference`; id Ã© INTERNO da UI â€” nunca no body) â€” D3
- [x] 11.2 `compressImage` **por item** (JPEG â‰¤1MB, downscale 1200px) + HEIC decode via canvas + orientaÃ§Ã£o EXIF (`createImageBitmap` `from-image`) â€” D4
- [x] 11.3 `validateImage` aceita `image/heic`/`image/heif` no input; falha de decode â†’ mensagem PT-BR clara orientando JPG/PNG (sem dependÃªncia de lib) â€” D4
- [x] 11.4 Montagem do body (D2): com auxiliares â†’ `body.productImages = productImages.map(({ role, source, mimeType, dataUrl }) => ({ role, source, mimeType, dataUrl }))` (SEM id de cliente); sem auxiliares â†’ `body.productImageDataUrl = <dataUrl da primary>` (legado) â€” D2
- [x] 11.5 Draft/autosave restaura **N imagens** (estado multi preservado) + `EMPTY_FIELDS`/`FieldErrors` atualizados (sem novos requireds) â€” D3
- [x] 11.6 `src/components/flow/campaign-image-upload.tsx`: multi-arquivo + `capture="environment"` (cÃ¢mera) + preview grid + remoÃ§Ã£o por item + origem `source: "upload" | "camera"` + teto no cliente â€” D3/D4/D10
- [x] 11.7 `src/components/flow/campaign-input-form.tsx`: campo "Imagem do Produto *" (primary) + seÃ§Ã£o "Imagens adicionais" (atÃ© `MAX_CAMPAIGN_IMAGES - 1`) + controles de cÃ¢mera/galeria â€” D3/D4
- [x] 11.8 Co-migrar mock `CampaignImageUpload` em `campaign-flow-credits.test.tsx` (novo componente multi) â€” D3/D4

## 12. Testes â€” Transporte e mapper (D2/D3/D5) â€” 8 testes

- [x] 12.1 Teste 1: `productImages[]` com primary + 2 reference â†’ mapper gera `media.images` com roles/source/mimeType corretos â€” D2/D3
- [x] 12.2 Teste 2: `productImages` ausente + `productImageDataUrl` â†’ comportamento legado idÃªntico (1 item primary/upload) â€” D2
- [x] 12.3 Teste 3: `productImages` sem primary ou com 2 primaries â†’ rejeitado (invariante no transporte) â€” D2
- [x] 12.4 Teste 4: `productImages` + `productImageDataUrl` juntos â†’ 400 ambÃ­guo (rota) â€” D2
- [x] 12.5 Teste 5: `mimeType` derivado do dataUrl (png/jpeg/webp) â€” corrige quirk da F39 â€” D2
- [x] 12.6 Teste 6: snapshot com N imagens: **sem dataUrl**, com `storagePath` por imagem â€” D5
- [x] 12.7 Teste 7: legado com 1 imagem â†’ comportamento e shape preservados (regressÃ£o): snapshot sem base64 com `mimeType: "image/jpeg"`; no teste unitÃ¡rio sem upload `storagePath` fica ausente â€” a primary ganha `storagePath` aditivo apenas no fluxo de rota F41 (D5 nos dois fluxos â€” decisÃ£o do usuÃ¡rio 2026-08-14) â€” D2/D5
- [x] 12.8 Teste 8: exatamente 1 primary no snapshot/domÃ­nio (zod) para N imagens â€” D3

## 13. Testes â€” UI / form (D3/D4/D10) â€” 8 testes

- [x] 13.1 Teste 9: primary obrigatÃ³ria; auxiliares opcionais atÃ© `MAX_CAMPAIGN_IMAGES - 1` â€” D3/D10
- [x] 13.2 Teste 10: seleÃ§Ã£o/remoÃ§Ã£o/preview por item; remover primary â†’ validaÃ§Ã£o â€” D3
- [x] 13.3 Teste 11: origem cÃ¢mera â†’ `source: "camera"`; galeria â†’ `source: "upload"` â€” D4
- [x] 13.4 Teste 12: HEIC aceito no input; decode via canvas â†’ JPEG; falha â†’ mensagem PT-BR clara â€” D4
- [x] 13.5 Teste 13: orientaÃ§Ã£o EXIF respeitada na compressÃ£o (`createImageBitmap from-image`) â€” D4
- [x] 13.6 Teste 14: body: com auxiliares â†’ `productImages[]` (sem id de cliente); sem auxiliares â†’ `productImageDataUrl` legado â€” D2
- [x] 13.7 Teste 15: draft/autosave restaura N imagens (estado multi preservado) â€” D3
- [x] 13.8 Teste 16: erros de limite por item e teto agregado exibidos no form â€” D10

## 14. Testes â€” Pipeline / provider / review (D6/D7/D8/D9/D10) â€” 11 testes

- [x] 14.1 Teste 17: provider Responses recebe N `input_image` (primary + auxiliares) â€” D7
- [x] 14.2 Teste 18: fallback `images.edit` SÃ“ com primary Ãºnica; com auxiliares â†’ NÃƒO usa edit â€” D7
- [x] 14.3 Teste 19: sem primary/legado â†’ caminho atual 1 imagem (regressÃ£o) â€” D7
- [x] 14.4 Teste 20: golden por intent: **mesmo conjunto de 38 keys** com multi-imagem; texto do prompt muda intencionalmente â€” D6
- [x] 14.5 Teste 21: bloco descritivo 1+N referÃªncias presente nos 4 prompts â€” D6
- [x] 14.6 Teste 22: `InputValidationService` usa apenas a primary (primary-only) â€” D8
- [x] 14.7 Teste 23: review recebe a primary como referÃªncia de fidelidade; sem primary â†’ comportamento atual â€” D9
- [x] 14.8 Teste 24: teto agregado do `productImages[]` excede â†’ 413; item individual > 4MB â†’ 413 â€” D10
- [x] 14.9 Teste 25: rota: upload de inputs prÃ©-snapshot com `campaignId` e `imageId` **gerados pela rota**; `storagePath` no snapshot â€” D5
- [x] 14.10 Teste 26: limpeza: falha prÃ©-stream remove inputs jÃ¡ enviados â€” D5
- [x] 14.11 Teste 27: ausÃªncia de `productImageDataUrl` â†’ 400 da **rota** (nÃ£o mais erro direto do Zod) â€” co-migraÃ§Ã£o dos testes antigos â€” D2

## 15. RegressÃ£o e co-migraÃ§Ã£o de fixtures (D2/D5/D7)

- [x] 15.1 `route.test.ts`: fixtures `productImages[]` + legado + teto + erros 400/413 + storage (upload de inputs/campaignId prÃ©-gerado); testes que esperavam erro do Zod por ausÃªncia de `productImageDataUrl` â†’ 400 da rota (teste 27) â€” D2/D5/D10
- [x] 15.2 `brief-mapper.test.ts`: mapeia array + invariante + snapshot storagePath â€” D2/D3/D5
- [x] 15.3 `brief-snapshot.test.ts`: N imagens sem base64, com `storagePath` â€” D5
- [x] 15.4 `image-generation-service.test.ts`: lista N de dataUrls no provider (`mediaImagesDataUrls`); golden 38 keys â€” D6/D7
- [x] 15.5 `openai-provider.test.ts`: N `input_image`; fallback gated â€” D7
- [x] 15.6 `image-review-service.test.ts`: review com primary como referÃªncia â€” D9
- [x] 15.7 `use-campaign-form-navigation.test.ts`: novo state multi no `EMPTY_FIELDS` â€” D3
- [x] 15.8 `campaign-flow-credits.test.tsx`: mock do upload multi co-migrado â€” D3/D4
- [x] 15.9 RegressÃ£o `generate-image` â€” fluxo completo (crÃ©dito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterado** para o payload legado de 1 imagem â€” D2/D7
- [x] 15.10 RegressÃ£o `createCampaign` com `campaignId` prÃ©-gerado e sem ele â€” D5
- [x] 15.11 Verificar `npx vitest run` com suÃ­te completa (novos + co-migrados passando) â€” D2-D10

## 16. VerificaÃ§Ã£o (gates + UAT)

- [x] 16.1 `npx vitest run` â€” zero falhas (novos + existentes + co-migrados) â€” D2-D10
- [x] 16.2 `npm run typecheck` â€” zero erros
- [x] 16.3 `npm run lint` â€” zero erros
- [x] 16.4 `npm run build` â€” build bem-sucedido
- [x] 16.5 UAT local: gerar campanha com 1 imagem (legado) â†’ comportamento/UX idÃªnticos ao pÃ³s-F40; snapshot sem base64 preservado, mas com `storagePath` aditivo para a primary quando passa pela rota F41 (D5 nos dois fluxos â€” decisÃ£o do usuÃ¡rio 2026-08-14; `storagePath` ausente sÃ³ em campanhas prÃ©-F41 ou caminhos excepcionais sem upload) â€” D2
- [x] 16.6 UAT local: gerar campanha com primary + 2 auxiliares (galeria) â†’ `media.images[]` com 3 itens (roles/source/mimeType corretos); arte com herÃ³i = primary e contexto das auxiliares â€” D2/D3/D6
- [x] 16.7 UAT local: cÃ¢mera no celular (foto nova) â€” HEIC/EXIF ok, arte correta â€” D4
- [x] 16.8 UAT local: remover/adicionar auxiliares e regenerar â€” preview e payload consistentes â€” D3
- [x] 16.9 UAT local: upload sem primary vÃ¡lida â†’ erro claro (400 na rota) â€” D2
- [x] 16.10 UAT local: campanha antiga (prÃ©-F41) continua exibindo/baixando normalmente (sem migraÃ§Ã£o destrutiva) â€” D5
- [ ] 16.11 UAT celular real obrigatÃ³ria: foto vertical/horizontal, iOS (HEIC) e Android â€” orientaÃ§Ã£o EXIF correta e decode HEIC OK â€” D4
