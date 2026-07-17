## Context

A F23 entregou `TextProvider` + `CopyDirectorService` — IA de copy persuasiva. A F24 entregou `CreditService` + ledger imutável com SQL functions atômicas — a camada financeira do produto. A F25 integrou Copy Director, créditos, rate limit e `mandatoryArtworkText` no pipeline `POST /api/campaign/generate-image`.

**O que falta para operar o beta controlado com 3-5 lojistas:**
- Time não tem como listar usuários e lojas sem SQL manual
- Conceder créditos exige chamar SQL direto no Supabase Dashboard
- Saldo e extrato de uma loja específica exigem consulta manual ao banco
- Campanhas com erro demandam consulta dispersa em várias tabelas
- Ações administrativas não têm trilha de auditoria
- Não há gate de acesso admin — qualquer um com acesso ao Supabase Dashboard pode ver dados financeiros

**Dependências:** F24 (CreditService.grantCredits, getBalance, getHistory) + F25 (campaigns com error status e error_message)

## Goals / Non-Goals

**Goals:**
- Admin access control via `admin_users` table + `requireAdmin()` gate (sem flag em `auth.users`)
- Diretório de usuários/lojas em `/admin/users` com busca, paginação e dados de suporte
- Detalhe de lojista em `/admin/users/[id]` com saldo, extrato, formulário de grant, criação de loja (se não tem) e campanhas com erro
- Criação de loja pelo admin via `POST /api/admin/stores` reutilizando RPC `create_store_with_initial_grant` (F25)
- Concessão manual de créditos via `POST /api/admin/credits/grant` com motivo obrigatório, idempotência e audit trail atômico
- Triagem de erros em `/admin/campaigns/errors` com detalhes para diagnóstico
- Audit log em `/admin/audit-log` com histórico paginado; tabela `admin_audit_log` append-only
- Middleware protege `/admin/*` (sessão) + server components/API routes com `requireAdmin()` (admin_users)
- 21+ testes validando gate, grant, store creation, audit log, listagem e erros

**Non-Goals:**
- Dashboard analítico com métricas agregadas, gráficos ou séries temporais (F28)
- RBAC / roles / permissões granulares (flag binária admin ou não é suficiente para beta)
- Impersonation / login como usuário
- CRUD destrutivo de usuários (excluir conta)
- Convite por email / magic link (MVP: admin cria loja + concede créditos)
- Múltiplas lojas por usuário (relação 1:1 mantida)
- Notificações (email/SMS) ao conceder crédito
- Interface em inglês / i18n (apenas PT-BR)
- Upload de avatar / assets no admin

## Decisions

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

**Motivo:** `auth.users` é schema gerenciado pelo Supabase Auth. Colocar flag lá é frágil (pode ser resetada em migração de auth, não tem audit trail nativo, mistura responsabilidades). `admin_users` como tabela própria é simples, auditável e extensível.

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

**Motivo:** O middleware Next.js roda na edge, onde consultar `admin_users` exigiria service_role ou expor uma policy pública — ambos indesejáveis.

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

```
1. Idempotência: SELECT operation_id existente → se encontrado, retorna dados sem executar
2. grant_credits(storeId, amount, reason, 'admin_grant_' + operationId, metadata)
3. INSERT admin_audit_log com actor_id, action='credit_grant', target_type='store', target_id, reason, operation_id, metadata={amount, transaction_id}
4. Se qualquer passo falhar → ROLLBACK desfaz tudo
```

**Fluxo do handler:**
```typescript
// POST /api/admin/credits/grant
async function handler(request: Request) {
  const admin = await requireAdmin();
  const body = GrantCreditsRequestSchema.parse(await request.json());
  const result = await supabaseAdmin.rpc("admin_grant_credits", {
    p_actor_id: admin.userId, p_store_id: body.storeId,
    p_amount: body.amount, p_reason: body.reason,
    p_operation_id: body.operationId,
  });
  const balance = await creditService.getBalance(body.storeId);
  return Response.json({ ...result, newBalance: balance });
}
```

**Idempotência com `operationId`:** Client gera UUID por submissão. Retries carregam mesmo valor. Guard `SELECT ... WHERE operation_id = p_operation_id` no topo da RPC previne duplicação. Unique index `idx_admin_audit_log_operation` no `operation_id`.

### D6 — Admin vê dados de qualquer loja (service role + requireAdmin, não RLS)

`DECIDIDO`

Rotas admin usam `supabaseAdmin` (service role) para SELECT em `credit_balances`, `credit_transactions`, `campaigns` e `stores`. A proteção não é RLS, é o gate `requireAdmin()`.

**Motivo:** RLS filtra por `store_id = user_id do owner`. Admin precisa ver lojas de outros usuários. Service role bypassa RLS e o gate é a barreira.

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

```
1. Verifica se usuário já possui loja → se sim, RAISE EXCEPTION
2. Chama create_store_with_initial_grant(p_name, p_segment, p_user_id) — RPC existente (F25)
3. INSERT admin_audit_log com action='store_create_invite', target_type='user'
4. Se qualquer passo falhar → ROLLBACK desfaz tudo
```

**Fluxo do handler:**
```typescript
// POST /api/admin/stores
async function handler(request: Request) {
  const admin = await requireAdmin();
  const body = CreateStoreSchema.parse(await request.json());
  const result = await supabaseAdmin.rpc("admin_create_store_for_user", {
    p_admin_id: admin.userId,
    p_user_id: body.userId,
    p_name: body.storeName,
    p_segment: body.segment,
  });
  return Response.json(result, { status: 201 });
}
```

**Motivo:** Sem atomicidade, existe a janela onde a loja é criada mas o audit log falha — exatamente o problema que D4/D5 previnem para créditos. O mesmo princípio se aplica à criação de loja.

### D8 — Admin pages como Server Components + Client Islands

`DECIDIDO`

- `/admin/users/page.tsx` — Server Component com busca SSR (searchParams)
- `/admin/users/[id]/page.tsx` — Server Component com dados consolidados, formulário de grant, criação de loja (se não tem)
- Formulário de grant + criação de loja — Client Components inline na página de detalhe
- Tabelas com paginação — Client Component com fetching client-side

## Mapa de Rotas

| Rota | Método | Descrição |
|------|--------|-----------|
| `POST /api/admin/credits/grant` | POST | Concede créditos + audit log (requireAdmin) |
| `POST /api/admin/stores` | POST | Cria loja para usuário sem loja via RPC `admin_create_store_for_user` (atômico) |
| `GET /api/admin/users` | GET | Lista usuários paginada com busca |
| `GET /api/admin/users/[id]` | GET | Detalhe completo de usuário |
| `GET /api/admin/campaigns/errors` | GET | Campanhas com erro |
| `GET /api/admin/audit-log` | GET | Audit log paginado |

## Estrutura de Código

```
ARQUIVOS NOVOS:
─────────────────
src/lib/admin/
├── require-admin.ts                  ← requireAdmin() gate function
└── __tests__/
    └── require-admin.test.ts

src/app/(app)/admin/
├── layout.tsx                        ← Layout com requireAdmin
├── page.tsx                          ← Dashboard operacional
├── users/
│   ├── page.tsx                      ← Diretório com busca
│   └── [id]/
│       └── page.tsx                  ← Detalhe: saldo, extrato, grant form
├── campaigns/
│   └── errors/
│       └── page.tsx                  ← Lista de campanhas com erro
└── audit-log/
    └── page.tsx                      ← Histórico de ações

src/app/api/admin/
├── credits/
│   └── grant/
│       └── route.ts                  ← POST concede créditos
├── stores/
│   └── route.ts                      ← POST cria loja para usuário
├── users/
│   ├── route.ts                      ← GET lista usuários
│   └── [id]/
│       └── route.ts                  ← GET detalhe completo
├── campaigns/
│   └── errors/
│       └── route.ts                  ← GET campanhas com erro
└── audit-log/
    └── route.ts                      ← GET audit log paginado

supabase/migrations/
└── 20260717000003_create_admin_tables.sql

ARQUIVOS MODIFICADOS:
───────────────────────
src/middleware.ts                     ← Proteção de sessão para /admin/*
```

## Contratos de Integração

### GrantCreditsRequestSchema (Zod)
```typescript
export const GrantCreditsRequestSchema = z.object({
  storeId: z.string().uuid(),
  amount: z.number().int().positive("Amount deve ser maior que zero"),
  reason: z.string().min(10, "Motivo deve ter no mínimo 10 caracteres").max(500),
  operationId: z.string().uuid(),
});
```

### AdminUserSummary (response)
```typescript
export interface AdminUserSummary {
  userId: string;
  email: string;
  storeId: string | null;
  storeName: string | null;
  segment: string | null;
  balance: number;
  totalCampaigns: number;
  errorCampaigns: number;
  lastCampaignAt: string | null;
  createdAt: string;
}
```

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Admin concede crédito sem audit trail** | D5: grant sem audit log é rollback. `admin_audit_log` é append-only |
| **Admin concede crédito para loja errada** | StoreId é UUID validado por Zod + verificação de existência. UI exibe nome da loja antes de confirmar |
| **Race condition: dois admins concedendo crédito para mesma loja** | `operationId` + unique index no audit log. Segunda chamada retorna dados existentes sem executar |
| **Admin interface sem proteção adequada** | Dupla proteção: middleware (sessão) + `requireAdmin()` (admin_users) |
| **admin_audit_log cresce sem controle** | Volume esperado é baixo (dezenas de ações/dia). Paginação na view. Retenção indefinida por ser financeiro |
| **admin_users sem RLS de SELECT para authenticated** | Nenhum usuário comum precisa listar admins. Apenas service_role gerencia. Gate é o requireAdmin |
