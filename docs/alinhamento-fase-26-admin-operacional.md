# Alinhamento Fase 26 — Admin Operacional + Convites + Créditos Manuais (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director (fundação IA de texto)                 ✓
  ├── F24 — Wallet + Ledger + Idempotência (fundação financeira)                ✓
  ├── F25 — Integração Transacional do Pipeline                                 ✓
  ├── F26 — Admin Operacional + Convites + Créditos Manuais                     ← esta fase
  ├── F27 — Conta + Saldo Visível + Extrato (sem Stripe)
  ├── F28 — Observabilidade + Operação + Launch Controls
  ├── F29 — Refinamento Visual + UAT + Launch Readiness
  └── F30/v1.6 — Stripe / Monetização Pública (adiado para pós-beta)


> **Realinhamento da milestone:** Stripe Checkout + Webhook + credit_orders 
> saíram do caminho crítico da v1.5. Durante o beta controlado (3-5 lojistas),
> o crédito é operado pelo time, não comprado pelo usuário. A F30/v1.6 
> retomará a monetização pública após validação do beta.
```

A F23 entregou `TextProvider` + `CopyDirectorService` — IA de copy persuasiva. A F24 entregou `CreditService` + ledger imutável com SQL functions atômicas. A F25 integrou Copy Director, créditos, rate limit e `mandatoryArtworkText` no pipeline `POST /api/campaign/generate-image`.

**O que falta para operar o beta controlado:**

- O time não tem como listar usuários e lojas do beta sem SQL manual
- Não há como conceder créditos a um lojista sem chamar SQL direto no Supabase Dashboard
- Não há como visualizar saldo e extrato de uma loja específica para suporte
- Campanhas com erro exigem consulta manual ao banco para investigar
- Ações administrativas não têm trilha de auditoria
- Não há gate de acesso admin — qualquer um com acesso ao Supabase Dashboard pode ver dados financeiros

**Esta fase resolve todos esses gaps**, implementando um console operacional mínimo para o time conduzir o beta controlado com segurança e auditabilidade.

**Dependências:** F24 (CreditService.grantCredits, getBalance, getHistory) + F25 (campaigns com error status e error_message)

---

## Propósito

1. **Admin access control** — `admin_users` table + `requireAdmin()` gate. Sem flag em `auth.users`
2. **Diretório de usuários/lojas** — listar e buscar beta users com dados de suporte
3. **Concessão manual de créditos** — `CreditService.grantCredits()` com motivo obrigatório, idempotência e audit trail
4. **Visualização financeira** — saldo e extrato de qualquer loja para suporte
5. **Triagem de erros** — campanhas com `error` listadas com detalhes mínimos para diagnóstico
6. **Audit log** — ações administrativas registradas em tabela append-only com `actor_id`, `action`, `target`, `reason`, `timestamp`

**Entrega verificável:**
- `admin_users(user_id UUID PK)` — tabela de gate, sem flag em `auth.users`
- `requireAdmin()` — função que combina `requireApiUser()` + SELECT em `admin_users`
- Páginas `/admin/*` protegidas por middleware + API routes com dupla proteção
- `/admin/users` — diretório com busca, paginação, dados de suporte
- `/admin/users/[id]` — detalhe: saldo, extrato, campanhas, formulário de grant
- Concessão via `POST /api/admin/credits/grant` — RPC `admin_grant_credits()` atômica (grant + audit na mesma transação)
- `/admin/campaigns/errors` — lista de campanhas com erro
- `/admin/audit-log` — histórico de ações administrativas
- `admin_audit_log` — tabela append-only com trigger BEFORE UPDATE/DELETE
- 15+ testes (gate admin, grant manual, audit log, listagem, erros)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F25)

```
                                    ANTES (F25)                         DEPOIS (F26)
═══════════════════════════════════════════════════════════════════════════════════════════

Admin access:
  Gate admin                       inexistente                        admin_users table
  requireAdmin()                   inexistente                        ✓

Diretório:
  Listar usuários                  SQL manual via Supabase Dashboard   /admin/users
  Buscar lojista                   SQL manual                          busca por nome/email/segmento
  Dados de suporte                 dispersos em várias tabelas         view consolidada

Créditos manuais:
  Conceder créditos                SQL direto no banco                 formulário + CreditService.grantCredits()
  Motivo obrigatório               inexistente                         validado por Zod
  Idempotência                     inexistente                         idempotencyKey no grant
  Audit trail                      inexistente                         admin_audit_log (append-only)

Visualização financeira:
  Saldo de loja                    consulta manual credit_balances    /admin/users/[id] → saldo
  Extrato de loja                  consulta manual credit_transactions /admin/users/[id] → extrato

Triagem de erros:
  Campanhas com erro               SQL manual campaigns WHERE status='error'  /admin/campaigns/errors
  Detalhes para suporte            espalhados em várias queries        view consolidada

Audit log:
  Registro de ações                inexistente                         admin_audit_log (append-only)
  Imutabilidade                    inexistente                         trigger BEFORE UPDATE/DELETE

Login:
  Admin login separado             inexistente                         mesmo login normal + gate
```

---

## Decisões de Arquitetura

### D1 — Admin gate via `admin_users` table (não flag em `auth.users`)

`DECIDIDO`

```sql
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode INSERT/DELETE (controlado pelo time)
-- Nenhuma policy de SELECT para authenticated (admin list não exposto publicamente)
GRANT SELECT ON TABLE public.admin_users TO service_role;
GRANT INSERT ON TABLE public.admin_users TO service_role;
GRANT DELETE ON TABLE public.admin_users TO service_role;
```

**Motivo:** `auth.users` é schema gerenciado pelo Supabase Auth. Colocar flag lá é frágil (pode ser resetada em migração de auth, não tem audit trail nativo, mistura responsabilidades). `admin_users` como tabela própria é simples, auditável e extensível (pode ganhar colunas no futuro sem mexer em auth).

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

---

### D2 — Console operacional, não dashboard analítico

`DECIDIDO`

A F26 implementa um **console de suporte**, não um dashboard de métricas.

| F26 (Admin Operacional) | F28 (Observabilidade) |
|-------------------------|----------------------|
| Listar/buscar usuários | Taxa de sucesso agregada |
| Conceder créditos | Custo médio por geração |
| Ver saldo/extrato de uma loja | Erro rate, tendências |
| Ver erro de campanha específica | Alertas, séries temporais |
| Audit log de ações | Runbooks, health metrics |

**Fronteira:** F26 não faz agregações, gráficos, alertas ou séries temporais. F28 complementa, não substitui.

---

### D3 — Login normal + gate (sem `/admin/login`)

`DECIDIDO`

- Mesmo fluxo de login do usuário comum
- **Middleware**: apenas verifica sessão para rotas `/admin/*`. Se não autenticado, redirect `/login`. **Não consulta `admin_users`** — isso evita usar service_role no middleware
- **Server component/layout**: `requireAdmin()` consulta `admin_users` e bloqueia se não autorizado
- **API routes**: cada rota `/api/admin/*` chama `requireAdmin()` internamente
- Dupla proteção: middleware (sessão) + server component/API (admin_users)

**Motivo:** O middleware Next.js roda na edge, onde consultar `admin_users` exigiria service_role ou expor uma policy pública — ambos indesejáveis. O gate admin real fica no server component e na API route, onde `supabaseAdmin` está disponível.

---

### D4 — Audit log obrigatório para ações sensíveis

`DECIDIDO`

```sql
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN (
    'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN ('store', 'user', 'campaign')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only: nenhum UPDATE ou DELETE permitido
CREATE OR REPLACE FUNCTION public.prevent_admin_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log é append-only. Nenhum UPDATE ou DELETE é permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_audit_log_mutation();
```

**Contrato:** Toda concessão manual de crédito (ADMIN-03) **deve** ser atômica — grant + audit log na mesma transação. Nunca crédito sem trilha.

---

### D5 — Concessão de crédito via RPC atômica (grant + audit log)

`DECIDIDO`

O `CreditService.grantCredits(storeId, amount, reason, opts?)` já existe e é idempotente. No entanto, ele **não** registra o audit log — e fazer duas operações sequenciais (grant → insert audit) quebra a atomicidade. Se o grant commitar e o audit falhar, há crédito sem trilha.

**Solução:** Criar uma SQL function `admin_grant_credits` que executa ambas as operações na mesma transação:

```sql
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  p_actor_id UUID,
  p_store_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_operation_id UUID,       -- gerado pelo client, usado como idempotencyKey
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_tx_id UUID;
  v_audit_id UUID;
  v_existing_audit_id UUID;
  v_existing_tx_id TEXT;
BEGIN
  -- 0. Idempotência: se operation_id já existe, retorna registro existente
  SELECT id, metadata->>'transaction_id'
  INTO v_existing_audit_id, v_existing_tx_id
  FROM public.admin_audit_log
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'transaction_id', v_existing_tx_id,
      'audit_id', v_existing_audit_id
    );
  END IF;

  -- 1. Executa grant via função existente (idempotente)
  SELECT public.grant_credits(
    p_store_id,
    p_amount,
    p_reason,
    'admin_grant_' || p_operation_id,  -- idempotencyKey
    p_metadata
  ) INTO v_tx_id;

  -- 2. Registra audit log na MESMA transação
  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id,
    reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'credit_grant', 'store', p_store_id,
    p_reason, p_operation_id,
    jsonb_build_object(
      'amount', p_amount,
      'transaction_id', v_tx_id
    ) || p_metadata
  ) RETURNING id INTO v_audit_id;

  -- 3. Se qualquer passo falhar, o ROLLBACK desfaz tudo (atomicidade real)
  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'audit_id', v_audit_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

**Fluxo do handler:**

```typescript
// POST /api/admin/credits/grant
async function handler(request: Request) {
  const admin = await requireAdmin();
  const body = await request.json();
  const { storeId, amount, reason, operationId } =
    GrantCreditsRequestSchema.parse(body);

  const result = await supabaseAdmin.rpc("admin_grant_credits", {
    p_actor_id: admin.userId,
    p_store_id: storeId,
    p_amount: amount,
    p_reason: reason,
    p_operation_id: operationId,
  });

  const balance = await creditService.getBalance(storeId);
  return Response.json({ ...result, newBalance: balance });
}
```

**Idempotência com `operationId` (client-generated):**

```
POST /api/admin/credits/grant { storeId, amount, reason, operationId }

idempotencyKey = 'admin_grant_' + operationId
operation_id na admin_audit_log com UNIQUE constraint
```

- O **client gera um UUID `operationId` por submissão** e o envia no body
- 1ª chamada: `admin_grant_credits` executa `grant_credits` + INSERT audit log → sucesso
- 2ª chamada (retry): RPC checa `operation_id` no início → encontra registro existente → retorna dados sem executar nada
- **Isso funciona porque `operationId` é imune a timestamp:** retries carregam o mesmo valor, e o guard `SELECT ... WHERE operation_id = p_operation_id` no topo da RPC previne tanto duplicação de grant quanto violação do UNIQUE no audit log

**Schema do request (Zod):**

```typescript
export const GrantCreditsRequestSchema = z.object({
  storeId: z.string().uuid(),
  amount: z.number().int().positive("Amount deve ser maior que zero"),
  reason: z.string().min(10, "Motivo deve ter no mínimo 10 caracteres").max(500),
  operationId: z.string().uuid(),  // gerado pelo client, imune a retry
});
```

**Unique constraint no audit log:**

```sql
-- Impede duplicação mesmo se grant_credits for idempotente
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_audit_log_operation
  ON public.admin_audit_log (operation_id)
  WHERE operation_id IS NOT NULL;
```

**Atomicidade garantida:** Tudo na mesma transação. Se qualquer passo falhar, ROLLBACK desfaz o grant e o audit log. Nunca crédito sem trilha.

---

### D6 — Admin vê dados de qualquer loja (sem RLS de ownership)

`DECIDIDO`

As rotas admin usam `supabaseAdmin` (service role) para SELECT em `credit_balances`, `credit_transactions`, `campaigns` e `stores`. A proteção não é RLS, é o gate `requireAdmin()`.

**Motivo:** RLS filtra por `store_id = user_id do owner`. Admin precisa ver lojas de outros usuários. Service role bypassa RLS e o gate `requireAdmin()` é a barreira.

**Contraste com F27:** O usuário comum vê apenas seus próprios dados via sessão + RLS. Admin vê todos os dados via service role + gate.

---

### D7 — Convite beta: MVP sem email convite

`DECIDIDO`

Fluxo mínimo:
1. Usuário faz signup normal (fluxo existente Supabase Auth)
2. Admin vê usuário no diretório `/admin/users`
3. Se usuário não tem loja, admin pode criar loja + conceder créditos (RPC `create_store_with_initial_grant` já existe)
4. Usuário loga e encontra loja pronta com saldo

**Fora do escopo:**
- Envio de convite por email
- Criação de usuário pelo admin
- Magic link / aprovação formal de cadastro
- Link público de signup beta

---

### D8 — Admin pages como Server Components (padrão do projeto) ou Client Components?

`DECIDIDO: Server Components + Client Islands`

As páginas admin seguem o padrão do repositório: Server Components (SSR) com ilhas de interatividade (Client Components para formulários, busca, tabelas com filtro).

- `/admin/users/page.tsx` — Server Component com busca SSR (searchParams)
- `/admin/users/[id]/page.tsx` — Server Component com dados consolidados
- Formulário de grant — Client Component inline na página de detalhe
- Tabelas com paginação — Client Component com fetching client-side

---

## Modelo de Dados — Novas Tabelas

### Migration: `20260717000003_create_admin_tables.sql`

#### `admin_users`

```sql
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Apenas service_role gerencia a lista de admins
GRANT SELECT ON TABLE public.admin_users TO service_role;
GRANT INSERT ON TABLE public.admin_users TO service_role;
GRANT DELETE ON TABLE public.admin_users TO service_role;

-- REVERT:
-- REVOKE ALL ON TABLE public.admin_users FROM service_role;
-- DROP TABLE IF EXISTS public.admin_users;
```

#### `admin_audit_log`

```sql
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN ('store', 'user', 'campaign')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  operation_id UUID,                                    -- gerado pelo client, unique para idempotência
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.admin_audit_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log (target_type, target_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_audit_log_operation
  ON public.admin_audit_log (operation_id)
  WHERE operation_id IS NOT NULL;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode INSERT e SELECT (via requireAdmin gate)
-- Usuários comuns (authenticated) não têm acesso
GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO service_role;

-- Trigger de imutabilidade
CREATE OR REPLACE FUNCTION public.prevent_admin_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log é append-only. Nenhum UPDATE ou DELETE é permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_audit_log_mutation();

-- REVERT:
-- DROP TRIGGER IF EXISTS trg_admin_audit_log_immutable ON public.admin_audit_log;
-- DROP FUNCTION IF EXISTS public.prevent_admin_audit_log_mutation();
-- REVOKE ALL ON TABLE public.admin_audit_log FROM service_role;
-- DROP INDEX IF EXISTS idx_admin_audit_log_operation;
-- DROP INDEX IF EXISTS idx_admin_audit_log_target;
-- DROP INDEX IF EXISTS idx_admin_audit_log_actor;
-- DROP TABLE IF EXISTS public.admin_audit_log;
```

---

## Estrutura de Código

```
ARQUIVOS NOVOS:
════════════════

src/lib/admin/
├── require-admin.ts                  ← requireAdmin() gate function
└── __tests__/
    └── require-admin.test.ts         ← 3+ testes (admin user, non-admin, unauthenticated)

src/app/(app)/
└── admin/
    ├── layout.tsx                     ← Layout com requireAdmin check
    ├── page.tsx                       ← Dashboard operacional (visão geral rápida)
    ├── users/
    │   ├── page.tsx                   ← Diretório com busca
    │   └── [id]/
    │       └── page.tsx               ← Detalhe: saldo, extrato, grant form, erros
    ├── campaigns/
    │   └── errors/
    │       └── page.tsx               ← Lista de campanhas com erro
    └── audit-log/
        └── page.tsx                   ← Histórico de ações administrativas

src/app/api/admin/
├── credits/
│   └── grant/
│       └── route.ts                  ← POST: concede créditos
├── users/
│   ├── route.ts                      ← GET: lista usuários
│   └── [id]/
│       └── route.ts                  ← GET: detalhe completo
├── campaigns/
│   └── errors/
│       └── route.ts                  ← GET: campanhas com erro
└── audit-log/
    └── route.ts                      ← GET: audit log paginado

supabase/
└── migrations/
    └── 20260717000003_create_admin_tables.sql  ← admin_users + admin_audit_log


ARQUIVOS MODIFICADOS:
══════════════════════

src/middleware.ts                     ← Adiciona verificação de sessão para rotas /admin/* (redirect se não auth)
src/(app)/admin/layout.tsx            ← requireAdmin() gate no server component (admin_users check)
```

---

## Contratos de Integração

### `requireAdmin()` — gate function

```typescript
// src/lib/admin/require-admin.ts
import { requireApiUser } from "@/lib/auth/require-user";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ForbiddenError } from "@/lib/auth/errors";

export async function requireAdmin(): Promise<{ userId: string }> {
  const { userId } = await requireApiUser();

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new ForbiddenError("Acesso restrito a administradores");
  }

  return { userId };
}
```

### Schema de grant (Zod)

```typescript
export const GrantCreditsRequestSchema = z.object({
  storeId: z.string().uuid(),
  amount: z.number().int().positive("Amount deve ser maior que zero"),
  reason: z.string().min(10, "Motivo deve ter no mínimo 10 caracteres").max(500),
  operationId: z.string().uuid(),  // gerado pelo client, imune a retry
});
```

### Listagem de usuários (response)

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

---

## Testes

15+ testes seguindo padrão do repositório:

### Admin gate (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `requireAdmin()` com admin_user → OK | Gate libera acesso |
| 2 | `requireAdmin()` com user comum → ForbiddenError | Gate bloqueia |
| 3 | `requireAdmin()` sem auth → UnauthorizedError | Gate exige auth |

### Concessão de créditos (6 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 4 | Grant com motivo válido → crédito adicionado + audit log | Fluxo completo |
| 5 | Grant com motivo vazio → 400 | Motivo obrigatório |
| 6 | Grant com storeId inválido → 404 | Store deve existir |
| 7 | Grant sem auth → 401 | Requer admin |
| 8 | Grant com user não admin → 403 | Requer admin |
| 9 | Mesmo operationId em retry → idempotente (mesma tx + audit) | Idempotência real |

### Audit log (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 10 | Ação registrada com actor, action, target, reason, operation_id | Dados corretos |
| 11 | Audit log é append-only (tenta UPDATE → erro) | Imutabilidade |
| 12 | Múltiplas ações → histórico cronológico | Ordenação |

### Listagem e view (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 13 | `/admin/users` retorna lista paginada | Diretório funcional |
| 14 | `/admin/users/[id]` retorna detalhe com saldo + extrato | View consolidada |
| 15 | `/admin/campaigns/errors` retorna campanhas com erro | Triagem funcional |
| 16 | `/admin/audit-log` retorna histórico paginado | Audit log funcional |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Admin concede crédito sem audit trail** — ação sem rastro financeiro | D4: grant sem audit log é tratado como falha (rollback ou compensação). `admin_audit_log` é append-only |
| **Admin acidentalmente concede crédito para loja errada** | StoreId é UUID validado por Zod + verificação de existência. UI exibe nome da loja antes de confirmar |
| **Race condition: duas pessoas concedendo crédito para mesma loja** | `CreditService.grantCredits` é idempotente via `idempotencyKey`. Cada grant tem chave única |
| **Admin interface sem proteção adequada** — usuário não admin acessa `/admin/*` | Dupla proteção: middleware verifica sessão (redirect se não auth) + `requireAdmin()` no server component e API routes |
| **admin_audit_log cresce sem controle** | Volume esperado é baixo (dezenas de ações/dia). Se crescer, adicionar paginação e cleanup opcional (retenção indefinida por ser financeiro) |
| **Abuso de admin: conceder créditos sem critério** | Audit log registra `actor_id`. Reconciliação periódica (F28) pode detectar padrões anômalos |
| **admin_users sem RLS de SELECT para authenticated** | Nenhum usuário comum precisa listar admins. Apenas service_role gerencia. Gate é o requireAdmin |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Stripe Checkout / Webhook | Diferido para F30/v1.6 |
| Métricas agregadas / dashboard analítico | F28 — complementa, não substitui F26 |
| RBAC / roles / permissões granulares | Flag binária (admin ou não) é suficiente para beta. Evoluir quando necessário |
| Impersonation / login como usuário | Fora do escopo do beta controlado |
| CRUD destrutivo de usuários (excluir conta) | Apenas operações construtivas (grant, criar loja). Exclusão tem política separada |
| Convite por email / magic link | Usuário existe via fluxo normal de auth. Admin apenas completa onboarding |
| Múltiplas lojas por usuário | Relação 1:1 user→store mantida |
| Notificações (email/SMS) ao conceder crédito | Fora do escopo do MVP. Pode ser adicionado depois |
| Interface em inglês / i18n | Apenas PT-BR |
| Upload de avatar / assets no admin | Admin é funcional, não visual |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Admin gate via `admin_users` table (não flag em `auth.users`)
- [ ] D2 — Console operacional, não dashboard analítico (F28 complementa)
- [ ] D3 — Login normal + gate (sem `/admin/login` separado)
- [ ] D4 — Audit log append-only obrigatório para ações sensíveis
- [ ] D5 — Concessão via RPC `admin_grant_credits` atômica, reutilizando `grant_credits` internamente
- [ ] D6 — Admin vê dados de qualquer loja (service role + requireAdmin, não RLS)
- [ ] D7 — Convite beta MVP: sem email convite, admin completa onboarding
- [ ] D8 — Admin pages como Server Components + Client Islands

### Migration — `admin_users`
- [ ] Tabela `admin_users` com `user_id UUID PK REFERENCES auth.users(id)`
- [ ] RLS habilitado
- [ ] GRANT SELECT/INSERT/DELETE apenas para `service_role`
- [ ] Revert commands documentados

### Migration — `admin_audit_log`
- [ ] Tabela com todos os campos: `id`, `actor_id`, `action`, `target_type`, `target_id`, `reason`, `operation_id`, `metadata`, `created_at`
- [ ] CHECK constraint `action IN ('credit_grant', 'credit_adjustment', 'store_create_invite', 'manual_refund')`
- [ ] CHECK constraint `target_type IN ('store', 'user', 'campaign')`
- [ ] Índice `idx_admin_audit_log_actor` (actor_id, created_at DESC)
- [ ] Índice `idx_admin_audit_log_target` (target_type, target_id, created_at DESC)
- [ ] Unique index `idx_admin_audit_log_operation` (operation_id) — impede duplicação em retry
- [ ] RLS habilitado
- [ ] GRANT SELECT, INSERT para `service_role`
- [ ] Trigger `trg_admin_audit_log_immutable` — BEFORE UPDATE OR DELETE com RAISE EXCEPTION
- [ ] Revert commands documentados

### requireAdmin()
- [ ] `src/lib/admin/require-admin.ts` — função que combina `requireApiUser()` + SELECT `admin_users`
- [ ] Erro `ForbiddenError` para não-admin
- [ ] Erro `UnauthorizedError` para não autenticado

### Páginas admin
- [ ] `/admin` — visão geral rápida
- [ ] `/admin/users` — diretório com busca e paginação
- [ ] `/admin/users/[id]` — detalhe com saldo, extrato, grant form, campanhas com erro
- [ ] `/admin/campaigns/errors` — lista de erros
- [ ] `/admin/audit-log` — histórico de ações

### API routes admin
- [ ] `POST /api/admin/credits/grant` — concede créditos + audit log
- [ ] `GET /api/admin/users` — lista paginada
- [ ] `GET /api/admin/users/[id]` — detalhe completo
- [ ] `GET /api/admin/campaigns/errors` — erros
- [ ] `GET /api/admin/audit-log` — histórico

### Middleware
- [ ] Rotas `/admin/*` protegidas por middleware (sessão) — redirect `/login` se não autenticado
- [ ] Server component/layout admin chama `requireAdmin()` — bloqueia se não admin_users
- [ ] API routes `/api/admin/*` chamam `requireAdmin()` internamente
- [ ] Dupla proteção: middleware (sessão) + server component/API (admin_users gate)

### Testes (16+)
- [ ] requireAdmin com admin → OK (#1)
- [ ] requireAdmin com user comum → Forbidden (#2)
- [ ] requireAdmin sem auth → Unauthorized (#3)
- [ ] Grant com motivo válido → crédito + audit log (#4)
- [ ] Grant com motivo vazio → 400 (#5)
- [ ] Grant com storeId inválido → 404 (#6)
- [ ] Grant sem auth → 401 (#7)
- [ ] Grant com user não admin → 403 (#8)
- [ ] Mesmo operationId → idempotente (#9)
- [ ] Audit log registra dados corretos + operation_id (#10)
- [ ] Audit log é append-only (#11)
- [ ] Histórico cronológico (#12)
- [ ] Listagem de usuários (#13)
- [ ] Detalhe de usuário (#14)
- [ ] Campanhas com erro (#15)
- [ ] Audit log view (#16)

### Verificação final
- [ ] `npx vitest run src/lib/admin/__tests__/` — 3+ testes passando
- [ ] `npx vitest run src/app/api/admin/__tests__/` — 12+ testes passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — novos + 799 existentes passando
- [ ] `npm run build` — build bem-sucedido
- [ ] Nenhum endpoint existente quebrado (regressão)
- [ ] UAT local: admin concede crédito → saldo atualizado → audit log registrado

---

*Documento criado: 2026-07-17*
*Baseado no realinhamento da milestone v1.5 (D4 adiado, D11–D14 adicionados), exploração do estado atual do código (pós-F25), discussão entre dois agentes com decisões registradas.*
*Próximo passo: sua revisão e aprovação.*
