# Alinhamento Fase 41 — Mídia de Campanha Mobile (v1.5)

> **Renumeração (esta fase):** F41 = **Mídia de Campanha Mobile** (nova, v1.5). Stripe / Monetização Pública deslocada de **F41 para F42** (v1.7, pós-beta — segue o precedente de renumeração da F40 D1, que seguiu a F39 D1 e a F37 D11: a fase conflitante é incrementada, não apagada). A atualização dos trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) está documentada como runbook na seção **D1** deste documento.
>
> **Pré-requisito de limpeza (F40):** antes de abrir a F41, a F40 deve estar **arquivada/limpa** — o folder `openspec/changes/fase-40-campos-comerciais-avisos-brief/` ainda consta como `in-progress` no `openspec list`, e o rodapé de `.planning/ROADMAP.md` ainda diz "Fase 40 ... em PLANEJAMENTO" enquanto `.planning/STATE.md` já a declara concluída (9/9 plans, 1997 testes, UAT 6/6). Alinhar essa divergência antes de planejar a F41 (sem reescrever artefatos históricos — apenas fechar o ciclo da fase).
>
> **Decisão central (D2/D7):** a F41 adiciona **múltiplas imagens** (imagem principal obrigatória + imagens auxiliares opcionais) com origem **upload e câmera/mobile**, mantendo **compatibilidade total com o fluxo atual de 1 imagem** (`productImageDataUrl` continua válido). O transporte ganha um novo campo opcional `productImages[]` (aditivo ao `.strict()`), o domínio F39 já está pronto (roles/source/snapshot sem base64), e o trabalho real está nas costuras single-image: schema HTTP, mapper, form/UI, provider, rota e persistência.

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                       ✓
  ├── F31.1 — Modelo Comercial — Formulário                      ✓
  ├── F31.2 — Diretores por Intenção                             ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                             ✓
  ├── F33 — Verificação CNPJ Freemium                            ✓
  ├── F34 — Prontidão de Loja para Geração (Store Readiness)     ✓
  ├── F35 — Changelog / Novidades                                ✓
  ├── F36 — Onboarding: Navegação por Abas                       ✓
  ├── F38 — Tabela de Custos por Operação                        ✓
  ├── F38.1 — Apuração de Custos de IA por Entrega               ✓
  ├── F38.2 — Admin de Custos + Config. Econômicas               ✓
  ├── F38.2.1 — Snapshot Econômico                               ✓
  ├── F39 — Brief Estruturado de Campanha                        ✓ (deixou o domínio de mídia pronto)
  ├── F40 — Campos Comerciais e Avisos do Brief                  ✓ (9/9, UAT 6/6)
  ├── F41 — Mídia de Campanha Mobile                             ← esta fase (multi-imagem + câmera)
  ├── F37 — Revisão e Aprovação da Arte                          ○ depois (consome o snapshot)
  │        (experimento controlado beta, human-in-the-loop)
  └── F42 — Stripe / Monetização Pública                         ○ v1.7, pós-beta (renumerada de F41)

Depois desta fase (sequenciamento recomendado):
  F40 (campos/avisos) → F41 (mídia) → F37 (revisão/aprovação) → [catálogo — fase futura] → F42 (Stripe)
```

A F41 leva ao formulário a **mídia de campanha**: o lojista informa **uma imagem principal obrigatória** (comportamento atual) e pode adicionar **imagens auxiliares opcionais** (outros ângulos, variações, itens de combo, referências), tanto via galeria quanto via **câmera do celular**. O domínio F39 já declarou os roles (`primary`, `variation`, `combo_item`, `reference`) e a fonte (`upload`, `camera`) — mas o transporte, o mapper, o form e o pipeline só falam de **uma** imagem hoje.

**Estado real em código (explorado nesta fase):**

- **O domínio F39 já é multi-imagem-ready** — o gap real são as costuras de transporte/UI/pipeline:
  - `CampaignImageRole = "primary" | "variation" | "combo_item" | "reference"` e `CampaignImageSource = "upload" | "camera"` já existem (`src/lib/campaign/brief.ts:21-23`).
  - `CampaignProductImageInput { id, role, source, mimeType, dataUrl? }` (`brief.ts:29-35`) e `CampaignBriefSnapshotImage { id, role, source, provided, mimeType, storagePath?, productAssetId? }` (`brief.ts:39-47`) — snapshot **sem base64 por construção**, com `storagePath` **reservado** para persistir inputs (F39 D3/D6/D7).
  - Zod do domínio já valida **exatamente 1 imagem `primary`** (`brief-schema.ts:60-86`).
  - `buildCampaignBriefSnapshot` já mapeia o **array inteiro** de imagens (`brief.ts:216-235`) — crescer de 1→N é retro-compatível (jsonb).
  - `primaryImageDataUrl(brief)` (`image-generation-service.ts:983-985`) já busca por **role** (não por índice) — semântica robusta para múltiplas imagens.
- **As costuras single-image (onde a F41 mexe):**
  - **Transporte flat:** `GenerateImageRequestSchema` tem apenas `productImageDataUrl` (`schema.ts:30`), `.strict()` (`schema.ts:37`). O tipo `CampaignProductImageInput` do domínio não é usado no transporte.
  - **Mapper:** `buildCampaignBriefFromFlat` hardcoda 1 imagem (`role: "primary"`, `source: "upload"`, `mimeType: "image/jpeg"` mesmo para PNG — `brief.ts:161-171`).
  - **Form/UI:** `CampaignFormFields.imageFile: File | null` single (`use-campaign-form.ts:86`); `compressImage` JPEG ≤1MB/1200px single (`:12-74`); `validateImage` aceita apenas PNG/JPG/WEBP e rejeita HEIC (`:197-207`); body envia `productImageDataUrl: imageDataUrl` (`:737`). `CampaignImageUpload` é 1 `<input type=file>` sem `capture` (`campaign-image-upload.tsx:6-85`).
  - **Provider:** `ImageProviderInput.productImageDataUrl?` (`providers/types.ts:8`); `attempt >= 1` com imagem → **fallback `images.edit` que aceita apenas 1 base image** (`openai.ts:58-61`, limitação documentada em `:282-287`); mainline Responses API monta 1 `input_image` (`:71-73`).
  - **Validação produto×imagem:** `InputValidationService.validate(nome, 1 imagem)` — uma chamada vision antes da geração (`input-validation-service.ts:40-71`).
  - **Review:** `ImageReviewService.review(generatedImage, input)` — revisor não recebe a imagem do produto (`image-review-service.ts:54-63`).
  - **Rota:** presença + limite `MAX_PRODUCT_IMAGE_BASE64_SIZE = 4MB` single (`route.ts:117-135`); `inputSnapshot` construído **antes** de `createCampaign` (`:359-366`).
  - **Persistência:** `createCampaign` gera `campaignId` internamente e fixa `storage_path` na criação (`persistence.ts:5-33`); `uploadCampaignImage` single JPEG (`:60-84`); bucket `campaign-images` privado, policies service_role insert/delete + owner select por prefixo `storeId` (`20260708000002_create_campaign_images_bucket.sql`).

---

## Propósito

1. **Múltiplas imagens no formulário (D2/D3)** — 1 imagem principal obrigatória (como hoje) + imagens auxiliares opcionais, com UI de seleção/remoção/preview e origem **galeria + câmera** (D4). Roles avançadas (`variation`/`combo_item`) **não são expostas ao lojista** na v1 — as auxiliares entram como `reference` internamente.
2. **Transporte multi-imagem aditivo (D2)** — novo campo opcional `productImages[]` no `GenerateImageRequestSchema`, mantendo `productImageDataUrl` como caminho legado (compatibilidade com 1 imagem). `.strict()` preservado.
3. **Mapper flat→domínio multi-imagem (D2/D3)** — `buildCampaignBriefFromFlat` mapeia o array; `mimeType` real derivado do dataUrl (corrige o quirk do `"image/jpeg"` fixo da F39); invariante `exactly-1-primary` já garantido pelo zod do domínio.
4. **Câmera/mobile com HEIC/EXIF resolvidos (D4)** — `capture="environment"`, tratamento de HEIC sem nova dependência (decode via canvas; falha → mensagem PT-BR clara) e orientação EXIF respeitada (UAT obrigatória com celular real).
5. **Persistência dos inputs no storage (D5 — decisão arquitetural)** — inputs sobem para o bucket `campaign-images` (reuso, sem migration) com path `{storeId}/{campaignId}/inputs/{imageId}.{ext}`, `storagePath` por imagem gravado no snapshot. Para isso a F41 **pré-gera o `campaignId`** e faz o upload **antes** de montar o snapshot/criar a campanha.
6. **Pipeline/prompt/review adaptados (D6/D7/D8/D9)** — provider recebe N `input_image` no mainline Responses path; prompt ganha bloco de descrição das referências **sem nova variável** (golden `EXPECTED_KEYS` permanece 38); **fallback `images.edit` só permitido com primary única**; validação semântica produto×imagem **primary-only** na v1; revisor passa a receber a **imagem principal** como referência de fidelidade (D9).

**Entrega verificável:**
- Form com 1 imagem principal obrigatória + N auxiliares opcionais (seleção/remoção/preview) + captura por câmera
- Payload `productImages[]` aceito pela rota; `productImageDataUrl` legado continua funcionando (payload antigo → comportamento idêntico)
- Mapper gera `media.images[]` com roles/source/mimeType corretos; snapshot `campaign_brief_v1` com N imagens **sem base64** e com `storagePath`
- Inputs persistidos no bucket `campaign-images` (path por campaign) + limpeza em falha pré-stream
- Provider Responses com N `input_image`; fallback edit gated por primary-only; validação primary-only; revisor com primary como referência
- Testes: transporte, mapper, UI multi, limites/formato, HEIC/EXIF, snapshot/storage, pipeline/prompt/review, regressão de 1 imagem
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Estado Atual / Base Para F41

```
                                    ESTADO ATUAL (pós-F40)               DEPOIS (F41)
═══════════════════════════════════════════════════════════════════════════════════════════════

Imagens no form:
  Quantidade                       1 (imageFile: File | null)           1 primary obrigatória +
                                                                          N auxiliares opcionais
  Origem                           galeria (input file, sem capture)    galeria + câmera
                                                                          (capture="environment")
  UI                               preview single + remover             preview grid + remover por item
  HEIC/EXIF                        rejeita HEIC; orientação não tratada  decode HEIC via canvas (sem dep.);
                                                                          EXIF respeitado (UAT celular)

Transporte:
  Campo                            productImageDataUrl (string, req.)   + productImages[] (opcional,
                                                                          aditivo ao .strict())
  Compatibilidade                  —                                    payload legado continua idêntico

Mapper:
  Imagens                          hardcode 1 item                      mapeia array; mimeType real
                                     (primary/upload/image/jpeg)          do dataUrl; roles/source por item
  Invariante primary               (só existe 1)                         exactly-1-primary (zod já valida)

Pipeline:
  Provider                         productImageDataUrl single            N input_image (Responses path)
  Fallback                         images.edit (1 base)                  edit SÓ com primary única; com
                                                                          auxiliares → Responses ou erro
  Validação nome×imagem            primary única                          primary-only na v1
  Review                           não vê a imagem do produto            vê a imagem principal (fidelidade)
  Prompt                           "A imagem do produto foi enviada"     bloco descreve 1+N referências
                                                                          (sem nova variável; keys = 38)

Persistência:
  Inputs no storage                NÃO persiste (só metadata)            persiste: {storeId}/{campaignId}/
                                                                          inputs/{imageId}.{ext} + storagePath
                                                                          no snapshot
  createCampaign                   gera campaignId internamente          aceita campaignId pré-gerado (D5)
  Snapshot                         media.images[] (1 item, sem base64)   media.images[] (N itens, sem base64,
                                                                          com storagePath)
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F41) |
|------|-------------------|------------------|
| **Numeração** | "F41 já era Stripe nos trackings" | **F41 = Mídia de Campanha Mobile; Stripe → F42 (D1)**; runbook de trackings |
| **Storage dos inputs** | "preencher `storagePath` no snapshot" | **Decisão arquitetural (D5)**: inputs sobem para o bucket `campaign-images`; exige `campaignId` pré-gerado e upload **antes** de montar o snapshot — não é só preencher o campo |
| **Roles na UI** | "expor `variation`/`combo_item`/`reference` ao lojista" | **Roles avançadas internas/automáticas (D3)**: UI expõe apenas primary + auxiliares (role `reference`); domínio/zod mantêm os 4 roles para extensão futura |
| **Fallback multi-imagem** | "retries com auxiliares no mesmo caminho" | **Política fechada (D7)**: `images.edit` só com primary única; com auxiliares → Responses ou erro explícito |
| **HEIC/EXIF** | "câmera entra sem decidir HEIC" | **No escopo (D4)**: decode HEIC via canvas sem nova dependência; falha → mensagem clara; EXIF no `compressImage`; UAT com celular real |
| **Validação produto×imagem** | "validar nome contra todas as imagens" | **Primary-only na v1 (D8)** — uma chamada vision, comportamento atual; multi-imagem deferida |
| **Review** | "review intocado (como F40)" | **Revisor recebe a primary (D9)**: checagem de fidelidade do produto na arte gerada; receber TODAS as imagens fica deferido |
| **Prompt** | "adicionar variável descrevendo as referências" | **Sem nova variável (D6)**: bloco descritivo hardcoded no texto do prompt; golden `EXPECTED_KEYS` permanece 38 |

---

## Decisões de Alinhamento

### D1 — Numeração: F41 = Mídia de Campanha Mobile (v1.5), Stripe → F42 (v1.7) + runbook de trackings

`DECIDIDO` (segue o precedente da F40 D1 / F39 D1 / F37 D11)

| Antes | Depois |
|-------|--------|
| F41 = Stripe / Monetização Pública (v1.7, pós-beta) | **F41 = Mídia de Campanha Mobile** (nova, v1.5) |
| — | **F42 = Stripe / Monetização Pública** (v1.7, pós-beta) |

A fase conflitante é **incrementada** (não apagada).

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 41 → "Mídia de Campanha Mobile \| v1.5 \| 0/0 \| ○ Pending"; adicionar linha 42 → "Stripe / Monetização Pública \| v1.7 \| 0/0 \| ○ Pending". Atualizar menções a "F41 (Stripe)" para "Stripe (F42)". Adicionar bullet da F41 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering": "F41 = Mídia de Campanha Mobile (v1.5), F42 = Stripe/Monetização Pública (v1.7)". Linha da tabela Progress 41 → Mídia; adicionar linha 42 → Stripe. Atualizar notas de renumeração e menções "Phase 41 (Stripe)" em Dependencies → F42. Atualizar Dependency Graph. Adicionar seção "### Phase 41 — Mídia de Campanha Mobile". Atualizar rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 41`. Tabela "Next Phases": F41 → "○ In progress — Mídia de Campanha Mobile (v1.5)"; F42 → "○ Future — Stripe / Monetização Pública (v1.7, pós-beta, renumerada de F41)". Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Menção "Stripe ... F41 (v1.7)" → **F42**. Rodapé "Last updated" |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7: "Stripe será implementada como F41/v1.7" → **F42/v1.7** |
| 6 | `.planning/MILESTONES.md` | Menção "Stripe / Monetização Pública diferido para v1.7 (F41)" → **(F42)** |

**Regras gerais (padrão F40 D1 / F39 D1 / F37 D11):**
- Artefatos históricos (alinhamentos F26–F40, quick-plans, CONTEXT de fases concluídas) **não são reescritos** — refletem o estado da época.
- O `openspec/changes/fase-41-midia-de-campanha-mobile/` será a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele.
- Renumeração de fases futuras segue a regra: a fase conflitante é incrementada (não apagada).

---

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
    .max(MAX_CAMPAIGN_IMAGES)                // 4 (D3/D5)
    .optional()
  ```
  **O item NÃO carrega `id`** — os ids são **gerados/normalizados pela rota** antes do upload/snapshot (D5), não confiando no cliente (mesmo padrão do `id` que o mapper F39 gera hoje, `brief.ts:164`). Isso remove a ambiguidade sobre quem possui o `id` usado no path de storage `{imageId}`.
- **Regra de exclusividade/compatibilidade** (determinística, validada na rota — os dois campos são **mutuamente exclusivos**, não um "substitui" o outro):
  1. `productImages` presente + `productImageDataUrl` **ausente** → válido; deve conter **exatamente 1 `primary`** (mesmo invariante do zod do domínio, agora no transporte).
  2. `productImages` **ausente** + `productImageDataUrl` presente → comportamento legado: mapper gera o item primary/upload (equivalente ao `productImages` de 1 elemento).
  3. Ambos ausentes → 400 "Imagem do produto é obrigatória" (como hoje, `route.ts:118-123`).
  4. **Ambos presentes → 400 (payload ambíguo)** — `.strict()` já impede campos desconhecidos, e a regra é explícita para evitar dupla fonte. O 400 é a regra canônica; "substituir" seria comportamento implícito, rejeitado.
- **`.strict()` preservado** — o campo novo é aditivo, payload antigo continua passando.
- **`productImageDataUrl` deixa de ser `required` no Zod** (antes `z.string().min(1)` required; passa a `optional()`) — **a preservação do legado é comportamental, não estrutural**: payload de 1 imagem continua funcionando e produz o mesmo resultado, mas a obrigatoriedade passa a ser garantida pela **regra de exclusividade validada na rota**, não pelo Zod. **Atenção para testes/fixtures**: testes antigos que esperavam erro direto do Zod por ausência de `productImageDataUrl` precisam ser co-migrados para validar o 400 da rota.
- **Mapeamento legado = `productImages` de 1 elemento** no mapper (reuso da mesma lógica, zero bifurcação no pipeline).

---

### D3 — Roles na v1: primary explícita + auxiliares como `reference`; roles avançadas internas

`DECIDIDO` (UI simples para o lojista; domínio mantém os 4 roles para extensão futura)

- **UI expõe:** 1 campo "Imagem do Produto *" (obrigatório, = primary) + seção "Imagens adicionais" (opcionais, até 3).
- **Internamente:** a primeira imagem é sempre `role: "primary"`; as auxiliares são gravadas com `role: "reference"` (semântica neutra de imagem de apoio/referência visual para o diretor de arte).
- **`variation` / `combo_item`** permanecem no domínio e no zod (`brief-schema.ts:15`), **sem exposição ao lojista** na v1 — a inferência automática (ex.: reconhecer variações do mesmo produto) fica registrada como **extensão futura** (F37/catálogo).
- **Fonte:** cada item carrega `source: "upload" | "camera"` conforme a origem real (D4).

---

### D4 — Câmera/mobile: `capture`, HEIC sem nova dependência, EXIF respeitado

`DECIDIDO` (câmera entra no escopo com HEIC/EXIF decididos — não apenas "bonito e quebra na mão")

- **Input de arquivo:** `CampaignImageUpload` ganha suporte a múltiplos arquivos + atributo `capture="environment"` (abre a câmera traseira no mobile) no botão/área de nova imagem. A origem selecionada informa `source` do item.
- **HEIC (iPhone):** `validateImage` (`use-campaign-form.ts:197-207`) passa a **aceitar `image/heic` / `image/heif` no input**, e `compressImage` tenta **decodificar via canvas** (os browsers que decodificam HEIC para `drawImage` convertem para JPEG no `toBlob`). Se a decodificação falhar → **mensagem PT-BR clara** orientando a usar JPG/PNG (sem nova dependência de lib HEIC na v1). Decisão de não adicionar dependência registrada — `heic2any`/`libheif` fica como alternativa futura se o UAT com celular real mostrar necessidade.
- **Orientação EXIF:** `compressImage` re-desenha via canvas; **rotação EXIF deve ser respeitada** — usar `createImageBitmap(file, { imageOrientation: "from-image" })` antes do desenho (ou equivalente), garantindo que fotos de câmera não saiam rotacionadas. **UAT obrigatória com celular real** (foto vertical/horizontal, iOS e Android).
- `MAX_PRODUCT_IMAGE_FILE_SIZE`/`MAX_PRODUCT_IMAGE_BASE64_SIZE` (`config.ts`) continuam como referência; limites multi-imagem em D5.

---

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
- **Limpeza (compensação):** falha no upload de inputs ou no fluxo pré-stream → remover os objetos já enviados (`deleteCampaignImage` reusado / novo helper de remoção por caminho). Falha pós-stream → fluxo de compensação atual (`deleteCampaignImage(storagePath)`) permanece.
- **Sem migration SQL** — snapshot `campaign_brief_v1` (jsonb tolerante) e bucket existente comportam a mudança. `productAssetId`/catálogo permanecem reservados (F39 D3).

---

### D6 — Prompt e golden: bloco descritivo sem nova variável; EXPECTED_KEYS = 38 preservado

`DECIDIDO` (regressão por intent estável — o conjunto de variáveis NÃO muda)

- **Antes:** linha única "A imagem do produto foi enviada como referência visual fiel" (`campaign-image-director.md:49`, e equivalentes nos 3 prompts por intent).
- **Depois (nos 4 prompts, hardcoded, sem placeholder):** bloco que descreve a presença de **1 imagem principal + N imagens auxiliares de referência**, instruindo o diretor a usar a principal como herói visual e as auxiliares como contexto (ângulos/variações/combos) **sem inventar conteúdo** dos produtos.
- **Sem nova variável de prompt** → o golden `EXPECTED_KEYS = 38` (por intent) **permanece idêntico** (regra F40-13 mantida). O texto do prompt muda intencionalmente; as imagens entram como **input multimodal**, não como variável textual.
- Teste golden por intent continua: mesmo conjunto de 38 keys para o mesmo input; texto do prompt muda (regressão por intent).

---

### D7 — Provider e fallback: N `input_image` no Responses; edit só com primary única

`DECIDIDO` (política fechada — o fallback não mente sobre o que consegue fazer)

- **`ImageProviderInput`** (`providers/types.ts`): `productImageDataUrl?: string` → mantido para o caminho legado + novo `productImagesDataUrls?: string[]` (ou equivalente — lista ordenada: posição 0 = primary). A ponte `primaryImageDataUrl(brief)` vira `mediaImagesDataUrls(brief)` no service.
- **Mainline Responses path (`openai.ts:71-73`):** monta **N blocos `input_image`** (primary + auxiliares; identidade/logo continua `detail: "low"`). `attempt >= 1` **sem** fallback edit quando há auxiliares.
- **Fallback `images.edit` (`openai.ts:58-61, 225-307`):** **SÓ permitido quando há APENAS a primary** (1 imagem). A limitação documentada (`:282-287` — uma única base image) vira **regra de negócio**: com auxiliares, retries permanecem no Responses path; se o Responses estiver indisponível → **erro explícito** (sem degradar a fidelidade descartando imagens).
- Custo/telemetria (`AiCostTracker`, `recordCall` em `route.ts`) permanece — a chamada continua sendo 1 evento `campaign_image` (imagens entram como tokens do mesmo input).

---

### D8 — Validação semântica produto×imagem: primary-only na v1

`DECIDIDO` (uma chamada vision, comportamento atual preservado; custo contido)

- `InputValidationService.validate(nome, productImageDataUrl)` (`input-validation-service.ts:40-71`) continua validando **apenas a imagem principal** contra o nome digitado. Auxiliares **não participam** da checagem de conflito/confiança.
- Fluxo de 409 (conflict / low-confidence / strong_conflict / override `user_confirmed_continue`) **inalterado** (`route.ts:296-352`, `use-campaign-form.ts` `consumeStream`).
- **Extensão futura** (registrada): validação multi-imagem (ex.: confirmar variações/combos) quando roles avançadas forem expostas.

---

### D9 — Review com a imagem principal como referência de fidelidade

`DECIDIDO` (alinhado ao escopo "review adaptado"; custo baixo — 1 imagem de visão extra)

- `ImageReviewService.review(generatedImage, input)` (`image-review-service.ts:54-63`) passa a receber, **opcionalmente**, a **dataUrl da imagem principal** e a envia junto ao prompt `campaign-image-reviewer` (bloco de imagem + texto). O revisor passa a verificar a **fidelidade do produto na arte gerada** (o produto da referência é o produto da peça).
- **Sem nova variável de prompt do revisor** (a imagem entra como input multimodal; o texto do prompt pode ganhar uma linha fixa "Compare o produto da arte com a imagem de referência").
- **Retrocompatível:** sem `productImagesDataUrls`/sem primary → revisor se comporta como hoje (nenhuma mudança para o caminho legado).
- Receber **TODAS** as imagens no review fica **deferido** (custo × benefício avaliado quando roles avançadas forem expostas).

---

### D10 — Limites e formatos: teto agregado + validação por item

`DECIDIDO` (payload do Vercel/Next e custo do modelo contidos)

- **N máximo de imagens:** `MAX_CAMPAIGN_IMAGES = 4` (1 primary + 3 auxiliares).
- **Por item (cliente):** formatos PNG/JPG/WEBP (+ HEIC com decode via canvas, D4); compressão existente (JPEG ≤1MB, downscale 1200px) por imagem; limite de arquivo 5MB no input.
- **Por item (rota):** `dataUrl.length <= MAX_PRODUCT_IMAGE_BASE64_SIZE` (4MB) para cada item + **teto agregado** do `productImages[]` (soma dos dataUrls) — evitar payload que estoure o limite de body e o custo do modelo. O limite legado single (`route.ts:126-135`) permanece para `productImageDataUrl`.
- **Erros 400/413 claros** em PT-BR indicando qual item excedeu e o limite (formato / tamanho / total).

---

```
ARQUIVOS MODIFICADOS (principais — planejamento da fase):
═══════════════════════════════════════════════════════════════════

src/lib/image-generation/schema.ts                 ← NOVO campo productImages[] + MAX_CAMPAIGN_IMAGES
                                                     (aditivo ao .strict(); productImageDataUrl legado)
src/lib/campaign/brief.ts                          ← mapper mapeia productImages[] (roles/source/mimeType
                                                     real); snapshot copia storagePath; helper de lista
                                                     de dataUrls do media
src/lib/campaign/brief-schema.ts                   ← (possivelmente reuso do flat schema; domínio intacto)
src/lib/image-generation/config.ts                 ← MAX_CAMPAIGN_IMAGES + teto agregado
src/lib/image-generation/services/image-generation-service.ts
                                                   ← primaryImageDataUrl → lista N; provider recebe N;
                                                     bloco descritivo do prompt (sem nova variável)
src/lib/image-generation/providers/types.ts        ← productImagesDataUrls?: string[] (nova entrada)
src/lib/image-generation/providers/openai.ts       ← N input_image no Responses; fallback edit gated
                                                     por primary-only (D7)
src/lib/image-generation/services/input-validation-service.ts
                                                   ← (inalterado — primary-only; recebe a primary)
src/lib/image-generation/services/image-review-service.ts
                                                   ← recebe primary como referência (D9)
src/components/flow/campaign-image-upload.tsx      ← multi-imagem + capture + preview grid + remover (D3/D4)
src/components/flow/use-campaign-form.ts           ← imageFiles[]/productImages[] no state, compressão por
                                                     item (HEIC/EXIF D4), draft multi, body com
                                                     productImages[] ou legado, teto agregado
src/components/flow/campaign-input-form.tsx        ← seções principal + adicionais + câmera
src/app/api/campaign/generate-image/route.ts       ← validação do array + teto; campaignId pré-gerado;
                                                     upload de inputs pré-snapshot; cleanup (D5); erros 400/413
src/lib/campaign/persistence.ts                    ← createCampaign aceita campaignId; uploadCampaignInputImage
                                                     novo; remoção por caminho
src/lib/campaign/types.ts                          ← CreateCampaignInput estendido (campaignId, storagePaths)

Testes (novos/co-migrados):
src/app/api/campaign/generate-image/__tests__/route.test.ts   ← payload multi, legado, teto, erros, storage
src/lib/campaign/__tests__/brief-mapper.test.ts               ← mapper array + invariante + snapshot storagePath
src/lib/campaign/__tests__/brief-snapshot.test.ts             ← N imagens sem base64, com storagePath
src/lib/image-generation/services/__tests__/image-generation-service.test.ts
                                                              ← lista N de dataUrls no provider; golden 38 keys
src/lib/image-generation/providers/__tests__/openai-provider.test.ts
                                                              ← N input_image; fallback gated
src/lib/image-generation/services/__tests__/image-review-service.test.ts ← review com primary
src/components/flow/__tests__/use-campaign-form-navigation.test.ts       ← novo state no EMPTY_FIELDS
src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx    ← mock do upload multi
```

---

## Contratos de Integração

```typescript
// src/lib/image-generation/schema.ts — transporte aditivo (D2)
export const MAX_CAMPAIGN_IMAGES = 4;

// O item NÃO carrega id no transporte — a rota gera/normaliza o id antes do
// upload/snapshot (D5), não confiando no cliente.
export const ProductImageInputSchema = z.object({
  role: z.enum(["primary", "variation", "combo_item", "reference"]),
  source: z.enum(["upload", "camera"]),
  mimeType: z.string(),
  dataUrl: z.string().min(1),
});

export const GenerateImageRequestSchema = z.object({
  // ...campos atuais inalterados...
  productImageDataUrl: z.string().min(1).optional(),  // legado — deixou de ser required (preservação COMPORTAMENTAL)
  productImages: z.array(ProductImageInputSchema)
    .min(1)
    .max(MAX_CAMPAIGN_IMAGES)
    .superRefine((imgs, ctx) => {
      const primary = imgs.filter(i => i.role === "primary").length;
      if (primary !== 1) {
        ctx.addIssue({ code: "custom", path: ["productImages"],
          message: `Deve existir exatamente 1 imagem com role "primary" (recebido: ${primary})` });
      }
    })
    .optional(),
}).strict();

// Regra de exclusividade/compatibilidade na rota (D2):
//   productImages presente + productImageDataUrl ausente → usa productImages (1 primary obrigatório)
//   productImages ausente + productImageDataUrl presente → legado → mapper gera [primary/upload]
//   ambos ausentes   → 400 "Imagem do produto é obrigatória" (rota — NÃO mais erro do Zod)
//   ambos presentes  → 400 "payload ambíguo" (regra canônica — mutuamente exclusivos)
```

```typescript
// src/lib/campaign/brief.ts — mapper multi-imagem (D2/D3)
// productImageDataUrl (legado) → [{ id, role: "primary", source: "upload",
//                                   mimeType: <derivado do dataUrl>, dataUrl }]
// productImages[]             → mapeia item a item (roles/source do transporte;
//                                mimeType derivado do dataUrl — corrige o quirk
//                                "image/jpeg" fixo da F39, brief.ts:161-171)

// Snapshot (D5) — copia storagePath quando presente:
// buildCampaignBriefSnapshot → media.images.map(i => ({
//     id, role, source, provided: true, mimeType,
//     ...(i.storagePath ? { storagePath: i.storagePath } : {}),
// }))
```

```typescript
// src/lib/image-generation/providers/types.ts — D7
export interface ImageProviderInput {
  prompt: string;
  productImageDataUrl?: string;       // legado (1 imagem)
  productImagesDataUrls?: string[];   // NOVO — lista ordenada (índice 0 = primary)
  identityImageUrl?: string;
  size?: string;
  quality?: string;
  signal?: AbortSignal;
  attempt?: number;
}
```

```typescript
// src/lib/campaign/persistence.ts — D5
// createCampaign(storeId, input, campaignId?: string)  → aceita id pré-gerado
// imageId gerado pela ROTA (D2 — cliente não envia id):
// uploadCampaignInputImage(storeId, campaignId, imageId, buffer) →
//   upload em `{storeId}/{campaignId}/inputs/{imageId}.jpg` (service_role, sem upsert)
// removeCampaignInputs(storeId, campaignId) → limpeza de objetos em falha pré-stream
```

```typescript
// Form/body — D2/D3/D4
// form state (o `id` aqui é INTERNO da UI — chave de lista/preview/remoção;
// NÃO entra no body enviado à rota; a rota gera o imageId — D2/D5):
//   productImages: Array<{ id, role, source, mimeType, file?: File, dataUrl?: string }>
// submit → se há auxiliares:
//   body.productImages = productImages.map(({ role, source, mimeType, dataUrl }) =>
//     ({ role, source, mimeType, dataUrl }))          // SEM id do cliente
// submit → sem auxiliares (compat): body.productImageDataUrl = <dataUrl da primary>
```

---

## Testes

Padrão do repositório (vitest + Testing Library). Suíte estimada ~32+ testes novos. Referências: D2–D10.

### Transporte e mapper — 8 testes
| # | Teste | Valida |
|---|-------|--------|
| 1 | `productImages[]` com primary + 2 reference → mapper gera `media.images` com roles/source/mimeType corretos | D2/D3 |
| 2 | `productImages` ausente + `productImageDataUrl` → comportamento legado idêntico (1 item primary/upload) | D2 |
| 3 | `productImages` sem primary ou com 2 primaries → 400 (invariante no transporte) | D2 |
| 4 | `productImages` + `productImageDataUrl` juntos → 400 ambíguo | D2 |
| 5 | `mimeType` derivado do dataUrl (png/jpeg/webp) — corrige quirk da F39 | D2 |
| 6 | Snapshot com N imagens: **sem dataUrl**, com `storagePath` por imagem | D5 |
| 7 | Legado com 1 imagem → comportamento e shape preservados (regressão): snapshot sem base64 com `mimeType: "image/jpeg"`; no teste unitário sem upload `storagePath` ausente — a primary ganha `storagePath` aditivo no fluxo de rota F41 (D5 nos dois fluxos) | D2/D5 |
| 8 | Exatamente 1 primary no snapshot/domínio (zod) para N imagens | D3 |

### UI / form — 8 testes
| # | Teste | Valida |
|---|-------|--------|
| 9 | Primary obrigatória; auxiliares opcionais até `MAX_CAMPAIGN_IMAGES - 1` | D3/D10 |
| 10 | Seleção/remoção/preview por item; remover primary → validação | D3 |
| 11 | Origem câmera → `source: "camera"`; galeria → `source: "upload"` | D4 |
| 12 | HEIC aceito no input; decode via canvas → JPEG; falha → mensagem PT-BR clara | D4 |
| 13 | Orientação EXIF respeitada na compressão (`createImageBitmap from-image`) | D4 |
| 14 | Body: com auxiliares → `productImages[]`; sem auxiliares → `productImageDataUrl` legado | D2 |
| 15 | Draft/autosave restaura N imagens (estado multi preservado) | D3 |
| 16 | Erros de limite por item e teto agregado exibidos no form | D10 |

### Pipeline / provider / review — 10 testes
| # | Teste | Valida |
|---|-------|--------|
| 17 | Provider Responses recebe N `input_image` (primary + auxiliares) | D7 |
| 18 | Fallback `images.edit` SÓ com primary única; com auxiliares → NÃO usa edit | D7 |
| 19 | Sem primary/legado → caminho atual 1 imagem (regressão) | D7 |
| 20 | Golden por intent: **mesmo conjunto de 38 keys** com multi-imagem; texto do prompt muda intencionalmente | D6 |
| 21 | Bloco descritivo 1+N referências presente nos 4 prompts | D6 |
| 22 | `InputValidationService` usa apenas a primary (primary-only) | D8 |
| 23 | Review recebe a primary como referência de fidelidade; sem primary → comportamento atual | D9 |
| 24 | Teto agregado do `productImages[]` excede → 413; item individual > 4MB → 413 | D10 |
| 25 | Rota: upload de inputs pré-snapshot com `campaignId` e `imageId` **gerados pela rota**; `storagePath` no snapshot | D5 |
| 26 | Limpeza: falha pré-stream remove inputs já enviados | D5 |
| 27 | Ausência de `productImageDataUrl` → 400 da **rota** (não mais erro direto do Zod) — co-migração dos testes antigos | D2 |

### Regressão (obrigatória)
- `generate-image` — fluxo completo (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterado** para o payload legado de 1 imagem
- `createCampaign` com `campaignId` pré-gerado e sem ele (regressão)
- Co-migração de fixtures: `route.test.ts` (inclusive testes que esperavam erro do Zod por ausência de `productImageDataUrl` — agora 400 da rota, teste 27), `brief-mapper.test.ts`, `image-generation-service.test.ts`, `image-review-service.test.ts`, `openai-provider.test.ts`, `use-campaign-form-navigation.test.ts` (novo state no `EMPTY_FIELDS`), `campaign-flow-credits.test.tsx` (mock do upload)
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

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
| **F40 ainda aberta (folder in-progress, rodapé ROADMAP desatualizado)** | Pré-requisito de limpeza (topo deste doc): arquivar/limpar a F40 antes de planejar a F41 |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Roles avançadas expostas ao lojista** (`variation`/`combo_item`) | **D3** — auxiliares como `reference`; roles avançadas internas/automáticas (extensão futura F37/catálogo) |
| **Validação produto×imagem multi-imagem** | **D8** — primary-only na v1; multi-imagem deferida |
| **Review com TODAS as imagens** | **D9** — revisor recebe a primary; todas as imagens deferido |
| **Dependência de lib HEIC** (`heic2any`/`libheif`) | **D4** — decode via canvas; lib só se UAT real mostrar necessidade |
| **Catálogo de produtos por loja / `productAssetId`** | F39 D3 — fase subsequente |
| **Stripe / Monetização Pública** | **F42** (v1.7, pós-beta) — renumeração D1 |
| **F37 — Revisão e Aprovação da Arte** | Fase própria, após F41; consome o snapshot com N imagens |
| **Migration SQL** | Snapshot `campaign_brief_v1` (jsonb tolerante) e bucket `campaign-images` existente comportam a F41 (D5) |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Numeração: F41 = Mídia de Campanha Mobile (v1.5), Stripe → F42 (v1.7); runbook de trackings aplicado (6 arquivos); pré-requisito de limpeza da F40 verificado
- [ ] D2 — Transporte aditivo `productImages[]` (sem `id` do cliente — rota gera) + `productImageDataUrl` legado (preservação **comportamental**, deixa de ser required no Zod); regra de exclusividade/compatibilidade determinística (400 em payload ambíguo); `.strict()` preservado
- [ ] D3 — Roles na v1: primary obrigatória + auxiliares `reference`; roles avançadas internas
- [ ] D4 — Câmera/mobile: `capture`, HEIC via canvas (sem dependência), EXIF respeitado, UAT com celular real
- [ ] D5 — Persistência dos inputs no bucket `campaign-images` (`{storeId}/{campaignId}/inputs/...`); `campaignId` pré-gerado; upload pré-snapshot; `storagePath` no snapshot; limpeza pré-stream; sem migration
- [ ] D6 — Prompt com bloco descritivo 1+N referências **sem nova variável**; golden `EXPECTED_KEYS` = 38 por intent preservado
- [ ] D7 — Provider Responses com N `input_image`; fallback edit **só** com primary única
- [ ] D8 — Validação produto×imagem primary-only na v1
- [ ] D9 — Review recebe a primary como referência de fidelidade (retrocompatível)
- [ ] D10 — Limites: `MAX_CAMPAIGN_IMAGES = 4`; compressão por item; teto agregado; erros 400/413 claros

### Fluxo (comportamento preservado + novos controles)
- [ ] Gerar campanha com 1 imagem (legado) → comportamento/UX idênticos ao pós-F40; snapshot sem base64 preservado + `storagePath` aditivo da primary (D5 nos dois fluxos — decisão do usuário 2026-08-14)
- [ ] Gerar campanha com primary + 2 auxiliares → `media.images[]` com 3 itens (roles/source/mimeType corretos)
- [ ] UI de seleção/remoção/preview por item; remover primary bloqueado/validado
- [ ] Câmera (mobile) → `source: "camera"`; foto HEIC convertida; orientação correta (UAT celular real)
- [ ] Inputs persistidos em `{storeId}/{campaignId}/inputs/` com `storagePath` no snapshot (sem base64)
- [ ] Provider recebe N imagens; fallback edit não ocorre com auxiliares
- [ ] Golden por intent: **mesmo conjunto de 38 keys**; texto do prompt muda intencionalmente
- [ ] Review confere o produto da arte contra a primary; sem primary → comportamento atual
- [ ] Teto agregado/limite por item → erro claro (400/413)

### Snapshot / auditoria
- [ ] `campaign_brief_v1` com N imagens **sem base64** e com `storagePath` por imagem (jsonb tolerante; sem migration)
- [ ] `createCampaign` aceita `campaignId` pré-gerado (regressão com e sem o parâmetro)
- [ ] Limpeza: falha pré-stream remove inputs já enviados (sem órfãos)

### Renumeração (D1 — trackings)
- [ ] `ROADMAP.md` (raiz) — F41 = Mídia; F42 = Stripe
- [ ] `.planning/ROADMAP.md` — phase numbering, tabela Progress, notas, deps, graph, seção Fase 41, rodapé (incl. correção "F40 em PLANEJAMENTO")
- [ ] `.planning/STATE.md` — frontmatter, Current Position, Next Phases, Last updated
- [ ] `.planning/PROJECT.md` — Stripe F41 → F42; rodapé
- [ ] `.planning/REQUIREMENTS.md` — v1.7 "F41" → "F42"
- [ ] `.planning/MILESTONES.md` — "v1.7 (F41)" → "(F42)"

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando (incluindo co-migrados)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### UAT Local
- [ ] Gerar campanha com 1 imagem (legado) — fluxo atual idêntico
- [ ] Gerar campanha com primary + auxiliares (galeria) — arte com herói = primary e contexto das auxiliares
- [ ] Câmera no celular (foto nova) — HEIC/EXIF ok, arte correta
- [ ] Remover/adicionar auxiliares e regenerar — preview e payload consistentes
- [ ] Fazer upload de imagem sem primary válida → erro claro
- [ ] Campanha antiga (pré-F41) continua exibindo/baixando normalmente (sem migração destrutiva)
