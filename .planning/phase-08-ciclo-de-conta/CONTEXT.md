# Phase 8: Ciclo de Conta — Context

**Gathered:** 2026-07-04
**Status:** Ready for planning
**Source:** OpenSpec Change — `openspec/changes/fase-8-ciclo-de-conta/`
**Change status:** 4/4 artifacts complete, proposal/design/specs/tasks approved

<domain>
## Phase Boundary

Implementar o ciclo completo de credenciais sobre a camada de sessão existente (Phase 7): criação de conta, confirmação de email e recuperação de senha. Usuários deixam de ser provisionados manualmente no Supabase Dashboard.

**Entrega verificável:**
- Ciclo de signup: cria conta → /check-email → confirma email → login
- Ciclo de recuperação: forgot → email → confirma token → nova senha → login
- Ambos os ciclos funcionam com confirmação habilitada (UAT manual)
</domain>

<decisions>
## Implementation Decisions

### D1 — Escopo: credenciais sem onboarding
- Fase 8 entrega apenas o ciclo de credenciais
- Onboarding (criação de loja, estado "sem loja") fica na Fase 9
- Usuário recém-cadastrado pode fazer login, mas não tem loja
- Recuperação de senha usa fluxo mínimo: formulário → email → /auth/confirm → /update-password → nova senha
- Sem configurações de conta, troca de email ou administração de perfil

### D2 — Novas páginas no route group (auth) existente
- Todas as novas páginas ficam em `src/app/(auth)/`: signup, check-email, forgot-password, update-password
- Herdam o layout centralizado existente (container + logo + dark)
- Root layout renderiza AuthHeader em todas as páginas (retorna null se não autenticado)
- `/auth/confirm` é route handler (fora do route group, sem HTML)

### D3 — /auth/confirm: route handler unificado (signup + recovery)
- Processa `token_hash` + `type` via `verifyOtp()` — sem PKCE/code exchange
- Templates customizados no Supabase com `{{ .TokenHash }}` + `{{ .RedirectTo }}`
- Valida `next` contra allowlist: `VALID_NEXT = ["/", "/update-password"]`
- Sucesso signup → redirect `/`; falha → redirect `/login?error=confirmation_failed`
- Sucesso recovery → redirect `/update-password`; falha → redirect `/login?error=recovery_failed`

### D4 — Middleware expandido com classificação de rotas
- Matcher expandido de 5 para 10 rotas (+ `/signup`, `/check-email`, `/forgot-password`, `/update-password`, `/auth/confirm`)
- `PUBLIC_ROUTES`: `/login`, `/signup`, `/check-email`, `/forgot-password` (anônimo passa, autenticado redirect `/`)
- `ALWAYS_PASSTHROUGH`: `/auth/confirm` (passa em qualquer estado)
- `/update-password` exige autenticação (não está em PUBLIC_ROUTES)

### D5 — Anti-enumeration
- Signup e forgot-password SEMPRE redirect para `/check-email?type=signup|recovery`, independente de erro
- Nenhuma página revela se email existe ou não
- `/check-email` nunca exibe o email do usuário

### D6 — /check-email com copy contextual
- `?type=signup` → texto de confirmação de cadastro
- `?type=recovery` → texto de redefinição de senha
- Sem type → texto genérico fallback

### D7 — /update-password requer sessão
- Exclusivamente atingido via fluxo recovery (ou sessão regular)
- `updateUser({ password })` — sessão permanece ativa pós-alteração
- Redirect para `/` (não `/login`)

### D8 — Validação client-side de senha
- Senha mínima: 6 caracteres
- Confirmar senha: deve ser igual
- Mensagens em português, `useState` para erros
- Aplicado em signup e update-password

### D9 — Navegação login → signup / forgot-password
- Link "Criar conta" → `/signup` abaixo do botão submit
- Link "Esqueci minha senha" → `/forgot-password` abaixo do campo de senha
- Links usam `<Link>` do Next.js, cor azul (`text-blue-400`) consistente com design system

### D10 — NEXT_PUBLIC_SITE_URL
- Adicionada ao `.env.example`
- Validada em build/load time (throw se ausente)
- Usada como base para `emailRedirectTo` e `redirectTo`

### D11 — UAT dual (local + online)
- **Local:** Supabase local + Mailpit via `supabase/config.toml`, templates HTML em `supabase/templates/`
- **Online:** SMTP Hostinger, Vercel Preview protegida, testar deliverability Gmail/Outlook
- Config.toml gerencia `enable_confirmations`, `site_url`, `additional_redirect_urls` e templates locais

### D12 — Testes mockando módulos próprios (padrão Phase 7)
- Mock `@/lib/supabase/server` e `@/lib/supabase/client`
- Categorias: signup form, check-email, auth/confirm handler, forgot-password form, update-password form, login-page navigation, middleware expandido com /auth/confirm passthrough
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 8 Change Artifacts (source of truth)
- `openspec/changes/fase-8-ciclo-de-conta/proposal.md` — What & Why
- `openspec/changes/fase-8-ciclo-de-conta/design.md` — Architecture decisions D1-D13
- `openspec/changes/fase-8-ciclo-de-conta/tasks.md` — Implementation checklist (11 sections)

### Specs
- `openspec/changes/fase-8-ciclo-de-conta/specs/signup-page/spec.md`
- `openspec/changes/fase-8-ciclo-de-conta/specs/check-email-page/spec.md`
- `openspec/changes/fase-8-ciclo-de-conta/specs/auth-confirm-handler/spec.md`
- `openspec/changes/fase-8-ciclo-de-conta/specs/forgot-password-page/spec.md`
- `openspec/changes/fase-8-ciclo-de-conta/specs/update-password-page/spec.md`
- `openspec/changes/fase-8-ciclo-de-conta/specs/auth-email-delivery/spec.md`
- `openspec/changes/fase-8-ciclo-de-conta/specs/auth-middleware/spec.md` (delta)
- `openspec/changes/fase-8-ciclo-de-conta/specs/login-page/spec.md` (delta)

### Existing Code (Phase 7 foundation)
- `src/middleware.ts` — Current 5-route matcher (to be expanded)
- `src/app/(auth)/login/login-form.tsx` — To be modified (add nav links)
- `src/lib/auth/require-user.ts` — Helpers (unchanged)
- `src/lib/auth/redirect.ts` — Redirect sanitizer (unchanged)
- `src/app/(auth)/layout.tsx` — Auth layout (unchanged, reused)
- `src/components/auth/auth-header.tsx` — Auth header (unchanged)
- `src/app/auth/signout/route.ts` — Logout (unchanged)

### Milestone & Design System
- `docs/alinhamento-milestone-v1.2.md` — Milestone alignment decisions D1-D11
- `docs/alinhamento-fase-8-ciclo-de-conta.md` — Phase 8 technical alignment
- `openspec/design-system/MASTER.md` — Controlled design source of truth
</canonical_refs>

<specifics>
## Specific Ideas

### Middleware expansion (src/middleware.ts)
- Current: `["/", "/login", "/store/:path*", "/campaign/:path*", "/api/:path*"]`
- Target: add `"/signup", "/check-email", "/forgot-password", "/update-password", "/auth/confirm"`
- New classification: `const PUBLIC_ROUTES = new Set(["/login", "/signup", "/check-email", "/forgot-password"])`
- New classification: `const ALWAYS_PASSTHROUGH = new Set(["/auth/confirm"])`
- Authenticated users hitting PUBLIC_ROUTES → redirect `/`

### Login form modification
- Add `<Link href="/signup">Criar conta</Link>` below submit button
- Add `<Link href="/forgot-password">Esqueci minha senha</Link>` below password field
- Style: `text-blue-400 hover:text-blue-300`, underline on hover

### Signup form behavior
- Always redirect `/check-email?type=signup` regardless of success/error
- `NEXT_PUBLIC_SITE_URL` validated at module load (throw if absent)

### Auth confirm handler
- GET-only, no HTML rendering
- Uses `verifyOtp()`, not `exchangeCodeForSession()`
- Allowlist: `["/", "/update-password"]`

### Email templates
- Local: `supabase/templates/confirmation.html` + `recovery.html` with `{{ .TokenHash }}` + `{{ .RedirectTo }}`
- Remote: Same content in Supabase Dashboard

### UAT flow
- Local: `npx supabase start` → Mailpit at localhost:54325 → click real link
- Online: Vercel Preview + SMTP Hostinger → test Gmail/Outlook deliverability
</specifics>

<deferred>
## Deferred Ideas
- Onboarding/criação de loja (Fase 9)
- Botão "Reenviar email" (milestone futura)
- OAuth social / Magic link (fora de escopo v1.2)
- E2E automatizado com cookies reais (Fase 11)
- Configurações de conta, troca de email, perfil (fora de escopo v1.2)
</deferred>

---

*Phase: 08-ciclo-de-conta*
*Context gathered: 2026-07-04 via OpenSpec Change Artifacts*
