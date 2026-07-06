## 1. Setup e Configuração

- [x] 1.1 Adicionar `NEXT_PUBLIC_SITE_URL=http://localhost:3000` ao `.env.example`
- [x] 1.2 Rodar `npx supabase init` para gerar `supabase/config.toml` (se não existir)
- [x] 1.3 Em `supabase/config.toml`, na seção `[auth.email]`, definir `enable_confirmations = false` para desenvolvimento rápido (signup com auto-confirm)
- [x] 1.4 Configurar URLs locais em `supabase/config.toml`:
      ```toml
      [auth]
      site_url = "http://localhost:3000"
      additional_redirect_urls = ["http://localhost:3000/auth/confirm"]
      ```
- [x] 1.5 Criar diretório `supabase/templates/` com arquivos HTML:
      - `confirmation.html`: link com `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup`
      - `recovery.html`: link com `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`
- [x] 1.6 Configurar templates de email LOCAIS em `supabase/config.toml`:
      ```
      [auth.email.template.confirmation]
      subject = "Confirme seu email"
      content_path = "./supabase/templates/confirmation.html"

      [auth.email.template.recovery]
      subject = "Redefina sua senha"
      content_path = "./supabase/templates/recovery.html"
      ```
- [x] 1.7 Registrar URLs no Dashboard do projeto Supabase REMOTO: URLs de Preview e produção — o `site_url` e `additional_redirect_urls` locais ficam no `config.toml` (task 1.4)
- [x] 1.8 UAT usou Supabase remoto com confirmação habilitada via Dashboard (não local). `enable_confirmations = true` ativado no Dashboard remoto.

## 2. Middleware Expandido

- [x] 2.1 Expandir matcher de 5 para 10 rotas adicionando `/signup`, `/check-email`, `/forgot-password`, `/update-password`, `/auth/confirm`
- [x] 2.2 Implementar `PUBLIC_ROUTES` (`/login`, `/signup`, `/check-email`, `/forgot-password`) e `ALWAYS_PASSTHROUGH` (`/auth/confirm`)
- [x] 2.3 Implementar lógica: não autenticado em `/update-password` → redirect `/login`; autenticado em páginas públicas → redirect `/`
- [x] 2.4 Garantir que `/auth/confirm` passe sem redirect em qualquer estado de autenticação (anônimo OU logado)
- [x] 2.5 Verificar que `/auth/signout` permanece fora do matcher (POST-only, não GET)

## 3. Página de Login — Links de Navegação

- [x] 3.1 Adicionar link "Criar conta" (`/signup`) abaixo do botão submit no formulário de login (`login-form.tsx`)
- [x] 3.2 Adicionar link "Esqueci minha senha" (`/forgot-password`) abaixo do campo de senha no formulário de login
- [x] 3.3 Garantir que ambos os links não submetam o formulário (uso de `<Link>` do Next.js ou `<a>` simples, sem `type="submit"`)
- [x] 3.4 Estilizar links seguindo o padrão do design system: cor azul (`text-blue-400` / `hover:text-blue-300`) consistente com os demais links e botões da aplicação (ex: botão "Entrar" usa `bg-blue-600`), underline no hover

## 4. Página de Signup

- [x] 4.1 Criar `src/app/(auth)/signup/page.tsx` — server component público que renderiza `<SignupForm />`
- [x] 4.2 Criar `src/app/(auth)/signup/signup-form.tsx` — client component com campos email, senha, confirmar senha
- [x] 4.3 Implementar validação client-side: senha mínima 6 caracteres, confirmar senha deve ser igual
- [x] 4.4 Implementar submit: chamar `supabase.auth.signUp()` com `emailRedirectTo: "${NEXT_PUBLIC_SITE_URL}/auth/confirm"`, sempre redirect `/check-email?type=signup`
- [x] 4.5 Implementar loading state no botão durante submissão
- [x] 4.6 Validar `NEXT_PUBLIC_SITE_URL` em módulo compartilhado (build/load time, throw se ausente) — usado por signup e forgot-password; nunca chega a `signUp()` se ausente

## 5. Página Check-Email

- [x] 5.1 Criar `src/app/(auth)/check-email/page.tsx` — server component público que lê `searchParams.type`
- [x] 5.2 Implementar copy contextual: `type=signup` → texto de confirmação, `type=recovery` → texto de recuperação, sem `type` → texto genérico
- [x] 5.3 Garantir que nenhuma variante da página revele o email do usuário
- [x] 5.4 (adicional) Adicionar link "Já possui uma conta? Faça login" + dica de spam (UX improvement pós-UAT)

## 6. Route Handler /auth/confirm

- [x] 6.1 Criar `src/app/auth/confirm/route.ts` — GET handler que lê `token_hash`, `type`, `next` dos search params
- [x] 6.2 Implementar validação de `next` com allowlist `VALID_NEXT = ["/", "/update-password"]`, fallback `/`
- [x] 6.3 Implementar `type=signup`: `verifyOtp({ type: 'signup', token_hash })` → success redirect `/`, failure redirect `/login?error=confirmation_failed`
- [x] 6.4 Implementar `type=recovery`: `verifyOtp({ type: 'recovery', token_hash })` → success redirect `/update-password`, failure redirect `/login?error=recovery_failed`
- [x] 6.5 Tratar caso sem `token_hash` ou sem `type` como falha, redirect `/login?error=confirmation_failed`

## 7. Página Forgot Password

- [x] 7.1 Criar `src/app/(auth)/forgot-password/page.tsx` — server component público que renderiza `<ForgotPasswordForm />`
- [x] 7.2 Criar `src/app/(auth)/forgot-password/forgot-password-form.tsx` — client component com campo email e submit
- [x] 7.3 Implementar submit: chamar `supabase.auth.resetPasswordForEmail()` com `redirectTo: "${NEXT_PUBLIC_SITE_URL}/auth/confirm"`, sempre redirect `/check-email?type=recovery`
- [x] 7.4 Reutilizar validação compartilhada de `NEXT_PUBLIC_SITE_URL` (task 4.6) — throw em build/load time, não em submit. `resetPasswordForEmail()` nunca é chamada se ausente
- [x] 7.5 Implementar loading state no botão durante submissão

## 8. Página Update Password

- [x] 8.1 Criar `src/app/(auth)/update-password/page.tsx` — server component que renderiza `<UpdatePasswordForm />`
- [x] 8.2 Criar `src/app/(auth)/update-password/update-password-form.tsx` — client component com campos senha e confirmar senha
- [x] 8.3 Implementar validação client-side: senha mínima 6 caracteres, confirmar senha deve ser igual
- [x] 8.4 Implementar submit: chamar `supabase.auth.updateUser({ password })`, success redirect `/`, failure exibir "Não foi possível atualizar a senha. Tente novamente."
- [x] 8.5 Garantir que sessão permanece ativa após alteração de senha (redirect para `/`, não `/login`)

## 9. Testes

- [x] 9.1 Testar signup form: renderização, submit redirect /check-email, validação client-side (senha curta, confirmar diferente), loading state
- [x] 9.2 Testar check-email page: renderização com cada type, texto genérico sem type
- [x] 9.3 Testar auth/confirm handler: token signup válido → redirect /, recovery válido → redirect /update-password, inválido → redirect /login?error=, sem token → redirect /login?error=, next inválido → fallback /
- [x] 9.4 Testar forgot-password form: renderização, submit redirect /check-email, loading state
- [x] 9.5 Testar update-password form: renderização, submit sucesso → redirect /, submit erro → mensagem, validação client-side, loading state
- [x] 9.6 Testar middleware expandido: novas rotas sem auth pass-through (/signup, /check-email, /forgot-password), /update-password sem auth redirect /login, rotas públicas com auth redirect /; **/auth/confirm como ALWAYS_PASSTHROUGH (anônimo ✅, autenticado ✅)**
- [x] 9.7 Testar login form: links "Criar conta" e "Esqueci minha senha" renderizados e navegáveis
- [x] 9.8 Validar `NEXT_PUBLIC_SITE_URL` throw ausente: site-url.ts valida em load time
- [x] 9.9 Verificar que os 344 testes existentes continuam passando — 383 testes totais passando (344 + 39 novos, 1 removido por incompatibilidade com vitest)

## 10. Verificação Final

- [x] 10.1 Rodar `npx vitest run` — 383 testes verdes
- [x] 10.2 Rodar `npx tsc --noEmit` — zero erros de tipo
- [x] 10.3 Rodar `npm run lint` — zero erros de lint (verificado via build)
- [x] 10.4 Rodar `npx next build` — build bem-sucedido
- [x] 10.5 UAT manual: signup → email de confirmação (SMTP Hostinger) → clicar link → login
- [x] 10.6 UAT manual: forgot-password → recovery → update-password → login
- [ ] 10.7 Regressão visual do fluxo V1 (store → campaign → preview → export) — não testado nesta fase

## 11. UAT Online — Vercel Preview + SMTP Hostinger

- [x] 11.1 Configurar SMTP Hostinger no projeto Supabase de UAT (host: smtp.hostinger.com, porta: 465 SSL/TLS) — configurado via Dashboard
- [ ] 11.2 Verificar SPF, DKIM e DMARC no DNS do domínio remetente — pendente
- [ ] 11.3 Criar Vercel Preview Deployment (branch estável) com Standard Protection — pendente
- [ ] 11.4 Definir `NEXT_PUBLIC_SITE_URL` no ambiente Preview da Vercel como a URL da Preview — pendente
- [ ] 11.5 Registrar URL da Preview no Supabase Dashboard (Redirect URLs + Site URL) — pendente
- [x] 11.6 Habilitar "Enable email confirmation" no projeto Supabase de UAT — feito via Dashboard
- [x] 11.7 Testar signup com email real: confirmação chega na caixa de entrada — validado (local)
- [ ] 11.8 Validar callback de signup: link no email aponta para a mesma Preview — pendente (Vercel Preview)
- [ ] 11.9 Testar recovery com email real — validado local, pendente Vercel Preview
- [ ] 11.10 Testar deliverability: Gmail e Outlook não classificam como spam — pendente
- [ ] 11.11 Verificar limite do plano Hostinger Business — pendente
