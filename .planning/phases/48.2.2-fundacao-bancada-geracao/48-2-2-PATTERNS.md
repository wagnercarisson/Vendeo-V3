# Phase 48.2.2: Fundação da bancada de geração — Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 13 grupos de arquivos novos/modificados (criados) + 5 seams de modificação aditiva
**Analogs found:** 13 / 13 grupos com analog direto no repositório
**Fonte:** `48.2.2-CONTEXT.md` (D1–D17), `48.2.2-UI-SPEC.md`, OpenSpec `fase-48-2-2-fundacao-bancada-geracao` (proposal/design/tasks)
**Idioma:** PT-BR

> Todos os caminhos e números de linha abaixo foram verificados contra o código atual. Nenhum analog foi inventado. Onde um arquivo novo ainda não tem nome canônico, o nome sugerido é explicitamente marcado como "nome a critério do plano"; o **analog** é sempre real.
>
> **Correção 388db445 (base):** as seções 3 (preset registry) e 4 (branding) foram atualizadas para a allowlist própria da bancada (`BENCH_MODEL_ALLOWLIST`) e para o signer dedicado `createBenchBrandingSignedUrl`; as referências a `MODEL_ALLOWLIST` e `createArtifactSignedUrl` ficam **apenas** como analog de forma — **não** como fonte/autoridade da bancada.

---

## File Classification

| Arquivo novo (esperado) | Papel | Fluxo de dados | Analog mais próximo | Qualidade |
|-------------------------|-------|----------------|---------------------|-----------|
| `src/lib/lab/bench/domain/schemas.ts` | domain | transform | `src/lib/lab/domain/schemas.ts` | exato (mesmo bounded context) |
| `src/lib/lab/bench/domain/config-registry.ts` | config/registry | transform | `src/lib/ai/model-registry.ts` + `src/lib/lab/domain/schemas.ts` | role-match |
| `src/lib/lab/bench/domain/preset-registry.ts` | config/registry | transform | `src/lib/ai/model-registry.ts` (formato de `MODEL_ALLOWLIST`/`validateModelConfig`; a bancada usa `BENCH_MODEL_ALLOWLIST` própria — correção 388db445) | role-match |
| `src/lib/lab/bench/domain/branding-service.ts` | service | CRUD (leitura) | `src/lib/lab/api/experiment-queries.ts` + `src/lib/lab/domain/model-target.ts` | exato |
| `src/lib/lab/bench/domain/store-manifest.ts` | service | file-I/O | `src/lib/lab/scenarios/service.ts` (`loadScenarioFixture`/`listScenarioFixtures`) | exato |
| `src/lib/lab/bench/persistence/bench-run-service.ts` | service | CRUD | `src/lib/lab/run-service.ts` | exato |
| `src/lib/lab/bench/persistence/bench-artifact-service.ts` | service | file-I/O | `src/lib/lab/persistence/artifact-service.ts` | exato |
| `src/lib/lab/bench/gateway/*` (runtime + resolver) | provider/harness | request-response | `src/lib/lab/gateway/runtime.ts` + `lab-model-resolver.ts` | exato |
| `src/lib/ai/adapters/bench-images.ts` | adapter | request-response | `src/lib/ai/adapters/images.ts` + `responses.ts` (linhas 42-48) | role-match (novo wire) |
| `src/app/api/admin/laboratorio/bancada/**/route.ts` | route | request-response + streaming | `src/app/api/admin/laboratorio/scenarios/route.ts` + `experiments/[id]/runs/route.ts` | exato |
| `src/app/(app)/admin/laboratorio/bancada/**` (page + `_components/*`) | component | request-response | `experimentos/novo/page.tsx` + `_components/run-execution-panel.tsx`/`experiment-form.tsx` | exato |
| `supabase/lab/bench-schema.sql` (fora de `supabase/migrations/`) | migration/DDL | batch | `supabase/migrations/20260915000002_f48_1_create_lab_tables.sql` + `..._f48_1_lab_immutability_and_reserve.sql` | exato |
| `scripts/lab/48-2-2-bench-bootstrap.mjs` | utility | batch | `scripts/uat/48-local-scenarios.mjs` + `scripts/lab/48-cleanup-artifacts.mjs` | exato |
| `fixtures/lab/bench/stores.json` | config | file-I/O | `fixtures/lab/scenarios/<slug>/scenario.json` | role-match |

---

## Pattern Assignments

### 1. `src/lib/lab/bench/domain/schemas.ts` — schemas Zod do domínio da bancada

**Papel:** domain · **Fluxo:** transform · **Analog:** `src/lib/lab/domain/schemas.ts`

**Módulo puro (sem `server-only`, sem I/O)** — o mesmo contrato do analog: importável por testes, API e UI.

**Imports + convenção de módulo** (`src/lib/lab/domain/schemas.ts:1-9`):
```typescript
import { z } from "zod";

import {
  DEFAULT_MAX_RUNS_PER_EXPERIMENT,
  MAX_REPETITIONS,
  MAX_RUNS_PER_EXPERIMENT,
  MAX_SCENARIOS_PER_EXPERIMENT,
} from "@/lib/lab/limits";
import { LabRubricSchema } from "@/lib/lab/domain/rubric";
```

**Padrão de schema `.strict()` + `superRefine` com código determinístico** (`schemas.ts:91-153`):
```typescript
export const CreateLabExperimentInputSchema = z
  .object({
    name: z.string().min(1).max(200),
    // ...
    modelTarget: LabModelTargetSchema,
    params: LabExperimentParamsSchema,
    // ...
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((FUTURE_CHANGED_DIMENSIONS as readonly string[]).includes(value.changedDimension)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["changedDimension"],
        message: "unsupported_changed_dimension",
      });
    }
  });
```

**Erro determinístico com `code` + `parse*` que serializa issues** (`schemas.ts:199-246`):
```typescript
export class UnsupportedChangedDimensionError extends Error {
  readonly code = "unsupported_changed_dimension" as const;
  readonly dimension: string;
  constructor(dimension: string) { /* ... */ }
}

export function parseCreateLabExperimentInput(input: unknown): CreateLabExperimentInput {
  const result = CreateLabExperimentInputSchema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues;
  const dimensionIssue = issues.find(
    (issue) => issue.message === "unsupported_changed_dimension",
  );
  if (dimensionIssue) throw new UnsupportedChangedDimensionError(readChangedDimension(input));
  throw new Error(`Experimento de laboratório inválido: ${serializeIssues(issues)}`);
}
```

**O que espelhar para a bancada:** `BenchRunInputSchema` (produto/oferta, `prompt` manual, `presetId`, `references` paths locais, `confirmed: true`, `operationId` UUID), `BenchConfigSchema` (dimensões `pipeline`/`formato`/`modelo`/`qualidade`/`intenção`/`tipo de conteúdo`/`estrutura`/`tema`), `BenchBrandingSchema`. Manter `.strict()` e mensagens de código estáveis (a rota mapeia por `code`/mensagem).

---

### 2. `src/lib/lab/bench/domain/config-registry.ts` — registry de dimensões validado em código

**Papel:** config/registry · **Fluxo:** transform · **Analog:** `src/lib/ai/model-registry.ts` (padrão de registry puro) + `src/lib/lab/domain/schemas.ts` (constantes `as const`)

**Constantes `as const` + tipo derivado** (`schemas.ts:44-64`):
```typescript
export const CAMPAIGN_INTENTS = ["offer", "spotlight", "exclusive"] as const;
export type CampaignIntent = (typeof CAMPAIGN_INTENTS)[number];

export const CHANGED_DIMENSIONS = ["prompt"] as const;
export const FUTURE_CHANGED_DIMENSIONS = ["model", "configuration"] as const;
```

**Registry puro + validação fail-fast + classe resolver** (`model-registry.ts:29-40, 202-246`):
```typescript
export const MODEL_ALLOWLIST: Record<AiProvider, Record<string, readonly AiProtocol[]>> = {
  openai: { "gpt-image-2": ["images"], /* ... */ },
  gemini: { /* ... */ },
};

export function validateRegistry(registry: Record<string, AiModelConfig>): void {
  const keys = Object.keys(registry);
  // ... rejeita ausentes/extras e chave ≠ config.capability ...
  for (const key of keys as AiCapability[]) validateModelConfig(registry[key]);
}
// Validação no carregamento do registry default (fail-fast).
validateRegistry(MODEL_REGISTRY);
```

**O que espelhar:** registry em código das dimensões (`pipeline`/`formato`/`intenção`/`tipo de conteúdo`/`estrutura`/`tema`) com o primeiro recorte habilitado (`manual-direto`/`1:1`/`oferta`/`produto`/`peça única`/`nenhum`) e os demais valores **desabilitados com motivo explícito**. Sem CHECK por valor no banco (D6).

---

### 3. `src/lib/lab/bench/domain/preset-registry.ts` — presets `{ capability, provider, model, protocol, quality, size }`

**Papel:** config/registry · **Fluxo:** transform · **Analog:** `src/lib/ai/model-registry.ts`

**Allowlist de modelos é a fonte de validação** (`model-registry.ts:29-40`):
```typescript
export const MODEL_ALLOWLIST: Record<AiProvider, Record<string, readonly AiProtocol[]>> = {
  openai: {
    "gpt-4o": ["chat-completions"],
    "gpt-4o-mini": ["chat-completions", "responses"],
    "gpt-5.5": ["responses"],
    "gpt-image-2": ["images"],
  },
  gemini: { "gemini-3.1-flash-lite": ["gemini"], "gemini-2.0-flash": ["gemini"] },
};
```

**Validação provider→modelo→protocolo** (`model-registry.ts:138-165`):
```typescript
function assertValidTarget(capability, target, role): void {
  const providerModels = MODEL_ALLOWLIST[target.provider];
  if (!providerModels) throw new Error(`...provider "${target.provider}" fora da allowlist`);
  const allowedProtocols = providerModels[target.model];
  if (!allowedProtocols) throw new Error(`...modelo "${target.model}" fora da allowlist...`);
  if (!allowedProtocols.includes(target.protocol)) throw new Error(`...protocolo incompatível...`);
  // ...
}
```

**O que espelhar:** registry puro de presets validado contra a **allowlist própria da bancada** `BENCH_MODEL_ALLOWLIST` (mesmo formato de `MODEL_ALLOWLIST` em `src/lib/ai/model-registry.ts:29`, **sem** usar a allowlist produtiva — correção 388db445) **e** contra o catálogo ativo `ai_model_catalog` em modo **leitura** (ver analog de leitura em `src/lib/lab/domain/model-target.ts:45-68`, citado abaixo). Presets não confirmados pelo spike ficam **desabilitados com motivo** (`preset_not_enabled`, HTTP 400). O primeiro recorte habilita **apenas** o caminho direto confirmado (D7).

**Leitura read-only do catálogo** (`src/lib/lab/domain/model-target.ts:45-68`):
```typescript
export async function validateModelTargetAgainstCatalog(
  target: LabModelTarget,
  client: SupabaseClient,
): Promise<{ ok: true }> {
  const { data, error } = await client
    .from("ai_model_catalog")
    .select("id")
    .eq("capability", LAB_PRIMARY_CAPABILITY)
    .eq("provider", target.provider)
    .eq("model", target.model)
    .eq("protocol", target.protocol)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`model_target_catalog_read_failed:${error.message}`);
  if (!data) throw new ModelTargetNotInCatalogError(target);
  return { ok: true };
}
```

---

### 4. `src/lib/lab/bench/domain/branding-service.ts` — contrato local completo de branding (read-only)

**Papel:** service · **Fluxo:** CRUD (somente leitura) · **Analog:** `src/lib/lab/api/experiment-queries.ts` + `src/lib/lab/domain/model-target.ts`

**`import "server-only"` + client por parâmetro + helpers de narrowing** (`experiment-queries.ts:1-42`):
```typescript
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
function asRows(data: unknown): Row[] { return Array.isArray(data) ? (data as Row[]) : []; }
function asRow(data: unknown): Row | null { return data && typeof data === "object" ? (data as Row) : null; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function num(value: unknown, fallback = 0): number { return typeof value === "number" ? value : fallback; }
```

**Leitura read-only com `.select(...)` + `.eq(...)` + `maybeSingle` e erro prefixado** (`experiment-queries.ts:134-156`):
```typescript
export async function getActiveCampaignImageTarget(
  client: SupabaseClient,
): Promise<ActiveCampaignImageTarget | null> {
  const { data, error } = await client
    .from("ai_model_catalog")
    .select("provider, model, protocol")
    .eq("capability", "campaign_image")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`ai_model_catalog_read_failed:${error.message}`);
  const row = asRow(data);
  if (!row) return null;
  return { provider: text(row.provider), model: text(row.model), protocol: text(row.protocol) };
}
```

**Contrato de branding que deve ser exposto (fonte da tipografia):** `BrandProfileRecord` em `src/lib/brand-assets/types.ts:37-59`, com destaque para `typography_direction: string | null` (linha 46), `safe_color_tokens` (44), `visual_style`/`visual_tone` (45), `brand_personality` (47), `campaign_guidelines`/`campaign_brief` (48). Assets em `BrandAssetRecord` (`types.ts:5-14`) e `BrandProfileSource`/`BrandProfileStatus` (`types.ts:34-35`).

**O que espelhar:** loader dedicado que lê `stores`, `store_brand_profiles` (`status='synced'`, fallback `source='without_logo'`), `store_brand_assets` (`status='active'`) e `store_visual_signatures` (`status='active'`) — **somente leitura**. Logo/assinatura resolvidos por um **signer dedicado** `createBenchBrandingSignedUrl` (buckets `store-logos`/`store-brand-assets`/`visual-signatures`, allowlist estrita, após a guarda local; o `createArtifactSignedUrl` do lab **não** é reutilizado para branding — correção 388db445). **Não** reutilizar nem alterar `BrandProfileSnapshot`, `resolveStoreIdentity` ou `art-director-briefing` (D3).

---

### 5. `src/lib/lab/bench/domain/store-manifest.ts` — allowlist/manifesto local de lojas de teste

**Papel:** service · **Fluxo:** file-I/O · **Analog:** `src/lib/lab/scenarios/service.ts`

**Confinamento de path anti-traversal + leitura de fixture** (`scenarios/service.ts:82-119, 220-260`):
```typescript
function assertWithinRoot(candidate: string, root: string, label: string): string {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${INVALID_SCENARIO_PATH}:${label}`);
  }
  return resolved;
}

export async function loadScenarioFixture(slug: string): Promise<LoadedScenarioFixture> {
  const root = scenariosFixturesRoot();
  const dir = await resolveScenarioDir(root, slug);
  const raw = await fsp.readFile(path.join(dir, "scenario.json"), "utf8");
  // ...
}
```

**O que espelhar:** loader que lê `fixtures/lab/bench/stores.json` (allowlist) com confinamento de path, e cruza o manifesto com o Supabase local em modo **somente leitura** (`stores`). Uma loja só é elegível se estiver **no manifesto E** existir no Supabase local; loja fora do manifesto é recusada sem iniciar geração (D4). Sem sincronização remota.

---

### 6. `src/lib/lab/bench/persistence/bench-run-service.ts` — reservar/iniciar/finalizar + idempotência + reconciliação

**Papel:** service · **Fluxo:** CRUD · **Analog:** `src/lib/lab/run-service.ts` (analog direto, arquivo inteiro)

**Erro de reserva com código determinístico mapeado da RPC** (`run-service.ts:44-102`):
```typescript
export const LAB_RESERVATION_ERROR_CODES = [
  "budget_exceeded", "run_already_active", "missing_snapshot", "missing_operation_id",
  "experiment_not_found", "experiment_not_ready", "idempotency_conflict",
  "variant_not_in_experiment", "scenario_not_in_experiment", "repetition_out_of_range",
  "invalid_supersedes_run", "program_not_authorized",
] as const;

export class LabReservationError extends Error {
  readonly code: LabReservationErrorCode;
  constructor(code: LabReservationErrorCode) { super(code); this.name = "LabReservationError"; this.code = code; }
}
function readReservationErrorCode(message: string): LabReservationErrorCode {
  const found = LAB_RESERVATION_ERROR_CODES.find((code) => message.includes(code));
  return found ?? "lab_reservation_failed";
}
```

**Transição compare-and-set `markRunRunning`** (`run-service.ts:203-222`):
```typescript
const { data, error } = await params.client
  .from("lab_runs")
  .update({ status: "running", started_at: ..., attempts: 1 })
  .eq("id", params.runId)
  .eq("status", "pending")   // CAS: só promove quem ainda está pending
  .select("id");
if (error || !Array.isArray(data) || data.length !== 1) {
  throw new Error(LAB_RUN_TRANSITION_FAILED);
}
```

**`finalizeLabRun` sanitiza o erro na origem** (`run-service.ts:233-287`):
```typescript
if (params.errorMessage !== undefined && params.errorMessage !== null) {
  update.error_message = sanitizeAiErrorMessage(params.errorMessage);
}
const { data, error } = await params.client
  .from("lab_runs")
  .update(update)
  .eq("id", params.runId)
  .in("status", ["pending", "running"])  // CAS: nunca sobrescreve terminal
  .select("id");
```

**Reconciliação preguiçosa `reconcileStaleRuns`** (`run-service.ts:304-382`) — chamada **na leitura**, sem scheduler; marca `pending`/`running` além de `staleMs` como `failed` com `error_type: "orphan_run_timeout"`:
```typescript
const terminal = {
  status: "failed",
  error_type: "orphan_run_timeout",
  error_message: "Run órfão marcado como falho",
  finished_at: now.toISOString(),
};
const runningResult = await params.client.from("lab_runs").update(terminal)
  .in("id", staleIds).eq("status", "running").lt("started_at", cutoffIso).select("id");
const pendingResult = await params.client.from("lab_runs").update(terminal)
  .in("id", staleIds).eq("status", "pending").is("started_at", null).lt("created_at", cutoffIso).select("id");
```

**O que espelhar para a bancada:** `prepareBenchRun`/`reserveBenchRun` (idempotência por `operation_id`), `markBenchRunRunning`, `finalizeBenchRun` (CAS, snapshot/config imutáveis), `reconcileStaleBenchRuns` com `bench_run_orphan_timeout` (D10). O código da bancada deve viver em `src/lib/lab/bench/persistence/` e usar uma RPC própria (`lab_bench_reserve_run`) ou INSERT com índice único parcial global — o índice global `status IN ('pending','running')` é o reforço de banco (ver seção de DDL).

---

### 7. `src/lib/lab/bench/persistence/bench-artifact-service.ts` — paths `bench/{runId}/...` com checksum

**Papel:** service · **Fluxo:** file-I/O · **Analog:** `src/lib/lab/persistence/artifact-service.ts`

**Constantes de bucket/MIME/TTL** (`artifact-service.ts:32-64`):
```typescript
export const LAB_ARTIFACT_BUCKET = "lab-artifacts";
export const LAB_OUTPUT_ARTIFACT_KIND = "output";
export const LAB_INPUT_ARTIFACT_KIND = "input";
export const LAB_ALLOWED_ARTIFACT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const LAB_SIGNED_URL_TTL_SECONDS = 3600;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

**Checksum SHA-256 do buffer efetivamente gravado** (`artifact-service.ts:154-157`):
```typescript
export function computeArtifactChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
```

**Upload com rollback do objeto quando o insert de metadados falha** (`artifact-service.ts:177-244`):
```typescript
const storagePath = buildOutputArtifactPath({ experimentId, runId, mimeType });
const checksum = computeArtifactChecksum(buffer);
const bytes = buffer.byteLength;
const { error: uploadError } = await client.storage
  .from(LAB_ARTIFACT_BUCKET)
  .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
if (uploadError) throw new Error("artifact_upload_failed");
const { data, error } = await client.from("lab_artifacts").insert({ /* ... */ }).select("id").single();
if (error || !data) {
  try { await client.storage.from(LAB_ARTIFACT_BUCKET).remove([storagePath]); } catch { /* ... */ }
  throw new Error("artifact_persistence_failed");
}
```

**URL assinada server-side com TTL fixo do servidor** (`artifact-service.ts:306-327`):
```typescript
export async function createArtifactSignedUrl(params: { client: SupabaseClient; storagePath: string }): Promise<string> {
  assertLabArtifactPath(params.storagePath);
  const { data, error } = await params.client.storage
    .from(LAB_ARTIFACT_BUCKET)
    .createSignedUrl(params.storagePath, LAB_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error("artifact_signed_url_failed");
  return data.signedUrl;
}
```

**O que espelhar:** o mesmo bucket `lab-artifacts`, mas sob prefixo `bench/{runId}/inputs/...` e `bench/{runId}/output/...`. Reutilizar `computeArtifactChecksum`, `createArtifactSignedUrl(s)`, `LAB_ALLOWED_ARTIFACT_MIME_TYPES` e `LAB_SIGNED_URL_TTL_SECONDS` (importar do serviço existente) — só os **builders de path** e a tabela de metadados (`lab_bench_artifacts`) são novos. O guard de path é estendido aditivamente (ver seção de modificações).

---

### 8. `src/lib/lab/bench/gateway/*` — harness isolado com capability + alvo do preset

**Papel:** provider/harness · **Fluxo:** request-response · **Analog:** `src/lib/lab/gateway/runtime.ts` + `lab-model-resolver.ts`

**Composição de gateway paralelo + single-shot** (`runtime.ts:25-66`):
```typescript
export function createLabGateway(params: {
  fixedTarget: AiModelTarget;
  fallbackResolver: AiModelResolver;
  adapters: AiAdapterRegistry;
}): AiGateway {
  const resolver = new LabModelResolver({ fixedTarget: params.fixedTarget, fallbackResolver: params.fallbackResolver });
  return new AiGateway(resolver, params.adapters);
}

export async function runLabCampaignImage(params: {
  gateway: AiInvoker; request: AiInvocationRequest; telemetry: AiTelemetryContext;
}): Promise<AiInvocationResult> {
  return params.gateway.invoke("campaign_image", params.request, params.telemetry);
}
```

**Resolver que delega fora do escopo e fixa o alvo dentro dele** (`lab-model-resolver.ts:34-58`):
```typescript
export class LabModelResolver implements AiModelResolver {
  constructor(private readonly params: LabModelResolverParams) {}
  async resolve(capability: AiCapability): Promise<AiModelConfig> {
    if (capability !== "campaign_image") {
      return this.params.fallbackResolver.resolve(capability);
    }
    const target = this.params.fixedTarget;
    if (!target?.provider || !target?.model || !target?.protocol) {
      throw new Error(INVALID_FIXED_TARGET);
    }
    return {
      capability: "campaign_image", segment: "image",
      primary: { provider: target.provider, model: target.model, protocol: target.protocol },
      fallback: undefined, // Sem alvo alternativo: uma única chamada por run.
    };
  }
  listCapabilities(): AiCapability[] { return this.params.fallbackResolver.listCapabilities(); }
}
```

**O que espelhar:** o harness da bancada generaliza o resolver para devolver **capability + alvo do preset** (`{ capability, provider, model, protocol, quality, size }`), registrando o **adapter Images dedicado** apenas no runtime da bancada (D8). Single-shot, sem fallback, sem consultar `ai_model_selection`. A generalização do `runtime.ts`/`lab-model-resolver.ts` é **aditiva** (ver seção de modificações) — o comportamento atual deve permanecer.

---

### 9. `src/lib/ai/adapters/bench-images.ts` — adapter `Images` dedicado (passa `quality`)

**Papel:** adapter · **Fluxo:** request-response · **Analog:** `src/lib/ai/adapters/images.ts` (NÃO passa quality) + `src/lib/ai/adapters/responses.ts` (PASSA quality, linhas 42-48)

**Interface `AiAdapter` + shape da invocação** (`images.ts:1-20`):
```typescript
import { MalformedResponseError } from "@/lib/copy/errors";
import type { TokenUsage } from "@/lib/ai-cost/types";
import type { AiModelTarget } from "../model-resolver";
import { getApiKey } from "../api-keys";
import type { AiAdapter, AiInvocationRequest, AiInvocationResult } from "../types";

export class ImagesAdapter implements AiAdapter {
  readonly protocol = "images" as const;
  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    const { default: OpenAI, toFile } = await import("openai");
    const openai = new OpenAI({ apiKey: getApiKey(target.provider) });
    // ...
  }
}
```

**Como o caminho `images` IGNORA `quality`** (`images.ts:49-58`) — é exatamente a lacuna que o adapter dedicado fecha:
```typescript
const response = await openai.images.edit(
  {
    model: target.model,
    image: files.length === 1 ? files[0] : files,
    prompt: request.prompt,
    size: request.size ?? "1024x1024",
    n: 1,
  } as never,
  { signal: request.signal },
);
```

**Como o caminho `responses` HONRA `quality`** (`responses.ts:40-61`) — referência do parâmetro que falta no `images`:
```typescript
const usesImageTool = request.tools === "image_generation";
if (usesImageTool) {
  params.tools = [
    {
      type: "image_generation",
      size: request.size,
      quality: request.quality,
    },
  ];
  params.tool_choice = { type: "image_generation" };
}
```

**Como o registry padrão compõe os adapters (NÃO alterar)** (`registry.ts:12-26`):
```typescript
export function createDefaultAdapterRegistry(): AiAdapterRegistry {
  const adapters: Record<AiProtocol, AiAdapter> = {
    "chat-completions": new ChatCompletionsAdapter(),
    responses: new ResponsesAdapter(),
    images: new ImagesAdapter(),
    gemini: new GeminiAdapter(),
  };
  return { get: (protocol: AiProtocol) => adapters[protocol] };
}
export const defaultAdapterRegistry: AiAdapterRegistry = createDefaultAdapterRegistry();
```

**O que espelhar:** novo arquivo `src/lib/ai/adapters/bench-images.ts` (dentro do wire permitido `src/lib/ai/adapters/**`) que **propaga `quality`** no `images.edit` e recebe referências/ordem/papel explícitos. Registrado **apenas** no runtime da bancada (`src/lib/lab/bench/gateway/`), **nunca** no `defaultAdapterRegistry`. O `ImagesAdapter` produtivo e o registry padrão permanecem byte a byte inalterados (D8).

---

### 10. `src/app/api/admin/laboratorio/bancada/**/route.ts` — rotas administrativas

**Papel:** route · **Fluxo:** request-response (GET) + streaming NDJSON (POST) · **Analog:** `src/app/api/admin/laboratorio/scenarios/route.ts` (GET) + `experiments/[id]/runs/route.ts` (POST stream)

**Ordem obrigatória dos guards: `requireAdmin()` ANTES de `assertLabEnvironment()`** (`scenarios/route.ts:14-33`):
```typescript
export const GET = apiHandler(async () => {
  await requireAdmin();
  try {
    assertLabEnvironment();
  } catch (error) {
    if (error instanceof LabEnvironmentError) {
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    }
    throw error;
  }
  try {
    const scenarios = await listScenarioVersions(supabaseAdmin);
    return NextResponse.json({ scenarios });
  } catch {
    return NextResponse.json({ error: "Falha ao ler os cenários" }, { status: 503 });
  }
});
```
> O wrapper `apiHandler` (`src/lib/auth/api-handler.ts:6-17`) converte `ForbiddenError`/`UnauthorizedError` em 403/401; o `requireAdmin` (`src/lib/admin/require-admin.ts:6-19`) consulta `admin_users`.

**Confirmação explícita (422) antes do parse completo + parse Zod + mapeamento de status** (`experiments/[id]/runs/route.ts:67-141`):
```typescript
export const POST = apiHandler(async (request, { params }) => {
  const admin = await requireAdmin();
  try { assertLabEnvironment(); } catch (error) { /* 403 labEnvironmentDeniedBody */ }
  const { id } = await params;
  let raw: unknown = null;
  try { raw = await request.json(); } catch { raw = null; }
  if (raw === null || typeof raw !== "object" || (raw as Record<string, unknown>).confirmed !== true) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 422 });
  }
  const parsed = LabRunExecuteRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", details: parsed.error.issues }, { status: 400 });
  }
  let prepared;
  try { prepared = await prepareExperimentRun({ /* ... */ }); }
  catch (error) {
    const code = resolveErrorCode(error);
    if (code && CONFLICT_CODES.includes(code)) return NextResponse.json({ error: code }, { status: 409 });
    if (code && BAD_REQUEST_CODES.includes(code)) return NextResponse.json({ error: code }, { status: 400 });
    // 404 / 500 ...
    throw error;
  }
  if (prepared.idempotent) {
    return NextResponse.json({ idempotent: true, runId: prepared.runId }, { status: 200 });
  }
  // ... stream NDJSON ...
});
```

**Stream NDJSON com exatamente um terminal, Content-Type e `ReadableStream`** (`experiments/[id]/runs/route.ts:143-180`):
```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    const emit = (event: LabRunEvent): void => {
      try { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); }
      catch { /* Stream fechado pelo cliente: a execução continua dona do run. */ }
    };
    try {
      await runPreparedExperimentRun({ /* ... */ onEvent: emit });
    } catch {
      emit({ type: "error", code: "run_failed", message: "Execução falhou" });
    } finally { controller.close(); }
  },
});
return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
```

**O que espelhar:** rotas `GET /stores`, `GET /branding`, `GET /presets`, `GET /estimate`, `POST /runs` (stream NDJSON), `GET /runs/[id]` (detalhe + URL assinada). Códigos: `confirmation_required` (422), `bench_run_already_active` (409), `preset_not_enabled` (400), payload inválido (400), não-admin (403). Exatamente um evento terminal `done`/`error` (D13).

---

### 11. `src/app/(app)/admin/laboratorio/bancada/**` — página e componentes da bancada

**Papel:** component · **Fluxo:** request-response · **Analog:** `src/app/(app)/admin/laboratorio/experimentos/novo/page.tsx` (server page) + `_components/run-execution-panel.tsx` (client panel) + `_components/experiment-form.tsx`

**Page server component: guarda de ambiente → leitura server-side → estados de erro** (`experimentos/novo/page.tsx:28-95`):
```typescript
export const dynamic = "force-dynamic";

export default async function NovoExperimentoPage() {
  const env = getLabEnvironment();
  if (!env.enabled) return <DisabledNotice reason={env.reason} />;

  let target = null; let scenarios = []; let programs = []; let readFailed = false;
  try {
    [target, scenarios, programs] = await Promise.all([
      getActiveCampaignImageTarget(supabaseAdmin),
      listScenarioVersions(supabaseAdmin),
      listPrograms(supabaseAdmin),
    ]);
  } catch { readFailed = true; }

  if (readFailed) return <ErrorState title="..." description="..." />;
  if (!target) return <ErrorState title="Sem alvo ativo..." description="..." />;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Novo experimento" />
      <ExperimentForm modelTarget={target} scenarios={scenarios} programs={programs} defaultParams={{...}} />
    </div>
  );
}
```

**Client panel: estimativa → confirmação → POST → consumo NDJSON → terminal** (`run-execution-panel.tsx:193-349`):
```typescript
async function consumeNdjson(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = ""; let terminal = false;
  while (!terminal) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim(); if (!trimmed) continue;
      let event: LabRunStreamEvent;
      try { event = JSON.parse(trimmed) as LabRunStreamEvent; } catch { continue; }
      if (event.type === "phase" && event.phase) setPhases((p) => p.includes(event.phase!) ? p : [...p, event.phase!]);
      else if (event.type === "done") { terminal = true; setRunId(event.runId ?? null); router.refresh(); }
      else if (event.type === "error") { terminal = true; setError(event.message || "A execução falhou"); }
    }
  }
  setRunning(false);
}
```

**Confirmação explícita com `operationId` reutilizado por fingerprint (idempotência)** (`run-execution-panel.tsx:272-305`):
```typescript
async function handleConfirm() {
  const fingerprint = JSON.stringify([experimentId, variantId, scenarioVersionId, repetitionIndex]);
  const nextOperationId =
    operationFingerprint === fingerprint && operationId ? operationId : crypto.randomUUID();
  setOperationId(nextOperationId);
  setOperationFingerprint(fingerprint);
  const response = await fetch(`/api/admin/laboratorio/experiments/${experimentId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantId, scenarioVersionId, repetitionIndex, confirmed: true, operationId: nextOperationId }),
  });
  // ...
}
```

**Copy por cobertura de pricing (nunca valor exato quando parcial)** (`run-execution-panel.tsx:120-131`):
```typescript
function formatCostByCoverage(value: number | null | undefined, coverage: string): string {
  if (coverage === "complete") return formatUsd(value);
  if (coverage === "partial") {
    return typeof value === "number" ? `a partir de ${formatUsdDisplay(value)}` : "indisponível";
  }
  return "indisponível";
}
```

**Estado desabilitado (server component, sem estado)** (`disabled-notice.tsx:19-60`):
```typescript
export const LAB_DISABLED_TITLE = "Laboratório desabilitado neste ambiente";
export const LAB_DISABLED_NOTE = "Nenhuma tabela lab_*, storage do laboratório ou provider de IA foi acessado.";
export const LAB_REASON_LABELS: Record<LabEnvironmentReason, string> = { /* ... */ };
export function DisabledNotice({ reason }: { reason: LabEnvironmentReason }) { /* Card + ShieldAlert + reason */ }
```

**Primitivos locais a reutilizar (NÃO recriar):** `lab-select.tsx` (select com `aria-invalid`/`aria-describedby`, `min-h-[44px]`), `lab-textarea.tsx`, `lab-table.tsx`, `lab-radio-group.tsx`, `confirm-dialog.tsx` (diálogo nativo com `data-testid="lab-confirm-button"`), `disabled-notice.tsx`. Ficam em `src/app/(app)/admin/laboratorio/_components/` e devem ser importados pela bancada via caminho relativo (`../_components/lab-select`, etc.). **Primitivos globais** em `src/components/ui/`: `button`, `card`, `badge`, `input`, `empty-state`, `error-state`, `page-header`, `skeleton`, `loading-skeleton`.

**Novos primitivos da bancada** (criar em `src/app/(app)/admin/laboratorio/bancada/_components/`, sem promover para `src/components/ui/`): painel de branding (card read-only, inclui direção tipográfica), upload de imagens (dropzone + lista de metadados), painel de estimativa, painel de execução/resultado/download, painel de evidências. Todos `"use client"` quando tiverem estado, `data-testid` estáveis, `lucide-react`, sem emojis.

---

### 12. `supabase/lab/bench-schema.sql` + `scripts/lab/48-2-2-bench-bootstrap.mjs` — DDL local e bootstrap

**Papel:** migration/DDL + utility · **Fluxo:** batch · **Analog:** `supabase/migrations/20260915000002_f48_1_create_lab_tables.sql` (DDL/RLS/bucket/REVERT) + `20260915000003_f48_1_lab_immutability_and_reserve.sql` (triggers/RPC) + `scripts/uat/48-local-scenarios.mjs` (bootstrap idempotente/local-host guard)

> **D17 — obrigatório:** o DDL da bancada **não** entra em `supabase/migrations/`. Vive em local próprio (`supabase/lab/bench-schema.sql`) e é aplicado por bootstrap local, de modo que `supabase db push` **nunca** o carregue ao remoto.

**Índice único parcial GLOBAL de geração ativa** (analog `20260915000002_f48_1_create_lab_tables.sql:142-151`):
```sql
-- Garante no máximo UM run ativo em TODA a tabela — reforço de banco da reserva atômica.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_runs_one_active_global
  ON public.lab_runs ((true))
  WHERE status IN ('pending','running');
```
> Para a bancada: `uq_lab_bench_runs_one_active_global ON public.lab_bench_runs ((true)) WHERE status IN ('pending','running')`.

**Tabela de metadados de artefato com `kind`/checksum/`removed_at`** (`..._create_lab_tables.sql:153-169`):
```sql
CREATE TABLE IF NOT EXISTS public.lab_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.lab_runs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('output','input','diagnostic')),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  width INT, height INT, bytes BIGINT, checksum TEXT,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, kind, storage_path)
);
```

**RLS + grants service-role only (sem anon/authenticated)** (`..._create_lab_tables.sql:196-262`):
```sql
ALTER TABLE public.lab_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage lab_runs"
  ON public.lab_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON TABLE public.lab_runs FROM anon;
REVOKE ALL ON TABLE public.lab_runs FROM authenticated;
REVOKE ALL ON TABLE public.lab_runs FROM service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lab_runs TO service_role;
```

**Bucket privado `lab-artifacts` (public=false, MIME restrito, policy só service_role)** (`..._create_lab_tables.sql:272-287`):
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lab-artifacts', 'lab-artifacts', false, 10485760,
        ARRAY['image/png', 'image/jpeg', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role can manage lab-artifacts objects" ON storage.objects;
CREATE POLICY "Service role can manage lab-artifacts objects"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'lab-artifacts') WITH CHECK (bucket_id = 'lab-artifacts');
```

**Trigger de imutabilidade de snapshot/config (colunas de resultado atualizáveis)** (`..._lab_immutability_and_reserve.sql:28-58`):
```sql
CREATE OR REPLACE FUNCTION public.trg_lab_runs_snapshot_immutable_fn()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.operation_id IS DISTINCT FROM OLD.operation_id
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'lab_runs_snapshot_immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_lab_runs_snapshot_immutable
BEFORE UPDATE ON public.lab_runs FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_runs_snapshot_immutable_fn();
```

**DELETE sempre proibido em runs** (`..._lab_immutability_and_reserve.sql:226-241`):
```sql
CREATE OR REPLACE FUNCTION public.trg_lab_runs_no_delete_fn()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'lab_run_delete_forbidden';
END; $$;
CREATE TRIGGER trg_lab_runs_no_delete
BEFORE DELETE ON public.lab_runs FOR EACH ROW
EXECUTE FUNCTION public.trg_lab_runs_no_delete_fn();
```

**Bloco REVERT comentado (ordem reversa)** (`..._create_lab_tables.sql:289-326`):
```sql
-- REVERT (ordem reversa de criação — executar manualmente se necessário)
-- DROP POLICY IF EXISTS "Service role can manage lab-artifacts objects" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'lab-artifacts';
-- ...
-- DROP TABLE IF EXISTS public.lab_runs CASCADE;
-- DROP INDEX IF EXISTS public.uq_lab_runs_one_active_global;
```

**Bootstrap: guarda local-only antes de qualquer I/O** (`scripts/uat/48-local-scenarios.mjs:36-56, 77-94`):
```javascript
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;
const PRODUCTION_DOMAINS = ["supabase.co", "supabase.in", "supabase.com"];

function assertLocalHost(rawUrl, origin) {
  let hostname;
  try { hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, ""); }
  catch { throw new Error(`Recusando URL invalida (${origin}): ${rawUrl}`); }
  if (PRODUCTION_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`)))
    throw new Error(`Recusando host de producao (${origin}): ${hostname}`);
  if (!LOCAL_HOST_PATTERN.test(hostname))
    throw new Error(`Recusando host nao local (${origin}): ${hostname}`);
  return hostname;
}
```

**Bootstrap idempotente (hash igual ⇒ nada; hash novo ⇒ `max+1`)** (`48-local-scenarios.mjs:122-199`) — o mesmo padrão vale para a aplicação do DDL e das linhas de catálogo (`ai_model_catalog`) locais (o pricing existe somente em código, **sem tabela de pricing**):
```javascript
const matching = rows.find((row) => row.content_hash === contentHash);
if (matching) { skipped += 1; continue; }
const nextVersion = rows.reduce((max, row) => Math.max(max, row.version), 0) + 1;
// insert ... version = nextVersion (nunca sobrescreve)
```

**O que espelhar:** `supabase/lab/bench-schema.sql` com `lab_bench_runs` + `lab_bench_artifacts` (D9), RLS/grants service-role, triggers de imutabilidade, índice global de geração ativa e bloco REVERT. O bootstrap (`scripts/lab/48-2-2-bench-bootstrap.mjs`) valida host local **antes** de qualquer I/O, aplica o DDL de forma idempotente e adiciona **somente** linhas de catálogo (`ai_model_catalog`) **somente locais** (se o spike confirmar); o pricing existe **exclusivamente** em código (`bench-pricing.ts`), **sem tabela de pricing**. O analog `scripts/lab/48-cleanup-artifacts.mjs:165-200` mostra o mesmo `assertLocalHost`/`resolveLocalConnection` e o padrão de CLI sem efeito colateral no import (`invokedDirectly`, linhas 301-314).

---

### 13. `fixtures/lab/bench/stores.json` — manifesto local de lojas de teste

**Papel:** config · **Fluxo:** file-I/O · **Analog:** `fixtures/lab/scenarios/<slug>/scenario.json`

**Convenção de fixture JSON** (`fixtures/lab/scenarios/produto-oferta-preco/scenario.json:1-45`):
```json
{
  "slug": "produto-oferta-preco",
  "name": "Oferta com preço (produto + imagem auxiliar)",
  "description": "Cenário fictício ...",
  "intent": "offer",
  "format": "1:1",
  "locale": "pt-BR",
  "mediaKinds": ["image"],
  "brief": { "product": { /* ... */ }, "offer": { /* ... */ } },
  "store": { "name": "Empório Aurora", "segment": "mercados-mercearias", "brandColor": "#16A34A" },
  "identity": { "state": "text_only" },
  "images": [ { "id": "produto", "role": "primary", "path": "images/produto.jpg", "alt": "..." } ],
  "fictitious": true
}
```

**O que espelhar:** JSON local com allowlist/manifesto de lojas de teste (ex.: `{ "stores": [{ "id": "<uuid>", "label": "Loja de teste A", "notes": "..." }] }`), consumido pelo loader read-only (item 5). O manifesto é a **única** fonte de elegibilidade além da existência no Supabase local (D4). Nenhum campo produtivo novo.

---

## Modified Files — seam exato (aditivo, sem quebrar o existente)

### M1. `src/lib/lab/persistence/artifact-service.ts` — estender `assertLabArtifactPath`

**Seam:** função `assertLabArtifactPath` em **linhas 97-122**; constante `LAB_PATH_PREFIX = "experiments"` em **linha 58**; builders em **linhas 124-150**.

```typescript
// linhas 112-122 (HOJE)
const segments = storagePath.split("/");
if (segments[0] !== LAB_PATH_PREFIX) {
  throw new Error(INVALID_ARTIFACT_PATH);
}
if (segments.length < 5 || segments[2] !== "runs") {
  throw new Error(INVALID_ARTIFACT_PATH);
}
if (!UUID_REGEX.test(segments[1]) || !UUID_REGEX.test(segments[3])) {
  throw new Error(INVALID_ARTIFACT_PATH);
}
```

**Adicionar:** um segundo ramo que aceita `bench/{runId}/{inputs|output}/...` (UUID no segmento 1, `kind` ∈ `{inputs, output}` no segmento 2), mantendo o ramo atual `experiments/{uuid}/runs/{uuid}/...` intacto. O bloco anti-traversal das linhas 102-110 (`..`, `/`, `\`, `://`, token do bucket proibido) **permanece como está e se aplica aos dois esquemas**.
**O que deve permanecer inalterado:** o guard de `experiments/...`, `buildOutputArtifactPath`, `buildInputArtifactPath`, `computeArtifactChecksum`, `persistOutputArtifact` (linhas 177-244), `listRunArtifacts` (265-295), `createArtifactSignedUrl(s)` (306-358). A extensão é apenas um ramo adicional no guard (D14).

### M2. `src/lib/lab/gateway/runtime.ts` + `lab-model-resolver.ts` — generalizar para capability + preset

**Seam runtime:** `createLabGateway` em **linhas 25-35** (aceita `fixedTarget`); `runLabCampaignImage` em **linhas 60-66**.
**Seam resolver:** `LabModelResolver.resolve` em **linhas 37-58**.

**Adicionar:** um caminho que resolve `capability + alvo do preset` (`{ capability, provider, model, protocol, quality, size }`) sem alterar a assinatura atual `{ fixedTarget, fallbackResolver }`. O `LabModelResolver` atual (alvo fixo por experimento) **continua funcionando** — o novo resolver de preset é uma composição adicional usada apenas pela bancada.
**O que deve permanecer inalterado:** a semântica de `campaign_image` com alvo fixo, `fallback: undefined` (single-shot), `INVALID_FIXED_TARGET`, `createDefaultLabRuntime` (linhas 75-91) e o import dinâmico de `@/lib/ai` (linhas 80-90).

### M3. `src/lib/lab/__tests__/lab-isolation.contract.test.ts` — allowlist read-only aditiva

**Seams:**
- `ALLOWED_TABLES` — **linhas 355-365**
- `ALLOWED_BUCKETS` — **linha 368**
- `ALLOWED_RPCS` — **linhas 371-377**
- `READ_ONLY_TABLES` — **linha 380**
- `ALLOWED_ENTRY_RE` — **linhas 382-383**
- `FORBIDDEN_TARGETS` — **linhas 386-394**
- detector `forbiddenProductionAccess` — **linhas 402-404**
- `wrapReadOnlyTable` — **linhas 407-421**
- asserções do detector — **linhas 700-725**

```typescript
// linhas 355-365 (HOJE)
const ALLOWED_TABLES = new Set([
  "lab_scenarios", "lab_scenario_versions", "lab_experiments",
  "lab_experiment_variants", "lab_experiment_scenarios",
  "lab_runs", "lab_artifacts", "lab_human_evaluations",
  "ai_model_catalog",
]);
```

**Adicionar (aditivo e estreito):** leitura somente-leitura de `stores`/`store_brand_profiles`/`store_brand_assets`/`store_visual_signatures` (local) ao `ALLOWED_TABLES` **e** ao `READ_ONLY_TABLES` (linha 380), garantindo escrita proibida via `wrapReadOnlyTable`; adicionar as tabelas `lab_bench_*` ao `ALLOWED_TABLES` e as RPCs `lab_bench_*` ao `ALLOWED_RPCS`; atualizar `ALLOWED_ENTRY_RE` (382-383) com as novas entradas; **adicionar** `campaign-images` e lojas remotas ao `FORBIDDEN_TARGETS`/asserções (já existe `campaign-images` na linha 393 — reforçar a proibição explícita no contexto da bancada).
**O que deve permanecer inalterado:** a função `forbiddenProductionAccess` (402-404), `createRecordingClient` (427-488), `wrapReadOnlyTable` (407-421) e as asserções existentes (708-724). Os self-tests negativos atuais (700-725) devem continuar passando.

### M4. `src/lib/ai/__tests__/architecture-guard.test.ts` — gates aditivos do contexto bancada

**Seam:** região do laboratório em **linhas 133-234** (`labFiles` em 139; gates em 154-184 e 200-224).

```typescript
// linhas 139-142 (HOJE)
const labFiles = files.filter((file) => file.startsWith("src/lib/lab/"));
const LAB_IMAGE_PROVIDER_RE = /@\/lib\/image-generation\/providers\/openai|OpenAIImageProvider/;
const LAB_API_KEY_ENV_RE = /process\.env\.(OPENAI_API_KEY|GEMINI_API_KEY)\b/;
```

**Adicionar:** gates específicos do contexto da bancada — sem `generation_events`/`AiCostTracker.record` (já coberto por 154-162 para todo `src/lib/lab/**`, incluindo `bench/**`), sem provider de imagem produtivo, sem SDK/wire (já coberto 164-176), sem chaves de provider (178-184), sem escrita em catálogo (210-216) e em `prompts/` (218-224). Se necessário, adicionar um `benchFiles = files.filter(f => f.startsWith("src/lib/lab/bench/"))` e repetir as asserções para explicitar o contexto.
**O que deve permanecer inalterado:** todas as regras globais (86-131) e os gates F48.1/F48.2.1 (154-234) — **nenhuma regra pode ser afrouxada**. O `SELF` (linha 22) e a exclusão de `__tests__` (44) permanecem.

### M5. `src/app/(app)/admin/laboratorio/layout.tsx` — entrada de navegação interna da bancada

**Seam:** `LAB_NAV_ITEMS` em **linhas 19-24**.

```typescript
const LAB_NAV_ITEMS = [
  { href: "/admin/laboratorio", label: "Experimentos" },
  { href: "/admin/laboratorio/cenarios", label: "Cenários" },
  { href: "/admin/laboratorio#avaliacoes-pendentes", label: "Avaliações" },
  { href: "/admin/laboratorio/programas", label: "Programas" },
];
```

**Adicionar:** `{ href: "/admin/laboratorio/bancada", label: "Bancada" }` ao array. **Nenhum segundo link na navegação principal** (o único link "Laboratório" na nav do admin permanece — D15/UI-SPEC).
**O que deve permanecer inalterado:** a guarda `getLabEnvironment()`/`DisabledNotice` (linhas 31-35) e o `<nav aria-label="Navegação do laboratório">` (39-52).

---

## Shared Patterns (cross-cutting)

### Autenticação e ordem de guards
**Fonte:** `src/lib/admin/require-admin.ts:6-19`, `src/lib/lab/environment-guard.ts:169-183`, `src/lib/auth/api-handler.ts:6-17`
**Aplicar a:** TODAS as rotas da bancada.
```typescript
export const GET = apiHandler(async () => {
  await requireAdmin();                          // 1) 403 se não-admin (ForbiddenError)
  try { assertLabEnvironment(); }                // 2) 403 se ambiente bloqueado
  catch (error) {
    if (error instanceof LabEnvironmentError)
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
    throw error;
  }
  // 3) só então tocar lab_*/storage/provider
});
```

### Erro sanitizado na origem (uma única vez)
**Fonte:** `src/lib/ai/types.ts:213-218` (`sanitizeAiErrorMessage`)
**Aplicar a:** `finalizeBenchRun` (banco) e ao evento `error` do stream NDJSON — a **mesma** mensagem segura para os dois destinos (D13). Nunca persistir/emitir chave, URL ou token.
```typescript
export function sanitizeAiErrorMessage(message: string): string {
  return message
    .replace(BEARER_PATTERN, "$1[redacted]")
    .replace(KEY_PATTERN, "[redacted-key]")
    .replace(URL_PATTERN, "[redacted-url]");
}
```

### Cliente Supabase por parâmetro (testabilidade)
**Fonte:** `src/lib/lab/run-service.ts:1-42`, `src/lib/lab/api/experiment-queries.ts:11-24`
**Aplicar a:** todo serviço da bancada. Nenhum módulo importa `supabaseAdmin` diretamente — o client entra por parâmetro, permitindo fakes em memória. `supabaseAdmin` é importado apenas nas rotas e páginas (`@/lib/supabase/server`).

### Leitura read-only do catálogo/custos
**Fonte:** `src/lib/lab/domain/model-target.ts:45-68`, `src/lib/ai/lab-cost-estimate.ts:22-32`, `src/lib/ai/lab-telemetry-sink.ts:46-138`
**Aplicar a:** validação de presets e cálculo de custo. `resolveAiCost(` só é permitido em `src/lib/ai/**` (gate `architecture-guard.test.ts:98-106`). O `LabTelemetrySink` acumula custo **sem** gravar `generation_events` e distingue usage/calculado/estimado.

### Test doubles em memória
**Fonte:** `src/lib/lab/api/__tests__/fake-supabase-client.ts:221-264` (fake compartilhado) e `src/lib/lab/__tests__/lab-isolation.contract.test.ts:427-488` (client gravador com detector)
**Aplicar a:** testes da bancada. Reutilizar `createFakeSupabaseClient` para leitura/persistência; criar um client gravador equivalente para as tabelas `lab_bench_*` + allowlist de branding local. **Nenhuma chamada de rede e nenhuma chamada paga em testes/CI.**

### NDJSON — exatamente um terminal
**Fonte:** `src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts:143-180`, `src/lib/lab/run-service.ts:415-423`
**Aplicar a:** `POST /api/admin/laboratorio/bancada/runs`. O serviço é o único dono dos eventos `done`/`error`; a rota apenas encaminha `phase`. `Content-Type: application/x-ndjson`.

---

## Anti-patterns / do-not-touch (byte a byte inalterados)

Estes arquivos são **fronteiras de regressão obrigatória**. Nenhuma edição, mesmo cosmética:

| Arquivo | Por quê |
|---------|---------|
| `src/components/campaign/types.ts` (`BrandProfileSnapshot`, linhas 7-15) | Contrato produtivo de snapshot; a lacuna de tipografia é fechada no contrato da bancada, não aqui (D3) |
| `src/lib/store-identity-service.ts` (`resolveStoreIdentity`) | Mapper produtivo; a bancada não o reutiliza nem altera (D3) |
| `src/lib/image-generation/services/art-director-briefing.ts` | Prompt do Diretor de produção; injeção de branding no prompt é F48.2.3 (D3/D15) |
| `src/lib/ai/adapters/registry.ts` (`createDefaultAdapterRegistry`/`defaultAdapterRegistry`) | Registry padrão; o adapter da bancada é registrado **apenas** no runtime da bancada (D8) |
| `src/lib/ai/adapters/images.ts` (`ImagesAdapter` produtivo) | Ignora `quality` por design; alterá-lo toca produção (D8) |
| `prompts/` | Prompts oficiais; nenhum arquivo do lab escreve neles (gate `architecture-guard.test.ts:218-224`) |
| `supabase/migrations/**` | O DDL da bancada **não** entra na cadeia de migrations remotas (D17) |
| `campaign-images` (bucket) | Proibido ler/reutilizar; só `lab-artifacts` com prefixo `bench/` (D5) |

**Proibido no código da bancada** (herdado dos gates do laboratório): `generation_events`, `AiCostTracker.record`, provider de imagem de produção, SDK/wire fora de `src/lib/ai/adapters/**`, chaves de provider (`OPENAI_API_KEY`/`GEMINI_API_KEY`), `ai_model_selection`, `campaign_image_review`, escrita em `ai_model_catalog`/`prompts/`, `campaigns`, `campaign_art_versions`, `admin_audit_log`, `credit_*`.

---

## No Analog Found

| Arquivo | Papel | Fluxo | Motivo |
|---------|-------|-------|--------|
| `src/lib/ai/adapters/bench-images.ts` | adapter | request-response | **Parcial:** não existe adapter `images` que propague `quality`. O analog é a composição de `images.ts` (shape/upload de referências) com `responses.ts:42-48` (propagação de `quality`). O planner deve tratar como composição de dois analogs, não cópia 1:1. |
| Preset `gpt-image-2.5-flare` | config | — | **Inexistente no código** (só no roadmap — design §22). Depende do spike bloqueante (checkpoint 1); presets não confirmados ficam desabilitados com motivo. |
| RPC `lab_bench_reserve_run` | migration | CRUD | Não existe; deve seguir o padrão de `lab_reserve_run` (`20260915000003_f48_1_lab_immutability_and_reserve.sql:252-411`), adaptado a `lab_bench_runs` (sem FK para experimento/variante/cenário). |

---

## Metadata

**Escopo da busca de analogs:** `src/lib/lab/**`, `src/lib/ai/adapters/**`, `src/lib/ai/**`, `src/app/api/admin/laboratorio/**`, `src/app/(app)/admin/laboratorio/**`, `supabase/migrations/**`, `scripts/lab/**`, `scripts/uat/**`, `fixtures/lab/**`, `src/components/ui/**`.
**Arquivos lidos para extração:** 30+ (analogs, seams, testes, DDL, scripts, fixtures).
**Arquivos com analog exato:** 11 grupos; role-match/composição: 2 grupos; sem analog: 1 (adapter `bench-images` — composição).
**Data de extração:** 2026-09-28.
**Fonte da verdade:** `openspec/changes/fase-48-2-2-fundacao-bancada-geracao/` (proposal/design D1–D17/tasks 1–8).
