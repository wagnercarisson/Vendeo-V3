## Why

A milestone v1.2 (Contas e Propriedade) exige que o usuário autenticado acesse exclusivamente sua própria loja. Atualmente, `stores` não tem `user_id`, o acesso a dados de loja é feito por `localStorage("store_id")` sem qualquer validação de propriedade, e as rotas de API usam `supabaseAdmin` (service_role) que ignora RLS. Sem esta fase, qualquer usuário autenticado poderia acessar ou modificar dados de qualquer loja conhecendo seu UUID — uma falha grave de isolamento multi-tenant.

## What Changes

1. Adicionar `user_id` (NOT NULL UNIQUE) à tabela `stores` + RLS SELECT policy
2. Criar `getCurrentStore()` — resolve loja por `claims.sub`
3. Criar `requireOwnership(storeId)` — valida que store pertence ao usuário
4. Aplicar ownership em 4 rotas CRUD de store: `POST /api/store`, `GET /api/store`, `GET /api/store/:id`, `PATCH /api/store/:id`
5. Transformar `/store`, `/` e `/campaign/preview` em server components com `requirePageUser()` + `getCurrentStore()`
6. Remover `localStorage("store_id")` de todos os componentes (store-page-client, campaign-page-client, use-store-form, logout-button)
7. Propagar `storeId` por props do server → client components

## Capabilities

### New Capabilities
- `store-ownership-core`: Helpers `getCurrentStore()`, `requireOwnership()`, classe `StoreNotFoundError`, D11 (userId opcional para evitar auth duplicada)
- `store-ownership-api`: Ownership nas 4 rotas CRUD de store (POST, GET /, GET /:id, PATCH /:id). `POST /api/store` usa `claims.sub`, `GET /api/store` como atalho semântico, `buildStoreResponse()` para shape consistente
- `store-ownership-pages`: Server components nas rotas `/store`, `/`, `/campaign/preview` com `requirePageUser()` + `getCurrentStore()` + redirect `/store` se null
- `store-form-ownership-refactor`: Refatoração progressiva do `useStoreForm` + `store-page-client` + `campaign-page-client` para receber store via props, remover localStorage
- `store-localstorage-removal`: Remoção de `localStorage("store_id")` em logout-button, `.spec.ts` e grep de regressão. Logout não precisa mais limpar store_id

### Modified Capabilities
- `user-auth`: `StoreNotFoundError` adicionado como classe de erro exportada ao lado de `UnauthorizedError` em `src/lib/auth/`; contrato de erro (401/404 JSON vs redirect) documentado em D10
- `store-identity-foundation`: Schema de `stores` ganha coluna `user_id` (migration). POST /api/store passa a exigir `requireUser()` + `claims.sub` (não aceita user_id do body). GET/PATCH /api/store/:id passam a usar `requireOwnership()`. GET /api/store (atalho) adicionado. `buildStoreResponse()` extraído para shape consistente
- `store-identity-ui`: `StorePageClient` recebe `initialStore` do server component; remove leitura de localStorage; modo create (null) vs edit (store presente) decidido por prop, não por localStorage
- `auth-logout`: Remove `localStorage.removeItem("store_id")` do onSubmit — store não está mais em localStorage
- `campaign-preview-page`: `page.tsx` vira server wrapper com `requirePageUser()` + `getCurrentStore()` + redirect `/store` se null; client component extraído para `preview-client.tsx`

## Impact

- **Banco**: Migration com DELETE de tabelas filhas, ALTER TABLE stores ADD COLUMN user_id, RLS policy. Dados de loja existentes são resetados (dev environment)
- **API routes**: 4 rotas de store ganham validação de ownership. Rotas de sub-recursos (logo, brand-profile, visual-signature, campaign) NÃO são alteradas — escopo Phase 10
- **Server components**: 3 páginas (/, /store, /campaign/preview) passam a resolver store no servidor
- **Client components**: 4 arquivos perdem dependência de localStorage; recebem store via props
- **Auth helpers**: Nova classe `StoreNotFoundError`; `requireOwnership()` e `getCurrentStore()` com userId opcional
- **Sem StoreProvider**: Props encadeadas por enquanto; decisão D4 postergada
