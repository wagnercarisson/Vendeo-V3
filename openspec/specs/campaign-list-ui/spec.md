# Campaign List UI

> Synced from `fase-16-minhas-campanhas` (ADDED), then `fase-18-app-shell-ui-base-rotas` (MODIFIED). Route migrated from `/minhas-campanhas` to `/campanhas`. No-store redirect updated to `/loja`. Links updated. AuthHeader link and old back link removed (replaced by App Shell sidebar navigation).

## Requirements

### Requirement: Server Component com auth e ownership

O Server Component em `src/app/(app)/campanhas/page.tsx` SHALL:
- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, fazer `redirect("/loja")`
- Chamar `listCampaigns(storeId)` para carregar as campanhas da loja via RLS
- Passar os dados serializáveis para o Client Component: `campaigns: CampaignListItem[]`

#### Scenario: Usuário autenticado acessa /campanhas

- **WHEN** um usuário autenticado com loja acessa `/campanhas`
- **THEN** o Server Component carrega a lista de campanhas e renderiza o Client Component

#### Scenario: Usuário autenticado sem loja

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas`
- **THEN** é redirecionado para `/loja`

#### Scenario: Usuário não autenticado

- **WHEN** um usuário não autenticado acessa `/campanhas`
- **THEN** o middleware redireciona para `/login`

### Requirement: Lista com cards de campanha

Quando `campaigns` tem 1+ itens, o Client Component SHALL exibir uma lista de cards, cada um contendo:
- Thumbnail da campanha (signed URL server-side ou placeholder)
- Nome do produto (`productName`)
- Data formatada como "dd/mm/aaaa"
- Status visual (`ready` ou `error`) com indicador
- Link "Abrir" → `/campanhas/[id]` (presente em todos os estados)
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
- CTA "Criar Primeira Campanha" que navega para `/campanhas/nova` (formulário de geração)

#### Scenario: Estado vazio com CTA

- **WHEN** `listCampaigns` retorna `[]`
- **THEN** a página exibe mensagem de estado vazio + CTA "Criar Primeira Campanha" com link para `/campanhas/nova`

### Requirement: Design tokens applied

All inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes in the migrated campaign list SHALL be replaced with design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`).

#### Scenario: Tokens replace raw Tailwind colors

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens instead of raw Tailwind color classes
