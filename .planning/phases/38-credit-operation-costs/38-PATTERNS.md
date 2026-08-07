# Phase 38: Tabela de Custos por Operação — Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 20 (7 new + 9 modified + 4 new tests)
**Analogs found:** 19 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql` | migration | CRUD/DDL | `supabase/migrations/20260716000001_create_credit_tables.sql` + `20260718000001_create_admin_tables.sql` | exact (compound) |
| `src/lib/credit/operation-cost-service.ts` | service | request-response | `src/lib/credit/credit-service.ts` | exact |
| `src/lib/credit/types.ts` (modify — add types) | model/types | — | existing `src/lib/credit/types.ts` | exact |
| `src/app/api/operation-costs/route.ts` | route | request-response | `src/app/api/admin/audit-log/route.ts` (GET) | role-match |
| `src/app/api/admin/operation-costs/route.ts` | route | CRUD (GET+PUT) | `src/app/api/admin/credits/grant/route.ts` (PUT-side) + `src/app/api/admin/reviews/route.ts` (GET-side w/ email join) | exact (compound) |
| `src/app/(app)/admin/operation-costs/page.tsx` | page/component | request-response | `src/app/(app)/admin/metrics/page.tsx` (server page) + `src/app/(app)/admin/users/[id]/credit-grant-form.tsx` (client form) | role-match (compound) |
| `src/hooks/use-operation-costs.ts` | hook | request-response | `src/components/flow/use-drift-detection.ts` (fetch) + `src/hooks/use-changelog-state.ts` (structure) | role-match |
| `src/lib/credit/__tests__/operation-cost-service.test.ts` | test | — | `src/lib/credit/__tests__/credit-service.test.ts` | exact |
| `src/app/api/operation-costs/__tests__/route.test.ts` | test | — | `src/app/api/admin/__tests__/credits-grant.test.ts` | exact |
| `src/app/api/admin/operation-costs/__tests__/route.test.ts` | test | — | `src/app/api/admin/__tests__/credits-grant.test.ts` | exact |
| `src/app/(app)/admin/operation-costs/__tests__/page.test.tsx` | test | — | `src/app/(app)/cadastro/cnpj/__tests__/page.test.tsx` (server) / `src/components/flow/__tests__/visual-signature-approval-modal.test.tsx` (client) | role-match |
| `src/lib/image-generation/config.ts` (remove `COST_PER_GENERATION`) | config | — | itself (lines 39–40) | exact |
| `src/app/api/campaign/generate-image/route.ts` | route | streaming | itself (lines 4, 222–235, 342–366) | exact |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` | route | streaming | itself (lines 169–192) | exact |
| `src/app/(app)/admin/layout.tsx` (add nav link) | layout | — | itself (lines 22–41) | exact |
| `src/components/flow/campaign-input-form.tsx` | component | request-response | itself (lines 491–511, 521–530) | exact |
| `src/components/credit/balance-card.tsx` | component | request-response | itself (line 63) | exact |
| `src/components/flow/drift-critical-modal.tsx` | component | request-response | itself (lines 113–121) | exact |
| `src/components/flow/visual-signature-approval-modal.tsx` | component | request-response | itself (lines 708–717) | exact |

---

## Pattern Assignments

### `supabase/migrations/20260807000001_f38_create_credit_operation_costs.sql` (migration, CRUD/DDL)

**Analogs:** `supabase/migrations/20260716000001_create_credit_tables.sql` (tables + triggers + RLS + SECURITY DEFINER RPCs + rollback) and `supabase/migrations/20260718000001_create_admin_tables.sql` (append-only audit + idempotent JSONB RPC).

**Table + scoped trigger pattern** (`create_credit_tables.sql:6-38`):
```sql
CREATE TABLE IF NOT EXISTS public.credit_balances (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_credit_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_balances_updated_at
BEFORE UPDATE ON public.credit_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_credit_balances_updated_at();

-- Enable Row Level Security
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

-- GRANT SELECT necessary for RLS to work with authenticated role
-- INSERT/UPDATE/DELETE grants explicitly omitted — mutations via SQL functions (service_role only)
GRANT SELECT ON TABLE public.credit_balances TO authenticated;
GRANT SELECT ON TABLE public.credit_balances TO service_role;
```

**Append-only audit trigger pattern** (`create_admin_tables.sql:48-59`) — for `credit_operation_cost_audit`:
```sql
CREATE OR REPLACE FUNCTION public.trg_admin_audit_log_immutable_fn()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log é append-only. Nenhum UPDATE ou DELETE é permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_admin_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.trg_admin_audit_log_immutable_fn();
```

**Idempotent JSONB RPC pattern** (`create_admin_tables.sql:67-145`) — for `admin_update_operation_cost` (SECURITY DEFINER + `SET search_path = ''` + idempotency by `operation_id` + same-transaction UPDATE + audit INSERT + JSONB return with `idempotent` flag):
```sql
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  p_actor_id UUID,
  p_store_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_operation_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_log RECORD;
  v_result JSONB;
BEGIN
  -- Step 1: Idempotency check — same operation_id returns existing data
  IF p_operation_id IS NOT NULL THEN
    SELECT id, action, metadata INTO v_existing_log
    FROM public.admin_audit_log
    WHERE operation_id = p_operation_id;

    IF FOUND THEN
      SELECT jsonb_build_object(
        'transaction_id', (v_existing_log.metadata ->> 'transaction_id'),
        'audit_id', v_existing_log.id,
        'idempotent', true,
        'newBalance', v_balance
      ) INTO v_result;
      RETURN v_result;
    END IF;
  END IF;

  -- Step 2: mutate + Step 3: insert audit in same transaction ...
  INSERT INTO public.admin_audit_log (
    actor_id, action, target_type, target_id, reason, operation_id, metadata
  ) VALUES (
    p_actor_id, 'credit_grant', 'store', p_store_id, p_reason, p_operation_id,
    jsonb_build_object('amount', p_amount, 'transaction_id', v_transaction_id)
  );

  SELECT jsonb_build_object(
    'transaction_id', v_transaction_id,
    'audit_id', (SELECT id FROM public.admin_audit_log WHERE operation_id = p_operation_id),
    'idempotent', false,
    'newBalance', v_balance
  ) INTO v_result;
  RETURN v_result;
END;
$$;
```

**Partial unique index for idempotency** (`create_credit_tables.sql:79-83`) — for `UNIQUE (operation_id) WHERE operation_id IS NOT NULL`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_idempotency
  ON public.credit_transactions (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**Migration comment/rollback style** — follow F36 header style (`20260801000001_f36_create_store_draft.sql:1-16`): Portuguese section headers `-- F38 — ...`, `-- ===========` rules, numbered blocks, and a final `-- REVERT` comment block listing `DROP FUNCTION`, `DROP TABLE`, `DROP TRIGGER`, `REVOKE`, `DROP INDEX` in reverse order (`create_admin_tables.sql:285-303`).

**Seeds pattern** (new — no existing analog; use `INSERT ... ON CONFLICT DO NOTHING` with `updated_by NULL` per D2):
```sql
INSERT INTO public.credit_operation_costs (operation_key, cost_credits, updated_by)
VALUES ('campaign_generation', 1, NULL)
ON CONFLICT (operation_key) DO NOTHING;
```

---

### `src/lib/credit/operation-cost-service.ts` (service, request-response — server-only)

**Analog:** `src/lib/credit/credit-service.ts`

**Imports + class pattern** (`credit-service.ts:1-9`):
```typescript
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { CreditOperationOptions, CreditTransaction } from "./types";

export class CreditService {
  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
  ) {}
```

**Core query pattern with error propagation** (`credit-service.ts:11-19`):
```typescript
  async getBalance(storeId: string): Promise<number> {
    const { data } = await this.client
      .from("credit_balances")
      .select("balance")
      .eq("store_id", storeId)
      .single();

    return data?.balance ?? 0;
  }
```

**RPC error propagation pattern** (`credit-service.ts:35-53`):
```typescript
  async reserveCredit(storeId: string, amount: number, opts?: CreditOperationOptions): Promise<string> {
    const { data, error } = await this.client.rpc("reserve_credit", {
      p_store_id: storeId,
      p_amount: amount,
      p_campaign_id: opts?.campaignId ?? null,
      p_idempotency_key: opts?.idempotencyKey ?? null,
      p_metadata: opts?.metadata ?? {},
    });

    if (error) {
      throw error;
    }
    return data as string;
  }
```

**F38-specific contract (D5 — no existing analog; defaults versioned in this module):**
```typescript
export const DEFAULT_OPERATION_COSTS: Record<OperationKey, { costCredits: number; enabled: boolean }> = {
  campaign_generation:         { costCredits: 1, enabled: true },
  visual_signature_generation: { costCredits: 1, enabled: true },
};
// getCost(key) → { operationKey, costCredits, enabled, source: "table" | "fallback" }
//   - SELECT sem linha (banco saudável) → fail-open com source:"fallback" + console.warn
//   - erro real (rede/banco/query)     → lança OperationCostUnavailableError (fail-closed, console.error)
```

**Custom error class pattern** (place `OperationCostUnavailableError` in this module or extend the `src/lib/auth/errors.ts` style — `errors.ts:1-6`):
```typescript
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
```

---

### `src/lib/credit/types.ts` (modify — model/types, no server-only)

**Analog:** existing `src/lib/credit/types.ts` (lines 1-42). Add D7/D6 types alongside existing zod + interfaces, keeping the no-server-only constraint:

```typescript
export const OPERATION_KEYS = ["campaign_generation", "visual_signature_generation"] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];

export interface OperationCostResolution {
  operationKey: OperationKey;
  costCredits: number;
  enabled: boolean;
  source: "table" | "fallback";
}

export interface OperationCostSnapshot {
  operation_key: OperationKey;
  operation_cost_credits: number;
  operation_cost_source: "table" | "fallback";
}
```

Existing file style: zod schema exports (`CreditTransactionSchema` lines 3-28) + plain interfaces (`CreditOperationOptions` lines 30-34, `CreditBalance` lines 36-41). Keep `OperationKey` as TS enum (no zod needed — route schemas live in `src/lib/admin/schemas.ts` per D9).

---

### `src/app/api/operation-costs/route.ts` (route, request-response — GET authenticated)

**Analog:** `src/app/api/admin/audit-log/route.ts` (simple `apiHandler` + supabase select + camelCase map + `NextResponse.json`).

**Imports + handler pattern** (`audit-log/route.ts:1-8`):
```typescript
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
```

For this route use `requireApiUser()` instead of `requireAdmin()` (`src/lib/auth/require-user.ts:40-42`):
```typescript
export async function requireApiUser(): Promise<AuthenticatedUser> {
  return requireUser();
}
```

**Row→camelCase response map pattern** (`audit-log/route.ts:36-53`):
```typescript
  const entries = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    actorId: row.actor_id,
    ...
  }));

  return NextResponse.json({ data: entries, total: count ?? 0, page, pageSize });
```

**503 fail-closed pattern (D5/D11 — resolve via `OperationCostService.getCost`, never expose `updated_by`/`updated_at`/`source`):**
```typescript
// GET /api/operation-costs
//   → 200 { "campaign_generation": { costCredits, enabled }, "visual_signature_generation": {...} }
//   → 503 { error: "operation_cost_unavailable", operationKey, message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }
//   → 401 via apiHandler (requireApiUser throws UnauthorizedError)
```
Response shape helper precedent: `src/app/api/store/[id]/visual-signature/route.ts:172-177` returns a flat JSONB object with snake_case flags for the client (`credit_balance`, `credits_charging_enabled`).

---

### `src/app/api/admin/operation-costs/route.ts` (route, CRUD — GET list + PUT update)

**Analog (PUT side):** `src/app/api/admin/credits/grant/route.ts` (requireAdmin + zod + RPC + apiHandler — exact pattern per D9).
**Analog (GET side):** `src/app/api/admin/reviews/route.ts` (email join for `updated_by`).

**Imports + full handler pattern** (`credits/grant/route.ts:1-22`):
```typescript
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GrantCreditsRequestSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { ZodError } from "zod";

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body;
  try {
    body = GrantCreditsRequestSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: err.errors },
        { status: 400 },
      );
    }
    throw err;
  }
```

**RPC call + error mapping pattern** (`credits/grant/route.ts:24-47`):
```typescript
  const { data, error } = await supabaseAdmin.rpc("admin_grant_credits", {
    p_actor_id: admin.userId,
    p_store_id: body.storeId,
    p_amount: body.amount,
    p_reason: body.reason,
    p_operation_id: body.operationId,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("store_not_found")) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as Record<string, unknown>;

  return NextResponse.json({
    transaction_id: result.transaction_id,
    audit_id: result.audit_id,
    idempotent: result.idempotent,
    newBalance: result.newBalance,
  });
```

**PUT response shape (D9):** `{ operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }` — mirror the camelCase→snake_case passthrough above.

**GET with email join pattern** (`reviews/route.ts:37-57`):
```typescript
  const userIds = [...new Set(data.map(s => s.user_id))];
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .in("id", userIds.length > 0 ? userIds : ["none"]);

  const userMap: Record<string, string> = {};
  for (const u of (users ?? [])) {
    userMap[u.id] = u.email;
  }
```
Then map rows to `{ operationKey, costCredits, enabled, updatedBy: userMap[row.updated_by] ?? null, updatedAt, source }` (D9). Note: `updated_by`/`updated_at` come from the RPC `GET` side or a direct table select — the PUT mutation must **always** go through the RPC, never a query-builder update (D9 "padrão financeiro").

**Zod schema (D7/D8/D9 — add to `src/lib/admin/schemas.ts`):** follow `GrantCreditsRequestSchema` style (`schemas.ts:3-8`):
```typescript
export const UpdateOperationCostRequestSchema = z.object({
  operationKey: z.enum([...OPERATION_KEYS]),   // D7: keys versioned in TS, validated in zod
  costCredits: z.number().int().positive("cost_credits deve ser > 0"),  // XOR com enabled
  enabled: z.boolean(),                         // XOR com costCredits
  reason: z.string().min(10, "Motivo deve ter no mínimo 10 caracteres").max(500),
  operationId: z.string().uuid().optional(),
}).refine((v) => (v.costCredits === undefined) !== (v.enabled === undefined), {
  message: "exatamente um campo mutável por chamada (costCredits XOR enabled)",
});
```

---

### `src/app/(app)/admin/operation-costs/page.tsx` (page/component, request-response)

**Analog (server shell):** `src/app/(app)/admin/metrics/page.tsx` (async server component + `requireAdmin` + `export const dynamic = "force-dynamic"`).
**Analog (client form):** `src/app/(app)/admin/users/[id]/credit-grant-form.tsx`.

**Server page guard + dynamic export** (`metrics/page.tsx:107-122`):
```tsx
export const dynamic = "force-dynamic";

export default async function AdminMetricsPage({ searchParams }: { ... }) {
  try {
    await requireAdmin();
  } catch {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
        Acesso negado. Apenas administradores podem acessar esta página.
      </div>
    );
  }
```

**Page header + nav layout style** (`metrics/page.tsx:192-211`): `space-y-8` root, `<h1 className="text-2xl font-bold text-foreground">`, `<p className="text-sm text-muted-foreground">`, `<section>` blocks with `border-b pb-2 text-lg font-semibold`.

**Client form pattern (reason obrigatório + PUT + loading/error/success)** (`credit-grant-form.tsx:1-57`):
```tsx
"use client";

import { useState, FormEvent } from "react";
import { Loader2 } from "lucide-react";

export function CreditGrantForm({ storeId, storeName }: { ... }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ newBalance: number } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    // client-side validation (amount ≥ 1, reason ≥ 10 chars)
    setLoading(true);
    try {
      const res = await fetch("/api/admin/credits/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, amount: parsed, reason: reason.trim(), operationId: crypto.randomUUID() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const data = await res.json();
      setSuccess({ newBalance: data.newBalance });
      setAmount(""); setReason("");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conceder créditos");
    } finally {
      setLoading(false);
    }
  }
```

Toggle switch: no existing switch analog in admin pages — use the native button/`input type="checkbox"` + conditional classes already used across the app (e.g., `campaign-input-form.tsx:493-499` color states). Badge for `source` uses `@/components/ui/badge` (used in `balance-display.tsx:3,39`).

---

### `src/hooks/use-operation-costs.ts` (hook, request-response — client fetch + cache)

**Analog (fetch + states):** `src/components/flow/use-drift-detection.ts:108-130`.
**Analog (hook structure/conventions):** `src/hooks/use-changelog-state.ts`.

**Client fetch with AbortController pattern** (`use-drift-detection.ts:108-119`):
```typescript
    const controller = new AbortController();

    fetch(`/api/store/${store.id}/visual-signature`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch visual signatures');
        return res.json();
      })
      .then(data => {
        setCreditBalance(typeof data.credit_balance === 'number' ? data.credit_balance : null);
        setCreditsChargingEnabled(!!data.credits_charging_enabled);
        ...
      });
```

**D11 contract — states must cover:** `loading` / `unavailable` (HTTP 503 — treat `!res.ok` with `status === 503` as unavailable, "Tente novamente em alguns instantes") / `loaded`. Return shape: `{ costs: Record<OperationKey, { costCredits, enabled }> | null, status: "loading" | "unavailable" | "loaded", refetch }`. Cache: module-level or state-level (no server cache; 1 read per request, no distributed cache per Deferred). `formatCredits` for pluralization comes from `balance-display.tsx:14-18` (duplicated in `balance-card.tsx:17-21` — extract once).

**Plural formatting pattern** (`balance-display.tsx:14-18`):
```typescript
function formatBalance(balance: number): string {
  if (balance <= 0) return "0 créditos";
  if (balance === 1) return "1 crédito";
  return `${balance} créditos`;
}
```

---

### Test files

### `src/lib/credit/__tests__/operation-cost-service.test.ts` (test)

**Analog:** `src/lib/credit/__tests__/credit-service.test.ts` — mock `@/lib/supabase/server` first (lines 1-8), table-dispatcher `mockFrom` (lines 12-27, 39-49), helper builders per query chain (lines 51-89), RPC success/error helpers (lines 75-89), UUID constants (lines 33-35):

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock supabase/server to prevent top-level env-var check on import.
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import { CreditService } from "../credit-service";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

const mockAdminClient = { from: mockFrom, rpc: mockRpc };

beforeEach(() => {
  vi.clearAllMocks();
  service = new CreditService(mockAdminClient as any);
  mockFrom.mockImplementation((table: string) => {
    if (table === "credit_balances") return { select: mockSelectBalance };
    if (table === "credit_transactions") return { select: mockSelectTx };
    return {};
  });
});
```

Test cases to mirror per D5/D7: linha inexistente → `source: "fallback"` com default; erro de leitura → lança `OperationCostUnavailableError` (fail-closed); getCost com linha → `source: "table"`; chaves desconhecidas rejeitadas (TS enum); invariantes (não expõe write methods — `credit-service.test.ts:489-494`).

### `src/app/api/operation-costs/__tests__/route.test.ts` + `src/app/api/admin/operation-costs/__tests__/route.test.ts` (test)

**Analog:** `src/app/api/admin/__tests__/credits-grant.test.ts` — mock `server-only`, `require-admin`, `@/lib/supabase/server`, build `NextRequest`, import route, assert status codes:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/auth/errors";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc },
}));

async function postGrant(body: Record<string, unknown>) {
  const { POST } = await import("../credits/grant/route");
  const req = new NextRequest(new Request("http://localhost/api/admin/credits/grant", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }));
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});
```

Status matrix to cover (from `credits-grant.test.ts`): 200 success + body fields; 400 zod invalid (lines 78-100); 500 RPC error (lines 120-134); 401 UnauthorizedError (lines 136-147); 403 ForbiddenError (lines 149-160); idempotent `idempotent: true` (lines 162-183). **Admin route extra (D8 XOR):** 400 when both `costCredits` and `enabled` sent; 400 when neither. **Public route extra (D5):** 503 when `OperationCostService` throws `OperationCostUnavailableError` (mock `@/lib/credit/operation-cost-service`); 401 not authenticated (`mockRequireApiUser.mockRejectedValue(new UnauthorizedError())`).

### `src/app/(app)/admin/operation-costs/__tests__/page.test.tsx` (test)

**Analog (server redirect test):** `src/app/(app)/cadastro/cnpj/__tests__/page.test.tsx` (mock `next/navigation` redirect + `NEXT_CONTROL` throw):
```typescript
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectFn = vi.fn();
const NEXT_CONTROL = new Error("NEXT_CONTROL");

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => { redirectFn(...args); throw NEXT_CONTROL; },
}));

it("redirects ...", async () => {
  const { default: Page } = await import("../page");
  await expect(Page({})).rejects.toThrow(NEXT_CONTROL);
  expect(redirectFn).toHaveBeenCalledWith("/dashboard");
});
```

**Analog (client component test):** `src/components/flow/__tests__/visual-signature-approval-modal.test.tsx` — `// @vitest-environment jsdom`, `@testing-library/jest-dom/vitest`, `render/screen/fireEvent/waitFor`, `createModalProps` factory (lines 1-18).

---

### Modified files

### `src/lib/image-generation/config.ts` (remove `COST_PER_GENERATION`)

Delete lines 39-40 (`// ─── Generation Cost ───` + `export const COST_PER_GENERATION = 1;`). Defaults move to `OperationCostService.DEFAULT_OPERATION_COSTS` (D5/D7).

### `src/app/api/campaign/generate-image/route.ts` (dynamic cost + guards + snapshot)

- **Line 4 import:** remove `COST_PER_GENERATION` from the `@/lib/image-generation/config` import; add `import { OperationCostService } from "@/lib/credit/operation-cost-service";`.
- **After guards, before balance check (~line 222):** resolve once per request per D12:
```typescript
  // ── Pre-stream: Resolve operation cost (D12) ───────────────────
  let cost: OperationCostResolution;
  try {
    cost = await new OperationCostService().getCost("campaign_generation");
  } catch (err) {
    if (err instanceof OperationCostUnavailableError) {
      logPipelineEvent({ event: "operation_cost_unavailable", traceId, phase: "pre_stream", status: "failed", storeId, userId: user.userId });
      return Response.json(
        { error: "operation_cost_unavailable", operationKey: "campaign_generation", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." },
        { status: 503 },
      );
    }
    throw err;
  }
  if (!cost.enabled) {
    return Response.json(
      { error: "operation_disabled", operationKey: cost.operationKey },
      { status: 503 },
    );
  }
```
- **Line 227:** `if (balance < cost.costCredits)` (substitute `COST_PER_GENERATION`).
- **Lines 347-351:** `reserveCredit(storeId, cost.costCredits, { campaignId, idempotencyKey: \`reserve_${campaignId}\`, metadata: { feature: "campaign_pipeline", operation_key: cost.operationKey, operation_cost_credits: cost.costCredits, operation_cost_source: cost.source } })`.

### `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` (dynamic cost + guards + snapshot)

- **Lines 172-192 (balance check + reserve):** resolve cost for `visual_signature_generation` at the same point; replace literal `1` at lines 176 (`if (balance < cost.costCredits)`) and 186 (`reserveCredit(id, cost.costCredits, { campaignId: null, idempotencyKey: \`vs_reserve_${id}_${operationId}\`, metadata: { feature: "visual_signature", mode, operationId, operation_key: cost.operationKey, operation_cost_credits: cost.costCredits, operation_cost_source: cost.source } })`).
- Add `enabled=false → 503 operation_disabled` guard **always** (independent of `creditsEnabled`, per D4) and `503 operation_cost_unavailable` on `OperationCostUnavailableError`.
- **Lines 362-369 (metadata snapshot):** the success-path `updatedMetadata` already appends `credit_tx_id`; append `operation_key`, `operation_cost_credits`, `operation_cost_source` alongside (D6).
- **Note on `creditsEnabled` (line 170):** `launchConfig.v15Enabled && launchConfig.creditsChargingEnabled` gates balance+reserve — keep, but the `enabled`/availability guard must run before it (D4).

### `src/app/(app)/admin/layout.tsx` (nav link)

Insert after line 33 (`Métricas` link) or before line 35 (`audit-log`):
```tsx
<Link href="/admin/operation-costs" className="font-medium hover:text-primary">
  Custos por operação
</Link>
```

### `src/components/flow/campaign-input-form.tsx` (dynamic cost)

- **Lines 501-506:** replace `<span>Custo: 1</span>` with `Custo: {cost.costCredits}` from `useOperationCosts()`; if `cost.enabled === false` show unavailable message and disable submit; if status `unavailable` show "Tente novamente em alguns instantes" (D11).
- **Line 523:** extend `disabled` with `cost.enabled === false || costStatus === "unavailable"`.
- **Line 126:** `"Gerar consome 1 geração."` — no cost change required unless cost display there is desired (leave as-is; D11 only lists lines 505/Custo).

### `src/components/credit/balance-card.tsx` (dynamic description)

- **Line 63:** `description: "Cada geração consome 1 crédito."` → `"Cada geração consome {cost} crédito(s)."` via hook + `formatCredits` (D11). Component is `"use client"` (line 1) — hook can be called directly.

### `src/components/flow/drift-critical-modal.tsx` (dynamic description)

- **Lines 118-119:** `"visual. Cada geração consome 1 crédito."` → dynamic cost via hook (D11). Component is client (`"use client"`).

### `src/components/flow/visual-signature-approval-modal.tsx` (dynamic description)

- **Line 716:** `"Cada geração de assinatura visual consome 1 crédito."` → dynamic cost via hook (D11). Component is client.

---

## Shared Patterns

### Authentication — Admin (`src/lib/admin/require-admin.ts:6-20`)
**Apply to:** `src/app/api/admin/operation-costs/route.ts`, `src/app/(app)/admin/operation-costs/page.tsx`, admin layout.
```typescript
export async function requireAdmin(): Promise<{ userId: string }> {
  const { userId } = await requireApiUser();

  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    throw new ForbiddenError("Acesso restrito a administradores");
  }
  return { userId };
}
```

### Authentication — Public-authenticated (`src/lib/auth/api-handler.ts:6-17` + `src/lib/auth/require-user.ts:40-42`)
**Apply to:** `src/app/api/operation-costs/route.ts`, generation routes.
```typescript
export function apiHandler(handler: RouteHandler): RouteHandler {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ForbiddenError) return forbidden(error.message);
      if (error instanceof UnauthorizedError) return unauthorized(error.message);
      if (error instanceof StoreNotFoundError) return notFound(error.message);
      throw error;
    }
  };
}
```

### RPC mutation pattern (financeiro — never query-builder writes)
**Source:** `src/app/api/admin/credits/grant/route.ts:24-47` + `src/app/api/admin/credits/grant/route.ts` RPC `admin_grant_credits` (`20260718000001_create_admin_tables.sql:67-145`).
**Apply to:** `admin/operation-costs` PUT; **do not** touch `reserve_credit` RPC (D6).

### 503 error contract (D4/D5)
**Apply to:** both generation routes + public costs route.
- `503 { error: "operation_disabled", operationKey }` — availability, **always** evaluated (even freemium).
- `503 { error: "operation_cost_unavailable", operationKey, message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }` — fail-closed on real read errors, **no** reserve/generation.
- `402` remains balance-insufficient only.

### Logging (pipeline observability)
**Source:** `src/lib/logging/pipeline-logger` `logPipelineEvent` (used throughout `generate-image/route.ts:208-217`). Resolve-cost step should emit `operation_cost_resolve` events (`phase: "pre_stream"`); fallback → `console.warn`, unavailable → `console.error` (D5).

### Existing tests that will break (planner MUST include updates)
- `src/app/api/campaign/generate-image/__tests__/route.test.ts:47` mocks `COST_PER_GENERATION: 1` in `vi.mock("@/lib/image-generation/config", ...)` — replace with `OperationCostService` mock.
- `src/__tests__/concurrency.test.ts:44`, `src/__tests__/regression-master-switch.test.ts:44`, `src/__tests__/api/campaign-generate.test.ts:160` reference `COST_PER_GENERATION` — update config mocks.
- `src/components/flow/__tests__/visual-signature-approval-modal.test.tsx:241` and `src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts:466` assert the literal `"Cada geração ... consome 1 crédito."` strings — update to dynamic cost.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/hooks/use-operation-costs.ts` (fetch de endpoint de custo com estados loading/unavailable) | hook | request-response | No existing hook fetches a costs endpoint with 503-unavailable semantics; use-drift-detection is closest (partial match). Planner should follow D11 contract + use-drift-detection fetch pattern. |
| Seeds `INSERT ... ON CONFLICT DO NOTHING` em `credit_operation_costs` | migration | — | No existing seed migration uses ON CONFLICT DO NOTHING for config rows; follow D2 spec (pattern trivial, modeled above). |

## Metadata

**Analog search scope:** `src/lib/credit/`, `src/lib/admin/`, `src/lib/auth/`, `src/lib/image-generation/`, `src/lib/launch-config/`, `src/app/api/admin/**`, `src/app/api/store/[id]/visual-signature/**`, `src/app/api/campaign/generate-image/**`, `src/app/(app)/admin/**`, `src/components/flow/**`, `src/components/credit/**`, `src/hooks/`, `supabase/migrations/`
**Files scanned:** ~45 (28 migrations + 17 source/test)
**Pattern extraction date:** 2026-08-07
