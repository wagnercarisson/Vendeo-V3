## 1. Dependências e Setup

- [x] 1.1 Instalar `@supabase/ssr` com versão fixada no `package.json`
- [x] 1.2 Verificar compatibilidade com Next.js 15.3 (documentação oficial)
- [x] 1.3 Configurar URLs autorizadas no dashboard do Supabase (localhost + produção + previews)

## 2. Refactor dos Clientes Supabase

- [x] 2.1 Reescrever `src/lib/supabase/client.ts` como factory `createBrowserClient()` usando `@supabase/ssr`, com validação de ENV
- [x] 2.2 Reescrever `src/lib/supabase/server.ts` adicionando `createServerClient()` factory com `cookies()` + manter `supabaseAdmin` como export nomeado
- [x] 2.3 Criar `src/lib/supabase/middleware.ts` com `updateSession(request)` que retorna `{ response, claims }` — usando `createServerClient` + `getClaims()`
- [x] 2.4 Remover `src/lib/supabase.ts` (barrel) e atualizar todos os imports que apontavam para ele
- [x] 2.5 Verificar com `git grep` que nenhum consumidor residual do singleton `supabase` ou barrel existe

## 3. Helpers de Autorização

- [x] 3.1 Criar `src/lib/auth/require-user.ts` com classe `UnauthorizedError` e função `requireUser()` que valida claims via `getClaims()` retornando `{ userId: claims.sub, claims }`
- [x] 3.2 Implementar `requirePageUser()` adaptando `requireUser()` para Server Components (catch → redirect)
- [x] 3.3 Implementar padrão de uso para route handlers capturarem `UnauthorizedError` → 401 JSON

## 4. Redirecionamento Seguro

- [x] 4.1 Criar `src/lib/auth/redirect.ts` com função `sanitizeRedirectPath()` e allowlist com match exato (`=== "/"`, `=== "/store"`, `.startsWith("/campaign/")`)
- [x] 4.2 Implementar rejeição de URLs absolutas, protocol-relative, backslashes e caminhos de auth
- [x] 4.3 Implementar preservação de query string como dados opacos e descarte de fragmentos

## 5. Middleware de Autenticação

- [x] 5.1 Criar `src/middleware.ts` com matcher positivo (`/`, `/login`, `/store/:path*`, `/campaign/:path*`, `/api/:path*`)
- [x] 5.2 Implementar fluxo: `const { response, claims } = await updateSession(request)` + decisão de rota
- [x] 5.3 Implementar redirect de páginas protegidas sem sessão para `/login?redirect=...`
- [x] 5.4 Implementar 401 JSON para `/api/*` sem sessão
- [x] 5.5 Implementar redirect de `/login` com sessão para `/`
- [x] 5.6 Garantir que toda resposta (redirect, 401, next) preserve cookies de `updateSession()`

## 6. Página de Login

- [x] 6.1 Criar `src/app/(auth)/layout.tsx` com container centralizado e logo (sem navegação principal)
- [x] 6.2 Criar `src/app/(auth)/login/page.tsx` — server component que renderiza form (sem requirePageUser — middleware já trata auth check)
- [x] 6.3 Criar `src/app/(auth)/login/login-form.tsx` — client component com email + senha + submit + loading + erro
- [x] 6.4 Integrar `sanitizeRedirectPath()` na página de login para validar `?redirect=` antes do redirect pós-login

## 7. Logout

- [x] 7.1 Criar `src/app/auth/signout/route.ts` — Route Handler POST com `signOut()` + `revalidatePath()` + redirect
- [x] 7.2 Implementar componente de logout com `<form action="/auth/signout" method="POST">` e `onSubmit` que limpa storage (4 chaves) antes da submissão nativa
- [x] 7.3 Adicionar botão "Sair" no header da aplicação, estilizado conforme `openspec/design-system/MASTER.md`

## 8. Testes

- [x] 8.1 Testar `requireUser()`: claims válidas, ausentes, erro, sub vazio
- [x] 8.2 Testar `sanitizeRedirectPath()`: caminhos permitidos, rejeitados, vazio, fallback
- [x] 8.3 Testar middleware: página protegida sem sessão, /login com sessão, API sem sessão, pass-through autenticado
- [x] 8.4 Testar login form: renderização, submit com sucesso, submit com erro, loading state
- [x] 8.5 Testar logout: limpeza das 4 chaves, submissão do form
- [x] 8.6 Verificar que a suíte existente continua passando (mock `supabaseAdmin` não afetado)

## 9. Verificação Final

- [x] 9.1 Rodar `npx vitest run` — todos os testes verdes
- [x] 9.2 Rodar `npx tsc --noEmit` — zero erros de tipo
- [x] 9.3 Rodar `npx next build` — build bem-sucedido
- [x] 9.4 Executar fluxo manual: provisionar usuário no Dashboard → login → rota protegida → logout
- [x] 9.5 Rodar `git grep "from.*supabase/client"` para confirmar que nenhum import residual do singleton antigo existe
