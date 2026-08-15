# Campaign Types

> Delta spec for `fase-41-midia-de-campanha-mobile` (D5).

## MODIFIED Requirements

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
