# Campaign Approval Gate

## Purpose

Evolução da capability `campaign-approval-gate` (F37.1) pela **F37.2 realinhada — Correção Única por Não Conformidade** (D37.2-R1/R7/R8). A tela de revisão (`pending`, v1) passa a oferecer **[Aprovar arte]** (primário) e **[Informar problema]** (secundário, abre o modal — capability `campaign-problem-report`). O estado **`regenerating` deixa de ser inalcançável**: é exercitado quando a candidata ativa carrega `correction_in_progress=true` (consumo da oportunidade), bloqueando approve/download/copy com progresso da v2. A rota `POST /api/campaign/[id]/approve` passa a chamar a **RPC aditiva `approve_campaign_candidate`** (R8): trava a candidata primeiro, valida `pending`/`active` + **`correction_in_progress=false`** (senão 409) e invoca a RPC F37.1 `approve_campaign_art_version` **intacta** na mesma transação — fechando a corrida aprovar × consumir **no banco** (ordem de locks candidata → campanha; sem geração paga após a aprovação). Gates de download/publication-copy e estados `not_enabled`/`legacy`/`approved` preservados (R7). A partir da F37.2 existe fluxo de correção (rota `problem-report`); o requisito 37.1 "nenhum fluxo de correção nesta fatia" é **REMOVED**.

## MODIFIED Requirements

### Requirement: Estado de aprovação (ApprovalDisplayState / computeApprovalState)

O sistema SHALL prover em `src/lib/campaign/display.ts`:

```ts
export type ApprovalDisplayState =
  | { status: "not_enabled" }             // flag desligado → comportamento atual (entrega livre)
  | { status: "legacy" }                  // flag ligado, campanha pré-flag (zero linhas em campaign_art_versions) → entregue como hoje
  | { status: "pending" }                 // aguardando aprovação (revisão)
  | { status: "approved"; approvedAt: string }
  | { status: "regenerating" };           // derivado do marcador correction_in_progress (decisão 5) — exercitado na F37.2
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

### Requirement: Tela de revisão da candidata (CampaignApprovalView)

O sistema SHALL exibir a **tela de revisão** em `/campanhas/[id]` quando a campanha está `pending` (flag ligada, campanha nova não aprovada), com **dois caminhos** (R1):

- Exibe a arte da **candidata ativa** (sem botão de download, sem Kit de Publicação/copy — revisão 100% foco na arte, D2).
- Botão primário **"Aprovar arte"** — dispara `POST /api/campaign/[id]/approve` com o `versionId` da candidata (fluxo da RPC protegida — R8); ao aprovar, `router.refresh()` libera a entrega (arte + copys + download, como hoje).
- Botão secundário **"Informar problema"** — abre o modal de relato (uma etapa, capability `campaign-problem-report`) **sem sair da página**; presente apenas quando a candidata é a v1 e ainda há oportunidade (caso sem consumo).
- Microcopy PT-BR (ex.: "Revise a arte antes de liberar: a IA pode cometer erros."), estados de loading/erro claros, touch targets ≥ 44px, `label`/`aria`, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`).
- **Guarda de UX (reforço, não a garantia):** [Aprovar arte] desabilitado enquanto um caso está em processamento (`correction_in_progress`); a garantia de serialização é a RPC aditiva no banco (R8).

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
- **THEN** a arte e os botões mantêm touch target ≥ 44px e a11y adequada
- **AND** a imagem é exibida sem recorte (`object-contain`), sem scroll horizontal

### Requirement: Rota POST /api/campaign/[id]/approve

O sistema SHALL prover `POST /api/campaign/[id]/approve` (rota da F37.1, **modificada na F37.2** para usar a aprovação protegida — R8):

- Fluxo: `requireSameOrigin` (CSRF) → `requireApiUser` → UUID v4 (`400`) → `getCampaign` (404) → `requireOwnership` (404) → **`isCampaignApprovalEnabled()`; flag off → 403** → `campaign.status !== 'ready' → 409` → zod do body `{ versionId: uuid }` → **`rpc('approve_campaign_candidate', { p_campaign_id, p_version_id })`** (RPC aditiva que chama a RPC F37.1 `approve_campaign_art_version` intacta na mesma transação).
- Mapeamento de erros: `version_not_found`/`version_campaign_mismatch` → 404; `version_not_pending`/`version_not_active`/`correction_in_progress` → 409 (versão inválida, já resolvida ou correção em andamento).
- Sucesso → `200 { campaignUrl: "/campanhas/{id}", status: "approved" }`.
- **Serialização aprovar × consumir (R8):** a RPC `approve_campaign_candidate` trava a candidata primeiro e valida `correction_in_progress=false`; se o consumo venceu (marcou `correction_in_progress=true`), a aprovação falha `409` — **nenhuma geração paga roda após a aprovação**. Se a aprovação venceu, o consumo subsequente falha na pendência e a geração é abortada **antes do provider** (sem consumo, sem custo). Ordem de locks: candidata → campanha (aprovação nunca toca o relato).
- Telemetria (D8) sem novo `generation_type`; o funil usa `campaign_art_versions.status` + `campaigns.approved_at`.

#### Scenario: Aprovação com sucesso (v1 ou v2)

- **WHEN** um owner autenticado chama `POST /api/campaign/[id]/approve` com o `versionId` da candidata `pending`/`active` (v1 sem correção ou v2 após conclusão)
- **THEN** retorna `200 { campaignUrl, status: "approved" }`
- **AND** a candidata vira `approved` e a campanha ganha `storage_path`/`approved_version_id`/`approved_at`/`approval_status='approved'`

#### Scenario: Aprovação durante correção retorna 409

- **WHEN** a candidata ativa tem `correction_in_progress=true` (`regenerating`)
- **THEN** a RPC `approve_campaign_candidate` retorna `correction_in_progress` → rota responde 409
- **AND** nada é alterado (nenhuma geração paga roda após a aprovação)

#### Scenario: Flag desligada bloqueia a aprovação

- **WHEN** um owner chama a rota `approve` com a flag `campaign_approval_enabled` desligada
- **THEN** retorna 403

#### Scenario: Sem ownership retorna 404

- **WHEN** um usuário não-dono chama a rota `approve`
- **THEN** retorna 404 (mesmo status que campanha inexistente)

#### Scenario: Versão já resolvida, superseded ou inválida retorna 409/404

- **WHEN** a rota `approve` é chamada com uma versão já `approved`/`rejected`, **`superseded`** (v1 após v2) ou sem `asset_status='active'`
- **THEN** retorna 409 (já resolvida/inválida) e nada é alterado — a v1 não é aprovável após a v2

#### Scenario: Campanha não ready retorna 409

- **WHEN** a rota `approve` é chamada para uma campanha `generating` ou `error`
- **THEN** retorna 409 (sem candidata para aprovar)

## REMOVED Requirements

### Requirement: Nenhum fluxo de correção nesta fatia

**Reason**: A F37.2 realinhada adiciona o fluxo de correção única por não conformidade (rota `POST /api/campaign/[id]/problem-report` + modal [Informar problema] + oportunidade única com no máximo uma v2). O requisito da 37.1 que vedava qualquer fluxo de correção nesta capability torna-se obsoleto e é substituído pelas capabilities `campaign-problem-report`/`campaign-correction-reports`/`campaign-correction-analysis` e pelas modificações de `campaign-art-versions`/`campaign-approval-gate`/`campaign-page-ui`/`ai-image-generation`.

**Migration**: No lugar de "sem fluxo de correção", a revisão `pending` passa a oferecer [Aprovar arte] + [Informar problema]; o estado `regenerating` passa a ser exercitado; `rejection_count` passa a ser escrito (0 → 1) **somente** pela RPC de consumo `consume_campaign_correction_opportunity` (não existe rota `/regenerate` nem cap de 2 correções — o contrato novo usa a rota `problem-report` e no máximo uma v2). A RPC dormente `begin_campaign_correction`/`cancel_campaign_correction`/`complete_campaign_regeneration` permanece intocada como histórico.
