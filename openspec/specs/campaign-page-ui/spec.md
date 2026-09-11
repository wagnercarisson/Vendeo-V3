# Campaign Page UI

> Synced from `fase-17-edicao-publication-copy` (MODIFIED), then `fase-18-app-shell-ui-base-rotas` (MODIFIED), then `fase-19-onboarding-estados-vazios` (MODIFIED + REMOVED), then `fase-37-1-approval-gate-candidata-unica` (ADDED — estado de revisão da arte, D2/decisões 3/12), then `fase-37-2-correcao-unica-por-nao-conformidade` (MODIFIED + ADDED — dois botões [Aprovar arte]/[Informar problema], estado `regenerating` com progresso da v2 e v2 candidata). Route migrated from `/campanha/[id]` to `/campanhas/[id]`. No-store redirect replaced by `notFound()`. Emoji icons replaced by Lucide. Kit de Publicação uses Card + Badge components. Navigation links updated.

## Purpose

Server Component (`/campanha/[id]`) com autenticação, ownership via RLS, e Client Component com 4 estados visuais: ready, generating, error, stale generating.

## Requirements

### Requirement: Server Component com auth e ownership

O Server Component em `src/app/(app)/campanhas/[id]/page.tsx` SHALL:
- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, chamar `notFound()` em vez de `redirect("/loja")`
- Chamar `getCampaignForDisplay(id)` para carregar a campanha via RLS
- Se `getCampaignForDisplay` retornar `null`, chamar `notFound()`
- Calcular `displayStatus` server-side: `"ready"` | `"generating"` | `"stale"` | `"error"` usando `campaign.status` e `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000` para detectar stale
- Pré-computar `downloadUrl = "/api/campaign/${id}/download"` para o Client Component não precisar montar URLs
- Passar os dados da campanha para o Client Component como props serializáveis, incluindo `displayStatus`, `downloadUrl` e `updatedAt`

#### Scenario: Usuário autenticado acessa campanha própria

- **WHEN** um usuário autenticado acessa `/campanhas/{id}` onde `id` é uma campanha da sua loja
- **THEN** o Server Component carrega a campanha e renderiza o Client Component com os dados

#### Scenario: Usuário autenticado sem loja recebe 404

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas/{id}`
- **THEN** `notFound()` é chamado → página 404
- **AND** o sistema NÃO redireciona para `/loja`

#### Scenario: Campanha não encontrada ou de outro tenant

- **WHEN** um usuário autenticado acessa `/campanhas/{id}` onde `id` não existe ou pertence a outra loja
- **THEN** `notFound()` é chamado → página 404

#### Scenario: Usuário não autenticado

- **WHEN** um usuário não autenticado acessa `/campanhas/{id}`
- **THEN** o middleware redireciona para `/login` (ou o `requirePageUser` retorna 401)

### Requirement: Estado ready com edição de publication copy

Quando `displayStatus === "ready"`, o Client Component SHALL exibir:
- A imagem final da campanha (src da signed URL gerada server-side — `imageUrl` passada como prop)
- O nome do produto
- A data de criação formatada
- Botão "Baixar Original" que linka para `downloadUrl` (pré-computado server-side)

O Client Component SHALL receber `campaignId: string` como prop para montar a URL do PATCH.

**Kit de Publicação (seção separada):**
- Seção usa `<Card>` como container, título local `<h2>`, e `<Badge variant="ready" icon={CheckCheck}>` se `isPublicationCopyEdited` é `true`
- Caption, hashtags, cta_post em modo visualização (padrão) com botão "Editar" (Lucide `Pencil`)

**Modo edição (após clicar "Editar"):**
- Caption: textarea preenchido com valor atual
- Hashtags: textarea "uma por linha" (normalizado como array no save)
- CTA: input preenchido com valor atual
- Botão "Salvar" (Lucide `Save`) — chama PATCH para `/api/campaign/[campaignId]/publication-copy` usando a prop `campaignId`
- Botão "Restaurar original" (Lucide `RotateCcw`) — confirmação → PATCH `{ restore: true }` para mesma URL
- Botão "Cancelar" (Lucide `X`) — descarta alterações locais, volta ao modo visualização

#### Scenario: Client recebe campaignId para montar PATCH URL

- **WHEN** o Client Component é renderizado com `displayStatus === "ready"`
- **THEN** a prop `campaignId` está disponível para montar a URL `/api/campaign/[campaignId]/publication-copy`

#### Scenario: Ready com publication copy e badge Editado

- **WHEN** `displayStatus` é `"ready"` e `isPublicationCopyEdited` é `true`
- **THEN** exibe imagem, caption + hashtags + cta_post, badge "Editado" ao lado do título, e botão "Editar"

#### Scenario: Ready sem badge Editado

- **WHEN** `displayStatus` é `"ready"` e `isPublicationCopyEdited` é `false`
- **THEN** exibe imagem, caption + hashtags + cta_post do snapshot, sem badge "Editado", e botão "Editar"

#### Scenario: Botão Editar entra em modo edição

- **WHEN** usuário clica "Editar"
- **THEN** caption vira textarea, hashtags vira textarea (uma por linha), cta vira input, todos preenchidos com valores atuais

#### Scenario: Botão Salvar chama PATCH e atualiza UI

- **WHEN** usuário clica "Salvar" com dados válidos
- **THEN** PATCH é chamado → se 200, estado local atualiza → volta ao modo visualização com novos dados

#### Scenario: Botão Restaurar original com confirmação

- **WHEN** usuário clica "Restaurar original"
- **THEN** confirmação "Restaurar texto original da IA?" → se sim, PATCH com `{ restore: true }` → resposta retorna snapshot → UI atualiza com snapshot → volta ao modo visualização

#### Scenario: Botão Cancelar descarta alterações

- **WHEN** usuário clica "Cancelar"
- **THEN** descarta alterações locais, volta ao modo visualização sem chamar API

### Requirement: Estados de loading e erro no salvamento

O sistema SHALL adicionar estados de loading e erro durante a operação de salvamento.

#### Scenario: Loading durante requisição

- **WHEN** requisição PATCH está em andamento
- **THEN** botões "Salvar" e "Restaurar" estão desabilitados com texto "Salvando..."

#### Scenario: Erro após falha do PATCH

- **WHEN** requisição PATCH retorna erro
- **THEN** exibe toast/aviso "Não foi possível salvar. Tente novamente."
- **AND** modo edição é mantido com dados não salvos

### Requirement: Estado generating

Quando `displayStatus === "generating"`, o Client Component SHALL exibir:
- Spinner/loader animado
- Mensagem "Sua campanha está sendo gerada..."
- Polling automático: `router.refresh()` a cada 5 segundos
- O polling SHALL parar quando o componente for desmontado (cleanup no `useEffect`)

#### Scenario: Generating com polling

- **WHEN** `displayStatus` é `"generating"`
- **THEN** exibe spinner + mensagem + inicia polling a cada 5s via `router.refresh()`

### Requirement: Estado stale generating

Quando `displayStatus === "stale"`, o Client Component SHALL exibir:
- Mensagem "Geração interrompida. Tente novamente."
- CTA "Criar Nova Campanha" que navega para `/`

O cálculo de stale é feito server-side em `page.tsx` usando `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000` — o Client Component apenas consome o valor pré-computado `displayStatus`.

#### Scenario: Stale generating exibido como erro

- **WHEN** `displayStatus` é `"stale"`
- **THEN** exibe mensagem de geração interrompida + link para nova campanha

### Requirement: Estado error

Quando `displayStatus === "error"`, o Client Component SHALL exibir:
- Mensagem amigável explicando que a geração falhou
- CTA "Criar Nova Campanha" que navega para `/`
- Não exibir imagem, caption ou botão de download

#### Scenario: Erro com mensagem

- **WHEN** `displayStatus` é `"error"`
- **THEN** exibe mensagem de falha + CTA para criar nova campanha

### Requirement: Design tokens applied

All inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes in the migrated campaign page SHALL be replaced with design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`).

#### Scenario: Tokens replace raw Tailwind colors

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens instead of raw Tailwind color classes

### Requirement: Navigation links updated

The navigation links in the campaign page SHALL be updated:
- Link "← Campanhas" SHALL point to `/campanhas` (instead of `/minhas-campanhas`)

#### Scenario: Link "← Campanhas" presente na página individual

- **WHEN** um usuário acessa `/campanhas/[id]`
- **THEN** o topo da página exibe um link "← Campanhas" apontando para `/campanhas`

### Requirement: Middleware matcher

O sistema SHALL incluir `/campanhas/:path*` no `config.matcher` em `src/middleware.ts` para garantir que a sessão seja renovada via `updateSession` ao acessar páginas de campanha. O antigo `/campanha/:path*` SHALL ser removido do matcher (redirecionado via next.config.ts).

#### Scenario: Matcher inclui /campanhas/:path*

- **WHEN** o middleware é carregado
- **THEN** o `config.matcher` inclui `/campanhas/:path*`

### Requirement: Estado de revisão da arte (campanha pendente)

O sistema SHALL, quando a campanha está `ready` e o estado de aprovação é **`pending`** (flag `campaign_approval_enabled` ligada, candidata nova sem aprovação), renderizar a **tela de revisão** em vez da entrega:

- O Server Component (`/campanhas/[id]/page.tsx`) SHALL, para campanhas `ready`: ler `isCampaignApprovalEnabled()` + `listArtVersions(id)`, derivar `computeApprovalState(campaign, versions, flagEnabled)` e passar `candidateImageUrl`/`candidateVersionId` (da **candidata ativa** — `asset_status='active'`) via props (base F37.1).
- A revisão SHALL exibir a arte da candidata ativa **sem** botão de download e **sem** Kit de Publicação/copy.
- **Dois botões (F37.2, R1):** botão primário **[Aprovar arte]** (dispara `POST /api/campaign/[id]/approve` com o `versionId` da candidata) e botão secundário **[Informar problema]** (abre o modal de relato — capability `campaign-problem-report`) quando a candidata é a **v1** e ainda há oportunidade; ao aprovar, `router.refresh()` → a página passa a exibir a entrega.
- **V2 candidata (F37.2, R5):** quando a v2 é a candidata (`pending`, v1 `superseded`), a revisão exibe **[Aprovar arte]** aprovando a **v2**, **sem** [Informar problema] e **sem** retorno à v1.
- **Sem histórico recuperável (decisão 12):** apenas a candidata ativa é exibida; nenhuma versão anterior é selecionável/recuperável.
- Microcopy PT-BR, estados de loading/erro, touch ≥ 44px, a11y, tema dark (tokens `#020617`/`#F8FAFC`/`#22C55E`), imagem sem recorte (`object-contain`).

#### Scenario: Campanha pendente exibe revisão sem download/copy

- **WHEN** uma campanha `ready` com estado de aprovação `pending` é aberta
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

### Requirement: Estado regenerating com progresso da v2

O sistema SHALL renderizar um estado dedicado quando `computeApprovalState` deriva **`regenerating`** (candidata ativa com `correction_in_progress=true` — RPC de consumo marcou; F37.2 R3/R7):

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
