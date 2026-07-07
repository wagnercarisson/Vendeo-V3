# Plan 10-06: Validação e Regressão — Summary

**Status:** Complete
**Date:** 2026-07-07

## Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ Zero erros de tipo |
| `npx vitest run` | ✅ 51/51 files, 457/457 tests passing |
| `npm run lint` | ✅ Zero erros de lint |
| `npx next build` | ✅ Build bem-sucedido |

## Exceptions Checklist

| Rota | Guard | Status |
|------|-------|--------|
| GET /api/store (atalho) | getCurrentStore() interno | ✅ Phase 9 |
| POST /api/store | requireSameOrigin + requireUser | ✅ |
| POST /auth/signout | requireSameOrigin + requireUser | ✅ |
| GET /api/store/:id | requireUser + requireOwnership | ✅ |
| PATCH /api/store/:id | requireSameOrigin + requireUser + requireOwnership | ✅ |
| ~20 handlers store-scoped | requireSameOrigin (mutações) + requireAuthorizedStore | ✅ |
| POST /api/campaign/generate | requireSameOrigin + requireApiUser + getCurrentStore | ✅ |
| POST /api/campaign/generate-image | requireSameOrigin + requireApiUser + requireOwnership | ✅ |

## store-logos Isolation

- `rg "store-logos"` — apenas referências no arquivo de teste da migration (`rls-policies.test.ts`), confirmando que nenhum fluxo novo lê ou escreve no bucket.

## localStorage Audit

- `rg "localStorage"` — apenas em `logout.test.tsx` (testes de remoção de `store_id`). Nenhum `store_id` armazenado em localStorage.

## Build Fix

- `src/lib/actions/store.ts` re-exportava funções não-async de `"use server"` — Next.js exige que exports de `"use server"` sejam async. Corrigido com wrappers async.
- `src/lib/store-response.ts` e `src/app/api/campaign/generate-image/route.ts` atualizados para importar de `@/lib/store-identity-service` diretamente (sem `"use server"`).
