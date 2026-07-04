# Alinhamento Fase 7 — Sessão e Login Vertical

## Contexto

```
v1.2 — Contas e Propriedade          (milestone)
  ├── Fase 1 / Phase 7 — Sessão e Login Vertical    ← esta fase
  ├── Fase 2 / Phase 8 — Ciclo de Conta            (pendente)
  ├── Fase 3 / Phase 9 — Cutover de Ownership      (pendente)
  ├── Fase 4 / Phase 10 — Perímetro Multi-tenant   (pendente)
  └── Fase 5 / Phase 11 — Verificação e Hardening  (pendente)
```

Esta fase estabelece a infraestrutura fundacional de sessão: cliente Supabase SSR, middleware de proteção, página de login, logout seguro e helpers de autorização. Não cria contas nem vincula lojas a usuários — o usuário é provisionado externamente (Supabase Dashboard).

---
## Propósito

1. Instalar `@supabase/ssr` e substituir os clientes Supabase atuais (singleton `createClient`) por factories SSR (`createBrowserClient` / `createServerClient`)
2. Criar `middleware.ts` para renovar sessão via cookie e redirecionar páginas não autenticadas
3. Implementar `requireUser()` e `requirePageUser()` — helpers que extraem `claims.sub` como identidade confiável
4. Criar `/login` — formulário de entrada com email + senha
5. Implementar logout seguro — `POST /auth/signout` + limpeza de Web Storage
6. Implementar `sanitizeRedirectPath()` — allowlist de redirect pós-login com dupla validação (middleware + client)
7. Validar ambiente (ENV vars obrigatórias, Supabase Auth habilitado)

**Entrega verificável:** Usuário provisionado → `/login` → cookie SSR → rota protegida → `POST /auth/signout`.

---
## Estado Atual

```
                    ANTES                              DEPOIS (Fase 7)
══════════════════════════════════════════════════════════════════════════
@supabase/ssr        ✗ ausente                        ✓ instalado
createBrowserClient  ✗ singleton createClient          ✓ factory SSR
createServerClient   ✗ só supabaseAdmin               ✓ createServerClient + supabaseAdmin
middleware.ts        ✗ não existe                      ✓ updateSession + redirect
/login               ✗ não existe                      ✓ (auth)/login formulário
logout               ✗ não existe                      ✓ POST /auth/signout + limpeza
requireUser()        ✗ não existe                      ✓ src/lib/auth/require-user.ts
sanitizeRedirect()   ✗ não existe                      ✓ src/lib/auth/redirect.ts
localStorage         fonte de store_id                   fonte transitória (removida na Fase 9), mas limpa no logout
sessionStorage       preview/drafts (intocada)         limpa no logout
ENV auth             ✗ nenhuma                         ✓ 3 vars validadas
testes de auth       ✗ nenhum                          ✓ 5 categorias
```

---
## Decisões de Arquitetura

### D1 — Escopo delimitado: login sem signup

`CONFIRMADO`

- Signup, confirmação de email, `/check-email`, `/forgot-password` e `/update-password` ficam na Fase 8
- Usuário de desenvolvimento provisionado via Supabase Dashboard (`Authentication → Add User`) ou `supabase.auth.admin.createUser()`
- Fase 7 não depende de nenhuma outra fase

### D2 — Clientes Supabase: refactor direto sem compatibilidade

`CONFIRMADO`

- `src/lib/supabase/client.ts` → `createBrowserClient()` (factory, browser-only)
- `src/lib/supabase/server.ts` → `createServerClient()` (SSR com cookies) + `supabaseAdmin` (service role, existente)
- `src/lib/supabase/middleware.ts` → `updateSession(request)` (versão middleware do server client)
- `src/lib/supabase.ts` (barrel) → removido, elimina contaminação browser/server
- Singleton antigo (`export const supabase`) não tem consumidores atuais — substituição segura

```
src/lib/supabase/
├── client.ts          createBrowserClient()
├── server.ts          createServerClient() + supabaseAdmin
└── middleware.ts      updateSession(request)
```

### D3 — Middleware com matcher positivo

`CONFIRMADO`

```
matcher: [
  "/",
  "/login",
  "/store/:path*",
  "/campaign/:path*",
  "/api/:path*",
]
```

**Políticas:**

| Cenário | Ação |
|---------|------|
| Página protegida sem sessão | Redirect `/login` (com `?redirect=` preservado) |
| Rota `/api/*` sem sessão | `Response.json({ error: "Unauthorized" }, { status: 401 })` — nunca redirect |
| `/login` com sessão | Redirect `/` |
| Qualquer rota autenticada | Pass-through (renova cookie) |

**Invariantes:**
- Middleware **não consulta existência de loja** — isso é responsabilidade do Server Component
- Middleware usa `getClaims()`, não `getSession()` — alinhado com D4 do milestone
- Toda resposta de redirect ou 401 criada **após** `getClaims()` deve preservar os cookies definidos por `updateSession()`. Sem isso, a renovação pode funcionar internamente e o novo cookie não chegar ao navegador
- Auth matcher positivo evita administrar exclusões (`_next`, `_vercel`, assets, `_error`)
- O 401 global de `/api/*` no middleware é uma barreira temporária de autenticação, não substitui `requireUser()` e `requireOwnership()` dentro dos handlers — essas validações são adicionadas nas Fases 9 e 10

### D4 — requireUser() em camada separada

`CONFIRMADO`

```
src/lib/auth/require-user.ts

interface AuthenticatedUser {
  userId: string;
  claims: JwtPayload;
}

requireUser(): Promise<AuthenticatedUser>
```

- Cria `createServerClient` internamente, chama `getClaims()`, valida erro + `sub` não vazio
- Lança `UnauthorizedError` em caso de falha
- Cada superfície adapta a falha:
  - **Server Components / Páginas:** `requirePageUser()` → captura `UnauthorizedError` → `redirect("/login")`
  - **Route Handlers:** captura `UnauthorizedError` → `Response.json({ error: "Unauthorized" }, { status: 401 })`
  - **Server Actions:** semântica definida na Fase 10

### D5 — Logout com Route Handler + limpeza explícita

`CONFIRMADO`

- `POST /auth/signout` — Route Handler server-side
- Cliente chama o endpoint **após** limpar Web Storage
- Limpeza explícita de chaves conhecidas (não `clear()` total):
  - `sessionStorage`: `campaign_draft`, `campaign_draft_image`, `campaign_preview`
  - `localStorage`: `store_id`
- Server-side executa `supabase.auth.signOut()`, revalida layout, redirect `/login`
- `localStorage("store_id")` continua existindo como fonte de store_id até Fase 9, mas é limpo no logout para impedir vazamento entre sessões

### D6 — Redirect preservation com dupla validação

`CONFIRMADO`

```
src/lib/auth/redirect.ts → sanitizeRedirectPath(path: string): string
```

- Middleware anexa `?redirect=/caminho-original` ao redirect para `/login`
- Página de login lê o param e valida novamente com `sanitizeRedirectPath()` antes de `router.replace()`
- **Allowlist inicial:**
  - `/` (root)
  - `/store`
  - `/campaign/*`
- A allowlist valida o **pathname**. A query string pode ser preservada como dados opacos após parsing com `URL`; fragmentos são descartados
- Regras de rejeição: URLs absolutas, protocol-relative (`//`), backslashes, caminhos de autenticação (`/login`, `/signup`, `/auth/*`)
- Fallback: `/`

### D7 — Layout isolado com route group (auth)

`CONFIRMADO`

```
src/app/(auth)/
├── layout.tsx           logo + container (formulário pertence à página)
├── login/
│   ├── page.tsx         server component (verifica sessão, redirect se logado)
│   └── login-form.tsx   client component (form + submit)
```

- Route group `(auth)` não altera a URL (`/login`, não `/(auth)/login`)
- Layout próprio (sem header de navegação, sem nav complexa)
- Tema dark existente (`#020617`) mantido
- UI mínima da Fase 7: email + senha + submit + loading + erro genérico
- Sem link ativo para signup (inexistente nesta fase)

### D8 — Variáveis de ambiente validadas na inicialização

`CONFIRMADO`

- Fase 7 valida 3 variáveis obrigatórias:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` não é necessária para email+senha — estratégia de URL para callbacks será definida na Fase 8 (confirmação/recuperação)
- Documentar no Supabase as URLs autorizadas para localhost, produção e previews (preparação para Fase 8)

### D9 — Testes com mock nos módulos próprios, não no @supabase/ssr

`CONFIRMADO`

| Categoria | O que testar |
|-----------|-------------|
| `requireUser` | Claims válidas, claims ausentes, erro de cliente, `sub` vazio |
| `sanitizeRedirectPath` | Caminhos permitidos, URLs absolutas, `//`, backslashes, fallback |
| Middleware | Página anônima → redirect `/login`, página autenticada → pass-through, API anônima → 401 JSON |
| Login form | Renderização, loading, sucesso (redirect), erro (mensagem) |
| Logout | Limpeza das 4 chaves + chamada ao endpoint |

- Mockar `@/lib/supabase/server` e `@/lib/supabase/client`, não `@supabase/ssr`
- Testes unitários com Vitest (config existente)
- E2E real de cookies, renovação e múltiplos usuários → Fase 11

---
## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `@supabase/ssr` muda API entre versões | Instalação quebra | Fixar versão no `package.json`. Verificar compatibilidade com Next 15.3 |
| Singleton antigo tem consumidor não detectado | Runtime error | `git grep "from.*supabase/client"` + `git grep "from.*supabase"` antes do deploy. Testes unitários capturam |
| Middleware redireciona loop | UX quebrada | `/login` é pública (matcher inclui mas política permite acesso sem sessão) + verificação de `if (request.nextUrl.pathname === "/login")` no fluxo de redirect |
| Logout não limpa storage se script falha | Dados residuais | Limpeza no client **antes** da chamada fetch. Se fetch falha, storage já está limpo |
| Testes mockados perdem comportamento real de cookies | Falso positivo | E2E de sessão adiado para Fase 11 de propósito. Aware desse gap |

---
## Fora de Escopo

| Item | Motivo |
|------|--------|
| Signup, `/check-email`, `/auth/confirm` | Fase 8 |
| `/forgot-password`, `/update-password` | Fase 8 |
| Resolução de loja (`getCurrentStore()`) | Fase 9 |
| `requireOwnership(storeId)` | Fase 9 |
| RLS em `stores` | Fase 9 |
| RLS nas demais 4 tabelas (`store_brand_assets`, `store_brand_profiles`, `store_visual_signatures`, `generation_events`) | Fase 10 |
| Server Actions (auth + ownership) | Fase 10 |
| Remoção estrutural de `localStorage("store_id")` | Fase 9 |
| E2E de sessão, cookies, renovação | Fase 11 |
| Configuração de SMTP | Release gate (pré-beta externo) |
| `NEXT_PUBLIC_SITE_URL` | Estratégia de URL para callbacks definida na Fase 8 |
| Testes cross-tenant | Fase 11 |

---
## Critérios de Aceite

### Macro-critério

> Um usuário provisionado consegue entrar no Vendeo, manter sessão entre navegações e sair. Páginas protegidas exigem autenticação. Rotas de API retornam 401.

### Cenários de verificação

| # | Cenário | Critério |
|---|---------|----------|
| 1 | Usuário não autenticado acessa `/` | Redirect `/login?redirect=/` |
| 2 | Usuário não autenticado acessa `/campaign/preview` | Redirect `/login?redirect=/campaign/preview` |
| 3 | Usuário não autenticado acessa `/api/store` | `401 { error: "Unauthorized" }` |
| 4 | Usuário autenticado acessa `/login` | Redirect `/` |
| 5 | Usuário autenticado acessa `/` | Pass-through (página carrega, rota decide loja) |
| 6 | Login com credenciais válidas | Cookie definido, redirect para `/` ou `?redirect=` |
| 7 | Login com credenciais inválidas | Erro genérico exibido, sem redirect |
| 8 | Logout | Storage limpo, sessão destruída, redirect `/login` |
| 9 | Logout + acesso a rota protegida | Redirect `/login` (sessão não reutilizável) |
| 10 | `?redirect=/campaign/preview` no login | Redirect para `/campaign/preview` pós-login |
| 11 | `?redirect=https://evil.com` no login | Ignorado, redirect para `/` |
| 12 | `requireUser()` com claims inválidas | `UnauthorizedError` lançado |
| 13 | `requireUser()` com `sub` vazio | `UnauthorizedError` lançado |
| 14 | Middleware com cookie expirado | Renovação do cookie ou redirect `/login` — validação manual/integração mockada nesta fase. Automação browser real (E2E de cookies) na Fase 11 |

---
## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-07-04 | Escopo delimitado: login sem signup. Usuário provisionado via Dashboard |
| 2026-07-04 | Refactor direto dos clientes Supabase — sem wrapper de compatibilidade. `supabase.ts` barrel removido |
| 2026-07-04 | Matcher positivo com 5 entradas — sem lista de exclusões |
| 2026-07-04 | `requireUser()` lança `UnauthorizedError` — cada superfície adapta (redirect vs 401 vs erro) |
| 2026-07-04 | Logout: limpeza de storage no client **antes** do fetch server-side |
| 2026-07-04 | `sanitizeRedirectPath()` com allowlist inicial de 3 padrões + validação dupla |
| 2026-07-04 | Route group `(auth)` com layout próprio e isolado do layout global |
| 2026-07-04 | `NEXT_PUBLIC_SITE_URL` não necessária nesta fase — adiada para Fase 8 |
| 2026-07-04 | Testes mockam módulos próprios (`@/lib/supabase/*`), não `@supabase/ssr` |

---
## Checklist de Revisão

- [ ] `@supabase/ssr` instalado e com versão fixada
- [ ] `src/lib/supabase/client.ts` — `createBrowserClient()` factory, sem singleton
- [ ] `src/lib/supabase/server.ts` — `createServerClient()` + `supabaseAdmin` coexistindo
- [ ] `src/lib/supabase/middleware.ts` — `updateSession(request)`
- [ ] `src/lib/supabase.ts` (barrel) — removido
- [ ] `src/middleware.ts` — matcher positivo, redirect páginas, 401 APIs, renovação cookies
- [ ] `src/lib/auth/require-user.ts` — `requireUser()` + `requirePageUser()`
- [ ] `src/lib/auth/redirect.ts` — `sanitizeRedirectPath()` com allowlist
- [ ] `src/app/(auth)/login/page.tsx` — server component com verificação de sessão
- [ ] `src/app/(auth)/login/login-form.tsx` — client component com form + validação
- [ ] `POST /auth/signout` — Route Handler + limpeza storage no client
- [ ] ENV validation: 3 variáveis obrigatórias verificadas
- [ ] URLs autorizadas documentadas no Supabase (preparação Fase 8)
- [ ] Testes: `requireUser`, `sanitizeRedirectPath`, middleware, login form, logout
- [ ] Testes existentes continuam passando (mock `supabaseAdmin` não é afetado)

---

*Documento criado: 2026-07-04*
*Baseado no alinhamento da milestone v1.2 (D1–D11)*
*Próximo passo: revisão do time, ajustes, então avançar para artefatos de implementação*
