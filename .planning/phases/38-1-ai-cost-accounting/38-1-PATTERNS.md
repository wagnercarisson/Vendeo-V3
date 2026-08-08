# Phase 38.1: Apuração de Custos de IA por Entrega — Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 30 (8 new + 13 modified code + 6 new tests + 3 modified tests)
**Analogs found:** 26 / 30 (6 pattern gaps flagged — see "No Analog Found")

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql` | migration | CRUD/DDL | `20260807000001_f38_create_credit_operation_costs.sql` (table+trigger+RLS+RPC+seeds) + `20260718000002_expand_generation_events.sql` (ALTER+CHECK) + `20260731000001_admin_test_store_filter.sql` (JSONB RPC aggregation) | exact (compound) |
| `src/lib/ai-cost/types.ts` (new) | model/types | — | `src/lib/credit/types.ts` (const-array enums + plain interfaces, no server-only) | exact |
| `src/lib/ai-cost/tracker.ts` (new) | service | request-response (write) | `src/lib/visual-signature/generation-events.ts` (best-effort insert) + `src/lib/credit/credit-service.ts` (injectable client class) | partial (compound — new pattern: startRun) |
| `src/lib/ai-cost/ai-model-pricing.ts` (new) | service | request-response (read + defaults) | `src/lib/credit/operation-cost-service.ts` (DEFAULT_* + table read + fail-open fallback) | exact |
| `src/lib/ai-cost/index.ts` (modify) | barrel | — | itself (lines 1-2) | exact |
| `src/lib/ai-cost/cost-estimator.ts` (refactor) | utility | transform | itself — `estimateAiCost` → `resolveAiCost` (keep `normalizeModel`, token math) | exact |
| `src/lib/ai-cost/legacy-estimator.ts` (new) | utility | transform (sync) | itself — old `estimateAiCost` contract moved intact (sync, `@deprecated`, local fallback) | exact |
| `src/app/api/admin/ai-model-pricing/route.ts` (new) | route | CRUD (GET+PUT) | `src/app/api/admin/operation-costs/route.ts` (GET list + PUT RPC + zod + apiHandler) | exact |
| `src/app/api/admin/ai-costs/route.ts` (new) | route | request-response (RPC passthrough) | `src/lib/metrics/pipeline-metrics.ts:53-57` (rpc call w/ p_* params) + `src/app/api/admin/audit-log/route.ts:10-17` (searchParams filters) | role-match (compound) |
| `src/app/api/campaign/generate-image/route.ts` | route | streaming | itself (lines 31, 41, 221-243, 348, 555-663, 717-735) | exact |
| `src/lib/image-generation/services/image-generation-service.ts` | service | streaming | itself (`onMetricsEvent` lines 92-110, attempt loop 268-528) | exact |
| `src/lib/image-generation/services/input-validation-service.ts` | service | request-response | itself (`callVisionModel` lines 63-95) | exact |
| `src/lib/image-generation/services/image-review-service.ts` | service | request-response | itself (`callVisionModel` lines 183-220) | exact |
| `src/lib/copy/copy-director-service.ts` | service | request-response | itself (`generateCopy` lines 59-98 + `TextProviderResult.usage`) | exact |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` | route | streaming | itself (lines 172-222, 377-431, 449-483) | exact |
| `src/lib/visual-signature/ai-image-generator.ts` | service | request-response | itself (`generate` lines 118-281, `validateSemantic` 37-108) | exact |
| `src/lib/visual-signature/generation-events.ts` | utility | request-response | itself (lines 4-24 — becomes tracker delegate) | exact |
| `src/lib/visual-signature/brand-profiler.ts` | service | request-response | itself (`callVision`/`callVisionFull` lines 702-743) | exact |
| `src/lib/brand-assets/brand-director.ts` | service | request-response | itself (OpenAI vision call, `BrandDirectorAnalysisError` metadata pattern lines 13-26) | exact |
| `src/lib/brand-assets/text-only-inference-service.ts` | service | request-response | itself (`infer` lines 22-137, `BrandTextOnlyInferenceError` metadata) | exact |
| Rotas `/api/store/[id]/brand-profile/*` (route.ts, generate-without-logo, infer, realign) | route | request-response | `generate-without-logo/route.ts` best-effort `insertGenerationEvent` pattern | role-match (instrumenting from zero) |
| `src/lib/campaign/persistence.ts` (`createCampaign`) | utility | CRUD | itself (lines 5-29 — add `operation_run_id` to insert) | exact |
| `src/lib/ai-cost/__tests__/cost-estimator.test.ts` (modify) | test | — | itself (lines 1-200) | exact |
| `src/lib/ai-cost/__tests__/tracker.test.ts` (new) | test | — | `src/lib/credit/__tests__/operation-cost-service.test.ts` (mock supabase/server + table-dispatcher) | exact |
| `src/app/api/campaign/generate-image/__tests__/route.test.ts` (modify) | test | — | itself (vi.mock config/service mocks, lines 30-147, 205) | exact |
| `src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts` (modify) | test | — | itself (mock `insertGenerationEvent` lines 49, 59-60) | exact |
| `src/app/api/admin/ai-model-pricing/__tests__/route.test.ts` (new) | test | — | `src/app/api/admin/operation-costs/__tests__/route.test.ts` (lines 1-239) | exact |
| `src/app/api/admin/ai-costs/__tests__/route.test.ts` (new) | test | — | `operation-costs/__tests__/route.test.ts` GET-side (lines 78-129) | exact |
| Testes brand profile (realign-route.test.ts, route.test.ts) (modify) | test | — | themselves | exact |
| Verificação SQL/integrada I1-I6 (views/RPC real-DB tests, new) | test | — | `src/lib/credit/__tests__/operation-cost-service.integration.test.ts` (.env.local loader + real Supabase) | role-match |
| `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `ROADMAP.md` (root) | doc/tracking | — | `.planning/STATE.md` F38 section + F38.1 runbook in design.md D1 | exact (self-doc) |

---

## Pattern Assignments

### `supabase/migrations/20260808000001_f38_1_create_ai_cost_accounting.sql` (migration, CRUD/DDL)

**Analogs:** `20260807000001_f38_create_credit_operation_costs.sql` (F38 — table + scoped trigger + RLS service_role only + idempotent JSONB RPC + seeds + REVERT), `20260718000002_expand_generation_events.sql` (F28 — ALTER generation_events + CHECK replacement), `20260731000001_admin_test_store_filter.sql:130-355` (admin_get_metrics JSONB aggregation RPC), `20260718000001_create_admin_tables.sql` (append-only audit trigger).

**Header style** (`f38_create_credit_operation_costs.sql:1-21`): Portuguese comment block with `-- F38.1 — ...`, `-- =====` rule, goal summary, "Regras:" bullets, and numbered "Blocos:" 1..N mapping to section headers.

**Table + scoped trigger + RLS service_role-only pattern** (`f38_create_credit_operation_costs.sql:26-47` + `:87-94`) — for `ai_model_pricing` (task 1.4):
```sql
CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              TEXT NOT NULL,
  model                 TEXT NOT NULL,
  input_token_usd_per_1m        NUMERIC,
  ...
  CONSTRAINT chk_ai_model_pricing_at_least_one_price CHECK (
    input_token_usd_per_1m IS NOT NULL
    OR output_token_usd_per_1m IS NOT NULL
    OR cached_input_token_usd_per_1m IS NOT NULL
    OR image_unit_usd IS NOT NULL
    OR image_token_usd_per_1m IS NOT NULL
  )
);

-- Specific trigger function for this table (NOT a generic one per project convention)
CREATE OR REPLACE FUNCTION public.update_ai_model_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_model_pricing_updated_at
BEFORE UPDATE ON public.ai_model_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_model_pricing_updated_at();

ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_model_pricing FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_model_pricing TO service_role;
```
Note: D8 says `authenticated` must NOT read pricing — `REVOKE ALL` (not `GRANT SELECT`), exactly as F38 did for `credit_operation_costs` (`f38:90-94`).

**ALTER generation_events + CHECK replacement pattern** (`20260718000002_expand_generation_events.sql:6-42`) — exact template for D2 (task 1.1-1.2). Step 1 drop old constraint, Step 2 add expanded one, Step 3 add nullable columns one per `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`:
```sql
ALTER TABLE public.generation_events
DROP CONSTRAINT IF EXISTS chk_generation_events_type;

ALTER TABLE public.generation_events
ADD CONSTRAINT chk_generation_events_type
CHECK (generation_type IN (
  'campaign_pipeline','campaign_copy','campaign_input_validation',
  'campaign_image','campaign_image_review',
  'visual_signature','visual_signature_image','visual_signature_validation',
  'brand_profile_without_logo','brand_profile_with_logo',
  'brand_profile_vision','brand_profile_text'
));

ALTER TABLE public.generation_events
ADD COLUMN IF NOT EXISTS operation_run_id UUID;
-- ... one ADD COLUMN IF NOT EXISTS per new column (D2), incl.
-- ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS operation_run_id UUID; (D1/D2)
```
New CHECK for cost_source (D4): `chk_generation_events_cost_source` — follow the same `ADD CONSTRAINT ... CHECK (cost_source IN (...))` shape.

**New indexes** (task 1.3) — follow F38 partial-unique-index style (`f38:66-69`) and simple index style (`create_admin_tables.sql:37-46`):
```sql
CREATE INDEX IF NOT EXISTS idx_generation_events_operation_run_id ON public.generation_events(operation_run_id);
CREATE INDEX IF NOT EXISTS idx_generation_events_visual_signature_id ON public.generation_events(visual_signature_id);
CREATE INDEX IF NOT EXISTS idx_generation_events_operation_run_type ON public.generation_events(operation_run_type);
CREATE INDEX IF NOT EXISTS idx_generation_events_cost_source ON public.generation_events(cost_source);
CREATE INDEX IF NOT EXISTS idx_generation_events_provider_model ON public.generation_events(provider, model);
CREATE INDEX IF NOT EXISTS idx_campaigns_operation_run_id ON public.campaigns(operation_run_id);
```

**Idempotent JSONB RPC — transactional versioning pattern** (`f38_create_credit_operation_costs.sql:102-232`) — for `admin_set_ai_model_price` (task 1.6). Copy the full skeleton: `SECURITY DEFINER` + `SET search_path = ''` + `RETURNS JSONB` + `DECLARE`/`BEGIN`/`RETURN v_result` + `RAISE EXCEPTION '...'` validation + `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;` (lines 229-232). Key differences for pricing (D8): `p_reason TEXT` goes BEFORE the `DEFAULT NULL` params (Postgres signature rule), and the transaction closes the current row (`UPDATE ... SET effective_until = now() WHERE provider=p_provider AND model=p_model AND effective_until IS NULL`) then INSERTs the new row (`effective_from = now()`) in the same function body — same-transaction pattern as `admin_update_operation_cost` Step 4+5 (lines 171-213). Return `jsonb_build_object('id', v_new_id, 'provider', ..., 'previous_id', v_prev_id)`.

**Seeds pattern** (`f38:237-241` `INSERT ... ON CONFLICT DO NOTHING`) — for ai_model_pricing seeds (task 1.5), `updated_by NULL`, `effective_until NULL`, each row with `source_url`/`source_note`/`effective_from`:
```sql
INSERT INTO public.ai_model_pricing
  (provider, model, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m, effective_from, source_url, source_note)
VALUES
  ('openai', 'gpt-4o', 2.50, 10.00, NULL, NULL, NULL, '2026-08-08T00:00:00Z', '<url-fonte>', 'bootstrap F38.1'),
  ('openai', 'gpt-image-2', NULL, NULL, NULL, 0.040, NULL, '2026-08-08T00:00:00Z', '<url-fonte>', 'bootstrap F38.1'),
  ...
ON CONFLICT (provider, model) WHERE effective_until IS NULL DO NOTHING;
```
> **Divergence from F38 seed (RESOLVED):** `ai_model_pricing` PK is `id UUID`, not a natural key — but a full-table `UNIQUE (provider, model)` constraint would BREAK D8 versioning (the RPC closes the active row via `effective_until = now()` then INSERTs a new row with the SAME `(provider, model)`). Use the F38 partial-unique-index idiom instead (`f38_create_credit_operation_costs.sql:66-69`): `CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_pricing_vigente ON public.ai_model_pricing(provider, model) WHERE effective_until IS NULL;` — enforces ≤1 active row per provider/model while leaving history (effective_until NOT NULL) free. `ON CONFLICT (provider, model) WHERE effective_until IS NULL DO NOTHING` in the seeds targets that partial index.

**JSONB aggregation RPC pattern** (`20260731000001_admin_test_store_filter.sql:138-353`) — for `admin_get_ai_costs` (task 1.9): `SECURITY DEFINER` + `SET search_path=''` + optional `p_*` filters with `DEFAULT` + `v_cutoff := NOW() - (p_hours || ' hours')::INTERVAL` + CTEs (`filtered_ge AS (...) WHERE ge.generation_type ... AND ge.created_at >= v_cutoff`) + `COUNT(*) FILTER (WHERE status = 'success')` + `jsonb_build_object(...)` assembled into one bundle. Use `COALESCE(provider_reported_cost_usd, estimated_cost_usd)` for the accounting value (D3) and filter out delivery `generation_type`s (D1/D6/D10). `admin_get_metrics` itself (lines 136-353) must remain untouched (D10).

**Append-only audit trigger** — NOT needed by 38.1 (no new audit table; versioning via `effective_until`). For reference if the planner wants an audit trail: `create_admin_tables.sql:48-59` / `f38:71-82` immutable trigger pattern.

**Views (`admin_ai_*`, `admin_cost_vs_credits`)** — **NO ANALOG** (no `CREATE VIEW` exists in any migration — verified via grep). Flagged in No Analog Found. Model the SQL after the CTE/aggregation style inside `admin_get_metrics` (window CTEs + `COUNT FILTER` + `jsonb_build_object`), written as `CREATE VIEW`/`CREATE OR REPLACE VIEW public.admin_ai_operation_costs AS SELECT ...`. Reconciliação (`admin_cost_vs_credits`) joins `credit_transactions` with `type='deduction'` + `metadata->>'feature'='campaign_pipeline'` and `store_visual_signatures.metadata->>'credit_tx_id'` — the `metadata->>'feature'` filter style already exists in `admin_get_metrics` (`20260731000001:252, 300, 309`).

**REVERT comment block** — required per task 1.10 (`f38:244-256`, `create_admin_tables.sql:286-303`): comment-only, reverse order, one `DROP` per object (`DROP FUNCTION admin_set_ai_model_price`, `DROP FUNCTION admin_get_ai_costs`, `DROP VIEW admin_ai_*` ×6, `DROP TRIGGER trg_ai_model_pricing_updated_at`, `DROP FUNCTION update_ai_model_pricing_updated_at`, `DROP TABLE ai_model_pricing`, `DROP INDEX idx_campaigns_operation_run_id`, `DROP INDEX idx_generation_events_*` ×5, `ALTER TABLE generation_events DROP COLUMN ...` ×9, `DROP CONSTRAINT chk_generation_events_cost_source`, restore old `chk_generation_events_type`).

---

### `src/lib/ai-cost/types.ts` (new — model/types, no server-only)

**Analog:** `src/lib/credit/types.ts` — const-array enums + plain interfaces, imported by zod schemas and services without pulling `server-only`. Follow the exact F38 style (`credit/types.ts:44-62`):

```typescript
export const COST_SOURCES = [
  "provider_reported", "pricing_table", "fallback_static",
  "manual_unknown", "not_available",
] as const;
export type CostSource = (typeof COST_SOURCES)[number];

export const OPERATION_RUN_TYPES = [
  "campaign_delivery", "visual_signature", "brand_profile", "theme",
] as const;
export type OperationRunType = (typeof OPERATION_RUN_TYPES)[number];

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  imageTokens?: number;
}

export interface CostResolution {
  estimatedCostUsd: number | null;
  providerReportedCostUsd?: number | null;
  costSource: CostSource;
  pricingVersion?: string | null;
}

export interface AiCallInfo {
  provider: string;
  model: string;
  usage?: TokenUsage;
  durationMs: number;
  providerReportedCostUsd?: number | null;
}

export interface AiCostEvent { /* spec ai-cost-tracker lines 59-78 */ }
```
`GenerationEventType`/`GenerationEventStatus` live in `src/lib/visual-signature/types.ts:98-100` (currently only 3 values) — the new call-level types (`campaign_input_validation`, `campaign_image_review`, `visual_signature_image`, `visual_signature_validation`, `brand_profile_vision`, `brand_profile_text`) must be **added there** (D5) so `AiCostEvent.generationType` can reference them; do not duplicate the enum in `ai-cost/types.ts`.

---

### `src/lib/ai-cost/tracker.ts` (new — service, best-effort write)

**Analogs:** `src/lib/visual-signature/generation-events.ts` (best-effort never-throw insert — the pattern `record` must copy) + `src/lib/credit/credit-service.ts` (injectable `SupabaseClient` constructor). Partial analog — `startRun` run-context generation is **new**.

**Imports + class shell** (`credit-service.ts:1-9` + `generation-events.ts:1-2`):
```typescript
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AiCostEvent, OperationRunType } from "./types";

export class AiCostTracker {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  startRun(type: OperationRunType): { operationRunId: string; traceId: string } {
    // D1: distinct UUIDs — crypto.randomUUID() for each
  }

  async record(event: AiCostEvent): Promise<void> {
    // best-effort — never throws (D7)
  }
}
```

**Best-effort never-throw body** (`generation-events.ts:4-24`):
```typescript
  async record(event: AiCostEvent): Promise<void> {
    try {
      const { error } = await this.client.from("generation_events").insert({
        // map AiCostEvent → snake_case row (all D2 columns):
        operation_run_id: event.operationRunId,
        operation_run_type: event.operationRunType,
        trace_id: event.traceId,
        visual_signature_id: event.visualSignatureId ?? null,
        generation_type: event.generationType,
        status: event.status,
        attempt_number: event.attemptNumber,
        duration_ms: event.durationMs,
        provider: event.provider,
        model: event.model,
        // tokens: event.tokens ?? null → prompt/completion/total/cached_input/image_tokens
        // cost: event.cost → estimated_cost_usd, provider_reported_cost_usd, cost_source, pricing_version
        metadata: event.metadata ?? null,
      });
      if (error) {
        console.error("[AiCostTracker] record failed (best-effort):", error.message);
      }
    } catch (err) {
      console.error("[AiCostTracker] record exception (best-effort):", err);
    }
  }
```
Delivery marker rule (D1/D6): when `event.cost` is undefined and no `tokens`, insert `estimated_cost_usd: null`, `provider_reported_cost_usd: null`, token columns null, and set `metadata.duration_is_pipeline = true` in the row metadata.

**Usage/propagation context:** route calls `startRun("campaign_delivery")` then passes `{ operationRunId, traceId }` through `opts.telemetry` — there is no existing telemetry-context object in the codebase; the closest propagation precedent is `traceId` flowing through `generate-image/route.ts:41` into `logPipelineEvent` calls and the telemetry inserts (lines 595-663). This `telemetry` option object is a small **new pattern** (flag).

---

### `src/lib/ai-cost/ai-model-pricing.ts` (new — service, defaults + table read)

**Analog:** `src/lib/credit/operation-cost-service.ts` — DEFAULT const map + `getCost` read-with-fallback + `getAllCosts` merge. Copy the structure exactly:

```typescript
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

// Bootstrap defaults — used when the table has no row (fail-open, D8)
export const DEFAULT_AI_MODEL_PRICING: Record<string, Record<string, PricingRow>> = {
  openai: {
    "gpt-4o":   { inputTokenUsdPer1M: 2.50, outputTokenUsdPer1M: 10.0 },
    "gpt-image-2": { imageUnitUsd: 0.04 },
    ...
  },
  gemini: {
    "gemini-2.0-flash": { inputTokenUsdPer1M: 0.10, outputTokenUsdPer1M: 0.40 },
    "gemini-3.1-flash-lite": { inputTokenUsdPer1M: 0.10, outputTokenUsdPer1M: 0.40 }, // furo 3
  },
};

export class AiModelPricingService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async getCurrent(provider: string, model: string): Promise<{ row: PricingRow; id: string } | null> {
    const { data, error } = await this.client
      .from("ai_model_pricing")
      .select("id, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m")
      .eq("provider", provider)
      .eq("model", model)
      .is("effective_until", null)   // vigente (D8)
      .maybeSingle();
    if (error) {
      console.error("[ai-model-pricing] getCurrent error", error.message);
      // D8 fail-open: caller falls through to code defaults (same as operation-cost-service fail-open, lines 49-61)
      return null;
    }
    if (!data) return null;
    return { row: mapRow(data), id: data.id };
  }
}
```
Fail-open semantics: a healthy query with no row → `null` (caller uses `DEFAULT_AI_MODEL_PRICING`); a real DB error → log + `null` (do NOT throw — cost accounting never blocks generation, D8/D7). This differs from `OperationCostService.getCost` which throws `OperationCostUnavailableError` (fail-closed) — the planner must decide: D8 "fail-open equivalente ao padrão F38 D5" → follow the D5-style fail-open, i.e. `null` on both.

---

### `src/lib/ai-cost/cost-estimator.ts` (refactor — estimateAiCost → resolveAiCost) + `legacy-estimator.ts`

**Analog:** itself (lines 1-111). Keep `normalizeModel` (lines 50-52), the per-token math (lines 75-84, 100-104), `getFallbackCost` env fallback (lines 27-34, rename env to `VENDEO_AI_FALLBACK_COST_USD` per D9) — but replace the static `OPENAI_PRICING`/`GEMINI_PRICING` Records (lines 12-22) with a lookup against `AiModelPricingService.getCurrent` + `DEFAULT_AI_MODEL_PRICING` bootstrap, and replace the `AiCostEstimate { estimatedCostUsd, source }` contract with `CostResolution`:

```typescript
export async function resolveAiCost(params: {
  provider: string;
  model: string;
  usage?: TokenUsage;
  providerReportedCostUsd?: number | null;
}): Promise<CostResolution> {
  // D9 chain: provider_reported → pricing_table (table row, then code default) → fallback_static → not_available
}
```

**Legacy wrapper (NEW file `legacy-estimator.ts`):** the old `estimateAiCost` (sync, `@deprecated`) MOVES out of `cost-estimator.ts` — together with `AiCostEstimate`, `PricingTier`, `OPENAI_PRICING`, `GEMINI_PRICING`, `getFallbackCost` (reads `VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD`), `isKnownTextModel`/`KNOWN_TEXT_MODELS`. It stays **synchronous with local fallback/defaults** and does **NOT** call `resolveAiCost` (which is async). Reason: `generate-image/route.ts:593,614` still calls `estimateAiCost` synchronously until 38-1-07 replaces them; a sync wrapper cannot await an async resolver without breaking the callers' types. The barrel re-exports `estimateAiCost` from `legacy-estimator.ts`.

> **Async note:** `resolveAiCost` becomes async (table read). New callers (tracker-driven callbacks in the route, 38-1-05/06/07) use `await`. Existing tests (`cost-estimator.test.ts`) must be adapted (task 2.7): drop `source` string assertions (`openai_published_pricing` etc.), assert `costSource: "pricing_table"|"fallback_static"|"not_available"` + `pricingVersion` (`uuid`|`'code_default'`|null) instead. Legacy wrapper behavior is preserved by `legacy-estimator.test.ts`.

---

### `src/lib/ai-cost/index.ts` (barrel)

Extend from itself (lines 1-2) to export `resolveAiCost`, `CostResolution`, `AiCostTracker`, `AiCostEvent`, `AiCallInfo`, `TokenUsage`, `CostSource`, `OperationRunType`, `DEFAULT_AI_MODEL_PRICING`, `AiModelPricingService`.

---

### `src/app/api/admin/ai-model-pricing/route.ts` (new — admin CRUD, GET list + PUT RPC)

**Analog:** `src/app/api/admin/operation-costs/route.ts` (lines 1-110) — exact copy. GET = `requireAdmin` + `apiHandler` + list (with `source`/email join if `updated_by` present, mirroring lines 28-57) returning `{ prices: [...] }` (spec ai-model-pricing lines 139-158). PUT = zod parse → 400 (`ZodError`, lines 63-74) → `supabaseAdmin.rpc("admin_set_ai_model_price", { p_actor_id, p_provider, p_model, p_input, p_output, p_reason, p_cached, p_image_unit, p_image_token, p_source_url, p_source_note })` → error mapping 400/500 (lines 88-99) → passthrough `{ id, provider, model, effective_from, previous_id }` (spec lines 160-192).

**Zod schema** — add to `src/lib/admin/schemas.ts` next to `UpdateOperationCostRequestSchema` (lines 11-25), importing enums from `@/lib/credit/types` style. Field names canonical per 38-1-03 (`*CostUsd` naming — maps to RPC `p_*` params):
```typescript
export const AiModelPricingUpdateSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  inputCostUsd: z.number().nonnegative().optional(),
  outputCostUsd: z.number().nonnegative().optional(),
  cachedInputCostUsd: z.number().nonnegative().optional(),
  imageUnitCostUsd: z.number().nonnegative().optional(),
  imageTokenCostUsd: z.number().nonnegative().optional(),
  sourceUrl: z.string().url().optional(),
  sourceNote: z.string().optional(),
  reason: z.string().min(1),   // obrigatório (D8)
}).refine((v) => [v.inputCostUsd, v.outputCostUsd, v.cachedInputCostUsd, v.imageUnitCostUsd, v.imageTokenCostUsd].some(x => x !== undefined), {
  message: "pelo menos uma dimensão de preço",   // espelha CHECK chk_ai_model_pricing_at_least_one_price
});
```

---

### `src/app/api/admin/ai-costs/route.ts` (new — admin GET RPC passthrough)

**Analog (RPC call):** `src/lib/metrics/pipeline-metrics.ts:53-57`. **Analog (searchParams filters):** `src/app/api/admin/audit-log/route.ts:10-17,23-26`.

```typescript
export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const hours = Math.max(1, parseInt(searchParams.get("hours") ?? "24", 10));
  const { data, error } = await supabaseAdmin.rpc("admin_get_ai_costs", {
    p_operation_run_id: searchParams.get("operation_run_id") || null,
    p_campaign_id: searchParams.get("campaign_id") || null,
    p_store_id: searchParams.get("store_id") || null,
    p_user_id: searchParams.get("user_id") || null,
    p_provider: searchParams.get("provider") || null,
    p_model: searchParams.get("model") || null,
    p_generation_type: searchParams.get("generation_type") || null,
    p_hours: hours,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ aggregations: data });
});
```

---

### `onCall` callback pattern — services that call IA (7 files)

**Pattern to apply (all same shape, from spec ai-cost-tracker lines 96-117):**
```typescript
onCall?: (info: AiCallInfo) => void
```
Invoke once after the real AI call with `{ provider, model, usage, durationMs, providerReportedCostUsd? }`. Optional + retrocompatible: when absent, behavior identical. The closest existing instrumentation analog is `onMetricsEvent` in `image-generation-service.ts:92-110` (optional callback, `if (onX) onX({...})`), and the `elapsedMs = Date.now() - startTime` timing pattern already used in `ai-image-generator.ts:129,255` and `text-only-inference-service.ts:23,97`.

Per-file insertion points (all analog = the file itself):

| File | Insertion point | Data to expose |
|---|---|---|
| `src/lib/copy/copy-director-service.ts` | after `this.provider.generateText(...)` (line 95) | `provider.name`, `result.model`, `result.usage` (from `TextProviderResult` — `text-provider/types.ts:8-12`), `durationMs` |
| `src/lib/image-generation/services/input-validation-service.ts` | after `openai.chat.completions.create(...)` (line 72-87) | `this.model`, `response.usage` → `TokenUsage`, `durationMs` |
| `src/lib/image-generation/services/image-review-service.ts` | after `openai.chat.completions.create(...)` (line 192-208) | same vision usage pattern |
| `src/lib/image-generation/services/image-generation-service.ts` | extend `emitMetricsEvent` (lines 99-110) + `generateWithRetry` result (line 1001) | real `attempt` (already tracked at lines 268-528), `usage` from `ImageProviderOutput.usage`, `durationMs` per call (not pipeline — furos 6/7) |
| `src/lib/visual-signature/ai-image-generator.ts` | `generate` (after `openai.responses.create`, line 173-193) + `validateSemantic` (line 50-86) | `visual_signature_image` + `visual_signature_validation` usage (Responses API), `provider_reported_cost_usd` when present (furo 5) |
| `src/lib/visual-signature/brand-profiler.ts` | `callVision`/`callVisionFull` (lines 702-743) | `usage` from `chat.completions` |
| `src/lib/brand-assets/brand-director.ts` | OpenAI vision call inside `analyze*` methods | `usage` |
| `src/lib/brand-assets/text-only-inference-service.ts` | after `this.openai.chat.completions.create(...)` (lines 80-91) | `usage`, `durationMs` (already computes `elapsedMs`) |

Error classes with `metadata { provider, model, elapsedMs, errorType }` already exist in `brand-director.ts:13-26` and `text-only-inference-service.ts:5-12` — the tracker's `errorType` on failed events maps directly to these (D7 `status: failed` + cost for failed review — spec image-quality-review).

---

### `src/lib/visual-signature/generation-events.ts` (modify — delegate to tracker)

Keep public API (`insertGenerationEvent(event: GenerationEventInsert): Promise<GenerationEventRecord | null>`) — body delegates to `new AiCostTracker().record(...)` mapping `GenerationEventInsert` → `AiCostEvent`, and keeps best-effort semantics (spec ai-cost-tracker lines 182-185). `GenerationEventInsert` type (`visual-signature/types.ts:126-146`) gains the new optional columns (`visual_signature_id`, `operation_run_id`, tokens, `provider_reported_cost_usd`, `cost_source`, `pricing_version`).

---

### `src/app/api/campaign/generate-image/route.ts` (modify — tracker + fixes furos 1/2/6/7 + persist run)

All changes anchored on existing self-analog lines:
- **Line 31:** replace `import { estimateAiCost } from "@/lib/ai-cost"` with tracker + resolveAiCost imports.
- **Line 41** (`const traceId = crypto.randomUUID()`): add `const run = new AiCostTracker().startRun("campaign_delivery")` — `{ operationRunId, traceId }`.
- **Line 348** (`createCampaign(storeId, ...)`): persist `operation_run_id` on the campaign — add `operation_run_id: run.operationRunId` to the insert (`campaign/persistence.ts` `createCampaign` lines 5-29 + `CreateCampaignInput` in `campaign/types.ts`), per D1/D2 (preparo F37).
- **Lines 593-663 (3 telemetry inserts)** and **717-735 (failed insert)**: remove inline `supabaseAdmin.from("generation_events").insert(...)`; replace with `tracker.record(...)` calls driven by service `onCall`/`onMetricsEvent` callbacks. Map: copy → `campaign_copy` (usage real — furo 1, via `CopyDirectorService.generateCopy` `onCall`); validation → `campaign_input_validation` (furo 4, via `InputValidationService.validate` `onCall`); image → `campaign_image` (attempt 1..n — furo 6); review → `campaign_image_review` (furo 4); delivery → `campaign_pipeline` **without cost/tokens**, `metadata.duration_is_pipeline: true` (D1/D6).
- **Line 555** (`durationMs` = whole pipeline): call-level events use per-call `durationMs` from callbacks (furo 7); only the delivery keeps pipeline duration.
- **Line 642** (`metadata: { totalCost: generationMetadata.provider }`): fix furo 2 — `totalCost` = numeric `SUM` of resolved call costs (delivery metadata only, never accounting source — spec transactional-pipeline lines 91-98).

---

### `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` (modify — tracker + cost + run semantics)

- **After guards (line 191, next to cost resolution 172-191):** `const run = new AiCostTracker().startRun("visual_signature")`.
- **Lines 417-431 and 470-483 (`insertGenerationEvent` calls):** event fills `visual_signature_id: result.signature.id`, cost/tokens from `AiImageGenerator` usage exposure (furo 5), and `operation_run_id` from the run. Delivery `visual_signature` gets cost/tokens NULL.
- **Run semantics (D1):** each request = one run; post-technical-failure retry = new run (line 449-458 refund path marks the old run failed; a new request creates a new `operation_run_id`).

---

### Rotas `/api/store/[id]/brand-profile/*` (modify — register brand_profile events from zero)

No events exist today — instrument via tracker (D11): route.ts (141 lines), generate-without-logo (90), infer (200), realign (544). Delivery marker `brand_profile_without_logo`/`brand_profile_with_logo` (cost/tokens NULL, status + duration_ms — spec brand-director-prompt lines 45-50) + call-level `brand_profile_vision` (profiler/director `onCall`) and `brand_profile_text` (text-only `onCall`). Run semantics: `startRun("brand_profile")` per request; realign (`mode:'regenerate'`) = new run (spec store-brand-profiler-without-logo lines 41-43). Pattern for the delivery record: copy the VS success/failure `insertGenerationEvent` calls in `generate-without-logo/route.ts:417-431 / 470-483` (but via tracker directly).

---

### Tests

### `src/lib/ai-cost/__tests__/tracker.test.ts` (new — 8 tests)

**Analog:** `src/lib/credit/__tests__/operation-cost-service.test.ts` (lines 1-33) — mock `@/lib/supabase/server` first, table-dispatcher `mockFrom`, inject mock client into constructor:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import { AiCostTracker } from "../tracker";

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockAdminClient = { from: mockFrom };

beforeEach(() => {
  vi.clearAllMocks();
  tracker = new AiCostTracker(mockAdminClient as any);
  mockFrom.mockImplementation((table: string) => {
    if (table === "generation_events") return { insert: mockInsert };
    return {};
  });
  mockInsert.mockResolvedValue({ error: null });
});
```
Cover scenarios from spec ai-cost-tracker: `record` inserts all new columns (lines 150-154), never throws on error (155-159), same run groups N calls (161-165), delivery marker NULL cost/tokens + `duration_is_pipeline` (166-170), `not_available` keeps tokens (172-176), `startRun` produces distinct UUIDs (144-148), TS rejects invalid `costSource` (177-180), `insertGenerationEvent` delegates (182-185).

### `src/lib/ai-cost/__tests__/cost-estimator.test.ts` (modify)

Adapt from itself (lines 1-200): make tests async, replace `source` string assertions with `costSource` enum assertions (D4 mapping: `openai_published_pricing`→`pricing_table`, `configured_fallback*`→`fallback_static`, `null`→`not_available`), assert `pricingVersion` uuid/code_default, add gemini-3.1-flash-lite + gpt-image-2 (furos 3), cached-token discount already tested at lines 81-92.

### `src/app/api/admin/ai-model-pricing/__tests__/route.test.ts` + `ai-costs/__tests__/route.test.ts` (new)

**Analog:** `src/app/api/admin/operation-costs/__tests__/route.test.ts` (lines 1-239) — mock `server-only`, `require-admin`, `@/lib/supabase/server` (`rpc: mockRpc`), import route, build `NextRequest`, status matrix: 200 + body fields + `mockRpc` payload assertion (lines 132-164), 400 zod (190-215), 500 RPC error (217-228), 403 ForbiddenError (230-238), 401 UnauthorizedError (124-128). Pricing-specific (spec ai-model-pricing lines 174-192): PUT without `reason` → 400; PUT without any price dimension → 400; GET non-admin → 403. ai-costs GET: assert `mockRpc` called with `admin_get_ai_costs` + p_* params from query string; 403/401 cases.

### `src/app/api/campaign/generate-image/__tests__/route.test.ts` (modify)

Keep existing mock infrastructure (lines 30-147, 205) — add `AiCostTracker` mock (or mock `@/lib/ai-cost`) and update config mocks. New pipeline scenarios (spec transactional-pipeline): copy event has `estimated_cost_usd` non-null (furo 1), review events with `attempt_number` 1..n, delivery has cost/tokens NULL, `metadata.totalCost` numeric, `campaigns.operation_run_id` persisted on creation, `admin_get_metrics` still passes.

### `src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts` (modify)

Update the `insertGenerationEvent` mock (lines 49, 59-60) to assert tracker delegation + new fields (`visual_signature_id`, cost, tokens, `operation_run_id`); new scenarios (spec store-visual-signature): delivery cost NULL = sum of image+validation, post-failure new run, typographic fallback → no call-level event (lines 59-62).

### Verificação SQL/integrada I1–I6 (new — real-DB)

**Analog:** `src/lib/credit/__tests__/operation-cost-service.integration.test.ts` (lines 1-69) — `.env.local` loader in `beforeAll` + real `supabaseAdmin`. I1-I6 (task 7.1): migration applies (columns/CHECKs/indexes incl. `campaigns.operation_run_id`), pricing RPC versioning (close+open, `p_reason` before defaults), RLS authenticated no access, resolveAiCost → pricing_table uuid with seeds, views exclude delivery markers, `admin_get_metrics` still responds. Views/RPC unit-style tests (task 6.7) can alternatively use the `mockRpc` route-test pattern against `admin_get_ai_costs`.

---

## Shared Patterns

### Authentication — Admin (`src/lib/admin/require-admin.ts:6-20`)
**Apply to:** both new admin routes (`ai-model-pricing`, `ai-costs`).
```typescript
export async function requireAdmin(): Promise<{ userId: string }> {
  const { userId } = await requireApiUser();
  const { data } = await supabaseAdmin
    .from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new ForbiddenError("Acesso restrito a administradores");
  return { userId };
}
```

### Route wrapper — `apiHandler` (`src/lib/auth/api-handler.ts:6-17`)
**Apply to:** all admin routes + modified generation routes. Maps `UnauthorizedError`→401, `ForbiddenError`→403, `StoreNotFoundError`→404.

### Best-effort telemetry (never blocks generation)
**Source:** `src/lib/visual-signature/generation-events.ts:4-24` (try/catch + `console.error` + return null).
**Apply to:** `AiCostTracker.record`, brand-profile routes. Rule: any write failure is logged and ignored (D7).

### Supabase client injection (`src/lib/credit/credit-service.ts:1-9`, `src/lib/supabase/server.ts:42`)
**Apply to:** `AiCostTracker`, `AiModelPricingService`. `constructor(private readonly client: SupabaseClient = supabaseAdmin) {}` — enables mock injection in tests.

### RPC mutation pattern (financeiro — never query-builder writes)
**Source:** `src/app/api/admin/credits/grant/route.ts:24-47` + `src/app/api/admin/operation-costs/route.ts:76-99`.
**Apply to:** `PUT /api/admin/ai-model-pricing` → always through `admin_set_ai_model_price` (D8), never direct `UPDATE`.

### Type barrels (no server-only in types)
**Source:** `src/lib/credit/types.ts` (no import of server-only; zod schemas import the const arrays).
**Apply to:** `src/lib/ai-cost/types.ts`. Keep `server-only` only in `tracker.ts`/`ai-model-pricing.ts`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Views `admin_ai_*` + `admin_cost_vs_credits` (in migration) | migration | DDL/aggregation | **No `CREATE VIEW` exists in any migration** (verified by grep). The repo aggregates exclusively inside RPCs (admin_get_metrics). Planner must introduce the first SQL views — model their SELECT bodies on the CTE/`COUNT FILTER`/`jsonb_build_object` style of `admin_get_metrics` (`20260731000001:138-353`). |
| `AiCostTracker.startRun` (run context object `opts.telemetry`) | service | — | No existing run-context object propagates `{ operationRunId, traceId }` through service opts. Closest precedent: bare `traceId` flowing through `generate-image/route.ts`. New small pattern — D7 contract specifies shape. |
| `onCall` optional callback on AI services | service | request-response | No existing optional usage callback on the 7 IA-calling services. Closest partial analog: `onMetricsEvent` (`image-generation-service.ts:92-110`) and `onPhaseChange` (same file, line 90). Pattern is simple (`onCall?: (info: AiCallInfo) => void`) but has no direct copy-source. |
| Brand-profile routes instrumentation | route | request-response | Routes exist (4 files) but emit **zero** generation events today — no inline-insert code to replace; pattern must be created from the VS route's `insertGenerationEvent` usage + tracker. |
| Seeds with `ON CONFLICT (provider, model)` on a UUID-PK table | migration | — | F38 seeds used the PK as conflict key (`f38:237-241`). `ai_model_pricing` PK is UUID → partial unique index `uq_ai_model_pricing_vigente (provider, model) WHERE effective_until IS NULL` (F38 partial-index idiom `f38:66-69`) — NOT a full-table UNIQUE (would break D8 versioning). Resolved in 38-1-01 Bloco 5. |
| SQL/migration verification tests (I1-I6) | test | — | No migration-verification harness exists; closest is the real-DB integration test pattern (`operation-cost-service.integration.test.ts`). I1-I6 may need a new integration-suite file. |

## Metadata

**Analog search scope:** `supabase/migrations/` (58 files), `src/lib/ai-cost/`, `src/lib/credit/`, `src/lib/image-generation/`, `src/lib/copy/`, `src/lib/visual-signature/`, `src/lib/brand-assets/`, `src/lib/metrics/`, `src/lib/campaign/`, `src/lib/supabase/`, `src/app/api/admin/**`, `src/app/api/campaign/generate-image/**`, `src/app/api/store/[id]/visual-signature/**`, `src/app/api/store/[id]/brand-profile/**`
**Files scanned:** ~60 (migrations + source + tests)
**Pattern extraction date:** 2026-08-08
