# Campaign Page UI

> Synced from `fase-17-edicao-publication-copy` (MODIFIED).

## Purpose

Server Component (`/campanha/[id]`) com autenticação, ownership via RLS, e Client Component com 4 estados visuais: ready, generating, error, stale generating.

## Requirements

### Requirement: Server Component com auth e ownership

O Server Component em `src/app/campanha/[id]/page.tsx` SHALL:
- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, fazer `redirect("/store")`
- Chamar `getCampaignForDisplay(id)` para carregar a campanha via RLS
- Se `getCampaignForDisplay` retornar `null`, chamar `notFound()`
- Calcular `displayStatus` server-side: `"ready"` | `"generating"` | `"stale"` | `"error"` usando `campaign.status` e `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000` para detectar stale
- Pré-computar `downloadUrl = "/api/campaign/${id}/download"` para o Client Component não precisar montar URLs
- Passar os dados da campanha para o Client Component como props serializáveis, incluindo `displayStatus`, `downloadUrl` e `updatedAt`

#### Scenario: Usuário autenticado acessa campanha própria

- **WHEN** um usuário autenticado acessa `/campanha/{id}` onde `id` é uma campanha da sua loja
- **THEN** o Server Component carrega a campanha e renderiza o Client Component com os dados

#### Scenario: Usuário autenticado sem loja

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanha/{id}`
- **THEN** é redirecionado para `/store`

#### Scenario: Campanha não encontrada ou de outro tenant

- **WHEN** um usuário autenticado acessa `/campanha/{id}` onde `id` não existe ou pertence a outra loja
- **THEN** `notFound()` é chamado → página 404

#### Scenario: Usuário não autenticado

- **WHEN** um usuário não autenticado acessa `/campanha/{id}`
- **THEN** o middleware redireciona para `/login` (ou o `requirePageUser` retorna 401)

### Requirement: Estado ready com edição de publication copy

Quando `displayStatus === "ready"`, o Client Component SHALL exibir:
- A imagem final da campanha (src da signed URL gerada server-side — `imageUrl` passada como prop)
- O nome do produto
- A data de criação formatada
- Botão "Baixar Original" que linka para `downloadUrl` (pré-computado server-side)

O Client Component SHALL receber `campaignId: string` como prop para montar a URL do PATCH.

**Kit de Publicação (seção separada):**
- Título "Kit de Publicação" com badge "Editado" ao lado se `isPublicationCopyEdited` é `true`
- Caption, hashtags, cta_post em modo visualização (padrão) com botão "✏️ Editar"

**Modo edição (após clicar "Editar"):**
- Caption: textarea preenchido com valor atual
- Hashtags: textarea "uma por linha" (normalizado como array no save)
- CTA: input preenchido com valor atual
- Botão "💾 Salvar" — chama PATCH para `/api/campaign/[campaignId]/publication-copy` usando a prop `campaignId`
- Botão "↩️ Restaurar original" — confirmação → PATCH `{ restore: true }` para mesma URL
- Botão "Cancelar" — descarta alterações locais, volta ao modo visualização

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

### Requirement: Middleware matcher

O sistema SHALL adicionar `/campanha/:path*` ao `config.matcher` em `src/middleware.ts` para garantir que a sessão seja renovada via `updateSession` ao acessar páginas de campanha.

#### Scenario: Matcher inclui campanha

- **WHEN** o middleware é carregado
- **THEN** o `config.matcher` inclui `/campanha/:path*`
