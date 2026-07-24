# Campaign Types

> Synced from `fase-13-servico-persistencia-download` (ADDED), `fase-17-edicao-publication-copy` (MODIFIED), `fase-23-text-provider-copy-director` (MODIFIED), and `fase-31-1-modelo-comercial-formulario` (MODIFIED).

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

#### Scenario: CreateCampaignInput has required fields

- **WHEN** `createCampaign` é chamado
- **THEN** aceita `productName`, `inputSnapshot` e opcionalmente `identitySnapshot`

### Requirement: CampaignReadyData interface

O sistema SHALL definir `CampaignReadyData` com `generationMetadata (Record<string, unknown>)`, `renderSnapshot (Record<string, unknown>)`, e `publicationCopySnapshot (Record<string, unknown>)`.

#### Scenario: CampaignReadyData has all three snapshots

- **WHEN** `updateCampaignReady` é chamado
- **THEN** aceita `generationMetadata`, `renderSnapshot`, e `publicationCopySnapshot`

### Requirement: Input snapshot shape v1

O sistema SHALL definir o shape mínimo de `input_snapshot` com campos: `productName`, `originalPriceCents?`, `discountedPriceCents`, `badgeText?`, `hook?`, `cta?`, `description?`, `objective?`, `campaignDetails?`, `additionalDetails?`, `targetChannel?`, `format?`, `validity?`, `availabilityNotes?`, `sensitiveConstraints?`, `inputValidationOverride?`, `campaignIntent?`, `preserveImageContext?`, `productImage: { provided: true; mimeType: string }`.

Os campos `campaignIntent?: "offer" | "spotlight" | "exclusive"` e `preserveImageContext?: boolean` são ADICIONADOS como opcionais.

Quando `campaignIntent === "offer"`, `preserveImageContext` SHALL ser normalizado para `false` (ou omitido).

#### Scenario: Input snapshot has product image metadata

- **WHEN** `input_snapshot` é populado
- **THEN** o campo `productImage` contém `{ provided: true, mimeType: string }` sem data URL bruta

#### Scenario: Input snapshot aceita campaignIntent e preserveImageContext

- **WHEN** `input_snapshot` é populado com `campaignIntent` e `preserveImageContext`
- **THEN** ambos campos estão presentes com tipos corretos

#### Scenario: preserveImageContext normalizado para false em offer

- **WHEN** `campaignIntent === "offer"` e `preserveImageContext === true`
- **THEN** no `inputSnapshot` o valor de `preserveImageContext` é `false` ou omitido

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
