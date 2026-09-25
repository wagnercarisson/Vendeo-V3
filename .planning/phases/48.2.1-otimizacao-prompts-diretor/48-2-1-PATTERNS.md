# Phase 48.2.1: Otimização dos Prompts do Diretor — Pattern Map

**Mapped:** 2026-09-25
**Files analyzed:** 34 (12 modified, 22 new)
**Analogs found:** 31 / 34 (3 with no code analog: final Markdown report, candidate-prompt drafts, and diagnostic fixture content — content artifacts)
**Primary analog set:** the F48.1 lab codebase (`src/lib/lab/**`, `src/app/api/admin/laboratorio/**`, `src/app/(app)/admin/laboratorio/**`, `supabase/migrations/2026091500000{2,3}_*.sql`)

> **Read-only analysis.** No source file was modified. This document is the only artifact written.
>
> **Key principle:** F48.2.1 is an *evolution* of F48.1. Almost every file is a **modify**, and its own current version is the best analog. New files copy the sibling F48.1 file of the same role/data-flow. `prompts/` stays byte-for-byte untouched.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/2026XXXXXXXXXX_f48_2_1_lab_prompt_programs.sql` (new) | migration | DDL / batch | `supabase/migrations/20260915000003_f48_1_lab_immutability_and_reserve.sql` (+ `...000002_..._create_lab_tables.sql`) | exact |
| `src/lib/lab/domain/prompt-snapshot.ts` (modify) | utility/domain | transform | itself (F48.1) | exact |
| `src/lib/lab/domain/schemas.ts` (modify) | utility/domain | transform | itself (F48.1) | exact |
| `src/lib/lab/domain/experiment-service.ts` (modify) | service | CRUD | itself (F48.1) | exact |
| `src/lib/lab/domain/program-service.ts` (new) | service | CRUD | `src/lib/lab/domain/experiment-service.ts` + `src/lib/lab/api/experiment-queries.ts` | role-match |
| `src/lib/lab/domain/rubric.ts` (new) | utility/domain | transform | `src/lib/lab/domain/cost-coverage.ts` | role-match |
| `src/lib/lab/run-snapshot.ts` (modify) | utility/domain | transform | itself (F48.1) | exact |
| `src/lib/lab/run-service.ts` (modify) | service | request-response | itself (F48.1) | exact |
| `src/lib/lab/diagnostics/schema.ts` (new) | utility/domain | transform | `src/lib/lab/scenarios/schema.ts` | exact |
| `src/lib/lab/diagnostics/service.ts` (new) | service | file-I/O | `src/lib/lab/scenarios/service.ts` | exact |
| `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v1.json` (new) | config/data | file-I/O | `fixtures/lab/scenarios/produto-oferta-preco/scenario.json` | role-match |
| `src/lib/lab/scenarios/schema.ts` (modify) | utility/domain | transform | itself (F48.1) | exact |
| `fixtures/lab/scenarios/<6 new slugs>/scenario.json` + `images/*` (new) | config/data | file-I/O | `fixtures/lab/scenarios/produto-oferta-preco/scenario.json` | exact |
| `scripts/uat/48-local-scenarios.mjs` (modify) / new bootstrap (new) | utility | batch | `scripts/uat/48-local-scenarios.mjs` | exact |
| `src/lib/lab/api/run-execution.ts` (modify) | service | request-response | itself (F48.1) | exact |
| `src/lib/lab/api/evaluation-service.ts` (modify) | service | CRUD | itself (F48.1) | exact |
| `src/lib/lab/api/estimate.ts` (modify) | service | transform | itself (F48.1) | exact |
| `src/lib/lab/api/program-queries.ts` (new) | service | CRUD/read | `src/lib/lab/api/experiment-queries.ts` | exact |
| `src/lib/admin/schemas.ts` (modify) | config | transform | itself (F48.1 lab section) | exact |
| `src/app/api/admin/laboratorio/programs/route.ts` (new) | route | request-response | `src/app/api/admin/laboratorio/experiments/route.ts` | exact |
| `src/app/api/admin/laboratorio/programs/[id]/route.ts` (new) | route | request-response | `src/app/api/admin/laboratorio/experiments/[id]/route.ts` | exact |
| `src/app/api/admin/laboratorio/experiments/route.ts` (modify) | route | request-response | itself (F48.1) | exact |
| `src/app/api/admin/laboratorio/experiments/[id]/estimate/route.ts` (modify) | route | request-response | itself (F48.1) | exact |
| `src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts` (modify) | route | streaming (NDJSON) | itself (F48.1) | exact |
| `src/app/api/admin/laboratorio/experiments/[id]/evaluations/route.ts` (modify) | route | request-response | itself (F48.1) | exact |
| `src/app/(app)/admin/laboratorio/programas/page.tsx` (new) | component (server page) | CRUD/read | `src/app/(app)/admin/laboratorio/cenarios/page.tsx` + `page.tsx` | role-match |
| `src/app/(app)/admin/laboratorio/layout.tsx` (modify) | component | — | itself (F48.1) | exact |
| `src/app/(app)/admin/laboratorio/_components/experiment-form.tsx` (modify) | component (client) | request-response | itself (F48.1) | exact |
| `src/app/(app)/admin/laboratorio/_components/run-execution-panel.tsx` (modify) | component (client) | streaming + request-response | itself (F48.1) | exact |
| `src/app/(app)/admin/laboratorio/_components/evaluation-form.tsx` (modify) | component (client) | request-response | itself (F48.1) | exact |
| `src/app/(app)/admin/laboratorio/_components/rubric-form.tsx` (new) | component (client) | transform | `evaluation-form.tsx` + `lab-radio-group.tsx` + `lab-textarea.tsx` | role-match |
| `src/app/(app)/admin/laboratorio/_components/budget-panel.tsx` (new) | component (client) | request-response | `run-execution-panel.tsx` (estimate block) | role-match |
| `src/app/(app)/admin/laboratorio/_components/program-form.tsx` (new) | component (client) | request-response | `experiment-form.tsx` | role-match |
| `src/lib/ai/__tests__/architecture-guard.test.ts` (modify) | test | — | itself (F48.1 lab gates) | exact |
| `src/lib/lab/**/__tests__/*.contract.test.ts` (new/modify) | test | — | `src/lib/lab/__tests__/lab-runs.contract.test.ts`, `lab-financial-safety.contract.test.ts` | exact |
| `docs/lab/48-2-1-<prompt>-report.md` (new, final report) | config/data | file-I/O | **no analog** (first versioned Markdown report) | none |
| Candidate prompt drafts (`fixtures/lab/prompts/...` or inline override) (new) | config/data | file-I/O | **no analog** (F48.1 had no candidate file; override is in-memory) | none |

---

## Pattern Assignments

### `supabase/migrations/2026XXXXXXXXXX_f48_2_1_lab_prompt_programs.sql` (migration, DDL/batch)

**Analog:** `supabase/migrations/20260915000003_f48_1_lab_immutability_and_reserve.sql` (triggers + RPC) and `supabase/migrations/20260915000002_f48_1_create_lab_tables.sql` (tables + RLS + REVERT)

**Header / local-only convention** (`...000002_...create_lab_tables.sql:1-21`):
```sql
-- Migration F48.1 — ... (design D3/D4/D5/D8/D10/D13/D14/D16)
-- LOCAL-FIRST: esta migration é criada e validada SOMENTE no Supabase local
-- (`npx supabase db reset` + `npx supabase db lint`). NÃO aplicar no remoto nesta task.
-- Migration estritamente ADITIVA: nenhum DROP/ALTER de objeto pré-existente.
```
Apply the same header but say **F48.2.1** and **no remote push at all** (D11; the remote push belongs to F48.2.3).

**Table creation + RLS + grants pattern** (`...000002:26-36`, `:196-262`):
```sql
CREATE TABLE IF NOT EXISTS public.lab_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
...
ALTER TABLE public.lab_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage lab_scenarios"
  ON public.lab_scenarios FOR ALL TO service_role
  USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE public.lab_scenarios FROM anon;
REVOKE ALL ON TABLE public.lab_scenarios FROM authenticated;
REVOKE ALL ON TABLE public.lab_scenarios FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_scenarios TO service_role;
```
Replicate for the new `lab_prompt_programs` table (D2 columns: `budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`, `matrix_version`, `status`, `final_report_ref`, `final_report_hash`, `recommendation JSONB`, `budget_authorized_by/at`, `created_by`, timestamps).

**Freeze trigger to extend** (`...000003:126-149`) — add `campaign_intent` and `program_id` to the frozen column set:
```sql
CREATE OR REPLACE FUNCTION public.trg_lab_experiments_freeze_fn()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.model_target IS DISTINCT FROM OLD.model_target
     OR NEW.params IS DISTINCT FROM OLD.params
     OR NEW.changed_dimension IS DISTINCT FROM OLD.changed_dimension
     OR NEW.primary_capability IS DISTINCT FROM OLD.primary_capability
     OR NEW.repetitions IS DISTINCT FROM OLD.repetitions
     OR NEW.max_runs IS DISTINCT FROM OLD.max_runs THEN
    IF EXISTS (SELECT 1 FROM public.lab_runs WHERE experiment_id = OLD.id) THEN
      RAISE EXCEPTION 'lab_experiment_frozen';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
```

**Ordering + backfill pattern (D2)** — the migration MUST: (1) `CREATE TABLE lab_prompt_programs` first; (2) `ALTER TABLE lab_experiments ADD COLUMN campaign_intent TEXT`; (3) `UPDATE lab_experiments SET campaign_intent='offer' WHERE campaign_intent IS NULL`; (4) `ALTER COLUMN campaign_intent SET NOT NULL` + `CHECK (... IN ('offer','spotlight','exclusive'))`; (5) `ADD COLUMN program_id UUID REFERENCES lab_prompt_programs(id)`; (6) `ALTER TABLE lab_human_evaluations ADD COLUMN rubric JSONB`.

**RPC extension pattern** (`...000003:252-406`) — `lab_reserve_run` is `SECURITY DEFINER`, `SET search_path = ''`, locks the experiment `FOR UPDATE` before any check, derives `run_sequence` in the DB, and translates `unique_violation` into `run_already_active`/`idempotency_conflict`:
```sql
CREATE OR REPLACE FUNCTION public.lab_reserve_run(...) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  ...
  SELECT * INTO v_experiment FROM public.lab_experiments
  WHERE id = p_experiment_id FOR UPDATE;   -- lock FIRST
  IF NOT FOUND THEN RAISE EXCEPTION 'experiment_not_found'; END IF;
  ...
  -- NEW (D2/D5): lock lab_prompt_programs, reject program_not_authorized/budget_exceeded,
  -- add estimated to budget_reserved_usd, idempotent by p_operation_id
EXCEPTION
  WHEN unique_violation THEN ... RAISE EXCEPTION 'run_already_active';
END; $$;

REVOKE EXECUTE ON FUNCTION public.lab_reserve_run(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lab_reserve_run(...) TO service_role;
```
Extend `lab_create_experiment` (`...000003:419-485`) to accept and insert `p_campaign_intent` + `p_program_id` (DV-6). Keep `REVOKE`/`GRANT` on the new signatures.

**REVERT block** — every migration ends with a commented reverse block (`...000002:289-326`, `...000003:487-509`). Add one: drop FK/columns → drop `lab_prompt_programs`.

---

### `src/lib/lab/domain/prompt-snapshot.ts` (utility/domain, transform, D4)

**Analog:** itself.

**Current single constant to replace** (lines 26-33, 140-154):
```typescript
export const PROMPT_UNDER_TEST = "campaign-image-director-offer";
export const UNSUPPORTED_PROMPT_UNDER_TEST = "unsupported_prompt_under_test";
...
export function buildCandidatePromptSnapshot(input: {
  promptName: string;
  promptContent: string;
}): CandidatePromptSnapshot {
  if (input.promptName !== PROMPT_UNDER_TEST) {
    throw new Error(`${UNSUPPORTED_PROMPT_UNDER_TEST}:${input.promptName}`);
  }
  assertPromptContentSafe(input.promptContent, "candidate");
  return { name: input.promptName, content: input.promptContent,
           contentHash: computePromptContentHash(input.promptContent), source: "override" };
}
```
New shape (D4): `DIRECTOR_PROMPTS = { offer, spotlight, exclusive }` (e.g. `Record<CampaignIntent, string>` mapping intent → `campaign-image-director-{intent}`). Both `buildBaselinePromptSnapshot` and `buildCandidatePromptSnapshot` must take the `campaignIntent` (or resolved prompt name) and reject a name that does not match the intent with `unsupported_prompt_under_test`.

**Keep untouched:** `computePromptContentHash` (49-51), sensitive-content rejection (56-108). Baseline still `source: "official"` read from `PromptLoader` (117-130); candidate still `source: "override"` (140-154). `prompts/` is never written (guarantee T-48-1-27).

---

### `src/lib/lab/domain/schemas.ts` (utility/domain, transform, D4/D7)

**Analog:** itself.

**Extend `CreateLabExperimentInputSchema`** (lines 72-118) with:
- `campaignIntent: z.enum(["offer","spotlight","exclusive"])`
- `programId: z.string().uuid()`
- keep `.strict()`; add a `superRefine` that derives the prompt from intent and rejects a mismatch.

**Evaluation schema to extend with the rubric** (lines 122-146):
```typescript
export const LAB_EVALUATION_VERDICTS = ["baseline", "candidate", "tie", "none"] as const;
export const LAB_BLIND_ORDERS = ["baseline_left", "candidate_left"] as const;
export const CreateLabEvaluationInputSchema = z.object({
  scenarioVersionId: z.string().uuid(),
  baselineRunId: z.string().uuid(),
  candidateRunId: z.string().uuid(),
  verdict: z.enum(LAB_EVALUATION_VERDICTS),
  blindOrder: z.enum(LAB_BLIND_ORDERS).optional(),
  observation: z.string().max(4000).optional(),
  // NEW (D7): rubric: Record<RubricCriterion, { state, observation? }>
}).strict().superRefine(...);
```

**Error class pattern** (`UnsupportedChangedDimensionError`, 155-166) — model the new `unsupported_prompt_under_test` / `program_not_authorized` rejections on this: a class with a `readonly code`, a `readonly <culprit>` field, and a message that never leaks content.

**Parsing helpers** (`serializeIssues`, 170-174; `readChangedDimension`, 176-180; `parseCreateLabExperimentInput`, 189-202) — reuse the "pre-detect a custom issue → throw typed error; else serialize issues" idiom for the new intent/program/rubric validation.

---

### `src/lib/lab/domain/experiment-service.ts` (service, CRUD, D4/D5)

**Analog:** itself.

**Atomic creation via RPC** (lines 191-227):
```typescript
export async function createExperiment(input, context): Promise<{ experimentId: string }> {
  const parsed = parseCreateLabExperimentInput(input);
  await validateModelTargetAgainstCatalog(parsed.modelTarget, context.client);
  const baselineSnapshot = buildBaselinePromptSnapshot();
  const candidateSnapshot = buildCandidatePromptSnapshot(parsed.candidate);
  const { data, error } = await context.client.rpc("lab_create_experiment", {
    p_name: parsed.name, ..., p_actor_id: context.actorId,
  });
  if (error) throw new Error(`lab_create_experiment_failed:${error.message}`);
  ...
}
```
Change to: pass `campaignIntent` into `buildBaselinePromptSnapshot`/`buildCandidatePromptSnapshot`, and add `p_campaign_intent` / `p_program_id` to the RPC call.

**Readiness reasons** (`READINESS_REASONS`, 57-65; `computeExperimentReadiness`, 122-180) — add reasons for intent/program (e.g. `missing_program`, `intent_mismatch`, `program_not_authorized`) following the same "push a code, never throw for incomplete config" contract.

**Freeze guard** (`assertConfigurationEditable`, 277-292) — already models the post-first-run freeze; extend conceptually to cover `campaign_intent`/`program_id` (the DB trigger is the authoritative gate).

---

### `src/lib/lab/domain/program-service.ts` (new service, CRUD)

**Analog:** `src/lib/lab/domain/experiment-service.ts` (service shape) + `src/lib/lab/api/experiment-queries.ts` (Supabase read/write with per-param client).

**Client-injected service pattern** (`experiment-service.ts:69-72`, `:92-110`):
```typescript
export interface LabExperimentContext { actorId: string; client: SupabaseClient; }

async function readExperimentConfig(experimentId: string, client: SupabaseClient): Promise<ExperimentConfigRow> {
  const { data, error } = await client.from("lab_experiments")
    .select("status, changed_dimension, repetitions, max_runs, model_target")
    .eq("id", experimentId).maybeSingle();
  if (error) throw new Error(`lab_experiment_read_failed:${error.message}`);
  if (!data) throw new Error(`experiment_not_found:${experimentId}`);
  return data as unknown as ExperimentConfigRow;
}
```
Program service should expose: `createProgram` (matrix label + budget authorization via RPC or insert), `getProgram`, `updateProgram` (status, report ref/hash, recommendation), and a `remainingUsd = budget_usd - budget_consumed_usd - budget_reserved_usd` helper (D2/D9). Errors as `program_not_authorized` / `budget_exceeded` following the typed-error pattern.

**Row-mapping helpers** (`experiment-queries.ts:26-52`) — reuse `asRows`, `asRow`, `text`, `num` local helpers rather than adding a shared util (matches F48.1 style).

---

### `src/lib/lab/domain/rubric.ts` (new utility/domain, transform, D7)

**Analog:** `src/lib/lab/domain/cost-coverage.ts` (small pure domain module with exported union + pure function).

**Pattern** (`cost-coverage.ts:18-38`):
```typescript
export type LabCostCoverage = "complete" | "partial" | "missing";
export function deriveCostCoverage(cost: CostResolution): LabCostCoverage { ... }
```
New module: export `RUBRIC_CRITERIA` (the 9 criteria), `RUBRIC_STATES = ["adequate","minor_defect","critical_defect","not_applicable"]`, a `LabRubric` type, and pure validators. **No scoring** — the module must not export any aggregate score/nota (D7 / spec `lab-human-evaluation`). Keep it pure (no `server-only`) so the client form and tests can import it.

---

### `src/lib/lab/run-snapshot.ts` (utility/domain, transform, D5/DV-3)

**Analog:** itself.

**Snapshot interface + builder** (lines 52-70, 90-129) and **completeness barrier** (142-179):
```typescript
export interface LabRunSnapshot {
  scenarioVersionId: string; scenarioVersion: number; scenarioContentHash: string;
  prompt: LabRunSnapshotPrompt; capability: "campaign_image";
  modelTarget: { provider: string; model: string; protocol: string };
  params: LabRunSnapshotParams; changedDimension: "prompt"; variantRole: LabVariantRole;
  codeVersion: LabCodeVersion | null; baselineConfig: LabRunVariantConfig;
  candidateConfig: LabRunVariantConfig; runType: "lab";
  // NEW (D5): programId: string;
}
...
export function assertSnapshotComplete(snapshot: LabRunSnapshot | null | undefined): void {
  if (!snapshot) throw new Error(MISSING_SNAPSHOT);
  ...
  if (!isNonEmptyString(snapshot.modelTarget?.protocol)) throw new Error(MISSING_SNAPSHOT);
  if (snapshot.variantRole !== "baseline" && snapshot.variantRole !== "candidate") throw new Error(MISSING_SNAPSHOT);
  // NEW: if (!isNonEmptyString(snapshot.programId)) throw new Error(MISSING_SNAPSHOT);
}
```
Add `programId` to both the interface, `buildLabRunSnapshot`, and `assertSnapshotComplete`.

---

### `src/lib/lab/run-service.ts` (service, request-response, D2/D5)

**Analog:** itself.

**Reservation error mapping** (lines 46-101, 110-149) — extend `LAB_RESERVATION_ERROR_CODES` with `program_not_authorized` and keep `budget_exceeded`:
```typescript
export const LAB_RESERVATION_ERROR_CODES = [
  "budget_exceeded", "run_already_active", "missing_snapshot", "missing_operation_id",
  "experiment_not_found", "experiment_not_ready", "idempotency_conflict",
  "variant_not_in_experiment", "scenario_not_in_experiment", "repetition_out_of_range",
  "invalid_supersedes_run",
  // NEW (D2/D5): "program_not_authorized"
] as const;

export class LabReservationError extends Error {
  readonly code: LabReservationErrorCode;
  constructor(code: LabReservationErrorCode) { super(code); this.name = "LabReservationError"; this.code = code; }
}
```
`reserveLabRun` (110-149) calls the RPC with `p_snapshot` in the same transaction — the budget debit happens **inside** `lab_reserve_run` (D2), so the TS side only maps the new codes. Keep the two-phase split `prepareLabRun` (493-537) → `runReservedLabRun` (547-693); the terminal `finally` (678-692) already guarantees a terminal state.

---

### `src/lib/lab/diagnostics/schema.ts` (new utility/domain, transform, D3)

**Analog:** `src/lib/lab/scenarios/schema.ts` (pure Zod module, no `server-only`).

**Pattern** (`scenarios/schema.ts:1-21`, `:174-224`):
```typescript
import { z } from "zod";
/**
 * Módulo **puro** — sem `server-only`, sem I/O e sem `process.env`.
 */
export const LabScenarioContentSchema = z.object({
  slug: z.string().regex(SCENARIO_SLUG_PATTERN), ...,
}).strict().superRefine((value, ctx) => { ... });
export type LabScenarioContent = z.infer<typeof LabScenarioContentSchema>;
```
New schema (D3):
```typescript
{ schemaVersion, diagnosticVersion, generatedAt, sourceRefs: string[], contentHash,
  items: [{ failureCode, evidence, probableCause, promptTreatable: boolean,
            minimalHypothesis, promptName }] }
```
Export a `parsePromptDiagnostics(input): LabPromptDiagnostics` following `parseLabScenarioContent` (273-293): typed custom error first, then normal Zod error serialization.

---

### `src/lib/lab/diagnostics/service.ts` (new service, file-I/O, D3)

**Analog:** `src/lib/lab/scenarios/service.ts` (JSON load + canonical SHA-256 + version resolution + path confinement). This is the closest analog in the codebase — copy its structure directly.

**Canonical hash** (`scenarios/service.ts:43-70`):
```typescript
function sortJsonValue(value: unknown): JsonValue {
  if (Array.isArray(value)) return value.map((entry) => sortJsonValue(entry));
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortJsonValue(record[key]);
    return sorted;
  }
  return value as JsonValue;
}
export function canonicalizeScenarioContent(content: LabScenarioContent): string {
  return JSON.stringify(sortJsonValue(content));
}
export function computeScenarioContentHash(content: LabScenarioContent): string {
  return createHash("sha256").update(canonicalizeScenarioContent(content), "utf8").digest("hex");
}
```
**D3 difference:** the diagnostics hash must exclude the `contentHash` field itself (non-self-referential). Implement `computeDiagnosticsContentHash` by stripping `contentHash` before canonicalizing.

**Version resolution + immutability** (`scenarios/service.ts:338-379` `materializeScenarios`, and `:262-290` `listScenarioFixtures`): load the **largest `diagnosticVersion`** from `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v{N}.json`; a new version is a new file; older files are never rewritten.

**Path confinement** (`scenarios/service.ts:74-119`): reuse the `assertWithinRoot` + `realpath` anti-traversal/symlink idiom (constants `INVALID_SCENARIO_PATH`). Define a `DIAGNOSTICS_FIXTURES_DIR = "fixtures/lab/diagnostics"`.

**Fixture directory constant** (`scenarios/service.ts:29-30`): mirror `export const SCENARIOS_FIXTURES_DIR = "fixtures/lab/scenarios";`.

---

### `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v1.json` (new config/data, D3)

**Analog:** `fixtures/lab/scenarios/produto-oferta-preco/scenario.json` (versioned, hashed JSON fixture).

**Shape** (scenario.json:1-45) — plain JSON, explicit fields, no secrets. New file mirrors the D3 contract:
```json
{
  "schemaVersion": 1,
  "diagnosticVersion": 1,
  "generatedAt": "2026-09-25T00:00:00.000Z",
  "sourceRefs": ["..."],
  "contentHash": "<sha256 over canonical JSON without contentHash>",
  "items": [
    { "failureCode": "...", "evidence": "...", "probableCause": "...",
      "promptTreatable": true, "minimalHypothesis": "...",
      "promptName": "campaign-image-director-offer" }
  ]
}
```

---

### `src/lib/lab/scenarios/schema.ts` (modify, D4/DV-5)

**Analog:** itself.

**The exact line to change** (lines 54-58):
```typescript
export const SUPPORTED_SCENARIO_MODES = {
  intents: ["offer"],
  formats: ["1:1"],
  locales: ["pt-BR"],
} as const;
```
→ `intents: ["offer","spotlight","exclusive"]`. **Do not change** `SCENARIO_INTENTS` (25-31, already includes them), `formats`, or `locales`. The `detectUnsupportedMode` (244-262) and `UnsupportedScenarioModeError` (74-85) machinery needs no change — it keys off `SUPPORTED_*` sets (60-62). The scenario must **not** carry diagnostics (D4 / spec `lab-scenarios`).

---

### `fixtures/lab/scenarios/<6 new slugs>/scenario.json` + images (new config/data, D4)

**Analog:** `fixtures/lab/scenarios/produto-oferta-preco/scenario.json` (full fixture shape, lines 1-45). Preserve the three offer slugs (`produto-oferta-preco`, `produto-oferta-texto-obrigatorio`, `produto-oferta-logo`), create new versions if needed, and add 3 `spotlight` + 3 `exclusive` fixtures with controlled images. All `format: "1:1"`, `locale: "pt-BR"`, `fictitious: true`, exactly one `role: "primary"` image (schema superRefine, 214-221). Attribute coverage must satisfy the `lab-prompt-optimization` matrix (price promo/original, single price, mandatory no-price, logo/textual identity, mandatory texts, illustrative notice, validity, no CTA/hook, multiple images, packaging, contextual photo, isolated product, long names, stress conditions).

---

### `scripts/uat/48-local-scenarios.mjs` (modify/new bootstrap, batch, D4)

**Analog:** itself (`scripts/uat/48-local-scenarios.mjs`, 1-215).

**Local-host fail-closed guard** (lines 36-56) and **idempotent hash materialization** (122-195):
```javascript
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;
const PRODUCTION_DOMAINS = ["supabase.co", "supabase.in", "supabase.com"];
...
if (rows.some((row) => row.content_hash === contentHash)) { skipped += 1; continue; }
const nextVersion = rows.reduce((max, row) => Math.max(max, row.version), 0) + 1;
```
Reuse verbatim; the bootstrap automatically picks up the 6 new fixture directories via `listFixtureSlugs()`. If a separate diagnostics bootstrap is added, mirror this script's connection resolution and `assertLocalHost` guard. A content-coverage test (task 2.6) should assert each mandatory matrix attribute is covered by ≥1 fixture.

---

### `src/lib/lab/api/run-execution.ts` (modify, request-response, D5)

**Analog:** itself.

**Experiment read + prompt snapshot mapping** (lines 122-271) and **runtime wiring** (280-326):
```typescript
const { data: experiment } = await client.from("lab_experiments")
  .select("id, model_target, params, status").eq("id", experimentId).maybeSingle();
...
const prepared = await prepareLabRun({ client, experimentId, variantId: input.variantId, ... });
...
const runtime = await createDefaultLabRuntime({ fixedTarget: executionContext.experiment.modelTarget });
const promptLoader = new LabPromptLoader([{ name: ..., content: ... }]);
const imageService = new ImageGenerationService(createNoopImageProvider(), promptLoader);
```
Add: read `campaign_intent`/`program_id`; assert the experiment intent equals every linked scenario's intent (reject mixed intents); assert the program is authorized before `prepareLabRun` (defense-in-depth; the RPC also enforces it). Keep the single `runLabCampaignImage` invocation (no fallback, no reviewer).

---

### `src/lib/lab/api/evaluation-service.ts` (modify, CRUD, D7)

**Analog:** itself.

**Validation chain + append-only insert** (lines 57-163):
```typescript
const input = parseCreateLabEvaluationInput(params.input);
// read both runs → same experiment + same scenario + terminal → correct roles
const { data: inserted, error: insertError } = await params.client
  .from("lab_human_evaluations")
  .insert({
    experiment_id: params.experimentId, scenario_version_id: input.scenarioVersionId,
    baseline_run_id: input.baselineRunId, candidate_run_id: input.candidateRunId,
    blind_order: input.blindOrder ?? null, verdict: input.verdict,
    observation: input.observation ?? null, evaluator_id: params.evaluatorId,
    // NEW (D7): rubric: input.rubric ?? null
  })
  .select("id, created_at").single();
```
Keep append-only (never update/delete) and the `running → evaluated` transition (148-157). Add rubric persistence and keep `blind_order` null unless the choice was blind.

---

### `src/lib/lab/api/estimate.ts` (modify, transform, D9/D10)

**Analog:** itself.

**Per-capability estimate** (lines 70-125):
```typescript
const plannedRuns = row.repetitions * scenarioCount;
const remainingRuns = Math.max(0, row.max_runs - usedRuns);
const perRun = await estimateLabCampaignImageCost({ provider: row.model_target.provider, model: row.model_target.model });
const perRunCoverage = deriveCostCoverage(perRun);
const totalEstimatedUsd = perRun.estimatedCostUsd === null ? null
  : Number((perRun.estimatedCostUsd * plannedRuns).toFixed(6));
```
**D9 change:** the plan is `cenários × duas variantes × repetições` → `plannedRuns = scenarioCount * 2 * repetitions`. Also return the program's **remaining balance** (`budget_usd - budget_consumed_usd - budget_reserved_usd`) and coverage. Never block on incomplete pricing (keep the `partial`/`missing` semantics, 17-22).

---

### `src/lib/lab/api/program-queries.ts` (new service, CRUD/read)

**Analog:** `src/lib/lab/api/experiment-queries.ts` (read layer with `client` param and `asRows/asRow/text/num` helpers).

**Listing + budget pattern** (`experiment-queries.ts:172-223`):
```typescript
export async function listRecentExperiments(client, limit = 20): Promise<LabExperimentSummary[]> {
  const { data: experiments, error } = await client.from("lab_experiments")
    .select("id, name, status, repetitions, max_runs, updated_at")
    .order("updated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`lab_experiments_read_failed:${error.message}`);
  ...
  return asRows(experiments).map((experiment) => ({ ..., remainingRuns: Math.max(0, maxRuns - runsUsed) }));
}
```
Add `listPrograms`, `getProgramDetail`, `remainingUsd` derivation. Read-only except the explicit authorization/report updates (D10). Do **not** expose full scenario content/base64 (`experiment-queries.ts:20-24`).

---

### `src/lib/admin/schemas.ts` (modify, transform, D10)

**Analog:** itself (lab section, lines 248-310).

**Re-export domain schema** (lines 261, 270-308):
```typescript
export const LabExperimentCreateRequestSchema = CreateLabExperimentInputSchema;
export const LabRunExecuteRequestSchema = z.object({
  variantId: z.string().uuid(), scenarioVersionId: z.string().uuid(),
  repetitionIndex: z.number().int().min(1).max(MAX_REPETITIONS),
  supersedesRunId: z.string().uuid().nullable().optional(),
  confirmed: z.literal(true), operationId: z.string().uuid(),
}).strict();
```
Add: `LabProgramCreateRequestSchema` (matrix version + budget authorization USD), `LabProgramUpdateRequestSchema` (status, report ref/hash, recommendation), and extend `LabEvaluationRequestSchema` with the rubric. Reuse domain schemas — never duplicate validations (comment at 248-252).

---

### `src/app/api/admin/laboratorio/programs/route.ts` + `programs/[id]/route.ts` (new routes, request-response)

**Analog:** `src/app/api/admin/laboratorio/experiments/route.ts` (POST/GET) and `experiments/[id]/route.ts` (GET).

**Mandatory route skeleton** (`experiments/route.ts:23-102`):
```typescript
export const GET = apiHandler(async () => {
  await requireAdmin();
  try { assertLabEnvironment(); } catch (error) {
    if (error instanceof LabEnvironmentError)
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    throw error;
  }
  try { const experiments = await listRecentExperiments(supabaseAdmin);
        return NextResponse.json({ experiments }); }
  catch { return NextResponse.json({ error: "Falha ao ler os experimentos" }, { status: 503 }); }
});

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  // assertLabEnvironment() ...
  let raw: unknown; try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }
  try { const input = parseCreateLabExperimentInput(raw); ... }
  catch (error) { if (error instanceof UnsupportedChangedDimensionError)
      return NextResponse.json({ error: "unsupported_changed_dimension" }, { status: 400 }); ... }
});
```
The `[id]` route pattern (`experiments/[id]/route.ts:13-37`): `params: Promise<{ id: string }>`, `const { id } = await params;`, 404 when not found. Program routes add authorization (budget) and report/recommendation registration; map `program_not_authorized`/`budget_exceeded` to 409.

---

### `src/app/api/admin/laboratorio/experiments/route.ts` (modify, D10)

**Analog:** itself.

Extend POST to pass `campaignIntent`/`programId` through `parseCreateLabExperimentInput` and map new errors (`program_not_authorized` 409, intent mismatch 400) following the existing `ModelTargetNotInCatalogError` mapping (96-101). The GET/detail response (`experiment-queries.ts:420-546`) must include `campaign_intent`, `program_id`, and the program remaining balance.

---

### `src/app/api/admin/laboratorio/experiments/[id]/estimate/route.ts` (modify, D10)

**Analog:** itself.

Response shape (`estimate/route.ts:37-44`) — extend with program balance/authorization; keep `perRun`/`coverage`/`totalEstimatedUsd` and the `LAB_EXPERIMENT_NOT_FOUND` → 404 mapping (45-50).

---

### `src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts` (modify, streaming, D10/D5)

**Analog:** itself.

**Confirmation-before-parse + conflict/bad-request code maps** (lines 19-125):
```typescript
const CONFLICT_CODES = ["budget_exceeded","run_already_active","idempotency_conflict",
  "experiment_not_ready","scenario_hash_mismatch"];            // NEW: "program_not_authorized"
const BAD_REQUEST_CODES = ["missing_snapshot","missing_operation_id",
  "variant_not_in_experiment","scenario_not_in_experiment","repetition_out_of_range",
  "invalid_supersedes_run","unsupported_scenario_mode"];
...
if (raw === null || ... .confirmed !== true)
  return NextResponse.json({ error: "confirmation_required" }, { status: 422 });
```
Keep the NDJSON stream (136-173) and the "single owner of terminal events" rule (148-152). Add `program_not_authorized` to `CONFLICT_CODES` (409) so no paid call starts.

---

### `src/app/api/admin/laboratorio/experiments/[id]/evaluations/route.ts` (modify, D10/D7)

**Analog:** itself. Add rubric to the parsed payload and keep the `InvalidComparisonRunsError` → 400 mapping (57-62).

---

### `src/app/(app)/admin/laboratorio/programas/page.tsx` (new server page, CRUD/read)

**Analog:** `src/app/(app)/admin/laboratorio/page.tsx` (list + empty/error states) and `cenarios/page.tsx` (read-only listing).

**Environment guard first** (`page.tsx:77-95`):
```typescript
export const dynamic = "force-dynamic";
export default async function LaboratorioPage() {
  const env = getLabEnvironment();
  if (!env.enabled) return <DisabledNotice reason={env.reason} />;
  let experiments = []; let readFailed = false;
  try { [experiments, pending] = await Promise.all([...]); } catch { readFailed = true; }
  ...
}
```
Use `PageHeader`, `EmptyState`, `ErrorState`, `Badge`, `LabTable` (all already imported in the home page). Show matrix (nine scenarios), budget authorized/reserved/consumed, remaining balance, report and recommendation (UI-SPEC line 93). Add "Programas" to the lab nav.

---

### `src/app/(app)/admin/laboratorio/layout.tsx` (modify, D10)

**Analog:** itself.

**Nav array** (lines 19-23):
```typescript
const LAB_NAV_ITEMS = [
  { href: "/admin/laboratorio", label: "Experimentos" },
  { href: "/admin/laboratorio/cenarios", label: "Cenários" },
  { href: "/admin/laboratorio#avaliacoes-pendentes", label: "Avaliações" },
  // NEW: { href: "/admin/laboratorio/programas", label: "Programas" },
];
```
Keep the env guard before children (30-34) and the single "Laboratório" link in the parent admin nav (D1). **No** new link in `src/app/(app)/admin/layout.tsx`.

---

### `src/app/(app)/admin/laboratorio/_components/experiment-form.tsx` (modify, client, D10)

**Analog:** itself.

**Fixed (read-only) field pattern** (lines 74-96) and **submit payload** (217-234):
```tsx
function FixedField({ label, value, testId }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-text-secondary font-heading">{label}</span>
      <p data-testid={testId} className="min-h-[44px] w-full break-words rounded-lg border border-border bg-bg-deep/40 px-3 py-2 font-mono text-sm text-text-primary">{value}</p>
    </div>
  );
}
...
body: JSON.stringify({ name, objective, hypothesis, changedDimension: "prompt",
  modelTarget, params: { ...defaultParams, skipInputValidation: true },
  repetitions, maxRuns, scenarioVersionIds,
  baseline: { promptName }, candidate: { promptName, promptContent: values.candidateContent } }),
```
Add: a **campaign intent** `LabSelect` (Oferta/Destaque/Exclusivo) that derives `promptName` from `DIRECTOR_PROMPTS` (display read-only via `FixedField` testId `lab-prompt-under-test`), a **program** `LabSelect` (required), and send `campaignIntent` + `programId`. Keep inline validation-on-blur (168-205) and the `API_ERROR_MESSAGES` map (58-72) — add `program_not_authorized` / intent-mismatch messages.

**Scenario filter:** the scenario `LabSelect` (320-335) must only list scenarios whose `intent` matches the chosen campaign intent.

---

### `src/app/(app)/admin/laboratorio/_components/run-execution-panel.tsx` (modify, client, D10/D9)

**Analog:** itself.

**Estimate block + coverage-aware formatting** (lines 103-123, 414-471):
```tsx
function formatCostByCoverage(value, coverage) {
  if (coverage === "complete") return formatUsd(value);
  if (coverage === "partial") return typeof value === "number" ? `a partir de US$ ${value.toFixed(4)}` : "indisponível";
  return "indisponível";
}
...
{estimate.coverage !== "complete" && (
  <p className="flex items-start gap-2 rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 text-xs text-accent-amber">
    <AlertTriangle ... /> <span>Pricing parcial ou indisponível — o valor é uma faixa/aviso, não um valor exato.</span>
  </p>
)}
```
Add the **remaining program balance** display (mono) and `program_not_authorized`/`budget_exceeded` messages to `RUN_ERROR_MESSAGES` (83-94). Keep the three-step financial barrier (estimate → `ConfirmDialog` → `confirmed: true` + idempotent `operationId`, 259-336) and the NDJSON consumer (215-257). The estimate now reflects `cenários × 2 variantes × repetições`.

---

### `src/app/(app)/admin/laboratorio/_components/rubric-form.tsx` (new client, transform, D7)

**Analog:** `evaluation-form.tsx` (radio verdict + observation + append-only submit) + `lab-radio-group.tsx` (native `<fieldset>/<legend>/<input type="radio">`) + `lab-textarea.tsx`.

**Radio group pattern** (`lab-radio-group.tsx:36-80`):
```tsx
<fieldset className="flex flex-col gap-2">
  <legend className="text-xs font-medium uppercase tracking-wider text-text-secondary font-heading">{legend}</legend>
  <div className="flex flex-wrap gap-4">
    {options.map((option) => (
      <label key={option.value} htmlFor={optionId} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-text-primary font-body">
        <input type="radio" id={optionId} name={name} value={option.value}
          checked={value === option.value} onChange={() => onChange(option.value)} className="h-4 w-4 accent-accent-blue" />
        <span>{option.label}</span>
      </label>
    ))}
  </div>
</fieldset>
```
Render **nine criteria**, each with the 4 states + optional observation (use `LabRadioGroup` per criterion + `LabTextarea`). **No automatic score** (spec). The form must reset when the scenario/repetition pair changes — the parent comparison view should remount via a `key` on the pair (spec `lab-admin-ui` "Formulário reinicia com o par"). Submit sends `rubric` alongside verdict/observation through `evaluation-form.tsx`'s existing POST path.

---

### `src/app/(app)/admin/laboratorio/_components/budget-panel.tsx` (new client, request-response, D9/D10)

**Analog:** `run-execution-panel.tsx` estimate block (414-471) + `experiment-form.tsx` `FixedField` (74-96).

Display `budget_usd`, `budget_reserved_usd`, `budget_consumed_usd`, and `saldo restante = budget_usd - budget_consumed_usd - budget_reserved_usd` in JetBrains Mono (`font-mono`), with the "Autorizar orçamento" CTA (`accent.green`) for the program form. Amber warning when the balance approaches the ceiling (UI-SPEC line 104). Partial pricing → range/aviso, never an exact total.

---

### `src/app/(app)/admin/laboratorio/_components/program-form.tsx` (new client, request-response, D10)

**Analog:** `experiment-form.tsx` (field/validation/submit pattern). Reuse `LabSelect` (matrix version), `Input` (budget USD), and the `FixedField` read-only pattern. POST to `/api/admin/laboratorio/programs`; map `budget_exceeded`/`invalid_payload` via the `API_ERROR_MESSAGES` idiom (58-72).

---

### `src/lib/ai/__tests__/architecture-guard.test.ts` (modify, test, D11)

**Analog:** itself.

**Lab gate block** (lines 133-184) — extend with F48.2.1 gates:
```typescript
const labFiles = files.filter((file) => file.startsWith("src/lib/lab/"));
it("o laboratório não grava generation_events nem chama AiCostTracker.record", () => { ... });
it("o laboratório não instancia o provider de imagem de produção nem SDK/wire", () => { ... });
it("o laboratório não lê chaves de provider diretamente", () => { ... });
```
Add: (a) no write to `ai_model_selection`/`ai_model_catalog` from `src/lib/lab/**`; (b) `prompts/` not modified (byte-for-byte — assert via `git diff --name-only` in the phase verification, not here); (c) the three director prompts are accepted, no `campaign_image_review`. Keep gates strictly additive (comment 134-137).

---

### `src/lib/lab/**/__tests__/*.contract.test.ts` (new/modify tests)

**Analog:** `src/lib/lab/__tests__/lab-runs.contract.test.ts` (execution/snapshot contract) and `src/lib/lab/__tests__/lab-financial-safety.contract.test.ts` (financial safety).

**Fake-client contract pattern** (`lab-runs.contract.test.ts:106-423`, `lab-financial-safety.contract.test.ts:113-350`):
```typescript
// @vitest-environment node
const { mockResolveAiCost } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  return { mockResolveAiCost: vi.fn() };
});
vi.mock("@/lib/ai-cost/cost-estimator", () => ({ resolveAiCost: mockResolveAiCost }));
...
class LabRunsFakeClient {
  readonly rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  async rpc(fn, args) { /* mirrors lab_reserve_run semantics */ }
  from(table) { return new FakeQueryBuilder(this, table); }
}
```
Extend the fake RPC to model budget reservation (`program_not_authorized`, `budget_exceeded`, idempotent by `operation_id`, reserved→consumed conversion, release on pre-call failure). Keep the **no-network / no-paid-call** hygiene suite (`lab-financial-safety.contract.test.ts:751-828`). New suites to model on: prompt allowlist/intent, mixed-intent rejection, freeze trigger, snapshot `programId`, rubric append-only, diagnostics version/hash, program budget.

---

## Shared Patterns

### Authentication + environment guard (all routes)
**Source:** `src/app/api/admin/laboratorio/experiments/route.ts:23-35`
**Apply to:** every new/modified route under `/api/admin/laboratorio/**`
```typescript
await requireAdmin();
try { assertLabEnvironment(); }
catch (error) {
  if (error instanceof LabEnvironmentError)
    return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
  throw error;
}
```

### Page-level environment guard (all lab pages)
**Source:** `src/app/(app)/admin/laboratorio/page.tsx:77-81` + `layout.tsx:30-34`
**Apply to:** `programas/page.tsx` and every modified lab page
```typescript
const env = getLabEnvironment();
if (!env.enabled) return <DisabledNotice reason={env.reason} />;
```

### Supabase access via `supabaseAdmin`, client passed by parameter
**Source:** `src/lib/lab/api/experiment-queries.ts:1-24`, `experiment-service.ts:69-72`
**Apply to:** all `src/lib/lab/**` services
```typescript
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
// every function receives `client: SupabaseClient` → tests inject in-memory fakes
```
Routes import `supabaseAdmin` from `@/lib/supabase/server` (`experiments/route.ts:17`).

### Typed deterministic errors with a `code`
**Source:** `src/lib/lab/domain/model-target.ts:27-38`, `run-service.ts:69-77`, `api/run-execution.ts:61-68`
**Apply to:** intent mismatch, `program_not_authorized`, `budget_exceeded`, rubric validation
```typescript
export class ModelTargetNotInCatalogError extends Error {
  readonly code = "model_target_not_in_catalog" as const;
  constructor(target: LabModelTarget) { super(`model_target_not_in_catalog:${...}`); this.name = "..."; }
}
```
The route layer maps `code` → HTTP (409 for budget/state, 400 for payload, 403 for env, 422 for confirmation).

### Canonical SHA-256 hashing of versioned JSON
**Source:** `src/lib/lab/scenarios/service.ts:43-70`
**Apply to:** diagnostics content hash, matrix version hash, final report hash
```typescript
export function computeScenarioContentHash(content) {
  return createHash("sha256").update(canonicalizeScenarioContent(content), "utf8").digest("hex");
}
```
For diagnostics, strip the `contentHash` field before canonicalizing (D3, non-self-referential).

### Local-first / no paid calls in tests
**Source:** `lab-financial-safety.contract.test.ts:751-828`, `architecture-guard.test.ts:154-184`
**Apply to:** all new tests
Fakes for `AiInvoker`/`LabTelemetrySink`; no provider SDK/wire; no `generation_events`; no `AiCostTracker.record`; fixtures only from `fixtures/lab/**`.

### NDJSON streaming for run execution
**Source:** `src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts:136-173` + `run-execution-panel.tsx:215-257`
**Apply to:** run route (unchanged shape) — one terminal event, `Content-Type: application/x-ndjson`.

### Design system tokens (all UI)
**Source:** `openspec/design-system/MASTER.md` + `48.2.1-UI-SPEC.md`
**Apply to:** all `_components/**` and pages
Dark OLED (`bg-bg-deep`/`bg-bg-surface`/`bg-bg-elevated`), accent `accent-green` for the single primary CTA, `accent-blue` for links/focus, `accent-amber` for partial pricing/inconclusive, `accent-red` for errors/`critical_defect`; Poppins headings, Open Sans body, JetBrains Mono for numbers/IDs/hashes; `lucide-react` only, no emojis; local primitives in `_components/` (never expand `src/components/ui/`).

---

## No Analog Found

Files with no close match in the codebase (planner should use the OpenSpec design/spec directly):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `docs/lab/48-2-1-<prompt>-report.md` (final report, D11) | config/data | file-I/O | First canonical Markdown optimization report in the repo; the DB only stores its ref/hash. Model structure on the spec `lab-prompt-optimization` "Relatório final por prompt". |
| Candidate prompt drafts (override content, D6) | config/data | file-I/O | F48.1 had no candidate prompt file — the candidate is an in-memory `override` submitted through the form (`prompt-snapshot.ts:140-154`). If versioned as fixtures, mirror the diagnostics fixture pattern. |
| `fixtures/lab/diagnostics/f37/f37-prompt-diagnostics.v1.json` content (D3) | config/data | file-I/O | The *loader* has an exact analog (`scenarios/service.ts`), but the diagnostic *content* (failure chain from F37 evidence) has no code analog. |

---

## Metadata

**Analog search scope:** `src/lib/lab/**`, `src/app/api/admin/laboratorio/**`, `src/app/(app)/admin/laboratorio/**`, `supabase/migrations/20260915*`, `fixtures/lab/**`, `scripts/uat/48-*`, `src/lib/admin/schemas.ts`, `src/lib/ai/__tests__/architecture-guard.test.ts`
**Files scanned (read):** 30 source/migration/fixture/test files
**Pattern extraction date:** 2026-09-25
**Base decisions:** F48.1 D1-D18 + F48.2.1 D1-D11; divergences DV-1..DV-8 resolved in `48.2.1-CONTEXT.md`
