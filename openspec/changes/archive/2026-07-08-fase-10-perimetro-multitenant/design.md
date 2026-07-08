## Context

A Fase 9 entregou `getCurrentStore()`, `requireOwnership()`, `StoreNotFoundError`, `buildStoreResponse()` e `stores.user_id` com RLS — aplicados nas 4 rotas CRUD de store. O alinhamento da Fase 10 (`docs/alinhamento-fase-10-perimetro-multitenant.md`) define 8 decisões de arquitetura (D1-D8) que este design implementa.

O estado atual tem ~20 route handlers de sub-recursos sem qualquer autenticação, 7 Server Actions usando `supabaseAdmin` sem validação de ownership, 4 tabelas filhas sem RLS, e 2 buckets de Storage com SELECT público irrestrito. Esta fase fecha todo o perímetro.

## Goals / Non-Goals

**Goals:**
- Criar `AuthorizedStoreContext` (`{ userId, storeId, store }`) como contrato central
- Implementar `requireAuthorizedStore(storeId)` — retorna contexto ou 404
- Implementar `requireSameOrigin(request)` — guard CSRF para mutações POST/PATCH/DELETE
- Centralizar classes de erro (`UnauthorizedError`, `StoreNotFoundError`, `ForbiddenError`) em `src/lib/auth/errors.ts` e reexportar dos arquivos originais (sem duplicação — `instanceof` precisa funcionar)
- Criar helpers `JsonErrorResponse` (`unauthorized()`, `notFound()`, `forbidden()`) em `src/lib/api-error-response.ts`
- Aplicar `requireAuthorizedStore` + CSRF nos ~20 route handlers store-scoped (logo, brand-profile, visual-signature)
- Aplicar `getCurrentStore()` em `/api/campaign/generate` (ignorar `storeId` do body)
- Aplicar `requireOwnership(storeId)` em `/api/campaign/generate-image`
- Extrair 3 Server Actions de `store.ts` para `store-identity-service.ts` como serviço interno
- Adicionar `requireUser()` + `requireOwnership()` nas 4 Server Actions de visual-signature
- Habilitar RLS nas 4 tabelas filhas com SELECT policy do owner; `generation_events` default-deny
- Restringir Storage policies nos buckets `store-brand-assets` e `visual-signatures` por path prefix `{store_id}/`
- Criar matriz de testes parametrizados: base (~24 métodos x 4 cenários) + CSRF (mutações x 3 cenários)
- `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, `npx next build` — todos verdes

**Non-Goals:**
- Testes RLS contra banco real/local — Fase 11
- Testes cross-tenant automatizados (E2E) — Fase 11
- E2E de sessão, onboarding e recuperação de senha — Fase 11
- Vazamento de sessionStorage entre usuários — Fase 11
- Inventário e migração do bucket `store-logos` — Fase 11 (exceção temporária documentada)
- StoreProvider (React Context) — postergado, props são suficientes
- Múltiplas lojas (1:N) — fora da milestone v1.2
- `allowedOrigins` no Next.js config — desnecessário, Server Actions têm proteção nativa

## Decisions

### D1 — AuthorizedStoreContext + requireAuthorizedStore + requireSameOrigin + JsonErrorResponse como contratos antes das edições

Criar os 4 contratos antes de modificar qualquer rota. Isso elimina repetição de padrões levemente diferentes em cada handler.

**AuthorizedStoreContext:**
```typescript
export type AuthorizedStoreContext = {
  userId: string;   // claims.sub
  storeId: string;  // stores.id
  store: Store;     // já autorizada
};
```

**requireAuthorizedStore(storeId):** Chama `requireApiUser()` + `requireOwnership(storeId, user.userId)` e retorna o contexto padronizado.

**requireSameOrigin(request):** Lê `origin`, `host`, `x-forwarded-host`. Se origin !== host, lança `ForbiddenError`. Roda antes de `requireAuthorizedStore()` em mutações — CSRF tem precedência sobre auth.

**JsonErrorResponse helpers:** `unauthorized()` (401), `notFound()` (404), `forbidden()` (403) — `NextResponse.json` padronizados.

### D2 — requireAuthorizedStore em todos os route handlers store-scoped

Aplicar `requireAuthorizedStore(storeId)` nos handlers listados na proposta. O `:id` da rota é o `storeId` validado. Em mutações POST/PATCH/DELETE, `requireSameOrigin()` roda primeiro.

Casos especiais:
- `/api/campaign/generate`: usa `getCurrentStore()` — não aceita `storeId` do body
- `/api/campaign/generate-image`: `requireApiUser()` → body `storeId` → `requireOwnership(storeId, userId)`

### D3 — Server Actions: extração de serviços internos + entrypoints autenticados

**3 viram serviços internos (`src/lib/store-identity-service.ts`):**
- `resolveStoreIdentity(store)` — remove `"use server"`, recebe store já autorizada
- `validateIdentityReference(snapshot)` — função pura, sem DB
- `buildCampaignBrief(snapshot, input)` — função pura, sem DB

**4 permanecem entrypoints autenticados (`server-actions.ts`):**
- `generateVariations(storeId)` — `requireUser()` + `requireOwnership(storeId)` antes de `supabaseAdmin`
- `generateAutomatic(storeId)` — mesmo padrão
- `activateSignature(storeId, signatureId)` — mesmo padrão
- `listSignatures(storeId)` — mesmo padrão + `supabaseAdmin.eq("store_id", storeId)` (service role, sem RLS)

### D4 — RLS + Storage policies como defesa em profundidade

**RLS — Tabelas:** SELECT policies usando subquery direta: `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))`. Escritas permanecem em handlers privilegiados com `supabaseAdmin`.

| Tabela | Policy |
|--------|--------|
| `store_brand_assets` | SELECT do owner |
| `store_brand_profiles` | SELECT do owner |
| `store_visual_signatures` | SELECT do owner |
| `generation_events` | default-deny |

**Storage:** Políticas `FOR SELECT TO authenticated` com verificação de path prefix via `storage.foldername(name)`. Buckets permanecem `public = true` para download por URL conhecida.

### D5 — CSRF/same-origin em todas as mutações POST/PATCH/DELETE

`requireSameOrigin(request)` como primeiro guard em toda mutação de route handler. Precedência: CSRF (403) → Auth (401) → Ownership (404). Server Actions mantêm proteção nativa do Next.js.

### D6 — /api/campaign/generate usa getCurrentStore()

O endpoint resolve a loja do usuário autenticado via `getCurrentStore(user.userId)`. Qualquer `storeId` enviado no body é ignorado — não pode ser usado como autoridade.

### D7 — Erros centralizados em errors.ts

`UnauthorizedError`, `StoreNotFoundError`, `ForbiddenError` movidos para `src/lib/auth/errors.ts`. Arquivos originais (`require-user.ts`, `store-ownership.ts`) reexportam de `errors.ts` para manter compatibilidade de `instanceof`.

### D8 — Testes por onda + matriz parametrizada final

Testes escritos em cada onda:

| Onda | Escopo |
|------|--------|
| 1 (guards) | Unitários: requireAuthorizedStore, requireSameOrigin, JsonErrorResponse. Handler: 1-2 rotas como prova |
| 2 (Server Actions) | Cada entrypoint com requireUser + ownership mockados |
| 3 (RLS) | Migração SQL + regressão app-side (mock) |
| 4 (matriz) | Três bases (storeId-scoped, current-store, POST /api/store) + CSRF: mutações x 3 cenários |

**Matriz base — storeId-scoped** (~20 endpoints com storeId explícito via `:id` ou body):
| Cenário | Status | Requisito |
|---------|--------|-----------|
| Sem sessão (origem válida) | 401 | Auth falha antes de ownership |
| Store alheia (sessão própria) | 404 | StoreNotFoundError |
| Store inexistente | 404 | StoreNotFoundError |
| Store própria | 200 / ação | Sucesso |

**Matriz base — current-store** (POST /api/campaign/generate, resolve por getCurrentStore()):
| Cenário | Status | Requisito |
|---------|--------|-----------|
| Sem sessão (origem válida) | 401 | Auth falha |
| Usuário sem loja | 404 | getCurrentStore retorna null |
| StoreId malicioso no body | 200 | Ignorado, usa loja atual |
| Válido | 200 | Campanha gerada |

**Matriz base — POST /api/store** (criação, usa claims.sub):
| Cenário | Status | Requisito |
|---------|--------|-----------|
| Cross-origin com sessão | 403 | CSRF tem precedência |
| Mesma origem sem sessão | 401 | Auth falha |
| Válido | 200/201 | Loja criada |
| Duplicata | 409 | UNIQUE violation |
| user_id no body ignorado | 200/201 | claims.sub usado |

**Matriz CSRF** (apenas mutações):
| Cenário | Status | Requisito |
|---------|--------|-----------|
| Cross-origin com sessão | 403 | CSRF rejeita |
| Cross-origin sem sessão | 403 | CSRF tem precedência |
| Mesma origem sem sessão | 401 | Auth falha |

## Risks / Trade-offs

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Rota esquecida — handler sem guard | Alto | Checklist explícito de ~24 métodos. Testes parametrizados forçam cobertura |
| Falsa sensação que "RLS resolveu tudo" | Alto | RLS é defesa em profundidade. Autorização primária é requireAuthorizedStore() |
| CSRF bloqueia chamada legítima de mesma origem | Baixo | Origin === Host é o caso normal. Proxy com X-Forwarded-Host é respeitado |
| Server Action removida quebra import client | Médio | Extrair serviço para arquivo novo. Manter arquivo original com wrapper ou mudar callers |
| Migration de Storage policy quebra download | Alto | Policy FOR SELECT TO authenticated. Buckets mantidos public = true para URL direta |
| /api/campaign/generate com getCurrentStore quebra cliente que envia storeId | Médio | Cliente já tem store via props. Atualizar chamada. Compatibilidade retroativa não é prioridade |
