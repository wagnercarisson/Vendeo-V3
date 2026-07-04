# Alinhamento Fase 8 — Ciclo de Conta

## Contexto

```
v1.2 — Contas e Propriedade          (milestone)
  ├── Fase 1 / Phase 7 — Sessão e Login Vertical    ✓ (concluída)
  ├── Fase 2 / Phase 8 — Ciclo de Conta             ← esta fase
  ├── Fase 3 / Phase 9 — Cutover de Ownership       (pendente)
  ├── Fase 4 / Phase 10 — Perímetro Multi-tenant    (pendente)
  └── Fase 5 / Phase 11 — Verificação e Hardening   (pendente)
```

Esta fase implementa o ciclo completo de credenciais: criação de conta, confirmação de email e recuperação de senha. Depende da Fase 7 (login, middleware, `requireUser()`).

**Dependências:** Fase 7 — precisa de `requireUser()`, middleware, login, logout.

---

## Propósito

1. Criar `/signup` — formulário de cadastro (email + senha + confirmar senha)
2. Criar `/check-email` — instrução genérica pós-signup e pós-recuperação
3. Criar `/auth/confirm` — route handler que processa token de confirmação (signup + recovery)
4. Criar `/forgot-password` — formulário de solicitação de redefinição de senha
5. Criar `/update-password` — formulário de nova senha (acessado via recovery flow)
6. Atualizar `middleware.ts` — expandir matcher e lógica para as novas rotas
7. Validar confirmação real com UAT manual (Supabase local ou SMTP de teste)

**Entrega verificável:**
- Ciclo de signup: `cria conta → /check-email → confirma email → login`
- Ciclo de recuperação: `forgot → email → confirma token → nova senha → login`
- Ambos os ciclos funcionam com confirmação habilitada (UAT manual)

---

## Estado Atual

```
                           ANTES (Fase 7)                    DEPOIS (Fase 8)
═════════════════════════════════════════════════════════════════════════════════
/signup                    ✗ não existe                       ✓ (auth)/signup form
/check-email               ✗ não existe                       ✓ página pública
/auth/confirm              ✗ não existe                       ✓ route handler (signup + recovery)
/forgot-password           ✗ não existe                       ✓ (auth) formulário
/update-password           ✗ não existe                       ✓ (auth) formulário (requer sessão)
Middleware matcher         5 rotas                             ✓ + /signup, /check-email,
                                                                 /forgot-password, /update-password,
                                                                 /auth/confirm (rota individual)
Middleware lógica          pública: /login                     ✓ pública: /login, /signup, /check-email,
                                                                  /forgot-password
                                                                always-passthrough: /auth/confirm
                                                                protegida: /update-password (requer auth)
redirect allowlist         "/", "/store", "/campaign/*"        mantida. /auth/confirm usa validador
                                                                 próprio para param next (["/", "/update-password"])
NEXT_PUBLIC_SITE_URL      ✗ não necessária (Fase 7)           ✓ adicionada, validada, usada em
                                                                 emailRedirectTo e redirectTo
testes                    344 existentes                       7+ novas categorias
```

---

## Decisões de Arquitetura

### D1 — Escopo delimitado: credenciais sem onboarding

`CONFIRMADO`

- Fase 8 entrega apenas o ciclo de credenciais: criar conta, confirmar email, recuperar senha
- Onboarding (criação de loja, estado "sem loja") fica na Fase 9
- Usuário recém-cadastrado pode fazer login, mas não tem loja — será redirecionado para `/store` pelo fluxo da Fase 9
- Recuperação de senha usa fluxo mínimo: formulário → email → `/auth/confirm` → `/update-password` → nova senha
- Sem configurações de conta, troca de email ou administração de perfil

### D2 — Layout das novas páginas: route group (auth) existente + root layout

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

**Implicação:** O `AuthHeader` roda `requireUser()` em todas as páginas, inclusive nas de auth. Para usuários não autenticados, ele captura `UnauthorizedError` e retorna `null` — sem efeito colateral. Isso é aceitável e não causa redirect porque o catch trata o erro.

**Novas páginas no route group** `(auth)`:
- Todas herdam o layout centralizado existente (container + logo + dark)
- Nenhuma renderiza o header de navegação principal (o `AuthHeader` fica vazio)

### D3 — /auth/confirm como route handler unificado (signup + recovery)

`CONFIRMADO`

```
src/app/auth/confirm/route.ts   (fora do route group — é rota de API, sem HTML)
```

**Responsabilidade:** processar token de confirmação de email, independente do tipo.

**Query params recebidos:**
- `token_hash` — hash do token de confirmação (enviado por Supabase no email)
- `type` — tipo do fluxo: `signup` | `recovery` | `email_change` (apenas signup e recovery são escopo v1.2)
- `next` — redirect opcional pós-confirmação (validado contra allowlist)

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

**Validação do param `next`:**

```typescript
// Rígida — apenas destinos explícitos, sem query string, sem pathname dinâmico
const VALID_NEXT = ["/", "/update-password"] as const;
const rawNext = searchParams.get("next") || "/";
const safeNext = VALID_NEXT.includes(rawNext as typeof VALID_NEXT[number])
  ? rawNext
  : "/";
```

Isso atende a **invariante #10 da milestone** (redirect validation com allowlist). O `next` é o ÚNICO destino pós-confirmação e só aceita `/` e `/update-password`.

**Chamadas que geram os links:**

```typescript
// Signup — emailRedirectTo é CRÍTICO: popula {{ .RedirectTo }} no template.
// Deve ser a URL EXATA do ambiente atual (localhost / preview / produção).
supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${siteUrl}/auth/confirm`,
  },
});

// Recovery — redirectTo popula {{ .RedirectTo }} no template de recovery.
// O template já inclui &next=/update-password na URL final.
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${siteUrl}/auth/confirm`,
});
```

**O handler NÃO renderiza HTML** — é route handler puro. Retorna `NextResponse.redirect()` em todos os casos.

**Fluxo completo de recovery via /auth/confirm:**

```
User em /forgot-password
  → preenche email
  → resetPasswordForEmail(email, { redirectTo: `${siteUrl}/auth/confirm` })
  → Template de recovery popula {{ .RedirectTo }} + token_hash + type + next:
       {redirectTo}?token_hash=xxx&type=recovery&next=/update-password
  → User clica o link
  → Middleware: sem sessão, /auth/confirm é público → pass-through
  → Route handler: verifyOtp({ type: 'recovery', token_hash })
       → sucesso: cookie de sessão definido, redirect /update-password
       → falha: redirect /login?error=recovery_failed
  → /update-password: sessão ativa, form de nova senha
  → User submete nova senha → updateUser({ password })
  → redirect /
```

**Configuração de email templates no Supabase (determinístico):**

O fluxo oficial e determinístico para v1.2 usa **templates customizados** com `{{ .TokenHash }}` + `{{ .RedirectTo }}` + `verifyOtp()`. Isso garante que o link de confirmação aponte para o ambiente correto (dev, preview, produção) sem depender de um único `SITE_URL`.

**Template de Confirmação de Signup** (Authentication → Email Templates → Confirmation):
```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup
```

**Template de Recuperação de Senha** (Authentication → Email Templates → Reset Password):
```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/update-password
```

**Template de Email de Alteração** (caso o Supabase notifique — pode permanecer default ou usar link similar com `type=email_change`).

**IMPORTANTE:** `{{ .RedirectTo }}` é populado pelo parâmetro `redirectTo` / `emailRedirectTo` passado nas chamadas do cliente (`signUp()`, `resetPasswordForEmail()`). Cada ambiente (dev, preview, produção) passa sua própria URL, resolvendo o conflito de múltiplos ambientes com um único SITE_URL no Supabase.

**Fluxo resultante (determinístico):**

```
User clica link → browser navega para:
  /auth/confirm?token_hash=xxx&type=signup
  ou
  /auth/confirm?token_hash=xxx&type=recovery&next=/update-password

→ Middleware: /auth/confirm é ALWAYS_PASSTHROUGH → passa sem redirect
→ Route handler: lê token_hash + type, chama verifyOtp({ type, token_hash })
→ Se signup: redirect /
→ Se recovery: redirect /update-password (next validado contra allowlist)
→ Se falha: redirect /login?error=..._failed
```

**O handler NÃO lida com PKCE/code.** O `@supabase/ssr` usa PKCE como flow padrão, mas ao customizar os templates com `{{ .TokenHash }}`, o link enviado por email contém `token_hash` em vez de `code`. O `verifyOtp()` processa esse token e cria a sessão — sem necessidade de `exchangeCodeForSession()`. Isso elimina a ambiguidade de ter dois fluxos concorrentes no mesmo handler.

### D4 — Middleware: matcher expandido + classificação de rotas

`CONFIRMADO`

```
// Matcher expandido — 10 entradas
"/", "/login", "/signup", "/check-email", "/forgot-password",
"/update-password", "/auth/confirm", "/store/:path*",
"/campaign/:path*", "/api/:path*"
```

**Observação:** `/auth/:path*` NÃO é usado como prefixo. Cada rota `/auth/*` é listada individualmente (`/auth/confirm`, `/auth/signout`). Isso evita tratar `/auth/signout` como rota pública por engano (signout é POST-only, não GET). Atualmente `/auth/signout` não está no matcher, mas quando estiver, será adicionada explicitamente.

**Classificação de rotas no middleware:**

| Rota | Sem auth | Com auth |
|------|----------|----------|
| `/` (root) | ➡ redirect `/login?redirect=/` | ✅ pass-through |
| `/login` | ✅ pass-through | ➡ redirect `/` |
| `/signup` | ✅ pass-through | ➡ redirect `/` |
| `/check-email` | ✅ pass-through | ➡ redirect `/` |
| `/forgot-password` | ✅ pass-through | ➡ redirect `/` |
| `/auth/confirm` | ✅ pass-through (processa token) | ✅ pass-through (sempre — recovery link em navegador logado) |
| `/update-password` | ➡ redirect `/login` | ✅ pass-through (requer sessão ativa) |
| `/store/:path*` | ➡ redirect `/login` | ✅ pass-through (loja verificada na página) |
| `/campaign/:path*` | ➡ redirect `/login` | ✅ pass-through |
| `/api/:path*` | ➡ 401 JSON | ✅ pass-through |

**Lógica implementada:**

```typescript
// Rotas públicas: anônimo passa, autenticado redireciona para /
const PUBLIC_ROUTES = new Set([
  "/login", "/signup", "/check-email", "/forgot-password",
]);

// Rotas que SEMPRE passam, independente de auth — /auth/confirm precisa
// processar token mesmo se usuário já tiver sessão (ex: recovery link
// clicado em navegador logado).
const ALWAYS_PASSTHROUGH = new Set(["/auth/confirm"]);

const pathname = request.nextUrl.pathname;
const isApiRoute = pathname.startsWith("/api/");
const isPublicRoute = PUBLIC_ROUTES.has(pathname);
const isAlwaysPassthrough = ALWAYS_PASSTHROUGH.has(pathname);

if (isAlwaysPassthrough) return response;

if (!claims?.sub) {
  if (isApiRoute) return unauthorizedJson(response);
  if (isPublicRoute) return response;
  return redirectToLogin(request, response);
}

// Authenticated
if (isPublicRoute || pathname === "/login") {
  return redirectToHome(request, response);
}
return response;
```

**Invariantes:**
- Middleware não consulta banco de dados (valida apenas token JWT + decide rota)
- `/update-password` não está em `PUBLIC_ROUTES` — exige autenticação
- `/auth/confirm` está em `ALWAYS_PASSTHROUGH` — passa com ou sem sessão. Essencial para recovery link clicado em navegador já logado
- `/auth/signout` não está no matcher atualmente (não precisa — é POST-only, não GET)

### D5 — Anti-enumeration: normalize signup output

`CONFIRMADO`

**Regra:** Toda chamada a `supabase.auth.signUp()` termina em `router.replace("/check-email")`, independente de sucesso ou erro.

```typescript
const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });

// Sempre redirect para /check-email — impede enumeração de email
// Em auto-confirm, o middleware redireciona autenticados para /
router.replace("/check-email");
```

**Comportamento resultante:**

| Cenário | Auto-confirm (dev) | Com confirmação (prod) |
|---------|-------------------|----------------------|
| Novo email | signUp → session → redirect /check-email → middleware vê sessão → redirect `/` | signUp → sem sessão → redirect /check-email → página renderiza |
| Email existe | signUp → erro (User already registered) → redirect /check-email → sem sessão → página renderiza | signUp → erro → redirect /check-email → página renderiza |
| Erro de rede | signUp → erro → redirect /check-email → sem sessão → página renderiza | igual |

**Em auto-confirm:** o middleware intercepta o redirect para `/check-email` e redireciona para `/` porque o usuário já tem sessão. O usuário nunca vê `/check-email`. Isso é consistente com a transição de estado da milestone: "Não auth → Autenticado" via signup com auto-confirm (linha 268 do alinhamento da milestone).

**Para forgot-password**, a mesma regra se aplica:

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
// Sempre redirect para /check-email
router.replace("/check-email");
```

### D6 — /check-email com copy contextual (sem revelar email)

`CONFIRMADO`

`/check-email` recebe um search param opcional `type` para ajustar o texto:

```
/check-email              → texto genérico (fallback)
/check-email?type=signup  → "Enviamos um link de confirmação para o email informado..."
/check-email?type=recovery → "Enviamos um link de redefinição de senha..."
```

**Implementação:** server component que lê `searchParams.type` e seleciona o texto. Sempre mensagem genérica — nunca "Enviamos para exemplo@email.com". O texto não revela se o email existe ou não.

**Fallback quando `type` não está presente:** texto neutro que funciona para ambos os contextos.

**Protegido por middleware:** se autenticado acessar, redirect `/`.

### D7 — /update-password: requere sessão autenticada

`CONFIRMADO`

- `/update-password` **não é página pública** — exige sessão ativa
- Atingido exclusivamente via fluxo: `/forgot-password` → email → `/auth/confirm` (type=recovery) → redirect `/update-password`
- O `verifyOtp({ type: 'recovery' })` cria a sessão que autoriza o acesso
- Usuário com sessão regular também pode acessar (não há página de "configurações de conta" — esta é a única rota para trocar senha)

**Middleware:** `/update-password` não está em `PUBLIC_ROUTES`. Sem auth → redirect `/login`. Com auth → pass-through.

**Pós-submissão:**

```typescript
const { error } = await supabase.auth.updateUser({ password });

if (error) {
  setError("Não foi possível atualizar a senha. Tente novamente.");
  return;
}

// Sessão permanece ativa — updateUser() não invalida a sessão atual.
// Redirect para / em vez de /login para evitar loop:
//   redirect /login → middleware vê sessão → redirect /
router.replace("/");
```

**Decisão de UX:** Manter sessão ativa e redirect para `/`. O usuário está autenticado (via recovery flow ou sessão regular), a senha foi alterada, e futuros logins usarão a nova senha. Não há benefício em forçar logout + relogin — `updateUser()` não invalida outras sessões no Supabase.

### D8 — Auto-confirm em dev, confirmação real como release gate

`CONFIRMADO`

**Em desenvolvimento (dev):**
- Supabase Dashboard (Authentication → Settings → General): "Enable email confirmation" desligado
- `signUp()` retorna `data.session` → middleware trata o auto-redirect
- Fluxo de confirmação é pulado, mas o código testa ambos os caminhos

**Em produção:**
- "Enable email confirmation" ligado
- SMTP Hostinger configurado (ver D10 — Configuração de ambiente)
- Templates de email customizados com `{{ .TokenHash }}` (ver D3)
- SPF, DKIM e DMARC verificados no DNS do domínio remetente
- Limite do plano Business verificado (1.000 ou 3.000 mensagens/dia conforme o plano)
- Teste de entrega e spam em Gmail e Outlook antes de abrir para beta

**Validação nesta fase:**
- UAT manual com Supabase local (via `supabase start` que inclui Mailpit para captura de emails) OU SMTP de teste
- Cenário 1: signup com confirmação → verificar email no Mailpit → clicar link → confirmar → login
- Cenário 2: forgot-password → verificar email → clicar link → nova senha → login
- E2E automatizado permanece na Fase 11

### D9 — Validação client-side de senha

`CONFIRMADO`

- Senha mínima: 6 caracteres (validação client-side + server-side do Supabase)
- Confirmar senha: deve ser igual ao campo senha
- Validação ocorre antes do submit, com mensagem inline:
  - "A senha deve ter no mínimo 6 caracteres"
  - "As senhas não conferem"
- Mensagens em português
- Validação usa `useState` para mensagens de erro, não `useRef` ou biblioteca externa
- Validação não substitui o server-side — é purely para feedback imediato

### D10 — Configuração de ambiente: Supabase Dashboard + SMTP Hostinger + Vercel

`CONFIRMADO`

#### NEXT_PUBLIC_SITE_URL

- `NEXT_PUBLIC_SITE_URL` adicionada ao `.env.example` e validada onde usada
- Em desenvolvimento: `http://localhost:3000`
- Em produção: definida como variável de ambiente no Vercel Dashboard (ambiente Production + Preview)
- Usada como base para `emailRedirectTo` em `signUp()` e `redirectTo` em `resetPasswordForEmail()`
- Validada com throw em caso de ausência

#### Supabase Dashboard — URL Settings e Redirect URLs

O `SITE_URL` é usado APENAS como fallback quando o template não usa `{{ .RedirectTo }}`. Como os templates usam `{{ .RedirectTo }}` (ver D3), o `SITE_URL` tem papel secundário — mas precisa estar configurado corretamente para o funcionamento do Supabase Auth.

```
URL Settings:
  SITE_URL:            http://localhost:3000 (dev — valor padrão seguro)
  Redirect URLs:
    http://localhost:3000/auth/confirm
    https://...(preview)/auth/confirm
    https://...(produção)/auth/confirm
```

**IMPORTANTE:** Toda URL de Preview da Vercel precisa estar registrada em "Redirect URLs". Como previews efêmeras têm URLs imprevisíveis, a abordagem prática é registrar um wildcard (ex: `https://*.vercel.app/auth/confirm`) ou manter uma branch estável com URL fixa (ex: `fase-8.vercel.app`). A segunda abordagem é recomendada para UAT controlado.

#### Supabase Dashboard — Templates de Email

Customizados com `{{ .TokenHash }}` e `{{ .RedirectTo }}` (conforme D3):

| Template | Link |
|----------|------|
| Confirmation | `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup` |
| Reset Password | `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/update-password` |

#### SMTP Hostinger

Configuração no Supabase Dashboard (Authentication → Settings → SMTP Settings):

| Campo | Valor |
|-------|-------|
| Host | `smtp.hostinger.com` |
| Port | `465` (SSL/TLS) |
| Username | (email completo do remetente) |
| Password | (senha da caixa de email SMTP — é a senha da conta de email, não uma senha de app separada) |

**Requisitos adicionais:**
- SMTP é configurado **por projeto Supabase**. Isso significa que ambientes dev e produção (projetos Supabase separados) têm configurações SMTP independentes. O release gate da milestone (ambientes separados) conversa diretamente com essa decisão
- Credenciais configuradas exclusivamente no Supabase Dashboard, **não** na Vercel
- SPF, DKIM e DMARC configurados no DNS do domínio remetente (verificar com o suporte Hostinger)
- Limite do plano Hostinger Business verificado: 1.000 ou 3.000 mensagens/dia conforme o plano vigente
- Teste de entrega e classificação como spam em Gmail e Outlook antes do beta externo

#### Vercel — Deploy Protection para UAT fechado

```
Preview Deployment (branch estável, ex: fase-8)
  → Deployment Protection: Standard Protection habilitada
  → Acesso por conta Vercel dos testadores OU link compartilhável
  → Apenas testadores autorizados acessam
```

- Cada preview deployment tem URL própria (`{branch}.vercel.app`)
- `NEXT_PUBLIC_SITE_URL` do ambiente Preview = URL da preview
- URL da preview adicionada ao Supabase Dashboard (Redirect URLs)
- Confirmação de email ligada no ambiente Preview
- SMTP Hostinger ativo (credenciais no projeto Supabase daquele ambiente)
- UAT real de signup e recovery via URL protegida

**Nota:** No plano Hobby da Vercel, o Deployment Protection cobre previews mas NÃO o domínio de produção. Para teste fechado, use a URL de Preview protegida, não o domínio de produção.

### D11 — Tratamento de erro genérico em todas as páginas

`CONFIRMADO`

Nenhuma página revela se um email existe ou não no sistema.

| Página | Comportamento |
|--------|--------------|
| **Signup** (qualquer resultado) | `router.replace("/check-email?type=signup")` — sem erro, sem diferença entre "novo" e "existente" |
| **Forgot password** (qualquer resultado) | `router.replace("/check-email?type=recovery")` — sem erro |
| **Update password** (erro) | `setError("Não foi possível atualizar a senha. Tente novamente.")` |
| **Auth/confirm** (falha signup) | redirect `/login?error=confirmation_failed` |
| **Auth/confirm** (falha recovery) | redirect `/login?error=recovery_failed` |

A tela `/check-email` nunca exibe o email do usuário. A copy é genérica e contextual (ver D6).

### D12 — Testes mockando módulos próprios (padrão Fase 7)

`CONFIRMADO`

| Categoria | O que testar |
|-----------|-------------|
| Signup form | Renderização, submit (sempre redirect /check-email), validação client-side (senha curta, confirmar diferente), loading state |
| Check-email page | Renderização com cada type, middleware já redireciona autenticados |
| Auth/confirm handler | Token signup válido → redirect /, recovery válido → redirect /update-password, token inválido → redirect /login?error=, sem token → redirect /login?error=, next inválido → fallback / |
| Forgot-password form | Renderização, submit (sempre redirect /check-email), loading state |
| Update-password form | Renderização, submit sucesso → redirect /, submit erro → mensagem, validação client-side, loading state |
| Middleware | Novas rotas — sem auth: públicas pass-through, /update-password redirect /login; com auth: públicas redirect /, /update-password pass-through |
| SanitizeRedirect (extensão) | Nenhuma alteração — `sanitizeRedirectPath()` mantida. Validação de next é inline no route handler |

- Mockar `@/lib/supabase/server` e `@/lib/supabase/client` (padrão existente)
- Testes de componente usam `// @vitest-environment jsdom`
- Testes de route handler mockam `createServerClient()` e `verifyOtp()`

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Supabase Dashboard não configurado (SITE_URL, Redirect URLs)** | Alto — fluxo de confirmação quebra, links apontam para lugar errado | Checklist de configuração documentado (D10). Validado em dev antes de considerar a fase completa. |
| **Templates de email não configurados com TokenHash** | Médio — link de confirmação pode não conter `token_hash` | Templates customizados documentados em D3 e D10. Verificar antes dos testes manuais. |
| **SMTP não configurado — emails não chegam** | Bloqueante para confirmação real | UAT local usa Mailpit; UAT online usa Hostinger. Release gate de SMTP documentado para produção. |
| **updateUser({ password }) falha silenciosamente em produção** | Médio — usuário acredita que senha foi alterada | Tratar erro no client com mensagem visível. |
| **Email já existente em auto-confirm dev: signUp retorna erro** | Baixo — em dev, comportamento esperado e normalizado para /check-email | Sempre redirect para /check-email, independente de erro. Em auto-confirm, middleware redireciona para / em caso de sucesso. |
| **Root layout roda requireUser() em páginas de auth** | Muito baixo — AuthHeader retorna null, sem redirect | Código atual de AuthHeader já trata UnauthorizedError. Sem mudança necessária. |
| **Testes não cobrem fluxo real de confirmação de email** | Médio — falso positivo se route handler tiver bug | UAT manual com Supabase local cobre essa lacuna. E2E automatizado permanece na Fase 11. |

---

## Fora de Escopo

| Item | Motivo |
|------|--------|
| Onboarding (criação de loja, estado "sem loja") | Fase 9 |
| `getCurrentStore()` / `requireOwnership(storeId)` | Fase 9 |
| RLS em qualquer tabela | Fases 9 e 10 |
| Server Actions com auth | Fase 10 |
| Remoção estrutural de `localStorage("store_id")` | Fase 9 |
| Botão "Reenviar email" | Adiado para milestone futura |
| Configurações de conta, troca de email, perfil | Fora de escopo da v1.2 |
| OAuth social / Magic link | Exclusão deliberada para v1.2 |
| E2E de sessão com cookies reais | Fase 11 |
| Configuração de SMTP em produção | Release gate (pré-beta externo) |
| Handler de `exchangeCodeForSession()` no `/auth/confirm` | Desnecessário — fluxo determinístico usa `verifyOtp()` com templates customizados |

---

## Critérios de Aceite

### Macro-critério

> Um usuário consegue criar conta (com e sem confirmação de email), confirmar email via link, fazer login, solicitar redefinição de senha, confirmar token de recovery e definir nova senha. Todas as rotas respeitam as regras de autenticação definidas na D4. Nenhuma rota revela existência de email.

### Cenários de verificação

| # | Cenário | Critério |
|---|---------|----------|
| 1 | Usuário anônimo acessa `/signup` | Formulário renderizado |
| 2 | Usuário anônimo acessa `/check-email` | Instrução genérica renderizada |
| 3 | Usuário anônimo acessa `/forgot-password` | Formulário renderizado |
| 4 | Usuário anônimo acessa `/update-password` | Redirect `/login` |
| 5 | Usuário anônimo acessa `/auth/confirm?token_hash=xxx&type=signup` | Route handler processa token |
| 6 | Usuário autenticado acessa `/signup` | Redirect `/` |
| 7 | Usuário autenticado acessa `/check-email` | Redirect `/` |
| 8 | Usuário autenticado acessa `/forgot-password` | Redirect `/` |
| 9 | Usuário autenticado acessa `/update-password` | ✅ Formulário renderizado (sessão obrigatória) |
| 10 | Usuário autenticado acessa `/auth/confirm` | ✅ Pass-through — route handler processa token mesmo com sessão ativa (ex: recovery link em navegador logado) |
| 11 | Signup com credenciais válidas (auto-confirm dev) | redirect `/check-email` → middleware redirect `/` |
| 12 | Signup com credenciais válidas (com confirmação) | redirect `/check-email` → instrução renderizada |
| 13 | Signup com email já existente | redirect `/check-email` (mesmo comportamento) |
| 14 | Signup com senha < 6 caracteres | Erro client-side inline |
| 15 | Signup com confirmar senha diferente | Erro client-side inline |
| 16 | `/auth/confirm` com token_hash válido (signup) | redirect `/` |
| 17 | `/auth/confirm` com token_hash válido (recovery) | redirect `/update-password` |
| 18 | `/auth/confirm` com token inválido | redirect `/login?error=confirmation_failed` ou `?error=recovery_failed` |
| 19 | `/auth/confirm` sem token | redirect `/login?error=confirmation_failed` |
| 20 | `/auth/confirm` com `next` inválido | Fallback `/` |
| 21 | Forgot password (qualquer resultado) | redirect `/check-email?type=recovery` |
| 22 | Update password com nova senha válida | redirect `/`, sessão mantida |
| 23 | Update password com senha < 6 caracteres | Erro client-side inline |
| 24 | Update password com confirmar diferente | Erro client-side inline |
| 25 | Update password com erro server-side | Mensagem de erro genérica |
| 26 | UAT manual (local): signup → confirmação → login (Supabase local/Mailpit) | Fluxo completo funcional em ambiente local |
| 27 | UAT manual (local): forgot → recovery → update → login | Fluxo completo funcional em ambiente local |
| 28 | UAT online: Preview Vercel protegida acessível por testador autorizado | URL da Preview responde, proteção de acesso funciona |
| 29 | UAT online: signup entrega email real via SMTP Hostinger | Email de confirmação chega na caixa de entrada do testador |
| 30 | UAT online: callback de signup retorna para a mesma Preview | Link no email aponta para URL da Preview, não para produção |
| 31 | UAT online: recovery entrega email e conclui troca de senha | Email de recovery chega, link retorna para Preview, nova senha funciona |
| 32 | Teste de entrega: Gmail e Outlook não classificam como spam | Emails de confirmação e recovery chegam na caixa principal |
| 33 | Regressão: 344 testes existentes continuam passando | `npx vitest run` exit 0 |

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-07-04 | Escopo delimitado: credenciais sem onboarding. Onboarding (loja) na Fase 9 |
| 2026-07-04 | Novas páginas no route group `(auth)` existente. Root layout com AuthHeader envolve tudo — AuthHeader retorna null se não autenticado |
| 2026-07-04 | `/auth/confirm` como route handler unificado (signup + recovery). Templates customizados com `TokenHash` + `verifyOtp()` — sem PKCE/code |
| 2026-07-04 | Matcher expandido com 10 rotas + `/auth/confirm` individual. `/update-password` não é pública |
| 2026-07-04 | Anti-enumeration: signup e forgot-password sempre redirect `/check-email`, sem exibir erro |
| 2026-07-04 | `/check-email` com copy contextual via `?type=signup` ou `?type=recovery`, sem revelar email |
| 2026-07-04 | Auto-confirm: fluxo tratado pelo middleware. Código do form sempre redirect `/check-email` |
| 2026-07-04 | `sanitizeRedirectPath()` mantida. Validação de `next` no `/auth/confirm` é inline com allowlist explícita |
| 2026-07-04 | Pós-update-password: redirect `/` com sessão mantida. `updateUser()` não invalida sessão |
| 2026-07-04 | `NEXT_PUBLIC_SITE_URL` adicionada. Documentação de configuração do Supabase Dashboard incluída |
| 2026-07-04 | Route handler usa `verifyOtp()` com `token_hash` — fluxo determinístico via templates customizados |
| 2026-07-04 | `/auth/confirm` é `ALWAYS_PASSTHROUGH` no middleware — passa com ou sem sessão |
| 2026-07-04 | UAT manual com Supabase local (Mailpit) para validar confirmação real |
| 2026-07-04 | SMTP Hostinger configurado no Supabase Dashboard. SPF/DKIM/DMARC verificados no DNS |
| 2026-07-04 | Ambiente online de UAT via Vercel Preview Deployment com Standard Protection |
| 2026-07-04 | Páginas públicas (signup, check-email, forgot-password) confiam no middleware, não usam `requirePageUser()` |
| 2026-07-04 | Templates usam `{{ .RedirectTo }}` em vez de `{{ .SiteURL }}` — cada ambiente (dev/preview/prod) passa sua própria URL via `emailRedirectTo` / `redirectTo` |
| 2026-07-04 | UAT online com Vercel Preview + SMTP Hostinger adicionado aos critérios de aceite (5 novos cenários, 28-32) |
| 2026-07-04 | SMTP configurado por projeto Supabase — ambientes dev e produção têm configurações independentes |

---

## Checklist de Revisão

- [ ] `src/app/(auth)/signup/page.tsx` — server component público, formulário renderizado. Middleware gerencia auth check (sem `requirePageUser()`)
- [ ] `src/app/(auth)/signup/signup-form.tsx` — client component, sempre redirect `/check-email`, validação client-side
- [ ] `src/app/(auth)/check-email/page.tsx` — server component público, copy por type, sem email. Middleware gerencia redirect
- [ ] `src/app/auth/confirm/route.ts` — GET handler, verifyOtp com token_hash, type routing, next validation, sem HTML
- [ ] `src/app/(auth)/forgot-password/page.tsx` — server component público, formulário renderizado. Middleware gerencia auth check (sem `requirePageUser()`)
- [ ] `src/app/(auth)/forgot-password/forgot-password-form.tsx` — client component, sempre redirect `/check-email`
- [ ] `src/app/(auth)/update-password/page.tsx` — server component (página protegida, sem requirePageUser — middleware já bloqueia)
- [ ] `src/app/(auth)/update-password/update-password-form.tsx` — client component, updateUser(), redirect `/`, validação client-side
- [ ] `src/middleware.ts` — matcher expandido + classificação de rotas (D4)
- [ ] `.env.example` — `NEXT_PUBLIC_SITE_URL` adicionada
- [ ] `NEXT_PUBLIC_SITE_URL` validada (throw se ausente) nas chamadas de signUp/resetPasswordForEmail
- [ ] `sanitizeRedirectPath()` — mantida sem alterações
- [ ] Testes: signup form, check-email, auth/confirm, forgot-password form, update-password form, middleware expandido
- [ ] UAT manual (local): signup com confirmação (Supabase local / Mailpit)
- [ ] UAT manual (local): forgot-password → recovery → update-password → login
- [ ] UAT online: Preview Vercel protegida acessível por testador autorizado
- [ ] UAT online: signup entrega email real via SMTP Hostinger
- [ ] UAT online: callback de signup retorna para a mesma Preview
- [ ] UAT online: recovery entrega email e conclui troca de senha
- [ ] Teste de entrega: Gmail e Outlook não classificam como spam
- [ ] Regressão: 344 testes existentes continuam passando
- [ ] `npx tsc --noEmit` — zero erros de tipo
- [ ] `npx vitest run` — todos os testes verdes
- [ ] `npm run lint` — zero erros de lint
- [ ] `npx next build` — build bem-sucedido

---

*Documento criado: 2026-07-04 | Atualizado: 2026-07-04 (revisão de conflitos)*
*Baseado no alinhamento da milestone v1.2 (D1–D11)*
*Próximo passo: revisão do time, ajustes, então avançar para artefatos de implementação*
