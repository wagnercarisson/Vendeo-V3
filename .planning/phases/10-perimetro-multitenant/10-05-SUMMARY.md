# Plan 10-05: Matriz de Testes Parametrizados — Summary

**Status:** Complete
**Date:** 2026-07-07

## Files Created

- `src/__tests__/api/store-scoped-matrix.test.ts` — Matriz paramétrica: 3 cenários (owner, no-session, alien) x GET/PATCH e CSRF por endpoint
- `src/__tests__/api/campaign-matrix.test.ts` — POST /api/campaign/generate x 4 cenários (401, 404, 200, storeId ignorado)
- `src/__tests__/api/store-creation-matrix.test.ts` — POST /api/store x 5 cenários (403 CSRF, 401, 200, 409 duplicata, user_id ignorado)
- `src/__tests__/api/csrf-matrix.test.ts` — Mutações POST/PATCH/DELETE x 3 cenários (cross-origin com/sem sessão → 403, mesma origem sem sessão → 401)

## Bugs Found & Fixed During Implementation

- **`csrf.ts` try-catch bug**: O `try` envolvia toda a função, então o `ForbiddenError("Cross-origin request denied")` intencional era pego pelo `catch` e relançado como `"Invalid origin"`. Corrigido: try-cache apenas em `new URL()`.
- **11 test files precisaram de ajustes**: mocks de auth (mockar `require-user` e `csrf` em vez de `createServerClient`), assertions corrigidas para `rejects.toThrow()` (route handlers sem catch), e `CampaignIntelligenceService` mudado de arrow function para classe.

## Quality

- `npx vitest run` — 51/51 files, 457/457 tests passing
- Invariante #4: store alheia/inexistente → 404 (nunca 403)
- Precedência CSRF: cross-origin sem sessão → 403 (nunca 401)
