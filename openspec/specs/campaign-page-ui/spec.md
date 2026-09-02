# Campaign Page UI

> Synced from `fase-17-edicao-publication-copy` (MODIFIED), then `fase-18-app-shell-ui-base-rotas` (MODIFIED), then `fase-19-onboarding-estados-vazios` (MODIFIED + REMOVED), then `fase-37-1-approval-gate-candidata-unica` (ADDED — estado de revisão da arte, D2/decisões 3/12). Route migrated from `/campanha/[id]` to `/campanhas/[id]`. No-store redirect replaced by `notFound()`. Emoji icons replaced by Lucide. Kit de Publicação uses Card + Badge components. Navigation links updated.

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

> Added by `fase-37-1-approval-gate-candidata-unica` (D2, decisões 3/12).

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
