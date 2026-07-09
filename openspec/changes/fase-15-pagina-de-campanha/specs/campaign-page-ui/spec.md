# Campaign Page UI

> Part of `fase-15-pagina-de-campanha` (ADDED).

## Purpose

Server Component (`/campanha/[id]`) com autenticação, ownership via RLS, e Client Component com 4 estados visuais: ready, generating, error, stale generating.

## ADDED Requirements

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

### Requirement: Estado ready

Quando `displayStatus === "ready"`, o Client Component SHALL exibir:
- A imagem final da campanha (src da signed URL gerada server-side — `imageUrl` passada como prop)
- O nome do produto
- A data de criação formatada
- O kit de publicação: caption, hashtags (como tags clicáveis ou texto), cta_post
- Botão "Baixar Original" que linka para `downloadUrl` (pré-computado server-side)

#### Scenario: Ready com publication copy completo

- **WHEN** `displayStatus` é `"ready"` com todos os campos de `publication_copy_snapshot` preenchidos
- **THEN** exibe imagem, caption, hashtags, cta_post e botão de download

#### Scenario: Ready sem publication copy

- **WHEN** `displayStatus` é `"ready"` mas `publication_copy_snapshot` é null
- **THEN** exibe imagem e botão de download; caption aparece como vazio, hashtags como vazio, cta_post como vazio

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
