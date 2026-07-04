## 1. Dependências e Setup

- [ ] 1.1 Instalar `@supabase/ssr` com versão fixada no `package.json`
- [ ] 1.2 Verificar compatibilidade com Next.js 15.3 (documentação oficial)
- [ ] 1.3 Configurar URLs autorizadas no dashboard do Supabase (localhost + produção + previews)

## 2. Refactor dos Clientes Supabase

- [ ] 2.1 Reescrever `src/lib/supabase/client.ts` como factory `createBrowserClient()` usando `@supabase/ssr`, com validação de ENV
- [ ] 2.2 Reescrever `src/lib/supabase/server.ts` adicionando `createServerClient()` factory com `cookies()` + manter `supabaseAdmin` como export nomeado
- [ ] 2.3 Criar `src/lib/supabase/middleware.ts` com `updateSession(request)` que retorna `{ response, claims }` — usando `createServerClient` + `getClaims()`
- [ ] 2.4 Remover `src/lib/supabase.ts` (barrel) e atualizar todos os imports que apontavam para ele
- [ ] 2.5 Verificar com `git grep` que nenhum consumidor residual do singleton `supabase` ou barrel existe

## 3. Helpers de Autorização

- [ ] 3.1 Criar `src/lib/auth/require-user.ts` com classe `UnauthorizedError` e função `requireUser()` que valida claims via `getClaims()` retornando `{ userId: claims.sub, claims }`
- [ ] 3.2 Implementar `requirePageUser()` adaptando `requireUser()` para Server Components (catch → redirect)
- [ ] 3.3 Implementar padrão de uso para route handlers capturarem `UnauthorizedError` → 401 JSON

## 4. Redirecionamento Seguro

- [ ] 4.1 Criar `src/lib/auth/redirect.ts` com função `sanitizeRedirectPath()` e allowlist com match exato (`=== "/"`, `=== "/store"`, `.startsWith("/campaign/")`)
- [ ] 4.2 Implementar rejeição de URLs absolutas, protocol-relative, backslashes e caminhos de auth
- [ ] 4.3 Implementar preservação de query string como dados opacos e descarte de fragmentos

## 5. Middleware de Autenticação

- [ ] 5.1 Criar `src/middleware.ts` com matcher positivo (`/`, `/login`, `/store/:path*`, `/campaign/:path*`, `/api/:path*`)
- [ ] 5.2 Implementar fluxo: `const { response, claims } = await updateSession(request)` + decisão de rota
- [ ] 5.3 Implementar redirect de páginas protegidas sem sessão para `/login?redirect=...`
- [ ] 5.4 Implementar 401 JSON para `/api/*` sem sessão
- [ ] 5.5 Implementar redirect de `/login` com sessão para `/`
- [ ] 5.6 Garantir que toda resposta (redirect, 401, next) preserve cookies de `updateSession()`

## 6. Página de Login

- [ ] 6.1 Criar `src/app/(auth)/layout.tsx` com container centralizado e logo (sem navegação principal)
- [ ] 6.2 Criar `src/app/(auth)/login/page.tsx` — server component que renderiza form (sem requirePageUser — middleware já trata auth check)
- [ ] 6.3 Criar `src/app/(auth)/login/login-form.tsx` — client component com email + senha + submit + loading + erro
- [ ] 6.4 Integrar `sanitizeRedirectPath()` na página de login para validar `?redirect=` antes do redirect pós-login

## 7. Logout

- [ ] 7.1 Criar `src/app/auth/signout/route.ts` — Route Handler POST com `signOut()` + `revalidatePath()` + redirect
- [ ] 7.2 Implementar componente de logout com `<form action="/auth/signout" method="POST">` e `onSubmit` que limpa storage (4 chaves) antes da submissão nativa
- [ ] 7.3 Adicionar botão "Sair" no header da aplicação, estilizado conforme `openspec/design-system/MASTER.md`

## 8. Testes

- [ ] 8.1 Testar `requireUser()`: claims válidas, ausentes, erro, sub vazio
- [ ] 8.2 Testar `sanitizeRedirectPath()`: caminhos permitidos, rejeitados, vazio, fallback
- [ ] 8.3 Testar middleware: página protegida sem sessão, /login com sessão, API sem sessão, pass-through autenticado
- [ ] 8.4 Testar login form: renderização, submit com sucesso, submit com erro, loading state
- [ ] 8.5 Testar logout: limpeza das 4 chaves, submissão do form
- [ ] 8.6 Verificar que a suíte existente continua passando (mock `supabaseAdmin` não afetado)

## 9. Verificação Final

- [ ] 9.1 Rodar `npx vitest run` — todos os testes verdes
- [ ] 9.2 Rodar `npx tsc --noEmit` — zero erros de tipo
- [ ] 9.3 Rodar `npx next build` — build bem-sucedido
- [ ] 9.4 Executar fluxo manual: provisionar usuário no Dashboard → login → rota protegida → logout
- [ ] 9.5 Rodar `git grep "from.*supabase/client"` para confirmar que nenhum import residual do singleton antigo existe
