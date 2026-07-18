## ADDED Requirements

### Requirement: admin_users table

O sistema SHALL criar a tabela `public.admin_users` para armazenar usuários com privilégios administrativos.

- `user_id UUID PK REFERENCES auth.users(id) ON DELETE CASCADE`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- RLS habilitado
- GRANT SELECT/INSERT/DELETE apenas para `service_role`
- Sem flag em `auth.users`

#### Scenario: Admin user authenticated via requireAdmin()

- **WHEN** `requireAdmin()` é chamado com user presente em `admin_users`
- **THEN** retorna `{ userId }` sem lançar erro

#### Scenario: Non-admin user blocked by requireAdmin()

- **WHEN** `requireAdmin()` é chamado com user NÃO presente em `admin_users`
- **THEN** lança `ForbiddenError` com mensagem "Acesso restrito a administradores"

#### Scenario: Unauthenticated user blocked by requireAdmin()

- **WHEN** `requireAdmin()` é chamado sem sessão de usuário
- **THEN** lança `UnauthorizedError` (herdado de `requireApiUser()`)

### Requirement: requireAdmin() gate function

O sistema SHALL criar a função `requireAdmin()` em `src/lib/admin/require-admin.ts`.

- Combina `requireApiUser()` + SELECT em `admin_users` via `supabaseAdmin`
- Usa `supabaseAdmin` (service role) para consultar `admin_users`
- Retorna `{ userId: string }` quando autorizado
- Lança `ForbiddenError` quando usuário não é admin
- Reutiliza erros de `requireApiUser()` para não autenticado

#### Scenario: requireAdmin uses supabaseAdmin for query

- **WHEN** `requireAdmin()` é executado
- **THEN** a consulta a `admin_users` usa o client `supabaseAdmin` (service role), nunca o client do usuário

#### Scenario: requireAdmin is called from server component

- **WHEN** um server component (layout admin) chama `requireAdmin()`
- **THEN** o gate bloqueia o render se usuário não está em `admin_users`

#### Scenario: requireAdmin is called from API route

- **WHEN** uma API route `/api/admin/*` chama `requireAdmin()`
- **THEN** retorna 403 se usuário não está em `admin_users`
