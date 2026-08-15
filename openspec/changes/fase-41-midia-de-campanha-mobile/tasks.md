## 1. Pré-requisito de limpeza + Trackings — Renumeração F41/F42 (D1 runbook)

- [ ] 1.1 **Pré-requisito F40:** arquivar/limpar a F40 — `openspec/changes/fase-40-campos-comerciais-avisos-brief/` não pode mais constar como `in-progress` no `openspec list`; alinhar o rodapé de `.planning/ROADMAP.md` ("Fase 40 ... em PLANEJAMENTO") com `.planning/STATE.md` (concluída 9/9, 1997 testes, UAT 6/6) **sem reescrever artefatos históricos** — D1
- [ ] 1.2 `ROADMAP.md` (raiz): linha 41 → "Mídia de Campanha Mobile | v1.5 | 0/0 | ○ Pending"; adicionar linha 42 → "Stripe / Monetização Pública | v1.7 | 0/0 | ○ Pending"; menções "F41 (Stripe)" → "Stripe (F42)"; bullet da F41 no `<details open>` do v1.5 — D1
- [ ] 1.3 `.planning/ROADMAP.md`: nota "Phase numbering" (F41 = Mídia v1.5, F42 = Stripe v1.7); linha da tabela Progress 41 → Mídia; adicionar linha 42 → Stripe; notas de renumeração; menções "Phase 41 (Stripe)" em Dependencies → F42; Dependency Graph; seção "### Phase 41 — Mídia de Campanha Mobile"; rodapé "Last updated" (inclui correção "Fase 40 ... em PLANEJAMENTO") — D1
- [ ] 1.4 `.planning/STATE.md`: frontmatter `current_phase: 41`; tabela "Next Phases" (F41 in progress Mídia, F42 future renumerada de F41); corpo "Current Position" + "Last updated" — D1
- [ ] 1.5 `.planning/PROJECT.md`: menção "Stripe ... F41 (v1.7)" → **F42**; rodapé "Last updated" — D1
- [ ] 1.6 `.planning/REQUIREMENTS.md`: seção v1.7 "Stripe... F41/v1.7" → **F42/v1.7** — D1
- [ ] 1.7 `.planning/MILESTONES.md`: "diferido para v1.7 (F41)" → **(F42)** — D1
- [ ] 1.8 Verificação de consistência: grep-consistência "F41 (Stripe)"/"Phase 41 (Stripe)" nos 6 trackings → zero resíduos (padrão F40-01) — D1

## 2. Config e constantes de limites (D10)

- [ ] 2.1 `src/lib/image-generation/config.ts`: `export const MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares) — D10
- [ ] 2.2 `config.ts`: constante de **teto agregado** do `productImages[]` (soma dos dataUrls, em bytes — ex.: `MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE`), mantendo `MAX_PRODUCT_IMAGE_BASE64_SIZE`/`MAX_PRODUCT_IMAGE_FILE_SIZE` como referência — D10
- [ ] 2.3 Verificar que `MAX_CAMPAIGN_IMAGES` é a fonte única do teto no transporte, no form e nos testes — D10

## 3. Transporte aditivo — schema.ts (D2/D10)

- [ ] 3.1 `src/lib/image-generation/schema.ts`: exportar `ProductImageInputSchema` (item `{ role, source, mimeType, dataUrl }`, **sem `id`**) — D2
- [ ] 3.2 `GenerateImageRequestSchema`: adicionar `productImages: z.array(ProductImageInputSchema).min(1).max(MAX_CAMPAIGN_IMAGES).superRefine(exactly-1-primary).optional()` — D2/D10
- [ ] 3.3 `productImageDataUrl`: trocar `z.string().min(1, "...")` (required) por `z.string().min(1).optional()` — preservação **comportamental** (obrigatoriedade vira regra de exclusividade da rota) — D2
- [ ] 3.4 `.strict()` preservado — o campo novo é aditivo; payload legado continua passando — D2

## 4. Mapper flat→domínio multi-imagem (D2/D3)

- [ ] 4.1 `src/lib/campaign/brief.ts` — `buildCampaignBriefFromFlat`: mapear `productImages[]` **item a item** (`role`/`source` do transporte, `id` uuid por item, `mimeType` **real derivado do dataUrl**) — corrige o quirk `"image/jpeg"` fixo da F39 (`:161-171`) — D2/D3
- [ ] 4.2 Legado `productImageDataUrl` → **equivalente a `productImages` de 1 elemento** (primary/upload, mimeType derivado) — reuso da mesma lógica, zero bifurcação no pipeline — D2
- [ ] 4.3 Derivar `mimeType` do dataUrl (png/jpeg/webp): helper `mimeTypeFromDataUrl(dataUrl)` (ou equivalente) — D2
- [ ] 4.4 Invariante `exactly-1-primary` garantido pelo zod do domínio (sem lógica extra no mapper) — D3

## 5. Snapshot com storagePath (D5)

- [ ] 5.1 `src/lib/campaign/brief.ts` — `buildCampaignBriefSnapshot`: copiar `storagePath` quando presente no runtime — `...(i.storagePath ? { storagePath: i.storagePath } : {})` — D5
- [ ] 5.2 Snapshot serializa **N imagens** (array completo) sem base64 — type `CampaignBriefSnapshotImage` inalterado em shape — D5
- [ ] 5.3 `src/lib/campaign/brief.ts` — `CampaignProductImageInput` ganha `storagePath?: string` (tipo runtime); a **rota** preenche o campo após o upload do input (antes do snapshot); snapshot copia **sem cast/objeto paralelo** — D5

## 6. Persistência — createCampaign + helpers (D5)

- [ ] 6.1 `src/lib/campaign/persistence.ts` — `createCampaign(storeId, input, campaignId?: string)`: aceitar id pré-gerado; ausente → UUID interno (regressão) — D5
- [ ] 6.2 `persistence.ts` — novo `uploadCampaignInputImage(storeId, campaignId, imageId, { buffer, mimeType })`: transcoda para JPEG via `transcodeToJpeg` (reuso `image-processor.ts`), upload em `{storeId}/{campaignId}/inputs/{imageId}.jpg` (service_role, contentType `image/jpeg`, `upsert: false`) — D5
- [ ] 6.3 `persistence.ts` — novo `removeCampaignInputs(storeId, campaignId)`: lista e remove objetos em `{storeId}/{campaignId}/inputs/` (no-op sem objetos) — D5
- [ ] 6.4 `src/lib/campaign/types.ts` — `CreateCampaignInput` estendido com `campaignId?` e `storagePaths?` opcionais — D5

## 7. Rota — exclusividade, teto, campaignId pré-gerado, upload de inputs, cleanup (D2/D5/D10)

- [ ] 7.1 `src/app/api/campaign/generate-image/route.ts` — **regra de exclusividade** (D2): `productImages` + `productImageDataUrl` ausente → usa `productImages`; legado → `productImageDataUrl`; **ambos ausentes → 400** "Imagem do produto é obrigatória" (`:118-123` co-migrado, não mais erro do Zod); **ambos presentes → 400** "payload ambíguo" — D2
- [ ] 7.2 Limites na rota (D10): por item `dataUrl.length <= MAX_PRODUCT_IMAGE_BASE64_SIZE` (4MB) + **teto agregado** da soma dos dataUrls → 413 PT-BR indicando item/total; limite legado single permanece — D10
- [ ] 7.3 **Ordem D5:** pré-gerar `campaignId` (`crypto.randomUUID()`); gerar/normalizar `id` por imagem (uuid — cliente não envia id); **upload dos inputs** via `uploadCampaignInputImage` ANTES de montar o snapshot; montar snapshot com `storagePath` por imagem; `createCampaign(storeId, input, campaignIdPreGerado)` — D2/D5
- [ ] 7.4 **Limpeza pré-stream:** falha no upload de inputs ou no fluxo pré-stream → `removeCampaignInputs` (sem órfãos); falha pós-stream → `deleteCampaignImage(storagePath)` atual permanece — D5
- [ ] 7.5 `inputSnapshot` construído **após** os uploads de inputs (mudança de ordem em `route.ts:359-366`) — D5
- [ ] 7.6 `recordCall`/telemetria (`AiCostTracker`) inalterada — a chamada continua 1 evento `campaign_image` (imagens entram como tokens do mesmo input) — D7

## 8. Provider — N input_image e fallback gated (D7)

- [ ] 8.1 `src/lib/image-generation/providers/types.ts`: `ImageProviderInput` ganha `productImagesDataUrls?: string[]` (lista ordenada, índice 0 = primary); `productImageDataUrl?` mantido para o legado — D7
- [ ] 8.2 `src/lib/image-generation/providers/openai.ts` — mainline Responses path (`:71-73`): montar **N blocos `input_image`** (primary + auxiliares); identidade/logo continua `detail: "low"` — D7
- [ ] 8.3 **Fallback `images.edit` gated** (`:58-61, 225-307`): SÓ com primary única (1 imagem), enviando **apenas o `productFile`** (identidade/logo **fora do fallback** — limitação pré-existente `openai.ts:282-287`); com auxiliares → retries permanecem no Responses path; Responses indisponível → erro explícito (sem descartar imagens) — D7

## 9. Service — ponte lista N, validação primary-only, review com primary (D7/D8/D9)

- [ ] 9.1 `src/lib/image-generation/services/image-generation-service.ts`: ponte `primaryImageDataUrl(brief)` → **`mediaImagesDataUrls(brief)`** (lista ordenada; posição 0 = primary) — D7
- [ ] 9.2 Service monta `ImageProviderInput` com `productImagesDataUrls` (ou `productImageDataUrl` legado para 1 imagem) — D7
- [ ] 9.3 `src/lib/image-generation/services/input-validation-service.ts`: `validate(nome, ...)` continua **primary-only** (recebe apenas a dataUrl da primary) — D8
- [ ] 9.4 `src/lib/image-generation/services/image-review-service.ts`: `review` passa a receber, **opcionalmente**, a dataUrl da primary e envia ao prompt `campaign-image-reviewer` (bloco de imagem + linha fixa "Compare o produto da arte com a imagem de referência"); retrocompatível (sem primary → comportamento atual) — D9

## 10. Prompts — bloco descritivo 1+N referências (D6)

- [ ] 10.1 `prompts/campaign-image-director.md`: substituir a linha única ("A imagem do produto foi enviada como referência visual fiel") pelo **bloco descritivo** (1 primary = herói visual; N auxiliares = contexto/ângulos/variações; **sem inventar conteúdo**) — **sem placeholder/variável** — D6
- [ ] 10.2 `prompts/campaign-image-director-offer.md`: idem — D6
- [ ] 10.3 `prompts/campaign-image-director-spotlight.md`: idem — D6
- [ ] 10.4 `prompts/campaign-image-director-exclusive.md`: idem — D6
- [ ] 10.5 Golden por intent **inalterado**: `EXPECTED_KEYS = 38` por intent (o texto muda; o conjunto de variáveis não) — D6

## 11. Form/UI — estado multi-imagem e body (D2/D3/D4/D10)

- [ ] 11.1 `src/components/flow/use-campaign-form.ts` — state: `imageFile: File | null` → **array** `productImages: Array<{ id, role, source, mimeType, file?, dataUrl? }>` (primeiro = primary; demais = `reference`; id é INTERNO da UI — nunca no body) — D3
- [ ] 11.2 `compressImage` **por item** (JPEG ≤1MB, downscale 1200px) + HEIC decode via canvas + orientação EXIF (`createImageBitmap` `from-image`) — D4
- [ ] 11.3 `validateImage` aceita `image/heic`/`image/heif` no input; falha de decode → mensagem PT-BR clara orientando JPG/PNG (sem dependência de lib) — D4
- [ ] 11.4 Montagem do body (D2): com auxiliares → `body.productImages = productImages.map(({ role, source, mimeType, dataUrl }) => ({ role, source, mimeType, dataUrl }))` (SEM id de cliente); sem auxiliares → `body.productImageDataUrl = <dataUrl da primary>` (legado) — D2
- [ ] 11.5 Draft/autosave restaura **N imagens** (estado multi preservado) + `EMPTY_FIELDS`/`FieldErrors` atualizados (sem novos requireds) — D3
- [ ] 11.6 `src/components/flow/campaign-image-upload.tsx`: multi-arquivo + `capture="environment"` (câmera) + preview grid + remoção por item + origem `source: "upload" | "camera"` + teto no cliente — D3/D4/D10
- [ ] 11.7 `src/components/flow/campaign-input-form.tsx`: campo "Imagem do Produto *" (primary) + seção "Imagens adicionais" (até `MAX_CAMPAIGN_IMAGES - 1`) + controles de câmera/galeria — D3/D4
- [ ] 11.8 Co-migrar mock `CampaignImageUpload` em `campaign-flow-credits.test.tsx` (novo componente multi) — D3/D4

## 12. Testes — Transporte e mapper (D2/D3/D5) — 8 testes

- [ ] 12.1 Teste 1: `productImages[]` com primary + 2 reference → mapper gera `media.images` com roles/source/mimeType corretos — D2/D3
- [ ] 12.2 Teste 2: `productImages` ausente + `productImageDataUrl` → comportamento legado idêntico (1 item primary/upload) — D2
- [ ] 12.3 Teste 3: `productImages` sem primary ou com 2 primaries → rejeitado (invariante no transporte) — D2
- [ ] 12.4 Teste 4: `productImages` + `productImageDataUrl` juntos → 400 ambíguo (rota) — D2
- [ ] 12.5 Teste 5: `mimeType` derivado do dataUrl (png/jpeg/webp) — corrige quirk da F39 — D2
- [ ] 12.6 Teste 6: snapshot com N imagens: **sem dataUrl**, com `storagePath` por imagem — D5
- [ ] 12.7 Teste 7: legado com 1 imagem → comportamento e shape preservados (regressão): snapshot sem base64 com `mimeType: "image/jpeg"`; no teste unitário sem upload `storagePath` fica ausente — a primary ganha `storagePath` aditivo apenas no fluxo de rota F41 (D5 nos dois fluxos — decisão do usuário 2026-08-14) — D2/D5
- [ ] 12.8 Teste 8: exatamente 1 primary no snapshot/domínio (zod) para N imagens — D3

## 13. Testes — UI / form (D3/D4/D10) — 8 testes

- [ ] 13.1 Teste 9: primary obrigatória; auxiliares opcionais até `MAX_CAMPAIGN_IMAGES - 1` — D3/D10
- [ ] 13.2 Teste 10: seleção/remoção/preview por item; remover primary → validação — D3
- [ ] 13.3 Teste 11: origem câmera → `source: "camera"`; galeria → `source: "upload"` — D4
- [ ] 13.4 Teste 12: HEIC aceito no input; decode via canvas → JPEG; falha → mensagem PT-BR clara — D4
- [ ] 13.5 Teste 13: orientação EXIF respeitada na compressão (`createImageBitmap from-image`) — D4
- [ ] 13.6 Teste 14: body: com auxiliares → `productImages[]` (sem id de cliente); sem auxiliares → `productImageDataUrl` legado — D2
- [ ] 13.7 Teste 15: draft/autosave restaura N imagens (estado multi preservado) — D3
- [ ] 13.8 Teste 16: erros de limite por item e teto agregado exibidos no form — D10

## 14. Testes — Pipeline / provider / review (D6/D7/D8/D9/D10) — 11 testes

- [ ] 14.1 Teste 17: provider Responses recebe N `input_image` (primary + auxiliares) — D7
- [ ] 14.2 Teste 18: fallback `images.edit` SÓ com primary única; com auxiliares → NÃO usa edit — D7
- [ ] 14.3 Teste 19: sem primary/legado → caminho atual 1 imagem (regressão) — D7
- [ ] 14.4 Teste 20: golden por intent: **mesmo conjunto de 38 keys** com multi-imagem; texto do prompt muda intencionalmente — D6
- [ ] 14.5 Teste 21: bloco descritivo 1+N referências presente nos 4 prompts — D6
- [ ] 14.6 Teste 22: `InputValidationService` usa apenas a primary (primary-only) — D8
- [ ] 14.7 Teste 23: review recebe a primary como referência de fidelidade; sem primary → comportamento atual — D9
- [ ] 14.8 Teste 24: teto agregado do `productImages[]` excede → 413; item individual > 4MB → 413 — D10
- [ ] 14.9 Teste 25: rota: upload de inputs pré-snapshot com `campaignId` e `imageId` **gerados pela rota**; `storagePath` no snapshot — D5
- [ ] 14.10 Teste 26: limpeza: falha pré-stream remove inputs já enviados — D5
- [ ] 14.11 Teste 27: ausência de `productImageDataUrl` → 400 da **rota** (não mais erro direto do Zod) — co-migração dos testes antigos — D2

## 15. Regressão e co-migração de fixtures (D2/D5/D7)

- [ ] 15.1 `route.test.ts`: fixtures `productImages[]` + legado + teto + erros 400/413 + storage (upload de inputs/campaignId pré-gerado); testes que esperavam erro do Zod por ausência de `productImageDataUrl` → 400 da rota (teste 27) — D2/D5/D10
- [ ] 15.2 `brief-mapper.test.ts`: mapeia array + invariante + snapshot storagePath — D2/D3/D5
- [ ] 15.3 `brief-snapshot.test.ts`: N imagens sem base64, com `storagePath` — D5
- [ ] 15.4 `image-generation-service.test.ts`: lista N de dataUrls no provider (`mediaImagesDataUrls`); golden 38 keys — D6/D7
- [ ] 15.5 `openai-provider.test.ts`: N `input_image`; fallback gated — D7
- [ ] 15.6 `image-review-service.test.ts`: review com primary como referência — D9
- [ ] 15.7 `use-campaign-form-navigation.test.ts`: novo state multi no `EMPTY_FIELDS` — D3
- [ ] 15.8 `campaign-flow-credits.test.tsx`: mock do upload multi co-migrado — D3/D4
- [ ] 15.9 Regressão `generate-image` — fluxo completo (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterado** para o payload legado de 1 imagem — D2/D7
- [ ] 15.10 Regressão `createCampaign` com `campaignId` pré-gerado e sem ele — D5
- [ ] 15.11 Verificar `npx vitest run` com suíte completa (novos + co-migrados passando) — D2-D10

## 16. Verificação (gates + UAT)

- [ ] 16.1 `npx vitest run` — zero falhas (novos + existentes + co-migrados) — D2-D10
- [ ] 16.2 `npm run typecheck` — zero erros
- [ ] 16.3 `npm run lint` — zero erros
- [ ] 16.4 `npm run build` — build bem-sucedido
- [ ] 16.5 UAT local: gerar campanha com 1 imagem (legado) → comportamento/UX idênticos ao pós-F40; snapshot sem base64 preservado, mas com `storagePath` aditivo para a primary quando passa pela rota F41 (D5 nos dois fluxos — decisão do usuário 2026-08-14; `storagePath` ausente só em campanhas pré-F41 ou caminhos excepcionais sem upload) — D2
- [ ] 16.6 UAT local: gerar campanha com primary + 2 auxiliares (galeria) → `media.images[]` com 3 itens (roles/source/mimeType corretos); arte com herói = primary e contexto das auxiliares — D2/D3/D6
- [ ] 16.7 UAT local: câmera no celular (foto nova) — HEIC/EXIF ok, arte correta — D4
- [ ] 16.8 UAT local: remover/adicionar auxiliares e regenerar — preview e payload consistentes — D3
- [ ] 16.9 UAT local: upload sem primary válida → erro claro (400 na rota) — D2
- [ ] 16.10 UAT local: campanha antiga (pré-F41) continua exibindo/baixando normalmente (sem migração destrutiva) — D5
- [ ] 16.11 UAT celular real obrigatória: foto vertical/horizontal, iOS (HEIC) e Android — orientação EXIF correta e decode HEIC OK — D4
