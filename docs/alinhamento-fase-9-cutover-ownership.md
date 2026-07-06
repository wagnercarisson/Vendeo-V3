# Alinhamento Fase 9 — Cutover de Ownership e Onboarding

## Contexto

```
v1.2 — Contas e Propriedade          (milestone)
  ├── Fase 1 / Phase 7 — Sessão e Login Vertical    ✓ (concluída)
  ├── Fase 2 / Phase 8 — Ciclo de Conta             ✓ (concluída)
  ├── Fase 3 / Phase 9 — Cutover de Ownership       ← esta fase
  ├── Fase 4 / Phase 10 — Perímetro Multi-tenant    (pendente)
  └── Fase 5 / Phase 11 — Verificação e Hardening   (pendente)
```

Esta fase vincula o usuário autenticado à sua loja: `stores.user_id`, `getCurrentStore()`, `requireOwnership()`, criação de loja no onboarding, remoção do `localStorage("store_id")`, RLS em `stores` e propagação de `storeId` por props.

**Dependências:** Fase 7 + Fase 8 — precisa de `requireUser()`, middleware, login, signup, recuperação de senha.

---

## Propósito

1. Adicionar `user_id` à tabela `stores` (NOT NULL UNIQUE REFERENCES `auth.users(id)`)
2. Criar `getCurrentStore()` — resolve loja por `claims.sub`
3. Criar `requireOwnership(storeId)` — valida que store pertence ao usuário
4. Aplicar `requireOwnership()` em `GET /api/store/:id` e `PATCH /api/store/:id`
5. Aplicar `requireUser()` + `claims.sub` em `POST /api/store`
6. Criar `GET /api/store` (sem `:id`) como atalho para loja corrente
7. Implementar `/store` em modo create (sem loja) e edit (com loja)
8. Adicionar server wrapper em `/campaign/preview` com validação de auth + loja
9. Remover `localStorage("store_id")` de todos os arquivos
10. Resolver e propagar `storeId` por server components → props para client
11. Habilitar RLS em `stores` (SELECT policy para owner)
12. Redirecionar `/` e `/campaign/preview` para `/store` quando usuário não tem loja

**Entrega verificável:**
- Usuário autenticado sem loja acessa `/` ou `/campaign/preview` → redirect `/store` (create)
- Usuário autenticado cria loja → redirect `/` (campaign)
- Usuário retorna → `getCurrentStore()` resolve a loja dele
- Usuário não acessa loja alheia (404, não 403)
- `POST /api/store`, `GET /api/store`, `GET /api/store/:id`, `PATCH /api/store/:id` validam auth e ownership
- `localStorage("store_id")` não existe mais em nenhum arquivo

---

## Estado Atual

```
                            ANTES (Fase 8)                    DEPOIS (Fase 9)
═══════════════════════════════════════════════════════════════════════════════════
stores.user_id              ✗ não existe                      ✓ NOT NULL UNIQUE
RLS em stores               ✗ não existe                      ✓ SELECT policy
getCurrentStore()           ✗ não existe                      ✓ resolve por claims.sub
requireOwnership()          ✗ não existe                      ✓ valida ownership
POST /api/store             ✗ sem auth, sem user_id           ✓ requireUser() + claims.sub
GET /api/store/:id          ✗ sem auth, supabaseAdmin         ✓ requireOwnership()
PATCH /api/store/:id        ✗ sem auth, supabaseAdmin         ✓ requireOwnership()
GET /api/store (atalho)     ✗ não existe                      ✓ requireApiUser() + getCurrentStore()
localStorage("store_id")    presente em 3 components + logout  ✓ removido
/store page                 sem auth check                    ✓ requirePageUser() server-side
/ (campaign)                lê localStorage no mount           ✓ server resolve, redirect se sem loja
propagação de storeId       localStorage → fetch               ✓ server → props
dados de loja               acessíveis por qualquer UUID           ✓ isolados por ownership (CRUD)
/campaign/preview           client page lê sessionStorage          ✓ server wrapper valida auth + loja
logout limpa store_id       ✓ (sintoma, não solução)              ✓ não precisa mais (store não está localStorage)
```

---

## Decisões de Arquitetura

### D1 — Ownership nas rotas CRUD de store (escopo de fase: 4 rotas)

`CONFIRMADO`

O helper `requireOwnership(storeId)` é criado na Fase 9 e aplicado nas rotas CRUD de store. As rotas de sub-recursos (logo, brand-profile, visual-signature, campaign) recebem o mesmo helper na Fase 10 — não fazem parte do escopo da Fase 9.

**Motivo da decisão:** supabaseAdmin bypassa RLS. Confiar apenas em RLS criaria uma falsa sensação de segurança — service role ignora RLS. Toda rota que usa `supabaseAdmin` precisa validar ownership antes de chamar o banco. Por isso, mesmo com RLS em `stores`, as rotas que usam service role precisam do guard explícito.

**Escopo da Fase 9 (apenas estas 4 rotas):**

| Rota | Ação |
|------|------|
| `POST /api/store` | `requireUser()` + `claims.sub` (exceção invariante #11) |
| `GET /api/store` | `requireApiUser()` + `getCurrentStore()` |
| `GET /api/store/:id` | `requireOwnership(id)` |
| `PATCH /api/store/:id` | `requireOwnership(id)` |

**Escopo da Fase 10 (não tocar agora):**

| Rota | Ação |
|------|------|
| `/api/store/:id/logo/*` | `requireOwnership(id)` |
| `/api/store/:id/brand-profile/*` | `requireOwnership(id)` |
| `/api/store/:id/visual-signature/*` | `requireOwnership(id)` |
| `/api/campaign/generate` | `requireUser()` + `getCurrentStore()` (loja obrigatória) |
| `/api/campaign/generate-image` | `requireOwnership(storeId)` |
| Server Actions D11 | `requireUser()` + `requireOwnership()` |

---

### D2 — stores.user_id + RLS + validação backend (belt and suspenders)

`CONFIRMADO`

Duas camadas de proteção, não mutuamente exclusivas:

1. **RLS (row-level security):** policy `FOR SELECT` em `stores` garante que cliente de sessão (`createServerClient()`) só vê a própria loja.
2. **Validação backend:** `requireOwnership()` com `createServerClient()` + RLS verifica antes de qualquer operação com `supabaseAdmin`.

**Por que as duas?** As rotas atuais usam `supabaseAdmin` (service_role) que ignora RLS completamente. Mesmo migrando gradualmente para `createServerClient()`, o padrão de segurança da milestone exige ownership validado antes de qualquer operação privilegiada (invariante #8). A RLS é proteção adicional para o cliente de sessão; o guard backend é a autorização explícita.

**Esquema da migration:**

```sql
-- Ordem obrigatória: limpar filhas antes de tocar em stores
-- (não há ON DELETE CASCADE nas FKs)

DELETE FROM generation_events;
DELETE FROM store_visual_signatures;
DELETE FROM store_brand_assets;
DELETE FROM store_brand_profiles;
DELETE FROM stores;

ALTER TABLE stores ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_store" ON stores
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- NOTA: escrita (INSERT, UPDATE, DELETE) permanece em handlers
-- privilegiados com supabaseAdmin + ownership validado.
-- Nenhuma policy de escrita é concedida a authenticated.
```

---

### D3 — localStorage("store_id") removido; store atual vem do servidor

`CONFIRMADO`

O `localStorage("store_id")` deixa de ser fonte de identidade (invariante #7 da milestone). Todo acesso a dados de loja passa a ser resolvido por `claims.sub → stores.user_id → stores.id`.

**Arquivos afetados (remoção completa):**

| Arquivo | Uso atual | Substituição |
|---------|-----------|-------------|
| `src/components/flow/campaign-page-client.tsx` | `getItem` no mount, `removeItem` se 404 | Server component resolve store, passa como prop |
| `src/components/flow/store-page-client.tsx` | `getItem` no mount, `removeItem` se 404 | Server component resolve store, passa como prop |
| `src/components/flow/use-store-form.ts` | `getItem`, `setItem` (5 pontos), `removeItem` | Recebe `initialStore` do server; salva via API retorno |
| `src/components/auth/logout-button.tsx` | `removeItem("store_id")` | Não precisa mais — store não está em localStorage |

**Logout deixa de precisar limpar store_id** porque nenhum componente depende mais de localStorage para identidade de loja.

---

### D4 — Propagação por props, sem StoreProvider nesta fase

`CONFIRMADO`

```
Server Component (/, /store, /campaign/preview)
  ├── await requirePageUser()
  ├── const store = await getCurrentStore()
  │
  ├── se null e rota é / ou /campaign/preview → redirect /store
  ├── se null e rota é /store → render <StorePageClient /> (modo create)
  │
  ├── se store e rota é / → render <CampaignPageClient store={store} />
  ├── se store e rota é /store → render <StorePageClient initialStore={store} /> (modo edit)
  └── se store e rota é /campaign/preview → render <CampaignPreviewClient />

Client Component
  ├── recebe store como prop
  ├── usa store.id para chamadas de API
  └── não toca localStorage

StoreIdentityForm
  ├── recebe initialStore via props
  └── repassa para useStoreForm({ initialStore })
```

**Decisão:** Props encadeadas enquanto a árvore de componentes autenticados for pequena (essencialmente 2-3 componentes). Se no futuro houver muitos componentes irmãos precisando de store, storeId, refreshStore e estado de onboarding, um `StoreProvider` dentro de um layout de app autenticado passa a fazer sentido. Até lá, props são mais explícitas e testáveis.

---

### D5 — /store como rota de produto protegida; não entra no route group (auth)

`CONFIRMADO`

O route group `(auth)` contém páginas de credenciais (login, signup, forgot, check-email, update-password) com layout centralizado escuro. `/store` é página de produto/onboarding — precisa de aparência de app, não de tela de credencial.

**Estrutura:**

```
src/app/store/page.tsx         ← permanece (URL amigável)
  └── await requirePageUser()  ← server-side auth check
  └── const store = await getCurrentStore()
  └── <StorePageClient initialStore={store} />

src/app/page.tsx               ← raiz (campaign)
  └── await requirePageUser()
  └── const store = await getCurrentStore()
  └── se !store → redirect /store
  └── <CampaignPageClient store={store} />

src/app/campaign/preview/page.tsx  ← server wrapper
  └── await requirePageUser()
  └── const store = await getCurrentStore()
  └── se !store → redirect /store
  └── <CampaignPreviewClient />
```

**Middleware já protege** `/store/:path*` (matcher existente). A página adiciona verificação server-side com `requirePageUser()` como camada extra (defense in depth).

**Futuro:** Se surgir um layout global de área autenticada (header de navegação, sidebar, etc.), um route group `(app)` pode ser criado. Mas não agora.

---

### D6 — GET /api/store como atalho semântico para loja corrente

`CONFIRMADO`

Rota `GET /api/store` (sem `:id`) que resolve a loja do usuário autenticado:

```
GET /api/store
  → requireApiUser()
  → const store = await getCurrentStore()
  → se store → 200 { ...store }
  → se null → 404 { error: "Store not found" }
```

**Motivação:** Consistência semântica — clientes não precisam saber o UUID da própria loja. Também é útil para `loading.tsx`, refetch pós-criação, e componentes client que precisam revalidar.

**Uso:** principalmente ferramenta de API. Server components usam `getCurrentStore()` direto (não passam por HTTP).

---

### D7 — POST /api/store: criação com claims.sub (exceção invariante #11)

`CONFIRMADO`

A criação de loja é a única rota que não pode validar ownership (a loja ainda não existe). O fluxo segue a exceção documentada no invariante #11 da milestone:

```
POST /api/store
  → requireUser()
  → user_id = claims.sub (ignora qualquer user_id do body)
  → INSERT com supabaseAdmin
  → UNIQUE(user_id) protege contra segunda loja
  → se violação UNIQUE → 409 Conflict
  → 201 Store criada
```

**Pós-criação:** O server component de `/` ou `/store` re-executa `getCurrentStore()` na próxima navegação e encontra a loja recém-criada. O fluxo recomendado é redirect para `/` após criação bem-sucedida, fechando o ciclo onboarding → campanha.

**Erro 23505 (duplicate key):** A constraint UNIQUE(user_id) do Postgres dispara erro código `23505` se o usuário já tiver loja. Mapear para 409 explícito:

```typescript
if (error.code === "23505") {
  return NextResponse.json(
    { error: "Usuário já possui uma loja" },
    { status: 409 }
  );
}
```

---

### D8 — Refatoração progressiva do componente de loja (1700+ linhas)

`CONFIRMADO`

A substituição do `localStorage("store_id")` no `StoreIdentityForm` + `useStoreForm` é feita por incisão progressiva, não rewrite:

1. **store-page-client.tsx** — recebe `initialStore` do server component, passa para `StoreIdentityForm`
2. **store-identity-form.tsx** — repassa `initialStore` para `useStoreForm`
3. **use-store-form.ts** — deixa de fazer fetch inicial/localStorage no mount; inicializa estado a partir de `initialStore`
4. **save()** — usa `initialStore.id` para decidir modo (se null → create, se existe → edit):
   - Modo create: `POST /api/store` → recebe `{ id }` no response → atualiza estado local
   - Modo edit: `PATCH /api/store/${storeId}` → atualiza estado local
   - Sempre sem localStorage

**Racional:** Preserva a UI existente de 1700+ linhas, troca a fonte de verdade por baixo, minimiza risco de regressão visual enquanto a segurança está em movimento.

---

### D9 — /campaign/preview com server wrapper

`CONFIRMADO`

A milestone (linha 163) define que `/campaign/preview` exige loja existente, assim como `/`. A página atual (`src/app/campaign/preview/page.tsx`) é um client component que lê dados de preview do `sessionStorage`, sem validação server-side de loja.

**Estrutura alvo:**

```
src/app/campaign/preview/
  ├── page.tsx              ← server wrapper (NOVO)
  └── preview-client.tsx    ← client component extraído (RENOMEADO)
```

**server wrapper (`page.tsx`):**

```typescript
export default async function CampaignPreviewPage() {
  await requirePageUser();
  const store = await getCurrentStore();
  if (!store) redirect("/store");
  return <CampaignPreviewClient />;
}
```

**O que muda:**
- Server wrapper executa antes de qualquer render client-side
- Usuário sem loja é redirecionado para `/store` antes de ver qualquer preview
- O client component existente vira `preview-client.tsx` e mantém toda a lógica de exibição atual

**Isso não resolve a segurança dos dados de preview** (que estão em sessionStorage e pertencem ao fluxo de geração). A milestone (Fase 11) cobre vazamento de sessionStorage entre usuários. O objetivo aqui é apenas alinhar com a regra de rota da milestone.

---

### D10 — Contrato de erro dos helpers: route handlers convertem exceções para JSON

`CONFIRMADO`

`requirePageUser()` e `requireApiUser()` lançam `UnauthorizedError`. `requireOwnership()` e `getCurrentStore()` precisam de um contrato de erro claro para evitar que exceções não tratadas virem 500.

**Contrato:**

| Situação | Erro | Status HTTP | Rota `/api/*` | Rota de página |
|----------|------|-------------|---------------|----------------|
| Sem sessão | `UnauthorizedError` | 401 | `{ error: "Unauthorized" }` | redirect `/login` |
| Store inexistente/alheia | `StoreNotFoundError` | 404 | `{ error: "Store not found" }` | redirect `/store` (create) |

**Implementação nos route handlers:**

```typescript
try {
  const store = await requireOwnership(id);
  // ... operação
} catch (error) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof StoreNotFoundError) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }
  throw error; // 500 inesperado
}
```

**`StoreNotFoundError`** é uma nova classe de erro, análoga a `UnauthorizedError`, que representa "store não encontrada ou não pertence ao usuário" — o chamador trata como 404 em APIs, redirect em páginas.

**Regra:** Route handlers em `/api/*` nunca fazem redirect HTML. Retornam sempre `NextResponse.json()` com status code apropriado (invariante #5 da milestone).

---

### D11 — Assinatura dos helpers evita auth duplicada

`CONFIRMADO`

`getCurrentStore()` e `requireOwnership()` podem ser chamados em contextos onde `requireUser()` já foi executado. Para evitar duas leituras de claims, ambos aceitam `userId` opcional:

```typescript
// src/lib/auth/store-ownership.ts

export async function getCurrentStore(userId?: string): Promise<Store | null>
export async function requireOwnership(storeId: string, userId?: string): Promise<Store>
```

**Comportamento:**
- Se `userId` é fornecido: usa diretamente (sem chamar `requireUser()`)
- Se `userId` é omitido: chama `requireUser()` internamente para obter `claims.sub`

**Padrão em server components:**

```typescript
// Página — faz uma única leitura de claims
const user = await requirePageUser();
const store = await getCurrentStore(user.userId);
```

**Padrão em route handlers:**

```typescript
// Route handler — requireApiUser + requireOwnership sem duplicar auth
const user = await requireApiUser();

// GET /api/store/:id  — usa userId para evitar nova leitura
const store = await requireOwnership(id, user.userId);

// GET /api/store — usa userId para evitar nova leitura
const store = await getCurrentStore(user.userId);
```

---

### D12 — Shape de GET /api/store (atalho) igual a GET /api/store/:id

`CONFIRMADO`

A rota `GET /api/store/:id` não retorna apenas a store bruta — ela hidrata dados adicionais via `resolveStoreIdentity()`:

```typescript
// GET /api/store/:id retorna:
{
  ...store,                        // campos da tabela stores
  identity: StoreIdentitySnapshot,  // perfil de marca + assets
  visual_signature_url: string|null,
  logo_url: string|null,
  has_archived_signatures: boolean,
}
```

**Decisão:** `GET /api/store` (atalho) retorna o **mesmo shape** que `GET /api/store/:id`:

```typescript
GET /api/store
  → requireApiUser()
  → const store = await getCurrentStore(user.userId)
  → se null → 404 { error: "Store not found" }
  → se store → 200 { ...store, identity, visual_signature_url, logo_url, has_archived_signatures }
```

**Motivo:** Evitar duas verdades sobre o formato de resposta de "store". Clientes que consomem `/api/store/:id` podem consumir `/api/store` sem adaptação. A identidade visual é parte do estado da loja — faz sentido vir sempre junto.

**Nota técnica:** Para garantir que os dois endpoints nunca divirjam, extrair uma função compartilhada `buildStoreResponse(store)` em `src/lib/store-response.ts` que monta o shape hidratado. (Arquivo separado para evitar ciclo de import com `@/lib/actions/store`.) Ambos os route handlers chamam o mesmo builder.

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Migration quebra dados existentes** | Alto — DELETE FROM stores remove todos os dados de loja | Confirmado que dados podem ser resetados (ambiente dev). Release gate documentado. |
| **Route handler existente continua usando supabaseAdmin sem ownership** | Alto — buraco de segurança | Fase 9 aplica ownership em 4 rotas CRUD. Fase 10 cobre todos os sub-recursos. Checklist explícito. |
| **Server component redirect causa flash de conteúdo não autorizado** | Médio — usuário vê parte da página antes do redirect | Middleware + server component validam antes de renderizar qualquer conteúdo. safe pattern: redirect antes do JSX. |
| **useStoreForm refatoração quebra formulário existente** | Alto — 1700+ linhas de UI | Refatoração progressiva em 4 passos. Cada passo verificado antes do próximo. Testes existentes protegem. |
| **CampaignPageClient estados "loading/blocked" removidos — cenário não coberto** | Baixo — server decide antes de renderizar | Se server component falhar (erro inesperado), o error boundary do Next.js trata. Mantém apenas fallback local para ações client-side reais (submit, validação). |
| **GET /api/store retorna 404 para "sem loja" — cliente trata como erro** | Baixo — client components devem tratar 404 como "sem loja" | Documentar que 404 em GET /api/store significa "sem loja". Server components usam getCurrentStore() que retorna null. |

---

## Fora de Escopo

| Item | Motivo |
|------|--------|
| `requireOwnership()` em rotas de logo, brand-profile, visual-signature | Fase 10 |
| RLS em `store_brand_assets`, `store_brand_profiles`, `store_visual_signatures` | Fase 10 |
| RLS em `generation_events` (default-deny) | Fase 10 |
| Storage policies (listagem bloqueada, upload direto negado) | Fase 10 |
| CSRF / same-origin validation | Fase 10 |
| Server Actions com auth (D11 — 4 viram entrypoints, 3 viram serviços) | Fase 10 |
| `AuthorizedStoreContext` | Fase 10 |
| StoreProvider (React Context) | Postergado — props são suficientes |
| Múltiplas lojas (1:N) | Fora de escopo da milestone v1.2 |
| E2E de sessão com cookies reais | Fase 11 |
| Testes RLS contra banco real/local | Fase 11 |
| Testes cross-tenant automatizados | Fase 11 |
| Vazamento de sessionStorage entre usuários | Fase 11 |

---

## Critérios de Aceite

### Macro-critério

> Um usuário autenticado acessa exclusivamente sua própria loja. A loja é resolvida pelo servidor a partir da sessão (claims.sub), não de localStorage. A criação da loja é parte do onboarding e redireciona para o fluxo de campanha. Nenhuma rota revela dados de loja alheia.

### Cenários de verificação

| # | Cenário | Critério |
|---|---------|----------|
| 1 | Migration: `ALTER TABLE stores ADD COLUMN user_id` com reset de dados | Coluna adicionada, NOT NULL, UNIQUE, FK para auth.users |
| 2 | RLS: authenticated SELECT em stores filtrando por user_id = auth.uid() | Policy criada, SELECT só retorna própria loja |
| 3 | `getCurrentStore()` retorna store do usuário autenticado | Store resolvida por claims.sub |
| 4 | `getCurrentStore()` retorna null para usuário sem loja | Navegação identifica estado de onboarding |
| 5 | `requireOwnership(storeId)` retorna store para owner | Store encontrada, ownership confirmado |
| 6 | `requireOwnership(storeId)` retorna 404 para loja alheia | Store não encontrada (mesmo existindo) |
| 7 | `requireOwnership(storeId)` retorna 404 para loja inexistente | Store não encontrada |
| 8 | `POST /api/store` com `claims.sub` como user_id | Loja criada, user_id = claims.sub |
| 9 | `POST /api/store` com body contendo user_id — valor ignorado | user_id no body é ignorado, claims.sub prevalece |
| 10 | `POST /api/store` sem autenticação | 401 Unauthorized |
| 11 | `POST /api/store` com usuário já tendo loja | 409 Conflict (UNIQUE violation) |
| 12 | `GET /api/store/:id` para própria loja | 200, dados da loja retornados |
| 13 | `GET /api/store/:id` para loja alheia | 404, não 403 |
| 14 | `GET /api/store/:id` para loja inexistente | 404 |
| 15 | `GET /api/store/:id` sem autenticação | 401 |
| 16 | `PATCH /api/store/:id` para própria loja | 200, dados atualizados |
| 17 | `PATCH /api/store/:id` para loja alheia | 404 |
| 18 | `PATCH /api/store/:id` sem autenticação | 401 |
| 19 | `GET /api/store` (atalho) para usuário com loja | 200, store retornada |
| 20 | `GET /api/store` (atalho) para usuário sem loja | 404 |
| 21 | `GET /api/store` (atalho) sem autenticação | 401 |
| 22 | `/store` (create) para usuário autenticado sem loja | Formulário de criação renderizado |
| 23 | `/store` (edit) para usuário autenticado com loja | Formulário de edição renderizado com dados |
| 24 | `/store` sem autenticação | Redirect /login |
| 25 | `/` (campaign) para usuário autenticado sem loja | Redirect /store |
| 26 | `/` (campaign) para usuário autenticado com loja | Página de campanha renderizada |
| 27 | `/` sem autenticação | Redirect /login |
| 28 | `/campaign/preview` para usuário autenticado sem loja | Redirect /store (server wrapper) |
| 29 | `/campaign/preview` para usuário autenticado com loja | Preview renderizada |
| 30 | `/campaign/preview` sem autenticação | Redirect /login |
| 31 | `localStorage("store_id")` não existe em nenhum arquivo | grep por "localStorage.*store_id" retorna 0 |
| 32 | Logout não referencia `localStorage("store_id")` | Logout só limpa cookies de sessão |
| 33 | `useStoreForm` recebe `initialStore` do server, não lê localStorage | Hook inicializa estado a partir de initialStore |
| 34 | Pós-criação: submit POST /api/store → redirect `/` | getCurrentStore() encontra loja recém-criada |
| 35 | `requireOwnership` sem userId chama `requireUser()` internamente | Helper resolve claims sozinho |
| 36 | `requireOwnership` com userId não chama `requireUser()` | Helper usa userId fornecido |
| 37 | `GET /api/store` retorna mesmo shape que `GET /api/store/:id` | identity, visual_signature_url, logo_url, has_archived_signatures presentes |
| 38 | Route handler captura `UnauthorizedError` e retorna 401 JSON | Rota `/api/*` não faz redirect HTML |
| 39 | Route handler captura `StoreNotFoundError` e retorna 404 JSON | Rota `/api/*` retorna JSON, não HTML |
| 40 | Regressão: testes existentes continuam passando | `npx vitest run` exit 0 |

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-07-06 | D1 — Ownership nas rotas CRUD de store (4 rotas). Sub-recursos na Fase 10 |
| 2026-07-06 | D2 — stores.user_id + RLS + validação backend. Two layers, não redundantes. supabaseAdmin exige guard explícito |
| 2026-07-06 | D3 — localStorage("store_id") removido. store resolvida por claims.sub no servidor |
| 2026-07-06 | D4 — Propagação por props. StoreProvider postergado |
| 2026-07-06 | D5 — /store como rota de produto. Não entra no route group (auth) |
| 2026-07-06 | D6 — GET /api/store criado como atalho semântico (pendência do alignment da milestone) |
| 2026-07-06 | D7 — POST /api/store usa claims.sub como user_id. UNIQUE(user_id) → 409 em segunda loja |
| 2026-07-06 | D8 — Refatoração progressiva do form de 1700+ linhas. 4 passos incrementais, sem rewrite |
| 2026-07-06 | D9 — /campaign/preview ganha server wrapper com requirePageUser + getCurrentStore |
| 2026-07-06 | D10 — Contrato de erro: route handlers convertem UnauthorizedError/StoreNotFoundError para JSON 401/404 |
| 2026-07-06 | D11 — Helpers aceitam userId opcional para evitar leitura duplicada de claims |
| 2026-07-06 | D12 — GET /api/store retorna mesmo shape que GET /api/store/:id |
| 2026-07-06 | Reset de dados na migration confirmado — dev sem dados preservados |

---

## Checklist de Revisão

- [ ] Migration: `ALTER TABLE stores ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id)` + reset de dados
- [ ] Migration: DELETE filhas antes de stores (generation_events, store_brand_profiles, store_brand_assets, store_visual_signatures)
- [ ] RLS: `CREATE POLICY "users_select_own_store" ON stores FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))`
- [ ] `src/lib/auth/store-ownership.ts` — `requireOwnership(storeId)`, `getCurrentStore()`
- [ ] `requireOwnership()` usa `createServerClient()` + RLS antes de `supabaseAdmin`
- [ ] `POST /api/store` — `requireUser()` + `claims.sub` como user_id
- [ ] `POST /api/store` — erro 23505 → 409 Conflict
- [ ] `GET /api/store/:id` — `requireOwnership(id)`
- [ ] `PATCH /api/store/:id` — `requireOwnership(id)`
- [ ] `GET /api/store` — `requireApiUser()` + `getCurrentStore()`
- [ ] `src/app/store/page.tsx` — `requirePageUser()` + `getCurrentStore()` + props para client
- [ ] `src/app/page.tsx` — `requirePageUser()` + `getCurrentStore()` + redirect `/store` se null
- [ ] `src/app/campaign/preview/page.tsx` — server wrapper com `requirePageUser()` + `getCurrentStore()` + redirect `/store` se null
- [ ] `src/app/campaign/preview/preview-client.tsx` — client component extraído do page.tsx atual
- [ ] `src/components/flow/campaign-page-client.tsx` — recebe store como prop, remove localStorage
- [ ] `src/components/flow/store-page-client.tsx` — recebe initialStore como prop, remove localStorage
- [ ] `src/components/flow/use-store-form.ts` — recebe initialStore, remove localStorage
- [ ] `src/components/auth/logout-button.tsx` — remove `localStorage.removeItem("store_id")`
- [ ] `src/__tests__/auth/logout.test.tsx` — atualiza teste que mocka `localStorage("store_id")`
- [ ] `src/lib/auth/store-ownership.ts` — `requireOwnership()`, `getCurrentStore()` com userId opcional
- [ ] `src/lib/auth/store-ownership.ts` — `StoreNotFoundError` class exportada
- [ ] Route handlers: GET/PATCH /api/store/:id capturam `UnauthorizedError` → 401 JSON, `StoreNotFoundError` → 404 JSON
- [ ] Route handlers: GET /api/store captura `UnauthorizedError` → 401 JSON, sem store → 404 JSON
- [ ] Route handlers: POST /api/store captura `UnauthorizedError` → 401 JSON, `23505` → 409 JSON
- [ ] Regressão: `grep -r "localStorage.*store_id" src/` — zero resultados
- [ ] `npx tsc --noEmit` — zero erros de tipo
- [ ] `npx vitest run` — todos os testes verdes
- [ ] `npm run lint` — zero erros de lint
- [ ] `npx next build` — build bem-sucedido

---

*Documento criado: 2026-07-06*
*Baseado no alinhamento da milestone v1.2 (D1–D11)*
*Próximo passo: revisão do time, ajustes, então avançar para artefatos de implementação*
