# Phase 21: Histórico e Busca — Context

**Gathered:** 2026-07-14
**Status:** Ready for planning
**Source:** OpenSpec (openspec/changes/2026-07-14-fase-21-historico-busca/)

<domain>
## Phase Boundary

Phase 21 evolui a página `/campanhas` de uma lista plana com `limit(50)` fixo para uma listagem completa com busca textual, filtros por status e data, ordenação, paginação page-based e URL state compartilhável. O contrato `listCampaigns(storeId)` ganha parâmetros de consulta com `ListCampaignsParams` e retorna `ListCampaignsResult` com paginação. Adiciona `countCampaignsFiltered` para contagem com filtros.

**O que NÃO faz:** `generating` na listagem histórica, range picker de data (calendário), ordenação por status na UI, API route `/api/campaigns`, export em lote/seleção múltipla/comparação, mobile hardening, thumbnails no dashboard, índice GIN trigram, i18n/billing/múltiplas lojas, campos novos na tabela campaigns, alterações em middleware/API routes/next.config/metrics.ts.
</domain>

<decisions>
## Implementation Decisions

### D1 — Contrato de `listCampaigns`
CONFIRMADO. `listCampaigns(storeId, params?)` com `ListCampaignsParams` e `ListCampaignsResult`. Paginação page-based via `.range()`. Busca textual ILIKE. Filtro de status `.in()`. Filtro de data `.gte()/.lte()`. Ordenação `.order()`. Defaults: page=1, pageSize=10, status=["ready","error"], sortBy="created_at", sortOrder="desc". `countCampaignsFiltered` separada com `.select("*", { count: "exact", head: true })` sem `.range()`. Quebra de compatibilidade controlada: retorno muda de `CampaignListItem[]` para `ListCampaignsResult`.

### D2 — `parseCampaignListSearchParams`
CONFIRMADO. Função em `src/lib/campaign/search-params.ts` que normaliza e valida query params da URL. `pageSize` sempre 10 (fixo). Validação de cada campo contra whitelist. Date presets resolvidos para `dateFrom`/`dateTo` ISO.

### D3 — `Pagination` como componente compartilhado
CONFIRMADO. `src/components/ui/pagination.tsx` com `currentPage`, `totalPages`, `onPageChange`. Layout com elipse para muitos pages. Usa `Button` da F18.

### D4 — SSR via `searchParams` (data flow)
CONFIRMADO. Server Component lê `searchParams` como Promise (Next.js 15), chama `parseCampaignListSearchParams` + `listCampaigns`. Client Component faz `router.replace()` com novos searchParams ao mudar filtros. Sem API route nova.

### D5 — Status filter: sem `generating` em F21
CONFIRMADO. Listagem histórica mostra apenas `ready` e `error`.

### D6 — Filtro de data: presets, não range picker
CONFIRMADO. Presets: Todas (all), 7d, 30d, 90d, Este ano (year).

### D7 — Ordenação
CONFIRMADO. 4 opções: Mais recentes, Mais antigas, Nome A-Z, Nome Z-A.

### D8 — URL state
CONFIRMADO. Parâmetros com valor default omitidos da URL. `router.replace()` (não `push()`).

### D9 — Microcopy: novo empty state para busca sem resultado
CONFIRMADO. `CAMPAIGNS_SEARCH_EMPTY` em `microcopy.ts`. Exibido quando `items.length === 0 && filtros ativos`.

### D10 — Debounce: hook reutilizável
CONFIRMADO. `useDebounce<T>(value, delay)` em `src/hooks/use-debounce.ts`. Sem dependências externas.

### D11 — Três planos de execução
CONFIRMADO.

| Plano | O quê | Arquivos |
|-------|-------|----------|
| **21-01** | Query Contract | `src/lib/campaign/list.ts` (evoluir contrato paginação/range/busca/filtros/ordenação + `countCampaignsFiltered`) + `src/lib/campaign/search-params.ts` (criar `parseCampaignListSearchParams`) + testes (12+) |
| **21-02** | URL State + Filtros | `src/app/(app)/campanhas/page.tsx` (SSR com searchParams) + `client.tsx` (refatorar: busca+filtros+debounce+empty states) + `src/hooks/use-debounce.ts` + `microcopy.ts` (adicionar `CAMPAIGNS_SEARCH_EMPTY`) + testes (8+) |
| **21-03** | Pagination + Acabamento | `src/components/ui/pagination.tsx` (criar componente) + `client.tsx` (integrar pagination) + testes pagination + mobile básico + typecheck/lint/build |
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec Source (source of truth)
- `openspec/changes/2026-07-14-fase-21-historico-busca/design.md` — All design decisions D1-D11
- `openspec/changes/2026-07-14-fase-21-historico-busca/tasks.md` — Task breakdown for all 3 plans
- `openspec/changes/2026-07-14-fase-21-historico-busca/specs/list-contract-update/spec.md` — Specs for ListCampaignsParams, ListCampaignsResult, listCampaigns, countCampaignsFiltered
- `openspec/changes/2026-07-14-fase-21-historico-busca/specs/search-params-validation/spec.md` — Specs for parseCampaignListSearchParams and validation rules
- `openspec/changes/2026-07-14-fase-21-historico-busca/specs/campaign-list-search-ui/spec.md` — Specs for SSR, client component, filters, empty states, URL state
- `openspec/changes/2026-07-14-fase-21-historico-busca/specs/pagination-component/spec.md` — Specs for Pagination component
- `openspec/changes/2026-07-14-fase-21-historico-busca/specs/use-debounce-hook/spec.md` — Specs for useDebounce hook

### Current Source Files (to be modified)
- `src/lib/campaign/list.ts` — Current `listCampaigns(storeId)` with `limit(50)`, to be evolved with params/result/countCampaignsFiltered
- `src/lib/campaign/types.ts` — `CampaignStatus` type
- `src/app/(app)/campanhas/page.tsx` — Current SSR page without searchParams; to gain SSR pagination + search params
- `src/app/(app)/campanhas/client.tsx` — Current simple client list; to be refactored with filters, search, pagination
- `src/lib/onboarding/microcopy.ts` — To add `CAMPAIGNS_SEARCH_EMPTY` constant

### Phase 18 Dependencies (UI Components)
- `src/components/ui/button.tsx` — Button component for Pagination
- `src/components/ui/card.tsx` — Card component
- `src/components/ui/page-header.tsx` — PageHeader component
- `src/components/ui/badge.tsx` — Badge component for campaign status
- `src/components/ui/empty-state.tsx` — EmptyState component

### Phase 19 Dependencies (Onboarding/Empty States)
- `.planning/phases/19-onboarding-estados-vazios/19-CONTEXT.md` — Onboarding states, microcopy, empty states
- `src/lib/onboarding/state.ts` — `getUserOnboardingState` (preserved, unchanged)
- `src/lib/onboarding/microcopy.ts` — `CAMPAIGNS_NO_STORE`, `CAMPAIGNS_NO_CAMPAIGNS` (preserved)

### Phase 20 Dependencies
- `src/lib/campaign/metrics.ts` — Metrics module (unchanged)
- `src/lib/onboarding/count.ts` — Reexport (unchanged)

### Auth & Ownership Patterns
- `src/lib/auth/require-user.ts` — `requirePageUser()` pattern
- `src/lib/auth/store-ownership.ts` — `getCurrentStore()` pattern
- `src/lib/supabase/server.ts` — `createServerClient()` pattern

### Existing Test Files (to be refactored)
- `src/__tests__/lib/campaign/list.test.ts` — Current list tests with mock chain; to be refactored for new contract
- `src/__tests__/app/campanhas/campanhas-page.test.tsx` — Current page tests; to be refactored for SSR with searchParams
</canonical_refs>

<specifics>
## Specific Ideas

### ListContract Update
```typescript
export interface ListCampaignsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: Array<"ready" | "error">;
  dateFrom?: string;
  dateTo?: string;
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

export async function countCampaignsFiltered(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<number>
```

### Data Flow
```
URL (/campanhas?q=tenis&status=ready&date=90d&page=2)
  │
  ▼
CampanhasPage (Server Component, async)
  ├── const params = await searchParams
  ├── const user = await requirePageUser()
  ├── const store = await getCurrentStore(user.userId)
  ├── if (!store) → <EmptyState /> (F19)
  ├── const searchParams = parseCampaignListSearchParams(params)
  ├── const result = await listCampaigns(store.id, { ...searchParams })
  └── <CampaignListClient result={result} searchParams={searchParams} />
        │
        ▼
      CampaignListClient ("use client")
        ├── Search input + useDebounce (300ms)
        ├── Status chips (Todas/Prontas/Erro)
        ├── Date preset dropdown
        ├── Sort dropdown (4 options)
        ├── Campaign cards with thumbnails
        ├── Pagination (when totalPages > 1)
        └── onChange → router.replace()
```

### Empty States
| Condição | Empty State | Fonte |
|----------|-------------|-------|
| `!store` | "Configure sua loja" | F19 preserved |
| `items.length === 0 && sem filtros ativos` | "Nenhuma campanha ainda" | F19 preserved |
| `items.length === 0 && com filtros ativos` | "Nenhuma campanha encontrada" | F21 new |

### Pagination Layout
```
<< Anterior   1  2  3  ...  30  Próximo >>
```
</specifics>

<deferred>
## Deferred Ideas

- `generating` na listagem histórica — estado transitório fora do escopo
- Range picker de data (calendário) — presets atendem; range picker pode ser adicionado no futuro sem quebrar contrato
- Ordenação por status na UI — suportado no contrato, não exposto em F21
- API route `/api/campaigns` — SSR puro via searchParams
- Export em lote, seleção múltipla, comparação entre campanhas
- Mobile hardening (focus trap, prefers-reduced-motion, touch targets) — F22
- Índice GIN trigram para busca textual — monitorar pós-F21
- i18n, billing, múltiplas lojas (1:N)
- Campos novos na tabela campaigns — nenhuma migration necessária
- Alterações em middleware, API routes, next.config, metrics.ts
</deferred>

---

*Phase: 21-historico-busca*
*Context gathered: 2026-07-14 via OpenSpec synthesis*
