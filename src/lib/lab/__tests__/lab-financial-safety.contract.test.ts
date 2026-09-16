// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

const { mockRecord, mockResolveAiCost } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  return { mockRecord: vi.fn(), mockResolveAiCost: vi.fn() };
});

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    record = mockRecord;
    startRun = vi.fn();
  },
}));

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

import type { AiInvocationResult, AiTelemetryContext } from "@/lib/ai/types";
import type { AiInvoker } from "@/lib/ai/gateway";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import type { CostResolution } from "@/lib/ai-cost/types";
import { LabRunExecuteRequestSchema } from "@/lib/admin/schemas";
import { buildCampaignBriefFromFlat } from "@/lib/campaign/brief";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import { computePromptContentHash } from "@/lib/lab/domain/prompt-snapshot";
import { LabPromptLoader } from "@/lib/lab/gateway/lab-prompt-loader";
import { createNoopImageProvider } from "@/lib/lab/gateway/noop-image-provider";
import {
  DEFAULT_MAX_RUNS_PER_EXPERIMENT,
  MAX_CONCURRENT_LAB_RUNS,
  MAX_REPETITIONS,
  MAX_RUNS_PER_EXPERIMENT,
} from "@/lib/lab/limits";
import {
  LabReservationError,
  executeLabRun,
  prepareLabRun,
  runReservedLabRun,
} from "@/lib/lab/run-service";
import type { LabRunStatus } from "@/lib/lab/run-service";

/**
 * Suíte de contrato nº 1 (48-1-11, tasks 11.5/11.6) — **segurança financeira**.
 *
 * Prova, com fakes, que nenhuma chamada paga acontece sem confirmação explícita,
 * sem reserva atômica e sem budget/concorrência disponíveis; que a idempotência é
 * vinculada ao payload; que o run dispara **exatamente uma** invocação (sem
 * fallback) e que a própria suíte de testes do laboratório é higiênica (nenhum
 * SDK de provider, nenhuma imagem gerada lida do disco).
 */

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_EXPERIMENT_ID = "12121212-1212-4121-8121-121212121212";
const VARIANT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_VARIANT_ID = "23232323-2323-4232-8232-232323232323";
const SCENARIO_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "66666666-6666-4666-8666-666666666666";
const STORE_ID = "77777777-7777-4777-8777-777777777777";

const SCENARIO_HASH = "c".repeat(64);
const PROMPT_NAME = "campaign-image-director-offer";
const CANDIDATE_CONTENT = "# Diretor de arte (candidata)\n\nInstrucoes enxutas e claras.";
const CANDIDATE_HASH = computePromptContentHash(CANDIDATE_CONTENT);
const BASELINE_CONTENT = "conteudo oficial do diretor";
const BASELINE_HASH = computePromptContentHash(BASELINE_CONTENT);

const TARGET = { provider: "openai", model: "gpt-5.5", protocol: "responses" } as const;
const LAB_PARAMS = { size: "1024x1024", quality: "auto", skipInputValidation: true } as const;

const FULL_COST: CostResolution = {
  estimatedCostUsd: 0.0421,
  costSource: "pricing_table",
  pricingVersion: "11111111-1111-4111-8111-111111111111",
  costFormulaVersion: "responses_image_generation_v2",
  textComponentUsd: 0.0121,
  imageToolComponentUsd: 0.03,
  imageToolPricingProvider: "openai",
  imageToolPricingModel: "gpt-image-1",
  imageToolPricingVersion: "22222222-2222-4222-8222-222222222222",
};

let pngBase64 = "";

beforeAll(async () => {
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer();
  pngBase64 = buffer.toString("base64");
});

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue(FULL_COST);
  mockRecord.mockResolvedValue(undefined);
});

// ─── Client fake em memória (RPC espelhando a reserva atômica) ───────────────

type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: unknown };

interface MemoryState {
  tables: Record<string, Row[]>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  updateCalls: Array<{ table: string; values: Row }>;
  insertCalls: Array<{ table: string; payload: Row | Row[] }>;
  /** `operation_id` → assinatura do payload (idempotência vinculada). */
  reservations: Map<string, { signature: string; runId: string }>;
  /** Força a RPC de reserva a devolver este código (cenários de recusa). */
  forcedReservationError?: string;
  idSeq: number;
}

class MemoryBuilder implements PromiseLike<QueryResult> {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;

  constructor(
    private readonly state: MemoryState,
    private readonly table: string,
  ) {}

  select(_columns?: string, _options?: unknown): this {
    return this;
  }

  insert(payload: Row | Row[]): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push((row) => String(row[column] ?? "") < String(value));
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    return { data: (result.data as Row[])[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data as Row[];
    if (rows.length !== 1) return { data: null, error: { message: "not_single" } };
    return { data: rows[0], error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    const rows = this.state.tables[this.table] ?? [];
    return rows.filter((row) => this.filters.every((filter) => filter(row)));
  }

  private async execute(): Promise<QueryResult> {
    if (this.mode === "insert") {
      const rows = this.state.tables[this.table] ?? (this.state.tables[this.table] = []);
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const inserted = payloads.map((payload) => {
        this.state.idSeq += 1;
        const row: Row = { id: `generated-${this.state.idSeq}`, ...payload };
        rows.push(row);
        return row;
      });
      this.state.insertCalls.push({ table: this.table, payload: this.payload as Row | Row[] });
      return { data: inserted, error: null };
    }

    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.payload ?? {});
      this.state.updateCalls.push({ table: this.table, values: this.payload as Row });
      return { data: matched, error: null };
    }

    if (this.mode === "delete") {
      const rows = this.state.tables[this.table] ?? [];
      const matched = this.matched();
      for (const row of matched) {
        const index = rows.indexOf(row);
        if (index >= 0) rows.splice(index, 1);
      }
      return { data: matched, error: null };
    }

    return { data: this.matched(), error: null };
  }
}

interface MemoryClient {
  from: (table: string) => MemoryBuilder;
  rpc: (name: string, args: Record<string, unknown>) => Promise<QueryResult>;
  storage: {
    from: (bucket: string) => {
      upload: (storagePath: string, body: unknown, options?: unknown) => Promise<unknown>;
      remove: (paths: string[]) => Promise<unknown>;
      createSignedUrl: (storagePath: string, ttl: number) => Promise<unknown>;
    };
  };
}

/**
 * Espelha a semântica de `lab_reserve_run` relevante ao contrato financeiro:
 * prontidão → concorrência **global** (`MAX_CONCURRENT_LAB_RUNS`) → budget
 * (`max_runs`) → idempotência vinculada ao payload. Nenhuma rede.
 */
function createMemoryClient(state: MemoryState): MemoryClient {
  return {
    from(table: string) {
      return new MemoryBuilder(state, table);
    },
    rpc(name: string, args: Record<string, unknown>) {
      state.rpcCalls.push({ fn: name, args });

      if (name !== "lab_reserve_run") {
        return Promise.resolve({ data: null, error: { message: `unexpected_rpc:${name}` } });
      }

      if (state.forcedReservationError) {
        return Promise.resolve({
          data: null,
          error: { message: state.forcedReservationError },
        });
      }

      const experimentId = String(args.p_experiment_id ?? "");
      const runs = state.tables.lab_runs ?? (state.tables.lab_runs = []);
      const experiment = (state.tables.lab_experiments ?? []).find((row) => row.id === experimentId);

      if (!experiment) {
        return Promise.resolve({ data: null, error: { message: "experiment_not_found" } });
      }

      const status = String(experiment.status ?? "draft");
      if (status === "draft" || status === "archived") {
        return Promise.resolve({ data: null, error: { message: "experiment_not_ready" } });
      }

      // Idempotência vinculada ao payload (verificada após o lock, por design).
      const operationId = String(args.p_operation_id ?? "");
      const signature = [
        experimentId,
        String(args.p_variant_id ?? ""),
        String(args.p_scenario_version_id ?? ""),
        String(args.p_repetition_index ?? ""),
      ].join("|");
      const existing = state.reservations.get(operationId);
      if (existing) {
        if (existing.signature === signature) {
          return Promise.resolve({
            data: { run_id: existing.runId, idempotent: true },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: { message: "idempotency_conflict" } });
      }

      // Concorrência GLOBAL: no máximo um run ativo em todo o laboratório.
      const active = runs.filter((row) => row.status === "pending" || row.status === "running");
      if (active.length >= MAX_CONCURRENT_LAB_RUNS) {
        return Promise.resolve({ data: null, error: { message: "run_already_active" } });
      }

      // Budget: teto do experimento contado na mesma transação.
      const maxRuns = Number(experiment.max_runs ?? DEFAULT_MAX_RUNS_PER_EXPERIMENT);
      const used = runs.filter((row) => row.experiment_id === experimentId).length;
      if (used >= maxRuns) {
        return Promise.resolve({ data: null, error: { message: "budget_exceeded" } });
      }

      const runId = RUN_ID;
      runs.push({ id: runId, experiment_id: experimentId, status: "pending" });
      state.reservations.set(operationId, { signature, runId });

      return Promise.resolve({ data: { run_id: runId, run_sequence: 1, idempotent: false }, error: null });
    },
    storage: {
      from(_bucket: string) {
        return {
          upload: async (storagePath: string) => ({ data: { path: storagePath }, error: null }),
          remove: async () => ({ data: null, error: null }),
          createSignedUrl: async (storagePath: string) => ({
            data: { signedUrl: `signed:${storagePath}` },
            error: null,
          }),
        };
      },
    },
  };
}

function newState(tables: Record<string, Row[]> = {}): MemoryState {
  return { tables, rpcCalls: [], updateCalls: [], insertCalls: [], reservations: new Map(), idSeq: 0 };
}

function asClient(state: MemoryState): SupabaseClient {
  return createMemoryClient(state) as unknown as SupabaseClient;
}

/** Experimento pronto (com teto) + catálogo ativo — pré-condição da reserva. */
function seedReadyExperiment(overrides: Partial<Row> = {}): Record<string, Row[]> {
  return {
    lab_experiments: [
      {
        id: EXPERIMENT_ID,
        status: "ready",
        max_runs: DEFAULT_MAX_RUNS_PER_EXPERIMENT,
        model_target: TARGET,
        params: LAB_PARAMS,
        ...overrides,
      },
    ],
  };
}

// ─── Invocador fake (contador de chamadas pagas) ─────────────────────────────

interface CountingInvoker {
  invoker: AiInvoker;
  calls: () => number;
  fallbackCalls: () => number;
}

function createCountingInvoker(options: { failWith?: Error } = {}): CountingInvoker {
  let calls = 0;
  let fallbackCalls = 0;

  const invoker: AiInvoker = {
    async invoke(_capability, _request, telemetry: AiTelemetryContext): Promise<AiInvocationResult> {
      calls += 1;
      await telemetry.sink.emit({
        capability: "campaign_image",
        protocol: "responses",
        provider: "openai",
        model: "gpt-5.5",
        durationMs: 4321,
        usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
        usageMeta: { imageGenerationTool: true },
        status: options.failWith ? "failed" : "success",
      });
      if (options.failWith) throw options.failWith;
      return {
        imageBase64: pngBase64,
        mimeType: "image/png",
        model: "gpt-5.5",
        usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
        usageMeta: { imageGenerationTool: true },
      };
    },
    async hasFallback(): Promise<boolean> {
      fallbackCalls += 1;
      return false;
    },
  };

  return { invoker, calls: () => calls, fallbackCalls: () => fallbackCalls };
}

// ─── Brief/contexto/params de execução ───────────────────────────────────────

function createBrief(): CampaignBrief {
  return buildCampaignBriefFromFlat(
    {
      storeId: STORE_ID,
      productName: "Produto Teste",
      discountedPriceCents: 1990,
      badgeText: "Oferta",
      campaignIntent: "offer",
      productImageDataUrl: "data:image/jpeg;base64,dGVzdA==",
    } as GenerateImageRequest,
    STORE_ID,
  );
}

function createContext(): ResolvedCampaignContext {
  return {
    campaignInput: {
      productName: "Produto Teste",
      discountedPriceCents: 1990,
      productImageDataUrl: "data:image/jpeg;base64,dGVzdA==",
      badgeText: "Oferta",
      campaignIntent: "offer",
    },
    store: {
      name: "Loja Teste",
      segment: "outros",
      subsegment: null,
      toneOfVoice: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
      brandColor: "#22C55E",
    },
    brandProfile: null,
    identity: { state: "text_only", imageUrl: null, directive: "" },
  };
}

function candidateSnapshot() {
  return {
    name: PROMPT_NAME,
    content: CANDIDATE_CONTENT,
    contentHash: CANDIDATE_HASH,
    source: "override" as const,
  };
}

function baselineSnapshot() {
  return {
    name: PROMPT_NAME,
    content: BASELINE_CONTENT,
    contentHash: BASELINE_HASH,
    source: "official" as const,
  };
}

function prepareParams(
  state: MemoryState,
  overrides: Partial<Parameters<typeof prepareLabRun>[0]> = {},
): Parameters<typeof prepareLabRun>[0] {
  return {
    client: asClient(state),
    experimentId: EXPERIMENT_ID,
    variantId: VARIANT_ID,
    scenarioVersionId: SCENARIO_VERSION_ID,
    repetitionIndex: 1,
    supersedesRunId: null,
    operationId: OPERATION_ID,
    actorId: ACTOR_ID,
    scenario: { id: SCENARIO_VERSION_ID, version: 1, contentHash: SCENARIO_HASH },
    experiment: { modelTarget: TARGET, params: LAB_PARAMS },
    variant: { role: "candidate", promptSnapshot: candidateSnapshot() },
    variants: { baseline: baselineSnapshot(), candidate: candidateSnapshot() },
    ...overrides,
  };
}

function executionScenario() {
  return {
    imagesDataUrls: { "images/produto.jpg": "data:image/jpeg;base64,dGVzdA==" },
    logoDataUrl: null,
    brief: createBrief(),
    context: createContext(),
  };
}

async function runOneReservedRun(params: {
  state: MemoryState;
  invoker: CountingInvoker;
}): Promise<{ status: LabRunStatus }> {
  const promptLoader = new LabPromptLoader([{ name: PROMPT_NAME, content: CANDIDATE_CONTENT }]);
  const prepared = await prepareLabRun(prepareParams(params.state));

  const executed = await runReservedLabRun({
    client: asClient(params.state),
    experimentId: EXPERIMENT_ID,
    runId: prepared.runId,
    snapshot: prepared.snapshot,
    actorId: ACTOR_ID,
    scenario: executionScenario(),
    experiment: { params: LAB_PARAMS },
    gateway: params.invoker.invoker,
    sink: new LabTelemetrySink(),
    promptLoader,
    imageService: new ImageGenerationService(createNoopImageProvider(), promptLoader),
  });

  return { status: executed.status };
}

// ─── (11.5.1) Confirmação explícita é parte do contrato ─────────────────────

describe("confirmação explícita — sem `confirmed: true` não há execução", () => {
  const base = {
    variantId: VARIANT_ID,
    scenarioVersionId: SCENARIO_VERSION_ID,
    repetitionIndex: 1,
    operationId: OPERATION_ID,
  };

  it("rejeita payload sem `confirmed`", () => {
    const result = LabRunExecuteRequestSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejeita `confirmed: false`", () => {
    const result = LabRunExecuteRequestSchema.safeParse({ ...base, confirmed: false });
    expect(result.success).toBe(false);
  });

  it("aceita `confirmed: true` (confirmação literal)", () => {
    const result = LabRunExecuteRequestSchema.safeParse({ ...base, confirmed: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.confirmed).toBe(true);
  });
});

// ─── (11.5.2) Reserva antes do gasto ────────────────────────────────────────

describe("reserva antes do gasto — recusa da reserva não invoca nada", () => {
  const reservationFailures = [
    "budget_exceeded",
    "run_already_active",
    "experiment_not_ready",
    "invalid_supersedes_run",
  ] as const;

  for (const code of reservationFailures) {
    it(`${code} → LabReservationError com o código exato e zero invocações`, async () => {
      const state = newSeedWithForcedReservationError(code);
      const counting = createCountingInvoker();

      const rejection = await prepareLabRun(prepareParams(state)).catch((error: unknown) => error);

      expect(rejection).toBeInstanceOf(LabReservationError);
      expect((rejection as LabReservationError).code).toBe(code);
      expect(counting.calls()).toBe(0);
    });
  }

  it("o snapshot é montado e enviado na reserva (nunca vazio)", async () => {
    const state = newState(seedReadyExperiment());
    const counting = createCountingInvoker();

    await prepareLabRun(prepareParams(state));

    const call = state.rpcCalls.find((entry) => entry.fn === "lab_reserve_run");
    expect(call).toBeDefined();
    expect(JSON.stringify(call?.args.p_snapshot)).not.toBe("{}");
    expect(counting.calls()).toBe(0);
  });
});

/** Estado com a RPC de reserva forçada a devolver o código pedido. */
function newSeedWithForcedReservationError(code: string): MemoryState {
  const state = newState(seedReadyExperiment());
  state.forcedReservationError = code;
  return state;
}

// ─── (11.5.3/11.5.4) Budget e concorrência global ───────────────────────────

describe("budget — teto do experimento respeitado sem chamada paga", () => {
  it("com o teto atingido → budget_exceeded e zero invocações", async () => {
    const state = newState(seedReadyExperiment({ max_runs: 2 }));
    state.tables.lab_runs = [
      { id: "run-a", experiment_id: EXPERIMENT_ID, status: "succeeded" },
      { id: "run-b", experiment_id: EXPERIMENT_ID, status: "failed" },
    ];
    const counting = createCountingInvoker();

    const rejection = await prepareLabRun(prepareParams(state)).catch((error: unknown) => error);

    expect((rejection as LabReservationError).code).toBe("budget_exceeded");
    expect(counting.calls()).toBe(0);
    expect(state.tables.lab_runs).toHaveLength(2);
  });

  it("remainingRuns === 0 → recusa", async () => {
    const state = newState(seedReadyExperiment({ max_runs: 1 }));
    state.tables.lab_runs = [{ id: "run-a", experiment_id: EXPERIMENT_ID, status: "cancelled" }];

    await expect(prepareLabRun(prepareParams(state))).rejects.toMatchObject({
      name: "LabReservationError",
      code: "budget_exceeded",
    });
  });

  it("no teto absoluto (MAX_RUNS_PER_EXPERIMENT) o laboratório nunca ultrapassa o limite", async () => {
    const state = newState(seedReadyExperiment({ max_runs: MAX_RUNS_PER_EXPERIMENT }));
    state.tables.lab_runs = Array.from({ length: MAX_RUNS_PER_EXPERIMENT }, (_, index) => ({
      id: `run-${index}`,
      experiment_id: EXPERIMENT_ID,
      status: "succeeded",
    }));

    await expect(prepareLabRun(prepareParams(state))).rejects.toMatchObject({
      name: "LabReservationError",
      code: "budget_exceeded",
    });
    expect(state.tables.lab_runs).toHaveLength(MAX_RUNS_PER_EXPERIMENT);
  });
});

describe("concorrência global — no máximo um run ativo no laboratório", () => {
  it("MAX_CONCURRENT_LAB_RUNS === 1 é o invariante exercitado", () => {
    expect(MAX_CONCURRENT_LAB_RUNS).toBe(1);
  });

  for (const status of ["pending", "running"] as const) {
    it(`run ativo em OUTRO experimento (${status}) → run_already_active sem chamada paga`, async () => {
      const state = newState(seedReadyExperiment());
      state.tables.lab_runs = [
        { id: "run-other", experiment_id: OTHER_EXPERIMENT_ID, status },
      ];
      const counting = createCountingInvoker();

      const rejection = await prepareLabRun(prepareParams(state)).catch((error: unknown) => error);

      expect((rejection as LabReservationError).code).toBe("run_already_active");
      expect(counting.calls()).toBe(0);
      // O run ativo de outro experimento não é alterado.
      expect(state.tables.lab_runs).toHaveLength(1);
    });
  }

  it("run terminal de outro experimento não bloqueia (só o ativo bloqueia)", async () => {
    const state = newState(seedReadyExperiment());
    state.tables.lab_runs = [
      { id: "run-other", experiment_id: OTHER_EXPERIMENT_ID, status: "succeeded" },
    ];

    const prepared = await prepareLabRun(prepareParams(state));

    expect(prepared.idempotent).toBe(false);
    expect(prepared.runId).toBeTruthy();
  });
});

// ─── (11.5.5) Idempotência vinculada ao payload ─────────────────────────────

describe("idempotência — vinculada ao payload, sem reexecução", () => {
  it("mesma operationId + mesmo payload → idempotente e zero invocações adicionais", async () => {
    const state = newState(seedReadyExperiment());
    const counting = createCountingInvoker();

    const first = await prepareLabRun(prepareParams(state));
    expect(first.idempotent).toBe(false);

    const promptLoader = new LabPromptLoader([{ name: PROMPT_NAME, content: CANDIDATE_CONTENT }]);
    const second = await executeLabRun({
      ...prepareParams(state),
      scenario: { id: SCENARIO_VERSION_ID, version: 1, contentHash: SCENARIO_HASH, ...executionScenario() },
      gateway: counting.invoker,
      sink: new LabTelemetrySink(),
      promptLoader,
      imageService: new ImageGenerationService(createNoopImageProvider(), promptLoader),
    });

    expect(second.idempotent).toBe(true);
    expect(second.status).toBe("pending");
    expect(counting.calls()).toBe(0);
    expect(state.tables.lab_runs).toHaveLength(1);
  });

  it("mesma operationId + payload diferente → idempotency_conflict", async () => {
    const state = newState(seedReadyExperiment());

    await prepareLabRun(prepareParams(state));

    await expect(
      prepareLabRun(prepareParams(state, { variantId: OTHER_VARIANT_ID })),
    ).rejects.toMatchObject({ name: "LabReservationError", code: "idempotency_conflict" });

    await expect(
      prepareLabRun(prepareParams(state, { repetitionIndex: 2 })),
    ).rejects.toMatchObject({ name: "LabReservationError", code: "idempotency_conflict" });

    expect(state.tables.lab_runs).toHaveLength(1);
  });
});

// ─── (11.5.6) Sem loops automáticos: exatamente 1 invocação por run ─────────

describe("sem loops automáticos — exatamente uma chamada `campaign_image` por run", () => {
  it("um run bem-sucedido invoca o gateway uma única vez, sem fallback", async () => {
    const state = newState(seedReadyExperiment());
    const counting = createCountingInvoker();

    const result = await runOneReservedRun({ state, invoker: counting });

    expect(result.status).toBe("succeeded");
    expect(counting.calls()).toBe(1);
    expect(counting.fallbackCalls()).toBe(0);
  });

  it("falha do provider encerra o run sem segunda chamada (fallback desabilitado)", async () => {
    const state = newState(seedReadyExperiment());
    const counting = createCountingInvoker({ failWith: new Error("provider boom") });

    const result = await runOneReservedRun({ state, invoker: counting });

    expect(result.status).toBe("failed");
    expect(counting.calls()).toBe(1);
    expect(counting.fallbackCalls()).toBe(0);
  });

  it("nenhuma telemetria produtiva é gravada durante a execução", async () => {
    const state = newState(seedReadyExperiment());
    const counting = createCountingInvoker();

    await runOneReservedRun({ state, invoker: counting });

    expect(mockRecord).not.toHaveBeenCalled();
    expect(state.insertCalls.filter((call) => call.table === "generation_events")).toEqual([]);
  });
});

// ─── (11.6) Higiene da suíte de testes do laboratório ───────────────────────

const SELF = "src/lib/lab/__tests__/lab-financial-safety.contract.test.ts";
const LAB_TEST_ROOTS = [
  "src/lib/lab",
  "src/app/api/admin/laboratorio",
  "src/app/(app)/admin/laboratorio",
];

function normalize(file: string): string {
  return file.split(path.sep).join("/");
}

function collectLabTestFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const relative = normalize(path.relative(process.cwd(), full));
      if (/__tests__\//.test(relative) && /\.test\.tsx?$/.test(relative)) out.push(relative);
    }
  };
  for (const root of LAB_TEST_ROOTS) walk(path.resolve(process.cwd(), root));
  return out.sort();
}

/** Remove comentários antes de casar (evita falso positivo em documentação). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readTestFile(file: string): string {
  return stripComments(readFileSync(path.resolve(process.cwd(), file), "utf8"));
}

describe("higiene da suíte — nenhum SDK/wire de provider nos testes do laboratório", () => {
  const files = collectLabTestFiles().filter((file) => file !== SELF);

  it("a varredura encontra arquivos de teste do laboratório", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const FORBIDDEN_PROVIDER_PATTERNS: Array<{ name: string; re: RegExp }> = [
    { name: "new OpenAI(", re: /new\s+OpenAI\s*\(/ },
    { name: "new GoogleGenerativeAI(", re: /new\s+GoogleGenerativeAI\s*\(/ },
    { name: "api.openai.com", re: /api\.openai\.com/ },
    { name: "generativelanguage.googleapis.com", re: /generativelanguage\.googleapis\.com/ },
    { name: "provider openai", re: /@\/lib\/image-generation\/providers\/openai/ },
    { name: "OpenAIImageProvider", re: /OpenAIImageProvider/ },
  ];

  it("nenhum teste instancia SDK de provider nem chama endpoint de provider", () => {
    const violations: string[] = [];
    for (const file of files) {
      const code = readTestFile(file);
      for (const { name, re } of FORBIDDEN_PROVIDER_PATTERNS) {
        if (re.test(code)) violations.push(`${file} → ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("a suíte do laboratório não lê nenhuma imagem gerada do disco", () => {
    const generatedImageRead = /readFile(?:Sync)?\s*\([^)]*(?:output\.png|lab-artifacts\/)/;
    const violations = files.filter((file) => generatedImageRead.test(readTestFile(file)));
    expect(violations).toEqual([]);
  });

  it("as imagens usadas vêm apenas das fixtures controladas (`fixtures/lab/scenarios`)", () => {
    const foreignFixture = /fixtures\/(?!lab\/)/;
    const violations = files.filter((file) => foreignFixture.test(readTestFile(file)));
    expect(violations).toEqual([]);
  });
});

// ─── Invariantes de limite exercitados pela suíte ──────────────────────────

describe("limites exercitados — repetições e teto travados", () => {
  it("MAX_REPETITIONS e MAX_RUNS_PER_EXPERIMENT são os valores travados", () => {
    expect(MAX_REPETITIONS).toBe(3);
    expect(MAX_RUNS_PER_EXPERIMENT).toBe(12);
    expect(DEFAULT_MAX_RUNS_PER_EXPERIMENT).toBeLessThanOrEqual(MAX_RUNS_PER_EXPERIMENT);
  });
});
