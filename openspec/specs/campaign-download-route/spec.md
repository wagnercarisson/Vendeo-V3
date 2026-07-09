# Campaign Download Route

> Synced from `fase-13-servico-persistencia-download` (ADDED).

## Purpose

Rota `GET /api/campaign/[id]/download` que gera signed URL temporária e redireciona o owner para download da campanha.

## Requirements

### Requirement: GET /api/campaign/[id]/download com signed URL

O sistema SHALL criar `GET /api/campaign/[id]/download` seguindo o pipeline:
- Chama `requireApiUser()` para validar sessão — se sem sessão: 401
- Valida `[id]` como UUID v4 — se malformado: 400
- Chama `getCampaign(id)` via `supabaseAdmin`
- Se campanha não existe: 404
- Chama `requireOwnership(campaign.store_id, user.userId)` — se não pertence: 404 (mesmo status que inexistente)
- Gera signed URL via `supabaseAdmin.storage.from('campaign-images').createSignedUrl(storage_path, 3600)`
- Redireciona 302 para a signed URL gerada

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

#### Scenario: Owner acessando retorna 302

- **WHEN** owner autenticado acessa `GET /api/campaign/[id]/download`
- **THEN** retorna 302 com signed URL no header `Location`

#### Scenario: createSignedUrl falha retorna 502

- **WHEN** `createSignedUrl` falha durante o fluxo de download
- **THEN** retorna 502
