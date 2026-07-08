## 1. Wave 0 — Contratos (Auth Guards & Helpers)

- [x] 1.1 Criar `src/lib/auth/errors.ts` com `UnauthorizedError`, `StoreNotFoundError`, `ForbiddenError` classes (name, default message, extends Error)
- [x] 1.2 Atualizar `src/lib/auth/require-user.ts`: importar `UnauthorizedError` de `errors.ts`, remover class original, reexportar
- [x] 1.3 Atualizar `src/lib/auth/store-ownership.ts`: importar `StoreNotFoundError` de `errors.ts`, remover class original, reexportar. Garantir que `instanceof` funcione entre módulos
- [x] 1.4 Criar `src/lib/auth/csrf.ts` com `requireSameOrigin(request)`: validar origin === host/x-forwarded-host, lançar `ForbiddenError` com mensagens descritivas
- [x] 1.5 Criar `src/lib/api-error-response.ts` com `unauthorized()`, `notFound()`, `forbidden()` helpers (NextResponse.json com status code)
- [x] 1.6 Adicionar `requireAuthorizedStore(storeId)` em `src/lib/auth/store-ownership.ts`: chama `requireApiUser()` + `requireOwnership(storeId, user.userId)`, retorna `AuthorizedStoreContext`
- [x] 1.7 Exportar `AuthorizedStoreContext` type de `src/lib/auth/store-ownership.ts`: `{ userId: string; storeId: string; store: Store }`
- [x] 1.8 Adicionar testes unitários: `requireAuthorizedStore` (contexto, 404, 401), `requireSameOrigin` (mesma origem, cross-origin, sem origin), `JsonErrorResponse` (401, 404, 403)

## 2. Wave 1 — Route Handlers Store-Scoped

- [x] 2.1 Atualizar `/api/store/[id]/logo/route.ts`: GET com `requireAuthorizedStore(id)`, POST/DELETE com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.2 Atualizar `/api/store/[id]/logo/retry-brand-director/route.ts`: POST com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.3 Atualizar `/api/store/[id]/brand-profile/route.ts`: GET/POST/PATCH com `requireAuthorizedStore(id)`, POST/PATCH com `requireSameOrigin(request)`
- [x] 2.4 Atualizar `/api/store/[id]/brand-profile/infer/route.ts`: POST com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.5 Atualizar `/api/store/[id]/brand-profile/realign/route.ts`: POST com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.6 Atualizar `/api/store/[id]/brand-profile/metadata/route.ts`: PATCH com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.7 Atualizar `/api/store/[id]/brand-profile/generate-without-logo/route.ts`: POST com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.8 Atualizar `/api/store/[id]/visual-signature/route.ts`: GET com `requireAuthorizedStore(id)`, DELETE com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.9 Atualizar `/api/store/[id]/visual-signature/approve/route.ts`: POST com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.10 Atualizar `/api/store/[id]/visual-signature/reject/route.ts`: POST com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.11 Atualizar `/api/store/[id]/visual-signature/restore/route.ts`: POST com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.12 Atualizar `/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts`: POST/DELETE com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.13 Atualizar `/api/store/[id]/visual-signature/generate-without-logo/route.ts`: POST com `requireSameOrigin(request)` + `requireAuthorizedStore(id)`
- [x] 2.14 Atualizar `/api/campaign/generate/route.ts`: POST com `requireSameOrigin(request)` + `requireApiUser()` + `getCurrentStore(user.userId)`. Ignorar `storeId` do body. 404 se sem loja
- [x] 2.15 Atualizar `/api/campaign/generate-image/route.ts`: POST com `requireSameOrigin(request)` + `requireApiUser()` + ler `storeId` do body + `requireOwnership(body.storeId, user.userId)`
- [x] 2.16 Adicionar `requireSameOrigin()` em `/api/store/[id]` PATCH (se ainda não tem)
- [x] 2.17 Adicionar `requireSameOrigin()` em `/auth/signout` POST
- [x] 2.18 Adicionar `requireSameOrigin()` em `POST /api/store` (antes de `requireUser()`)
- [x] 2.19 Adicionar testes de handler para 1-2 rotas como prova de padrão (ex: logo GET, brand-profile PATCH)

## 3. Wave 2 — Server Actions

- [x] 3.1 Criar `src/lib/store-identity-service.ts`: extrair `resolveStoreIdentity(store)` de `store.ts`. Remover `"use server"`. Receber store/contexto já autorizado. Nunca aceitar `storeId` cru do cliente
- [x] 3.2 Extrair `validateIdentityReference(snapshot)` para `store-identity-service.ts`. Função pura, sem DB
- [x] 3.3 Extrair `buildCampaignBrief(snapshot, input)` para `store-identity-service.ts`. Função pura, sem DB
- [x] 3.4 Atualizar callers em `src/lib/actions/store.ts`: remover funções extraídas, importar de `store-identity-service.ts`. Se necessário manter `"use server"` wrapper fino para compatibilidade
- [x] 3.5 Adicionar `requireUser()` + `requireOwnership(storeId)` em `generateVariations()` em `src/lib/visual-signature/server-actions.ts`
- [x] 3.6 Adicionar `requireUser()` + `requireOwnership(storeId)` em `generateAutomatic()`
- [x] 3.7 Adicionar `requireUser()` + `requireOwnership(storeId)` em `activateSignature(storeId, signatureId)`
- [x] 3.8 Adicionar `requireUser()` + `requireOwnership(storeId)` + `supabaseAdmin.eq("store_id", storeId)` em `listSignatures(storeId)`
- [x] 3.9 Adicionar testes para Server Actions: cada entrypoint com auth mockado (válido, inválido, alien store)

## 4. Wave 3 — RLS + Storage

- [x] 4.1 Criar migration: `ALTER TABLE store_brand_assets ENABLE ROW LEVEL SECURITY` + SELECT policy do owner (subquery stores.user_id)
- [x] 4.2 Criar migration: `ALTER TABLE store_brand_profiles ENABLE ROW LEVEL SECURITY` + SELECT policy do owner
- [x] 4.3 Criar migration: `ALTER TABLE store_visual_signatures ENABLE ROW LEVEL SECURITY` + SELECT policy do owner
- [x] 4.4 Criar migration: `ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY` — default-deny (sem policy para authenticated)
- [x] 4.5 Criar migration Storage: dropar policy ampla de SELECT em `store-brand-assets`, criar policy `FOR SELECT TO authenticated` com path prefix `{store_id}/`
- [x] 4.6 Criar migration Storage: dropar policy ampla de SELECT em `visual-signatures`, criar policy `FOR SELECT TO authenticated` com path prefix `{store_id}/`
- [x] 4.7 Documentar `store-logos` como exceção temporária: comentário no SQL/código indicando que policy ampla é mantida, inventário para Fase 11
- [x] 4.8 Verificar migrations: SQL executável, sintaxe correta, sem conflitos com migrations existentes
- [x] 4.9 Adicionar testes de migration/static SQL: validar que policies existem e têm sintaxe correta

## 5. Wave 4 — Matriz de Testes Parametrizados

- [x] 5.1 Implementar matriz base — storeId-scoped: ~20 endpoints com requireAuthorizedStore x 4 cenários (401, 404 alheia, 404 inexistente, sucesso)
- [x] 5.2 Implementar matriz base — current-store: POST /api/campaign/generate x 4 cenários (401, 404 sem loja, 200 com storeId malicioso ignorado, 200 sucesso)
- [x] 5.3 Implementar matriz base — POST /api/store: x 4 cenários (403 CSRF, 401 sem sessão, 409 duplicata, 200 ignorando user_id do body)
- [x] 5.4 Implementar matriz CSRF parametrizada: todas as mutações POST/PATCH/DELETE (incluindo POST /auth/signout) x 3 cenários (cross-origin c/ sessão → 403, cross-origin s/ sessão → 403, mesma origem s/ sessão → 401)
- [x] 5.5 Verificar que a matriz base usa origem válida em cenários 401/404 (não cruza com CSRF)
- [x] 5.6 Verificar que a matriz CSRF valida precedência: cross-origin sem sessão retorna 403 (não 401)
- [x] 5.7 Verificar que store alheia e inexistente retornam 404, nunca 403 (invariante #4 da milestone)

## 6. Wave 5 — Validação e Regressão

- [x] 6.1 `npx tsc --noEmit` — zero erros de tipo
- [x] 6.2 `npx vitest run` — todos os testes verdes (incluindo regressão dos existentes)
- [x] 6.3 `npm run lint` — zero erros de lint
- [x] 6.4 `npx next build` — build bem-sucedido
- [x] 6.5 Checklist de exceções: verificar se alguma rota/método intencionalmente sem guard está documentada com motivo
- [x] 6.6 Revisão de diff: confirmar que nenhum fluxo novo lê/escreve em `store-logos` sem ownership check
- [x] 6.7 Verificar `rg "localStorage" src/` — zero resultados inesperados (store_id não deve estar em localStorage)
