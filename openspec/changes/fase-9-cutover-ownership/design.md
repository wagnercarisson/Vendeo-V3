## Context

A Fase 8 entregou ciclo de conta completo (signup, login, recovery, middleware), mas o acesso a lojas ainda é feito por `localStorage("store_id")` sem validação de propriedade. As rotas CRUD de store usam `supabaseAdmin` (service_role) que ignora RLS, expondo qualquer loja a qualquer usuário que conheça seu UUID.

O alinhamento da Fase 9 (docs/alinhamento-fase-9-cutover-ownership.md) define 12 decisões de arquitetura (D1-D12) que este design implementa.

## Goals / Non-Goals

**Goals:**
- Adicionar `user_id` à tabela `stores` (NOT NULL UNIQUE REFERENCES auth.users(id))
- Implementar `getCurrentStore()` e `requireOwnership(storeId)` com userId opcional (D11)
- Aplicar ownership nas 4 rotas CRUD de store (D1, D2)
- Server components em `/store`, `/`, `/campaign/preview` resolvem store via `requirePageUser()` + `getCurrentStore()` (D5)
- Remover `localStorage("store_id")` de todos os componentes (D3)
- Propagar store por props server → client (D4)
- GET /api/store (atalho semântico) com mesmo shape de GET /api/store/:id (D6, D12)
- Migration: DELETE filhas → ALTER TABLE user_id → RLS SELECT policy (D2)
- Contrato de erro: route handlers capturam exceções e retornam JSON (D10)

**Non-Goals:**
- Ownership em rotas de sub-recursos (logo, brand-profile, visual-signature, campaign) — Fase 10
- RLS em tabelas filhas — Fase 10
- Storage policies — Fase 10
- CSRF / same-origin — Fase 10
- Server Actions com auth — Fase 10
- StoreProvider (React Context) — postergado (D4)
- Múltiplas lojas (1:N) — fora da milestone v1.2
- E2E de sessão com cookies reais — Fase 11
- Testes cross-tenant — Fase 11

## Decisions

### D1 — Ownership nas rotas CRUD de store (escopo: 4 rotas)

Ownership é aplicado apenas nas 4 rotas CRUD de store na Fase 9. Sub-recursos recebem o mesmo tratamento na Fase 10.

`supabaseAdmin` ignora RLS, portanto todo handler que usa service_role precisa de ownership validado antes de tocar no banco. RLS é proteção adicional para `createServerClient()`, não substituta.

### D2 — Belt and suspenders: RLS + validação backend

- RLS policy `FOR SELECT` garante que `createServerClient()` só vê loja do owner
- `requireOwnership()` com `createServerClient()` + RLS valida antes de qualquer operação com `supabaseAdmin`
- Nenhuma policy de escrita é concedida a `authenticated` — escrita permanece em handlers privilegiados

### D3 — localStorage("store_id") removido; store resolvida por claims.sub

4 arquivos afetados: campaign-page-client, store-page-client, use-store-form, logout-button. Substituição: server component resolve store e passa como prop. Logout não precisa mais limpar store_id.

### D4 — Propagação por props, StoreProvider postergado

Árvore de componentes autenticados é pequena (2-3 componentes). Props são mais explícitas e testáveis. StoreProvider será considerado quando houver muitos componentes irmãos precisando de store/refreshStore/onboarding.

### D5 — /store como rota de produto, fora do route group (auth)

`(auth)` contém páginas de credenciais com layout escuro centralizado. `/store` é página de produto/onboarding com aparência de app. Estrutura:
- `src/app/store/page.tsx` — server component, requirePageUser, getCurrentStore, render StorePageClient
- `src/app/page.tsx` — server component, requirePageUser, getCurrentStore, se null → redirect /store, render CampaignPageClient
- `src/app/campaign/preview/page.tsx` — server wrapper, requirePageUser, getCurrentStore, se null → redirect /store, render CampaignPreviewClient

### D6 — GET /api/store como atalho semântico

Nova rota sem `:id` que resolve loja do usuário autenticado. Mesmo shape de GET /api/store/:id (D12). Útil para loading.tsx, refetch pós-criação.

### D7 — POST /api/store: criação com claims.sub

Única rota que não pode validar ownership (loja não existe). `requireUser()` → `user_id = claims.sub` (ignora body). UNIQUE(user_id) protege contra segunda loja → 409 Conflict (erro 23505).

### D8 — Refatoração progressiva (1700+ linhas)

4 passos incrementais, sem rewrite:
1. store-page-client recebe initialStore, passa para StoreIdentityForm
2. store-identity-form repassa para useStoreForm
3. use-store-form inicializa de initialStore, não de localStorage
4. save() usa storeId em estado local (inicializado de initialStore?.id, atualizado após POST) para decidir POST vs PATCH

### D9 — /campaign/preview com server wrapper

page.tsx vira server wrapper async. Client component existente extraído para preview-client.tsx. Usuário sem loja é redirecionado para /store antes de ver preview.

### D10 — Contrato de erro

| Situação | Erro | Status | Rota /api/* | Página |
|----------|------|--------|-------------|--------|
| Sem sessão | UnauthorizedError | 401 | JSON | redirect /login |
| Store inexistente/alheia | StoreNotFoundError | 404 | JSON | redirect /store |

StoreNotFoundError é nova classe exportada em src/lib/auth/.

### D11 — userId opcional em getCurrentStore/requireOwnership

Evita leitura duplicada de claims. Server component: `requirePageUser()` → `getCurrentStore(user.userId)`. Route handler: `requireApiUser()` → `requireOwnership(id, user.userId)`.

### D12 — Shape consistente: GET /api/store = GET /api/store/:id

`buildStoreResponse(store)` extraído para `src/lib/store.ts`. Ambos endpoints retornam `{ ...store, identity, visual_signature_url, logo_url, has_archived_signatures }`.

## Risks / Trade-offs

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Migration DELETE FROM stores remove dados | Alto — perda de dados dev | Confirmado que dev pode resetar. Release gate documentado. |
| Route handler continua sem ownership | Alto — buraco de segurança | Checklist explícito. Fase 9 cobre 4 rotas, Fase 10 cobre resto. |
| Server redirect causa flash de conteúdo | Médio | Middleware + server component validam antes de renderizar. redirect antes do JSX. |
| useStoreForm refatoração quebra UI (1700+ linhas) | Alto | Refatoração progressiva em 4 passos. Cada passo verificado. Testes existentes protegem. |
| GET /api/store retorna 404 para "sem loja" — cliente trata como erro | Baixo | Documentar que 404 = "sem loja". Server components usam getCurrentStore() que retorna null. |
