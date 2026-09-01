# Campaign Types

> Synced from `fase-13-servico-persistencia-download` (ADDED), `fase-17-edicao-publication-copy` (MODIFIED), `fase-23-text-provider-copy-director` (MODIFIED), `fase-31-1-modelo-comercial-formulario` (MODIFIED), and `fase-39-brief-estruturado-campanha` (RENAMED + MODIFIED).

## Purpose

Interfaces manuais TypeScript para o serviço de persistência de campanhas: tipos de status, record, input, ready data, e shapes mínimos v1 dos snapshots JSONB.

## Requirements

### Requirement: CampaignStatus type

O sistema SHALL definir o tipo `CampaignStatus` como `"generating" | "ready" | "error"`.

#### Scenario: CampaignStatus accepts three values

- **WHEN** `CampaignStatus` é usado
- **THEN** aceita apenas `"generating"`, `"ready"`, ou `"error"`

### Requirement: CampaignRecord interface

O sistema SHALL definir a interface `CampaignRecord` com todos os campos da tabela `public.campaigns`:
`id (string)`, `store_id (string)`, `status (CampaignStatus)`, `product_name (string)`, `input_snapshot (Record<string, unknown>)`, `identity_snapshot (Record<string, unknown> | null)`, `generation_metadata (Record<string, unknown> | null)`, `render_snapshot (Record<string, unknown> | null)`, `publication_copy_snapshot (Record<string, unknown> | null)`, `publication_copy_current (Record<string, unknown> | null)`, `storage_path (string)`, `error_message (string | null)`, `created_at (string)`, `updated_at (string)`.

**Nota:** O campo `publication_copy_current` é ADICIONADO. Quando presente, contém os mesmos campos de `PublicationCopySnapshot` (`caption`, `hashtags`, `cta_post`). Quando `null`, o sistema usa `publication_copy_snapshot` como fallback.

#### Scenario: CampaignRecord has all required fields

- **WHEN** `CampaignRecord` é instanciado
- **THEN** todos os campos da tabela `public.campaigns` estão presentes com os tipos corretos

#### Scenario: CampaignRecord aceita publication_copy_current

- **WHEN** um registro de `campaigns` é mapeado para `CampaignRecord`
- **THEN** o campo `publication_copy_current` está presente como `Record<string, unknown> | null`
- **AND** é opcional — registros sem edição têm `publication_copy_current = null`

### Requirement: CreateCampaignInput interface

O sistema SHALL definir `CreateCampaignInput` com `productName (string)`, `inputSnapshot (Record<string, unknown>)`, e `identitySnapshot (Record<string, unknown> | undefined)`.

**F41 D5 — estendido:**
- `campaignId?` — string, opcional — id **pré-gerado pela rota** para a criação da campanha (permite o path de inputs `{storeId}/{campaignId}/inputs/...` ser conhecido antes do snapshot).
- `storagePaths?` — array de `{ imageId: string; storagePath: string }`, opcional — os paths dos inputs persistidos por imagem (registro auxiliar; o snapshot `campaign_brief_v1` é quem carrega o `storagePath` canônico por imagem).

A função `createCampaign(storeId, input, campaignId?: string)` SHALL aceitar o `campaignId` também como **terceiro parâmetro opcional** (D5) — quando presente, o INSERT usa esse id; quando ausente, gera UUID internamente (regressão).

#### Scenario: CreateCampaignInput has required fields

- **WHEN** `createCampaign` é chamado
- **THEN** aceita `productName`, `inputSnapshot` e opcionalmente `identitySnapshot`

#### Scenario: CreateCampaignInput aceita campaignId pré-gerado (D5)

- **WHEN** a rota pré-gera `campaignId` e `storagePaths` dos inputs
- **THEN** `CreateCampaignInput` aceita `campaignId?` e `storagePaths?` opcionais
- **AND** a função `createCampaign` aceita o `campaignId` como terceiro parâmetro opcional

#### Scenario: CreateCampaignInput sem os campos novos (regressão)

- **WHEN** `createCampaign` é chamado sem `campaignId`/`storagePaths`
- **THEN** o comportamento atual é preservado (id gerado internamente — regressão)

### Requirement: CampaignReadyData interface

O sistema SHALL definir `CampaignReadyData` com `generationMetadata (Record<string, unknown>)`, `renderSnapshot (Record<string, unknown>)`, e `publicationCopySnapshot (Record<string, unknown>)`.

#### Scenario: CampaignReadyData has all three snapshots

- **WHEN** `updateCampaignReady` é chamado
- **THEN** aceita `generationMetadata`, `renderSnapshot`, e `publicationCopySnapshot`

### Requirement: Input snapshot shape v1 → CampaignBriefSnapshot (versioned)

> Renamed from `Input snapshot shape v1` by `fase-39-brief-estruturado-campanha` (D6): o `input_snapshot` passa de flat para **estruturado e versionado** (`campaign_brief_v1`). O tipo `InputSnapshot`/shape v1 flat é substituído pelo `CampaignBriefSnapshot` (versão canônica no root; sem base64 por tipo). `mandatoryArtworkText` migra para `commercial.legalNotice` (D9).

O sistema SHALL definir o shape de `input_snapshot` como `CampaignBriefSnapshot` versionado, com as seções por domínio e `schemaVersion` canônico no root:

```ts
input_snapshot: {
  schemaVersion: "campaign_brief_v1",
  product: { source: "manual", name: string, description?: string },  // "catalog" reservado (D3)
  commercial: {
    intent, originalPriceCents?, discountedPriceCents?, badgeText?,
    validity?: { enabled, displayText?, endDate? },   // D8
    legalNotice?: { enabled, text? },                 // D9 — canônico AQUI
    availabilityNotes?, campaignDetails?, additionalDetails?, ...
  },
  media: { images: [ { id, role: "primary", source: "upload", mimeType, provided: true } ] },  // CampaignBriefSnapshotImage — sem dataUrl (D7)
  creativeContext: { preserveImageContext?, themeId?: string | null },   // D10
  metadata: { source: "web_form" | "api" },             // SEM schemaVersion aqui (D6)
}
```

- `schemaVersion: "campaign_brief_v1"` SHALL ficar no **root** do snapshot; `metadata` do snapshot **não** contém `schemaVersion` (sem duplicação — D6). `metadata.schemaVersion` existe apenas no brief runtime (`CampaignBrief`).
- `legalNotice` vive **apenas** dentro de `commercial` (D9) — sem seção top-level.
- A imagem do snapshot usa o tipo `CampaignBriefSnapshotImage` (sem `dataUrl` por construção — D7). **Base64 nunca entra no snapshot**, garantido por teste de contrato (D6/D12).
- Campos adormecidos continuam preservados no snapshot com mapeamento 1:1 (D11) e o mesmo lar canônico do brief: `hook`/`cta`/`objective`/`targetChannel`/`format` em `commercial`; `sensitiveConstraints` em `creativeContext`.
- Regra canônica de ausência: campo não informado no transporte → **ausente** no snapshot (nunca `{ enabled: false }` fabricado).
- Quando `campaignIntent === "offer"`, `preserveImageContext` SHALL ser normalizado para `false`/omitido (regra existente preservada).
- Campanhas antigas (pré-F39) com `input_snapshot` flat SHALL continuar exibindo/baixando normalmente (leitura tolerante, sem migração destrutiva).

#### Scenario: Input snapshot versionado com schemaVersion no root

- **WHEN** um novo `input_snapshot` é persistido após a F39
- **THEN** contém `schemaVersion: "campaign_brief_v1"` no root
- **AND** as seções `product` / `commercial` / `media` / `creativeContext` / `metadata`
- **AND** `metadata` do snapshot NÃO contém `schemaVersion` (canônico no root — D6)

#### Scenario: legalNotice no snapshot apenas dentro de commercial

- **WHEN** um snapshot `campaign_brief_v1` é persistido com aviso ilustrativo
- **THEN** o aviso aparece como `commercial.legalNotice` (`{ enabled, text? }`)
- **AND** não existe campo `mandatoryArtworkText` no snapshot nem `legalNotice` top-level (D9)

#### Scenario: Input snapshot has product image metadata (sem base64)

- **WHEN** `input_snapshot` é populado
- **THEN** o campo `media.images[0]` contém `{ id, role: "primary", source: "upload", mimeType, provided: true }` sem data URL bruta (por tipo `CampaignBriefSnapshotImage` — D7)

#### Scenario: Input snapshot aceita campaignIntent e preserveImageContext

- **WHEN** `input_snapshot` é populado com `campaignIntent` e `preserveImageContext`
- **THEN** `commercial.intent` e `creativeContext.preserveImageContext` estão presentes com tipos corretos

#### Scenario: preserveImageContext normalizado para false em offer

- **WHEN** `campaignIntent === "offer"` e `preserveImageContext === true`
- **THEN** no snapshot o valor de `preserveImageContext` é `false` ou omitido

#### Scenario: campanha antiga (pré-F39) continua válida

- **WHEN** uma campanha existente com `input_snapshot` flat (pré-F39) é lida
- **THEN** continua exibindo/baixando normalmente (sem migração destrutiva)

### Requirement: Identity snapshot shape v1

O sistema SHALL definir o shape mínimo de `identity_snapshot` com campos: `storeName`, `storeSegment`, `brandColor`, `identityState ("text_only" | "logo" | "visual_signature")`, `signature: { url: string | null; type: "logo" | "visual_signature" | null }`, `storeInitials`, `brandProfile?`, `toneOfVoice?`, `subsegment?`, `positioning?`, `shortDescription?`, `slogan?`.

#### Scenario: Identity snapshot has all structural fields

- **WHEN** `identity_snapshot` é populado
- **THEN** contém `storeName`, `storeSegment`, `brandColor`, `identityState`, `signature`, e `storeInitials`

### Requirement: Render snapshot shape v1

O sistema SHALL definir o shape mínimo de `render_snapshot` com campos: `format: "jpeg"`, `width: 1080`, `height: 1080`, `aspectRatio: "1:1"`, `mimeType: "image/jpeg"`, `quality: 90`, `colorSpace: "srgb"`.

#### Scenario: Render snapshot has canonical JPEG format

- **WHEN** `render_snapshot` é populado
- **THEN** contém `format: "jpeg"`, `width: 1080`, `height: 1080`, `mimeType: "image/jpeg"`, `quality: 90`, `colorSpace: "srgb"`

### Requirement: Publication copy snapshot shape v1

> Updated by `fase-14-integracao-fluxo-geracao` — shape realinhado para o kit de publicação da milestone v1.3.
> Updated by `fase-23-text-provider-copy-director` — `title` readicionado como opcional.

O sistema SHALL definir o shape de `publication_copy_snapshot` com campos: `title? (string, opcional)`, `caption (string)`, `hashtags (string[])`, `cta_post (string)`.

O campo `title` é ADICIONADO como opcional. Campanhas existentes (v1.3/v1.4) têm snapshot sem `title` e continuam funcionando sem quebras. A UI trata `title` como opcional.

Isso NÃO requer migração de banco. `publication_copy_snapshot` é JSONB — adicionar `title` no JSON é compatível retroativo.

#### Scenario: Publication copy snapshot accepts title

- **WHEN** `publication_copy_snapshot` é populado após a F23
- **THEN** contém `caption`, `hashtags` (array de strings), `cta_post`, e opcionalmente `title`
- **AND** snapshots sem `title` (v1.3/v1.4) continuam válidos

#### Scenario: Publication copy snapshot without title is valid

- **WHEN** um snapshot existente (pré-F23) é lido
- **THEN** `title` é `undefined` e não causa erro de tipo

### Requirement: CampaignReadyData remains compatible

O sistema SHALL manter `CampaignReadyData` com `publicationCopySnapshot: Record<string, unknown>`. A mudança no shape de `PublicationCopySnapshot` NÃO SHALL quebrar o contrato de `CampaignReadyData`, pois os snapshots usam `Record<string, unknown>` na interface geral. A interface específica `PublicationCopySnapshot` serve como guia de tipo para o builder (`buildPublicationCopySnapshot`) e para consumo futuro.

#### Scenario: CampaignReadyData ignores concrete shape

- **WHEN** `updateCampaignReady` é chamado com `publicationCopySnapshot` no novo shape
- **THEN** `CampaignReadyData` aceita o objeto sem erro de tipo
- **AND** a interface `PublicationCopySnapshot` atualizada não afeta o contrato de `CampaignReadyData`

### Requirement: Generation metadata shape v1

O sistema SHALL definir o shape mínimo de `generation_metadata` com campos: `provider (string)`, `model (string)`, `durationMs (number)`, `generatedAt (string)`, `corrections? (record of { from: string; to: string; reason: string })`.

#### Scenario: Generation metadata has provider and model

- **WHEN** `generation_metadata` é populado
- **THEN** contém `provider`, `model`, `durationMs`, e `generatedAt`
