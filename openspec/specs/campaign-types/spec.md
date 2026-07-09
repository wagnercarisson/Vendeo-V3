# Campaign Types

> Synced from `fase-13-servico-persistencia-download` (ADDED).

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
`id (string)`, `store_id (string)`, `status (CampaignStatus)`, `product_name (string)`, `input_snapshot (Record<string, unknown>)`, `identity_snapshot (Record<string, unknown> | null)`, `generation_metadata (Record<string, unknown> | null)`, `render_snapshot (Record<string, unknown> | null)`, `publication_copy_snapshot (Record<string, unknown> | null)`, `storage_path (string)`, `error_message (string | null)`, `created_at (string)`, `updated_at (string)`.

#### Scenario: CampaignRecord has all required fields

- **WHEN** `CampaignRecord` é instanciado
- **THEN** todos os campos da tabela `public.campaigns` estão presentes com os tipos corretos

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

O sistema SHALL definir o shape mínimo de `input_snapshot` com campos: `productName`, `originalPriceCents?`, `discountedPriceCents`, `badgeText?`, `hook?`, `cta?`, `description?`, `objective?`, `campaignDetails?`, `additionalDetails?`, `targetChannel?`, `format?`, `validity?`, `availabilityNotes?`, `sensitiveConstraints?`, `inputValidationOverride?`, `productImage: { provided: true; mimeType: string }`.

#### Scenario: Input snapshot has product image metadata

- **WHEN** `input_snapshot` é populado
- **THEN** o campo `productImage` contém `{ provided: true, mimeType: string }` sem data URL bruta

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

O sistema SHALL definir o shape mínimo de `publication_copy_snapshot` com campos: `title (string)`, `subtitle? (string)`, `hook (string)`, `cta (string)`, `badgeText (string)`, `priceDisplay (string)`.

#### Scenario: Publication copy snapshot has all required fields

- **WHEN** `publication_copy_snapshot` é populado
- **THEN** contém `title`, `hook`, `cta`, `badgeText`, e `priceDisplay`

### Requirement: Generation metadata shape v1

O sistema SHALL definir o shape mínimo de `generation_metadata` com campos: `provider (string)`, `model (string)`, `durationMs (number)`, `generatedAt (string)`, `corrections? (record of { from: string; to: string; reason: string })`.

#### Scenario: Generation metadata has provider and model

- **WHEN** `generation_metadata` é populado
- **THEN** contém `provider`, `model`, `durationMs`, e `generatedAt`
