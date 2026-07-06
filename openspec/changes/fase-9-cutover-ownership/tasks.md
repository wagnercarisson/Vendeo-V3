## 1. Migration e Database

- [ ] 1.1 Criar migration `supabase/migrations/<timestamp>_add_user_id_to_stores.sql`: DELETE filhas (generation_events, store_visual_signatures, store_brand_assets, store_brand_profiles), DELETE stores, ALTER TABLE ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id), ENABLE ROW LEVEL SECURITY, CREATE POLICY "users_select_own_store" FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))
- [ ] 1.2 Rodar migration localmente e verificar esquema (coluna user_id, RLS, policy SELECT)
- [ ] 1.3 Atualizar definições de tipo TypeScript em `src/lib/types.ts` ou similar para incluir `user_id` no tipo Store

## 2. Auth Helpers (store-ownership.ts)

- [ ] 2.1 Criar `src/lib/auth/store-ownership.ts` com classe `StoreNotFoundError` exportada
- [ ] 2.2 Implementar `getCurrentStore(userId?: string): Promise<Store | null>` — se userId omitido, chama `requireUser()` internamente; query por `createServerClient()` com SELECT WHERE user_id = $1
- [ ] 2.3 Implementar `requireOwnership(storeId: string, userId?: string): Promise<Store>` — se userId omitido, chama `requireUser()` internamente; query com SELECT WHERE id = $1 AND user_id = $2; se não encontrado, throw StoreNotFoundError
- [ ] 2.4 Adicionar testes para `getCurrentStore()` e `requireOwnership()` — store encontrada, store não encontrada, userId opcional funciona, store alheia retorna StoreNotFoundError
- [ ] 2.5 Adicionar testes para `StoreNotFoundError` — catchable, distinguível de UnauthorizedError

## 3. API Routes — Ownership

- [ ] 3.1 Atualizar `POST /api/store`: adicionar `requireUser()`, usar `claims.sub` como user_id (ignorar body), tratar erro 23505 → 409 Conflict
- [ ] 3.2 Adicionar `GET /api/store` (atalho): `requireApiUser()` + `getCurrentStore(user.userId)`, 404 se null, usar `buildStoreResponse()`
- [ ] 3.3 Criar `src/lib/store-response.ts` com `buildStoreResponse(store)` para shape consistente (store fields + identity + visual_signature_url + logo_url + has_archived_signatures). Arquivo separado de `src/lib/store.ts` para evitar ciclo de import com `@/lib/actions/store`.
- [ ] 3.4 Atualizar `GET /api/store/[id]`: adicionar `requireUser()` + `requireOwnership(id, user.userId)`, usar `buildStoreResponse()`, capturar UnauthorizedError/StoreNotFoundError → JSON
- [ ] 3.5 Atualizar `PATCH /api/store/[id]`: adicionar `requireUser()` + `requireOwnership(id, user.userId)`, capturar UnauthorizedError/StoreNotFoundError → JSON
- [ ] 3.6 Adicionar testes para ownership nas 4 rotas — autenticado com store, autenticado sem store, não autenticado, store alheia, UNIQUE violation

## 4. Server Components (Páginas)

- [ ] 4.1 Atualizar `src/app/store/page.tsx`: server component com `requirePageUser()`, `getCurrentStore(user.userId)`, passar `initialStore={store}` ou `initialStore={null}` para `<StorePageClient />`
- [ ] 4.2 Atualizar `src/app/page.tsx`: server component com `requirePageUser()`, `getCurrentStore(user.userId)`, se null → `redirect("/store")`, passar `store={store}` para `<CampaignPageClient />`
- [ ] 4.3 Restruturar `/campaign/preview`: `page.tsx` vira server wrapper com `requirePageUser()` + `getCurrentStore()` + redirect `/store` se null; `preview-client.tsx` recebe lógica client existente

## 5. Client Components — localStorage Removal

- [ ] 5.1 Atualizar `src/components/flow/store-page-client.tsx`: receber `initialStore: Store | null` como prop, passar para `StoreIdentityForm`, remover `localStorage("store_id")`
- [ ] 5.2 Atualizar `src/components/flow/campaign-page-client.tsx`: receber `store: Store` como prop, usar `store.id` para API calls, remover `localStorage("store_id")` e estados loading/blocked de store resolution
- [ ] 5.3 Atualizar `src/components/flow/use-store-form.ts`: receber `initialStore` como parâmetro, inicializar estado de `initialStore` (não localStorage), manter `storeId` em estado local (inicializado de `initialStore?.id`, atualizado após POST), `save()` decide POST vs PATCH baseado em `storeId` local, remover todos `getItem/setItem/removeItem("store_id")`

## 6. Logout Cleanup

- [ ] 6.1 Atualizar `src/components/auth/logout-button.tsx`: remover `localStorage.removeItem("store_id")`, manter cleanup de sessionStorage keys (campaign_draft, campaign_draft_image, campaign_preview)
- [ ] 6.2 Atualizar teste em `src/__tests__/auth/logout.test.tsx` que mocka `localStorage("store_id")` — remover expectativa de store_id cleanup

## 7. Verificação e Regressão

- [ ] 7.1 Verificar `rg "localStorage" src/components/flow/ src/components/auth/` — zero resultados (e confirmar ausência de `STORAGE_KEY = "store_id"`)
- [ ] 7.2 `npx tsc --noEmit` — zero erros de tipo
- [ ] 7.3 `npx vitest run` — todos os testes verdes (incluindo existentes)
- [ ] 7.4 `npm run lint` — zero erros de lint
- [ ] 7.5 `npx next build` — build bem-sucedido
