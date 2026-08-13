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
- `productImageDataUrl` + `mimeType` → `media.images[0]` runtime (`role: "primary"`, `source: "upload"`, `id` uuid) (D7).
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

#### Scenario: productImageDataUrl converte para media.images runtime

- **WHEN** o payload carrega `productImageDataUrl` + `mimeType: "image/jpeg"`
- **THEN** `brief.media.images[0]` tem `role: "primary"`, `source: "upload"`, `mimeType: "image/jpeg"`, `id` uuid
- **AND** `dataUrl` permanece apenas no runtime (não vaza para snapshot)

### Requirement: Regra de borda sem imagem (400)

O sistema SHALL preservar a regra de borda do transporte: payload sem `productImageDataUrl` SHALL ser rejeitado com **400** na rota (imagem obrigatória — invariante D7).

#### Scenario: rejeição sem imagem

- **WHEN** a rota recebe um payload flat sem `productImageDataUrl`
- **THEN** a resposta é 400 com mensagem de erro (imagem obrigatória)

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
