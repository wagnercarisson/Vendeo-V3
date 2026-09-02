# Publication Copy Route

## Purpose

A fatia 37.1 insere o **gate de aprovação** na rota `PATCH /api/campaign/[id]/publication-copy` (decisão 4): enquanto a campanha está `pending`/`regenerating` com a flag `campaign_approval_enabled` ligada → **403** (nada é persistido); `not_enabled`/`legacy`/`approved` → comportamento atual (edição normal e restore preservados).

## MODIFIED Requirements

### Requirement: PATCH route handler

O sistema SHALL prover um route handler `PATCH` em `src/app/api/campaign/[id]/publication-copy/route.ts` que permite ao owner da campanha editar o publication copy.

O handler SHALL seguir o fluxo:
- `requireSameOrigin(request)` — CSRF, primeiro guard antes de auth
- `requireApiUser()` — garante usuário autenticado
- Validar que `id` é um UUID v4 antes de consultar o banco — se inválido, retornar 404
- Buscar campanha por `id` via `getCampaign` (persistence.ts)
- Se não existir → 404
- `requireOwnership(campaign.store_id, user.userId)` → se falhar → 404
- **Gate de aprovação (F37 37.1, decisão 4):** lê `isCampaignApprovalEnabled()` + `listArtVersions(campaign.id)` e deriva `computeApprovalState`; se `isDeliveryReleased(state) === false` (i.e., `pending`/`regenerating` com a flag ligada) → **403** (nada é persistido); `not_enabled`/`legacy`/`approved` → liberado
- Validar body via `validatePublicationCopy(body)`
- Se inválido → 400 `{ error: "Validation failed", issues: [...] }`
- Se `restore: true`: `update({ publication_copy_current: null })` → 200 `{ restored: true, publication_copy_snapshot }`
- Se dados normais: `update({ publication_copy_current: { caption, hashtags, cta_post } })` → 200 `{ publication_copy_current: {...} }`

#### Scenario: PATCH com body válido atualiza publication_copy_current

- **WHEN** um owner faz PATCH com `{ caption, hashtags, cta_post }` válido para uma campanha `not_enabled`/`legacy`/`approved`
- **THEN** retorna 200 com `{ publication_copy_current: { caption, hashtags, cta_post } }`
- **AND** o banco tem `publication_copy_current` atualizado

#### Scenario: PATCH pendente com flag ligada retorna 403

- **WHEN** um owner faz PATCH de copy para uma campanha `pending` (ou `regenerating`) sob a flag `campaign_approval_enabled`
- **THEN** retorna 403
- **AND** nada é persistido em `publication_copy_current`

#### Scenario: PATCH com body inválido retorna 400

- **WHEN** um owner faz PATCH com body que falha validação (campanha liberada)
- **THEN** retorna 400 com `{ error: "Validation failed", issues: [...] }`

#### Scenario: PATCH com UUID inválido retorna 404

- **WHEN** o PATCH é chamado com um ID que não é UUID v4
- **THEN** retorna 404 sem consultar o banco

#### Scenario: PATCH para campanha inexistente retorna 404

- **WHEN** o PATCH é chamado com ID de campanha que não existe
- **THEN** retorna 404

#### Scenario: PATCH para campanha de outro tenant retorna 404

- **WHEN** o PATCH é chamado com ID de campanha de outro tenant
- **THEN** retorna 404 (ownership verificado)

#### Scenario: PATCH com restore: true limpa current e retorna snapshot

- **WHEN** um owner faz PATCH com `{ restore: true }` para uma campanha liberada
- **THEN** retorna 200 com `{ restored: true, publication_copy_snapshot: { caption, hashtags, cta_post } }`
- **AND** o banco tem `publication_copy_current = null`

#### Scenario: PATCH sem autenticação retorna erro

- **WHEN** um usuário não autenticado faz PATCH
- **THEN** retorna erro de autenticação

#### Scenario: PATCH com CSRF inválido retorna erro

- **WHEN** uma requisição de origem externa faz PATCH
- **THEN** retorna erro de CSRF
