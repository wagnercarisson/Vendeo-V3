# Plan 16-03 Summary — Testes e Verificação

**Status:** ✅ Complete  
**Date:** 2026-07-10  

## Created

- `src/__tests__/app/minhas-campanhas.test.tsx` (37 lines) — Server Component guards + redirect + middleware
- `src/__tests__/app/minhas-campanhas-client.test.tsx` (107 lines) — Client Component display tests

## Complemented

- `src/__tests__/lib/campaign/list.test.ts` — 7 test cases (created in 16-01, verified here)

## Verification Results

| Check | Status |
|-------|--------|
| `npm run typecheck` | ✅ Clean |
| `npm run lint` | ✅ Clean |
| `npx vitest run` | ✅ 545 passing (63 files) |
| `npm run build` | ✅ Clean |

## Test Coverage

### Server Component Guards (`minhas-campanhas.test.tsx`)
- redirect `/store` when no store found
- `listCampaigns` called with store id when store exists
- Render without error when campaigns load
- Redirect `/minhas-campanhas` from preview page (auth+store)
- Redirect `/store` from preview page (auth, no store)
- Middleware matcher includes `/minhas-campanhas`

### Client Component Display (`minhas-campanhas-client.test.tsx`)
- Campaign cards render: thumbnail, product name, formatted date
- "Baixar" visible only for `ready` campaigns
- "Abrir" visible for all campaigns
- Placeholder div when `thumbnailUrl` is null
- `<img>` element when `thumbnailUrl` is provided
- Status text "Pronta" for ready, "Erro" for error
- Empty state: "Nenhuma campanha encontrada" + CTA → `/`

### Helper (`list.test.ts`, verified complete)
- `listCampaigns`: owner query, `.in()` filter assertion, empty store, cross-tenant RLS
- `generateBatchThumbnailUrls`: ready generates URLs, error skipped, partial failure → null

## Cumulative Test Count

| Plan | Test File | Tests |
|------|-----------|-------|
| 16-01 | `list.test.ts` | 7 |
| 16-03 | `minhas-campanhas.test.tsx` | 6 |
| 16-03 | `minhas-campanhas-client.test.tsx` | 8 |
| **Total** | | **21 new** |
