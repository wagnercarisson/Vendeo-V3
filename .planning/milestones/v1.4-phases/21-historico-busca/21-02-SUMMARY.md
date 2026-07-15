# Wave 2 — URL State + Filtros

## Status
DONE — committed `b31923b`

## What was built
- `src/app/(app)/campanhas/page.tsx`: SSR with `searchParams: Promise<...>` (Next.js 15 API), calls `parseCampaignListSearchParams` + `listCampaigns` with validated params, passes parsed data to client
- `src/app/(app)/campanhas/client.tsx`: Refactored with search input + `useDebounce(300ms)`, status chips, date preset dropdown, sort dropdown, adaptive empty states (`CAMPAIGNS_NO_CAMPAIGNS` / `CAMPAIGNS_SEARCH_EMPTY`), URL state via `useRouter().replace()`
- `src/hooks/use-debounce.ts`: Generic `useDebounce<T>(value, delay)` hook
- `src/lib/onboarding/microcopy.ts`: Added `CAMPAIGNS_SEARCH_EMPTY` (Search icon, "Nenhuma campanha encontrada", "Tente ajustar sua busca ou limpar os filtros")
- `src/__tests__/hooks/use-debounce.test.ts`: 4 tests (jsdom)
- `src/__tests__/app/campanhas/campanhas-page.test.tsx`: 8 tests (node)
- `src/__tests__/app/minhas-campanhas-client.test.tsx`: Updated props — 8 tests passing
- `src/__tests__/app/minhas-campanhas.test.tsx`: Updated searchParams mock — passing

## Verification
- 681 tests passing (+12)
- Typecheck: clean
- Lint: clean
