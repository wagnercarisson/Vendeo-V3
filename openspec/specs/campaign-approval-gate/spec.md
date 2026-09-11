# Campaign Approval Gate

> Synced from `fase-37-1-approval-gate-candidata-unica` (ADDED), then `fase-37-2-correcao-unica-por-nao-conformidade` (MODIFIED + REMOVED).

## Purpose

Estado de aprovação e gate de entrega da arte (F37 D1/D2/D8 + decisões 3/4/5/12, fatia 37.1 — Approval Gate + Candidata Única; evoluído pela fatia 37.2 — Correção Única por Não Conformidade). A campanha nova sob a flag **`campaign_approval_enabled`** entra em **revisão** ao ficar `ready` (tela com a **candidata ativa**, sem download/copy); o lojista **aprova a candidata** (rota `POST /api/campaign/[id]/approve` transacional, via RPC protegida `approve_campaign_candidate`) e só então a entrega é liberada (arte + copys + download). Estados `not_enabled | legacy | pending | approved | regenerating` (o `regenerating` é **exercitado na 37.2** pelo consumo da oportunidade). Download e `publication-copy` **gated** (decisão 4). A revisão `pending` oferece **[Aprovar arte]** + **[Informar problema]** (fluxo de correção — capability `campaign-problem-report`); a **v2 candidata** exibe apenas [Aprovar arte].

## Requirements

### Requirement: Estado de aprovação (ApprovalDisplayState / computeApprovalState)

O sistema SHALL prover em `src/lib/campaign/display.ts`:

```ts
export type ApprovalDisplayState =
  | { status: "not_enabled" }             // flag desligado → comportamento atual (entrega livre)
  | { status: "legacy" }                  // flag ligado, campanha pré-flag (zero linhas em campaign_art_versions) → entregue como hoje
  | { status: "pending" }                 // aguardando aprovação (revisão)
  | { status: "approved"; approvedAt: string }
  | { status: "regenerating" };           // derivado do marcador correction_in_progress (decisão 5) — exercitado na F37.2

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
- `flagEnabled && candidata ativa com correction_in_progress=true` → `regenerating` — **na F37.2 é exercitado** pela RPC de consumo (`consume_campaign_correction_opportunity` marca `correction_in_progress=true` na candidata ativa no início do provider).
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

#### Scenario: Regenerating derivado do marcador (exercitado na F37.2)

- **WHEN** a candidata ativa tem `correction_in_progress=true` (RPC de consumo marcou)
- **THEN** `computeApprovalState` retorna `{ status: "regenerating" }`
- **AND** `isDeliveryReleased` retorna `false`
- **AND** `campaigns.status` permanece `ready` (decisão 5)
- **AND** a UI bloqueia approve/download/copy e exibe o progresso da v2

#### Scenario: V2 candidata deriva pending (não regenerating)

- **WHEN** a v2 foi persistida (v1 `superseded`, v2 `active`/`pending`, sem `correction_in_progress`)
- **THEN** `computeApprovalState` retorna `{ status: "pending" }`
- **AND** o botão [Aprovar arte] aprova a v2 (sem voltar à v1)

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

O sistema SHALL exibir a **tela de revisão** em `/campanhas/[id]` quando a campanha está `pending` (flag ligada, campanha nova não aprovada), com **dois caminhos** (R1):

- Exibe a arte da **candidata ativa** (sem botão de download, sem Kit de Publicação/copy — revisão 100% foco na arte, D2).
- Botão primário **"Aprovar arte"** — dispara `POST /api/campaign/[id]/approve` com o `versionId` da candidata (fluxo da RPC protegida — R8); ao aprovar, `router.refresh()` libera a entrega (arte + copys + download, como hoje).
- Botão secundário **"Informar problema"** — abre o modal de relato (uma etapa, capability `campaign-problem-report`) **sem sair da página**; presente apenas quando a candidata é a v1 e ainda há oportunidade (caso sem consumo).
- Microcopy PT-BR (ex.: "Revise a arte antes de liberar: a IA pode cometer erros."), estados de loading/erro claros, touch targets ≥ 44px, `label`/`aria`, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`).
- **Proteções contra a corrida aprovar × consumir (sem guarda de UX no componente):** (a) o modal de relato bloqueia interação e fechamento enquanto a análise/geração está em processamento; (b) após o consumo (`correction_in_progress=true`) a página deriva `regenerating` e renderiza `RegeneratingView` — `CampaignApprovalView` não é montada, portanto não há [Aprovar arte] ativo nesse estado; (c) a garantia de serialização é a RPC aditiva no banco (`approve_campaign_candidate` valida `correction_in_progress=false` → 409), que fecha a corrida (R8). Não existe estado real que alimente um "approve desabilitado" no componente.

#### Scenario: Campanha pendente exibe revisão sem download/copy

- **WHEN** uma campanha nova sob a flag está `pending`
- **THEN** a página exibe a tela de revisão com a arte da candidata
- **AND** não há botão de download nem Kit de Publicação/copy visível

#### Scenario: Aprovar arte aprova e libera a entrega

- **WHEN** o lojista clica em "Aprovar arte"
- **THEN** o `POST /api/campaign/[id]/approve` é chamado com o `versionId` da candidata
- **AND** após o sucesso a página passa a exibir a entrega (arte aprovada + copys + download)

#### Scenario: Informar problema abre o modal sem sair da página

- **WHEN** a revisão `pending` (v1) é exibida
- **THEN** há o botão secundário [Informar problema]
- **AND** ao clicar, o modal de relato abre sem sair da página e sem aprovar

#### Scenario: V2 candidata exibe apenas Aprovar arte

- **WHEN** a v2 é a candidata (`pending`, v1 `superseded`)
- **THEN** a revisão exibe [Aprovar arte] (aprova a v2)
- **AND** NÃO oferece [Informar problema] nem volta à v1

#### Scenario: A11y e mobile da revisão

- **WHEN** a tela de revisão é exibida em tela estreita (320px/375px)
- **THEN** a arte e o botão primário mantêm touch target ≥ 44px e a11y adequada
- **AND** a imagem é exibida sem recorte (`object-contain`), sem scroll horizontal

### Requirement: Rota POST /api/campaign/[id]/approve

O sistema SHALL prover `POST /api/campaign/[id]/approve` (rota da F37.1, **modificada na F37.2** para usar a aprovação protegida — R8):

- Fluxo: `requireSameOrigin` (CSRF) → `requireApiUser` → UUID v4 (`400`) → `getCampaign` (404) → `requireOwnership` (404) → **`isCampaignApprovalEnabled()`; flag off → 403** → `campaign.status !== 'ready' → 409` → zod do body `{ versionId: uuid }` → **`rpc('approve_campaign_candidate', { p_campaign_id, p_version_id })`** (RPC aditiva que chama a RPC F37.1 `approve_campaign_art_version` intacta na mesma transação).
- Mapeamento de erros: `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active`/`correction_in_progress` → 409 (versão inválida, já resolvida ou correção em andamento).
- Sucesso → `200 { campaignUrl: "/campanhas/{id}", status: "approved" }`.
- **Serialização aprovar × consumir (R8):** a RPC `approve_campaign_candidate` trava a candidata primeiro e valida `correction_in_progress=false`; se o consumo venceu (marcou `correction_in_progress=true`), a aprovação falha `409` — **nenhuma geração paga roda após a aprovação**. Se a aprovação venceu, o consumo subsequente falha na pendência e a geração é abortada **antes do provider** (sem consumo, sem custo). Ordem de locks: candidata → campanha (aprovação nunca toca o relato).
- Telemetria (D8) sem novo `generation_type`; o funil usa `campaign_art_versions.status` + `campaigns.approved_at`.

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

#### Scenario: Aprovação durante correção retorna 409

- **WHEN** a candidata ativa tem `correction_in_progress=true` (`regenerating`)
- **THEN** a RPC `approve_campaign_candidate` retorna `correction_in_progress` → rota responde 409
- **AND** nada é alterado (nenhuma geração paga roda após a aprovação)

#### Scenario: Versão já resolvida, superseded ou inválida retorna 409/404

- **WHEN** a rota `approve` é chamada com uma versão já `approved`/`rejected`, **`superseded`** (v1 após v2) ou sem `asset_status='active'`
- **THEN** retorna 409 (já resolvida/inválida) e nada é alterado — a v1 não é aprovável após a v2

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
