## Context

O Vendeo está em estado pré-auth: todo acesso é público, a identidade da loja é resolvida por `localStorage("store_id")`, e todas as operações usam `supabaseAdmin` sem validação de usuário. A Fase 7 estabelece a camada fundacional de sessão — login, middleware, logout — sobre a qual as próximas fases construirão signup (Fase 8), ownership (Fase 9) e perímetro multitenant (Fase 10).

A fase é autossuficiente: não depende de outras fases, não altera schema do banco, não requer signup. Usuários de desenvolvimento são provisionados via Supabase Dashboard.

## Goals / Non-Goals

**Goals:**
- Instalar e configurar `@supabase/ssr` com `createBrowserClient` / `createServerClient` / `updateSession`
- Refatorar `src/lib/supabase/` removendo singleton e barrel, estabelecendo 3 módulos: client, server, middleware
- Criar `middleware.ts` com matcher positivo que protege páginas e APIs
- Implementar `requireUser()` com adaptação `requirePageUser()` para páginas (redirect) e route handlers (401 JSON)
- Criar página `/login` com formulário email+senha dentro de route group `(auth)`
- Implementar logout via `POST /auth/signout` com limpeza de Web Storage
- Implementar `sanitizeRedirectPath()` com dupla validação e allowlist
- Validar 3 ENV vars obrigatórias na inicialização
- Testes unitários para os 5 módulos (requireUser, redirect, middleware, login, logout)

**Non-Goals:**
- Signup, confirmação de email, `/check-email` — Fase 8
- Recuperação de senha (`/forgot-password`, `/update-password`) — Fase 8
- Resolução de loja (`getCurrentStore()`) — Fase 9
- `requireOwnership(storeId)` — Fase 9
- RLS em qualquer tabela — Fases 9 e 10
- Server Actions com auth — Fase 10
- Remoção estrutural de `localStorage("store_id")` como fonte de identidade — Fase 9
- E2E browser com cookies reais — Fase 11
- Configuração de SMTP — release gate pré-beta

## Decisions

### D1 — Arquitetura dos Clientes Supabase

Três factories independentes em vez de um singleton centralizado:

```
src/lib/supabase/
├── client.ts          createBrowserClient()     // browser-only, client component
├── server.ts          createServerClient()      // SSR + cookies, server component
│                     + supabaseAdmin            // service role (mantido)
└── middleware.ts      updateSession(request)    // Edge, middleware.ts
```

- `client.ts`: usa `createBrowserClient` do `@supabase/ssr`, sem argumentos (lê ENV internamente). Exporta factory function, não singleton. Consumido por componentes client
- `server.ts`: usa `createServerClient` do `@supabase/ssr` com `cookies()`. Exporta factory function `createServerClient()`. `supabaseAdmin` permanece como export nomeado, criado com `createClient` + service role key
- `middleware.ts`: usa `createServerClient` do `@supabase/ssr` com `cookies` do tipo `RequestCookies`. Exporta `updateSession(request)` — função que Next.js middleware chama
- `supabase.ts` (barrel): removido — mistura exports browser e server, viola limites de bundle

O singleton antigo (`export const supabase`) não tem consumidores atuais confirmados. A substituição é segura, mas exige verificação com `git grep` antes do deploy.

### D2 — Contrato de updateSession() e Fluxo do Middleware

`updateSession()` retorna tanto a resposta com cookies renovados quanto as claims, para que o middleware externo não precise criar um segundo cliente:

```
// src/lib/supabase/middleware.ts
async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  claims: JwtPayload | null;
}> {
  const supabase = createServerClient(request);
  const { data, error } = await supabase.auth.getClaims();

  const response = NextResponse.next();
  // cookies já ajustados pelo createServerClient

  return {
    response,
    claims: error ? null : (data?.claims ?? null),
  };
}
```

**Fluxo no middleware:**

```
Request
  │
  ▼
middleware.ts ──matcher: ["/", "/login", "/store/:path*", "/campaign/:path*", "/api/:path*"]
  │
  ├─ const { response, claims } = await updateSession(request)
  │     ← cria server client, valida claims, devolve resposta com cookies
  │
  ├─ if (!claims || !claims.sub):
  │     if (pathname starts with /api): return 401 JSON
  │     if (pathname === "/login"):    return response  ← pública
  │     else:                          redirect /login?redirect=<pathname>
  │
  ├─ if (claims.sub):
  │     if (pathname === "/login"):    redirect /
  │     else:                          return response  ← pass-through
  │
  └─ IMPORTANTE: toda resposta (redirect, 401, next) preserva
     os cookies definidos por updateSession()
```

**Nota sobre cookies em Server Components:** `createServerClient()` com `cookies()` de Server Component não pode gravar (setAll é no-op). Route Handlers e middleware podem. O `requireUser()` lê claims sem necessidade de gravar cookies, portanto funciona em ambos os contextos.

Invariantes:
- Middleware usa `getClaims()`, nunca `getSession()`
- Middleware **não consulta existência de loja**
- Matcher positivo elimina necessidade de excluir `/_next/`, `/_vercel/`, assets
- 401 do middleware é barreira temporária — handlers ainda precisam de `requireUser()` próprio nas fases seguintes

### D3 — requireUser() em Duas Camadas

```
src/lib/auth/require-user.ts

interface AuthenticatedUser {
  userId: string;
  claims: JwtPayload;
}

class UnauthorizedError extends Error {}

async function requireUser(): Promise<AuthenticatedUser> {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) throw new UnauthorizedError();

  return {
    userId: claims.sub,
    claims,
  };
}

// Adaptação para páginas (Server Components)
async function requirePageUser(): Promise<AuthenticatedUser> {
  try {
    return await requireUser();
  } catch {
    redirect("/login");
  }
}

// Adaptação para Route Handlers
async function requireApiUser(): Promise<AuthenticatedUser> {
  try {
    return await requireUser();
  } catch {
    throw new UnauthorizedError();  // capturado por handler → 401 JSON
  }
}
```

A segregação evita uma função única que precisa decidir entre redirect, Response e throw. Server Actions têm semântica definida na Fase 10.

### D4 — Logout com Form Action

```
<form action="/auth/signout" method="POST" onSubmit={clearStorage}>
```

O formulário nativo HTML com `action="/auth/signout"` + `method="POST"` permite que o redirect do Route Handler navegue o browser naturalmente. O `onSubmit` executa a limpeza de storage **antes** da submissão.

```
Cliente (<form>)
  │
  1. onSubmit: limpa storage:
  │    sessionStorage.removeItem("campaign_draft")
  │    sessionStorage.removeItem("campaign_draft_image")
  │    sessionStorage.removeItem("campaign_preview")
  │    localStorage.removeItem("store_id")
  │
  2. POST /auth/signout  (navegação nativa do form)
  │
  ▼
Server (Route Handler)
  │
  3. createServerClient()
  4. supabase.auth.signOut()
  5. revalidatePath("/")
  6. redirect("/login")   ← browser segue o redirect naturalmente
```

A limpeza seletiva (chaves conhecidas, não `clear()`) evita afetar outros dados do domínio. Se o submit falhar, o storage já está limpo.

`localStorage("store_id")` continua como fonte transitória de store_id entre sessões (até Fase 9), mas é limpo no logout para impedir vazamento entre sessões no mesmo navegador.

### D5 — Redirect Preservation com Dupla Validação

```
src/lib/auth/redirect.ts

function sanitizeRedirectPath(path: string): string {
  // 1. Parse com URL (base relativa → /)
  // 2. Valida pathname contra allowlist (match exato, não startsWith):
  //    pathname === "/" ||
  //    pathname === "/store" ||
  //    pathname.startsWith("/campaign/")
  // 3. Rejeita:
  //    - URLs absolutas (http://, https://)
  //    - Protocol-relative (//)
  //    - Backslashes
  //    - Caminhos de auth (/login, /signup, /auth/*)
  // 4. Preserva query string como dados opacos (parsing seguro com URL)
  // 5. Descarta fragmentos (#)
  // 6. Fallback: "/"
}
```

**Fluxo:**
1. Middleware detecta página protegida sem sessão → `redirect("/login?redirect=/caminho-original")`
2. Página de login lê `searchParams.redirect`
3. Valida com `sanitizeRedirectPath()` antes de `router.replace()`

Dupla validação porque middleware e página de login estão em camadas diferentes (Edge vs browser) — validar nos dois extremos é barato e previne open redirect.

### D6 — Layout das Páginas de Auth

```
src/app/(auth)/
├── layout.tsx          logo + container centralizado
├── login/
│   ├── page.tsx        server component
│   │                     - (não usa requirePageUser — middleware já trata)
│   │                     - renderiza <LoginForm redirect={searchParams.redirect} />
│   └── login-form.tsx  client component ("use client")
│                         - email + senha + submit
│                         - loading state
│                         - erro genérico (sem revelar "usuário não existe")
│                         - sucesso → router.replace(redirect || "/")
```

- Route group `(auth)` não altera a URL
- Layout próprio: sem header de navegação, sem footer complexo
- Tema dark mantido (`#020617` background)
- UI mínima: email, senha, botão submit, mensagem de erro
- Sem link para signup — inexistente nesta fase
- O middleware já redireciona usuários autenticados em `/login` para `/` — a página server component confia nisso

### D7 — Testes com Mock nos Módulos Próprios

```
Mock alvo: @/lib/supabase/server  (createServerClient)
            @/lib/supabase/client  (createBrowserClient)

Categorias:
  1. requireUser:
     - getClaims() → claims com sub → retorna AuthenticatedUser
     - getClaims() → error → UnauthorizedError
     - getClaims() → claims sem sub → UnauthorizedError

  2. sanitizeRedirectPath:
     - Caminhos permitidos: "/", "/store", "/campaign/preview"
     - Rejeitados: "https://evil.com", "//evil.com", "/login", "\\evil"
     - Fallback em caso vazio

  3. Middleware (simular Request):
     - / sem sessão → redirect /login?redirect=/
     - /campaign/preview sem sessão → redirect /login?redirect=/campaign/preview
     - /api/store sem sessão → 401 JSON
     - /login com sessão → redirect /
     - / com sessão → pass-through

  4. Login form (render + submit):
     - Renderiza campos email/senha/botão
     - Submit com credenciais → chama signInWithPassword + redirect
     - Submit com erro → exibe mensagem de erro

   5. Logout:
     - Remove 4 chaves do storage
     - Form action POST /auth/signout com redirect nativo
```

Mockar `@/lib/supabase/server` e `@/lib/supabase/client`, não os módulos internos de `@supabase/ssr`. E2E real de cookies e renovação postergado para Fase 11.

### D8 — Validação de Ambiente

As 3 variáveis já existem no `.env.local` e são validadas no import dos módulos de cliente. A Fase 7 deve garantir que:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são validadas em `client.ts`
- `SUPABASE_SERVICE_ROLE_KEY` é validada em `server.ts`
- Supabase Auth está habilitado no projeto (verificação manual/documentada)
- URLs autorizadas (Site URL, redirect URLs) estão configuradas no dashboard do Supabase para localhost, produção e previews

## Risks / Trade-offs

| Risco | Impacto | Mitigação |
|---|---|---|
| Singleton antigo tem consumidor residual | Runtime error ao importar `supabase` | `git grep` exaustivo antes do deploy. CI detecta imports quebrados |
| Middleware redireciona loop (autenticado → middleware vê como não autenticado) | UX quebrada | `/login` está no matcher mas a política permite acesso sem sessão. `updateSession()` roda antes de `getClaims()` |
| `createServerClient` com cookies falha em runtime específico | Login não cria sessão | Testar manualmente o fluxo completo. Fixar versão do `@supabase/ssr` |
| Logout não limpa storage por erro de script | Dados residuais entre sessões | Limpeza é client-side **antes** da submissão do form. Independe do servidor |
| Testes mockados perdem nuances de cookie/sessão | Falso positivo | Aware gap. E2E programado para Fase 11 |

## Data Flow

```
LOGIN FLOW
══════════

  Browser                         Server (Next.js)
  ───────                         ────────────────
  GET /login
    │
    ├── middleware.ts ── updateSession() → getClaims()
    │                      └─ sem claims → NextResponse.next()  [pública]
    │
    ▼
  <LoginForm />                  login/page.tsx
      │                               └─ (sem auth check — middleware já tratou)
    │
   │  email + senha
   │  ────────────►  supabase.auth.signInWithPassword()  (chamada direta do client)
   │                      │
   │                      ├─ sucesso: cookie definido + redirect / ou ?redirect=
   │                      └─ erro: mensagem genérica
    │
    ▼
  GET / (protegida)
    │
    ├── middleware.ts ── updateSession() → getClaims()
    │                      └─ claims válidas → NextResponse.next() + cookie renovado
    │
    ▼
  Página carrega


LOGOUT FLOW
═══════════

  Browser                         Server (Next.js)
  ───────                         ────────────────

  1. <form onSubmit={clearStorage} action="/auth/signout" method="POST">
     Limpa storage (onSubmit):
     sessionStorage.removeItem("campaign_draft")
     sessionStorage.removeItem("campaign_draft_image")
     sessionStorage.removeItem("campaign_preview")
     localStorage.removeItem("store_id")

  2. POST /auth/signout (navegação nativa do form) ──────►  Route Handler
                                      │
                                      ├─ createServerClient()
                                      ├─ supabase.auth.signOut()
                                      ├─ revalidatePath("/")
                                      └─ redirect("/login")
