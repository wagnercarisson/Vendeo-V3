# Plan 10-01: Auth Guards & Error Contracts — Summary

**Status:** Complete
**Date:** 2026-07-07

## Files Created

- `src/lib/auth/errors.ts` — 3 error classes centralizadas (UnauthorizedError, StoreNotFoundError, ForbiddenError)
- `src/lib/auth/csrf.ts` — requireSameOrigin(request) com validação origin vs host/forwarded-host
- `src/lib/api-error-response.ts` — unauthorized(), notFound(), forbidden() helpers (NextResponse.json)
- `src/__tests__/auth/authorized-store.test.ts` — Testes unitários: requireAuthorizedStore, requireSameOrigin, JsonErrorResponse

## Files Modified

- `src/lib/auth/require-user.ts` — UnauthorizedError removido da definição local, importado/re-exportado de errors.ts
- `src/lib/auth/store-ownership.ts` — StoreNotFoundError movido para errors.ts, adicionado AuthorizedStoreContext type + requireAuthorizedStore()
- `src/app/api/store/[id]/logo/route.ts` — requireAuthorizedStore(id) em GET, POST e DELETE; requireSameOrigin() em POST/DELETE
- `src/app/api/store/[id]/brand-profile/route.ts` — requireAuthorizedStore(id) em GET; requireSameOrigin() + requireAuthorizedStore(id) em POST e PATCH

## Quality

- `npx tsc --noEmit` — zero errors
- Tests pass: authorized-store.test.ts (requireAuthorizedStore, requireSameOrigin, JsonErrorResponse)
- All existing callers continue to work via re-exports

## Decisions

- Uma origem de verdade para todas as error classes (errors.ts). Re-exports mantêm compatibilidade com import/instanceof existentes.
- requireSameOrigin usa `x-forwarded-host` com precedência sobre `host` para suporte a proxy.
- Precedência dos guards: CSRF (403) → Auth (401) → Ownership (404).
