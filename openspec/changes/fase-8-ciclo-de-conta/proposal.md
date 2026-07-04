## Why

O Vendeo possui login e middleware de sessão (Fase 7), mas não oferece criação de conta nem recuperação de senha. Usuários precisam ser provisionados manualmente no Supabase Dashboard, o que inviabiliza o fluxo SaaS autônomo. Esta fase implementa o ciclo completo de credenciais: signup, confirmação de email e recuperação de senha — tudo que falta para que um usuário entre no sistema sem intervenção manual.

## What Changes

- Criar `/signup` — formulário de cadastro (email + senha + confirmar senha) dentro do route group `(auth)`
- Criar `/check-email` — página pública com copy contextual (type=signup | type=recovery), sem revelar email
- Criar `/auth/confirm` — route handler unificado que processa token de confirmação via `verifyOtp()` para signup e recovery
- Criar `/forgot-password` — formulário de solicitação de redefinição de senha dentro do route group `(auth)`
- Criar `/update-password` — formulário de nova senha (requer sessão autenticada) dentro do route group `(auth)`
- Expandir `middleware.ts` — matcher de 5 para 10 rotas, classificação (PUBLIC_ROUTES, ALWAYS_PASSTHROUGH), redirect `/signup`/`/check-email`/`/forgot-password` para `/` quando autenticado, `/update-password` bloqueado sem sessão, `/auth/confirm` como ALWAYS_PASSTHROUGH
- Anti-enumeration: signup e forgot-password sempre redirect para `/check-email`, independente de erro ou sucesso
- Modificar página de `/login`: adicionar links "Criar conta" → `/signup` e "Esqueci minha senha" → `/forgot-password`
- Adicionar `NEXT_PUBLIC_SITE_URL` ao `.env.example` e validar nas chamadas de `signUp()` / `resetPasswordForEmail()`
- Personalizar templates de email no Supabase Dashboard com `{{ .TokenHash }}` + `{{ .RedirectTo }}` (fluxo determinístico via `verifyOtp()`)
- Configurar e validar entrega de email real (SMTP Hostinger + Vercel Preview) para UAT do ciclo de confirmação

**Fora de escopo:** onboarding/criação de loja (Fase 9), `getCurrentStore()`/`requireOwnership()` (Fase 9), RLS (Fases 9-10), Server Actions com auth (Fase 10), OAuth social/magic link, configurações de conta/perfil, E2E automatizado (Fase 11), SMTP em produção (release gate para beta externo).

## Capabilities

### New Capabilities
- `signup-page`: Página `/signup` no route group `(auth)` com formulário de cadastro — email, senha, confirmar senha, validação client-side (6 caracteres, senhas conferem), sempre redirect `/check-email?type=signup` independente de resultado, anti-enumeration
- `check-email-page`: Página pública `/check-email` com copy contextual via search param `?type=signup|recovery`, sem revelar email, fallback genérico
- `auth-confirm-handler`: Route handler `GET /auth/confirm` que processa `token_hash` + `type` (signup|recovery) via `verifyOtp()`, valida `next` contra allowlist (`/`, `/update-password`), redirect sem HTML
- `forgot-password-page`: Página `/forgot-password` no route group `(auth)` com formulário de email, sempre redirect `/check-email?type=recovery` independente de resultado
- `update-password-page`: Página `/update-password` no route group `(auth)` com formulário de nova senha + confirmar, `updateUser({ password })`, redirect `/`, sessão mantida pós-alteração
- `auth-email-delivery`: Configuração e validação de entrega de email real — SMTP Hostinger, SPF/DKIM/DMARC, Vercel Preview protegida, templates customizados com TokenHash, teste de deliverability em Gmail e Outlook

### Modified Capabilities
- `auth-middleware`: Matcher expandido de 5 para 10 rotas; adiciona `PUBLIC_ROUTES` (`/signup`, `/check-email`, `/forgot-password`), `ALWAYS_PASSTHROUGH` (`/auth/confirm`); novas regras de redirect para páginas públicas quando autenticado; `/update-password` exige sessão
- `login-page`: Formulário de login modificado para incluir links de navegação "Criar conta" (`/signup`) e "Esqueci minha senha" (`/forgot-password`), substituindo a restrição anterior de "sem link para signup"
- `auth-redirect`: Nenhuma alteração na função `sanitizeRedirectPath()`. Validação de `next` no `/auth/confirm` é inline com allowlist explícita (`"/"` | `"/update-password"`)

## Impact

- **Novas páginas:** `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/signup/signup-form.tsx`, `src/app/(auth)/check-email/page.tsx`, `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/forgot-password/forgot-password-form.tsx`, `src/app/(auth)/update-password/page.tsx`, `src/app/(auth)/update-password/update-password-form.tsx`
- **Novo route handler:** `src/app/auth/confirm/route.ts`
- **Modificado:** `src/middleware.ts` — matcher + classificação de rotas
- **Modificado:** `src/app/(auth)/login/login-form.tsx` — adicionar links "Criar conta" e "Esqueci minha senha"
- **ENV:** `NEXT_PUBLIC_SITE_URL` adicionada ao `.env.example` e validada onde usada
- **Testes:** ~10 novas categorias de teste (signup form, check-email, auth/confirm handler, forgot-password form, update-password form, login-page navigation, middleware expandido com /auth/confirm passthrough, regressão 344 testes existentes)
- **Configuração externa:** Templates de email no Supabase Dashboard com `{{ .TokenHash }}` + `{{ .RedirectTo }}`; SMTP Hostinger configurado para UAT; Vercel Preview Deployment protegido para UAT fechado
- **Nenhuma migration de banco** — Fase 8 não altera schema
