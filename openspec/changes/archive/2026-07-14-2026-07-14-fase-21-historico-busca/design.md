## Context

O Vendeo pós-F20 tem dashboard funcional (saudação, métricas, recentes, próximo passo adaptativo), 651 testes passando, app shell com sidebar+topbar+drawer mobile, 7 componentes base de UI, onboarding com 3 estados (`no_store`, `has_store_no_campaigns`, `has_store_with_campaigns`), microcopy centralizada. O contrato `listCampaigns(storeId)` ainda tem `limit(50)` fixo sem parâmetros de consulta. A página `/campanhas` é uma lista plana sem busca, sem filtros, sem paginação, sem URL state compartilhável.

Dependências: F18 (app shell, componentes base — Card, Badge, PageHeader, EmptyState, Input, Button), F19 (empty states, microcopy `CAMPAIGNS_NO_STORE`, `CAMPAIGNS_NO_CAMPAIGNS`), F20 (listCampaigns, CampaignListItem, generateBatchThumbnailUrls, dashboard), F12-F17 (campanhas, tipos, persistência).

## Goals / Non-Goals

**Goals:**
- `listCampaigns(storeId, params?)` com `ListCampaignsParams` e `ListCampaignsResult` — paginação page-based via `.range()`, busca textual ILIKE, filtro de status `.in()`, filtro de data `.gte()/.lte()`, ordenação `.order()`
- `countCampaignsFiltered(storeId, params?)` com `.select("*", { count: "exact", head: true })` e mesmos filtros (exceto paginação)
- Remover `limit(50)` fixo — pageSize default 10, passado via params
- `parseCampaignListSearchParams(raw)` para normalização e validação de query params URL
- Página `/campanhas` SSR com searchParams (Next.js 15 — `searchParams` é Promise)
- Busca textual com debounce 300ms via `useDebounce`
- Chips de status: Todas / Prontas / Erro
- Date presets: 7d / 30d / 90d / Este ano / Todas
- Ordenação: 4 opções (data ↓, data ↑, nome A-Z, nome Z-A)
- Paginação numerada com << 1 2 3 ... >> (componente `Pagination`)
- URL state compartilhável — parâmetros default omitidos
- Empty state `CAMPAIGNS_SEARCH_EMPTY` para busca sem resultado
- Componente `Pagination` em `src/components/ui/pagination.tsx`
- Hook `useDebounce` em `src/hooks/use-debounce.ts`
- Estados `no_store` e `no_campaigns` da F19 preservados
- 25+ novos testes
- SSR puro via searchParams — sem API route nova

**Non-Goals:**
- `generating` na listagem histórica (D4 — estado transitório)
- Range picker de data (calendário) — D5 (presets atendem)
- Ordenação por status na UI — D6 (suportado no contrato, não exposto)
- API route `/api/campaigns` — D3 (SSR puro)
- Export em lote, seleção múltipla, comparação entre campanhas — fora da v1.4
- Mobile hardening (focus trap, prefers-reduced-motion, touch targets) — F22
- Thumbnails no dashboard — mantido sem thumbnails (D3 da F20)
- Índice GIN trigram para busca textual — monitorar pós-F21
- i18n, billing, múltiplas lojas (1:N) — fora da v1.4
- Campos novos na tabela campaigns — nenhuma migration necessária
- Alterações em middleware, API routes, next.config, metrics.ts

## Decisions

### D1 — Contrato de `listCampaigns`

`CONFIRMADO`

```typescript
export interface ListCampaignsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: Array<"ready" | "error">;
  dateFrom?: string;       // ISO string
  dateTo?: string;         // ISO string
  sortBy?: "created_at" | "product_name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface ListCampaignsResult {
  items: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listCampaigns(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<ListCampaignsResult>
```

**Defaults:**

| Parâmetro | Default | Motivo |
|-----------|---------|--------|
| `page` | 1 | Primeira página |
| `pageSize` | 10 | Controla signed URLs por página (10 thumbnails máx) |
| `search` | `undefined` | Sem busca — retorna todos |
| `status` | `["ready", "error"]` | Mesmo filtro atual, não mostra `generating` |
| `dateFrom`/`dateTo` | `undefined` | Sem filtro de data |
| `sortBy` | `"created_at"` | Ordem cronológica |
| `sortOrder` | `"desc"` | Mais recentes primeiro |

**Paginação:** `.range((page - 1) * pageSize, page * pageSize - 1)` do Supabase JS.

**Contagem com filtros:** `listCampaigns` obtém o total via `count: "exact"` na mesma query de `.select()` — o Supabase JS retorna o total de registros correspondentes aos filtros independentemente do `.range()`, eliminando a necessidade de uma segunda query.

`countCampaignsFiltered` permanece exportada como utilitário público para cenários futuros que precisem apenas da contagem sem os dados:

```typescript
export async function countCampaignsFiltered(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<number>
```

Usa `.select("*", { count: "exact", head: true })` com os mesmos filtros (exceto paginação).

**Decisão:** `listCampaigns` usa count inline por eficiência (1 query em vez de 2). `countCampaignsFiltered` mantida como utilitário público futuro.

**Search:** `ILIKE` na coluna `product_name`:
```typescript
if (params.search) {
  query = query.ilike("product_name", `%${params.search}%`);
}
```

**Filtro de data:** `datePreset` resolvido pelo `parseCampaignListSearchParams` para `dateFrom`/`dateTo` ISO — o parser centraliza validação e resolução. O contrato aceita `dateFrom`/`dateTo` para flexibilidade futura. A UI expõe apenas presets.

```typescript
const presetMap = {
  "7d":   { days: 7 },
  "30d":  { days: 30 },
  "90d":  { days: 90 },
  "year": { type: "calendar_year" },
  "all":  null, // sem filtro
};
```

**Quebra de compatibilidade:** `listCampaigns` muda de `Promise<CampaignListItem[]>` para `Promise<ListCampaignsResult>`. Único caller relevante é `/campanhas/page.tsx` — será atualizado na F21. `metrics.ts` usa Supabase direto, não consome `listCampaigns`.

**Localização:** O contrato evolui em `src/lib/campaign/list.ts`. `parseCampaignListSearchParams` fica em `src/lib/campaign/search-params.ts` para evitar que `list.ts` cresça demais.

### D2 — `parseCampaignListSearchParams`

`CONFIRMADO`

```typescript
interface ValidatedSearchParams {
  page: number;
  pageSize: number;
  q: string | undefined;
  status: Array<"ready" | "error">;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  sortBy: "created_at" | "product_name";
  sortOrder: "asc" | "desc";
}

function parseCampaignListSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ValidatedSearchParams
```

**Regras de validação:**
- `page`: inteiro ≥ 1; inválido → default 1
- `q`: string, `.trim()` aplicado, limite de 100 caracteres; vazio → `undefined`
- `status`: split por `,`, cada valor validado contra whitelist `["ready", "error"]`; valores fora da whitelist ignorados; array vazio → default `["ready", "error"]`
- `date`: validado contra whitelist `["7d", "30d", "90d", "year", "all"]`; inválido → `"all"`; `"all"` → `dateFrom`/`dateTo` = `undefined`; caso contrário resolve para ISO string
- `sort`: validado contra whitelist `["created_at", "product_name"]`; `"status"` rejeitado (contrato apenas); inválido → `"created_at"`
- `order`: validado contra whitelist `["asc", "desc"]`; inválido → `"desc"`

**Nota:** `ValidatedSearchParams.sortBy` NÃO inclui `"status"` — status é suporte interno/futuro do contrato (`ListCampaignsParams.sortBy` aceita `"status"`), não é URL/UI pública ainda em F21.

**Motivo:** Centraliza validação e evita que URL inválida quebre query Supabase. Separado em `search-params.ts` para coesão.

### D3 — `Pagination` como componente compartilhado

`CONFIRMADO`

```typescript
// src/components/ui/pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
```

**Layout:**
```
<< Anterior   1  2  3  ...  30  Próximo >>
```

- Primeira página: "Anterior" desabilitado
- Última página: "Próximo" desabilitado
- Mostra páginas adjacentes com elipses para muitos pages (ex.: `1 2 3 ... 30`)
- Botões: usa `Button` da F18 com variante `ghost` para páginas, `secondary` para navegação
- Componente puro — sem estado interno, controlado pelo pai

**Motivo:** Componente pequeno (~40 linhas), reutilizável, e já tem uso imediato em `/campanhas`. Refatorar depois seria mais custoso que criar agora.

### D4 — SSR via `searchParams` (data flow)

`CONFIRMADO`

```
URL (/campanhas?q=tenis&status=ready&page=2)
  │
  ▼
CampanhasPage (Server Component, async)
  ├── await searchParams              ← Next.js 15: searchParams é Promise
  ├── const user = await requirePageUser()
  ├── const store = await getCurrentStore(user.userId)
  ├── if (!store) → <EmptyState /> (F19)
  ├── const searchParams = parseCampaignListSearchParams(params)
  ├── const result = await listCampaigns(store.id, {
  │     page: searchParams.page,
  │     pageSize: 10,
  │     search: searchParams.q,
  │     status: searchParams.status,
  │     dateFrom: searchParams.dateFrom,  // undefined se date="all"
  │     dateTo: searchParams.dateTo,      // undefined se date="all"
  │     sortBy: searchParams.sortBy,
  │     sortOrder: searchParams.sortOrder,
  │   })
  │
  └── <CampaignListClient
        items={result.items}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        searchParams={{ q: params.q, status: params.status, ... }}
      />
        │
        ▼
      CampaignListClient ("use client")
        ├── Renderiza busca + filtros + lista + paginação
        ├── onChange → router.replace(`/campanhas?${new URLSearchParams(...)}`)
        │               (navegação SSR via RSC streaming)
        └── useDebounce no search input (300ms)
```

**Sem API route nova.** Filtros mudam URL via `router.replace()` — Next.js faz streaming do server component.

### D5 — Status filter: sem `generating` em F21

`CONFIRMADO`

A listagem histórica mostra apenas campanhas com estado final:
- `ready` — campanha concluída com sucesso
- `error` — campanha com falha

`generating` é estado transitório (dura segundos durante a geração) e não entra no histórico.

**Impacto no contrato:** `status` default continua `["ready", "error"]`. O tipo do parâmetro reflete isso: `status?: Array<"ready" | "error">`.

### D6 — Filtro de data: presets, não range picker

`CONFIRMADO`

| Label | Valor | Descrição |
|-------|-------|-----------|
| Todas | `all` | Sem filtro de data |
| 7 dias | `7d` | Últimos 7 dias |
| 30 dias | `30d` | Últimos 30 dias |
| 90 dias | `90d` | Últimos 90 dias |
| Este ano | `year` | Desde 1º de janeiro do ano corrente |

Internamente, `datePreset` é resolvido pelo `parseCampaignListSearchParams` para `dateFrom`/`dateTo` ISO — o parser centraliza validação e resolução. O contrato aceita `dateFrom`/`dateTo` — range picker pode ser adicionado no futuro sem quebrar contrato.

### D7 — Ordenação

`CONFIRMADO`

| Label | sortBy | sortOrder |
|-------|--------|-----------|
| Mais recentes | `created_at` | `desc` |
| Mais antigas | `created_at` | `asc` |
| Nome A-Z | `product_name` | `asc` |
| Nome Z-A | `product_name` | `desc` |

Default: "Mais recentes" (`created_at desc`).

Ordenação por `status` é suportada no contrato (`sortBy` aceita `"status"`) mas NÃO exposta na UI da F21. Se houver demanda real, expor em fase posterior sem quebrar contrato.

### D8 — URL state

`CONFIRMADO`

```
/campanhas?q=tenis&status=ready&date=90d&page=2&sort=created_at&order=desc
```

| Parâmetro | Exemplo | Omissão |
|-----------|---------|---------|
| `q` | `q=tenis` | Sem busca |
| `status` | `status=ready` ou `status=ready,error` | Default (`ready,error`) |
| `date` | `date=90d` | `all` |
| `page` | `page=2` | `1` |
| `sort` | `sort=created_at` | `created_at` |
| `order` | `order=desc` | `desc` |

**URL limpa:** parâmetros com valor default NÃO aparecem na URL.

### D9 — Microcopy: novo empty state para busca sem resultado

`CONFIRMADO`

Adicionar em `src/lib/onboarding/microcopy.ts`:

```typescript
export const CAMPAIGNS_SEARCH_EMPTY: EmptyStateCopy = {
  icon: Search,
  title: "Nenhuma campanha encontrada",
  description:
    "Tente ajustar sua busca ou limpar os filtros para encontrar mais campanhas.",
};
```

**Nota:** Este empty state é específico para `campanhas.length === 0 && (params.search || params.status !== default || params.date !== "all")`. Quando não há filtros ativos, `CAMPAIGNS_NO_CAMPAIGNS` continua sendo usado.

### D10 — Debounce: hook reutilizável

`CONFIRMADO`

```typescript
// src/hooks/use-debounce.ts
export function useDebounce<T>(value: T, delay: number): T
```

Simples, sem dependências externas. Usa `useState` + `useEffect` com `setTimeout`. A busca em `/campanhas` usa 300ms.

### D11 — Três planos de execução

`CONFIRMADO`

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **21-01** | Query Contract | `src/lib/campaign/list.ts` (evoluir contrato, remover `limit(50)`, adicionar paginação/range, busca ILIKE, filtros, ordenação) + `src/lib/campaign/search-params.ts` (criar `parseCampaignListSearchParams`) + `countCampaignsFiltered` + `ListCampaignsParams` + `ListCampaignsResult` + testes do query builder + validação (12+) |
| **21-02** | URL State + Filtros | `src/app/(app)/campanhas/page.tsx` (ler `searchParams`, montar params, passar para client) + `src/app/(app)/campanhas/client.tsx` (refatorar: search input com debounce, chips de status, date preset, sort dropdown, empty states) + `src/hooks/use-debounce.ts` + `src/lib/onboarding/microcopy.ts` (adicionar `CAMPAIGNS_SEARCH_EMPTY`) + testes de interação (8+) |
| **21-03** | Pagination + Acabamento | `src/components/ui/pagination.tsx` (criar componente) + `src/app/(app)/campanhas/client.tsx` (integrar pagination na lista) + testes de paginação + mobile básico + typecheck/lint/build (5+) |

```
21-01 ──► 21-02 ──► 21-03
(contrato) (UI + URL) (pagination + testes)
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| `searchParams` é `Promise` no Next.js 15 — esquecer `await` | Documentado no contrato. Server component precisa de `const params = await searchParams` |
| `ILIKE` com `%term%` prefixado não usa índice B-tree padrão | Performance aceitável para ~312 registros/loja. Se necessário, criar índice GIN trigram em fase futura |
| URL state complexo de sincronizar com `router.replace` e debounce | `useDebounce` no valor do input antes de atualizar URL. Evita múltiplos replaces |
| `listCampaigns` é mockado em 2 test files (campanhas-page, list.test) | Ambos refatorados na F21. Mock pattern muda com novo contrato |
| Paginação no mobile com 30+ páginas | Componente `Pagination` usa elipse para muitos pages. Layout compacto |
| Conflito entre debounce e `router.replace` (request cancelado) | Debounce de 300ms + `router.replace` substitui entry no histórico. Next.js lida com race conditions |
| `countCampaignsFiltered` duplica lógica de filtros de `listCampaigns` | Aceitável — `listCampaigns` usa count inline por eficiência. `countCampaignsFiltered` mantida como utilitário público para cenários que precisem apenas da contagem. Extrair builder de filtros se houver terceiro uso |
