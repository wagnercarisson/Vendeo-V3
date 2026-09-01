## Context

A F39 estruturou o domínio `CampaignBrief` e deixou o **domínio de mídia pronto para múltiplas imagens**, mas **todas as costuras single-image** seguem falando de uma imagem:

- **Domínio já multi-imagem-ready:** `CampaignImageRole` (`brief.ts:21-23`) e `CampaignImageSource` existem; `CampaignProductImageInput` runtime tem `dataUrl?` (`brief.ts:29-35`); `CampaignBriefSnapshotImage` snapshot tem `storagePath?`/`productAssetId?` **reservados** (`brief.ts:39-47`); o zod do domínio já valida exatamente 1 `primary` (`brief-schema.ts:60-86`); `buildCampaignBriefSnapshot` mapeia o **array inteiro** de imagens (`brief.ts:216-235`).
- **Transporte flat:** `GenerateImageRequestSchema` tem apenas `productImageDataUrl` **required** (`schema.ts:30`) e `.strict()` (`schema.ts:37`). O tipo `CampaignProductImageInput` do domínio **não é usado no transporte**.
- **Mapper:** `buildCampaignBriefFromFlat` hardcoda 1 imagem (`role: "primary"`, `source: "upload"`, `mimeType: "image/jpeg"` mesmo para PNG — `brief.ts:161-171`).
- **Form/UI:** `CampaignFormFields.imageFile: File | null` single (`use-campaign-form.ts:86`); `compressImage` JPEG ≤1MB/1200px single (`:12-74`); `validateImage` aceita apenas PNG/JPG/WEBP e rejeita HEIC (`:197-207`); body envia `productImageDataUrl: imageDataUrl` (`:737`). `CampaignImageUpload` é 1 `<input type=file>` sem `capture` (`campaign-image-upload.tsx:6-85`).
- **Provider:** `ImageProviderInput.productImageDataUrl?` (`providers/types.ts:8`); `attempt >= 1` com imagem → fallback `images.edit` que aceita apenas **1 base image** (`openai.ts:58-61`, limitação documentada em `:282-287`); mainline Responses API monta 1 `input_image` (`:71-73`).
- **Validação produto×imagem:** `InputValidationService.validate(nome, 1 imagem)` — uma chamada vision antes da geração (`input-validation-service.ts:40-71`).
- **Review:** `ImageReviewService.review(generatedImage, input)` — o revisor **não recebe** a imagem do produto (`image-review-service.ts:54-63`).
- **Rota:** presença + limite `MAX_PRODUCT_IMAGE_BASE64_SIZE = 4MB` single (`route.ts:117-135`); `inputSnapshot` construído **antes** de `createCampaign` (`:359-366`).
- **Persistência:** `createCampaign` gera o `campaignId` internamente e fixa `storage_path` na criação (`persistence.ts:5-33`); `uploadCampaignImage` single JPEG (`:60-84`); bucket `campaign-images` privado com policies service_role insert/delete + owner select por prefixo `storeId` (`20260708000002_create_campaign_images_bucket.sql`).

O objetivo da F41 é **crescer essas costuras de 1→N** mantendo compatibilidade total com o fluxo atual de 1 imagem (`productImageDataUrl` continua válido), adicionar **câmera/HEIC/EXIF**, e **persistir os inputs no storage** (decisão arquitetural D5) para que a F37 (revisão/aprovação) possa exibir/reusar a imagem original.

## Goals / Non-Goals

**Goals:**
- Form com 1 imagem principal obrigatória + N auxiliares opcionais (seleção/remoção/preview) + captura por câmera (D3/D4)
- Transporte aditivo `productImages[]` com `.strict()` preservado e `productImageDataUrl` legado funcionando (D2)
- Mapper gera `media.images[]` com roles/source/mimeType corretos; `mimeType` real derivado do dataUrl (D2/D3)
- Persistência dos inputs no bucket `campaign-images` com `campaignId` pré-gerado, `storagePath` no snapshot e limpeza em falha pré-stream (D5)
- Provider Responses com N `input_image`; fallback edit gated por primary-only (D7)
- Prompt com bloco descritivo 1+N referências **sem nova variável**; golden `EXPECTED_KEYS = 38` por intent preservado (D6)
- Validação produto×imagem primary-only na v1 (D8); revisor com primary como referência (D9)
- Limites: `MAX_CAMPAIGN_IMAGES = 4`, teto agregado, erros 400/413 claros (D10)
- Renumeração de trackings (D1): F41 = Mídia de Campanha Mobile (v1.5), Stripe → F42 (v1.7)
- Testes (transporte, mapper, UI multi, HEIC/EXIF, snapshot/storage, pipeline/prompt/review, regressão de 1 imagem); `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

**Non-Goals:**
- **Expor roles avançadas ao lojista** (`variation`/`combo_item`) — D3: auxiliares entram como `reference`; roles avançadas internas (extensão futura F37/catálogo)
- **Validação produto×imagem multi-imagem** — D8: primary-only na v1; multi-imagem deferida
- **Review com TODAS as imagens** — D9: revisor recebe a primary; todas as imagens deferido
- **Dependência de lib HEIC** (`heic2any`/`libheif`) — D4: decode via canvas; lib só se o UAT com celular real mostrar necessidade
- **Catálogo de produtos por loja / `productAssetId`** — fase subsequente (F39 D3)
- **Stripe / Monetização Pública** — F42 (v1.7, pós-beta) — renumeração D1
- **F37 — Revisão e Aprovação da Arte** — fase própria, após F41; consome o snapshot com N imagens
- **Migration SQL** — D5: snapshot `campaign_brief_v1` (jsonb tolerante) e bucket existente comportam a mudança
- **Identidade/logo multi-imagem** — a identidade continua sendo 1 referência (`identityImageUrl`, detail low), inalterada

## Decisions

### D1 — Numeração: F41 = Mídia de Campanha Mobile (v1.5), Stripe → F42 (v1.7) + runbook de trackings

`DECIDIDO` (segue o precedente da F40 D1 / F39 D1 / F37 D11: a fase conflitante é incrementada, não apagada)

| Antes | Depois |
|-------|--------|
| F41 = Stripe / Monetização Pública (v1.7, pós-beta) | **F41 = Mídia de Campanha Mobile** (nova, v1.5) |
| — | **F42 = Stripe / Monetização Pública** (v1.7, pós-beta) |

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 41 → "Mídia de Campanha Mobile \| v1.5 \| 0/0 \| ○ Pending"; adicionar linha 42 → "Stripe / Monetização Pública \| v1.7 \| 0/0 \| ○ Pending". Atualizar menções a "F41 (Stripe)" para "Stripe (F42)". Adicionar bullet da F41 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering": "F41 = Mídia de Campanha Mobile (v1.5), F42 = Stripe/Monetização Pública (v1.7)". Linha da tabela Progress 41 → Mídia; adicionar linha 42 → Stripe. Atualizar notas de renumeração e menções "Phase 41 (Stripe)" em Dependencies → F42. Atualizar Dependency Graph. Adicionar seção "### Phase 41 — Mídia de Campanha Mobile". Atualizar rodapé "Last updated" (inclui correção do rodapé "Fase 40 ... em PLANEJAMENTO" — alinhar com STATE.md que a declara concluída) |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 41`. Tabela "Next Phases": F41 → "○ In progress — Mídia de Campanha Mobile (v1.5)"; F42 → "○ Future — Stripe / Monetização Pública (v1.7, pós-beta, renumerada de F41)". Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Menção "Stripe ... F41 (v1.7)" → **F42**. Rodapé "Last updated" |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7: "Stripe será implementada como F41/v1.7" → **F42/v1.7** |
| 6 | `.planning/MILESTONES.md` | Menção "Stripe / Monetização Pública diferido para v1.7 (F41)" → **(F42)** |

**Pré-requisito de limpeza (F40):** antes de abrir a F41, a F40 deve estar **arquivada/limpa** — o folder `openspec/changes/fase-40-campos-comerciais-avisos-brief/` não deve mais constar como `in-progress` no `openspec list`, e o rodapé de `.planning/ROADMAP.md` deve deixar de dizer "Fase 40 ... em PLANEJAMENTO" enquanto `.planning/STATE.md` a declara concluída. **Sem reescrever artefatos históricos** — apenas fechar o ciclo da fase.

Regras gerais (padrão F40 D1 / F39 D1 / F37 D11): artefatos históricos não são reescritos; `openspec/changes/fase-41-midia-de-campanha-mobile/` é a **fonte da verdade** da fase; renumeração de fases futuras segue a regra da fase conflitante incrementada.

### D2 — Transporte aditivo: `productImages[]` novo campo opcional; `productImageDataUrl` legado preservado

`DECIDIDO` (mantém compatibilidade com 1 imagem — comportamento atual idêntico para payload antigo)

- **Novo campo opcional** no `GenerateImageRequestSchema` (`schema.ts:8-37`):
  ```ts
  productImages: z
    .array(
      z.object({
        role: z.enum(["primary", "variation", "combo_item", "reference"]),
        source: z.enum(["upload", "camera"]),
        mimeType: z.string(),
        dataUrl: z.string().min(1),          // base64 (transporte); snapshot NUNCA persiste
      })
    )
    .min(1)
    .max(MAX_CAMPAIGN_IMAGES)                // 4 (D3/D5)
    .superRefine((imgs, ctx) => {
      const primary = imgs.filter(i => i.role === "primary").length;
      if (primary !== 1) {
        ctx.addIssue({ code: "custom", path: ["productImages"],
          message: `Deve existir exatamente 1 imagem com role "primary" (recebido: ${primary})` });
      }
    })
    .optional()
  ```
- **O item NÃO carrega `id`** — os ids são **gerados/normalizados pela rota** antes do upload/snapshot (D5), não confiando no cliente (mesmo padrão do `id` que o mapper F39 gera hoje, `brief.ts:164`). Isso remove a ambiguidade sobre quem possui o `id` usado no path de storage `{imageId}`.
- **Regra de exclusividade/compatibilidade** (determinística, validada na rota — os dois campos são **mutuamente exclusivos**, não um "substitui" o outro):
  1. `productImages` presente + `productImageDataUrl` **ausente** → válido; deve conter **exatamente 1 `primary`** (mesmo invariante do zod do domínio, agora no transporte).
  2. `productImages` **ausente** + `productImageDataUrl` presente → comportamento legado: mapper gera o item primary/upload (equivalente ao `productImages` de 1 elemento).
  3. Ambos ausentes → 400 "Imagem do produto é obrigatória" (como hoje, `route.ts:118-123`).
  4. **Ambos presentes → 400 (payload ambíguo)** — `.strict()` já impede campos desconhecidos, e a regra é explícita para evitar dupla fonte. O 400 é a regra canônica; "substituir" seria comportamento implícito, rejeitado.
- **`.strict()` preservado** — o campo novo é aditivo, payload antigo continua passando.
- **`productImageDataUrl` deixa de ser `required` no Zod** (antes `z.string().min(1)` required; passa a `optional()`) — **a preservação do legado é comportamental, não estrutural**: payload de 1 imagem continua funcionando e produz o mesmo resultado, mas a obrigatoriedade passa a ser garantida pela **regra de exclusividade validada na rota**, não pelo Zod. **Atenção para testes/fixtures**: testes antigos que esperavam erro direto do Zod por ausência de `productImageDataUrl` precisam ser co-migrados para validar o 400 da rota (teste 27).
- **Mapeamento legado = `productImages` de 1 elemento** no mapper (reuso da mesma lógica, zero bifurcação no pipeline).

### D3 — Roles na v1: primary explícita + auxiliares como `reference`; roles avançadas internas

`DECIDIDO` (UI simples para o lojista; domínio mantém os 4 roles para extensão futura)

- **UI expõe:** 1 campo "Imagem do Produto *" (obrigatório, = primary) + seção "Imagens adicionais" (opcionais, até 3).
- **Internamente:** a primeira imagem é sempre `role: "primary"`; as auxiliares são gravadas com `role: "reference"` (semântica neutra de imagem de apoio/referência visual para o diretor de arte).
- **`variation` / `combo_item`** permanecem no domínio e no zod (`brief-schema.ts:15`), **sem exposição ao lojista** na v1 — a **UI/form v1 nunca envia esses roles** (o lojista só cria primary/reference); o **transporte aceita os 4 roles** (contrato D2) e o **mapper apenas espelha** o que o transporte entrega. A inferência automática (ex.: reconhecer variações do mesmo produto) fica registrada como **extensão futura** (F37/catálogo).
- **Fonte:** cada item carrega `source: "upload" | "camera"` conforme a origem real (D4).

### D4 — Câmera/mobile: `capture`, HEIC sem nova dependência, EXIF respeitado

`DECIDIDO` (câmera entra no escopo com HEIC/EXIF decididos — não apenas "bonito e quebra na mão")

- **Input de arquivo:** `CampaignImageUpload` ganha suporte a múltiplos arquivos + atributo `capture="environment"` (abre a câmera traseira no mobile) no botão/área de nova imagem. A origem selecionada informa `source` do item.
- **HEIC (iPhone):** `validateImage` (`use-campaign-form.ts:197-207`) passa a **aceitar `image/heic` / `image/heif` no input**, e `compressImage` tenta **decodificar via canvas** (os browsers que decodificam HEIC para `drawImage` convertem para JPEG no `toBlob`). Se a decodificação falhar → **mensagem PT-BR clara** orientando a usar JPG/PNG (sem nova dependência de lib HEIC na v1). Decisão de não adicionar dependência registrada — `heic2any`/`libheif` fica como alternativa futura se o UAT com celular real mostrar necessidade.
- **Orientação EXIF:** `compressImage` re-desenha via canvas; **rotação EXIF deve ser respeitada** — usar `createImageBitmap(file, { imageOrientation: "from-image" })` antes do desenho (ou equivalente), garantindo que fotos de câmera não saiam rotacionadas. **UAT obrigatória com celular real** (foto vertical/horizontal, iOS e Android).
- `MAX_PRODUCT_IMAGE_FILE_SIZE`/`MAX_PRODUCT_IMAGE_BASE64_SIZE` (`config.ts`) continuam como referência; limites multi-imagem em D5/D10.

### D5 — Persistência dos inputs no storage (decisão arquitetural)

`DECIDIDO` (a F37 vai precisar exibir/reusar a imagem original; persistir inputs já nesta fase)

- **Bucket:** **reuso do `campaign-images`** (sem migration; bucket privado, policies existentes — service_role insert/delete, owner select por prefixo `storeId`). Inputs em path **`{storeId}/{campaignId}/inputs/{imageId}.{ext}`** — o primeiro segmento continua `storeId` (owner select preservado) e o objeto é imutável (sem UPDATE, coerente com o invariante do bucket).
- **Ordem de criação (mudança necessária):** hoje `createCampaign` gera o `campaignId` internamente e o `input_snapshot` é montado **antes** da criação (`route.ts:359-366`). Como o `storagePath` dos inputs precisa estar **dentro do snapshot**, a F41:
  1. **pré-gera o `campaignId`** na rota (`crypto.randomUUID()`);
  2. **gera/normaliza um `id` por imagem** (uuid) — o cliente **não envia id** (D2); esse id alimenta o path `{imageId}` e o snapshot;
  3. faz o **upload dos inputs** (`{storeId}/{campaignId}/inputs/{imageId}.{ext}`) via `uploadCampaignInputImage` (novo helper, transcoda para JPEG com `sharp` — reuso do `image-processor.ts`);
  4. monta o snapshot **com `storagePath` por imagem**;
  5. chama `createCampaign(storeId, input, campaignIdPreGerado)` — assinatura ganha parâmetro opcional `campaignId`.
- **`createCampaign`/tipos:** `CreateCampaignInput` aceita `campaignId` pré-gerado; `storage_path` da arte final permanece `{storeId}/{campaignId}.jpg` (inalterado).
- **`buildCampaignBriefSnapshot`:** passa a copiar `storagePath` quando presente no runtime (`brief.ts:216-235` — hoje mapeia apenas id/role/source/provided/mimeType).
- **Tipo runtime (D5):** `CampaignProductImageInput` (`brief.ts:29-35`) ganha `storagePath?: string` — a rota preenche o campo após o upload do input (`{storeId}/{campaignId}/inputs/{imageId}.{ext}`) e **antes** de montar o snapshot; o snapshot copia o campo **sem cast/objeto paralelo** (contrato tipado — ver `campaign-brief-contract`).
- **Limpeza (compensação):** falha no upload de inputs ou no fluxo pré-stream → remover os objetos já enviados (`deleteCampaignImage` reusado / novo helper de remoção por caminho `removeCampaignInputs`). Falha pós-stream → fluxo de compensação atual (`deleteCampaignImage(storagePath)`) permanece.
- **Sem migration SQL** — snapshot `campaign_brief_v1` (jsonb tolerante) e bucket existente comportam a mudança. `productAssetId`/catálogo permanecem reservados (F39 D3).

### D6 — Prompt e golden: bloco descritivo sem nova variável; EXPECTED_KEYS = 38 preservado

`DECIDIDO` (regressão por intent estável — o conjunto de variáveis NÃO muda)

- **Antes:** linha única "A imagem do produto foi enviada como referência visual fiel" (`campaign-image-director.md:49`, e equivalentes nos 3 prompts por intent).
- **Depois (nos 4 prompts, hardcoded, sem placeholder):** bloco que descreve a presença de **1 imagem principal + N imagens auxiliares de referência**, instruindo o diretor a usar a principal como herói visual e as auxiliares como contexto (ângulos/variações/combos) **sem inventar conteúdo** dos produtos.
- **Sem nova variável de prompt** → o golden `EXPECTED_KEYS = 38` (por intent) **permanece idêntico** (regra F40-13 mantida). O texto do prompt muda intencionalmente; as imagens entram como **input multimodal**, não como variável textual.
- Teste golden por intent continua: mesmo conjunto de 38 keys para o mesmo input; texto do prompt muda (regressão por intent).

### D7 — Provider e fallback: N `input_image` no Responses; edit só com primary única

`DECIDIDO` (política fechada — o fallback não mente sobre o que consegue fazer)

- **`ImageProviderInput`** (`providers/types.ts`): `productImageDataUrl?: string` → mantido para o caminho legado + novo `productImagesDataUrls?: string[]` (lista ordenada: posição 0 = primary). A ponte `primaryImageDataUrl(brief)` vira `mediaImagesDataUrls(brief)` no service.
- **Mainline Responses path (`openai.ts:71-73`):** monta **N blocos `input_image`** (primary + auxiliares; identidade/logo continua `detail: "low"`). `attempt >= 1` **sem** fallback edit quando há auxiliares.
- **Fallback `images.edit` (`openai.ts:58-61, 225-307`):** **SÓ permitido quando há APENAS a primary** (1 imagem). A limitação documentada (`:282-287` — uma única base image) vira **regra de negócio**: com auxiliares, retries permanecem no Responses path; se o Responses estiver indisponível → **erro explícito** (sem degradar a fidelidade descartando imagens).
- Custo/telemetria (`AiCostTracker`, `recordCall` em `route.ts`) permanece — a chamada continua sendo 1 evento `campaign_image` (imagens entram como tokens do mesmo input).

### D8 — Validação semântica produto×imagem: primary-only na v1

`DECIDIDO` (uma chamada vision, comportamento atual preservado; custo contido)

- `InputValidationService.validate(nome, productImageDataUrl)` (`input-validation-service.ts:40-71`) continua validando **apenas a imagem principal** contra o nome digitado. Auxiliares **não participam** da checagem de conflito/confiança.
- Fluxo de 409 (conflict / low-confidence / strong_conflict / override `user_confirmed_continue`) **inalterado** (`route.ts:296-352`, `use-campaign-form.ts` `consumeStream`).
- **Extensão futura** (registrada): validação multi-imagem (ex.: confirmar variações/combos) quando roles avançadas forem expostas.

### D9 — Review com a imagem principal como referência de fidelidade

`DECIDIDO` (alinhado ao escopo "review adaptado"; custo baixo — 1 imagem de visão extra)

- `ImageReviewService.review(generatedImage, input)` (`image-review-service.ts:54-63`) passa a receber, **opcionalmente**, a **dataUrl da imagem principal** e a envia junto ao prompt `campaign-image-reviewer` (bloco de imagem + texto). O revisor passa a verificar a **fidelidade do produto na arte gerada** (o produto da referência é o produto da peça).
- **Sem nova variável de prompt do revisor** (a imagem entra como input multimodal; o texto do prompt pode ganhar uma linha fixa "Compare o produto da arte com a imagem de referência").
- **Retrocompatível:** sem `productImagesDataUrls`/sem primary → revisor se comporta como hoje (nenhuma mudança para o caminho legado).
- Receber **TODAS** as imagens no review fica **deferido** (custo × benefício avaliado quando roles avançadas forem expostas).

### D10 — Limites e formatos: teto agregado + validação por item

`DECIDIDO` (payload do Vercel/Next e custo do modelo contidos)

- **N máximo de imagens:** `MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares).
- **Por item (cliente):** formatos PNG/JPG/WEBP (+ HEIC com decode via canvas, D4); compressão existente (JPEG ≤1MB, downscale 1200px) por imagem; limite de arquivo 5MB no input.
- **Por item (rota):** `dataUrl.length <= MAX_PRODUCT_IMAGE_BASE64_SIZE` (4MB) para cada item + **teto agregado** do `productImages[]` (soma dos dataUrls) — evitar payload que estoure o limite de body e o custo do modelo. O limite legado single (`route.ts:126-135`) permanece para `productImageDataUrl`.
- **Erros 400/413 claros** em PT-BR indicando qual item excedeu e o limite (formato / tamanho / total).

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Mudança de payload quebra o `.strict()` ou a rota** | **D2**: campo novo opcional + regra de exclusividade/compatibilidade determinística (400 em payload ambíguo); testes de rota com payload antigo e novo |
| **Fallback `images.edit` perde auxiliares (aceita 1 base)** | **D7**: política fechada — edit só com primary única; com auxiliares, Responses ou erro explícito (regra já documentada em `openai.ts:282-287`) |
| **Golden `EXPECTED_KEYS` muda com multi-imagem** | **D6**: imagens entram como input multimodal, **sem nova variável**; bloco descritivo hardcoded; golden de 38 keys por intent preservado (teste 20) |
| **`createCampaign` não aceita `campaignId` pré-gerado → path de inputs inviável** | **D5**: assinatura ganha parâmetro opcional; upload de inputs antes do snapshot; teste 25/26 |
| **Inputs órfãos no storage em falha** | **D5**: compensação pré-stream remove objetos enviados (teste 26) |
| **HEIC/EXIF quebra a experiência de câmera** | **D4**: decode via canvas + mensagem clara na falha; orientação via `createImageBitmap from-image`; **UAT com celular real obrigatória** |
| **Custo do modelo com N imagens** | **D8**: validação primary-only (1 chamada vision); review com 1 imagem extra; `AiCostTracker` registra tokens reais; teto `MAX_CAMPAIGN_IMAGES = 4` (D10) |
| **Payload excede limite de body do Vercel/Next** | **D10**: compressão por item (≤1MB) + teto agregado na rota (413) |
| **Regressão no fluxo legado de 1 imagem** | **D2/D7**: `productImageDataUrl` preservado; fallback edit single-image preservado; regressão obrigatória na suíte |
| **F37 (revisão) consumindo snapshot multi-imagem** | **D5**: inputs persistidos com `storagePath`; snapshot v1 tolerante; F37 herda pronto (role/source/storagePath por imagem) |
| **F40 ainda aberta (folder in-progress, rodapé ROADMAP desatualizado)** | Pré-requisito de limpeza (D1): arquivar/limpar a F40 antes de planejar a F41 |

## Migration Plan

**Migration SQL:** NENHUMA (D5). Snapshot `campaign_brief_v1` continua `jsonb` tolerante; bucket `campaign-images` existente comporta os inputs em subpath `{storeId}/{campaignId}/inputs/` (sem migration, sem nova policy — service_role insert/delete e owner select por prefixo `storeId` já cobrem).

**Deploy:** código no mesmo PR (padrão Vercel). Rollback: reverter o commit — não há mudança de schema de banco. Campanhas antigas (pré-F41) com `input_snapshot` sem `storagePath` continuam exibindo/baixando normalmente (sem migração destrutiva).

**Prompts:** os 4 prompts do diretor mudam de texto (D6) no mesmo deploy do form/provider — ambos coordenados; o golden de 38 keys por intent é a âncora de regressão.

**Trackings (D1 — runbook):** aplicar atualizações em `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md` na ordem listada na D1, após fechar o pré-requisito de limpeza da F40.

## Open Questions

- **Nenhuma bloqueante.** Decisões explícitas registradas no alinhamento F41: ids de imagem gerados pela rota, nunca pelo cliente (D2/D5); auxiliares entram como `reference` (D3); HEIC via canvas sem dependência + UAT celular real (D4); inputs persistidos com `campaignId` pré-gerado (D5); prompt sem nova variável (D6); fallback edit gated por primary-only (D7); validação primary-only (D8); revisor com primary retrocompatível (D9); teto `MAX_CAMPAIGN_IMAGES = 4` + agregado (D10).
