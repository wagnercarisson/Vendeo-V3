## Why

O histórico de campanhas em `/campanhas` é uma lista plana sem busca, sem filtros, sem paginação. O contrato `listCampaigns(storeId)` tem `limit(50)` fixo, sem parâmetros de consulta. Para uma loja com 6 campanhas/semana (~312/ano), a lista rapidamente se torna inavegável. Não há como encontrar uma campanha específica, filtrar por status/data, ou compartilhar uma busca via URL.

Usuários com dezenas de campanhas precisam rolar uma lista linear infinita. Não há busca textual, não há filtros de período, não há paginação. A URL não reflete o estado atual — impossível compartilhar ou salvar uma consulta.

## What Changes

- **Evoluir `listCampaigns()`** para contrato de query com paginação page-based, busca textual (`ILIKE product_name`), filtros por status (`ready`/`error`) e data (presets), ordenação por data/nome
- **Adicionar `countCampaignsFiltered()`** para calcular total de páginas com os mesmos filtros (sem `.range()`, usando `head: true`)
- **Remover `limit(50)` fixo** — toda query usa paginação explícita via `.range()`, pageSize default 10
- **Criar `parseCampaignListSearchParams()`** para normalização e validação de query params da URL
- **Criar UI de `/campanhas` com busca, filtros e paginação**:
  - Campo de busca textual com debounce 300ms
  - Chips de filtro por status (Todas / Prontas / Erro)
  - Presets de data (7d, 30d, 90d, ano, todos)
  - Ordenação por data decrescente/crescente, nome A-Z/Z-A
  - Lista paginada com 10 itens por página e thumbnails
  - Paginação numerada (<< 1 2 3 ... >>)
- **URL state compartilhável**: `?q=tenis&status=ready&date=90d&page=2&sort=created_at&order=desc` — parâmetros default omitidos
- **Criar componente `Pagination`** reutilizável em `src/components/ui/pagination.tsx`
- **Criar hook `useDebounce`** em `src/hooks/use-debounce.ts`
- **Novo empty state** `CAMPAIGNS_SEARCH_EMPTY` para busca sem resultado
- **25+ testes** (query builder, paginação, busca, filtros, URL state, UI, componente Pagination)
- **SSR puro via `searchParams`** — sem API route nova, sem client-side fetch

## Capabilities

### New Capabilities

- `list-contract-update`: `ListCampaignsParams` + `ListCampaignsResult` + `listCampaigns(storeId, params?)` + `countCampaignsFiltered(storeId, params?)` em `src/lib/campaign/list.ts`
- `search-params-validation`: `parseCampaignListSearchParams(raw)` para normalização e validação de query params URL
- `campaign-list-search-ui`: Página de campanhas refatorada com busca textual (debounce 300ms), chips de status, date presets, ordenação, paginação, URL state compartilhável, empty states adaptativos
- `pagination-component`: Componente `Pagination` reutilizável em `src/components/ui/pagination.tsx`
- `use-debounce`: Hook `useDebounce<T>` reutilizável em `src/hooks/use-debounce.ts`

### Modified Capabilities

- `list-contract`: `listCampaigns(storeId)` → `listCampaigns(storeId, params?)` com retorno `Promise<CampaignListItem[]>` → `Promise<ListCampaignsResult>` — quebra de compatibilidade controlada (único caller: `/campanhas/page.tsx`)
- `campaign-list-ui`: Página `/campanhas` ganha busca, filtros, paginação, URL state, empty state adaptativo. Estados `no_store` e `no_campaigns` preservados das fases F18/F19
- `campaign-metrics`: Mantido inalterado — `getRecentCampaigns` do dashboard continua independente

## Impact

- **Modificados**: `src/lib/campaign/list.ts` (contrato evoluído, paginação, busca, filtros, `countCampaignsFiltered`, remover `limit(50)`), `src/app/(app)/campanhas/page.tsx` (`searchParams` lido como Promise, SSR paginado), `src/app/(app)/campanhas/client.tsx` (refatorado com busca+filtros+pagination), `src/lib/onboarding/microcopy.ts` (adicionar `CAMPAIGNS_SEARCH_EMPTY`), `openspec/specs/list-contract/spec.md` (atualizado), `openspec/specs/campaign-list-ui/spec.md` (atualizado)
- **Novos**: `src/components/ui/pagination.tsx`, `src/hooks/use-debounce.ts`, `openspec/specs/list-contract-update/spec.md`, `openspec/specs/campaign-list-search-ui/spec.md`, `openspec/specs/pagination-component/spec.md`, `openspec/specs/use-debounce/spec.md`
- **Novos testes**: `src/__tests__/lib/campaign/list.test.ts` (refatorado — 12+ testes de query builder + validação de search params), `src/__tests__/app/campanhas/campanhas-page.test.tsx` (ampliado — 8+ testes de interação), `src/__tests__/components/ui/pagination.test.tsx` (5+ testes), `src/__tests__/hooks/use-debounce.test.ts` (2+ testes)
- **Inalterados**: `src/lib/campaign/metrics.ts`, `types.ts`, `src/lib/onboarding/state.ts`, `types.ts`, `count.ts`, `src/lib/auth/store-ownership.ts`, middleware, next.config, API routes, banco de dados, storage, design tokens, shell, `src/components/ui/card.tsx`, `badge.tsx`, `empty-state.tsx`, `button.tsx`, `input.tsx`, `page-header.tsx`, `skeleton.tsx`
