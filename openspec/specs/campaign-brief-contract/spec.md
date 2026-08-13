# Campaign Brief Contract

> Synced from `fase-39-brief-estruturado-campanha` (ADDED).

## Purpose

Contrato de domínio `CampaignBrief` estruturado: `product` / `commercial` / `media` / `creativeContext` / `metadata`. Produto é domínio **separado** da oferta (D3); imagens usam tipos runtime × snapshot separados por construção (D7); `validity`/`legalNotice`/`themeId` semânticos (D8/D9/D10); helper `getCampaignLegalNotice` para leitura direta (D9).

## Requirements

### Requirement: CampaignBrief domain type

O sistema SHALL definir o tipo `CampaignBrief` como contrato de domínio estruturado, agrupado por domínio, com os seguintes blocos:

- `product: CampaignBriefProduct` — dados **estáveis** do produto (nome, marca, variante, descrição, origem) — separado da oferta (D3)
- `commercial: CampaignBriefCommercial` — dados **promocionais** da campanha (intent, preços, badge, validade, aviso legal, disponibilidade, detalhes)
- `media: { images: CampaignProductImageInput[] }` — imagens do produto no formato de lista (runtime)
- `creativeContext: CampaignBriefCreativeContext` — contexto criativo (`preserveImageContext?`, `themeId?`)
- `metadata: { source: CampaignBriefSource; schemaVersion: CampaignBriefSchemaVersion }` — origem do brief e versão do schema

O tipo `CampaignBrief` SHALL ser definido em `src/lib/campaign/brief.ts` (sem server-only). `metadata.schemaVersion` existe **apenas no brief runtime** — nunca no snapshot persistido (D6).

#### Scenario: CampaignBrief agrupado por domínio

- **WHEN** `buildCampaignBriefFromFlat` monta um `CampaignBrief` a partir de um payload flat válido
- **THEN** o brief contém os cinco blocos `product` / `commercial` / `media` / `creativeContext` / `metadata`
- **AND** `metadata.schemaVersion === "campaign_brief_v1"` e `metadata.source === "web_form"`

#### Scenario: product separado de commercial

- **WHEN** um payload flat contém `productName`, preços e `badgeText`
- **THEN** `product.name` carrega o nome do produto
- **AND** `commercial.discountedPriceCents`/`commercial.originalPriceCents`/`commercial.badgeText` carregam os dados promocionais
- **AND** dados de produto não aparecem dentro de `commercial` e vice-versa (D3)

### Requirement: CampaignBriefProduct com origem e referência de catálogo reservadas

O sistema SHALL definir `CampaignBriefProduct` com:

```ts
{
  source: ProductSource;           // "manual" agora; "catalog" reservado (D3)
  catalogProductId?: string;       // encaixe futuro — não aponta tabela nesta fase
  name: string;
  brand?: string;
  sizeOrVariant?: string;
  description?: string;
}
```

- `ProductSource = "manual" | "catalog"`. Nesta fase **apenas `manual` é produzido** pelo mapper; `catalog` é contrato reservado.
- `catalogProductId?` SHALL ser opcional e **não apontar para tabela alguma** nesta fase.
- Default de `source` SHALL ser `"manual"` quando o mapper não recebe origem explícita.

#### Scenario: product.source default manual

- **WHEN** `buildCampaignBriefFromFlat` é chamado com um payload sem indicação de origem
- **THEN** `brief.product.source === "manual"` (D3)
- **AND** `brief.product.catalogProductId` está ausente (undefined)

#### Scenario: catalogProductId reservado não-apontando tabela

- **WHEN** um payload carrega `catalogProductId` (futuro)
- **THEN** o contrato aceita o campo opcional
- **AND** nenhuma leitura nesta fase resolve `catalogProductId` contra tabela ou storage

### Requirement: CampaignProductImageInput (imagem runtime)

O sistema SHALL definir `CampaignProductImageInput` como o tipo de imagem do brief **em memória/transporte** (D7):

```ts
{
  id: string;                       // uuid gerado na montagem do brief
  role: CampaignImageRole;          // "primary" | "variation" | "combo_item" | "reference"
  source: CampaignImageSource;      // "upload" | "camera"
  mimeType: string;                 // ex.: "image/jpeg"
  dataUrl?: string;                 // APENAS no transporte, nunca no snapshot
}
```

- `CampaignImageRole = "primary" | "variation" | "combo_item" | "reference"`.
- `CampaignImageSource = "upload" | "camera"`.
- `dataUrl?` SHALL existir apenas neste tipo runtime — o tipo de snapshot (`CampaignBriefSnapshotImage`) não o possui (D6/D7).

#### Scenario: imagem primary gerada com uuid e source upload

- **WHEN** `buildCampaignBriefFromFlat` recebe `productImageDataUrl` + `mimeType`
- **THEN** `brief.media.images[0]` tem `role: "primary"`, `source: "upload"`, `mimeType` herdado, `id` uuid não-vazio
- **AND** `dataUrl` fica **só no runtime** (presente no brief, ausente no snapshot)

#### Scenario: role permite valores futuros

- **WHEN** o contrato de `CampaignImageRole` é validado
- **THEN** aceita `primary`, `variation`, `combo_item`, `reference`
- **AND** nesta fase apenas `primary` é produzido pelo mapper

### Requirement: CampaignBriefCommercial com domínios semânticos

O sistema SHALL definir `CampaignBriefCommercial` com:

```ts
{
  intent: CampaignIntent;
  originalPriceCents?: number;
  discountedPriceCents?: number;
  badgeText?: string;
  validity?: CampaignOfferValidity;      // D8
  legalNotice?: CampaignOfferLegalNotice; // D9 — canônico AQUI, sem espelho
  availabilityNotes?: string;
  campaignDetails?: string;
  additionalDetails?: string;
  hook?: string;                          // campo adormecido — preservado p/ prompts (D11)
  cta?: string;                           // campo adormecido — preservado p/ prompts (D11)
  objective?: string;                     // campo adormecido — preservado p/ prompts (D11)
  targetChannel?: string;                 // campo adormecido — preservado p/ prompts (D11)
  format?: string;                        // campo adormecido — preservado p/ prompts (D11)
}
```

- `validity` e `legalNotice` vivem **apenas** dentro de `commercial` — não há seção top-level nem espelho (D9).
- Os campos adormecidos (hoje no schema sem UI) SHALL ser preservados com mapeamento 1:1 no contrato, para os prompts continuarem recebendo as mesmas variáveis. **Lar canônico:** `hook`/`cta`/`objective`/`targetChannel`/`format`/`validity`/`availabilityNotes` → `commercial`; `sensitiveConstraints` → `creativeContext` (D11).
- Regra canônica de ausência: campo não informado no transporte → **campo ausente** no contrato e no snapshot (nunca `{ enabled: false }` fabricado — o `enabled: false` só existirá se um estado explícito futuro o exigir).

#### Scenario: legalNotice aninhado em commercial

- **WHEN** um `CampaignBrief` é serializado/validado
- **THEN** `legalNotice` existe apenas como `brief.commercial.legalNotice`
- **AND** não existe `brief.legalNotice` (sem espelho — D9)

#### Scenario: validade estruturada

- **WHEN** o mapper recebe `validity` string do transporte
- **THEN** `brief.commercial.validity` tem `{ enabled: true, displayText: <string> }`
- **AND** quando o transporte não tem `validity`, o campo fica ausente (`undefined`)

### Requirement: CampaignOfferValidity semântica

O sistema SHALL definir `CampaignOfferValidity` (D8):

```ts
{
  enabled: boolean;
  displayText?: string;   // texto exibido na arte/copy (beta começa com este)
  endDate?: string;       // data ISO opcional — reservada, sem UI nesta fase
}
```

- `displayText` SHALL ser a fonte da validade para prompts/copy quando `enabled: true`.
- `endDate` SHALL ser contrato reservado — nenhuma UI nem prompt o consome nesta fase.

#### Scenario: validity com displayText

- **WHEN** `brief.commercial.validity.enabled === true` e `displayText = "válida até 30/09"`
- **THEN** `buildCommercialRepertoire` inclui a validade no prompt de oferta **sem depender de heurística** (`/`, `até`, `válida`)

#### Scenario: validity desabilitada não gera texto

- **WHEN** `brief.commercial.validity` está ausente ou `enabled === false`
- **THEN** nenhum texto de validade entra no prompt/copy

### Requirement: CampaignOfferLegalNotice semântica

O sistema SHALL definir `CampaignOfferLegalNotice` (D9):

```ts
{
  enabled: boolean;
  text?: string;           // ex.: "Imagem meramente ilustrativa"
}
```

- `enabled === false` SHALL significar que **nada entra na arte** (nem prompt, nem revisão) — semântica explícita, substituindo a string solta.
- `mandatoryArtworkText` (transporte) SHALL mapear para `legalNotice.text` com `enabled: true` quando presente.

#### Scenario: legalNotice habilitado propaga texto

- **WHEN** `brief.commercial.legalNotice.enabled === true` e `text = "Imagem meramente ilustrativa"`
- **THEN** o prompt do Image Director e o revisor recebem o texto obrigatório como antes (compat `mandatoryArtworkText` — fix `260804-s16` mantido)

#### Scenario: legalNotice desabilitado bloqueia texto

- **WHEN** `brief.commercial.legalNotice.enabled === false` (ou ausente)
- **THEN** o texto **não** entra no prompt do Image Director nem no revisor

### Requirement: CampaignBriefCreativeContext com themeId reservado

O sistema SHALL definir `CampaignBriefCreativeContext` (D10):

```ts
{
  preserveImageContext?: boolean;
  themeId?: string | null;        // reservado — sempre null nesta fase (D10)
  sensitiveConstraints?: string;  // campo adormecido — preservado p/ prompts (D11)
}
```

- `themeId` SHALL nascer no contrato como opcional nullable, sempre `null` nesta fase.
- `sensitiveConstraints` SHALL viver em `creativeContext` (lar canônico — D11), preservado 1:1 para os prompts.
- **Nenhum sistema de temas** (CRUD, direção visual de tema, `themeSnapshot`) SHALL ser criado nesta fase.

#### Scenario: themeId presente e null

- **WHEN** um `CampaignBrief` é montado pelo mapper
- **THEN** `brief.creativeContext.themeId` está presente e é `null`

#### Scenario: preserveImageContext propagado

- **WHEN** o transporte envia `preserveImageContext: true`
- **THEN** `brief.creativeContext.preserveImageContext === true`
- **AND** quando `campaignIntent === "offer"`, o valor é normalizado para `false`/omitido (regra existente preservada)

### Requirement: Invariante de imagem primary

O sistema SHALL garantir que **sempre existe exatamente 1 imagem `role: "primary"`** em `media.images` (D7).

- A validação do contrato (zod `brief-schema.ts`) SHALL rejeitar briefs com 0 ou 2+ imagens `primary`.
- A validação do schema HTTP de transporte SHALL manter a regra de borda: `productImageDataUrl` ausente → **400** (imagem obrigatória).

#### Scenario: brief com exatamente 1 primary é válido

- **WHEN** `media.images` contém exatamente 1 item com `role: "primary"`
- **THEN** a validação do contrato passa

#### Scenario: brief sem primary é rejeitado

- **WHEN** `media.images` não contém nenhuma imagem `primary` (ou `media.images` vazio)
- **THEN** a validação do contrato falha

#### Scenario: rejeição sem imagem no transporte (400)

- **WHEN** o payload flat não contém `productImageDataUrl`
- **THEN** a rota responde 400 (imagem obrigatória — invariante preservada)

### Requirement: Helper getCampaignLegalNotice

O sistema SHALL prover `getCampaignLegalNotice(brief: CampaignBrief): CampaignOfferLegalNotice | undefined` como **leitura direta** para fases futuras (F37) — NÃO é um campo no contrato (D9):

```ts
export function getCampaignLegalNotice(brief: CampaignBrief): CampaignOfferLegalNotice | undefined {
  return brief.commercial.legalNotice;
}
```

#### Scenario: helper lê legalNotice de commercial

- **WHEN** `getCampaignLegalNotice(brief)` é chamado com um brief com `legalNotice`
- **THEN** retorna `brief.commercial.legalNotice`
- **AND** retorna `undefined` quando `legalNotice` não está presente

#### Scenario: helper não duplica estado

- **WHEN** `getCampaignLegalNotice` é usado para leitura
- **THEN** o helper apenas lê o campo canônico em `commercial.legalNotice` — não mantém cópia própria
