# Phase 9: Cutover de Ownership e Onboarding — Research

**Date:** 2026-07-06
**Status:** Research complete

## Summary

Phase 9 implementa ownership de loja: vincula `stores.user_id` ao `auth.users.id` via migration, cria `getCurrentStore()` e `requireOwnership()`, aplica ownership nas 4 rotas CRUD de store, transforma 3 páginas em server components com resolução de store, remove `localStorage("store_id")`.

### Key Findings

**1. RLS gap:** Migration precisa incluir `GRANT SELECT ON TABLE public.stores TO authenticated`. Atualmente `authenticated` tem acesso REVOKED — sem o GRANT, a policy RLS não será alcançável por `createServerClient()`.

**2. StoreNotFoundError pattern:** Seguir exatamente o padrão de `UnauthorizedError` em `src/lib/auth/require-user.ts` — classe `extends Error`, `this.name = "StoreNotFoundError"`, exportada.

**3. createServerClient() vs supabaseAdmin:**
- `createServerClient()` — respeita RLS (anon key + session cookies). Usar para `getCurrentStore()` e `requireOwnership()`.
- `supabaseAdmin` — bypass RLS (service_role). Usar para INSERT/UPDATE após ownership validado.

**4. Refatoração progressiva (D8):** 4 passos incrementais:
1. store-page-client recebe `initialStore` prop, passa para StoreIdentityForm
2. StoreIdentityForm repassa para useStoreForm
3. useStoreForm inicializa de `initialStore`, não de localStorage
4. `save()` usa `storeId` local (inicializado de `initialStore?.id`, atualizado após POST)

**5. buildStoreResponse()** deve ser adicionado em `src/lib/store.ts` e incluir: todos os campos de store, `identity` via `resolveStoreIdentity(store)`, `visual_signature_url`, `logo_url`, `has_archived_signatures`.

**6. CampaignPreviewClient extraction:** `src/app/campaign/preview/page.tsx` vira server wrapper. Todo o client logic existente extraído para `preview-client.tsx`.

**7. Test patterns (Phase 7/8):**
- `src/__tests__/auth/store-ownership.test.ts` — pure logic, node env
- Route handler tests — vitest + fetch mocking
- Logout test update — remove store_id expectations

### Files Modified

- `supabase/migrations/<timestamp>_add_user_id_to_stores.sql` (new)
- `src/lib/types.ts` (opcional, ou Store type em `src/lib/store.ts`)
- `src/lib/auth/store-ownership.ts` (new)
- `src/lib/store-response.ts` (new — buildStoreResponse, evita ciclo de import com @/lib/actions/store)
- `src/app/api/store/route.ts` (POST modify + GET new)
- `src/app/api/store/[id]/route.ts` (GET/PATCH ownership)
- `src/app/store/page.tsx` (server component)
- `src/app/page.tsx` (server component)
- `src/app/campaign/preview/page.tsx` (server wrapper)
- `src/app/campaign/preview/preview-client.tsx` (new, extracted)
- `src/components/flow/store-page-client.tsx` (initialStore prop)
- `src/components/flow/campaign-page-client.tsx` (store prop)
- `src/components/flow/use-store-form.ts` (initialStore param)
- `src/components/auth/logout-button.tsx` (remove localStorage)
- `src/__tests__/auth/store-ownership.test.ts` (new)
- `src/__tests__/auth/logout.test.tsx` (update)
