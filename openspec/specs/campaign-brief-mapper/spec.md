# Campaign Brief Mapper

> Synced from `fase-39-brief-estruturado-campanha` (ADDED).

## Purpose

Mapper `buildCampaignBriefFromFlat` na fronteira da rota `POST /api/campaign/generate-image` (Opção 1 — D5) e rename do wrapper atual para `ResolvedCampaignContext` (D4). Round-trip flat→brief preservando campos equivalentes e regra de borda sem imagem → 400.

## Requirements

### Requirement: Mapper buildCampaignBriefFromFlat

O sistema SHALL prover `buildCampaignBriefFromFlat(input: GenerateImageRequest, storeId: string, source?: CampaignBriefSource): CampaignBrief` como o **único ponto de conversão** de transporte flat → domínio estruturado, na fronteira da rota `POST /api/campaign/generate-image` (D5).

- O mapper SHALL preservar **todos os campos equivalentes** do payload flat: `productName` → `product.name`; `originalPriceCents`/`discountedPriceCents`/`badgeText` → `commercial.*`; `campaignIntent` → `commercial.intent`; `preserveImageContext` → `creativeContext.preserveImageContext`; `description` → `product.description`; `availabilityNotes`/`campaignDetails`/`additionalDetails` → `commercial.*`; campos adormecidos mapeados 1:1 com lar canônico: `hook`/`cta`/`objective`/`targetChannel`/`format` → `commercial.*`, `sensitiveConstraints` → `creativeContext.sensitiveConstraints` (preservados para os prompts).
- `validity` (string atual) → `commercial.validity = { enabled: true, displayText: <string> }`; sem string → campo ausente (D8).
- `mandatoryArtworkText` → `commercial.legalNotice = { enabled: true, text: <string> }`; ausente → campo ausente (D9).
- **Imagens (multi-imagem — D2/D3):**
  - `productImages[]` (transporte) → `media.images[]` **item a item**: `role`/`source` vindos do transporte, `mimeType` **real derivado do dataUrl** (corrige o quirk do `"image/jpeg"` fixo da F39 — `brief.ts:161-171`), `id` uuid gerado por item.
  - `productImageDataUrl` (legado, sem `productImages`) → **equivalente a `productImages` de 1 elemento**: 1 item com `role: "primary"`, `source: "upload"`, `mimeType` derivado do dataUrl (reuso da mesma lógica — zero bifurcação no pipeline).
  - A regra de exclusividade (D2) garante que **nunca** chegam ambos os campos ao mapper.
- `metadata.source` default `"web_form"`; `metadata.schemaVersion = "campaign_brief_v1"`.
- O mapper SHALL ser uma função pura (sem DB, sem `"use server"`) — mesmo padrão de `buildCampaignBrief` atual (`multitenant-server-actions`).

#### Scenario: round-trip flat → brief preserva campos equivalentes

- **WHEN** `buildCampaignBriefFromFlat` recebe um payload flat completo (nome, preços, badge, intent, preserveImageContext, validade, aviso)
- **THEN** `product.name`/`commercial.discountedPriceCents`/`commercial.originalPriceCents`/`commercial.badgeText`/`commercial.intent`/`creativeContext.preserveImageContext` carregam os valores equivalentes
- **AND** `commercial.validity.displayText` e `commercial.legalNotice.text` propagam os valores de `validity`/`mandatoryArtworkText`

#### Scenario: validade string converte para displayText

- **WHEN** o payload carrega `validity: "válida até 30/09"`
- **THEN** `brief.commercial.validity = { enabled: true, displayText: "válida até 30/09" }` (D8)

#### Scenario: validade ausente gera campo ausente

- **WHEN** o payload não carrega `validity`
- **THEN** `brief.commercial.validity` está ausente (`undefined`) — regra canônica: campo não informado → **ausente** no contrato e no snapshot (nunca `enabled: false` fabricado)

#### Scenario: mandatoryArtworkText converte para legalNotice

- **WHEN** o payload carrega `mandatoryArtworkText: "Imagem meramente ilustrativa"`
- **THEN** `brief.commercial.legalNotice = { enabled: true, text: "Imagem meramente ilustrativa" }` (D9)

#### Scenario: productImages mapeia roles/source/mimeType reais (D2/D3)

- **WHEN** o payload carrega `productImages` com 1 `primary` (PNG, camera) + 2 `reference` (JPG, upload)
- **THEN** `brief.media.images` tem 3 itens com `role`/`source` vindos do transporte
- **AND** o `mimeType` de cada item é **derivado do próprio dataUrl** (`image/png`, `image/jpeg`) — não hardcoded
- **AND** cada item tem `id` uuid não-vazio
- **AND** `dataUrl` permanece apenas no runtime (não vaza para snapshot)

#### Scenario: Legado productImageDataUrl equivale a 1 elemento primary/upload (D2)

- **WHEN** o payload carrega apenas `productImageDataUrl` (legado)
- **THEN** `brief.media.images[0]` tem `role: "primary"`, `source: "upload"`, `mimeType` derivado do dataUrl, `id` uuid
- **AND** o resultado é **idêntico** ao `productImages` de 1 elemento (regressão preservada)

### Requirement: Regra de borda sem imagem (400)

O sistema SHALL aplicar a **regra de exclusividade/compatibilidade** (D2) na rota — a ausência de imagem deixa de ser erro do Zod e passa a ser **400 da rota**:

- `productImages` presente + `productImageDataUrl` ausente → válido; deve conter **exatamente 1 `primary`** (invariante no transporte).
- `productImages` ausente + `productImageDataUrl` presente → legado (mapper gera 1 elemento primary/upload).
- **Ambos ausentes** → 400 "Imagem do produto é obrigatória".
- **Ambos presentes** → 400 (payload ambíguo — mutuamente exclusivos).

O mapper SHALL preservar a regra de borda do transporte: payload sem imagem (nem `productImages` nem `productImageDataUrl`) SHALL ser rejeitado com **400** na rota (imagem obrigatória — invariante D7/D2).

#### Scenario: rejeição sem imagem (400)

- **WHEN** a rota recebe um payload sem `productImageDataUrl` E sem `productImages`
- **THEN** a resposta é 400 com mensagem de erro (imagem obrigatória)

#### Scenario: rejeição de payload ambíguo (400)

- **WHEN** a rota recebe um payload com **ambos** `productImageDataUrl` e `productImages`
- **THEN** a resposta é 400 (payload ambíguo — os campos são mutuamente exclusivos)

#### Scenario: payload novo válido passa

- **WHEN** a rota recebe um payload com `productImages` (1 primary + auxiliares) sem `productImageDataUrl`
- **THEN** a validação de imagem passa e o mapper processa o array

### Requirement: ResolvedCampaignContext rename

O sistema SHALL renomear o wrapper atual de transporte (`src/components/campaign/types.ts:37`) de `CampaignBrief` para **`ResolvedCampaignContext`**, mantendo o **mesmo shape** consumido pelo pipeline: `{ campaignInput, store, brandProfile, identity }` (D4).

- `buildCampaignBrief` (`src/lib/store-identity-service.ts`) SHALL retornar `ResolvedCampaignContext`.
- Todos os callers existentes SHALL continuar consumindo `ResolvedCampaignContext` **sem quebra** (mesmo shape, mesmo campo `campaignInput`).
- O nome `CampaignBrief` fica livre para significar **o contrato de domínio estruturado** (D4).
- `brand_profile.campaign_brief` (campo de direção de marca do Brand Profiler) permanece **inalterado**.

#### Scenario: ResolvedCampaignContext mantém shape do pipeline

- **WHEN** o pipeline atual consome o wrapper renomeado
- **THEN** `ResolvedCampaignContext` contém `campaignInput` (transporte flat transparente), `store`, `brandProfile`, `identity` com os mesmos tipos de antes (D4)

#### Scenario: buildCampaignBrief retorna ResolvedCampaignContext

- **WHEN** `buildCampaignBrief` (`src/lib/store-identity-service.ts`) é chamado
- **THEN** retorna `ResolvedCampaignContext` sem quebrar os callers existentes (D4)

#### Scenario: brand_profile.campaign_brief inalterado

- **WHEN** o Brand Profiler gera direção de marca
- **THEN** o campo `campaign_brief` permanece como string (direção de marca), sem relação com o novo domínio `CampaignBrief` (D4)
