## MODIFIED Requirements

### Requirement: Brand profile lifecycle

Profiles SHALL follow this lifecycle:

1. Created directly with status `synced` when analysis completes successfully (V1)
2. Created directly with status `failed` when analysis fails (V1)
3. Previous `synced` profile becomes `outdated` ONLY when a NEW profile is created with status `synced` — if the new profile insert fails, the compensation SHALL restore the previous profile to `synced`. The previous profile SHALL NOT remain outdated without a replacement
4. Profile remains `synced` when logo is soft-deleted — only the assets are archived. The `active_logo_asset_id` FK is preserved for provenance. The store's `identity_state` is synced to `'text_only'`
5. Profile `synced` after logo remove is the SAME profile — not a new one. Its `active_logo_asset_id` continues pointing to the original asset that generated it (provenance preserved)

If a new logo is uploaded for a store that previously had a brand profile with source `without_logo`, and the new profile is created with status `synced`, the without_logo profile SHALL be marked `outdated`.

For `source = 'text_only'` profiles, the lifecycle rules apply equally:
- A new text_only inference marks the previous synced text_only profile as `outdated`
- Text_only profiles created as `failed` do NOT mark previous synced profiles as outdated
- Profile reactivation (when user transitions back to text_only from logo or visual_signature) is NOT implemented in this phase — profiles are only created and marked outdated, never reactivated

**Atualidade por origem, ativo e contexto (F47.2):** a atualidade SHALL ser
derivada, não presumida pelo primeiro registro nem apenas pelo vínculo com a
assinatura. As três origens de identidade (`logo_analysis`, `without_logo`,
`text_only`) SHALL possuir regras próprias e um perfil válido quando forem a
identidade ativa.

O contexto SHALL incluir a **identidade do ativo**:

- `without_logo`: `visual_signature_id` da assinatura ativa;
- `logo_analysis`: `active_logo_asset_id` do asset que originou o perfil;
- `text_only`: ausente (`null`).

O `context_hash` SHALL combinar origem + identidade do ativo + os 7 campos de
`input_snapshot`. Dados textuais idênticos com ativo diferente SHALL produzir
contexto diferente.

O perfil SHALL ser classificado como:

- **atual (`current`):** último `synced` cuja origem e identidade do ativo
  correspondem à identidade ativa, cujo `context_hash` coincide com o contexto
  atual e que não tenha tentativa de falha mais recente para o mesmo contexto;
- **anterior (`previous`):** `synced`/`outdated` preservado de outra origem,
  outro ativo ou contexto anterior;
- **falha (`failed`):** tentativa mais recente, com contexto igual ou posterior ao
  último sucesso, que não produziu `synced` correspondente; registra origem,
  identidade do ativo e `context_hash`.

**Fallback após remoção do logo (preservado):** ao remover o logo, o perfil
`logo_analysis` SHALL permanecer `synced`, mantendo `active_logo_asset_id` como
proveniência. Ele SHALL continuar sendo a direção válida da loja, tratado como
**fallback atual**, mesmo que `identity_state` passe a `text_only`. Quando um
novo perfil `text_only` `synced` o substituir, ele SHALL passar a `previous`. A
mudança de `identity_state` sozinha SHALL NOT invalidá-lo.

Se a atualização de um perfil falhar, a tentativa SHALL ser registrada como
`status='failed'` append-only e o perfil anterior SHALL deixar de ser apresentado
como atual, permanecendo preservado como anterior. Nenhum perfil histórico SHALL
ser apagado ou reescrito.

**Nota**: O status `processing` existe no modelo e no banco como reservado para uso futuro com fila/job durável. Na V1, o profile é sempre criado como `synced` ou `failed` diretamente — não passa por `processing`.

#### Scenario: Profile creation with compensation on failure

- **WHEN** a previous `synced` profile is marked `outdated`
- **AND** the new profile insert fails
- **THEN** the previous profile SHALL be restored to `synced`
- **AND** the store SHALL NOT be left without an active profile

#### Scenario: Profile remains synced on logo remove

- **WHEN** a logo is removed via DELETE /api/store/[id]/logo
- **THEN** the active brand profile SHALL remain `synced`
- **AND** `active_logo_asset_id` SHALL be preserved
- **AND** the profile SHALL NOT be archived or marked outdated
- **AND** it SHALL remain the fallback current direction until a new `text_only` synced profile replaces it

#### Scenario: Profile provides fallback direction on failed upload

- **WHEN** a new logo upload succeeds but BrandDirector analysis fails
- **THEN** the previous synced profile SHALL remain `synced`
- **AND** a new profile SHALL be created with `status = 'failed'`
- **AND** `identity_state` SHALL be `'logo'`
- **AND** the UI SHALL use the previous profile's direction as fallback

#### Scenario: Perfil atual em cada uma das três origens

- **WHEN** a identidade ativa é `logo_analysis`, `without_logo` ou `text_only`
- **AND** existe perfil `synced` da origem correspondente com o contexto atual
- **THEN** esse perfil é classificado como atual
- **AND** perfis de outras origens ou contextos são classificados como anteriores
- **AND** nenhum perfil é apagado

#### Scenario: Falha de atualização não promove perfil anterior

- **WHEN** a atualização do perfil da identidade ativa falha
- **THEN** uma tentativa `failed` é registrada com contexto e timestamp
- **AND** o perfil anterior não é classificado como atual
- **AND** o perfil anterior permanece consultável como anterior

#### Scenario: Troca de ativo com texto idêntico

- **WHEN** a assinatura ativa ou o logo muda, mas os 7 campos textuais permanecem idênticos
- **THEN** o `context_hash` inclui a nova identidade do ativo
- **AND** o perfil do ativo anterior não é classificado como atual
- **AND** o novo ativo exige análise própria

#### Scenario: Falha após troca de ativo

- **WHEN** o ativo muda e a nova análise falha
- **THEN** a tentativa `failed` registra a nova identidade do ativo
- **AND** o perfil do ativo anterior permanece como anterior/fallback
- **AND** ele não é apresentado como atual do novo ativo

#### Scenario: Remoção do logo preserva fallback

- **WHEN** o logo é removido e `identity_state` passa a `text_only`
- **THEN** o perfil `logo_analysis` permanece válido como fallback atual
- **AND** `active_logo_asset_id` continua preservado
- **AND** ele só passa a anterior quando um novo `text_only` synced for criado

#### Scenario: Mudança de tom falha com assinatura correta

- **WHEN** a assinatura ativa é a mesma, mas o tom mudou e a nova análise falha
- **THEN** o `synced` antigo não é apresentado como atual
- **AND** a falha mais recente é exibida
- **AND** uma nova tentativa pode ser executada

### Requirement: attempt_snapshot on failed profiles

The system SHALL populate `metadata.attempt_snapshot` with the same 7 fields as
`input_snapshot` whenever a brand profile is created with `status = 'failed'` —
por falha do BrandDirector, da inferência textual, da Assinatura Visual, do
realinhamento ou de atualização de perfil — via
`buildStoreProfileInputSnapshot(store)`. The `attempt_snapshot` serves as an
audit trail.

A tentativa SHALL ser registrada de forma append-only, com
`metadata.failure` contendo código seguro, timestamp, origem e
`identity_asset_id` (`visual_signature_id` ou `active_logo_asset_id`, conforme a
origem), além de `metadata.context_hash` para comparar com o contexto atual. A
tentativa SHALL NOT reescrever o conteúdo do perfil anterior nem seu
`input_snapshot`.

`attempt_snapshot` SHALL NOT be used as a drift baseline. Only `input_snapshot` on synced profiles serves that purpose.

#### Scenario: attempt_snapshot populated on failed profile

- **WHEN** a failed brand profile is created
- **THEN** `metadata.attempt_snapshot` SHALL contain the 7 text fields via the helper
- **AND** `metadata.input_snapshot` SHALL NOT be set

#### Scenario: Falha de atualização também é registrada

- **WHEN** a atualização de um perfil existente falha em qualquer das três origens
- **THEN** uma linha `status='failed'` é criada com `attempt_snapshot`, `failure` e `context_hash`
- **AND** `failure.identity_asset_id` identifica a assinatura ou o logo analisado
- **AND** o perfil anterior não é alterado nem apagado
- **AND** a falha é distinguível de sucesso

### Requirement: Read brand profile — GET /api/store/[id]/brand-profile

The system SHALL expose a `GET /api/store/[id]/brand-profile` endpoint that returns the latest brand profile for the store (the most recently created, regardless of status). This enables the frontend to detect failed profiles on page load.

The endpoint SHALL accept an optional query parameter `?status=synced` that filters to return only the active synced profile.

When `?status=synced` is provided:
- If a synced profile exists, return it (HTTP 200)
- If no synced profile exists, return HTTP 200 with null data
- The most recent profile (regardless of status) remains accessible without the parameter

If no profile exists at all, the endpoint SHALL return HTTP 200 with `null` data.

Sem ambiguidade, o contrato atual SHALL ser preservado. Com ambiguidade, a
resposta SHALL expor explicitamente o estado derivado (`current`, `previous`,
`failed`), `currentProfileId`, `previousProfileIds` e `lastFailure`, sem expor
dados de outra loja. `?status=synced` SHALL continuar retornando o perfil
`synced`; a decisão de rotulá-lo como atual SHALL considerar origem, contexto e
falha mais recente.

#### Scenario: Latest profile returned regardless of status

- **WHEN** a GET request is sent to /api/store/{store_id}/brand-profile
- **AND** a profile exists (synced, failed, or outdated)
- **THEN** the response SHALL contain the most recent brand profile record

#### Scenario: No profile returns null

- **WHEN** a GET request is sent to /api/store/{store_id}/brand-profile
- **AND** no profile exists for this store
- **THEN** the response status SHALL be 200 with data set to `null`

#### Scenario: GET with status=synced returns active profile

- **WHEN** a GET request is sent to /api/store/{store_id}/brand-profile?status=synced
- **AND** a synced brand profile exists
- **THEN** the response SHALL contain the synced profile

#### Scenario: GET with status=synced returns null when none synced

- **WHEN** a GET request is sent to /api/store/{store_id}/brand-profile?status=synced
- **AND** no synced profile exists (only failed profiles)
- **THEN** the response body SHALL be null

#### Scenario: Resposta distingue atual, anterior e falha

- **WHEN** a loja possui perfil atual, perfil anterior e falha mais recente
- **THEN** a resposta identifica cada estado separadamente
- **AND** a falha inclui timestamp e mensagem segura
- **AND** nenhum dado de outra loja é retornado

## ADDED Requirements

### Requirement: Apresentação distinta de perfil atual, anterior e falha

A interface de identidade da loja SHALL exibir rótulos distintos para direção
atual, direção anterior e falha de atualização. O rótulo de “vigente” SHALL NOT
ser aplicado a perfil anterior ou a perfil cujo contexto não corresponda à
identidade ativa.

A apresentação SHALL ser acessível, não depender apenas de cor e oferecer nova
tentativa/realinhamento quando houver falha. Nenhum perfil histórico SHALL ser
removido para simplificar a exibição.

#### Scenario: UI mostra direção atual

- **WHEN** existe perfil atual válido para a identidade ativa
- **THEN** a UI o apresenta como “Direção atual”
- **AND** não mostra aviso de falha para esse contexto

#### Scenario: UI mostra anterior e falha

- **WHEN** existe perfil anterior e uma falha mais recente
- **THEN** a UI apresenta o anterior como “Direção anterior”
- **AND** apresenta a falha como “Falha na atualização”
- **AND** oferece nova tentativa
- **AND** o estado é compreensível sem depender apenas de cor

#### Scenario: Troca de assinatura mantém histórico visível

- **WHEN** a assinatura ativa é trocada com sucesso
- **THEN** o novo perfil é apresentado como atual
- **AND** o perfil anterior continua consultável como anterior
- **AND** nenhum perfil é apagado
