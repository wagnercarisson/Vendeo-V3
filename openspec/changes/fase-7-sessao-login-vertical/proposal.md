## Why

O Vendeo não possui qualquer infraestrutura de autenticação. Todas as páginas e APIs são públicas, a identidade da loja é resolvida por um UUID em `localStorage`, e qualquer operação usa `supabaseAdmin` (service role) sem validação de usuário. Antes de avançar para contas multitenant (Fases 8–11 da v1.2), é necessário estabelecer a camada fundacional de sessão: login, middleware de proteção, logout e helpers de autorização.

## What Changes

- Instalar `@supabase/ssr` e substituir os clientes Supabase atuais (singleton `createClient`) por factories SSR
- Criar `middleware.ts` com matcher positivo para renovar sessão via cookie e proteger páginas
- Criar helper `requireUser()` que extrai `claims.sub` como identidade confiável, com adaptação por superfície (redirect em páginas, 401 em APIs)
- Criar `/login` com formulário de email + senha, layout isolado via route group `(auth)`
- Implementar logout via `POST /auth/signout` com limpeza de Web Storage (sessionStorage + localStorage)
- Implementar `sanitizeRedirectPath()` com allowlist para redirect pós-login com dupla validação (middleware + client)
- Validar ambiente (ENV vars obrigatórias, Supabase Auth habilitado)

**Fora de escopo desta fase:** signup, confirmação de email, recuperação de senha, resolução de loja, ownership, RLS, Server Actions — todos nas fases seguintes (8–11).

## Capabilities

### New Capabilities
- `supabase-ssr-client`: Infraestrutura de clientes Supabase SSR — `createBrowserClient()`, `createServerClient()`, `updateSession()` para middleware. Substitui o singleton `createClient` atual e o barrel `supabase.ts`
- `auth-middleware`: Roteamento protegido via `middleware.ts` com matcher positivo, renovação de cookie, redirect de páginas não autenticadas para `/login` e resposta 401 JSON para rotas `/api/*`
- `user-auth`: Helper `requireUser()` que valida claims JWT e retorna `AuthenticatedUser { userId, claims }`. Adaptação por superfície: `requirePageUser()` para páginas (redirect), route handlers (401 JSON), Server Actions adiado para Fase 10
- `auth-logout`: Route Handler `POST /auth/signout` com limpeza explícita de `sessionStorage` (campaign_draft, campaign_draft_image, campaign_preview) e `localStorage` (store_id) no client antes da chamada server-side
- `auth-redirect`: Função `sanitizeRedirectPath()` com allowlist de caminhos internos (`/`, `/store`, `/campaign/*`) e dupla validação (middleware produz o param, login o valida antes de `router.replace()`)
- `login-page`: Página `/login` com formulário de email + senha, layout isolado via `(auth)` route group seguindo `openspec/design-system/MASTER.md`, tema dark existente, erro genérico, sem link para signup

### Modified Capabilities
<!-- Nenhuma capability existente tem requisitos alterados — todas são novas. -->

## Impact

- **Dependências:** `@supabase/ssr` adicionado ao `package.json`
- **Clientes Supabase:** `src/lib/supabase/client.ts` refatorado de singleton para factory; `src/lib/supabase/server.ts` ganha `createServerClient`; `src/lib/supabase.ts` (barrel) removido; `src/lib/supabase/middleware.ts` criado
- **Novos módulos:** `src/middleware.ts`, `src/lib/auth/require-user.ts`, `src/lib/auth/redirect.ts`
- **Novas páginas:** `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/login-form.tsx`
- **Novo endpoint:** `src/app/auth/signout/route.ts`
- **Testes:** Suíte existente não é afetada (mocka `supabaseAdmin`). Novos testes para `requireUser`, `sanitizeRedirectPath`, middleware, login form e logout
- **ENV:** 3 variáveis validadas na inicialização (já existentes); `NEXT_PUBLIC_SITE_URL` não necessária nesta fase
- **Nenhuma migration de banco** — Fase 7 não altera schema
