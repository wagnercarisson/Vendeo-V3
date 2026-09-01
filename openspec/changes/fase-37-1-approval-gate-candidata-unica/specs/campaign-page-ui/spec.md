# Campaign Page UI

## Purpose

A fatia 37.1 adiciona o **estado de revisão da arte** à página `/campanhas/[id]` (F37 D2, decisões 3/12): quando a campanha está `ready` e `pending` sob a flag `campaign_approval_enabled`, a página renderiza a **tela de revisão** (`CampaignApprovalView`) com a **candidata ativa** — sem download, sem Kit de Publicação/copy — e o botão primário **"Aprovar e liberar campanha"** (o secundário "Corrigir" é ausente/desabilitado e nunca abre modal). `approved`/`legacy`/`not_enabled` mantêm a entrega atual (arte + copys + download). Os demais estados (`generating`/`stale`/`error`) permanecem inalterados.

## ADDED Requirements

### Requirement: Estado de revisão da arte (campanha pendente)

O sistema SHALL, quando a campanha está `ready` e o estado de aprovação é **`pending`** (flag `campaign_approval_enabled` ligada, campanha nova sem aprovação), renderizar a **tela de revisão** em vez da entrega:

- O Server Component (`/campanhas/[id]/page.tsx`) SHALL, para campanhas `ready`: ler `isCampaignApprovalEnabled()` + `listArtVersions(id)`, derivar `computeApprovalState(campaign, versions, flagEnabled)` e passar `candidateImageUrl`/`candidateVersionId` (da **candidata ativa** — `asset_status='active'`, decisão 3) via props.
- A revisão SHALL exibir a arte da candidata ativa **sem** botão de download e **sem** Kit de Publicação/copy (revisão 100% foco na arte — D2).
- Botão primário **"Aprovar e liberar campanha"**: dispara `POST /api/campaign/[id]/approve` com o `versionId` da candidata; ao aprovar, `router.refresh()` → a página passa a exibir a entrega (arte + copys + download, como hoje).
- Botão secundário **"Corrigir" ausente** (alternativa aceitável: desabilitado) — **nunca abre modal** nesta fatia (correção é 37.2).
- **Sem histórico recuperável (decisão 12):** apenas a candidata ativa é exibida; nenhuma versão anterior é selecionável/recuperável.
- Microcopy PT-BR (ex.: "Revise a arte antes de liberar: a IA pode cometer erros."), estados de loading/erro, touch ≥ 44px, a11y, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`), imagem sem recorte (`object-contain`).

#### Scenario: Campanha pendente exibe revisão sem download/copy

- **WHEN** uma campanha `ready` com estado de aprovação `pending` é aberta
- **THEN** a página exibe a tela de revisão com a imagem da candidata ativa
- **AND** não há botão "Baixar Original" nem Kit de Publicação/copy

#### Scenario: Aprovar e liberar libera a entrega

- **WHEN** o lojista clica em "Aprovar e liberar campanha"
- **THEN** o `POST /api/campaign/[id]/approve` é chamado com o `versionId` da candidata
- **AND** após o sucesso a página passa a exibir a entrega (arte + copys + download)

#### Scenario: Corrigir ausente/desabilitado nunca abre modal

- **WHEN** a revisão é renderizada na fatia 37.1
- **THEN** o botão "Corrigir" está ausente (ou desabilitado) e nenhum modal de correção é aberto

#### Scenario: Somente a candidata ativa é exibida

- **WHEN** a revisão mostra a arte
- **THEN** exibe apenas a candidata ativa (`asset_status='active'`)
- **AND** nenhuma versão anterior é selecionável/recuperável

#### Scenario: Aprovada / legacy / flag off mantêm a entrega atual

- **WHEN** uma campanha está `approved`, `legacy` (sem versões, flag on) ou com a flag desligada (`not_enabled`)
- **THEN** a página renderiza a entrega como hoje (arte + Kit de Publicação + download)

#### Scenario: Mobile e a11y da revisão

- **WHEN** a tela de revisão é exibida em tela estreita (320px/375px)
- **THEN** a imagem é exibida sem recorte (`object-contain`) e os controles têm touch target ≥ 44px, sem scroll horizontal
