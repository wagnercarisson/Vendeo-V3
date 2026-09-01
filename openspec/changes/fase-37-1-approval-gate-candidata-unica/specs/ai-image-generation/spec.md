# AI Image Generation

## Purpose

A fatia 37.1 faz uma **mudança mínima** no pipeline de geração (D8/D10): quando a flag `campaign_approval_enabled` está ligada, o `POST /api/campaign/generate-image` passa a **também** inserir a **v1** em `campaign_art_versions` (candidata `pending`, `asset_status='active'`, `brief_snapshot` = snapshot `campaign_brief_v1` persistido). Flag off → comportamento atual inalterado. **Nenhuma persistência nova de produto fonte** (F41 já sobe os inputs — decisão 2); nenhuma mudança em providers/prompts/`ImageGenerationService`.

## ADDED Requirements

### Requirement: generate-image insere a v1 em campaign_art_versions quando a flag está ligada

O sistema SHALL, no `POST /api/campaign/generate-image`, inserir a versão 1 em `campaign_art_versions` quando a flag `campaign_approval_enabled` está ligada (D8/D10):

- Após o sucesso de `createCampaign` (`route.ts` pré-stream), ler `isCampaignApprovalEnabled()`; se `true`, chamar `createArtVersion(campaign.id, 1, campaign.storagePath, inputSnapshot)`.
- `inputSnapshot` é **exatamente o objeto `campaign_brief_v1`** persistido em `campaigns.input_snapshot` (`buildCampaignBriefSnapshot(brief)`) — sem base64 por construção (F39).
- A linha nasce `status='pending'`, `asset_status='active'` (candidata); `storage_path` = path da geração inicial (`{storeId}/{campaignId}.jpg`); `render_snapshot`/`generation_metadata`/`rejection_reason` ficam NULL na 37.1.
- **Flag off** → nenhuma inserção (comportamento atual preservado).
- **Falha do insert da v1 → log de erro operacional e continua a geração** (fail-safe): a campanha nasce sem versões e é exibida como `legacy` (a flag nunca derruba o fluxo atual — D1).
- **Sem persistência nova de produto fonte** (decisão 2 — F41 já persiste os inputs; `persistProductSourceImage`/`getProductSourceImage` não existem nesta fase).

#### Scenario: Flag ligada insere a v1 candidata

- **WHEN** o `POST /api/campaign/generate-image` roda com a flag `campaign_approval_enabled` ligada
- **THEN** além de `campaigns`, uma linha em `campaign_art_versions` é criada com `version_number=1`, `status='pending'`, `asset_status='active'`, `storage_path` e `brief_snapshot` iguais aos da geração

#### Scenario: Flag desligada não insere (comportamento atual)

- **WHEN** o `POST /api/campaign/generate-image` roda com a flag desligada
- **THEN** nenhuma linha é criada em `campaign_art_versions`
- **AND** o fluxo de geração/entrega atual é exatamente o mesmo

#### Scenario: Falha no insert da v1 não derruba a geração

- **WHEN** o insert da v1 falha com a flag ligada
- **THEN** a geração continua normalmente (log de erro operacional)
- **AND** a campanha fica sem linhas de versão (exibida como `legacy`, entregue)
