# Phase 26: Admin Operacional + Convites + Créditos Manuais — Context

**Gathered:** 2026-07-18
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-26-admin-operacional/`

<domain>
## Phase Boundary

Implementar um console operacional mínimo para o time conduzir o beta controlado com 3-5 lojistas. O time não tem ferramentas administrativas: não há como listar/buscar usuários e lojas sem SQL manual, conceder créditos exige chamar funções direto no Supabase Dashboard, campanhas com erro demandam consulta dispersa em várias tabelas, ações administrativas não têm trilha de auditoria, e não há gate de acesso admin.

**Estado atual (pós-F25):**
- Sem `admin_users` — qualquer um com acesso ao Supabase Dashboard pode ver dados financeiros
- Sem `requireAdmin()` — rotas admin não existem
- Sem `admin_audit_log` — ações administrativas sem trilha
- Sem diretório de usuários/lojas — time consulta SQL manual
- Conceder créditos exige chamar SQL direto no Supabase Dashboard
- Saldo e extrato de loja específica exigem consulta manual ao banco
- Campanhas com erro demandam consulta dispersa em várias tabelas
- Sem interface admin — zero páginas ou rotas administrativas
- Middleware não protege `/admin/*` — rota não existe

**Dependências:** F24 (CreditService.grantCredits, getBalance, getHistory), F25 (create_store_with_initial_grant, campanhas com error status e error_message)

</domain>

<decisions>
## Implementation Decisions

### D1 — Admin gate via `admin_users` table (não flag em `auth.users`)

`DECIDIDO`

```sql
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.admin_users TO service_role;
GRANT INSERT ON TABLE public.admin_users TO service_role;
GRANT DELETE ON TABLE public.admin_users TO service_role;
```

**Motivo:** `auth.users` é schema gerenciado pelo Supabase Auth. Colocar flag lá é frágil (pode ser resetada em migração de auth, não tem audit trail nativo, mistura responsabilidades).

**Uso no código:**
```typescript
async function requireAdmin(): Promise<{ userId: string }> {
  const { userId } = await requireApiUser();
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new ForbiddenError("Acesso restrito a administradores");
  return { userId };
}
```

### D2 — Console operacional, não dashboard analítico

`DECIDIDO`

F26 implementa um console de suporte operacional. F28 (Observabilidade) complementará com métricas agregadas, gráficos e alertas.

| F26 (Admin Operacional) | F28 (Observabilidade) |
|-------------------------|----------------------|
| Listar/buscar usuários | Taxa de sucesso agregada |
| Conceder créditos | Custo médio por geração |
| Ver saldo/extrato de uma loja | Erro rate, tendências |
| Ver erro de campanha específica | Alertas, séries temporais |
| Audit log de ações | Runbooks, health metrics |

### D3 — Login normal + gate (sem `/admin/login`)

`DECIDIDO`

- Mesmo fluxo de login do usuário comum
- **Middleware**: verifica sessão para rotas `/admin/*`; se não autenticado, redirect `/login`. **Não consulta `admin_users`** — evita service_role na edge
- **Server component/layout**: `requireAdmin()` consulta `admin_users` e bloqueia se não autorizado
- **API routes**: cada rota `/api/admin/*` chama `requireAdmin()` internamente
- Dupla proteção: middleware (sessão) + server component/API (admin_users)

### D4 — Audit log obrigatório para ações sensíveis

`DECIDIDO`

```sql
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund')),
  target_type TEXT NOT NULL CHECK (target_type IN ('store', 'user', 'campaign')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Trigger de imutabilidade: `BEFORE UPDATE OR DELETE` com `RAISE EXCEPTION 'admin_audit_log é append-only'`.

**Contrato:** Toda concessão manual de crédito deve ser atômica — grant + audit log na mesma transação. Nunca crédito sem trilha.

### D5 — Concessão de crédito via RPC atômica (grant + audit log)

`DECIDIDO`

Criar SQL function `admin_grant_credits()` que executa ambas as operações na mesma transação:

1. Idempotência: SELECT operation_id existente → se encontrado, retorna dados sem executar
2. grant_credits(storeId, amount, reason, 'admin_grant_' + operationId, metadata)
3. INSERT admin_audit_log com actor_id, action='credit_grant', target_type='store', target_id, reason, operation_id, metadata={amount, transaction_id}
4. Se qualquer passo falhar → ROLLBACK desfaz tudo

**Idempotência com `operationId`:** Client gera UUID por submissão. Retries carregam mesmo valor. Guard `SELECT ... WHERE operation_id = p_operation_id` no topo da RPC previne duplicação. Unique index `idx_admin_audit_log_operation` no `operation_id`.

### D6 — Admin vê dados de qualquer loja (service role + requireAdmin, não RLS)

`DECIDIDO`

Rotas admin usam `supabaseAdmin` (service role) para SELECT em `credit_balances`, `credit_transactions`, `campaigns` e `stores`. A proteção não é RLS, é o gate `requireAdmin()`.

### D7 — Convite beta: MVP sem email convite

`DECIDIDO`

1. Usuário faz signup normal (fluxo existente Supabase Auth)
2. Admin vê usuário no diretório `/admin/users`
3. Se usuário não tem loja, admin pode criar loja + conceder créditos
4. Usuário loga e encontra loja pronta com saldo

**Fora do escopo:** envio de convite por email, criação de usuário pelo admin, magic link, link público de signup beta.

### D9 — Criação de loja pelo admin via RPC atômica (store + audit log)

`DECIDIDO`

Criar SQL function `admin_create_store_for_user()` que executa verificação + criação + audit log na mesma transação:

1. Verifica se usuário já possui loja → se sim, RAISE EXCEPTION
2. Chama create_store_with_initial_grant(p_name, p_segment, p_user_id) — RPC existente (F25)
3. INSERT admin_audit_log com action='store_create_invite', target_type='user'
4. Se qualquer passo falhar → ROLLBACK desfaz tudo

### D8 — Admin pages como Server Components + Client Islands

`DECIDIDO`

- `/admin/users/page.tsx` — Server Component com busca SSR (searchParams)
- `/admin/users/[id]/page.tsx` — Server Component com dados consolidados, formulário de grant, criação de loja (se não tem)
- Formulário de grant + criação de loja — Client Components inline na página de detalhe
- Tabelas com paginação — Client Component com fetching client-side

### D3 — Login normal + gate (sem `/admin/login`)

`DECIDIDO`

- Mesmo fluxo de login do usuário comum
- **Middleware**: verifica sessão para rotas `/admin/*`; se não autenticado, redirect `/login`. **Não consulta `admin_users`** — evita service_role na edge
- **Server component/layout**: `requireAdmin()` consulta `admin_users` e bloqueia se não autorizado
- **API routes**: cada rota `/api/admin/*` chama `requireAdmin()` internamente
- Dupla proteção: middleware (sessão) + server component/API (admin_users)

### the agent's Discretion
- Estrutura exata dos testes (quantidade, cenários) desde que 21+ testes
- Ordem exata das tarefas dentro de cada plano
- Detalhes de implementação dos Client Components (grant form, store creation form)
- Estilo visual das páginas admin (seguir padrão existente do app shell)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Admin Gate (F26)
- `openspec/changes/fase-26-admin-operacional/design.md` — D1-D9, goals/non-goals, rota map, estrutura de código, contratos de integração, riscos
- `openspec/changes/fase-26-admin-operacional/tasks.md` — 14 task groups, 21+ testes
- `openspec/changes/fase-26-admin-operacional/specs/admin-gate/spec.md` — admin_users table + requireAdmin() scenarios
- `openspec/changes/fase-26-admin-operacional/specs/admin-audit-log/spec.md` — admin_audit_log table + append-only trigger + GET endpoint + UI
- `openspec/changes/fase-26-admin-operacional/specs/admin-credit-grant/spec.md` — admin_grant_credits RPC + POST endpoint + GrantCreditsRequestSchema + UI form
- `openspec/changes/fase-26-admin-operacional/specs/admin-store-create/spec.md` — admin_create_store_for_user RPC + POST endpoint + UI
- `openspec/changes/fase-26-admin-operacional/specs/admin-user-directory/spec.md` — AdminUserSummary + GET endpoints + directory page + detail page
- `openspec/changes/fase-26-admin-operacional/specs/admin-campaign-errors/spec.md` — GET /api/admin/campaigns/errors + AdminCampaignError + UI page
- `openspec/changes/fase-26-admin-operacional/specs/admin-audit-log/spec.md` — admin_audit_log table + indexes + append-only trigger + GET endpoint + UI page
- `openspec/changes/fase-26-admin-operacional/specs/auth-middleware/spec.md` — Middleware matcher expansion + session-only protection
- `openspec/changes/fase-26-admin-operacional/specs/credit-sql-functions/spec.md` — admin_grant_credits SQL function

### CreditService (F24)
- `src/lib/credit/credit-service.ts` — CreditService com 6 métodos (grantCredits, getBalance, getHistory, reserveCredit, confirmCredit, refundCredit)
- `src/lib/credit/types.ts` — CreditOperationOptions

### Store Creation (F25)
- `src/app/api/store/route.ts` — POST handler com create_store_with_initial_grant RPC
- `supabase/migrations/20260717000002_create_store_with_initial_grant.sql` — RPC transacional

### Middleware (modificado)
- `src/middleware.ts` — Middleware atual (será expandido para incluir `/admin/:path*`)

### Existing Migration Pattern
- `supabase/migrations/` — Existing migration naming, RLS, trigger patterns
- `supabase/migrations/20260716000001_create_credit_tables.sql` — F24 migration pattern (SQL functions)
- `supabase/migrations/20260717000002_create_store_with_initial_grant.sql` — F25 RPC pattern

### Project Requirements
- `.planning/REQUIREMENTS.md` — ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06 mapped to Phase 26

</canonical_refs>

<specifics>
## Specific Ideas

- Admin gate via `admin_users` table (não flag em `auth.users`) — tabela própria, simples, auditável e extensível
- `requireAdmin()` combina `requireApiUser()` + SELECT `admin_users` via `supabaseAdmin`
- Dupla proteção: middleware (sessão) + server component/API (admin_users)
- Middleware não consulta `admin_users` — evita service_role na edge
- `admin_audit_log` append-only com trigger BEFORE UPDATE/DELETE
- `admin_grant_credits()` RPC atômica: grant + audit log na mesma transação, com idempotência via operationId
- `admin_create_store_for_user()` RPC atômica: verificação + store creation + audit log
- Rotas admin usam `supabaseAdmin` (service role) — proteção via `requireAdmin()`, não RLS
- Convite beta MVP: admin cria loja + concede créditos via interface (sem email)
- Admin pages como Server Components + Client Islands (grant form, store creation form)
- 21+ testes validando gate, grant, store creation, audit log, listagem e erros

</specifics>

<deferred>
## Deferred Ideas

- Dashboard analítico com métricas agregadas, gráficos ou séries temporais (F28)
- RBAC / roles / permissões granulares (flag binária admin ou não é suficiente para beta)
- Impersonation / login como usuário
- CRUD destrutivo de usuários (excluir conta)
- Convite por email / magic link (MVP: admin cria loja + concede créditos)
- Múltiplas lojas por usuário (relação 1:1 mantida)
- Notificações (email/SMS) ao conceder crédito
- Interface em inglês / i18n (apenas PT-BR)
- Upload de avatar / assets no admin

</deferred>

---

*Phase: 26-admin-operacional*
*Context gathered: 2026-07-18 via OpenSpec source of truth*
