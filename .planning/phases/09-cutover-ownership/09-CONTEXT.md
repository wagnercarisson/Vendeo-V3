# Phase 9: Cutover de Ownership e Onboarding — Context

**Gathered:** 2026-07-06
**Status:** Ready for planning
**Source:** OpenSpec Change — `openspec/changes/fase-9-cutover-ownership/`
**Change status:** 3/3 artifacts complete (proposal, design, tasks) + 10 specs

<domain>
## Phase Boundary

Vincular usuário autenticado à sua loja via `stores.user_id`, implementar `getCurrentStore()` e `requireOwnership()`, aplicar ownership nas 4 rotas CRUD de store, transformar 3 páginas em server components com resolução de store, remover `localStorage("store_id")` de todos os componentes.

**Entrega verificável:**
- Usuário autenticado cria loja → `POST /api/store` com `claims.sub`
- Usuário retorna e vê sua loja → `getCurrentStore()` via server component
- Usuário NÃO vê loja de outro usuário → `requireOwnership()` → 404
- Usuário sem loja é redirecionado para `/store` (onboarding)
- Zero referências a `localStorage("store_id")` em `src/components/`
</domain>

<decisions>
## Implementation Decisions

### D1 — Ownership nas 4 rotas CRUD de store
POST /api/store, GET /api/store (atalho), GET /api/store/:id, PATCH /api/store/:id. Sub-recursos (logo, brand-profile, visual-signature, campaign) ficam para Fase 10.

### D2 — Belt and suspenders: RLS + validação backend
- RLS policy FOR SELECT TO authenticated USING (user_id = auth.uid())
- `requireOwnership()` com `createServerClient()` + RLS valida antes de `supabaseAdmin`
- Nenhuma policy de escrita para `authenticated` — escrita permanece em handlers service_role

### D3 — localStorage("store_id") removido
4 arquivos afetados: campaign-page-client, store-page-client, use-store-form, logout-button. Store resolvida por claims.sub no servidor.

### D4 — Propagação por props, StoreProvider postergado
Props encadeadas server → client. StoreProvider será considerado quando houver muitos componentes irmãos.

### D5 — /store como rota de produto, fora do route group (auth)
Páginas /store, /, /campaign/preview viram server components com requirePageUser + getCurrentStore.

### D6 — GET /api/store como atalho semântico
Nova rota sem :id que resolve loja do usuário autenticado. Mesmo shape de GET /api/store/:id.

### D7 — POST /api/store: criação com claims.sub
requireUser() → user_id = claims.sub (ignora body). UNIQUE(user_id) protege contra segunda loja → 409.

### D8 — Refatoração progressiva (1700+ linhas)
4 passos: store-page-client recebe initialStore → store-identity-form repassa → use-store-form inicializa de initialStore → save() usa storeId local.

### D9 — /campaign/preview com server wrapper
page.tsx vira server wrapper. Client component extraído para preview-client.tsx.

### D10 — Contrato de erro
| Situação | Erro | Status | API | Página |
|----------|------|--------|-----|--------|
| Sem sessão | UnauthorizedError | 401 | JSON | redirect /login |
| Store inexistente/alheia | StoreNotFoundError | 404 | JSON | redirect /store |

### D11 — userId opcional em getCurrentStore/requireOwnership
Server component: requirePageUser() → getCurrentStore(user.userId). Route handler: requireApiUser() → requireOwnership(id, user.userId).

### D12 — Shape consistente: GET /api/store = GET /api/store/:id
buildStoreResponse(store) extraído para src/lib/store-response.ts (arquivo separado para evitar ciclo de import com @/lib/actions/store). Ambos endpoints retornam { ...store, identity, visual_signature_url, logo_url, has_archived_signatures }.

### D13 — Migration destrói dados existentes
DELETE de tabelas filhas (generation_events → store_brand_profiles → store_brand_assets → store_visual_signatures) + DELETE stores + ADD COLUMN user_id. Dev environment apenas — release gate documentado.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 9 Change Artifacts (source of truth)
- `openspec/changes/fase-9-cutover-ownership/proposal.md` — What & Why
- `openspec/changes/fase-9-cutover-ownership/design.md` — Architecture decisions D1-D12
- `openspec/changes/fase-9-cutover-ownership/tasks.md` — Implementation checklist (7 sections)

### Specs
- `openspec/changes/fase-9-cutover-ownership/specs/store-ownership-core/spec.md` — getCurrentStore, requireOwnership, StoreNotFoundError
- `openspec/changes/fase-9-cutover-ownership/specs/store-ownership-api/spec.md` — Ownership nas 4 rotas CRUD + buildStoreResponse
- `openspec/changes/fase-9-cutover-ownership/specs/store-ownership-pages/spec.md` — Server components (/, /store, /campaign/preview)
- `openspec/changes/fase-9-cutover-ownership/specs/store-form-ownership-refactor/spec.md` — useStoreForm refatoração progressiva
- `openspec/changes/fase-9-cutover-ownership/specs/store-localstorage-removal/spec.md` — Remoção de localStorage em 4 arquivos
- `openspec/changes/fase-9-cutover-ownership/specs/user-auth/spec.md` — StoreNotFoundError exportado
- `openspec/changes/fase-9-cutover-ownership/specs/store-identity-foundation/spec.md` — Migration + schema modificado
- `openspec/changes/fase-9-cutover-ownership/specs/store-identity-ui/spec.md` — Componentes modificados
- `openspec/changes/fase-9-cutover-ownership/specs/auth-logout/spec.md` — Logout sem store_id
- `openspec/changes/fase-9-cutover-ownership/specs/campaign-preview-page/spec.md` — Preview server wrapper

### Existing Code (Phase 7/8 foundation)
- `src/lib/auth/require-user.ts` — UnauthorizedError pattern a seguir
- `src/lib/auth/redirect.ts` — Redirect sanitizer (reutilizado)
- `src/lib/supabase/server.ts` — createServerClient() + supabaseAdmin
- `src/lib/store.ts` — Store type + helpers
- `src/lib/store-response.ts` — buildStoreResponse (arquivo separado para evitar ciclo de import com @/lib/actions/store)
- `src/app/api/store/route.ts` — POST (será modificado)
- `src/app/api/store/[id]/route.ts` — GET/PATCH (serão modificados)
- `src/middleware.ts` — Middleware (não modificado nesta fase)
- `src/app/store/page.tsx` — Store page (virará server component)
- `src/app/page.tsx` — Home (virará server component)
- `src/app/campaign/preview/page.tsx` — Preview (server wrapper)
- `src/components/flow/store-page-client.tsx` — Store page client
- `src/components/flow/campaign-page-client.tsx` — Campaign page client
- `src/components/flow/use-store-form.ts` — Store form hook
- `src/components/auth/logout-button.tsx` — Logout button
- `supabase/migrations/` — Migrações existentes (padrão de nomenclatura)

### Milestone & Design System
- `docs/alinhamento-milestone-v1.2.md` — Milestone alignment decisions
- `ROADMAP.md` — Roadmap (a ser atualizado com planos)
- `.planning/STATE.md` — State (a ser atualizado)
</canonical_refs>

<specifics>
## Specific Ideas

### Migration SQL
Arquivo: `supabase/migrations/<timestamp>_add_user_id_to_stores.sql`
1. DELETE FROM generation_events
2. DELETE FROM store_brand_profiles
3. DELETE FROM store_brand_assets
4. DELETE FROM store_visual_signatures
5. DELETE FROM stores
6. ALTER TABLE stores ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id)
7. ALTER TABLE stores ENABLE ROW LEVEL SECURITY
8. CREATE POLICY "users_select_own_store" FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))
9. GRANT SELECT ON TABLE public.stores TO authenticated (necessário para RLS funcionar)

### Auth helpers (src/lib/auth/store-ownership.ts)
```typescript
export class StoreNotFoundError extends Error {
  constructor(message = "Store not found or access denied") {
    super(message);
    this.name = "StoreNotFoundError";
  }
}

export async function getCurrentStore(userId?: string): Promise<Store | null>
export async function requireOwnership(storeId: string, userId?: string): Promise<Store>
```

### API route changes
- POST /api/store: add requireUser(), user_id = claims.sub, handle 23505 → 409
- GET /api/store (NEW): requireApiUser() + getCurrentStore() + buildStoreResponse()
- GET /api/store/[id]: requireUser() + requireOwnership() + buildStoreResponse()
- PATCH /api/store/[id]: requireUser() + requireOwnership()

### Server component changes
- /store/page.tsx: async server component, requirePageUser, getCurrentStore, render StorePageClient
- /page.tsx: async server component, requirePageUser, getCurrentStore, redirect /store if null
- /campaign/preview/page.tsx: server wrapper, client extraído para preview-client.tsx
</specifics>

<deferred>
## Deferred Ideas
- Ownership em rotas de sub-recursos (logo, brand-profile, visual-signature, campaign) — Fase 10
- RLS em tabelas filhas — Fase 10
- Storage policies — Fase 10
- CSRF / same-origin — Fase 10
- Server Actions com auth — Fase 10
- StoreProvider (React Context) — postergado (D4)
- Múltiplas lojas (1:N) — fora da milestone v1.2
- E2E de sessão com cookies reais — Fase 11
- Testes cross-tenant — Fase 11
</deferred>

---

*Phase: 09-cutover-ownership*
*Context gathered: 2026-07-06 via OpenSpec Change Artifacts*
