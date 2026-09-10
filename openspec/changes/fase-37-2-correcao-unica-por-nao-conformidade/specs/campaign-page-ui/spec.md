# Campaign Page UI

## Purpose

Evolução da página `/campanhas/[id]` pela **F37.2 realinhada — Correção Única por Não Conformidade** (D37.2-R1/R7 e §5 estados UX). A página passa a derivar e exibir os estados de correção além do estado de aprovação da F37.1: `pending` (v1) com os dois botões **[Aprovar arte]** + **[Informar problema]** (modal); `regenerating` com **progresso da v2** (sem download/copy/approve — e sem cair no `ReadyView`); `pending` (v2 candidata) com **[Aprovar arte]** aprovando a v2; **sem galeria e sem retorno à v1**. Estados `not_enabled`/`legacy`/`approved` mantêm a entrega atual. Os demais estados (`generating`/`stale`/`error`) permanecem inalterados.

## MODIFIED Requirements

### Requirement: Estado de revisão da arte (campanha pendente)

O sistema SHALL, quando a campanha está `ready` e o estado de aprovação é **`pending`** (flag `campaign_approval_enabled` ligada, candidata nova sem aprovação), renderizar a **tela de revisão** em vez da entrega:

- O Server Component (`/campanhas/[id]/page.tsx`) SHALL, para campanhas `ready`: ler `isCampaignApprovalEnabled()` + `listArtVersions(id)`, derivar `computeApprovalState(campaign, versions, flagEnabled)` e passar `candidateImageUrl`/`candidateVersionId` (da **candidata ativa** — `asset_status='active'`) via props (base F37.1).
- A revisão SHALL exibir a arte da candidata ativa **sem** botão de download e **sem** Kit de Publicação/copy.
- **Dois botões (F37.2, R1):** botão primário **[Aprovar arte]** (dispara `POST /api/campaign/[id]/approve` com o `versionId` da candidata) e botão secundário **[Informar problema]** (abre o modal de relato — capability `campaign-problem-report`) quando a candidata é a **v1** e ainda há oportunidade; ao aprovar, `router.refresh()` → a página passa a exibir a entrega.
- **V2 candidata (F37.2, R5):** quando a v2 é a candidata (`pending`, v1 `superseded`), a revisão exibe **[Aprovar arte]** aprovando a **v2**, **sem** [Informar problema] e **sem** retorno à v1.
- **Sem histórico recuperável (decisão 12):** apenas a candidata ativa é exibida; nenhuma versão anterior é selecionável/recuperável.
- Microcopy PT-BR, estados de loading/erro, touch ≥ 44px, a11y, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`), imagem sem recorte (`object-contain`).

#### Scenario: Campanha pendente (v1) exibe revisão sem download/copy

- **WHEN** uma campanha `ready` com estado de aprovação `pending` e candidata v1 é aberta
- **THEN** a página exibe a tela de revisão com a imagem da candidata ativa
- **AND** não há botão "Baixar Original" nem Kit de Publicação/copy
- **AND** há os botões [Aprovar arte] e [Informar problema]

#### Scenario: Aprovar e liberar libera a entrega

- **WHEN** o lojista clica em "Aprovar arte"
- **THEN** o `POST /api/campaign/[id]/approve` é chamado com o `versionId` da candidata
- **AND** após o sucesso a página passa a exibir a entrega (arte + copys + download)

#### Scenario: Informar problema abre o modal

- **WHEN** o lojista clica em [Informar problema] na revisão `pending` (v1)
- **THEN** o modal de relato abre (preview, orientação, campo obrigatório, Enviar/Cancelar)

#### Scenario: V2 candidata exibe apenas Aprovar arte

- **WHEN** a v2 é a candidata (`pending`, v1 `superseded`)
- **THEN** a revisão exibe [Aprovar arte] (aprova a v2)
- **AND** não oferece [Informar problema] nem retorno à v1

#### Scenario: Aprovada / legacy / flag off mantêm a entrega atual

- **WHEN** uma campanha está `approved`, `legacy` (sem versões, flag on) ou com a flag desligada (`not_enabled`)
- **THEN** a página renderiza a entrega como hoje (arte + Kit de Publicação + download)

#### Scenario: Mobile e a11y da revisão

- **WHEN** a tela de revisão é exibida em tela estreita (320px/375px)
- **THEN** a imagem é exibida sem recorte (`object-contain`) e os controles têm touch target ≥ 44px, sem scroll horizontal

## ADDED Requirements

### Requirement: Estado regenerating com progresso da v2

O sistema SHALL renderizar um estado dedicado quando `computeApprovalState` deriva **`regenerating`** (candidata ativa com `correction_in_progress=true` — RPC de consumo marcou; R3/R7):

- A página (`/campanhas/[id]`) SHALL exibir **progresso da v2** (sem botão de download, sem Kit de Publicação/copy e **sem** [Aprovar arte]/[Informar problema] ativos) enquanto a correção está em andamento.
- O Client Component NÃO cai no `ReadyView` durante `regenerating` (gap F37.1 — o estado era inalcançável; agora é exercitado).
- Ao concluir (v2 persistida e candidata), `router.refresh()` faz a página derivar `pending` (v2) → [Aprovar arte].
- Microcopy PT-BR de processamento (ex.: "Corrigindo a arte..."), a11y e tema dark.

#### Scenario: Regenerating exibe progresso sem actions de entrega/approve

- **WHEN** a candidata ativa tem `correction_in_progress=true`
- **THEN** a página exibe o estado de regeneração (progresso da v2)
- **AND** não há download/copy, [Aprovar arte] ou [Informar problema] disponíveis

#### Scenario: V2 concluída volta a derivar pending e permite aprovar

- **WHEN** a v2 é persistida (v1 `superseded`, v2 `active`/`pending`, `correction_in_progress=false`)
- **THEN** após refresh a página deriva `pending` (v2) e exibe [Aprovar arte]
