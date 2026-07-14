# Campaign List Search UI

> Created for `fase-21-historico-busca`. Refatoração completa da página `/campanhas` com busca textual, filtros, paginação, URL state compartilhável e empty states adaptativos.

## Requirements

### Requirement: Server Component com searchParams

O Server Component em `src/app/(app)/campanhas/page.tsx` SHALL:

- Chamar `requirePageUser()` para garantir autenticação
- Chamar `getCurrentStore(user.userId)` para resolver a loja do usuário
- Se `getCurrentStore()` retornar `null`, renderizar `<EmptyState>` com `CAMPAIGNS_NO_STORE` (F19, inalterado)
- Ler `searchParams` como `Promise` (Next.js 15 — `const params = await searchParams`)
- Chamar `parseCampaignListSearchParams(params)` para normalizar, validar e resolver query params (incluindo datePreset → `dateFrom`/`dateTo` ISO)
- Chamar `listCampaigns(store.id, { page, pageSize, search, status, dateFrom, dateTo, sortBy, sortOrder })`
- Passar `ListCampaignsResult` + searchParams atuais para o Client Component

#### Scenario: SSR sem searchParams

- **WHEN** usuário acessa `/campanhas` sem parâmetros
- **THEN** chama `listCampaigns` com todos os defaults (page=1, pageSize=10, status=ready+error, sort=created_at desc)

#### Scenario: SSR com searchParams

- **WHEN** usuário acessa `/campanhas?q=tenis&status=ready&date=90d&page=2`
- **THEN** chama `listCampaigns` com search="tenis", status=["ready"], dateFrom/dateTo calculados, page=2

### Requirement: Client Component com busca, filtros e paginação

O Client Component em `src/app/(app)/campanhas/client.tsx` SHALL:

- Receber `items: CampaignListItem[]`, `total: number`, `page: number`, `totalPages: number`, e os searchParams atuais
- Renderizar `<PageHeader title="Campanhas" />` (F18)
- Renderizar campo de busca textual com `useDebounce` (300ms)
- Renderizar chips de status: Todas | Prontas | Erro
- Renderizar dropdown de date preset: Todas | 7 dias | 30 dias | 90 dias | Este ano
- Renderizar dropdown de ordenação: Mais recentes | Mais antigas | Nome A-Z | Nome Z-A
- Renderizar lista de campanhas com cards (mantido de F16/F18)
- Renderizar `<Pagination>` abaixo da lista quando `totalPages > 1`
- Ao mudar qualquer filtro, chamar `router.replace()` com novos searchParams
- Parâmetros com valor default NÃO aparecem na URL

#### Scenario: URL update ao buscar

- **WHEN** usuário digita "tenis" no campo de busca
- **THEN** após 300ms de debounce, `router.replace("/campanhas?q=tenis")` é chamado
- **AND** parâmetros default (`page=1`, `sort=created_at`, `order=desc`, `date=all`, `status=ready,error`) NÃO aparecem na URL

#### Scenario: Chip de status altera URL

- **WHEN** usuário clica em "Prontas"
- **THEN** `router.replace("/campanhas?status=ready")` é chamado

#### Scenario: Date preset altera URL

- **WHEN** usuário seleciona "90 dias"
- **THEN** `router.replace("/campanhas?date=90d")` é chamado

#### Scenario: Ordenação altera URL

- **WHEN** usuário seleciona "Nome A-Z"
- **THEN** `router.replace("/campanhas?sort=product_name&order=asc")` é chamado

#### Scenario: Múltiplos filtros combinados

- **WHEN** usuário busca "tenis" com status "ready" e data "90d" na página 2
- **THEN** URL é `/campanhas?q=tenis&status=ready&date=90d&page=2`

### Requirement: Empty states adaptativos

O Client Component SHALL exibir empty states condicionais:

| Condição | Empty State | Fonte |
|----------|-------------|-------|
| `items.length === 0` E sem filtros ativos | `CAMPAIGNS_NO_CAMPAIGNS` (F19) | `microcopy.ts` |
| `items.length === 0` E com filtros ativos | `CAMPAIGNS_SEARCH_EMPTY` (novo F21) | `microcopy.ts` |

#### Scenario: Empty state sem filtros

- **WHEN** `listCampaigns` retorna items vazio e não há filtros ativos
- **THEN** exibe "Nenhuma campanha ainda" + CTA "Criar primeira campanha" (F19)

#### Scenario: Empty state com busca sem resultado

- **WHEN** `listCampaigns` retorna items vazio e há `q` ou filtros ativos
- **THEN** exibe "Nenhuma campanha encontrada" + descrição "Tente ajustar sua busca ou limpar os filtros"

### Requirement: URL compartilhável

O sistema SHALL manter a URL como fonte da verdade:

- `router.replace()` (não `router.push()`) — substitui o histórico, não acumula entries
- Parâmetros default omitidos da URL
- URL completa: `/campanhas?q=tenis&status=ready&date=90d&page=2&sort=created_at&order=desc`

#### Scenario: URL reproduzível

- **WHEN** usuário copia a URL `/campanhas?q=tenis&status=ready&date=90d&page=2`
- **THEN** ao colar em nova aba, o Server Component lê os searchParams e reproduz exatamente a mesma busca

### Requirement: Preservação de estados F18/F19

O sistema SHALL preservar todos os estados existentes:

- Usuário não autenticado → middleware redireciona para `/login` (inalterado)
- Usuário sem loja → empty state "Configure sua loja" + CTA `/loja` (F19, inalterado)
- Loja sem campanhas e sem filtros → empty state "Nenhuma campanha ainda" + CTA `/campanhas/nova` (F19, inalterado)
