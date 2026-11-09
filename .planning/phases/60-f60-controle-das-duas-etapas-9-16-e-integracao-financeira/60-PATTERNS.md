# Phase 60: F60 — Controle da operação 9:16 em duas etapas e integração financeira — Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 18 (new + modified)
**Analogs found:** 18 / 18 (13 exact/role-match, 5 partial — see "No Analog / Partial Analog")
**Source of truth:** `openspec/changes/product-9-16-two-stage-operation-control/` (proposal, design, specs, tasks) + `60-CONTEXT.md`. This file maps patterns only; it does not redesign decisions.

> The blocking transactional proof in homolog is the **first plan** and gates the module plans. The homolog is **non-disposable** (`vendeo-homolog`, `127.0.0.1:57782`, db `postgres`).

## File Classification

| New/Modified File (proposed) | Role | Data Flow | Closest Analog | Match | Use |
|---|---|---|---|---|---|
| `supabase/migrations/<ts>_f60_9_16_two_stage_control.sql` (tables `product_9_16_two_stage_operations|steps|attempt_claims|outcomes`, indexes, RLS) | migration (DDL) | transactional DDL | `supabase/migrations/20261008000002_f56_2b1a_product_1_1_campaign_credit.sql` (tables + indexes + grants) and `20261009000001_f56_2b1b_atomic_attempt_start.sql` §1/§1b (claims/outcomes tables) | exact | copy table/index/trigger/RLS/grant block |
| `..._f60_9_16_two_stage_rpcs.sql` (open/acquire/finish/record-outcome/resume) | migration (RPC) | request-response (row-locked transaction) | `20261009000001_f56_2b1b_atomic_attempt_start.sql` §3–§6 | exact | copy C4 lock + acquire/query_only + CAS + outcome envelope |
| `..._f60_shared_read_views.sql` (`product_generation_active_claims_v`, `product_generation_operation_outcomes_v`, `product_abandon_residual_attempts`) | migration (views + function) | read-transform / batch | **partial**: `20260808000001_f38_1_create_ai_cost_accounting.sql:288-334` (view style); abandon inline `20261016000001...:399-402` | role-match | view SELECT style + anti-join; function under C4 |
| `..._f60_shared_rpc_adaptations.sql` (`CREATE OR REPLACE` `product_1_1_close_failed_operation`, `admin_resolve_product_1_1_pending`, `product_1_1_get_campaign_operation_by_campaign`) | migration (RPC replace) | request-response | `20261016000001_f56_2b2b_publication_fence.sql:255-289` (close), `:305-414` (admin), `20261015000003_f56_2b2b_pending_read.sql:25-83` (read) | exact | preserve signature, fence, epoch, envelope |
| `src/lib/product-9-16-two-stage/types.ts` | types / utility | transform | `src/lib/product-1-1/orchestration/attempt-start-types.ts` (126 ln) and `src/lib/product-1-1/credit-operation/types.ts` (80 ln) | exact | type unions, reason codes, typed error class |
| `src/lib/product-9-16-two-stage/two-stage-operation-client.ts` | service client | request-response | `src/lib/product-1-1/orchestration/attempt-start-client.ts:261-324` + `credit-operation-client.ts:151-360` | exact | thin `supabaseAdmin.rpc` wrapper + closed-envelope parsers |
| `src/lib/product-9-16-two-stage/two-stage-operation-service.ts` (policy/retry/state decisions) | service | orchestration / request-response | `src/lib/product-1-1/pending/resolve-pending-operation.ts` (server-derived evidence, fail-closed) | role-match | never trust TS for atomicity; DB decides |
| `src/lib/product-1-1/pending/pending-operations-repository.ts` (**modify** `readClaims`/`readOutcome`, add origin/stage) | repository | read / CRUD | same file `:157-180` and `:182-229` | exact | switch table reads to shared views; keep read-only |
| `src/app/api/admin/product-1-1-pending/route.ts` (**modify** GET/POST dispatch by origin) | route/controller | request-response | same file `:54-155`; adapter `src/lib/product-vertical-9-16/recovery/pending-adapter.ts:28-53` | exact | single admin surface, no second queue |
| `src/lib/product-9-16-two-stage/__tests__/two-stage-control.postgres.test.ts` | test | CRUD + transaction | `src/lib/__tests__/market-preferences-schema.postgres.test.ts` (RLS/grants/CAS) | exact | target allowlist + ledger fingerprint + negative SQL |
| `.../__tests__/two-stage-concurrency.integration.test.ts` | test | concurrency | `src/lib/product-1-1/__tests__/atomic-attempt.integration.test.ts` + `concurrent-route-submission.integration.test.ts` + `src/lib/__tests__/access-request-limit.postgres.test.ts:146-162` | exact | two real PG clients / `Promise.allSettled` |
| `.../__tests__/shared-reading-compatibility.integration.test.ts` | test | regression / read | `src/lib/product-1-1/__tests__/failure-closure.integration.test.ts` (before/after behavior) | role-match | 1:1 + 9:16 direto identical before/after |
| `.../__tests__/origin-views.postgres.test.ts` | test | read / anti-join | `market-preferences-schema.postgres.test.ts` (pure SQL assertions) | role-match | no duplicate/conflicting outcome |
| `scripts/f60/homolog-snapshot.mjs` | script | file-I/O / read-only DB | `scripts/f57-2/homolog-snapshot.mjs` (221 ln) | exact | allowlist, repeatable-read read-only, md5/SHA compare |
| `scripts/f60/run-f60-proofs.ps1` | script/orchestrator | batch | `scripts/f57-2/run-f57-2-proofs.ps1` (310 ln) | role-match | status/prove actions, evidence dir; **f60 não usa cleanup em `finally`** — exige autorização D e run id |
| `scripts/f60/two-stage-proof-harness.mjs` (simulated base/expansion steps, no AI) | script | batch / event-driven | **partial**: `scripts/f59/vertical-provider-proof.ts` (real provider) + `scripts/f56-2b2b/prepare-uat-store.ts` (fixtures) | role-match | deterministic simulated steps, evidence JSON |
| `scripts/f60/proof-cleanup.mjs` (manifest/registry, create-only IDs) | script | file-I/O / batch | `scripts/f57-2/proofs-tool.mjs` + `scripts/f56-2b2b/fixture-postconditions.ts` | role-match | registry-driven cleanup + postcondition validator |
| `.planning/phases/60-.../60-01-HOMOLOG-BASELINE.md`, `60-02-CHECKPOINT-RESULT.md`, `60-03-STAGE-SEPARATION.md` (+ `evidence/*.json|md`) | docs/evidence | n/a | `57.2-01-HOMOLOG-BASELINE.md`, `57.2-04-CHECKPOINT-RESULT.md`, `59-10-HOMOLOG-BASELINE.md`, `59-10-HOMOLOG-MATRIX.md` | exact | identity/ledger table, per-scenario matrix, approve/reject verdict |

## Pattern Assignments

### 1. Control tables — `supabase/migrations/<ts>_f60_9_16_two_stage_control.sql`

**Analog:** `20261008000002_f56_2b1a_product_1_1_campaign_credit.sql:24-55` and `20261009000001_f56_2b1b_atomic_attempt_start.sql:48-68,73-127`.

Copy the table conventions exactly:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `campaign_id UUID NOT NULL REFERENCES public.campaigns(id)`, `operation_id UUID NOT NULL`, composite `UNIQUE (campaign_id, operation_id)`.
- Status `TEXT NOT NULL CHECK (status IN (...))` — never an enum; explicit named constraints (`ck_p1_1_*`, `uq_p1_1_*`).
- Partial unique index for single active attempt (`atomic_attempt_start.sql:62-65`):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_..._attempt_in_progress
  ON public.product_9_16_two_stage_attempt_claims (campaign_id, operation_id)
  WHERE status = 'in_progress';
```
- Same pattern for `UNIQUE (campaign_id, operation_id, request_id)` and `UNIQUE (campaign_id, operation_id, stage, attempt_number)`.
- Operations row is created **in the same transaction as the reserve** (see `campaign_credit.sql:107-152`: insert operation first via `ON CONFLICT DO NOTHING`, winner reserves).
- Immutable outcome table + trigger (copy `atomic_attempt_start.sql:73-107`): one row per operation, `BEFORE UPDATE OR DELETE` raises `..._immutable`.
- RLS for service_role SELECT only (`atomic_attempt_start.sql:112-126`):
```sql
ALTER TABLE public.product_9_16_two_stage_attempt_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "..." ON public.product_9_16_two_stage_attempt_claims FOR SELECT TO service_role USING (true);
REVOKE ALL ON TABLE public.product_9_16_two_stage_attempt_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.product_9_16_two_stage_attempt_claims FROM service_role;
GRANT SELECT ON TABLE public.product_9_16_two_stage_attempt_claims TO service_role;
```
- End the file with a **manual `REVERT`** block in reverse order (copy `campaign_credit.sql:405-421`, `atomic_attempt_start.sql:476-494`).

### 2. New RPCs — open / acquire / finish / record-outcome / resume

**Analog:** `20261009000001_f56_2b1b_atomic_attempt_start.sql:131-276` (acquire), `:281-331` (finish), `:392-459` (outcome), plus `20261015000002:107-113` (advisory + C4 order).

Mandatory shape for every mutating RPC:
```sql
CREATE OR REPLACE FUNCTION public.product_9_16_<verb>(
  p_campaign_id UUID, p_operation_id UUID, ...
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_credit public.product_1_1_campaign_credit_operations%ROWTYPE;
BEGIN
  -- 0) input guards RAISE 'missing_*' / 'invalid_*'
  -- 1) optional request_id advisory lock (same-request serialization)
  PERFORM pg_advisory_xact_lock(hashtext('p916_request:' || p_request_id::text));
  -- 2) C4 — SAME credit row the financial resolution locks
  SELECT * INTO v_credit FROM public.product_1_1_campaign_credit_operations
   WHERE campaign_id = p_campaign_id AND operation_id = p_operation_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('acquired', false, 'reason', 'operation_terminal'); END IF;
  IF v_credit.status IN ('delivered','refunded') THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'operation_terminal');
  END IF;
  -- 3) control-row read/update + revalidation of financial state
END; $$;
```
- **Acquire winner/duplicate** (copy `atomic_attempt_start.sql:98-147,253-275`): return `{acquired:true, authorization:'execute', ...}` only for the transaction that inserted the `in_progress` claim; a replay of the same `request_id` returns the existing claim with `acquired:false, authorization:'query_only'`; `ON CONFLICT ... DO NOTHING` + `IF v_inserted_id IS NULL`; catch `unique_violation` for the partial index.
- **Finish** (copy `atomic_attempt_start.sql:281-331`): `SELECT ... FOR UPDATE` on the claim, idempotent same-status return, `invalid_transition` otherwise; re-read the credit row under C4 first and refuse `operation_terminal` / `operation_unknown`.
- **Record outcome** (copy `atomic_attempt_start.sql:392-459`): insert `ON CONFLICT DO NOTHING`; equivalent replay ⇒ `{success:true,idempotent:true}`; divergent replay ⇒ `{success:false,reason:'operation_identity_conflict'}` — never a misleading success.
- Grants per function: `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;` (`atomic_attempt_start.sql:464-474`).

### 3. Shared read views + `product_abandon_residual_attempts`

**Analog (view style):** `20260808000001_f38_1_create_ai_cost_accounting.sql:288-334` — `CREATE OR REPLACE VIEW public.... AS SELECT ...` with explicit columns, `COUNT(*) FILTER`, no `SELECT *`.
**Analog (abandon):** `20261016000001_f56_2b2b_publication_fence.sql:399-402` — bulk `UPDATE ... SET status='abandoned' WHERE ... AND status='in_progress'` under the already-held C4 lock.

Required semantics (design D3/D7):
- `product_generation_active_claims_v`: `UNION ALL` of legacy `product_1_1_generation_attempt_claims` (`status='in_progress'`) and new claims, columns `(campaign_id, operation_id, source, stage)`.
- `product_generation_operation_outcomes_v`: union of legacy `product_1_1_generation_outcomes` and new outcomes, preserving terminal precedence.
- **Origin anti-join** in both views: legacy source only when `NOT EXISTS (SELECT 1 FROM public.product_9_16_two_stage_operations n WHERE n.campaign_id=l.campaign_id AND n.operation_id=l.operation_id)`; new source only when the row exists in the new operations table. This is what prevents duplicated/conflicting outcomes (REQ-60-12).
- Function:
```sql
CREATE OR REPLACE FUNCTION public.product_abandon_residual_attempts(
  p_campaign_id UUID, p_operation_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- CALLER must already hold the C4 lock; this function does not re-lock.
  UPDATE public.product_1_1_generation_attempt_claims SET status='abandoned', updated_at=now()
   WHERE campaign_id=p_campaign_id AND operation_id=p_operation_id AND status='in_progress';
  UPDATE public.product_9_16_two_stage_attempt_claims SET status='abandoned', updated_at=now()
   WHERE campaign_id=p_campaign_id AND operation_id=p_operation_id AND status='in_progress';
  RETURN jsonb_build_object('success', true);
END; $$;
```
- Views/functions get `REVOKE ... FROM PUBLIC, anon, authenticated`; views `GRANT SELECT ... TO service_role` (PG15+ views are security-invoker; underlying tables already grant SELECT to service_role, so do **not** add `security_invoker=false` casually).

### 4. Shared RPC adaptations (three `CREATE OR REPLACE`)

**Analog:** `20261016000001_f56_2b2b_publication_fence.sql:255-289` and `:305-414`; `20261015000003_f56_2b2b_pending_read.sql:25-83`.

- `product_1_1_close_failed_operation(UUID,UUID,TEXT,INTEGER,TEXT)`: keep signature **exactly** (5 args incl. `p_observed_epoch`). Preserve `FOR UPDATE` (264-265), terminal idempotency (267-270), fence `publication_state IN ('in_flight','result_unknown','published')` (273-275), epoch equality (277), `absent` requirement (279), then replace the two direct table reads (280-285) with:
```sql
SELECT EXISTS (SELECT 1 FROM public.product_generation_active_claims_v
  WHERE campaign_id=p_campaign_id AND operation_id=p_operation_id) INTO v_in_progress;
IF v_in_progress THEN RAISE EXCEPTION 'operation_in_progress'; END IF;
SELECT EXISTS (SELECT 1 FROM public.product_generation_operation_outcomes_v
  WHERE campaign_id=p_campaign_id AND operation_id=p_operation_id AND outcome='failed') INTO v_failed;
IF NOT v_failed THEN RAISE EXCEPTION 'finality_not_recorded'; END IF;
```
- `admin_resolve_product_1_1_pending(UUID,UUID,UUID,TEXT,TEXT,UUID,JSONB)`: keep signature, advisory `pg_advisory_xact_lock(hashtext('p1_1_pending_resolution:'||...))` (331), C4 (332-333), audit-idempotency (336-346), terminal checks (348-356), fence block (363-373). Replace claim read (358-361) with the active-claims view; replace inline `UPDATE ... abandoned` (399-402) with `PERFORM public.product_abandon_residual_attempts(...)`. Keep the shared audit action `product_1_1_pending_resolution` and put `flow='9_16_two_stage'`, `stage` in `metadata` — **do not** widen the `action` CHECK.
- `product_1_1_get_campaign_operation_by_campaign(UUID)`: keep `STABLE`, terminal precedence (`:51,69-80`). Read `outcome`/`support_reference` from `product_generation_operation_outcomes_v` instead of the legacy table; expose the new-flow outcome while non-terminal only.

### 5. TS module `src/lib/product-9-16-two-stage/**`

**Types** — copy `attempt-start-types.ts:15-126`:
- Literal unions for stage (`"base" | "expansion"`), step status (`pending|in_progress|done|failed|abandoned`), claim target (`primary|fallback|initial|retry`), outcome (`unknown|failed`), authorization (`execute|query_only`).
- Non-acquisition reasons as a closed union (`AttemptStartReason` style) — the loser never throws.
- `readonly` interfaces + `Readonly<>`/`Object.freeze`; typed `Error` subclass with `code` (like `CreditOperationError` / `AttemptStartError`).

**Client** — copy `attempt-start-client.ts:261-306` + `credit-operation-client.ts:151-249`:
```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

export class ProductTwoStageOperationClient {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}
  async acquire(input: AcquireInput) {
    const { data, error } = await this.client.rpc("product_9_16_acquire_attempt", { ... });
    if (error) throw mapError(error.message);
    return mapAcquire(data, input);   // closed envelope
  }
}
```
- Closed-envelope parsers are mandatory (copy `attempt-start-client.ts:98-147`): `acquired:true` only if `reason===null` **and** `campaign_id`/`operation_id`/`stage`/`attempt_number`/`target` match the request exactly; `finish`/`recordOutcome` require explicit `success===true` and matching identity (149-229).
- Never use the query builder for writes; only `.rpc(...)`.

**Service** — model fail-closed / server-derived evidence on `resolve-pending-operation.ts:16-37,90-...`; keep retry counters read from DB, never from the request (D6/D9).

### 6. `pending-operations-repository.ts` (modify)

**Analog:** same file `:157-180` (`readClaims`/`readOutcome`) + `:182-229` (`findPendingOperation`).

- Replace `CLAIMS_TABLE`/`OUTCOMES_TABLE` reads with the shared views:
```ts
private async readClaims(campaignId: string, operationId: string) {
  const { data, error } = await this.client
    .from("product_generation_active_claims_v")
    .select("source, stage, attempt_number, status, updated_at")
    .eq("campaign_id", campaignId)
    .eq("operation_id", operationId)
    .order("attempt_number", { ascending: false });
  if (error) throw new Error(`pending_operation_claims_read_failed:${error.message}`);
  return data ?? [];
}
```
- Keep `processing = claims.some(c => c.status === "in_progress")` semantics (205), keep `terminal` precedence (199-204), and add an explicit `origin: "legacy" | "9_16_two_stage"`/`stage` field rather than a second queue. Keep the repository format-agnostic: origin/format comes from the injected adapter (`pending-adapter.ts:28-53`), not a hardcoded branch.

### 7. Admin route (modify) `src/app/api/admin/product-1-1-pending/route.ts`

**Analog:** same file `:54-79` (GET) and `:81-155` (POST).
- Keep `apiHandler` + `requireAdmin`; POST also `requireSameOrigin` + Zod `.strict()` (81-94).
- Keep one queue: dispatch on resolved format/origin via `createPendingFormatAdapter()` (57-65, 97-124); pass `origin`/`stage` into the repository/read model instead of creating `/api/admin/product-9-16-pending`.
- Keep evidence derivation server-side and `authorizeAbandon`/`authorizePublicationClosure` only on this authenticated path (136-144).

### 8. Tests

**Postgres schema/RLS/grants** — copy `market-preferences-schema.postgres.test.ts:13-90`:
- Hard `TEST_DATABASE_URL` allowlist (`127.0.0.1:57782`, `/postgres`) before creating a pool; ledger-count/SHA env fingerprint.
- Helpers `withClient`, `inTransaction` (always rollback), `query`, `rpcCall`, `expectSqlState` (85+).
- Assert grants by attempting direct writes as `service_role` and expecting SQLSTATE `42501`; assert functions are `SECURITY DEFINER` + `prosecdef` + `proconfig` contains `search_path=`; assert RLS enabled and only SELECT policy.
- Do **not** use `session_replication_role = replica` on homolog (that idiom in `access-request-limit.postgres.test.ts:60-87` is local-only; 57.2 baseline forbids it for homolog cleanup).

**Concurrency** — copy `atomic-attempt.integration.test.ts:114-140` + `integration-harness.ts:51-60` (two real `pg` clients) and `access-request-limit.postgres.test.ts:146-162`:
```ts
const results = await Promise.allSettled([acquireSameRequest(), acquireSameRequest()]);
expect(results.filter(r => r.status === "fulfilled" && r.value.authorization === "execute")).toHaveLength(1);
expect(results.filter(r => r.status === "fulfilled" && r.value.authorization === "query_only")).toHaveLength(1);
expect(providerCalls).toBe(1);
expect(creditTransactions).toHaveLength(1);
```
- Register every suite in `scripts/testing/test-categories.json` under a new `integration.f60` profile (or `integration.product-1-1`); runner selection via `scripts/testing/run-integration.mjs:34-60`.

**Compatibility** — copy `failure-closure.integration.test.ts:1-80`: real Postgres, provider simulated (`vi.mock("server-only")`, `supabaseAdmin`), fixtures by UUID, append-only; run the same 1:1 and 9:16-direto scenarios before/after the RPC replacement and compare identical envelopes/ledger counts.

**Origin/anti-join** — pure SQL assertions in the `market-preferences-schema` style: create one legacy-only op, one new-flow op, assert each appears exactly once in each view with the correct `source`, and assert no `unknown`/`failed` duplicates.

### 9. Homolog proof harness / snapshot

**Snapshot** — copy `scripts/f57-2/homolog-snapshot.mjs`:
- `ALLOWED_HOST=127.0.0.1`, `ALLOWED_PORT=57782`, `ALLOWED_DB=postgres`; `assertTarget` refuses anything else (19-63).
- `begin isolation level repeatable read read only` (98), ledger fingerprint excluding current-phase versions (100-122), per-table `count(*)` + `md5(string_agg(...))`, JSON + Markdown compare, exit code 2 on drift (132-195).
- Extend `TABLES` with the four new control tables **after** they exist, but keep `credit_transactions` fingerprint-only (append-only; never delete).
- **Better:** parameterize the phase prefix/host allowlist instead of copying the f57-2 file, so the proof uses the `p916test-` scope. Keep a copy under `scripts/f60/` if the planner prefers an isolated harness.

**Orchestrator** — copy `scripts/f57-2/run-f57-2-proofs.ps1`:
- `param([ValidateSet("status","prove")])`; `status` is read-only and validates ledger count/SHA; `prove` requires explicit human authorization (1-22).
- Reject `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_URL`; require `TEST_DATABASE_URL` and re-validate host/port/db in PowerShell before use (41-55).
- Evidence directory + `[ordered]` map of expected artifacts; **não copiar o cleanup em `finally` do f57-2**: em f60 o cleanup exige autorização D e run id; final S0 snapshot + compare (263-282) com expectativas; write consolidated `evidence.json` e falhar se qualquer artefato estiver ausente/vazio (284-310).
- Replace the f57-2 suite names with the F60 suites; set `F60_EXPECTED_LEDGER_COUNT/SHA256` and a `F60_EXCLUSIVITY_WINDOW` (start/end + owner) recorded in the checkpoint.

**Harness** — model on `scripts/f59/vertical-provider-proof.ts` (run id, mode, matrix, per-case evidence JSON) but **no provider/IA**: deterministic simulated `base` and `expansion` outcomes driven by the RPCs, capturing per-scenario: SQL state, `credit_transactions` counts, operation/step/claim/outcome rows, idempotency replay results, and artifact-evidence hashes. Use `scripts/f56-2b2b/fixture-postconditions.ts` style pure validators for terminal coherence (`status`, one refund, matching store/tx ids).

**Cleanup** — registry-driven (copy `scripts/f57-2/proofs-tool.mjs` `preflight/cleanup` contract from the ps1 usage, and `fixture-postconditions.ts` for validation): only UUIDs created by the run, dependency order, `credit_transactions` never deleted or updated, classify every manifest item as `deleted` or `retained` with reason, emit `cleanup-manifest.json` with `deleted[]`, `retained[]`, `expected_financial_delta`; fail only on unclassified items or leftover deletable test rows (retained append-only/immutable/referenced records are expected).

### 10. Evidence docs / checkpoint

**Analog:** `57.2-01-HOMOLOG-BASELINE.md` (identity/ledger/rules table), `57.2-04-CHECKPOINT-RESULT.md` (front-matter shape; adapt to pre-existing integrity + expected delta + deleted/retained), `59-10-HOMOLOG-BASELINE.md` (read-only observation, ledger reconciliation, no execution), `59-10-HOMOLOG-MATRIX.md` (ID × scenario × action × expected evidence).

Produce:
- `60-01-HOMOLOG-BASELINE.md`: container, workdir, DB host/port/db, ledger count + SHA, phase not applied, backup reference, rules (no disposable env, valid UUIDs + `p916test-` textual labels, exclusivity window, append-only ledger, pre-existing integrity vs expected delta).
- `60-01-PROOF-MATRIX.md`: 13 scenarios from design D10 mapped to test IDs, commands, expected evidence, approve/reject.
- `60-01-PROOF-RESULT.md`: YAML front-matter (`status`, `migration_applied`, `ledger_after`, `tests`, `pre_existing_integrity`, `expected_delta_matches`, `cleanup_manifest`, `retained_records`, `cleanup_executed`, `revert_executed`), explicit "local ≠ homolog ≠ production".
- `60-03-STAGE-SEPARATION.md`: local gates vs homolog proof vs production gates (ng D12 / REQ-60-15).

## Shared Patterns

### Authentication / admin surface
**Source:** `src/app/api/admin/product-1-1-pending/route.ts:1-15,54-94`; `src/lib/admin/require-admin.ts`.
**Apply to:** the modified route only. No new public route; no flag/UI in this slice.

### Error/envelope contract
**Source:** `attempt-start-client.ts:83-229`; `credit-operation-client.ts:114-149`; RPCs return JSONB `{success, idempotent, status, campaign_id, operation_id, reason?}` and acquire returns `{acquired, authorization, reason}`.
**Apply to:** every new RPC and every TS parser. Success is **explicit**; `reason:'operation_terminal'|'operation_unknown'|'operation_identity_conflict'` are typed errors, never silent success.

### Atomicity boundary
**Source:** `credit-operation-client.ts:14-20`; `attempt-start-client.ts:22-36`.
**Apply to:** all new code — SQL is the only authority; TS only maps. Any plan action that says "check then write" in TS must be rejected.

### Migration hygiene
**Source:** `campaign_credit.sql:405-421`; AGENTS.md migration rules.
**Apply to:** every migration. Filename `YYYYMMDDHHmmss_description.sql` with real UTC seconds; uniqueness verified in worktree + target/integration branches; manual `REVERT` block; never rename applied migrations; no repair of existing ledgers.

### Test/env gating
**Source:** `market-preferences-schema.postgres.test.ts:13-41`; `run-integration.mjs:28-89`; `test-categories.json`.
**Apply to:** all new postgres/integration suites. Refuse to run on an unexpected target; never provision/reset; `prove` requires human authorization.

## Landmines / Constraints the Plan MUST Preserve

1. **Grants RPC-only.** Tables: `REVOKE ALL FROM PUBLIC, anon, authenticated; REVOKE ALL FROM service_role; GRANT SELECT TO service_role` (`campaign_credit.sql:51-55`; `atomic_attempt_start.sql:120-126`). Functions: `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role` (`atomic_attempt_start.sql:464-474`; fence `:419-434`). No `INSERT/UPDATE/DELETE` for service_role on control tables.
2. **`SECURITY DEFINER` + `SET search_path = ''`** on every function; all references schema-qualified (`public.`). A missing `search_path=''` or unqualified name is a defect.
3. **C4 lock order.** Advisory (`request_id`/resolution id) → `SELECT ... FOR UPDATE` on `product_1_1_campaign_credit_operations` → control row. `FOR UPDATE` must precede any claim/outcome read used for a decision (`atomic_attempt_start.sql:161-167`; `pending_abandon.sql:107-113`). Missing credit row ⇒ `operation_terminal`, not silent insert.
4. **Publication fence.** `publication_state IN ('in_flight','result_unknown','published')` blocks direct refund/close (`fence:236-238,273-275`); `published` is never refunded; only `authorized_publication_closure` allows `in_flight/result_unknown` (`:363-373`). Base completion must **not** call `mark_art_uploaded`/`deliver`; `art_uploaded` only on vertical-art publication; `delivered` only at vertical delivery.
5. **Epoch freshness.** `product_1_1_close_failed_operation` compares `p_observed_epoch` to `state_epoch` (`fence:277`); admin refund without active publication compares evidence `state_epoch` (`:371`); `get_publication_epoch` (`:294-300`). Preserve these checks and the 5-arg signature. Financial transitions must bump `state_epoch`.
6. **Idempotency envelopes.** Equivalent replay ⇒ `{success:true,idempotent:true}`; divergent replay ⇒ `operation_identity_conflict` (`atomic_attempt_start.sql:438-451`; `pending_abandon.sql:117-134`; audit unique partial index + `unique_violation` → conflict `fence:408-412`). Resolution identity uses `admin_audit_log.operation_id` unique + namespaced advisory lock. Do not create a new audit action; reuse `product_1_1_pending_resolution` with `flow`/`stage` metadata and do not widen the CHECK.
7. **Acquire ≠ query.** `authorization='execute'` only for the winner. Same token/`request_id` does not authorize a second execution. Partial unique `in_progress` index + advisory lock on `request_id` are both required (`atomic_attempt_start.sql:62-68,259-275`).
8. **Origin anti-join.** Each `(campaign_id, operation_id)` belongs to exactly one origin. Views must exclude legacy rows that exist in the new table (and vice versa). The new operation row is created in the same transaction as the reserve; no operation may exist only in legacy.
9. **Financial authority is singular.** `product_1_1_campaign_credit_operations` is the only authority for `reserved/art_uploaded/delivered/refunded`. Control tables store only steps/attempts/operational outcome; never a second `delivered`/`refunded`.
10. **No base confirmation.** Guarantee base completion leaves `status='reserved'`, no `confirmCredit`, no refund, and expansion never reserves. Failure without delivery ⇒ exactly one refund; `delivered` is not refundable (`campaign_credit.sql:283-288`; fence `:235-238`).
11. **Homolog is non-disposable.** Hard allowlist `127.0.0.1:57782/postgres`; read-only S0 in `repeatable read read only`; no create/reset/push; ledger fingerprint before/after; `credit_transactions` append-only; cleanup only created UUIDs classified `deleted`/`retained`; **exclusivity window** for the shared RPCs (unique IDs do not isolate shared routines — design D7/D11).
12. **Test cleanup discipline.** Do not use `session_replication_role=replica` on homolog; delete only created deletable UUIDs in dependency order; retain and document append-only/immutable/referenced records; never require impossible deletion or global fingerprint equality. Provider/IA always simulated (zero paid calls).
13. **Retry policy.** Expansion ≤2 total (initial + one auto retry only for proven transient: `rate_limit`, explicit unavailability/capacity, or provably pre-send). Timeout/abort/comm-loss after possible send = `unknown`, no auto retry/refund even if SDK says `retryable`. Base = existing 2 primary + 1 fallback (max 3 calls). Counters from DB, durable across resumes (`atomic_attempt_start.sql:210-251` is the model, adapted to stages).
14. **No second queue/UI/flag.** Admin surface stays `src/app/api/admin/product-1-1-pending/route.ts`; repository stays read-only; no public route, cron, worker, or activation in this slice.
15. **Stage separation in docs.** Local tests/typecheck/lint/build/OpenSpec strict ≠ homolog proof ≠ production readiness (D12/REQ-60-15).

## No Analog / Partial Analog

| File/area | Why partial | Plan guidance |
|---|---|---|
| Shared union views with origin anti-join | No existing UNION/anti-join view in repo; closest is `admin_ai_*` single-source views | Follow design D3/D7 exactly; test non-duplication as a first-class SQL suite |
| `product_abandon_residual_attempts` | No cross-table abandon function exists; only inline single-table update in `fence:399-402` | Keep it lock-free (caller holds C4), idempotent, returns JSONB; test both tables |
| `scripts/f60/two-stage-proof-harness.mjs` | `f59` harness calls a real provider and is out of scope | Build a deterministic simulated-step harness (no IA), evidence JSON per scenario, artifact-evidence hashes only |
| Deeplink/UI/art storage | Explicitly out of scope | Do not create UI, routes, renderers, or artifact storage in Phase 60 |
| Production enablement | Out of scope (D12) | Document as pending release gates, not as delivered work |

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/lib/product-1-1/**`, `src/lib/product-vertical-9-16/**`, `src/app/api/admin/**`, `src/lib/__tests__/**`, `scripts/{f56-2b2b,f57-2,f59,testing}/**`, `.planning/phases/{57.2,59}*/**`.
**Files read for patterns:** 26 (migrations 5, TS 10, tests 5, scripts 4, docs 2).
**Pattern extraction date:** 2026-11-09.
**Read-only:** no migration, test, or code was executed/modified; only this file was written.
