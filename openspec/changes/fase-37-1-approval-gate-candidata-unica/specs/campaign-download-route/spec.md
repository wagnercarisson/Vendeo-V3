# Campaign Download Route

## Purpose

A fatia 37.1 insere o **gate de aprovação** na rota `GET /api/campaign/[id]/download` (D2): antes de servir a imagem, a rota verifica o estado de aprovação — `pending`/`regenerating` com a flag `campaign_approval_enabled` ligada → **403**; `not_enabled`/`legacy`/`approved` → liberado como hoje (serve `campaign.storage_path`).

## MODIFIED Requirements

### Requirement: GET /api/campaign/[id]/download com signed URL

O sistema SHALL criar `GET /api/campaign/[id]/download` seguindo o pipeline:
- Chama `requireApiUser()` para validar sessão — se sem sessão: 401
- Valida `[id]` como UUID v4 — se malformado: 400
- Chama `getCampaign(id)` via `supabaseAdmin`
- Se campanha não existe: 404
- Chama `requireOwnership(campaign.store_id, user.userId)` — se não pertence: 404 (mesmo status que inexistente)
- **Gate de aprovação (F37 37.1, D2):** lê `isCampaignApprovalEnabled()` + `listArtVersions(campaign.id)` e deriva `computeApprovalState`; se `isDeliveryReleased(state) === false` (i.e., `pending`/`regenerating` com a flag ligada) → **403**; `not_enabled`/`legacy`/`approved` → liberado
- Serve o arquivo de `campaign.storage_path` (para `approved`, repontado para a aprovada no approve; para `legacy`/`not_enabled`, como hoje)

#### Scenario: Sem sessão retorna 401

- **WHEN** `GET /api/campaign/[id]/download` é chamado sem session
- **THEN** retorna 401

#### Scenario: UUID malformado retorna 400

- **WHEN** `GET /api/campaign/[id]/download` é chamado com `[id]` não-UUID
- **THEN** retorna 400

#### Scenario: Campanha inexistente retorna 404

- **WHEN** `GET /api/campaign/[id]/download` é chamado com ID de campanha que não existe
- **THEN** retorna 404

#### Scenario: Campanha de outra loja retorna 404

- **WHEN** `GET /api/campaign/[id]/download` é chamado para campanha de outro tenant
- **THEN** retorna 404 (mesmo status que inexistente)

#### Scenario: Download pendente com flag ligada retorna 403

- **WHEN** uma campanha `pending` sob a flag `campaign_approval_enabled` tenta o download
- **THEN** retorna 403 (entrega não liberada)

#### Scenario: Owner acessando campanha liberada retorna a imagem

- **WHEN** owner autenticado acessa o download de uma campanha `not_enabled`/`legacy`/`approved`
- **THEN** retorna 200 com a imagem de `campaign.storage_path`

#### Scenario: createSignedUrl falha retorna 502

- **WHEN** o download de uma campanha liberada falha ao baixar o arquivo
- **THEN** retorna 502
