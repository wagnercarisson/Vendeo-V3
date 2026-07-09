# Campaign Persistence Service

> Synced from `fase-13-servico-persistencia-download` (ADDED).
> Updated by `fase-14-integracao-fluxo-geracao` — added orchestration pipeline and input validation requirements.

## Purpose

Helpers de escrita e leitura sobre a tabela `campaigns` e bucket `campaign-images`, projetados como operações atômicas independentes para serem orquestradas pela Fase 14.

## Requirements

### Requirement: createCampaign inserts generating record

O sistema SHALL exportar `createCampaign(storeId: string, input: CreateCampaignInput)` que:
- Gera UUID v4 para o ID da campanha
- Pré-computa `storage_path` como `{storeId}/{campaignId}.jpg`
- Insere registro em `campaigns` com `status = 'generating'`
- Popula `product_name`, `input_snapshot`, `identity_snapshot`
- Usa `supabaseAdmin` para INSERT (service_role)
- Retorna `{ id: string; storagePath: string }`

#### Scenario: createCampaign returns id and storage_path

- **WHEN** `createCampaign(storeId, input)` é chamado
- **THEN** retorna `{ id, storagePath }` onde `storagePath` é `{storeId}/{id}.jpg`

#### Scenario: createCampaign inserts with status generating

- **WHEN** `createCampaign` é chamado
- **THEN** o registro é inserido em `campaigns` com `status = 'generating'`

#### Scenario: createCampaign rejeita storeId inválido

- **WHEN** `createCampaign` é chamado com `storeId` malformado
- **THEN** a operação falha (exceção ou retorno de erro)

### Requirement: dataUrlToCampaignImage validates and extracts

O sistema SHALL exportar `dataUrlToCampaignImage(dataUrl: string)` que:
- Aceita data URLs com MIME `image/png`, `image/jpeg`, `image/webp`
- Extrai e retorna `{ buffer: Buffer; mimeType: string }` sem transcodificação
- Rejeita MIME não suportado com erro
- Rejeita data URL malformada com erro
- Rejeita payload vazio com erro

#### Scenario: dataUrlToCampaignImage aceita image/jpeg

- **WHEN** data URL com MIME `image/jpeg` é fornecida
- **THEN** retorna `{ buffer, mimeType: "image/jpeg" }`

#### Scenario: dataUrlToCampaignImage aceita image/png

- **WHEN** data URL com MIME `image/png` é fornecida
- **THEN** retorna `{ buffer, mimeType: "image/png" }`

#### Scenario: dataUrlToCampaignImage aceita image/webp

- **WHEN** data URL com MIME `image/webp` é fornecida
- **THEN** retorna `{ buffer, mimeType: "image/webp" }`

#### Scenario: dataUrlToCampaignImage rejeita MIME não suportado

- **WHEN** data URL com MIME diferente de PNG/JPEG/WEBP é fornecida
- **THEN** rejeita com erro indicando MIME não suportado

#### Scenario: dataUrlToCampaignImage rejeita string vazia

- **WHEN** data URL vazia é fornecida
- **THEN** rejeita com erro indicando payload vazio

#### Scenario: dataUrlToCampaignImage rejeita data URL malformada

- **WHEN** string que não é uma data URL válida é fornecida
- **THEN** rejeita com erro indicando formato inválido

### Requirement: uploadCampaignImage uploads to Storage

O sistema SHALL exportar `uploadCampaignImage(storeId: string, campaignId: string, image: { buffer: Buffer; mimeType: "image/jpeg" })` que:
- Faz upload para bucket `campaign-images` no path `{storeId}/{campaignId}.jpg`
- Usa `contentType: "image/jpeg"`
- Usa `upsert: false`
- Rejeita `mimeType` diferente de `"image/jpeg"`
- Retorna `{ storagePath: string }`

#### Scenario: uploadCampaignImage usa bucket correto

- **WHEN** `uploadCampaignImage` é chamado
- **THEN** o upload é feito no bucket `campaign-images`

#### Scenario: uploadCampaignImage usa path canônico .jpg

- **WHEN** `uploadCampaignImage` é chamado com storeId e campaignId
- **THEN** o path é `{storeId}/{campaignId}.jpg`

#### Scenario: uploadCampaignImage usa upsert false

- **WHEN** `uploadCampaignImage` é chamado
- **THEN** `upsert` é `false`

#### Scenario: uploadCampaignImage usa contentType image/jpeg

- **WHEN** `uploadCampaignImage` é chamado
- **THEN** `contentType` é `image/jpeg`

#### Scenario: uploadCampaignImage rejeita MIME não JPEG

- **WHEN** `uploadCampaignImage` é chamado com `mimeType` diferente de `"image/jpeg"`
- **THEN** rejeita com erro

### Requirement: updateCampaignReady sets status ready

O sistema SHALL exportar `updateCampaignReady(campaignId: string, data: CampaignReadyData)` que:
- Atualiza `status = 'ready'`
- Popula `generation_metadata`, `render_snapshot`, `publication_copy_snapshot`
- Seta `error_message = null`
- Usa `supabaseAdmin` para UPDATE (service_role)

#### Scenario: updateCampaignReady seta status ready

- **WHEN** `updateCampaignReady` é chamado
- **THEN** a campanha tem `status = 'ready'`

#### Scenario: updateCampaignReady persiste snapshots

- **WHEN** `updateCampaignReady` é chamado com dados
- **THEN** `generation_metadata`, `render_snapshot`, e `publication_copy_snapshot` são persistidos

#### Scenario: updateCampaignReady limpa error_message

- **WHEN** `updateCampaignReady` é chamado
- **THEN** `error_message` é `null`

### Requirement: updateCampaignError sets status error

O sistema SHALL exportar `updateCampaignError(campaignId: string, errorMessage: string)` que:
- Atualiza `status = 'error'`
- Seta `error_message` com a mensagem fornecida
- Rejeita `errorMessage` vazia (null, undefined, ou string vazia após trim)
- Usa `supabaseAdmin` para UPDATE (service_role)

#### Scenario: updateCampaignError seta status error

- **WHEN** `updateCampaignError` é chamado com mensagem válida
- **THEN** a campanha tem `status = 'error'` e `error_message` preenchido

#### Scenario: updateCampaignError rejeita mensagem vazia

- **WHEN** `updateCampaignError` é chamado com mensagem vazia
- **THEN** rejeita com erro

### Requirement: getCampaign returns record or null

O sistema SHALL exportar `getCampaign(id: string)` que:
- Busca campanha por ID via `supabaseAdmin`
- Retorna `CampaignRecord | null`
- Assume ID validado pela rota (não valida UUID internamente)
- Propaga erro do Supabase como exceção em caso de falha inesperada

#### Scenario: getCampaign retorna record quando existe

- **WHEN** `getCampaign` é chamado com ID existente
- **THEN** retorna `CampaignRecord`

#### Scenario: getCampaign retorna null quando não existe

- **WHEN** `getCampaign` é chamado com ID inexistente
- **THEN** retorna `null`

### Requirement: deleteCampaignImage remove do Storage

O sistema SHALL exportar `deleteCampaignImage(storagePath: string)` como helper secundário que:
- Remove objeto do bucket `campaign-images`
- Usa `supabaseAdmin` para DELETE (service_role)
- Não faz parte do contrato principal de persistência — existe para compensação em falha parcial (F14) e cleanup futuro

#### Scenario: deleteCampaignImage remove objeto

- **WHEN** `deleteCampaignImage(storagePath)` é chamado
- **THEN** o objeto é removido do bucket `campaign-images`

### Requirement: Orchestration pipeline in generate-image

> Added by `fase-14-integracao-fluxo-geracao`.

O sistema SHALL modificar `src/app/api/campaign/generate-image/route.ts` para executar o seguinte pipeline:

1. Após auth/ownership/identidade/validação de conflito, ANTES da geração IA:
   - Chamar `createCampaign(storeId, { productName, inputSnapshot, identitySnapshot })` para INSERT com `status = 'generating'`
   - Capturar `{ id: campaignId, storagePath }` do resultado

2. Na geração IA bem-sucedida:
   - Chamar `dataUrlToCampaignImage(result.imageDataUrl)` para extrair buffer
   - Chamar `transcodeToJpeg(buffer, mimeType)` para converter a JPEG sRGB q90 1080×1080
   - Chamar `uploadCampaignImage(storeId, campaignId, { buffer: jpegBuffer, mimeType: "image/jpeg" })`
   - Montar `generationMetadata` no handler usando `provider.name` da mesma instância do provider criada para `ImageGenerationService`, `IMAGE_GENERATION_RESPONSES_MODEL`, `performance.now() - start`, `new Date().toISOString()`, `result.inputCorrections`
   - Chamar `updateCampaignReady(campaignId, { generationMetadata, renderSnapshot, publicationCopySnapshot })`

3. No NDJSON de resultado:
   - Emitir `{ type: "result", campaignId, campaignUrl }` onde `campaignUrl` é `/campanha/${campaignId}`

4. Em caso de erro (IA, transcode, upload, updateReady):
   - Se `campaignId` existe (INSERT já ocorreu): chamar `updateCampaignError(campaignId, errorMessage)`
   - Se o upload foi bem-sucedido mas `updateReady` falhou: chamar `deleteCampaignImage(storagePath)` antes de `updateCampaignError`
   - Emitir NDJSON `{ type: "error", phase, code, message, httpStatus, retryable }` — mesmo shape usado pela rota atualmente, acrescentando `campaignId` quando já existir registro

5. Adicionar `export const runtime = "nodejs"` no topo do arquivo

#### Scenario: Fluxo completo de sucesso

- **WHEN** a geração IA é bem-sucedida, transcode, upload e updateReady funcionam
- **THEN** o NDJSON final emite `{ type: "result", campaignId, campaignUrl }`

#### Scenario: Erro na IA após INSERT

- **WHEN** a geração IA falha após o INSERT `generating`
- **THEN** NDJSON emite `{ type: "error", campaignId, phase, code, message, httpStatus, retryable }` — preserva o httpStatus e retryable derivados do erro existente na rota
- **AND** `updateCampaignError` é chamado com a mensagem de erro

#### Scenario: Erro no upload após INSERT e IA

- **WHEN** o upload ao Storage falha
- **THEN** `updateCampaignError` é chamado (sem deleteCampaignImage — não há imagem no Storage)
- **AND** NDJSON emite `{ type: "error", campaignId, phase: "upload", message, httpStatus, retryable }` — preserva semântica do erro existente

#### Scenario: Erro no updateReady após upload OK

- **WHEN** `updateCampaignReady` falha após upload bem-sucedido
- **THEN** `deleteCampaignImage(storagePath)` + `updateCampaignError` são executados
- **AND** NDJSON emite `{ type: "error", campaignId, phase: "update", message, httpStatus, retryable }` — preserva semântica do erro existente

#### Scenario: Runtime Node.js explícito

- **WHEN** a rota generate-image é carregada
- **THEN** `export const runtime = "nodejs"` está declarado

### Requirement: Input validation before INSERT

> Added by `fase-14-integracao-fluxo-geracao`.

O sistema SHALL manter a validação de input (`InputValidationService`) e detecção de conflito ANTES do `createCampaign`. O INSERT `generating` SHALL ocorrer apenas após validação bem-sucedida. Validação falha SHALL retornar 400/409 sem criar registro.

#### Scenario: Validation failure prevents INSERT

- **WHEN** `InputValidationService` retorna erro de validação ou conflito
- **THEN** NENHUM registro é inserido na tabela `campaigns`
- **AND** a resposta é 400 (validação) ou 409 (conflito)
