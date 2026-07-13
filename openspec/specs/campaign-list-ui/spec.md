# Campaign List UI

> Synced from `fase-16-minhas-campanhas` (ADDED), then `fase-18-app-shell-ui-base-rotas` (MODIFIED), then `fase-19-onboarding-estados-vazios` (MODIFIED + REMOVED). Route migrated from `/minhas-campanhas` to `/campanhas`. No-store redirect replaced by empty state with CTA. Microcopy centralized in `microcopy.ts`. Links updated. AuthHeader link and old back link removed (replaced by App Shell sidebar navigation).

## Requirements

### Requirement: Server Component com auth e ownership

O Server Component em `src/app/(app)/campanhas/page.tsx` SHALL:
- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, renderizar empty state "Configure sua loja" com CTA → `/loja` (NÃO redirecionar)
- Chamar `listCampaigns(storeId)` para carregar as campanhas da loja via RLS
- Passar os dados serializáveis para o Client Component: `campaigns: CampaignListItem[]`

#### Scenario: Usuário autenticado acessa /campanhas

- **WHEN** um usuário autenticado com loja acessa `/campanhas`
- **THEN** o Server Component carrega a lista de campanhas e renderiza o Client Component

#### Scenario: Usuário autenticado sem loja vê empty state

- **WHEN** um usuário autenticado mas sem loja associada acessa `/campanhas`
- **THEN** o sistema SHALL renderizar um empty state com título "Configure sua loja" e descrição "Suas campanhas aparecerão aqui depois que você configurar sua loja."
- **AND** um CTA "Configurar loja" SHALL linkar para `/loja`
- **AND** o sistema SHALL NÃO redirecionar para `/loja`

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
- Mensagem "Nenhuma campanha ainda"
- Texto explicativo "Crie sua primeira campanha e ela aparecerá aqui."
- CTA "Criar primeira campanha" que navega para `/campanhas/nova`
- Toda microcopy SHALL ser referenciada de `src/lib/onboarding/microcopy.ts` (`CAMPAIGNS_NO_CAMPAIGNS`)

#### Scenario: Estado vazio com CTA e microcopy centralizada

- **WHEN** `listCampaigns` retorna `[]`
- **THEN** a página exibe mensagem de estado vazio "Nenhuma campanha ainda" + CTA "Criar primeira campanha" com link para `/campanhas/nova`
- **AND** os textos SHALL vir da constante `CAMPAIGNS_NO_CAMPAIGNS` em `microcopy.ts`

### Requirement: Design tokens applied

All inline `slate-*`, `blue-*`, `red-*`, `gray-*`, `green-*` classes in the migrated campaign list SHALL be replaced with design tokens (`bg-bg-*`, `text-text-*`, `accent-*`, `border-*`).

#### Scenario: Tokens replace raw Tailwind colors

- **WHEN** the page renders any UI element
- **THEN** it SHALL use design tokens instead of raw Tailwind color classes
