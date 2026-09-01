# Phase 41: Mídia de Campanha Mobile — Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-41-midia-de-campanha-mobile/`)

<domain>
## Phase Boundary

A F39 deixou o **domínio de mídia pronto para múltiplas imagens** — `CampaignImageRole = "primary" | "variation" | "combo_item" | "reference"` e `CampaignImageSource = "upload" | "camera"` já existem (`brief.ts:21-23`), o zod valida `media.images[]`, e `buildCampaignBriefSnapshot` mapeia o array inteiro (`brief.ts:216-235`). Mas **todas as costuras single-image ainda falam de UMA imagem**. A F41 cresce essas costuras de 1→N mantendo compatibilidade total com o fluxo atual de 1 imagem (`productImageDataUrl` continua válido), adiciona **câmera/HEIC/EXIF**, e **persiste os inputs no storage** (decisão arquitetural D5) para que a F37 (revisão/aprovação) possa exibir/reusar a imagem original. Também renumera os trackings (F41 = Mídia de Campanha Mobile, Stripe → F42).

**Estado real verificado em código:**

- **Domínio já multi-imagem-ready:** `CampaignImageRole`/`CampaignImageSource` (`brief.ts:21-23`); `CampaignProductImageInput` runtime com `dataUrl?` (`brief.ts:29-35`) **sem `storagePath`**; `CampaignBriefSnapshotImage` snapshot tem `storagePath?`/`productAssetId?` **reservados** (`brief.ts:39-47`); zod do domínio valida exatamente 1 `primary` (`brief-schema.ts:60-86`); `buildCampaignBriefSnapshot` mapeia o **array inteiro** (`brief.ts:216-235`)
- **Transporte flat:** `GenerateImageRequestSchema` tem apenas `productImageDataUrl` **required** (`schema.ts:30`) e `.strict()` (`schema.ts:37`). O tipo `CampaignProductImageInput` do domínio **não é usado no transporte**
- **Mapper:** `buildCampaignBriefFromFlat` hardcoda 1 imagem (`role: "primary"`, `source: "upload"`, `mimeType: "image/jpeg"` mesmo para PNG — `brief.ts:161-171`)
- **Form/UI:** `CampaignFormFields.imageFile: File | null` single (`use-campaign-form.ts:86`); `compressImage` JPEG ≤1MB/1200px single (`use-campaign-form.ts:12-74`); `validateImage` aceita apenas PNG/JPG/WEBP e rejeita HEIC (`use-campaign-form.ts:197-207`); body envia `productImageDataUrl: imageDataUrl` (`use-campaign-form.ts:737`). `CampaignImageUpload` é 1 `<input type=file>` sem `capture` (`campaign-image-upload.tsx:6-85`)
- **Provider:** `ImageProviderInput.productImageDataUrl?` (`providers/types.ts:8`); `attempt >= 1` com imagem → fallback `images.edit` que aceita apenas **1 base image** (`openai.ts:59`, limitação documentada em `openai.ts:282-287`); mainline Responses API monta 1 `input_image` (`openai.ts:71-73`)
- **Validação produto×imagem:** `InputValidationService.validate(nome, 1 imagem)` — uma chamada vision antes da geração (`input-validation-service.ts:40-71`)
- **Review:** `ImageReviewService.review(generatedImage, input)` — o revisor **não recebe** a imagem do produto (`image-review-service.ts:54-63`)
- **Rota:** presença + limite `MAX_PRODUCT_IMAGE_BASE64_SIZE = 4MB` single (`route.ts:117-135`); `inputSnapshot` construído **antes** de `createCampaign` (`route.ts:359-366`)
- **Persistência:** `createCampaign` gera o `campaignId` internamente e fixa `storage_path` (`persistence.ts:5-33`); `uploadCampaignImage` single JPEG (`persistence.ts:60-84`); bucket `campaign-images` privado com policies service_role insert/delete + owner select por prefixo `storeId` (`20260708000002_create_campaign_images_bucket.sql`); `CreateCampaignInput` sem `campaignId`/`storagePaths` (`campaign/types.ts:26-34`)
- **Limites atuais:** `MAX_PRODUCT_IMAGE_BASE64_SIZE = 4MB` e `MAX_PRODUCT_IMAGE_FILE_SIZE = 1MB` (`config.ts:27-28`)

**O que esta fase entrega:**

- **Form multi-imagem (D3/D4/D10)** — campo "Imagem do Produto *" (primary, obrigatória) + seção "Imagens adicionais" (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`), galeria + **câmera** (`capture="environment"`), preview grid com remoção por item, `source: "upload" | "camera"` por item, decode HEIC via canvas **sem dependência de lib**, orientação EXIF respeitada (`createImageBitmap from-image`), limites por item (≤5MB) e teto no cliente
- **Transporte aditivo (D2/D10)** — `productImages[]` novo campo opcional no `GenerateImageRequestSchema` (item `{ role, source, mimeType, dataUrl }` **sem `id`** — a rota gera/normaliza — `.min(1).max(MAX_CAMPAIGN_IMAGES = 4)` com `superRefine` de exatamente 1 `primary`); `productImageDataUrl` deixa de ser `required` no Zod (preservação **comportamental**); `.strict()` preservado; **regra de exclusividade validada na rota** (ambos ausentes → 400 "Imagem do produto é obrigatória"; ambos presentes → 400 payload ambíguo)
- **Mapper flat→domínio multi-imagem (D2/D3)** — `buildCampaignBriefFromFlat` mapeia `productImages[]` item a item (roles/source do transporte, `mimeType` **real derivado do dataUrl** — corrige o quirk `"image/jpeg"` fixo da F39) e trata o legado como `productImages` de 1 elemento (zero bifurcação no pipeline); invariante `exactly-1-primary` garantido pelo zod do domínio
- **Persistência dos inputs no storage (D5 — decisão arquitetural)** — inputs sobem ao bucket `campaign-images` em `{storeId}/{campaignId}/inputs/{imageId}.{ext}`, com `storagePath` por imagem gravado no snapshot; rota **pré-gera o `campaignId`** e o `id` de cada imagem, faz o **upload antes de montar o snapshot** e chama `createCampaign(storeId, input, campaignIdPreGerado)` (assinatura com parâmetro opcional); tipo runtime `CampaignProductImageInput` ganha `storagePath?: string`; limpeza em falha pré-stream (`removeCampaignInputs`, sem órfãos)
- **Pipeline/prompt/review adaptados (D6/D7/D8/D9)** — provider recebe **N `input_image`** no mainline Responses path (`productImagesDataUrls: string[]`, posição 0 = primary); prompt ganha bloco descritivo 1+N referências **sem nova variável** (golden `EXPECTED_KEYS = 38` preservado por intent); **fallback `images.edit` só com primary única** (com auxiliares → Responses ou erro explícito); validação semântica produto×imagem **primary-only** na v1; revisor passa a receber a **primary como referência de fidelidade** (retrocompatível)
- **Limites (D10)** — `MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares); por item: formatos PNG/JPG/WEBP (+HEIC decode) e compressão ≤1MB/downscale 1200px no cliente, `dataUrl <= 4MB` na rota; **teto agregado** do `productImages[]` na rota (413) para não estourar o body do Vercel/Next nem o custo do modelo; erros 400/413 claros em PT-BR
- **Renumeração de trackings (D1)** — F41 = **Mídia de Campanha Mobile** (v1.5); Stripe / Monetização Pública → **F42** (v1.7, pós-beta). Runbook 6 arquivos (ROADMAP raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`). Pré-requisito de limpeza: F40 arquivada (folder não consta como in-progress; rodapé `.planning/ROADMAP.md` não diz mais "Fase 40 ... em PLANEJAMENTO")

## Constraints

- **NENHUMA migration SQL (D5)** — snapshot `campaign_brief_v1` (jsonb tolerante) e bucket `campaign-images` existente comportam a mudança; sem nova policy (service_role insert/delete e owner select por prefixo `storeId` já cobrem o subpath de inputs); campanhas antigas (pré-F41) com `input_snapshot` sem `storagePath` continuam exibindo/baixando normalmente
- **`productImageDataUrl` legado preservado (D2)** — payload antigo funciona e produz o mesmo resultado (preservação comportamental); a obrigatoriedade passa a ser garantida pela **regra de exclusividade validada na rota** (400), não pelo Zod — testes antigos que esperavam erro do Zod por ausência de `productImageDataUrl` precisam ser co-migrados (teste 27)
- **`productImages` + `productImageDataUrl` são mutuamente exclusivos (D2)** — ambos presentes → 400 (payload ambíguo); `.strict()` preservado (campo novo é aditivo)
- **Auxiliares entram como `role: "reference"` (D3)** — a UI/form v1 nunca envia `variation`/`combo_item` (roles avançadas permanecem no domínio/zod para extensão futura F37/catálogo); o **transporte aceita os 4 roles** (contrato D2) e o **mapper apenas espelha**
- **Ids de imagem gerados pela ROTA, nunca pelo cliente (D2/D5)** — o cliente não envia `id`; a rota gera/normaliza uuid por imagem; o mesmo `id` alimenta o path `{imageId}` e o snapshot
- **HEIC/HEIF sem dependência de lib (D4)** — decode via canvas (browsers que decodificam HEIC para `drawImage` convertem para JPEG no `toBlob`); falha → mensagem PT-BR clara orientando JPG/PNG; `heic2any`/`libheif` como alternativa futura se o UAT com celular real mostrar necessidade
- **Orientação EXIF respeitada (D4)** — `createImageBitmap(file, { imageOrientation: "from-image" })` antes do desenho no canvas; **UAT obrigatória com celular real** (foto vertical/horizontal, iOS e Android)
- **Fallback `images.edit` gated por primary única (D7)** — SÓ quando há APENAS a primary (1 imagem), enviando **apenas o `productFile`** (identidade/logo fora do fallback — limitação pré-existente `openai.ts:282-287`); com auxiliares → retries permanecem no Responses path; Responses indisponível → **erro explícito** (sem degradar a fidelidade descartando imagens)
- **Prompt sem nova variável (D6)** — imagens entram como **input multimodal**; bloco descritivo 1+N hardcoded nos 4 prompts; golden `EXPECTED_KEYS = 38` por intent **permanece idêntico** (o texto muda intencionalmente)
- **Validação produto×imagem primary-only (D8)** — `InputValidationService.validate` continua validando **apenas a primary**; auxiliares não participam; fluxo de 409 (conflict / low-confidence / strong_conflict / override `user_confirmed_continue`) **inalterado**
- **Revisor com primary retrocompatível (D9)** — `ImageReviewService.review` recebe **opcionalmente** a dataUrl da primary e envia junto ao prompt `campaign-image-reviewer` (bloco de imagem + linha fixa "Compare o produto da arte com a imagem de referência"); sem primary → comportamento atual; receber **TODAS** as imagens fica deferido
- **Teto no cliente e na rota (D10)** — UI impede adicionar além de `MAX_CAMPAIGN_IMAGES`; rota valida por item (4MB) + teto agregado (413); o limite legado single permanece para `productImageDataUrl`
- **Telemetria inalterada (D7)** — `AiCostTracker`/`recordCall` continua 1 evento `campaign_image` (imagens entram como tokens do mesmo input); `providerUsageRaw` continua auditoria
- **Identidade/logo multi-imagem NÃO muda (D4/Non-Goals)** — a identidade continua 1 referência (`identityImageUrl`, `detail: "low"`), inalterada
- **`CreateCampaignInput`/tipos aceitam `campaignId` e `storagePaths` opcionais (D5)** — ausentes → comportamento atual (regressão); `storage_path` da arte final permanece `{storeId}/{campaignId}.jpg`
- **Artefatos históricos não são reescritos** na renumeração D1 (padrão F40 D1 / F39 D1 / F37 D11)

## Dependencies

- F39 (Brief Estruturado de Campanha — domínio multi-imagem `media.images[]`, `CampaignImageRole`/`CampaignImageSource`, snapshot `campaign_brief_v1`, mapper `buildCampaignBriefFromFlat`, builder `buildCampaignBriefSnapshot`)
- F40 (Campos Comerciais e Avisos do Brief — form state `validity`/`mandatoryArtworkText`, constante `ILLUSTRATIVE_NOTICE_TEXT`, agrupamento Produto/Oferta/Avisos; o body do form F41 convive com os campos F40)
- F31.x (intents, prompts por intent, diretores, revisor, quality gate)
- F24/F25 (pipeline de créditos/generação — orquestração da rota, crédito, rate limit, clearance, telemetria, estorno)
- F38.1 (telemetria `AiCostTracker`/`recordCall` — inalterada na F41)
- **Antecede a F37** (Revisão e Aprovação da Arte — consome o snapshot com N imagens e `storagePath`; F41 herda pronto role/source/storagePath por imagem)
- **F42 (Stripe)** — renumerada da antiga F41 (v1.7, pós-beta) pela D1

## Key Requirements

- F41-01: Form — campo "Imagem do Produto *" (primary, obrigatória) + seção "Imagens adicionais" (opcionais, até `MAX_CAMPAIGN_IMAGES - 1`, role interna `reference`) com galeria + câmera (`capture="environment"`), preview grid com remoção por item (D3/D4/D10)
- F41-02: `source: "upload" | "camera"` atribuído por item conforme a origem real (D4)
- F41-03: `validateImage` aceita `image/heic`/`image/heif`; `compressImage` por item com decode via canvas (sem lib) e mensagem PT-BR clara na falha; orientação EXIF respeitada (`createImageBitmap from-image`) (D4)
- F41-04: Teto no cliente — UI impede adicionar além de `MAX_CAMPAIGN_IMAGES`; limites por item (formatos + ≤5MB) com erros PT-BR por item (D10)
- F41-05: State do form multi-imagem `productImages: Array<{ id (interno UI), role, source, mimeType, file?, dataUrl? }>` — primeiro = primary, demais = reference; `id` interno NUNCA entra no body; draft/autosave restaura N imagens (D3)
- F41-06: Body — com auxiliares → `body.productImages = productImages.map(({ role, source, mimeType, dataUrl }) => ({ role, source, mimeType, dataUrl }))` (SEM `id` de cliente); sem auxiliares → `body.productImageDataUrl = <dataUrl da primary>` (legado); nunca ambos (D2)
- F41-07: `campaign-image-upload.tsx` multi-arquivo + `capture="environment"` + preview grid + remoção por item + origem + teto (D3/D4/D10)
- F41-08: `campaign-input-form.tsx` — campo primary + seção "Imagens adicionais" + controles câmera/galeria (D3/D4)
- F41-09: Mock `CampaignImageUpload` co-migrado em `campaign-flow-credits.test.tsx` (D3/D4)
- F41-10: `GenerateImageRequestSchema` — `ProductImageInputSchema` exportado (item `{ role, source, mimeType, dataUrl }`, sem `id`) + `productImages: z.array(...).min(1).max(MAX_CAMPAIGN_IMAGES).superRefine(exactly-1-primary).optional()` + `productImageDataUrl` passa a `optional()` (preservação comportamental) + `.strict()` preservado (D2/D10)
- F41-11: `MAX_CAMPAIGN_IMAGES = 4` + constante de teto agregado em `config.ts` (D10)
- F41-12: `buildCampaignBriefFromFlat` mapeia `productImages[]` item a item (roles/source do transporte, `id` uuid por item, `mimeType` **real derivado do dataUrl** via helper `mimeTypeFromDataUrl`); legado `productImageDataUrl` = `productImages` de 1 elemento (zero bifurcação); invariante `exactly-1-primary` garantido pelo zod do domínio (D2/D3)
- F41-13: `buildCampaignBriefSnapshot` copia `storagePath` quando presente no runtime (`...(i.storagePath ? { storagePath: i.storagePath } : {})`) e serializa N imagens sem base64; `CampaignBriefSnapshotImage` inalterado em shape (D5)
- F41-14: `CampaignProductImageInput` ganha `storagePath?: string` (tipo runtime) — preenchido pela ROTA após o upload (sem cast/objeto paralelo) (D5)
- F41-15: `createCampaign(storeId, input, campaignId?: string)` aceita id pré-gerado (ausente → UUID interno, regressão); `CreateCampaignInput` estendido com `campaignId?`/`storagePaths?` (D5)
- F41-16: Novos helpers `uploadCampaignInputImage(storeId, campaignId, imageId, { buffer, mimeType })` (transcode JPEG via `transcodeToJpeg`, path `{storeId}/{campaignId}/inputs/{imageId}.jpg`, `contentType: "image/jpeg"`, `upsert: false`) e `removeCampaignInputs(storeId, campaignId)` (lista e remove objetos do prefixo, no-op sem objetos) (D5)
- F41-17: Rota — regra de exclusividade (ambos ausentes → 400 "Imagem do produto é obrigatória"; ambos presentes → 400 payload ambíguo); limites por item (4MB) + teto agregado (413 PT-BR); **`campaignId` pré-gerado** + `id` por imagem (uuid, rota gera); upload dos inputs ANTES do snapshot via `uploadCampaignInputImage`; `createCampaign(storeId, input, campaignIdPreGerado)`; limpeza pré-stream via `removeCampaignInputs` (sem órfãos); `inputSnapshot` construído após os uploads; `recordCall`/telemetria inalterada (D2/D5/D10/D7)
- F41-18: `ImageProviderInput` ganha `productImagesDataUrls?: string[]` (lista ordenada, posição 0 = primary); `productImageDataUrl?` mantido para o legado (D7)
- F41-19: `openai.ts` mainline Responses path monta **N blocos `input_image`** (primary + auxiliares); identidade/logo continua `detail: "low"`; fallback `images.edit` **gated** — SÓ com primary única, enviando apenas `productFile`; com auxiliares → retries no Responses ou erro explícito (D7)
- F41-20: Ponte `primaryImageDataUrl(brief)` → **`mediaImagesDataUrls(brief)`** (lista ordenada, posição 0 = primary) no `image-generation-service.ts`; `ImageProviderInput` montado com `productImagesDataUrls` (ou `productImageDataUrl` legado para 1 imagem) (D7)
- F41-21: `InputValidationService.validate` continua **primary-only** (recebe apenas a dataUrl da primary); fluxo de 409 inalterado (D8)
- F41-22: `ImageReviewService.review` recebe **opcionalmente** a dataUrl da primary (referência de fidelidade — bloco de imagem + linha "Compare o produto da arte com a imagem de referência"); retrocompatível (D9)
- F41-23: Bloco descritivo 1+N referências nos 4 prompts do diretor (hardcoded, sem placeholder/variável) — primary = herói visual, auxiliares = contexto (ângulos/variações/combos), sem inventar conteúdo (D6)
- F41-24: Golden por intent **inalterado** — `EXPECTED_KEYS = 38` por intent (texto muda; conjunto de variáveis não) (D6)
- F41-25: Testes novos ~32+ — transporte/mapper 8 (1-8), UI/form 8 (9-16), pipeline/provider/review 11 (17-27), regressão e co-migração de fixtures (15.1-15.11) (D2-D10)
- F41-26: Trackings D1 (renumeração F41/F42 nos 6 arquivos de runbook — F41 = Mídia de Campanha Mobile, Stripe → F42) + pré-requisito de limpeza F40 (D1)
- F41-27: Verificação — `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` zero erros + UAT local (legado idêntico, primary+auxiliares, câmera HEIC/EXIF, remover/adicionar, sem primary → erro claro, campanha antiga) + **UAT celular real obrigatória** (D1-D10)

## Out of Scope

- Expor roles avançadas ao lojista (`variation`/`combo_item`) — D3 (auxiliares entram como `reference`; roles avançadas internas, extensão futura F37/catálogo)
- Validação produto×imagem multi-imagem — D8 (primary-only na v1; multi-imagem deferida)
- Review com TODAS as imagens — D9 (revisor recebe a primary; todas deferido)
- Dependência de lib HEIC (`heic2any`/`libheif`) — D4 (decode via canvas; lib só se o UAT com celular real mostrar necessidade)
- Catálogo de produtos por loja / `productAssetId` — fase subsequente (F39 D3)
- Stripe / Monetização Pública — F42 (v1.7, pós-beta) — renumeração D1
- F37 — Revisão e Aprovação da Arte — fase própria, após F41; consome o snapshot com N imagens
- Migration SQL — D5 (snapshot `campaign_brief_v1` jsonb tolerante e bucket existente comportam a mudança)
- Identidade/logo multi-imagem — a identidade continua 1 referência (`identityImageUrl`, `detail: "low"`), inalterada
</domain>

<decisions>
## Implementation Decisions

### D1 — Numeração: F41 = Mídia de Campanha Mobile (v1.5), Stripe → F42 (v1.7) + runbook de trackings
`DECIDIDO` (segue o precedente F40 D1 / F39 D1 / F37 D11: a fase conflitante é incrementada, não apagada). F41 = Mídia de Campanha Mobile (nova, v1.5); F42 = Stripe / Monetização Pública (v1.7, pós-beta — renumerada de F39, de F40 e de F41). Runbook de atualização em 6 arquivos (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) na ordem da D1. **Pré-requisito de limpeza:** a F40 deve estar arquivada/limpa antes de abrir a F41 (folder `openspec/changes/fase-40-campos-comerciais-avisos-brief/` não consta como in-progress no `openspec list`; rodapé `.planning/ROADMAP.md` não diz mais "Fase 40 ... em PLANEJAMENTO"). Artefatos históricos não reescritos; `openspec/changes/fase-41-midia-de-campanha-mobile/` = fonte da verdade.

### D2 — Transporte aditivo: `productImages[]` novo campo opcional; `productImageDataUrl` legado preservado
`DECIDIDO` (mantém compatibilidade com 1 imagem — comportamento atual idêntico para payload antigo). Novo campo opcional no `GenerateImageRequestSchema` (`productImages: z.array(ProductImageInputSchema).min(1).max(MAX_CAMPAIGN_IMAGES).superRefine(exactly-1-primary).optional()`); o item **NÃO carrega `id`** (a rota gera/normaliza — D5); **regra de exclusividade/compatibilidade determinística validada na rota**: (1) `productImages` presente + `productImageDataUrl` ausente → válido (exatamente 1 `primary`); (2) `productImages` ausente + `productImageDataUrl` presente → legado (mapper gera 1 primary/upload); (3) ambos ausentes → 400 "Imagem do produto é obrigatória"; (4) **ambos presentes → 400 (payload ambíguo)** — mutuamente exclusivos, não "substitui". `.strict()` preservado. `productImageDataUrl` deixa de ser `required` no Zod (preservação **comportamental**, não estrutural) — a obrigatoriedade passa a ser garantida pela regra da rota. Mapeamento legado = `productImages` de 1 elemento no mapper (zero bifurcação). Testes/fixtures antigos que esperavam erro do Zod por ausência → 400 da rota (teste 27).

### D3 — Roles na v1: primary explícita + auxiliares como `reference`; roles avançadas internas
`DECIDIDO` (UI simples para o lojista; domínio mantém os 4 roles para extensão futura). UI expõe 1 campo "Imagem do Produto *" (obrigatório, = primary) + seção "Imagens adicionais" (opcionais, até 3). Internamente: a primeira imagem é sempre `role: "primary"`; as auxiliares são gravadas com `role: "reference"` (semântica neutra de apoio/referência). `variation`/`combo_item` permanecem no domínio/zod (`brief-schema.ts:15`) **sem exposição ao lojista** na v1 — a UI/form nunca envia esses roles; o **transporte aceita os 4 roles** (contrato D2) e o **mapper apenas espelha**. Inferência automática de roles = extensão futura (F37/catálogo). `source: "upload" | "camera"` conforme a origem real (D4).

### D4 — Câmera/mobile: `capture`, HEIC sem nova dependência, EXIF respeitado
`DECIDIDO` (câmera entra no escopo com HEIC/EXIF decididos — não apenas "bonito e quebra na mão"). `CampaignImageUpload` ganha múltiplos arquivos + `capture="environment"` (câmera traseira no mobile). `validateImage` aceita `image/heic`/`image/heif`; `compressImage` tenta decodificar via canvas (browsers que decodificam HEIC para `drawImage` convertem para JPEG no `toBlob`); falha → mensagem PT-BR clara orientando JPG/PNG. Sem dependência de lib HEIC na v1 (`heic2any`/`libheif` como alternativa futura se o UAT com celular real mostrar necessidade). Orientação EXIF respeitada via `createImageBitmap(file, { imageOrientation: "from-image" })` antes do desenho. **UAT obrigatória com celular real** (foto vertical/horizontal, iOS e Android).

### D5 — Persistência dos inputs no storage (decisão arquitetural)
`DECIDIDO` (a F37 vai precisar exibir/reusar a imagem original; persistir inputs já nesta fase). Bucket: **reuso do `campaign-images`** (sem migration; policies existentes — service_role insert/delete, owner select por prefixo `storeId`). Inputs em path `{storeId}/{campaignId}/inputs/{imageId}.{ext}` (objeto imutável, sem UPDATE). Ordem de criação: (1) rota **pré-gera o `campaignId`** (`crypto.randomUUID()`); (2) **gera/normaliza um `id` por imagem** (uuid — cliente não envia id); (3) **upload dos inputs** via `uploadCampaignInputImage` (transcode JPEG via `transcodeToJpeg`, `contentType: "image/jpeg"`, `upsert: false`); (4) monta o snapshot **com `storagePath` por imagem**; (5) `createCampaign(storeId, input, campaignIdPreGerado)` (parâmetro opcional). `CreateCampaignInput` aceita `campaignId`/`storagePaths` opcionais; `storage_path` da arte final permanece `{storeId}/{campaignId}.jpg`. `buildCampaignBriefSnapshot` copia `storagePath` quando presente. `CampaignProductImageInput` ganha `storagePath?: string` — a rota preenche após o upload e **antes** de montar o snapshot (sem cast/objeto paralelo). Limpeza: falha pré-stream → `removeCampaignInputs` (sem órfãos); falha pós-stream → `deleteCampaignImage(storagePath)` atual. **Sem migration SQL.**

### D6 — Prompt e golden: bloco descritivo sem nova variável; EXPECTED_KEYS = 38 preservado
`DECIDIDO` (regressão por intent estável — o conjunto de variáveis NÃO muda). Antes: linha única "A imagem do produto foi enviada como referência visual fiel" (`campaign-image-director.md:49`, e equivalentes nos 3 prompts por intent). Depois (nos 4 prompts, hardcoded, sem placeholder): bloco que descreve a presença de **1 imagem principal + N imagens auxiliares de referência**, instruindo o diretor a usar a principal como herói visual e as auxiliares como contexto (ângulos/variações/combos) **sem inventar conteúdo**. **Sem nova variável de prompt** → golden `EXPECTED_KEYS = 38` (por intent) **permanece idêntico** (regra F40-13 mantida). O texto do prompt muda intencionalmente; as imagens entram como **input multimodal**, não como variável textual. Teste golden por intent continua: mesmo conjunto de 38 keys para o mesmo input.

### D7 — Provider e fallback: N `input_image` no Responses; edit só com primary única
`DECIDIDO` (política fechada — o fallback não mente sobre o que consegue fazer). `ImageProviderInput` ganha `productImagesDataUrls?: string[]` (lista ordenada: posição 0 = primary); `productImageDataUrl?` mantido para o legado. A ponte `primaryImageDataUrl(brief)` vira `mediaImagesDataUrls(brief)` no service. Mainline Responses path monta **N blocos `input_image`** (primary + auxiliares; identidade/logo continua `detail: "low"`). Fallback `images.edit` **SÓ permitido quando há APENAS a primary** (1 imagem), enviando **apenas o `productFile`** (identidade/logo **fora do fallback** — limitação pré-existente `openai.ts:282-287`); com auxiliares → retries permanecem no Responses path; Responses indisponível → **erro explícito** (sem degradar a fidelidade descartando imagens). Custo/telemetria (`AiCostTracker`/`recordCall`) permanece — 1 evento `campaign_image` (imagens entram como tokens do mesmo input).

### D8 — Validação semântica produto×imagem: primary-only na v1
`DECIDIDO` (uma chamada vision, comportamento atual preservado; custo contido). `InputValidationService.validate(nome, productImageDataUrl)` continua validando **apenas a imagem principal** contra o nome digitado. Auxiliares **não participam** da checagem de conflito/confiança. Fluxo de 409 (conflict / low-confidence / strong_conflict / override `user_confirmed_continue`) **inalterado**. Extensão futura (registrada): validação multi-imagem quando roles avançadas forem expostas.

### D9 — Review com a imagem principal como referência de fidelidade
`DECIDIDO` (alinhado ao escopo "review adaptado"; custo baixo — 1 imagem de visão extra). `ImageReviewService.review(generatedImage, input)` passa a receber, **opcionalmente**, a **dataUrl da imagem principal** e a envia junto ao prompt `campaign-image-reviewer` (bloco de imagem + texto). O revisor passa a verificar a **fidelidade do produto na arte gerada** (o produto da referência é o produto da peça). **Sem nova variável de prompt do revisor** (a imagem entra como input multimodal; o texto pode ganhar a linha fixa "Compare o produto da arte com a imagem de referência"). **Retrocompatível:** sem `productImagesDataUrls`/sem primary → comportamento atual. Receber **TODAS** as imagens no review fica **deferido**.

### D10 — Limites e formatos: teto agregado + validação por item
`DECIDIDO` (payload do Vercel/Next e custo do modelo contidos). `MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares). Por item (cliente): formatos PNG/JPG/WEBP (+ HEIC decode via canvas, D4); compressão existente (JPEG ≤1MB, downscale 1200px) por imagem; limite de arquivo 5MB no input. Por item (rota): `dataUrl.length <= MAX_PRODUCT_IMAGE_BASE64_SIZE` (4MB) para cada item + **teto agregado** do `productImages[]` (soma dos dataUrls) → 413 PT-BR indicando item/total. O limite legado single permanece para `productImageDataUrl`. Erros 400/413 claros em PT-BR indicando qual item excedeu e o limite (formato / tamanho / total).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fonte da verdade (OpenSpec F41)
- `openspec/changes/fase-41-midia-de-campanha-mobile/proposal.md` — Why / What Changes / Impact (12 capabilities modified, ~32+ testes)
- `openspec/changes/fase-41-midia-de-campanha-mobile/design.md` — decisões D1–D10 (contexto real em código nas linhas 3-15)
- `openspec/changes/fase-41-midia-de-campanha-mobile/tasks.md` — 16 seções de tarefas (1 trackings … 16 verificação; testes numerados 1–27)
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/campaign-types/spec.md` — `CreateCampaignInput` com `campaignId?`/`storagePaths?` + assinatura de `createCampaign`
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/campaign-brief-contract/spec.md` — invariante exactly-1-primary no transporte + regra de exclusividade 400 + `CampaignProductImageInput.storagePath?`
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/campaign-brief-mapper/spec.md` — mapper multi-imagem item a item + `mimeType` derivado + legado = 1 elemento
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/campaign-brief-snapshot/spec.md` — snapshot N imagens sem base64 + `storagePath` copiado + builder
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/campaign-brief-pipeline-adapters/spec.md` — ponte `mediaImagesDataUrls(brief)` + `ImageReviewInput` com primary
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/campaign-media-upload/spec.md` — comportamento do upload multi (origens, preview, HEIC/EXIF, limites)
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/campaign-input-ui/spec.md` — form state multi + seções + body do submit
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/ai-image-generation/spec.md` — transporte + provider N input_image + fallback gated + review com primary + prompt 1+N
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/transactional-pipeline/spec.md` — pré-stream (exclusividade 400/413 + campaignId pré-gerado + upload inputs + cleanup)
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/generation-retry-fallback/spec.md` — fallback edit gated por primary única
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/validation-review-alignment/spec.md` — validação primary-only + review com primary
- `openspec/changes/fase-41-midia-de-campanha-mobile/specs/campaign-persistence-service/spec.md` — `createCampaign` com campaignId opcional + `uploadCampaignInputImage` + `removeCampaignInputs`

### Código afetado (estado real verificado)
- `src/lib/campaign/brief.ts` — `CampaignImageRole`/`CampaignImageSource` (21-23), `CampaignProductImageInput` (29-35, ganha `storagePath?`), `CampaignBriefSnapshotImage` (39-47, `storagePath?` já reservado), mapper `buildCampaignBriefFromFlat` (146, hardcode single 161-171), builder `buildCampaignBriefSnapshot` (216-235, copia `storagePath` quando presente)
- `src/lib/campaign/brief-schema.ts` — zod domínio (exactly-1-primary 60-86) — **NÃO muda**
- `src/lib/image-generation/schema.ts` — `GenerateImageRequestSchema` (8-37): ganha `ProductImageInputSchema` + `productImages` + `productImageDataUrl` vira `optional()`; `.strict()` preservado (37)
- `src/lib/image-generation/config.ts` — `MAX_PRODUCT_IMAGE_BASE64_SIZE`/`MAX_PRODUCT_IMAGE_FILE_SIZE` (27-28); ganha `MAX_CAMPAIGN_IMAGES = 4` + teto agregado
- `src/lib/campaign/persistence.ts` — `createCampaign` (5-33, ganha parâmetro `campaignId?`), `uploadCampaignImage` (60-84), novos `uploadCampaignInputImage`/`removeCampaignInputs`
- `src/lib/campaign/types.ts` — `CreateCampaignInput` (26-34, ganha `campaignId?`/`storagePaths?`)
- `src/lib/image-generation/providers/types.ts` — `ImageProviderInput` (6-14, ganha `productImagesDataUrls?`)
- `src/lib/image-generation/providers/openai.ts` — mainline Responses (59-76, N input_image), fallback `images.edit` (282-288, gated primary-only, envia apenas `productFile`)
- `src/lib/image-generation/services/image-generation-service.ts` — ponte `primaryImageDataUrl` (983, → `mediaImagesDataUrls`), `ImageProviderInput` montado (989, 1043)
- `src/lib/image-generation/services/input-validation-service.ts` — `validate(nome, productImageDataUrl)` (40-71) — **primary-only, inalterado em comportamento**
- `src/lib/image-generation/services/image-review-service.ts` — `review` (54-63, recebe primary opcionalmente), `ImageReviewInput` (9)
- `src/components/flow/use-campaign-form.ts` — `CampaignFormFields.imageFile` (86 → array multi), `compressImage` (12-74, por item + HEIC + EXIF), `validateImage` (197-207, aceita HEIC), body (724-738, `productImages[]`/`productImageDataUrl`), `EMPTY_FIELDS` (148-164, multi)
- `src/components/flow/campaign-image-upload.tsx` — single `<input type=file>` (6-85 → multi + `capture="environment"` + preview grid + remoção)
- `src/components/flow/campaign-input-form.tsx` — campo primary + seção "Imagens adicionais" + controles câmera/galeria
- `src/app/api/campaign/generate-image/route.ts` — presença (117-123), limite single (126-135), exclusividade + teto + campaignId pré-gerado + upload inputs (novo), snapshot pós-upload (359-366), cleanup pré-stream (novo), `recordCall` inalterado
- `prompts/campaign-image-director.md` (49, bloco descritivo), `-offer.md`, `-spotlight.md`, `-exclusive.md` — bloco 1+N hardcoded, sem variável nova
- Testes: `src/lib/campaign/__tests__/brief-mapper.test.ts`, `.../brief-snapshot.test.ts`, `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` (+ golden 38 keys), `.../openai-provider.test.ts`, `.../image-review-service.test.ts`, `src/app/api/campaign/generate-image/__tests__/route.test.ts`, `src/components/flow/__tests__/use-campaign-form-navigation.test.ts`, `src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx` (mock do upload)

### Design system
- `openspec/design-system/MASTER.md` — princípios do design system
- `openspec/design-system/pages/campaign-input.md` — página do formulário de campanha (multi-imagem/câmera seguem os estilos existentes do form)

### Precedentes
- `.planning/phases/40-campos-comerciais-avisos-brief/` — form state + seções + co-migração de mocks (precedente imediato)
- `.planning/phases/39-brief-estruturado-campanha/` — domínio/snapshot da F39 (fonte dos tipos `CampaignImageRole`/`CampaignImageSource`/`media.images[]`)
- `.planning/phases/38.2.1-economic-snapshot/` — snapshot imutável (padrão F38.2.1)
- `.planning/phases/13-creditos...` / `src/lib/campaign/persistence.ts` — padrão de upload no bucket `campaign-images`
</canonical_refs>

<specifics>
## Specific Ideas

- **D1 runbook já aplicado nesta sessão de planejamento (ciclo 1):** os 6 arquivos de tracking foram atualizados (F41 = Mídia de Campanha Mobile, Stripe → F42) + seção "### Phase 41: Mídia de Campanha Mobile" adicionada ao `.planning/ROADMAP.md` + bloco Phase 41 no `AGENTS.md`. O plano de trackings (F41-26) deve **verificar** a consistência (grep de resíduos Stripe-as-F41) e registrar o commit, não reescrever
- **Regra de exclusividade (D2) — tabela canônica:**
  | `productImages` | `productImageDataUrl` | Resultado |
  |---|---|---|
  | presente | ausente | válido (exatamente 1 `primary` no transporte) |
  | ausente | presente | legado (mapper gera 1 primary/upload) |
  | ausente | ausente | **400** "Imagem do produto é obrigatória" |
  | presente | presente | **400** (payload ambíguo — mutuamente exclusivos) |
- **`ProductImageInputSchema` (D2):** `{ role: z.enum(["primary", "variation", "combo_item", "reference"]), source: z.enum(["upload", "camera"]), mimeType: z.string(), dataUrl: z.string().min(1) }` — **sem `id`** (rota gera/normaliza)
- **`MAX_CAMPAIGN_IMAGES = 4` (D10)** — 1 primary + 3 auxiliares; teto no cliente e no transporte; constante de teto agregado no `config.ts`
- **Ordem D5 na rota:** pré-gerar `campaignId` → gerar `id` por imagem (uuid) → `uploadCampaignInputImage` ANTES do snapshot → montar snapshot com `storagePath` → `createCampaign(storeId, input, campaignIdPreGerado)` → em falha pré-stream `removeCampaignInputs`. **D5 aplica-se aos DOIS fluxos (decisão do usuário 2026-08-14):** o legado `productImageDataUrl` também passa pela ordem D5 (persiste a primary como input + `storagePath` aditivo no snapshot); comportamento legado idêntico, snapshot ganha campo aditivo; `storagePath` ausente só em compatibilidade/legado histórico (pré-F41 ou caminhos excepcionais sem upload)
- **Body do form (D2):** com auxiliares → `productImages[]` (sem `id` de cliente); sem auxiliares → `productImageDataUrl` legado; nunca ambos
- **`mimeType` real derivado do dataUrl (D2/D3):** helper `mimeTypeFromDataUrl(dataUrl)` (png/jpeg/webp) — corrige o quirk `"image/jpeg"` fixo da F39 (`brief.ts:167`)
- **Fallback `images.edit` gated (D7):** só com primary única (1 imagem), enviando apenas `productFile` (identidade fora do fallback — limitação pré-existente `openai.ts:282-287`); com auxiliares → Responses ou erro explícito
- **Bloco descritivo 1+N (D6):** 1 primary = herói visual; N auxiliares = contexto/ângulos/variações/combos; sem inventar conteúdo; hardcoded nos 4 prompts, sem variável nova
- **`EXPECTED_KEYS = 38` (golden por intent)** — conjunto de variáveis/keys idêntico para o mesmo input; o texto do prompt muda intencionalmente (D6); regressão por intent (offer/spotlight/exclusive)
- **Revisor (D9):** `review(generatedImage, input)` recebe opcionalmente a dataUrl da primary; bloco de imagem + linha fixa "Compare o produto da arte com a imagem de referência"; retrocompatível
- **UAT obrigatória:** (1) legado 1 imagem → **comportamento idêntico ao pós-F40** (mesma UX/payload/geração/revisão/exportação); snapshot preserva o shape sem base64 e ganha **`storagePath` aditivo para a primary persistida** (D5 nos dois fluxos); (2) primary + 2 auxiliares (galeria) → `media.images[]` com 3 itens; (3) **câmera no celular real — HEIC/EXIF ok, arte correta** (foto vertical/horizontal, iOS e Android); (4) remover/adicionar auxiliares e regenerar; (5) sem primary válida → erro claro (400 na rota); (6) campanha antiga pré-F41 continua exibindo/baixando (sem storagePath retroativo)
</specifics>

<deferred>
## Deferred Ideas

- Roles avançadas expostas ao lojista (`variation`/`combo_item`) — D3 (extensão futura F37/catálogo)
- Validação produto×imagem multi-imagem — D8 (primary-only na v1)
- Review com TODAS as imagens — D9 (revisor recebe a primary; todas deferido)
- Dependência de lib HEIC (`heic2any`/`libheif`) — D4 (lib só se o UAT com celular real mostrar necessidade)
- Catálogo de produtos por loja / `productAssetId` — fase subsequente (F39 D3)
- Migration SQL / mudança de contrato — D5
- Stripe / Monetização Pública — F42 (v1.7, pós-beta) — renumeração D1
- F37 — Revisão e Aprovação da Arte — fase própria, após F41; consome o snapshot com N imagens
- Identidade/logo multi-imagem — a identidade continua 1 referência (`identityImageUrl`, `detail: "low"`), inalterada
</deferred>
