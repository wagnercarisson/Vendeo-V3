# Phase 10: Perímetro Multi-tenant — Context

**Gathered:** 2026-07-07
**Status:** Ready for planning
**Source:** OpenSpec Change — `openspec/changes/fase-10-perimetro-multitenant/`
**Change status:** 4/4 artifacts complete (proposal, design, specs, tasks)

<domain>
## Phase Boundary

Fechar o perímetro multi-tenant em toda a superfície restante: ~20 route handlers de sub-recursos (logo, brand-profile, visual-signature), 7 Server Actions, 4 tabelas filhas sem RLS, 2 buckets de Storage com SELECT público, e CSRF/same-origin em mutações.

**Entrega verificável:**
- `AuthorizedStoreContext` (`{ userId, storeId, store }`) como contrato central
- `requireAuthorizedStore(storeId)` — retorna contexto ou 404
- `requireSameOrigin(request)` — guard CSRF para mutações POST/PATCH/DELETE
- Erros centralizados em `src/lib/auth/errors.ts` com reexportação compatível
- `requireAuthorizedStore` aplicado nos ~20 route handlers store-scoped
- `getCurrentStore()` em `/api/campaign/generate` (storeId do body ignorado)
- `requireOwnership(storeId)` em `/api/campaign/generate-image`
- 3 Server Actions extraídas para `store-identity-service.ts` (sem `"use server"`)
- 4 Server Actions de visual-signature com `requireUser()` + `requireOwnership()`
- RLS habilitado em 4 tabelas filhas (SELECT do owner; `generation_events` default-deny)
- Storage policies restritas por path prefix `{store_id}/` em 2 buckets
- `store-logos` documentado como exceção temporária
- Matriz de testes parametrizados: base (~24 endpoints x 4 cenários) + CSRF (mutações x 3)
- `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npx next build` — todos verdes
</domain>

<decisions>
## Implementation Decisions

### D1 — AuthorizedStoreContext + requireAuthorizedStore + requireSameOrigin + JsonErrorResponse como contratos antes das edições
Criar os 4 contratos antes de modificar qualquer rota. Elimina repetição de padrões levemente diferentes em cada handler.

**AuthorizedStoreContext:**
```typescript
export type AuthorizedStoreContext = {
  userId: string;   // claims.sub
  storeId: string;  // stores.id
  store: Store;     // já autorizada
};
```

**requireAuthorizedStore(storeId):** Chama `requireApiUser()` + `requireOwnership(storeId, user.userId)` e retorna o contexto padronizado.

### D2 — requireAuthorizedStore em todos os route handlers store-scoped
Aplicar `requireAuthorizedStore(storeId)` nos handlers de logo, brand-profile, visual-signature. O `:id` da rota é o `storeId` validado. Em mutações POST/PATCH/DELETE, `requireSameOrigin()` roda primeiro.

### D3 — CSRF/same-origin em todas as mutações POST/PATCH/DELETE
`requireSameOrigin(request)` como primeiro guard em toda mutação de route handler. Precedência: CSRF (403) → Auth (401) → Ownership (404). Server Actions mantêm proteção nativa do Next.js.

### D4 — /api/campaign/generate usa getCurrentStore()
Endpoint resolve a loja do usuário autenticado via `getCurrentStore(user.userId)`. Qualquer `storeId` no body é ignorado — não pode ser usado como autoridade. 404 se usuário sem loja.

### D5 — /api/campaign/generate-image usa requireOwnership
`requireApiUser()` → `requireOwnership(body.storeId, user.userId)` → 404 se store alheia/inexistente.

### D6 — Erros centralizados em errors.ts
`UnauthorizedError`, `StoreNotFoundError`, `ForbiddenError` movidos para `src/lib/auth/errors.ts`. Arquivos originais (`require-user.ts`, `store-ownership.ts`) reexportam de `errors.ts` para compatibilidade de `instanceof`.

### D7 — Server Actions: extração de serviços internos + entrypoints autenticados
3 funções viram serviços internos em `src/lib/store-identity-service.ts` sem `"use server"`:
- `resolveStoreIdentity(store)` — recebe store já autorizada
- `validateIdentityReference(snapshot)` — função pura
- `buildCampaignBrief(snapshot, input)` — função pura

4 entrypoints permanecem em `server-actions.ts` com `requireUser()` + `requireOwnership()`.

### D8 — RLS + Storage como defesa em profundidade
SELECT policies com subquery: `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))`. Escritas permanecem em handlers service_role. Storage policies usam `storage.foldername(name)`.

### D9 — store-logos como exceção temporária
Bucket mantém política pública atual. Documentado como exceção. Nenhum fluxo novo lê `store-logos`. Inventário e migração na Fase 11.

### D10 — Testes por onda + matriz parametrizada final
| Onda | Escopo |
|------|--------|
| 1 (contratos) | Unitários: requireAuthorizedStore, requireSameOrigin, JsonErrorResponse. Handler: 1-2 rotas como prova |
| 2 (Server Actions) | Cada entrypoint com requireUser + ownership mockados |
| 3 (RLS) | Migração SQL + regressão app-side (mock) |
| 4 (matriz) | Três bases (storeId-scoped, current-store, POST /api/store) + CSRF: mutações x 3 cenários |
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 10 Change Artifacts (source of truth)
- `openspec/changes/fase-10-perimetro-multitenant/proposal.md` — What & Why
- `openspec/changes/fase-10-perimetro-multitenant/design.md` — Architecture decisions D1-D8
- `openspec/changes/fase-10-perimetro-multitenant/tasks.md` — Implementation checklist (6 seções, 48 tasks)

### Specs
- `openspec/changes/fase-10-perimetro-multitenant/specs/multitenant-auth-guards/spec.md` — AuthorizedStoreContext, requireAuthorizedStore, requireSameOrigin, JsonErrorResponse, errors.ts
- `openspec/changes/fase-10-perimetro-multitenant/specs/multitenant-route-handlers/spec.md` — ~20 handlers logo, brand-profile, visual-signature
- `openspec/changes/fase-10-perimetro-multitenant/specs/multitenant-campaign-guards/spec.md` — /api/campaign/generate + /generate-image
- `openspec/changes/fase-10-perimetro-multitenant/specs/multitenant-server-actions/spec.md` — store-identity-service + visual-signature guards
- `openspec/changes/fase-10-perimetro-multitenant/specs/multitenant-rls-storage/spec.md` — RLS 4 tabelas + Storage policies
- `openspec/changes/fase-10-perimetro-multitenant/specs/multitenant-test-matrix/spec.md` — Matriz parametrizada base + CSRF
- `openspec/changes/fase-10-perimetro-multitenant/specs/user-auth/spec.md` — UnauthorizedError, ForbiddenError, requireSameOrigin additions
- `openspec/changes/fase-10-perimetro-multitenant/specs/store-ownership-core/spec.md` — requireAuthorizedStore, StoreNotFoundError atualizado

### Existing Code (Phase 7/8/9 foundation)
- `src/lib/auth/require-user.ts` — requireUser(), requireApiUser(), UnauthorizedError (a ser reexportado)
- `src/lib/auth/store-ownership.ts` — getCurrentStore(), requireOwnership(), StoreNotFoundError (a ser reexportado)
- `src/lib/store-response.ts` — buildStoreResponse() (Phase 9)
- `src/lib/actions/store.ts` — Server Actions com resolveStoreIdentity (a extrair)
- `src/lib/supabase/server.ts` — createServerClient() + supabaseAdmin
- `src/app/api/store/[id]/logo/route.ts` — logo handlers (a modificar)
- `src/app/api/store/[id]/brand-profile/route.ts` — brand-profile handlers (a modificar)
- `src/app/api/store/[id]/visual-signature/route.ts` — visual-signature handlers (a modificar)
- `src/app/api/campaign/generate/route.ts` — campaign generate (getCurrentStore)
- `src/app/api/campaign/generate-image/route.ts` — campaign generate-image (requireOwnership)
- `src/app/api/store/route.ts` — POST (CSRF)
- `src/app/auth/signout/route.ts` — POST (CSRF)
- `src/lib/visual-signature/server-actions.ts` — Server Actions (a adicionar guards)
- `supabase/migrations/` — Migrações existentes

### Milestone & Design System
- `docs/alinhamento-milestone-v1.2.md` — Milestone alignment decisions
- `ROADMAP.md` — Roadmap (a ser atualizado com planos)
- `.planning/STATE.md` — State (a ser atualizado)

### Auth Layer (Phase 7/9)
- `src/lib/auth/errors.ts` — Arquivo centralizado de erros (a ser criado)
- `src/lib/auth/csrf.ts` — CSRF guard (a ser criado)
- `src/lib/api-error-response.ts` — JsonErrorResponse helpers (a ser criado)
- `src/lib/store-identity-service.ts` — Serviço interno extraído (a ser criado)
</canonical_refs>

<specifics>
## Specific Ideas

### Centralized Error Classes (src/lib/auth/errors.ts)
```typescript
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class StoreNotFoundError extends Error {
  constructor(message = "Store not found or access denied") {
    super(message);
    this.name = "StoreNotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
```

### CSRF Guard (src/lib/auth/csrf.ts)
```typescript
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  // Se origin ausente → ForbiddenError
  // Se origin !== host e origin !== forwardedHost → ForbiddenError
  // Se origin é válida → passa
}
```

### requireAuthorizedStore (src/lib/auth/store-ownership.ts)
```typescript
export type AuthorizedStoreContext = {
  userId: string;
  storeId: string;
  store: Store;
};

export async function requireAuthorizedStore(storeId: string): Promise<AuthorizedStoreContext> {
  const user = await requireApiUser();
  const store = await requireOwnership(storeId, user.userId);
  return { userId: user.userId, storeId: store.id, store };
}
```

### JsonErrorResponse (src/lib/api-error-response.ts)
```typescript
export function unauthorized(message?: string): NextResponse
export function notFound(message?: string): NextResponse
export function forbidden(message?: string): NextResponse
```

### Route handler pattern (após D2)
```typescript
// GET — sem CSRF
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { store } = await requireAuthorizedStore(params.id);
  // ...
}

// POST — CSRF primeiro
export async function POST(request: Request, { params }: { params: { id: string } }) {
  requireSameOrigin(request);
  const { store } = await requireAuthorizedStore(params.id);
  // ...
}
```

### RLS Policy Pattern
```sql
ALTER TABLE store_brand_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select_brand_assets" ON store_brand_assets
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())));
```

### Storage Policy Pattern
```sql
CREATE POLICY "tenant_isolation_brand_assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'store-brand-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())
    )
  );
```
</specifics>

<deferred>
## Deferred Ideas
- Testes RLS contra banco real/local — Fase 11
- Testes cross-tenant automatizados (E2E) — Fase 11
- E2E de sessão, onboarding e recuperação de senha — Fase 11
- Vazamento de sessionStorage entre usuários — Fase 11
- Inventário e migração do bucket `store-logos` — Fase 11 (exceção temporária documentada)
- StoreProvider (React Context) — postergado, props são suficientes
- Múltiplas lojas (1:N) — fora da milestone v1.2
- `allowedOrigins` no Next.js config — desnecessário, Server Actions têm proteção nativa
</deferred>

---

*Phase: 10-perimetro-multitenant*
*Context gathered: 2026-07-07 via OpenSpec Change Artifacts*
