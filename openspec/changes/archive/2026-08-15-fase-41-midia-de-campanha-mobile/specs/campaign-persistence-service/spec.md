# Campaign Persistence Service

> Delta spec for `fase-41-midia-de-campanha-mobile` (D5).

## MODIFIED Requirements

### Requirement: createCampaign inserts generating record

O sistema SHALL exportar `createCampaign(storeId: string, input: CreateCampaignInput, campaignId?: string)` que:
- **Aceita `campaignId` pré-gerado** (parâmetro opcional — D5); quando ausente, gera UUID v4 internamente (comportamento atual preservado)
- Pré-computa `storage_path` como `{storeId}/{campaignId}.jpg` (inalterado)
- Insere registro em `campaigns` com `status = 'generating'`
- Popula `product_name`, `input_snapshot`, `identity_snapshot`
- Usa `supabaseAdmin` para INSERT (service_role)
- Retorna `{ id: string; storagePath: string }`

> F41 D5: a assinatura ganha o parâmetro opcional `campaignId` porque a rota precisa **pré-gerar** o `campaignId` para fazer o upload dos inputs **antes** de montar o snapshot (`storagePath` dos inputs vive dentro do snapshot). Sem o id pré-gerado, o path de inputs `{storeId}/{campaignId}/inputs/...` seria inviável.

#### Scenario: createCampaign aceita campaignId pré-gerado (D5)

- **WHEN** `createCampaign(storeId, input, "pre-gerado-uuid")` é chamado
- **THEN** o registro é inserido com `id = "pre-gerado-uuid"`
- **AND** `storage_path` é `{storeId}/pre-gerado-uuid.jpg`

#### Scenario: createCampaign sem campaignId gera internamente (regressão)

- **WHEN** `createCampaign(storeId, input)` é chamado sem o parâmetro
- **THEN** um UUID v4 é gerado internamente (comportamento atual preservado — regressão)

#### Scenario: createCampaign returns id and storage_path

- **WHEN** `createCampaign(storeId, input)` é chamado
- **THEN** retorna `{ id, storagePath }` onde `storagePath` é `{storeId}/{id}.jpg`

#### Scenario: createCampaign inserts with status generating

- **WHEN** `createCampaign` é chamado
- **THEN** o registro é inserido em `campaigns` com `status = 'generating'`

## ADDED Requirements

### Requirement: uploadCampaignInputImage persiste um input

O sistema SHALL exportar `uploadCampaignInputImage(storeId: string, campaignId: string, imageId: string, image: { buffer: Buffer; mimeType: string })` que (D5):

- **Transcoda para JPEG** com `sharp` (reuso do `image-processor.ts` — `transcodeToJpeg`)
- Faz upload no bucket `campaign-images` no path **`{storeId}/{campaignId}/inputs/{imageId}.jpg`**
- Usa `contentType: "image/jpeg"` e `upsert: false` (imutabilidade do bucket preservada)
- Usa `supabaseAdmin` (service_role — policies existentes de INSERT/DELETE cobrem o subpath de inputs, owner select por prefixo `storeId` preservado)
- Retorna `{ storagePath: string }`

O `imageId` é **gerado pela rota** (D2 — o cliente não envia `id`); o mesmo `imageId` alimenta o path `{imageId}` e o snapshot.

#### Scenario: uploadCampaignInputImage usa path de inputs

- **WHEN** `uploadCampaignInputImage(storeId, campaignId, "img-1", { buffer, mimeType: "image/png" })` é chamado
- **THEN** o objeto é gravado em `campaign-images` no path `{storeId}/{campaignId}/inputs/img-1.jpg` (transcodado para JPEG)
- **AND** `contentType` é `image/jpeg` e `upsert` é `false`

#### Scenario: uploadCampaignInputImage retorna storagePath

- **WHEN** o upload é bem-sucedido
- **THEN** retorna `{ storagePath: "{storeId}/{campaignId}/inputs/{imageId}.jpg" }`
- **AND** a rota usa esse `storagePath` no snapshot (D5)

### Requirement: removeCampaignInputs limpa inputs em falha pré-stream

O sistema SHALL exportar `removeCampaignInputs(storeId: string, campaignId: string): Promise<void>` que remove os objetos do input já enviados em `{storeId}/{campaignId}/inputs/` — compensação para falha no fluxo **pré-stream** (D5), evitando inputs órfãos no storage.

- Usa `supabaseAdmin.storage.from("campaign-images").remove(...)` (service_role).
- Lista os objetos do prefixo `{storeId}/{campaignId}/inputs/` e remove todos; se não houver objetos, é no-op.
- Falha pós-stream continua usando o fluxo de compensação atual (`deleteCampaignImage(storagePath)`).

#### Scenario: remoção em falha pré-stream

- **WHEN** o upload de inputs falha no meio (ou o fluxo pré-stream falha após alguns uploads)
- **THEN** `removeCampaignInputs(storeId, campaignId)` remove os objetos de `{storeId}/{campaignId}/inputs/` já enviados
- **AND** nenhum input órfão permanece no storage

#### Scenario: removeCampaignInputs é no-op sem objetos

- **WHEN** não há objetos no prefixo de inputs
- **THEN** a chamada não gera erro (no-op)

#### Scenario: deleteCampaignImage permanece para falha pós-stream

- **WHEN** a falha ocorre **após** o stream iniciado (arte final)
- **THEN** o fluxo de compensação atual (`deleteCampaignImage(storagePath)`) é mantido
