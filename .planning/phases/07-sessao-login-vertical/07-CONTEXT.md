# Phase 7: Sessão e Login Vertical - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Source:** OpenSpec Explore (`openspec/changes/fase-7-sessao-login-vertical/`)

<domain>
## Phase Boundary

Estabelecer a camada fundacional de sessão: login, middleware de proteção, logout e helpers de autorização. Antes de avançar para contas multitenant (Fases 8–11), é necessário que o Vendeo saiba quem está acessando o sistema e proteja rotas contra acesso anônimo.

**O que esta fase entrega:**
- Infraestrutura de clientes Supabase SSR (browser, server, middleware factories)
- Middleware de autenticação com matcher positivo
- Helper `requireUser()` com adaptação por superfície (página vs API)
- Página de login com formulário email+senha
- Logout com limpeza de storage
- Redirecionamento seguro pós-login com allowlist

**Fora de escopo:** signup, confirmação de email, recuperação de senha, resolução de loja, ownership, RLS, Server Actions com auth.

</domain>

<decisions>
## Implementation Decisions

### D1 — Arquitetura dos Clientes Supabase

Três factories independentes em vez de um singleton centralizado:

```
src/lib/supabase/
├── client.ts          createBrowserClient()     // browser-only, client component
├── server.ts          createServerClient()      // SSR + cookies, server component
│                     + supabaseAdmin            // service role (mantido)
└── middleware.ts      updateSession(request)    // Edge, middleware.ts
```

- `client.ts`: usa `createBrowserClient` do `@supabase/ssr`, sem argumentos (lê ENV internamente). Factory function, não singleton.
- `server.ts`: usa `createServerClient` do `@supabase/ssr` com `cookies()`. `supabaseAdmin` permanece como export nomeado com `createClient` + service role key.
- `middleware.ts`: usa `createServerClient` do `@supabase/ssr` com `cookies` do tipo `RequestCookies`. Exporta `updateSession(request)`.
- `supabase.ts` (barrel): removido — viola limites de bundle.
- Singleton antigo (`export const supabase`) não tem consumidores atuais confirmados.

### D2 — Contrato de updateSession() e Fluxo do Middleware

`updateSession()` retorna `{ response: NextResponse; claims: JwtPayload | null }`. Middleware usa `getClaims()`, nunca `getSession()`.

Fluxo:
1. `const { response, claims } = await updateSession(request)`
2. Se sem claims: páginas protegidas → redirect `/login?redirect=...`; `/api/*` → 401 JSON; `/login` → pass-through
3. Se com claims: `/login` → redirect `/`; demais → pass-through
4. Toda resposta preserva cookies de `updateSession()`

Invariantes:
- Matcher positivo: `"/"`, `"/login"`, `"/store/:path*"`, `"/campaign/:path*"`, `/api/:path*"`
- Middleware não consulta banco de dados
- 401 do middleware é barreira temporária — handlers precisam de `requireUser()` próprio nas fases seguintes

### D3 — requireUser() em Duas Camadas

- `requireUser()`: cria server client, chama `getClaims()`, valida `claims.sub`. Retorna `{ userId, claims }` ou throw `UnauthorizedError`.
- `requirePageUser()`: wrapper para Server Components — catch → `redirect("/login")`
- `requireApiUser()`: wrapper para Route Handlers — throw `UnauthorizedError` → handler retorna 401 JSON
- Server Actions têm semântica definida na Fase 10

### D4 — Logout com Form Action

- `<form action="/auth/signout" method="POST" onSubmit={clearStorage}>`
- `onSubmit` limpa storage **antes** da submissão: `sessionStorage` (campaign_draft, campaign_draft_image, campaign_preview) + `localStorage` (store_id)
- Server: `createServerClient()` → `signOut()` → `revalidatePath("/")` → `redirect("/login")`
- Limpeza seletiva (chaves conhecidas, não `clear()`)

### D5 — Redirect Preservation com Dupla Validação

- `sanitizeRedirectPath(path)` valida pathname contra allowlist: `=== "/"`, `=== "/store"`, `.startsWith("/campaign/")`
- Rejeita URLs absolutas, protocol-relative, backslashes, caminhos de auth
- Preserva query string, descarta fragmentos
- Dupla validação: middleware produz o param, login o valida antes de `router.replace()`

### D6 — Layout das Páginas de Auth

- Route group `(auth)` não altera a URL
- Layout próprio: sem header de navegação, container centralizado com logo
- Tema dark mantido (`#020617` background)
- UI mínima: email, senha, botão submit, erro genérico
- Sem link para signup

### D7 — Testes com Mock nos Módulos Próprios

Mock alvo: `@/lib/supabase/server` e `@/lib/supabase/client`. Categorias:
1. `requireUser`: claims válidas, erro, sem sub
2. `sanitizeRedirectPath`: permitidos, rejeitados, vazio, fallback
3. Middleware: sem sessão → redirect, /api → 401, /login com sessão → redirect /
4. Login form: render, submit sucesso, submit erro
5. Logout: limpeza das 4 chaves

### D8 — Validação de Ambiente

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` validadas em `client.ts`
- `SUPABASE_SERVICE_ROLE_KEY` validada em `server.ts`
- Supabase Auth habilitado no projeto (verificação manual)
- URLs autorizadas configuradas no dashboard do Supabase

### D9 — Arquivo src/lib/supabase.ts (barrel) removido

- Barrel atual re-exporta `supabaseAdmin` de `server.ts` e `supabase` de `client.ts`
- Deve ser removido e todos os imports redirecionados para os módulos específicos
- Verificar com `git grep` que nenhum consumidor residual existe

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec Change — Fase 7 (Technical Source of Truth)
- `openspec/changes/fase-7-sessao-login-vertical/proposal.md` — What and why for Phase 7
- `openspec/changes/fase-7-sessao-login-vertical/design.md` — Design decisions D1-D8 with data flows
- `openspec/changes/fase-7-sessao-login-vertical/tasks.md` — 60+ atomic tasks in 9 groups (1-9)
- `openspec/changes/fase-7-sessao-login-vertical/specs/supabase-ssr-client/spec.md` — Supabase SSR client requirements
- `openspec/changes/fase-7-sessao-login-vertical/specs/auth-middleware/spec.md` — Middleware auth requirements
- `openspec/changes/fase-7-sessao-login-vertical/specs/user-auth/spec.md` — requireUser requirements
- `openspec/changes/fase-7-sessao-login-vertical/specs/auth-redirect/spec.md` — Redirect safety requirements
- `openspec/changes/fase-7-sessao-login-vertical/specs/login-page/spec.md` — Login page requirements
- `openspec/changes/fase-7-sessao-login-vertical/specs/auth-logout/spec.md` — Logout requirements

### Milestone v1.2 Requirements
- `.planning/REQUIREMENTS.md` — Milestone v1.2 normative requirements
- `.planning/ROADMAP.md` — Phase 7 depends on no other phase. Fases 8-11 depend on Phase 7
- `docs/alinhamento-milestone-v1.2.md` — D1-D11 consolidated alignment

### Current Codebase (Will Be Modified)
- `src/lib/supabase/client.ts` — Current singleton client (will be rewritten)
- `src/lib/supabase/server.ts` — Current admin client (will gain createServerClient)
- `src/lib/supabase.ts` — Current barrel file (will be removed)
- `src/app/layout.tsx` — Main layout (may need logout button)
- `docs/alinhamento-milestone-v1.2.md` — D1-D11 consolidated decisions

</canonical_refs>

<specifics>
## Specific Ideas

- Instalar `@supabase/ssr` com versão fixada
- Verificar compatibilidade com Next.js 15.3 (documentação oficial)
- Configurar URLs autorizadas no Supabase Dashboard (localhost + produção + previews)
- Usuários de desenvolvimento provisionados via Supabase Dashboard (sem signup nesta fase)
- O formulário de logout usa `<form>` nativo HTML com `action="/auth/signout"` + `method="POST"` para que o redirect do Route Handler navegue o browser naturalmente
- Login usa `supabase.auth.signInWithPassword()` chamada direta do client component
- Middleware usa matcher positivo para evitar processar `/_next/`, `/_vercel/`, assets
- `getClaims()` é usado em vez de `getSession()` em todo lugar
- Testes mockam `@/lib/supabase/server` e `@/lib/supabase/client`, não os módulos internos de `@supabase/ssr`
- E2E real de cookies e renovação postergado para Fase 11

</specifics>

<deferred>
## Deferred Ideas

- Signup, confirmação de email, `/check-email` — Fase 8
- Recuperação de senha (`/forgot-password`, `/update-password`) — Fase 8
- Resolução de loja (`getCurrentStore()`) — Fase 9
- `requireOwnership(storeId)` — Fase 9
- RLS em qualquer tabela — Fases 9 e 10
- Server Actions com auth — Fase 10
- Remoção estrutural de `localStorage("store_id")` como fonte de identidade — Fase 9
- E2E browser com cookies reais — Fase 11
- Configuração de SMTP — release gate pré-beta
- OAuth social / Magic link — exclusão deliberada para v1.2

</deferred>

---

*Phase: 07-sessao-login-vertical*
*Context gathered: 2026-07-04 via OpenSpec Explore*
