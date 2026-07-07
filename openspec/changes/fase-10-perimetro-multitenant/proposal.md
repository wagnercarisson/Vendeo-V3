## Why

A Fase 9 estabeleceu ownership nas 4 rotas CRUD de store, mas ~20 route handlers de sub-recursos (logo, brand-profile, visual-signature), 7 Server Actions, 4 tabelas filhas e 2 buckets de Storage permanecem sem qualquer proteção multi-tenant. Um usuário autenticado pode acessar ou modificar dados de qualquer loja conhecendo seu UUID — falha grave de isolamento. Sem esta fase, o perímetro multi-tenant da milestone v1.2 não está completo.

## What Changes

1. Criar `AuthorizedStoreContext` (`{ userId, storeId, store }`) como contrato central de autorização
2. Implementar `requireAuthorizedStore(storeId)` — helper que retorna o contexto ou 404
3. Implementar `requireSameOrigin(request)` — guard CSRF para mutações POST/PATCH/DELETE
4. Centralizar classes de erro (`UnauthorizedError`, `StoreNotFoundError`, `ForbiddenError`) em `src/lib/auth/errors.ts` e reexportar dos arquivos originais
5. Criar `JsonErrorResponse` helpers (`unauthorized()`, `notFound()`, `forbidden()`) em `src/lib/api-error-response.ts`
6. Aplicar `requireAuthorizedStore` nos ~20 route handlers store-scoped restantes (logo, brand-profile, visual-signature)
7. Aplicar `getCurrentStore()` em `/api/campaign/generate` (não aceitar `storeId` do cliente)
8. Aplicar `requireOwnership(storeId)` em `/api/campaign/generate-image`
9. Extrair 3 Server Actions de `src/lib/actions/store.ts` para `src/lib/store-identity-service.ts` como serviço interno (sem `"use server"`)
10. Adicionar `requireUser()` + `requireOwnership()` nas 4 Server Actions de `src/lib/visual-signature/server-actions.ts`
11. Habilitar RLS nas 4 tabelas filhas (`store_brand_assets`, `store_brand_profiles`, `store_visual_signatures` com SELECT do owner; `generation_events` default-deny)
12. Restringir políticas de SELECT nos buckets `store-brand-assets` e `visual-signatures` por path prefix `{store_id}/`
13. Documentar `store-logos` como exceção temporária
14. Criar matriz de testes parametrizados: matriz base (~24 métodos x 4 cenários) + matriz CSRF (mutações x 3 cenários)

## Capabilities

### New Capabilities
- `multitenant-auth-guards`: Contratos centrais de autorização — `AuthorizedStoreContext`, `requireAuthorizedStore()`, `requireSameOrigin()`, `JsonErrorResponse` helpers, classes de erro centralizadas em `errors.ts`
- `multitenant-route-handlers`: Aplicação de `requireAuthorizedStore()` em ~20 route handlers store-scoped (logo, brand-profile, visual-signature) + CSRF em mutações
- `multitenant-campaign-guards`: Guards específicos das rotas de campanha — `getCurrentStore()` em `/api/campaign/generate`, `requireOwnership()` em `/api/campaign/generate-image`
- `multitenant-server-actions`: Extração de 3 serviços internos para `store-identity-service.ts` + `requireUser()` + `requireOwnership()` nas 4 Server Actions de visual-signature
- `multitenant-rls-storage`: RLS nas 4 tabelas filhas (SELECT do owner, default-deny em generation_events) + Storage policies restritas por path prefix nos buckets
- `multitenant-test-matrix`: Matriz parametrizada base (~24 métodos x 4 cenários) + matriz CSRF (mutações x 3 cenários) + regressão

### Modified Capabilities
- `store-ownership-core`: Estendido com `requireAuthorizedStore()` que retorna `AuthorizedStoreContext` (`{ userId, storeId, store }`). `StoreNotFoundError` movido para `errors.ts` (reexportado)
- `user-auth`: Adicionado `requireSameOrigin()` como guard CSRF. `UnauthorizedError` movido para `errors.ts` (reexportado). Adicionado `ForbiddenError`. Adicionados helpers de resposta JSON (`unauthorized()`, `notFound()`, `forbidden()`)

## Impact

- **Banco**: Migrations para habilitar RLS em 4 tabelas filhas + criar/dropar Storage policies. Nenhuma mudança de schema (colunas ou constraints)
- **API routes**: ~20 handlers de sub-recursos ganham `requireAuthorizedStore()` + CSRF. `POST /api/campaign/generate` deixa de aceitar `storeId` do body (usa `getCurrentStore()`)
- **Server Actions**: 3 funções perdem `"use server"` e viram serviços internos. 4 funções de visual-signature ganham guards. Callers precisam ser atualizados para não importar Server Actions removidas
- **Auth helpers**: Novos helpers em `src/lib/auth/` (`csrf.ts`, `errors.ts`). Helpers de resposta em `src/lib/api-error-response.ts`. `require-user.ts` e `store-ownership.ts` reexportam classes de `errors.ts`
- **Storage**: Políticas de SELECT nos buckets `store-brand-assets` e `visual-signatures` são restritas. Buckets permanecem `public = true` para download por URL conhecida
- **Testes**: ~100 novos casos de teste parametrizados (matriz base + CSRF). Testes existentes continuam passando
- **Sem StoreProvider**: Props continuam sendo o mecanismo de propagação. StoreProvider postergado
