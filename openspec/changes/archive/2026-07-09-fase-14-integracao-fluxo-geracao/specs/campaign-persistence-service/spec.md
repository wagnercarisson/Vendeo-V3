# Campaign Persistence Service

> Part of `fase-14-integracao-fluxo-geracao` (MODIFIED).

## Purpose

Helpers de escrita e leitura sobre a tabela `campaigns` e bucket `campaign-images`. Na F14, o serviço ganha novos requisitos de orquestração no `generate-image/route.ts`, e passa a ser consumido como pipeline sequencial (INSERT → IA → transcode → upload → updateReady). Nenhum helper individual é modificado — a mudança está na orquestração.

## MODIFIED Requirements

### Requirement: Orchestration pipeline in generate-image (ADDED)

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

### Requirement: Input validation before INSERT (MODIFIED)

O sistema SHALL manter a validação de input (`InputValidationService`) e detecção de conflito ANTES do `createCampaign`. O INSERT `generating` SHALL ocorrer apenas após validação bem-sucedida. Validação falha SHALL retornar 400/409 sem criar registro.

#### Scenario: Validation failure prevents INSERT

- **WHEN** `InputValidationService` retorna erro de validação ou conflito
- **THEN** NENHUM registro é inserido na tabela `campaigns`
- **AND** a resposta é 400 (validação) ou 409 (conflito)