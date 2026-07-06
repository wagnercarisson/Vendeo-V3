## Context

A Fase 7 entregou a infraestrutura de sessão: clientes Supabase SSR (`createBrowserClient`/`createServerClient`/`updateSession`), middleware com matcher de 5 rotas, login, logout, `requireUser()` e `sanitizeRedirectPath()`. Usuários ainda precisam ser provisionados manualmente no Supabase Dashboard — não há criação de conta, confirmação de email nem recuperação de senha.

A Fase 8 implementa o ciclo completo de credenciais sobre a camada existente. Depende da Fase 7 (middleware, `requireUser()`, login, logout). Não altera schema do banco.

## Goals / Non-Goals

**Goals:**
- Criar `/signup` com formulário de cadastro (email + senha + confirmar), validação client-side (6 caracteres, senhas conferem), sempre redirect `/check-email`
- Criar `/check-email` com copy contextual via `?type=signup|recovery`, sem revelar email
- Criar `/auth/confirm` como route handler unificado que processa `token_hash` + `type` via `verifyOtp()` e valida `next` contra allowlist
- Criar `/forgot-password` com formulário de email, sempre redirect `/check-email?type=recovery`
- Criar `/update-password` com formulário de nova senha, `updateUser({ password })`, redirect `/` com sessão mantida
- Expandir middleware: matcher de 5 para 10 rotas, `PUBLIC_ROUTES`, `ALWAYS_PASSTHROUGH`, novas regras de redirect
- Anti-enumeration: signup e forgot-password nunca revelam se email existe
- Adicionar `NEXT_PUBLIC_SITE_URL` ao `.env.example` com validação
- Testes para os 5 novos módulos + middleware expandido + regressão

**Non-Goals:**
- Onboarding/criação de loja — Fase 9
- `getCurrentStore()` / `requireOwnership(storeId)` — Fase 9
- RLS em qualquer tabela — Fases 9 e 10
- Server Actions com auth — Fase 10
- Remoção estrutural de `localStorage("store_id")` — Fase 9
- Configurações de conta, troca de email, perfil — fora de escopo v1.2
- OAuth social / Magic link — exclusão deliberada v1.2
- E2E automatizado com cookies reais — Fase 11
- SMTP em produção — release gate pré-beta externo
- Botão "Reenviar email" — adiado para milestone futura

## Decisions

### D1 — Layout das novas páginas: route group (auth) existente + root layout

`CONFIRMADO`

```
src/app/
├── layout.tsx                     ✓ root layout — renderiza <AuthHeader /> SEMPRE
│                                     (AuthHeader retorna null se não autenticado,
│                                      mas o server component roda em toda requisição)
├── (auth)/
│   ├── layout.tsx                 ✓ existente — container centralizado, logo, dark
│   ├── login/                     ✓ existente
│   ├── signup/                    ✗ novo
│   ├── check-email/               ✗ novo
│   ├── forgot-password/           ✗ novo
│   └── update-password/           ✗ novo
├── auth/
│   ├── signout/route.ts           ✓ existente
│   └── confirm/route.ts           ✗ novo (fora do route group — é route handler)
```

**Hierarquia de renderização (App Router):**

```
RootLayout
  ├── <header> <AuthHeader /> </header>   ← renderiza em TODAS as páginas
  │     └── se não autenticado → null (invisível, mas requireUser() roda)
  │     └── se autenticado → <LogoutButton />
  └── (auth)/layout.tsx                   ← não substitui root layout, aninha dentro dele
        └── página (signup, check-email, etc.)
```

O `AuthHeader` roda `requireUser()` em todas as páginas. Para não autenticados captura `UnauthorizedError` e retorna `null` — sem efeito colateral. As novas páginas no `(auth)` herdam o layout centralizado existente.

### D2 — /auth/confirm: route handler unificado (signup + recovery)

`CONFIRMADO`

```
src/app/auth/confirm/route.ts   (fora do route group — rota de API, sem HTML)
```

**Query params:** `token_hash` (hash do token), `type` (`signup` | `recovery`), `next` (redirect opcional)

**Comportamento:**

```
GET /auth/confirm?token_hash=xxx&type=signup
  → supabase.auth.verifyOtp({ type: 'signup', token_hash })
  → sucesso: redirect /
  → falha:   redirect /login?error=confirmation_failed

GET /auth/confirm?token_hash=xxx&type=recovery&next=/update-password
  → supabase.auth.verifyOtp({ type: 'recovery', token_hash })
  → sucesso: redirect /update-password (next validado)
  → falha:   redirect /login?error=recovery_failed
```

**Validação de `next`** — allowlist inline:

```typescript
const VALID_NEXT = ["/", "/update-password"] as const;
const rawNext = searchParams.get("next") || "/";
const safeNext = VALID_NEXT.includes(rawNext as typeof VALID_NEXT[number])
  ? rawNext
  : "/";
```

**Chamadas que geram os links:**

```typescript
// Signup — emailRedirectTo é CRÍTICO
supabase.auth.signUp({
  email, password,
  options: { emailRedirectTo: `${siteUrl}/auth/confirm` },
});

// Recovery — redirectTo popula {{ .RedirectTo }}
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${siteUrl}/auth/confirm`,
});
```

**Templates de email (Supabase Dashboard):**

| Template | Conteúdo do link |
|----------|-----------------|
| Confirmation | `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup` |
| Reset Password | `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/update-password` |

O handler NÃO renderiza HTML — é route handler puro. Retorna `NextResponse.redirect()` em todos os casos.

**O handler NÃO lida com PKCE/code.** O `@supabase/ssr` usa PKCE como flow padrão, mas ao customizar os templates com `{{ .TokenHash }}`, o link contém `token_hash`. `verifyOtp()` processa esse token e cria a sessão — sem necessidade de `exchangeCodeForSession()`.

### D3 — Middleware: matcher expandido + classificação de rotas

`CONFIRMADO`

**Matcher — 10 entradas:**

```
"/", "/login", "/signup", "/check-email", "/forgot-password",
"/update-password", "/auth/confirm", "/store/:path*",
"/campaign/:path*", "/api/:path*"
```

**Classificação:**

| Rota | Sem auth | Com auth |
|------|----------|----------|
| `/` (root) | ➡ redirect `/login?redirect=/` | ✅ pass-through |
| `/login` | ✅ pass-through | ➡ redirect `/` |
| `/signup` | ✅ pass-through | ➡ redirect `/` |
| `/check-email` | ✅ pass-through | ➡ redirect `/` |
| `/forgot-password` | ✅ pass-through | ➡ redirect `/` |
| `/auth/confirm` | ✅ pass-through (processa token) | ✅ pass-through (sempre) |
| `/update-password` | ➡ redirect `/login` | ✅ pass-through |
| `/store/:path*` | ➡ redirect `/login` | ✅ pass-through |
| `/campaign/:path*` | ➡ redirect `/login` | ✅ pass-through |
| `/api/:path*` | ➡ 401 JSON | ✅ pass-through |

**Lógica:**

```typescript
const PUBLIC_ROUTES = new Set([
  "/login", "/signup", "/check-email", "/forgot-password",
]);

const ALWAYS_PASSTHROUGH = new Set(["/auth/confirm"]);

if (isAlwaysPassthrough) return response;

if (!claims?.sub) {
  if (isApiRoute) return unauthorizedJson(response);
  if (isPublicRoute) return response;
  return redirectToLogin(request, response);
}

if (isPublicRoute || pathname === "/login") {
  return redirectToHome(request, response);
}
return response;
```

**Invariantes:**
- `/update-password` não está em `PUBLIC_ROUTES` — exige autenticação
- `/auth/confirm` está em `ALWAYS_PASSTHROUGH` — passa com ou sem sessão. Essencial para recovery link clicado em navegador já logado
- `/auth/signout` não está no matcher (é POST-only, não GET)

### D4 — Anti-enumeration: normalize signup output

`CONFIRMADO`

Toda chamada a `supabase.auth.signUp()` termina em `router.replace("/check-email?type=signup")`, independente de sucesso ou erro.

```typescript
const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
// Sempre redirect para /check-email?type=signup — impede enumeração de email
router.replace("/check-email?type=signup");
```

Para forgot-password, mesma regra:

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
router.replace("/check-email?type=recovery");
```

### D5 — /check-email com copy contextual (sem revelar email)

`CONFIRMADO`

Server component que lê `searchParams.type` e seleciona o texto:

```
/check-email              → texto genérico (fallback)
/check-email?type=signup  → "Enviamos um link de confirmação para o email informado..."
/check-email?type=recovery → "Enviamos um link de redefinição de senha..."
```

Protegido por middleware: se autenticado acessar, redirect `/`.

### D6 — /update-password: requere sessão autenticada

`CONFIRMADO`

- `/update-password` não é página pública — exige sessão ativa
- Atingido via fluxo recovery: `/forgot-password` → email → `/auth/confirm` → redirect `/update-password`
- `verifyOtp({ type: 'recovery' })` cria a sessão que autoriza o acesso
- Pós-submissão:

```typescript
const { error } = await supabase.auth.updateUser({ password });

if (error) {
  setError("Não foi possível atualizar a senha. Tente novamente.");
  return;
}

router.replace("/");
```

Sessão permanece ativa — `updateUser()` não invalida a sessão atual no Supabase.

### D7 — Validação client-side de senha

`CONFIRMADO`

- Senha mínima: 6 caracteres
- Confirmar senha: deve ser igual ao campo senha
- Mensagens em português: "A senha deve ter no mínimo 6 caracteres", "As senhas não conferem"
- Validação usa `useState` para mensagens de erro
- Aplicado em signup e update-password

### D8 — Auto-confirm em dev, confirmação real como release gate

`CONFIRMADO`

- **Dev (rápido):** `enable_confirmations = false` em `supabase/config.toml`. `signUp()` retorna `data.session` → middleware trata auto-redirect
- **UAT local:** `enable_confirmations = true` em `supabase/config.toml`, stack reiniciado. Mailpit (embutido no `supabase start`) captura os emails
- **Produção:** "Enable email confirmation" ligado no Supabase Dashboard. SMTP Hostinger configurado. Templates customizados com `{{ .TokenHash }}`

### D9 — NEXT_PUBLIC_SITE_URL

`CONFIRMADO`

- Adicionada ao `.env.example` com valor `http://localhost:3000`
- Validada com throw em caso de ausência nas chamadas de `signUp()` / `resetPasswordForEmail()`
- Usada como base para `emailRedirectTo` e `redirectTo`

### D10 — Tratamento de erro genérico em todas as páginas

`CONFIRMADO`

| Página | Comportamento |
|--------|--------------|
| Signup (qualquer resultado) | `router.replace("/check-email?type=signup")` |
| Forgot password (qualquer resultado) | `router.replace("/check-email?type=recovery")` |
| Update password (erro) | `setError("Não foi possível atualizar a senha. Tente novamente.")` |
| Auth/confirm (falha signup) | redirect `/login?error=confirmation_failed` |
| Auth/confirm (falha recovery) | redirect `/login?error=recovery_failed` |

Anti-enumeration: `/check-email` nunca exibe o email do usuário.

### D11 — Testes mockando módulos próprios (padrão Fase 7)

`CONFIRMADO`

| Categoria | O que testar |
|-----------|-------------|
| Signup form | Renderização, submit (sempre redirect /check-email), validação client-side, loading state |
| Check-email page | Renderização com cada type |
| Auth/confirm handler | Token signup válido → redirect /, recovery válido → redirect /update-password, inválido → redirect /login?error=, sem token → redirect /login?error=, next inválido → fallback / |
| Forgot-password form | Renderização, submit (sempre redirect /check-email), loading state |
| Update-password form | Renderização, submit sucesso → redirect /, submit erro → mensagem, validação client-side, loading state |
| Login form (nav) | Links "Criar conta" → /signup e "Esqueci minha senha" → /forgot-password renderizados e navegáveis, sem submeter o form |
| Middleware | Novas rotas: sem auth — públicas pass-through; /update-password redirect /login; com auth — públicas redirect /, /update-password pass-through; **/auth/confirm ALWAYS_PASSTHROUGH (anônimo ✅, autenticado ✅)** |

Mockar `@/lib/supabase/server` e `@/lib/supabase/client` (padrão existente).

### D12 — Navegação login → signup / forgot-password

`CONFIRMADO`

O formulário de login (Fase 7) não possuía links para outras páginas de auth porque signup e forgot-password não existiam. Com a Fase 8, ambos existem e o ciclo de credenciais precisa ser descobrível.

- Link "Criar conta" adicionado abaixo do botão submit, navegando para `/signup`
- Link "Esqueci minha senha" adicionado abaixo do campo de senha, navegando para `/forgot-password`
- Links usam `<Link>` do Next.js (navegação client-side, sem submeter o form)
- Estilizados conforme padrão do design system: `text-blue-400 hover:text-blue-300`, underline no hover — consistente com o botão "Entrar" (`bg-blue-600`)
- Nenhuma outra alteração no formulário de login — submit, erro, loading e redirect preservation permanecem idênticos

### D13 — Arquitetura operacional do UAT

`CONFIRMADO`

O UAT do ciclo de confirmação é dividido em dois ambientes independentes:

**UAT local (obrigatório, baixa fricção):**
- Stack Supabase local via `npx supabase start` — inclui Mailpit (servidor SMTP de captura) em `localhost:54325`
- URLs configuradas no `config.toml`: `[auth] site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000/auth/confirm"]`
- Templates de email em arquivos HTML em `supabase/templates/`, referenciados por `[auth.email.template.confirmation].content_path` e `[auth.email.template.recovery].content_path` no `config.toml`. Conteúdo do link usa `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=...`
- `enable_confirmations` alternado em `[auth.email]` via `config.toml` + reinício do stack (não via Dashboard — o Dashboard local não existe)
- Fluxo: signup → Mailpit captura email → clicar link real → `/auth/confirm` processa → login
- Fluxo: forgot-password → Mailpit captura email → clicar link → `/auth/confirm` → `/update-password` → nova senha → login
- Independe de conectividade externa, DNS ou SMTP

**UAT online (release gate para beta fechado):**
- Projeto Supabase remoto (não local) com SMTP Hostinger configurado no Dashboard
- Vercel Preview Deployment com Standard Protection e URL própria
- `NEXT_PUBLIC_SITE_URL` = URL da Preview em cada ambiente
- Templates de email mantidos no Dashboard (configuração remota substitui a local)
- Teste de deliverability (Gmail, Outlook) e validação de callback para mesma Preview
- Configuração de SMTP é por projeto Supabase — ambientes dev e produção têm configurações independentes

**Separação de responsabilidades:**

| Aspecto | Local | Online |
|---------|-------|--------|
| Provedor de email | Mailpit (captura local) | SMTP Hostinger |
| Config de URLs | `config.toml` (`site_url`, `additional_redirect_urls`) | Supabase Dashboard (Redirect URLs) |
| Config de templates | `config.toml` + HTML em `supabase/templates/` | Supabase Dashboard |
| Confirmação habilitada | Alternado via `config.toml` + restart | Dashboard toggle |
| Valida callback | Localhost | URL da Preview |
| Teste spam | N/A | Gmail + Outlook |
| Dependência externa | Nenhuma | DNS, Vercel, Supabase remoto, Hostinger |

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `supabase/config.toml` não gerado ou `enable_confirmations` não alternado | Alto — UAT local não funciona ou email não é enviado | `npx supabase init` na setup. Alternar `enable_confirmations` + reinício explícitos nas tasks |
| Templates de email não configurados (local ou Dashboard) | Médio — link de confirmação pode não conter `token_hash` | Templates customizados em `config.toml` (local) e Dashboard (online). Verificar antes dos testes manuais |
| SMTP não configurado — emails não chegam | Bloqueante para confirmação real | UAT local usa Mailpit (Supabase local); UAT online usa Hostinger |
| updateUser({ password }) falha silenciosamente | Médio — usuário acredita que senha foi alterada | Tratar erro no client com mensagem visível |
| Email já existente em auto-confirm dev | Baixo — comportamento esperado e normalizado para /check-email | Sempre redirect /check-email; middleware redireciona para / em caso de sucesso com sessão |
| Root layout roda requireUser() em páginas de auth | Muito baixo — AuthHeader retorna null | Código atual já trata UnauthorizedError |
| Testes não cobrem fluxo real de confirmação | Médio — falso positivo se route handler tiver bug | UAT manual com Supabase local cobre a lacuna. E2E na Fase 11 |
