# Campaign Approval Gate

## Purpose

Estado de aprovação e gate de entrega da arte (F37 D1/D2/D8 + decisões 3/4/5/12, fatia 37.1 — Approval Gate + Candidata Única). A campanha nova sob a flag **`campaign_approval_enabled`** entra em **revisão** ao ficar `ready` (tela com a **candidata ativa**, sem download/copy); o lojista **aprova a candidata** (rota `POST /api/campaign/[id]/approve` transacional) e só então a entrega é liberada (arte + copys + download). Estados `not_enabled | legacy | pending | approved | regenerating` (este último **inalcançável na 37.1** — correção é 37.2). Download e `publication-copy` **gated** (decisão 4). **Correção NÃO disponível** nesta fatia — botão "Corrigir" ausente/desabilitado, **nunca abre modal**.

## ADDED Requirements

### Requirement: Estado de aprovação (ApprovalDisplayState / computeApprovalState)

O sistema SHALL prover em `src/lib/campaign/display.ts`:

```ts
export type ApprovalDisplayState =
  | { status: "not_enabled" }             // flag desligado → comportamento atual (entrega livre)
  | { status: "legacy" }                  // flag ligado, campanha pré-flag (zero linhas em campaign_art_versions) → entregue como hoje
  | { status: "pending" }                 // aguardando aprovação (revisão)
  | { status: "approved"; approvedAt: string }
  | { status: "regenerating" };           // derivado do marcador correction_in_progress (decisão 5) — inalcançável na 37.1

export function computeApprovalState(
  campaign: CampaignRecord,
  versions: CampaignArtVersion[],
  flagEnabled: boolean
): ApprovalDisplayState;

export function isDeliveryReleased(state: ApprovalDisplayState): boolean;
```

Regras de derivação:
- `!flagEnabled` → `not_enabled` (comportamento atual preservado — D1 fail-closed).
- `flagEnabled && versions.length === 0` → **`legacy`** (campanha pré-flag entregue como hoje, sem gate retroativo — D2).
- `flagEnabled && approved_version_id` → `approved` (com `approvedAt`).
- `flagEnabled && candidata ativa com correction_in_progress=true` → `regenerating` — **nenhum fluxo ativa na 37.1** (só a 37.2), mas o estado faz parte do contrato para `isDeliveryReleased`.
- senão → `pending`.

- `isDeliveryReleased(state)` = `true` para `not_enabled | legacy | approved`; `false` para `pending | regenerating`.
- `campaigns.status` **NÃO muda** para representar correção (decisão 5 — permanece `generating | ready | error`).

#### Scenario: Flag desligada → not_enabled

- **WHEN** `computeApprovalState` é chamado com `flagEnabled=false`
- **THEN** retorna `{ status: "not_enabled" }`
- **AND** `isDeliveryReleased` retorna `true` (comportamento atual)

#### Scenario: Flag ligada e campanha sem versões → legacy

- **WHEN** `computeApprovalState` é chamado com `flagEnabled=true` e `versions=[]` (campanha `ready` pré-flag)
- **THEN** retorna `{ status: "legacy" }`
- **AND** `isDeliveryReleased` retorna `true` (entregue como hoje, mesmo com a flag ligada — D2)

#### Scenario: Flag ligada e campanha nova sem aprovação → pending

- **WHEN** `computeApprovalState` é chamado com `flagEnabled=true`, `versions=[v1 pending]` e sem `approved_version_id`
- **THEN** retorna `{ status: "pending" }`
- **AND** `isDeliveryReleased` retorna `false` (revisão ativa — gate de download/copy)

#### Scenario: Aprovada → approved com approvedAt

- **WHEN** `computeApprovalState` é chamado com `approved_version_id` preenchido e `approved_at` definido
- **THEN** retorna `{ status: "approved", approvedAt }`
- **AND** `isDeliveryReleased` retorna `true`

#### Scenario: Regenerating derivado do marcador (contrato; inalcançável na 37.1)

- **WHEN** a candidata ativa tem `correction_in_progress=true`
- **THEN** `computeApprovalState` retorna `{ status: "regenerating" }`
- **AND** `isDeliveryReleased` retorna `false`
- **AND** `campaigns.status` permanece `ready` (decisão 5) — este estado só é alcançado a partir da 37.2

### Requirement: Fonte oficial da arte exibida (decisão 3)

O sistema SHALL usar a **candidata ativa** (`asset_status='active'` em `campaign_art_versions`) como fonte oficial da arte exibida quando o gate está ligado:

- Revisão (`pending`): renderiza a candidata ativa via seu `storage_path`.
- Aprovada (`approved`): `campaigns.storage_path` foi repontado para a arte aprovada (D8) — entrega como hoje.
- **Legacy** (`legacy`, sem versões) e `not_enabled`: continuam usando `campaigns.storage_path`.
- **UX sem histórico recuperável (decisão 12):** a tela mostra **apenas a candidata ativa**; nenhuma versão anterior é selecionável ou recuperável (o histórico é interno/auditoria).

#### Scenario: Revisão renderiza a candidata ativa

- **WHEN** uma campanha está `pending` sob a flag
- **THEN** a tela de revisão exibe a imagem da candidata ativa (`asset_status='active'` em `campaign_art_versions`)
- **AND** não oferece nenhuma versão anterior para seleção/recuperação

#### Scenario: Legado renderiza de campaigns.storage_path

- **WHEN** uma campanha `legacy` (sem versões) é exibida
- **THEN** a arte é servida de `campaigns.storage_path` (como hoje)

### Requirement: Tela de revisão da candidata (CampaignApprovalView)

O sistema SHALL exibir a **tela de revisão** em `/campanhas/[id]` quando a campanha está `pending` (flag ligada, campanha nova não aprovada):

- Exibe a arte da **candidata ativa** (sem botão de download, sem Kit de Publicação/copy — revisão 100% foco na arte, D2).
- Botão primário **"Aprovar e liberar campanha"** — dispara `POST /api/campaign/[id]/approve` com o `versionId` da candidata; ao aprovar, `router.refresh()` libera a entrega (arte + copys + download, como hoje).
- Botão secundário **"Corrigir" ausente** (alternativa aceitável: desabilitado) — **nunca abre modal** nesta fatia (correção é 37.2; decisão 3/D12).
- Microcopy PT-BR (ex.: "Revise a arte antes de liberar: a IA pode cometer erros."), estados de loading/erro claros, touch targets ≥ 44px, `label`/`aria`, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`).

#### Scenario: Campanha pendente exibe revisão sem download/copy

- **WHEN** uma campanha nova sob a flag está `pending`
- **THEN** a página exibe a tela de revisão com a arte da candidata
- **AND** não há botão de download nem Kit de Publicação/copy visível

#### Scenario: Botão primário aprova e libera a entrega

- **WHEN** o lojista clica em "Aprovar e liberar campanha"
- **THEN** o `POST /api/campaign/[id]/approve` é chamado com o `versionId` da candidata
- **AND** após o sucesso a página passa a exibir a entrega (arte aprovada + copys + download)

#### Scenario: Corrigir ausente ou desabilitado e nunca abre modal

- **WHEN** a tela de revisão é renderizada na fatia 37.1
- **THEN** o botão secundário "Corrigir" está ausente (ou desabilitado)
- **AND** nenhum modal de correção é aberto em qualquer interação

#### Scenario: A11y e mobile da revisão

- **WHEN** a tela de revisão é exibida em tela estreita (320px/375px)
- **THEN** a arte e o botão primário mantêm touch target ≥ 44px e a11y adequada
- **AND** a imagem é exibida sem recorte (`object-contain`), sem scroll horizontal

### Requirement: Rota POST /api/campaign/[id]/approve

O sistema SHALL prover `POST /api/campaign/[id]/approve` (nova rota, D8):

- Fluxo: `requireSameOrigin` (CSRF) → `requireApiUser` → UUID v4 (`400`) → `getCampaign` (404) → `requireOwnership` (404) → **`isCampaignApprovalEnabled()`; flag off → 403** → `campaign.status !== 'ready' → 409` (sem candidata para aprovar em `generating`/`error`) → zod do body `{ versionId: uuid }` → `rpc('approve_campaign_art_version', ...)`.
- Mapeamento de erros do RPC: `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active` → 409 (versão inválida ou já resolvida).
- Sucesso → `200 { campaignUrl: "/campanhas/{id}", status: "approved" }`.
- Anti-concorrência: o guarded update do RPC + o índice único parcial tornam a segunda aprovação idempotente (409).
- **Telemetria (D8):** sem novo `generation_type`; o funil usa `campaign_art_versions.status` + `campaigns.approved_at`.

#### Scenario: Aprovação com sucesso

- **WHEN** um owner autenticado chama `POST /api/campaign/[id]/approve` com o `versionId` da candidata `pending` de uma campanha `ready` sob a flag
- **THEN** retorna `200 { campaignUrl, status: "approved" }`
- **AND** a candidata vira `approved` e a campanha ganha `storage_path`/`approved_version_id`/`approved_at`/`approval_status='approved'`

#### Scenario: Flag desligada bloqueia a aprovação

- **WHEN** um owner chama a rota `approve` com a flag `campaign_approval_enabled` desligada
- **THEN** retorna 403

#### Scenario: Sem ownership retorna 404

- **WHEN** um usuário não-dono chama a rota `approve`
- **THEN** retorna 404 (mesmo status que campanha inexistente)

#### Scenario: Versão já resolvida ou inválida retorna 409

- **WHEN** a rota `approve` é chamada com uma versão já `approved`/`rejected` ou sem `asset_status='active'`
- **THEN** retorna 409 (já resolvida/inválida) e nada é alterado

#### Scenario: Campanha não ready retorna 409

- **WHEN** a rota `approve` é chamada para uma campanha `generating` ou `error`
- **THEN** retorna 409 (sem candidata para aprovar)

### Requirement: Gate de download (D2)

O sistema SHALL fazer `GET /api/campaign/[id]/download` verificar o estado de aprovação antes de servir a imagem:

- Após auth + ownership: ler `isCampaignApprovalEnabled()` + `listArtVersions` + `computeApprovalState`.
- `isDeliveryReleased(state) === false` (i.e., `pending`/`regenerating` com flag on) → **403**.
- `not_enabled`/`legacy`/`approved` → liberado (serve `campaign.storage_path` — aprovada repontada; legacy/not_enabled como hoje).

#### Scenario: Download bloqueado para campanha pendente

- **WHEN** uma campanha `pending` sob a flag tenta o download
- **THEN** retorna 403

#### Scenario: Download liberado após aprovação

- **WHEN** a campanha foi aprovada
- **THEN** o download retorna 200 servindo a arte aprovada (`campaigns.storage_path` repontado)

#### Scenario: Download de campanha legada liberado

- **WHEN** uma campanha `legacy` (flag on, sem versões) tenta o download
- **THEN** retorna 200 (comportamento atual preservado)

### Requirement: Gate de publication-copy (decisão 4)

O sistema SHALL fazer `PATCH /api/campaign/[id]/publication-copy` verificar o estado de aprovação antes de aplicar a edição:

- Após auth + ownership (e antes de persistir): ler `isCampaignApprovalEnabled()` + `listArtVersions` + `computeApprovalState`.
- `isDeliveryReleased(state) === false` (i.e., `pending`/`regenerating` com flag on) → **403**.
- `not_enabled`/`legacy`/`approved` → comportamento atual (edição normal e restore preservados).

#### Scenario: Copy bloqueado para campanha pendente

- **WHEN** um owner tenta `PATCH /publication-copy` para uma campanha `pending` sob a flag
- **THEN** retorna 403 e nada é persistido

#### Scenario: Copy liberado após aprovação

- **WHEN** a campanha foi aprovada
- **THEN** o PATCH de copy funciona como hoje (200)

#### Scenario: Copy de campanha legada liberado

- **WHEN** uma campanha `legacy` (flag on, sem versões) tenta editar o copy
- **THEN** retorna 200 (comportamento atual preservado)

### Requirement: Nenhum fluxo de correção nesta fatia

O sistema SHALL **NÃO** implementar qualquer fluxo de correção na fatia 37.1:

- Sem `POST /api/campaign/[id]/regenerate` (37.2).
- Sem Correction Brief Parser / `briefPatch` / `validateBriefPatch` (37.2/37.3).
- Sem `prompts/regen/*` e sem referência de arte na regeração (37.2).
- `rejection_count` existe como schema (D7) mas **nenhum código escreve nela** nesta fatia (guard do cap é 37.2).
- Sem modal de correção; o estado `regenerating` não é ativado por nenhum fluxo da 37.1.

#### Scenario: Nenhuma rota de regeração existe

- **WHEN** um cliente tenta chamar `POST /api/campaign/[id]/regenerate` nesta fatia
- **THEN** a rota não existe (404) — correção é 37.2

#### Scenario: rejection_count não é alterada

- **WHEN** um fluxo da fatia 37.1 roda (geração, revisão, aprovação)
- **THEN** `campaigns.rejection_count` permanece 0 (nada escreve nela nesta fatia)
