# Alinhamento Fase 10 — Perímetro Multi-tenant

## Contexto

```
v1.2 — Contas e Propriedade          (milestone)
  ├── Fase 1 / Phase 7 — Sessão e Login Vertical    ✓ (concluída)
  ├── Fase 2 / Phase 8 — Ciclo de Conta             ✓ (concluída)
  ├── Fase 3 / Phase 9 — Cutover de Ownership       ✓ (concluída)
  ├── Fase 4 / Phase 10 — Perímetro Multi-tenant    ← esta fase
  └── Fase 5 / Phase 11 — Verificação e Hardening   (pendente)
```

Esta fase fecha o perímetro multi-tenant em toda a superfície existente: route handlers, Server Actions, RLS em tabelas filhas, Storage policies e CSRF. A Fase 9 estabeleceu ownership nas 4 rotas CRUD de store; a Fase 10 aplica o mesmo padrão nos ~24 métodos restantes e adiciona as camadas de defesa em profundidade.

**Dependências:** Fase 9 — precisa de `getCurrentStore()`, `requireOwnership()`, `StoreNotFoundError`, `buildStoreResponse()` e `stores.user_id` com RLS.

---

## Propósito

1. Definir `AuthorizedStoreContext` como contrato central de autorização
2. Implementar `requireAuthorizedStore(storeId)` — helper que retorna `AuthorizedStoreContext` (`{ userId, storeId, store }`) ou 404
3. Implementar `requireSameOrigin()` — guard CSRF para mutações POST/PATCH/DELETE
4. Implementar `JsonErrorResponse` helpers (`unauthorized()`, `notFound()`, `forbidden()`)
5. Aplicar `requireAuthorizedStore` nos ~20 route handlers store-scoped restantes (logo, brand-profile, visual-signature)
6. Aplicar `getCurrentStore()` em `/api/campaign/generate` (não aceitar `storeId` do cliente como autoridade)
7. Extrair 3 Server Actions de `src/lib/actions/store.ts` para `src/lib/store-identity-service.ts` como serviço interno
8. Adicionar `requireUser()` + `requireOwnership()` nas 4 Server Actions de `src/lib/visual-signature/server-actions.ts`
9. Habilitar RLS nas 4 tabelas filhas (`store_brand_assets`, `store_brand_profiles`, `store_visual_signatures` com SELECT do owner; `generation_events` default-deny)
10. Restringir políticas de SELECT amplas nos buckets de Storage (`store-brand-assets`, `visual-signatures`; documentar `store-logos` como exceção temporária)
11. Adicionar `requireSameOrigin()` em todas as mutações POST/PATCH/DELETE de route handlers
12. Criar matriz de testes parametrizados: matriz base por método (401, 404 alheia, 404 inexistente, sucesso) + matriz adicional de CSRF para mutações

**Entrega verificável:**
- Toda rota `/api/store/:id/*` (logo, brand-profile, visual-signature) exige `requireAuthorizedStore()`
- `/api/campaign/generate` resolve loja por `getCurrentStore()`, não por `storeId` do cliente
- `/api/campaign/generate-image` exige `requireOwnership(storeId)`
- Server Actions de visual-signature exigem `requireUser()` + `requireOwnership()` antes de `supabaseAdmin`
- 3 Server Actions de store viram serviços internos (sem `"use server"`, recebem `AuthorizedStoreContext`)
- 4 tabelas filhas com RLS: SELECT do owner; `generation_events` default-deny
- Buckets com políticas de SELECT restritas por path prefix `{store_id}/`
- Mutações POST/PATCH/DELETE validam mesma origem (CSRF)
- Com origem válida, loja alheia ou inexistente retorna 404, nunca 403 (invariante #4 da milestone). Mutações cross-origin retornam 403 (CSRF tem precedência sobre auth — ver D5)

---

## Estado Atual

```
                                  ANTES (Fase 9)                    DEPOIS (Fase 10)
═══════════════════════════════════════════════════════════════════════════════════
AuthorizedStoreContext              ✗ não existe                      ✓ { userId, storeId, store }
requireAuthorizedStore()            ✗ não existe                      ✓ retorna { userId, storeId, store }
requireSameOrigin()                 ✗ não existe                      ✓ guard CSRF
JsonErrorResponse helpers           ✗ repetido em cada rota           ✓ helpers centralizados

Route handlers:
  /api/store/ (POST + GET)          ✓ requireUser + getCurrentStore   ✓ mantido
  /api/store/[id] (GET + PATCH)     ✓ requireOwnership                ✓ mantido
  /api/store/[id]/logo/*            ✗ sem auth                        ✓ requireAuthorizedStore
  /api/store/[id]/brand-profile/*   ✗ sem auth                        ✓ requireAuthorizedStore
  /api/store/[id]/visual-signature/* ✗ sem auth                       ✓ requireAuthorizedStore
  /api/campaign/generate            ✗ sem auth, storeId do body       ✓ getCurrentStore()
  /api/campaign/generate-image      ✗ sem auth                        ✓ requireOwnership(storeId)

Server Actions:
  resolveStoreIdentity (store.ts)   ✗ supabaseAdmin sem auth          ✓ serviço interno, AuthorizedStoreContext
  validateIdentityReference         ✗ "use server" puro               ✓ serviço interno
  buildCampaignBrief                ✗ "use server" puro               ✓ serviço interno
  generateVariations (VS)           ✗ supabaseAdmin sem auth          ✓ requireUser + requireOwnership
  generateAutomatic (VS)            ✗ supabaseAdmin sem auth          ✓ requireUser + requireOwnership
  activateSignature (VS)            ✗ supabaseAdmin sem auth          ✓ requireUser + requireOwnership
  listSignatures (VS)               ✗ supabaseAdmin sem auth          ✓ requireUser + requireOwnership + supabaseAdmin.eq (service role, sem RLS)

RLS nas tabelas:
  stores                            ✓ SELECT policy                    ✓ mantido
  store_brand_assets                ✗ sem RLS                         ✓ SELECT policy (owner)
  store_brand_profiles              ✗ sem RLS                         ✓ SELECT policy (owner)
  store_visual_signatures           ✗ sem RLS                         ✓ SELECT policy (owner)
  generation_events                 ✗ sem RLS                         ✓ default-deny

Storage buckets:
  store-brand-assets                SELECT público irrestrito          ✓ SELECT por path {store_id}/
  visual-signatures                 SELECT público irrestrito          ✓ SELECT por path {store_id}/
  store-logos                       SELECT público irrestrito          ✓ exceção documentada (legado)

CSRF/same-origin                    ✗ não existe                      ✓ POST/PATCH/DELETE validam origem
Testes parametrizados               ✗ só store-ownership.test.ts      ✓ matriz base + matriz CSRF
```

---

## Decisões de Arquitetura

### D1 — Contrato central antes das edições: AuthorizedStoreContext + guards

`CONFIRMADO`

Antes de modificar qualquer rota, definir os contratos que todas as rotas usarão. Isso elimina repetição de padrões levemente diferentes em cada handler.

**AuthorizedStoreContext (contrato único):**
```typescript
export type AuthorizedStoreContext = {
  userId: string;   // claims.sub — única fonte de identidade
  storeId: string;  // stores.id — resolvido por requireOwnership
  store: Store;     // store completa, já autorizada
};
```

**Nota:** `AuthorizedStoreContext` não inclui `claims` avulsos. Se um consumer precisar de claims JWT, ele chama `requireUser()` separadamente. O objetivo do contexto é carregar o trio `userId + storeId + store` já validado, sem expor `user` ambíguo.

**requireAuthorizedStore(storeId):**
```typescript
export async function requireAuthorizedStore(
  storeId: string
): Promise<AuthorizedStoreContext> {
  const user = await requireApiUser();
  const store = await requireOwnership(storeId, user.userId);
  return { userId: user.userId, storeId: store.id, store }; // shape padronizado D1
}
```

**requireSameOrigin():**
```typescript
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (!origin) {
    throw new ForbiddenError("Origin header required");
  }

  try {
    const originUrl = new URL(origin);
    const expectedHost = forwardedHost || host;
    if (originUrl.host !== expectedHost) {
      throw new ForbiddenError("Cross-origin request denied");
    }
  } catch {
    throw new ForbiddenError("Invalid origin");
  }
}
```

**JsonErrorResponse helpers:**
```typescript
// src/lib/api-error-response.ts
export function unauthorized(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || "Unauthorized" },
    { status: 401 }
  );
}

export function notFound(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || "Not found" },
    { status: 404 }
  );
}

export function forbidden(message?: string): NextResponse {
  return NextResponse.json(
    { error: message || "Forbidden" },
    { status: 403 }
  );
}
```

**Motivo:** Os ~20 handlers que serão modificados seguem o mesmo padrão (requireUser + requireOwnership + try/catch). Centralizar os helpers reduz repetição, garante consistência de mensagens de erro e facilita manutenção futura.

---

### D2 — requireAuthorizedStore em todos os route handlers store-scoped

`CONFIRMADO`

Aplicar `requireAuthorizedStore(storeId)` em todos os route handlers de sub-recursos de store. O `:id` da rota é o `storeId` validado.

```
Arquivo                          Métodos          Guard
───                             ────────          ────
/store/[id]/logo                GET POST DELETE   requireAuthorizedStore(id)
/store/[id]/logo/retry          POST               requireAuthorizedStore(id)
/store/[id]/brand-profile       GET POST PATCH    requireAuthorizedStore(id)
/store/[id]/brand-profile/infer POST               requireAuthorizedStore(id)
/store/[id]/brand-profile/realign POST             requireAuthorizedStore(id)
/store/[id]/brand-profile/metadata PATCH           requireAuthorizedStore(id)
/store/[id]/brand-profile/gen-without-logo POST    requireAuthorizedStore(id)
/store/[id]/visual-signature    GET DELETE         requireAuthorizedStore(id)
/store/[id]/visual-signature/approve POST          requireAuthorizedStore(id)
/store/[id]/visual-signature/reject POST           requireAuthorizedStore(id)
/store/[id]/visual-signature/restore POST          requireAuthorizedStore(id)
/store/[id]/visual-signature/dismiss-crit-drift POST DELETE  requireAuthorizedStore(id)
/store/[id]/visual-signature/gen-without-logo POST requireAuthorizedStore(id)
/campaign/generate-image        POST               requireApiUser → body.storeId → requireOwnership(storeId, userId)
```

**Casos especiais:**

| Rota | Tratamento |
|------|------------|
| `/api/campaign/generate` | Usa `getCurrentStore()` — **não** aceita `storeId` do body como autoridade. O usuário gera campanha para sua própria loja, não para uma loja arbitrária |
| `/api/campaign/generate-image` | `requireApiUser()` → lê `storeId` do body → `requireOwnership(storeId, userId)` → usa store retornada pelo guard como loja autorizada |

**Motivo:** A Fase 9 já provou o padrão com `requireOwnership()` funcionando. Estender para todos os handlers é mecânico, não arquitetural — mas cada handler precisa ser tocado individualmente porque o Next.js App Router não oferece middleware de rota parametrizado por `[id]`.

---

### D3 — Server Actions: extração de serviços internos + entrypoints autenticados

`CONFIRMADO`

Conforme D11 do alinhamento da milestone, as 7 Server Actions se dividem em duas categorias:

**Três viram serviços internos (src/lib/store-identity-service.ts):**

| Função atual | Destino | Mudança |
|-------------|---------|---------|
| `resolveStoreIdentity(store)` | `src/lib/store-identity-service.ts` | Remove `"use server"`. Recebe `AuthorizedStoreContext` ou store já autorizada. ⚠️ Hoje usa `supabaseAdmin` para tabelas filhas — ao virar serviço interno, deve receber store/contexto já autorizado e **nunca aceitar `storeId` cru vindo do cliente** |
| `validateIdentityReference(snapshot)` | `src/lib/store-identity-service.ts` | Remove `"use server"`. Função pura, sem DB |
| `buildCampaignBrief(snapshot, input)` | `src/lib/store-identity-service.ts` | Remove `"use server"`. Função pura, sem DB |

**Callers:** Os componentes client que chamam essas Server Actions passam a chamar o serviço via props/server data. Se a chamada for de componente client, os dados já vêm autorizados do servidor. `resolveStoreIdentity()` jamais deve aceitar `storeId` como parâmetro direto vindo de parâmetro de URL ou body não validado.

**Quatro permanecem entrypoints autenticados (src/lib/visual-signature/server-actions.ts):**

| Função | Guard |
|--------|-------|
| `generateVariations(storeId)` | `requireUser()` + `requireOwnership(storeId)` antes de `supabaseAdmin` |
| `generateAutomatic(storeId)` | `requireUser()` + `requireOwnership(storeId)` antes de `supabaseAdmin` |
| `activateSignature(storeId, signatureId)` | `requireUser()` + `requireOwnership(storeId)` antes de `supabaseAdmin` |
| `listSignatures(storeId)` | `requireUser()` + `requireOwnership(storeId)` + `supabaseAdmin.from("store_visual_signatures").eq("store_id", storeId)` — sem RLS, porque a ação usa service role. Candidato a migração futura para Route Handler com cliente de sessão + RLS |

**Motivo da separação:** As 4 actions de visual-signature são entrypoints reais — chamadas por componentes client que disparam ações. Elas precisam do `"use server"`. As 3 de store são serviços internos chamados por outros serviços (route handlers, server components) — não precisam ser Server Actions. Extraí-las elimina o falso senso de segurança de `"use server"` e permite receber contexto autorizado diretamente.

---

### D4 — RLS nas tabelas filhas + Storage policies

`CONFIRMADO`

**RLS — Tabelas:**

| Tabela | RLS | Operações para `authenticated` | Policy |
|--------|-----|-------------------------------|--------|
| `store_brand_assets` | Habilitar | `SELECT` | `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))` |
| `store_brand_profiles` | Habilitar | `SELECT` | `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))` |
| `store_visual_signatures` | Habilitar | `SELECT` | `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))` |
| `generation_events` | Habilitar | **Nenhuma** (default-deny) | N/A — nenhuma policy para `authenticated` |

As policies de SELECT seguem o mesmo padrão da milestone (D6): subquery direta para `stores.user_id`, sem função no schema `auth`. Escritas permanecem em handlers privilegiados com `supabaseAdmin`, precedidos de `requireAuthorizedStore()`.

**RLS — Storage:**

> **Distinção importante:** A policy em `storage.objects` protege a **descoberta/listagem** de objetos via API do Storage. O bucket permanece `public = true`, o que permite **download por URL pública conhecida** (necessário para renderização de campanhas). Uma policy de SELECT restrita impede que um tenant liste os arquivos de outro, mas não bloqueia o acesso a uma URL direta. Os testes da Phase 10 devem validar o bloqueio de listagem, não necessariamente bloquear download público.

| Bucket | Política atual | Ação |
|--------|---------------|------|
| `store-brand-assets` | `public_read` SELECT para `public` (irrestrito) | Restringir: policy de SELECT verifica path prefix `{store_id}/`. Bucket `public = true` mantido para download por URL |
| `visual-signatures` | `public_read` SELECT para `public` (irrestrito) | Restringir: policy de SELECT verifica path prefix `{store_id}/`. Bucket `public = true` mantido para download por URL |
| `store-logos` | `public_read` SELECT para `public` (irrestrito) | **Exceção documentada.** Bucket legado não entra no escopo de migração. Política permanece como está. Inventário adiado para Fase 11. **⚠️ Nenhum fluxo novo deve ler/escrever em `store-logos` sem ownership check** — mesmo sendo legado, não pode virar rota de fuga |

**SQL de Storage (exemplo):**
```sql
-- Remover policy ampla de listagem
DROP POLICY IF EXISTS "brand_assets_public_read" ON storage.objects;

-- Criar policy que só permite SELECT de objetos no prefixo da store
-- Isso bloqueia listagem cross-tenant, mas não o download via URL conhecida
CREATE POLICY "brand_assets_read_own_store" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'store-brand-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())
    )
  );
```

**Observação crítica:** RLS é defesa em profundidade, não autorização primária. Como muitos fluxos ainda usam `supabaseAdmin` (que ignora RLS), a autorização real está nos guards `requireAuthorizedStore()` da Wave 1. A RLS protege o cliente de sessão (`createServerClient()`) e serve como barreira caso um guard seja esquecido.

---

### D5 — CSRF/same-origin nas mutações POST/PATCH/DELETE

`CONFIRMADO`

Toda mutação em route handler autenticado (POST, PATCH, PUT, DELETE) deve validar `Origin === Host || X-Forwarded-Host`. A validação é feita pelo helper `requireSameOrigin(request)`.

**Onde aplicar:**

| Rota | Métodos | CSRF |
|------|---------|------|
| `/api/store/[id]` | PATCH | ✅ |
| `/api/store/[id]/logo` | POST, DELETE | ✅ |
| `/api/store/[id]/logo/retry-brand-director` | POST | ✅ |
| `/api/store/[id]/brand-profile` | POST, PATCH | ✅ |
| `/api/store/[id]/brand-profile/*` | POST | ✅ |
| `/api/store/[id]/visual-signature/approve` | POST | ✅ |
| `/api/store/[id]/visual-signature/reject` | POST | ✅ |
| `/api/store/[id]/visual-signature/restore` | POST | ✅ |
| `/api/store/[id]/visual-signature/dismiss-critical-drift` | POST, DELETE | ✅ |
| `/api/store/[id]/visual-signature/generate-without-logo` | POST | ✅ |
| `/api/store/[id]/visual-signature` | DELETE | ✅ |
| `/api/campaign/generate` | POST | ✅ |
| `/api/campaign/generate-image` | POST | ✅ |
| `/auth/signout` | POST | ✅ |

**Exceções:**
- `GET` e `HEAD` não usam o guard (são idempotentes por natureza)
- `/auth/confirm` fica de fora (token assinado — CSRF não se aplica)

**Precedência de erros:** `requireSameOrigin()` roda antes de `requireAuthorizedStore()`. Isso significa que uma requisição cross-origin **sem sessão** retorna 403 (CSRF), não 401. É intencional: o guard de origem é mais barato (não lê banco) e a ordem é consistente em todas as mutações.

```typescript
export async function POST(request: Request) {
  requireSameOrigin(request); // ← first thing — precedência sobre auth

  const { userId, storeId, store } = await requireAuthorizedStore(id);
  // ... operação
}
```

**Implicações para testes:**
- Testes de "sem sessão" (cenário 401) devem usar `Origin` válida
- Testes de CSRF (cenário 403) devem usar sessão válida
- Em mutações, falha de origem tem precedência porque o guard roda antes da auth

**Server Actions:** Usam proteção nativa do Next.js (compara Origin com Host/X-Forwarded-Host). Não configurar `allowedOrigins` sem necessidade (conforme D9 da milestone).

---

### D6 — `/api/campaign/generate` usa `getCurrentStore()` como autoridade

`CONFIRMADO`

O endpoint `/api/campaign/generate` hoje aceita dados de briefing no body, sem validar se a loja pertence ao usuário. A correção:

```typescript
export async function POST(request: Request) {
  requireSameOrigin(request);
  const user = await requireApiUser();
  const store = await getCurrentStore(user.userId);
  if (!store) return notFound("Store not found");

  // store.id é a loja do usuário — ignora qualquer storeId do body
  const body = await request.json();
  // body NÃO contém storeId como autoridade
  // usa store.id como storeId
}
```

**`/api/campaign/generate-image`** segue padrão diferente (precisa de `storeId` explícito porque pode operar sobre assets de uma store específica):
```typescript
export async function POST(request: Request) {
  requireSameOrigin(request);
  const user = await requireApiUser();
  const body = await request.json();
  const store = await requireOwnership(body.storeId, user.userId);
  // store já está autorizada — usa store.id como storeId
}
```

**Motivo:** Um usuário autenticado só pode gerar campanhas para **sua própria loja**. Aceitar `storeId` do cliente permitiria que um usuário gerasse campanhas para lojas de outros tenants. Este é o ponto mais crítico da segurança de campanha.

---

### D7 — Padronização do tratamento de erro em helper compartilhado

`CONFIRMADO`

Em vez de repetir `try/catch` com `UnauthorizedError` e `StoreNotFoundError` em cada handler, usar `requireAuthorizedStore()` que já propaga o erro correto. Para erros de CSRF, criar `ForbiddenError`.

**⚠️ Atenção à implementação:** `UnauthorizedError` já existe em `src/lib/auth/require-user.ts` e `StoreNotFoundError` já existe em `src/lib/auth/store-ownership.ts`. A implementação deve **mover** as classes existentes para `src/lib/auth/errors.ts` e **reexportá-las** dos arquivos originais, não criar classes duplicadas. Caso contrário, `instanceof` pode falhar entre módulos que importam de fontes diferentes.

```typescript
// src/lib/auth/errors.ts ← NOVO: classes movidas para cá
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") { super(message); this.name = "UnauthorizedError"; }
}

export class StoreNotFoundError extends Error {
  constructor(message = "Store not found or access denied") { super(message); this.name = "StoreNotFoundError"; }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") { super(message); this.name = "ForbiddenError"; }
}

// src/lib/auth/require-user.ts — reexportar de errors.ts (remover class original)
// src/lib/auth/store-ownership.ts — reexportar de errors.ts (remover class original)
```

**Padrão de handler após a fase (shape consistente com AuthorizedStoreContext):**
```typescript
export async function GET(request: Request) {
  try {
    const { userId, storeId, store } = await requireAuthorizedStore(id);
    // ... operação com store já autorizada
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    if (error instanceof StoreNotFoundError) return notFound();
    if (error instanceof ForbiddenError) return forbidden();
    throw error;
  }
}
```

---

### D8 — Testes por onda + matriz parametrizada final

`CONFIRMADO`

Testes são escritos em cada onda, não postergados para o final. A onda final adiciona uma matriz parametrizada para garantir cobertura transversal.

**Onda 1 (guards):** Testes unitários para `requireAuthorizedStore()`, `requireSameOrigin()`, `JsonErrorResponse`. Testes de handler para 1-2 rotas como prova de padrão.

**Onda 2 (Server Actions):** Testes para cada Server Action com `requireUser()` mockado e ownership validado.

**Onda 3 (RLS):** Testes de migration/static SQL (validar que as policies existem e têm a sintaxe correta) + regressão de uso app-side (validar que as queries continuam funcionando com o novo schema). **A prova real com Supabase local fica para a Phase 11** — nesta fase, o RLS é verificado por migração aplicada + testes de integração mockados que comprovam que `createServerClient()` passa pelo guard antes de `supabaseAdmin`.

**Onda 4 (matriz parametrizada):** Testes parametrizados em duas camadas:

**Matriz base** (todos os ~24 métodos):
| Cenário | Status esperado | Requisito |
|---------|-----------------|-----------|
| Sem sessão (origem válida) | 401 JSON | Auth falha antes de ownership |
| Store alheia (sessão própria) | 404 JSON | StoreNotFoundError |
| Store inexistente (sessão própria) | 404 JSON | StoreNotFoundError |
| Store própria existe | 200 / ação executada | GET, POST, PATCH, DELETE |

**Matriz CSRF** (apenas mutações POST/PATCH/DELETE):
| Cenário | Status esperado | Requisito |
|---------|-----------------|-----------|
| Cross-origin com sessão válida | 403 JSON | CSRF guard rejeita |
| Cross-origin sem sessão | 403 JSON | CSRF tem precedência sobre auth |
| Mesma origem sem sessão | 401 JSON | Auth falha, origem válida não bloqueia |

**Critério central da matriz:** Com origem válida, store alheia e inexistente retornam 404, nunca 403 (invariante #4 da milestone).

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Rota esquecida — handler sem guard continua aberto** | Alto — brecha de segurança | Matriz de ~24 métodos documentada (D2). Checklist explícito. Testes parametrizados forçam cobertura |
| **Falsa sensação de que "RLS resolveu tudo"** | Alto — supabaseAdmin bypassa RLS | RLS é defesa em profundidade. Autorização primária é `requireAuthorizedStore()` antes de `supabaseAdmin`. Documentado em D4 |
| **CSRF bloqueia chamada legítima de mesmo origem** | Baixo — rota quebra | Cenário normal: Origin === Host. Se houver proxy (X-Forwarded-Host), o header é respeitado. Testado na matriz |
| **Server Action removida ("use server") quebra import client** | Médio — componente client tenta importar arquivo que não exporta Server Action | Extrair serviço para arquivo novo. Manter arquivo original com `"use server"` redirecionando para o serviço, ou mudar callers. Preferir mudar callers |
| **Migration de Storage policy quebra download de asset** | Alto — imagens de campanha deixam de carregar | Policy `FOR SELECT TO authenticated` mantém acesso a prefixos da própria loja. Buckets permanecem `public = true` para download por URL conhecida |
| **Testes parametrizados não cobrem método POST vs GET no mesmo arquivo** | Médio — cobertura incompleta | Matriz itera por método HTTP, não por arquivo. Cada método é um caso de teste |
| **`/api/campaign/generate` com getCurrentStore quebra cliente que envia storeId** | Médio — cliente existente precisa ser atualizado | Cliente já tem acesso à store via props. Atualizar chamada para não enviar storeId. Compatibilidade retroativa não é prioridade de segurança |

---

## Fora de Escopo

| Item | Motivo |
|------|--------|
| Testes RLS contra banco real/local | Fase 11 — requer setup de Supabase local |
| Testes cross-tenant automatizados (E2E) | Fase 11 — requer ferramenta de browser automation |
| E2E de sessão, onboarding e recuperação de senha | Fase 11 |
| Vazamento de sessionStorage entre usuários | Fase 11 |
| Inventário e migração do bucket `store-logos` | Fase 11 (exceção temporária documentada em D4) |
| StoreProvider (React Context) | Postergado — props são suficientes |
| Múltiplas lojas (1:N) | Fora de escopo da milestone v1.2 |
| `allowedOrigins` no Next.js config | Desnecessário — Server Actions têm proteção nativa (D9 da milestone) |

---

## Critérios de Aceite

### Macro-critério

> Toda superfície existente respeita o tenant: handlers, storage e Server Actions autenticam e autorizam. Nenhuma rota revela dados de loja alheia. Mutações de origem cruzada são rejeitadas.

### Cenários de verificação

| # | Cenário | Critério |
|---|---------|----------|
| 1 | `requireAuthorizedStore(storeId)` retorna contexto para owner | `{ userId, storeId, store }` (shape D1) |
| 2 | `requireAuthorizedStore(storeId)` para loja alheia | 404 (StoreNotFoundError) |
| 3 | `requireAuthorizedStore(storeId)` para loja inexistente | 404 |
| 4 | `requireAuthorizedStore(storeId)` sem sessão | 401 |
| 5 | `requireSameOrigin(request)` com Origin === Host | Passa sem erro |
| 6 | `requireSameOrigin(request)` com Origin !== Host | Lança ForbiddenError |
| 7 | `requireSameOrigin(request)` sem Origin header | Lança ForbiddenError |
| 8 | `GET /api/store/:id/logo` para própria loja | 200, logo retornada |
| 9 | `GET /api/store/:id/logo` para loja alheia | 404 |
| 10 | `POST /api/store/:id/logo` para própria loja | Logo uploaded (requer auth + ownership) |
| 11 | `POST /api/store/:id/logo` cross-origin | 403 |
| 12 | `GET /api/store/:id/brand-profile` para própria loja | 200 |
| 13 | `GET /api/store/:id/brand-profile` para loja alheia | 404 |
| 14 | `PATCH /api/store/:id/brand-profile` para própria loja | 200 |
| 15 | `POST /api/store/:id/brand-profile/infer` para loja alheia | 404 |
| 16 | `GET /api/store/:id/visual-signature` para própria loja | 200 |
| 17 | `GET /api/store/:id/visual-signature` para loja alheia | 404 |
| 18 | `POST /api/store/:id/visual-signature/approve` própria loja | 200 |
| 19 | `POST /api/store/:id/visual-signature/reject` loja alheia | 404 |
| 20 | `POST /api/campaign/generate` para própria loja | 200, campanha gerada |
| 21 | `POST /api/campaign/generate` com storeId alheia no body | Ignorado, usa getCurrentStore() |
| 22 | `POST /api/campaign/generate-image` para própria loja | 200, imagem gerada |
| 23 | `POST /api/campaign/generate-image` para loja alheia | 404 |
| 24 | Mutação POST sem sessão e origem válida | 401 JSON (auth falha, origem válida não bloqueia) |
| 25 | Mutação POST cross-origin com sessão válida | 403 JSON (CSRF tem precedência) |
| 26 | Mutação POST cross-origin **e** sem sessão | 403 JSON (CSRF tem precedência sobre auth — guard roda primeiro) |
| 27 | `resolveStoreIdentity` como serviço interno (sem `"use server"`) | Chamado via contexto autorizado |
| 28 | `validateIdentityReference` como serviço interno | Função pura, sem DB |
| 29 | `buildCampaignBrief` como serviço interno | Função pura, sem DB |
| 30 | `generateVariations` com sessão inválida | 401 |
| 31 | `generateVariations` com storeId alheia | 404 |
| 32 | `activateSignature` com storeId alheia | 404 |
| 33 | `listSignatures` com sessão válida + store própria | Lista retornada (filtrada por `supabaseAdmin.eq("store_id", storeId)` — service role, sem RLS) |
| 34 | RLS: `store_brand_assets` SELECT filtrando por owner | Apenas registros da própria loja |
| 35 | RLS: `store_brand_profiles` SELECT filtrando por owner | Apenas registros da própria loja |
| 36 | RLS: `store_visual_signatures` SELECT filtrando por owner | Apenas registros da própria loja |
| 37 | RLS: `generation_events` default-deny | authenticated não vê nada |
| 38 | Storage: SELECT em `store-brand-assets/{storeId}/...` | Apenas objetos do próprio prefixo |
| 39 | Storage: SELECT em `visual-signatures/{storeId}/...` | Apenas objetos do próprio prefixo |
| 40 | Matriz base cobre todos os ~24 métodos | Cada método x 4 cenários (401, 404 alheia, 404 inexistente, sucesso) |
| 41 | Matriz CSRF cobre mutações POST/PATCH/DELETE | Cada mutação x 3 cenários (cross-origin c/ sessão, cross-origin s/ sessão, mesma origem s/ sessão) |
| 42 | Regressão: testes existentes continuam passando | `npx vitest run` exit 0 |

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-07-07 | D1 — AuthorizedStoreContext + requireAuthorizedStore + requireSameOrigin + JsonErrorResponse como contratos centrais criados antes das edições |
| 2026-07-07 | D2 — requireAuthorizedStore aplicado em ~20 route handlers de sub-recursos. /api/campaign/generate usa getCurrentStore() |
| 2026-07-07 | D3 — Server Actions: 3 viram serviços internos (store-identity-service.ts), 4 ganham requireUser + requireOwnership |
| 2026-07-07 | D4 — RLS nas 4 tabelas filhas com subquery direta. Storage SELECT restrito por path prefix. store-logos como exceção documentada |
| 2026-07-07 | D5 — CSRF/same-origin em todas as mutações POST/PATCH/DELETE de route handlers via requireSameOrigin() |
| 2026-07-07 | D6 — /api/campaign/generate usa getCurrentStore(), ignora storeId do cliente |
| 2026-07-07 | D7 — Erros padronizados: UnauthorizedError/StoreNotFoundError/ForbiddenError + helpers de resposta JSON |
| 2026-07-07 | D8 — Testes por onda + matriz parametrizada final. Matriz base: ~24 métodos x 4 cenários. Matriz CSRF: mutações x 3 cenários. Store alheia → 404 (origem válida), cross-origin → 403 (precedência sobre auth) |

---

## Checklist de Revisão

### Wave 0 — Contratos
- [ ] `src/lib/auth/errors.ts` — criado com `UnauthorizedError`, `StoreNotFoundError` e `ForbiddenError` (classes movidas + reexportadas dos arquivos originais, sem duplicação — `instanceof` precisa funcionar entre módulos)
- [ ] `src/lib/auth/require-user.ts` — `UnauthorizedError` reexportado de `errors.ts` (class original removida)
- [ ] `src/lib/auth/store-ownership.ts` — `StoreNotFoundError` reexportado de `errors.ts` (class original removida); `requireAuthorizedStore(storeId)` adicionado retornando `{ userId, storeId, store }` (shape AuthorizedStoreContext)
- [ ] `src/lib/auth/csrf.ts` — `requireSameOrigin(request)` implementado
- [ ] `src/lib/api-error-response.ts` — `unauthorized()`, `notFound()`, `forbidden()` helpers de NextResponse.json

### Wave 1 — Route handlers store-scoped
- [ ] `/api/store/[id]/logo/route.ts` — GET/POST/DELETE com `requireAuthorizedStore(id)` + CSRF em POST/DELETE
- [ ] `/api/store/[id]/logo/retry-brand-director/route.ts` — POST com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/brand-profile/route.ts` — GET/POST/PATCH com `requireAuthorizedStore(id)` + CSRF em POST/PATCH
- [ ] `/api/store/[id]/brand-profile/infer/route.ts` — POST com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/brand-profile/realign/route.ts` — POST com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/brand-profile/metadata/route.ts` — PATCH com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/brand-profile/generate-without-logo/route.ts` — POST com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/visual-signature/route.ts` — GET/DELETE com `requireAuthorizedStore(id)` + CSRF em DELETE
- [ ] `/api/store/[id]/visual-signature/approve/route.ts` — POST com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/visual-signature/reject/route.ts` — POST com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/visual-signature/restore/route.ts` — POST com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/visual-signature/dismiss-critical-drift/route.ts` — POST/DELETE com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/store/[id]/visual-signature/generate-without-logo/route.ts` — POST com `requireAuthorizedStore(id)` + CSRF
- [ ] `/api/campaign/generate/route.ts` — POST com `getCurrentStore()` + CSRF (não aceita storeId do body)
- [ ] `/api/campaign/generate-image/route.ts` — POST com `requireOwnership(storeId)` + CSRF

### Wave 2 — Server Actions
- [ ] `src/lib/store-identity-service.ts` — criado com `resolveStoreIdentity`, `validateIdentityReference`, `buildCampaignBrief` (sem `"use server"`)
- [ ] `src/lib/actions/store.ts` — callers atualizados para usar o serviço (não Server Action)
- [ ] `src/lib/actions/store.ts` — `"use server"` removido (ou mantido como wrapper fino se necessário para compatibilidade)
- [ ] `src/lib/visual-signature/server-actions.ts` — `generateVariations()` com `requireUser()` + `requireOwnership(storeId)`
- [ ] `src/lib/visual-signature/server-actions.ts` — `generateAutomatic()` com `requireUser()` + `requireOwnership(storeId)`
- [ ] `src/lib/visual-signature/server-actions.ts` — `activateSignature()` com `requireUser()` + `requireOwnership(storeId)`
- [ ] `src/lib/visual-signature/server-actions.ts` — `listSignatures()` com `requireUser()` + `requireOwnership(storeId)` + `supabaseAdmin.eq("store_id", storeId)` (service role, sem RLS)

### Wave 3 — RLS + Storage
- [ ] Migration: RLS habilitado em `store_brand_assets` + SELECT policy do owner
- [ ] Migration: RLS habilitado em `store_brand_profiles` + SELECT policy do owner
- [ ] Migration: RLS habilitado em `store_visual_signatures` + SELECT policy do owner
- [ ] Migration: RLS habilitado em `generation_events` — default-deny (nenhuma policy para authenticated)
- [ ] Storage: policy ampla de SELECT removida de `store-brand-assets`
- [ ] Storage: nova policy SELECT por path prefix `{store_id}/` em `store-brand-assets`
- [ ] Storage: policy ampla de SELECT removida de `visual-signatures`
- [ ] Storage: nova policy SELECT por path prefix `{store_id}/` em `visual-signatures`
- [ ] Storage: `store-logos` documentado como exceção temporária (policy ampla mantida)

### Wave 4 — Testes
- [ ] Testes: `requireAuthorizedStore` (contexto, 404, 401)
- [ ] Testes: `requireSameOrigin` (mesma origem, origem diferente, sem origin)
- [ ] Testes: `JsonErrorResponse` helpers
- [ ] Testes: 1-2 handlers store-scoped como prova de padrão (ex: logo GET, brand-profile PATCH)
- [ ] Testes: Server Actions — cada entrypoint com auth + ownership mockados
- [ ] Testes: serviços internos — sem `"use server"`, chamados diretamente
- [ ] Matriz base: todos os ~24 métodos x 4 cenários (401 origem válida, 404 alheia, 404 inexistente, sucesso)
- [ ] Matriz CSRF: mutações POST/PATCH/DELETE x 3 cenários (cross-origin c/ sessão, cross-origin s/ sessão, mesma origem s/ sessão)
- [ ] Regressão: todos os testes existentes continuam passando

### Wave 5 — Validação
- [ ] `npx tsc --noEmit` — zero erros de tipo
- [ ] `npx vitest run` — todos os testes verdes
- [ ] `npm run lint` — zero erros de lint
- [ ] `npx next build` — build bem-sucedido
- [ ] Checklist de exceções: rotas/métodos intencionalmente sem guard (se houver) documentados com motivo
- [ ] **`store-logos`**: nenhum fluxo novo lê ou escreve no bucket legado sem ownership check. Todo acesso novo deve passar por `requireAuthorizedStore()` antes de operar. Revisão manual de diff para confirmar

---

*Documento criado: 2026-07-07*
*Baseado no alinhamento da milestone v1.2 (D1–D11) e no padrão de alinhamento das Fases 7, 8 e 9*
*Próximo passo: revisão do time, ajustes, então avançar para artefatos de implementação*
