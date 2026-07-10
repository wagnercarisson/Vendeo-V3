# Campaign List UI

> Part of `fase-16-minhas-campanhas` (ADDED).

## Purpose

Server Component (`/minhas-campanhas`) com autenticação, ownership via RLS, e Client Component com lista de cards (thumbnail, nome, data, status, ações) + estado vazio com CTA. Inclui modificações de navegação: link no `AuthHeader`, link "← Minhas Campanhas" na página individual.

## ADDED Requirements

### Requirement: Server Component com auth e ownership

O Server Component em `src/app/minhas-campanhas/page.tsx` SHALL:
- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, fazer `redirect("/store")`
- Chamar `listCampaigns(storeId)` para carregar as campanhas da loja via RLS
- Passar os dados serializáveis para o Client Component: `campaigns: CampaignListItem[]`

#### Scenario: Usuário autenticado acessa minhas-campanhas

- **WHEN** um usuário autenticado com loja acessa `/minhas-campanhas`
- **THEN** o Server Component carrega a lista de campanhas e renderiza o Client Component

#### Scenario: Usuário autenticado sem loja

- **WHEN** um usuário autenticado mas sem loja associada acessa `/minhas-campanhas`
- **THEN** é redirecionado para `/store`

#### Scenario: Usuário não autenticado

- **WHEN** um usuário não autenticado acessa `/minhas-campanhas`
- **THEN** o middleware redireciona para `/login`

### Requirement: Lista com cards de campanha

Quando `campaigns` tem 1+ itens, o Client Component SHALL exibir uma lista de cards, cada um contendo:
- Thumbnail da campanha (signed URL server-side ou placeholder)
- Nome do produto (`productName`)
- Data formatada como "dd/mm/aaaa"
- Status visual (`ready` ou `error`) com indicador
- Link "Abrir" → `/campanha/[id]` (presente em todos os estados)
- Link "Baixar" → `/api/campaign/[id]/download` (**apenas** para `status === "ready"`)

#### Scenario: Lista com N campanhas

- **WHEN** `listCampaigns` retorna N campanhas (ready + error)
- **THEN** a página renderiza N cards com thumbnail, nome do produto, data, status, "Abrir". "Baixar" aparece apenas nos cards `ready`

#### Scenario: Card de campanha error sem Baixar

- **WHEN** um card tem `status === "error"`
- **THEN** exibe thumbnail placeholder, nome, data, status "error" com indicação visual, link "Abrir". Link "Baixar" está ausente

#### Scenario: Thumbnail placeholder para falha

- **WHEN** `thumbnailUrl` é `null` (campanha `error` ou signed URL falhou)
- **THEN** exibe placeholder visual no lugar da thumbnail

### Requirement: Estado vazio

Quando `campaigns` é array vazio, o Client Component SHALL exibir:
- Mensagem "Nenhuma campanha encontrada"
- Texto explicativo "Suas campanhas aparecerão aqui depois de geradas."
- CTA "Criar Primeira Campanha" que navega para `/` (formulário de geração)

#### Scenario: Estado vazio com CTA

- **WHEN** `listCampaigns` retorna `[]`
- **THEN** a página exibe mensagem de estado vazio + CTA "Criar Primeira Campanha" com link para `/`

### Requirement: Link "Minhas Campanhas" no AuthHeader

O `AuthHeader` (`src/components/auth/auth-header.tsx`) SHALL incluir um link "Minhas Campanhas" (`href="/minhas-campanhas"`) antes do `LogoutButton`, visível apenas para usuários autenticados.

#### Scenario: Header mostra link quando autenticado

- **WHEN** o usuário está autenticado
- **THEN** o `AuthHeader` renderiza o link "Minhas Campanhas" antes do botão "Sair"

#### Scenario: Header não mostra link quando não autenticado

- **WHEN** o usuário NÃO está autenticado
- **THEN** o `AuthHeader` não inclui o link "Minhas Campanhas"

### Requirement: Link "← Minhas Campanhas" na página individual

O Client Component em `src/app/campanha/[id]/client.tsx` SHALL exibir um link "← Minhas Campanhas" no topo da página, que navega para `/minhas-campanhas`.

#### Scenario: Link de volta presente na página individual

- **WHEN** um usuário acessa `/campanha/[id]`
- **THEN** o topo da página exibe um link "← Minhas Campanhas" apontando para `/minhas-campanhas`

### Requirement: Middleware matcher

O sistema SHALL adicionar `/minhas-campanhas` ao `config.matcher` em `src/middleware.ts` para garantir que a sessão seja renovada via `updateSession`.

#### Scenario: Matcher inclui minhas-campanhas

- **WHEN** o middleware é carregado
- **THEN** o `config.matcher` inclui `/minhas-campanhas`
