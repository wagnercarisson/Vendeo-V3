// @vitest-environment node
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const { mockResolveAiCost, mockPersistOutputArtifact } = vi.hoisted(() => {
  // O `ImageGenerationService` importa `@/lib/ai` (gateway default) → sink padrão
  // → tracker → supabase/server. Sem env, lança na importação.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  return { mockResolveAiCost: vi.fn(), mockPersistOutputArtifact: vi.fn() };
});

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

vi.mock("@/lib/lab/persistence/artifact-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/lab/persistence/artifact-service")>();
  return { ...actual, persistOutputArtifact: mockPersistOutputArtifact };
});

import {
  ARTIFACT_PERSISTENCE_FAILED,
  LAB_RESERVATION_ERROR_CODES,
  LAB_RUN_ABORTED,
  LAB_RUN_SCENARIO_MISMATCH,
  LAB_RUN_TRANSITION_FAILED,
  LabReservationError,
  UNSUPPORTED_ARTIFACT_MIME_TYPE,
  executeLabRun,
  finalizeLabRun,
  isRunTerminal,
  markRunRunning,
  prepareLabRun,
  reconcileStaleRuns,
  reserveLabRun,
  runReservedLabRun,
} from "../run-service";
import type { LabRunEvent, LabRunStatus } from "../run-service";
import type { LabRunSnapshot } from "../run-snapshot";
import type { LabExperimentParams } from "../domain/schemas";
import { computePromptContentHash } from "../domain/prompt-snapshot";
import { LabPromptLoader } from "../gateway/lab-prompt-loader";
import { createNoopImageProvider } from "../gateway/noop-image-provider";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import type { AiCallEnvelope, AiInvocationRequest, AiInvocationResult, AiTelemetryContext } from "@/lib/ai/types";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { CostResolution } from "@/lib/ai-cost/types";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import { buildCampaignBriefFromFlat } from "@/lib/campaign/brief";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";

/**
 * Serviço de execução do laboratório (F48.1, D7/D8/D14) — reserva atômica,
 * transições e reconciliação de órfãos.
 *
 * Client **100% fake em memória**: nenhuma chamada de rede e nenhuma chamada
 * paga. O RPC `lab_reserve_run` é simulado com filas configuráveis.
 */

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "22222222-2222-4222-8222-222222222222";
const SCENARIO_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "66666666-6666-4666-8666-666666666666";

interface FakeResult {
  data?: unknown;
  error: { message: string } | null;
}

interface RecordedFilter {
  column: string;
  value: unknown;
  op: "eq" | "in" | "lt" | "is";
}

interface RecordedUpdate {
  table: string;
  values: Record<string, unknown>;
  filters: RecordedFilter[];
}

interface RecordedSelect {
  table: string;
  columns: string;
  filters: RecordedFilter[];
}

class FakeQueryBuilder {
  private readonly filters: RecordedFilter[] = [];
  private operation: "select" | "update" | null = null;
  private returning = false;
  private payload: Record<string, unknown> = {};

  constructor(
    private readonly fake: FakeSupabaseClient,
    private readonly table: string,
  ) {}

  select(columns: string): this {
    // `.update(...).select(...)` é um update **com retorno** (compare-and-set):
    // não pode virar um select.
    if (this.operation === "update") {
      this.returning = true;
    } else {
      this.operation = "select";
    }
    this.fake.selectCalls.push({ table: this.table, columns });
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.operation = "update";
    this.payload = values;
    this.fake.updateCalls.push({ table: this.table, values });
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value, op: "eq" });
    return this;
  }

  in(column: string, value: unknown[]): this {
    this.filters.push({ column, value, op: "in" });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ column, value, op: "lt" });
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push({ column, value, op: "is" });
    return this;
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private matches(row: Record<string, unknown>, filter: RecordedFilter): boolean {
    if (filter.op === "eq") return row[filter.column] === filter.value;
    if (filter.op === "in") return (filter.value as unknown[]).includes(row[filter.column]);
    if (filter.op === "is") {
      if (filter.value === null) {
        return row[filter.column] === null || row[filter.column] === undefined;
      }
      return row[filter.column] === filter.value;
    }
    // lt — comparação cronológica por parse (ISO 8601).
    const rowValue = row[filter.column];
    if (typeof rowValue !== "string" || typeof filter.value !== "string") return false;
    return Date.parse(rowValue) < Date.parse(filter.value);
  }

  private resolve(): FakeResult {
    if (this.operation === "update") {
      this.fake.appliedUpdates.push({
        table: this.table,
        values: this.payload,
        filters: this.filters,
      });
      if (this.fake.updateResults.length > 0) {
        return this.fake.updateResults.shift() as FakeResult;
      }
      if (this.returning) {
        // Simula `.select()` pós-update (CAS). Quando o teste semeia `selectRows`,
        // devolve as linhas que casam com os filtros do update; caso contrário,
        // assume 1 linha afetada.
        const seeded = Array.isArray(this.fake.selectRows) ? this.fake.selectRows : [];
        if (seeded.length > 0) {
          const affected = seeded.filter((row) =>
            this.filters.every((filter) => this.matches(row, filter)),
          );
          return { data: affected, error: null };
        }
        return { data: [{ id: RUN_ID }], error: null };
      }
      return this.fake.updateResult;
    }

    const rows = Array.isArray(this.fake.selectRows) ? this.fake.selectRows : [];
    const filtered = rows.filter((row) => this.filters.every((filter) => this.matches(row, filter)));
    this.fake.appliedSelects.push({
      table: this.table,
      columns: this.fake.selectCalls[this.fake.selectCalls.length - 1]?.columns ?? "",
      filters: this.filters,
    });
    return { data: filtered, error: this.fake.selectError };
  }
}

class FakeSupabaseClient {
  readonly rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  readonly updateCalls: Array<{ table: string; values: Record<string, unknown> }> = [];
  readonly selectCalls: Array<{ table: string; columns: string }> = [];
  readonly appliedUpdates: RecordedUpdate[] = [];
  readonly appliedSelects: RecordedSelect[] = [];

  rpcResult: FakeResult = {
    data: { success: true, idempotent: false, run_id: RUN_ID, run_sequence: 1 },
    error: null,
  };
  updateResult: FakeResult = { data: null, error: null };
  updateResults: FakeResult[] = [];
  selectResult: FakeResult = { data: [], error: null };
  selectError: { message: string } | null = null;
  selectRows: Array<Record<string, unknown>> = [];

  rpc(fn: string, args: Record<string, unknown>): Promise<FakeResult> {
    this.rpcCalls.push({ fn, args });
    return Promise.resolve(this.rpcResult);
  }

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }
}

const VALID_SNAPSHOT: LabRunSnapshot = {
  scenarioVersionId: SCENARIO_ID,
  scenarioVersion: 1,
  scenarioContentHash: "c".repeat(64),
  prompt: {
    name: "campaign-image-director-offer",
    content: "conteudo candidato",
    contentHash: "b".repeat(64),
    source: "override",
  },
  capability: "campaign_image",
  modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
  params: { size: "1024x1024", quality: "auto", skipInputValidation: true },
  changedDimension: "prompt",
  variantRole: "candidate",
  codeVersion: null,
  baselineConfig: {
    promptName: "campaign-image-director-offer",
    promptContentHash: "a".repeat(64),
    source: "official",
  },
  candidateConfig: {
    promptName: "campaign-image-director-offer",
    promptContentHash: "b".repeat(64),
    source: "override",
  },
  runType: "lab",
};

function reservationParams(client: FakeSupabaseClient) {
  return {
    client: client as unknown as SupabaseClient,
    experimentId: EXPERIMENT_ID,
    variantId: VARIANT_ID,
    scenarioVersionId: SCENARIO_ID,
    repetitionIndex: 1,
    supersedesRunId: null,
    snapshot: VALID_SNAPSHOT,
    operationId: OPERATION_ID,
    actorId: ACTOR_ID,
  };
}

let client: FakeSupabaseClient;

// ─── Execução real: helpers (D7/D8) ──────────────────────────────────────────

const PROMPT_NAME = "campaign-image-director-offer";
const CANDIDATE_CONTENT = "conteudo candidato do diretor (override em memoria)";
const BASELINE_CONTENT = "conteudo oficial do diretor";
const CANDIDATE_HASH = computePromptContentHash(CANDIDATE_CONTENT);
const BASELINE_HASH = computePromptContentHash(BASELINE_CONTENT);
const STORE_ID = "77777777-7777-4777-8777-777777777777";

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

const LAB_PARAMS: LabExperimentParams = {
  size: "1024x1024",
  quality: "auto",
  skipInputValidation: true,
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

function executionSnapshot(): LabRunSnapshot {
  return {
    scenarioVersionId: SCENARIO_ID,
    scenarioVersion: 1,
    scenarioContentHash: "c".repeat(64),
    prompt: {
      name: PROMPT_NAME,
      content: CANDIDATE_CONTENT,
      contentHash: CANDIDATE_HASH,
      source: "override",
    },
    capability: "campaign_image",
    modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
    params: LAB_PARAMS,
    changedDimension: "prompt",
    variantRole: "candidate",
    codeVersion: null,
    baselineConfig: {
      promptName: PROMPT_NAME,
      promptContentHash: BASELINE_HASH,
      source: "official",
    },
    candidateConfig: {
      promptName: PROMPT_NAME,
      promptContentHash: CANDIDATE_HASH,
      source: "override",
    },
    runType: "lab",
  };
}

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

function createPromptLoader(content = CANDIDATE_CONTENT): LabPromptLoader {
  return new LabPromptLoader([{ name: PROMPT_NAME, content }]);
}

interface FakeInvokerState {
  calls: number;
  requests: AiInvocationRequest[];
  hasFallbackCalls: number;
  failWith?: Error;
  omitImage?: boolean;
  /** Buffer alternativo devolvido como imagem (para testar MIME real). */
  imageBuffer?: Buffer;
  /** MIME declarado pelo provider (default `image/png`). */
  mimeType?: string;
}

function createFakeInvoker(state: FakeInvokerState): AiInvoker {
  return {
    async invoke(
      _capability,
      request,
      telemetry,
    ): Promise<AiInvocationResult> {
      state.calls += 1;
      state.requests.push(request);

      if (state.failWith) {
        await emitEnvelope(telemetry, { status: "failed", errorType: "provider boom" });
        throw state.failWith;
      }

      await emitEnvelope(telemetry, { status: "success" });
      if (state.omitImage) return { model: "gpt-5.5" };
      return {
        imageBase64: (state.imageBuffer ?? Buffer.from(pngBase64, "base64")).toString("base64"),
        mimeType: state.mimeType ?? "image/png",
        model: "gpt-5.5",
        usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
        usageMeta: { imageGenerationTool: true },
      };
    },
    async hasFallback(): Promise<boolean> {
      state.hasFallbackCalls += 1;
      return false;
    },
  };
}

async function emitEnvelope(
  telemetry: AiTelemetryContext,
  overrides: Partial<AiCallEnvelope>,
): Promise<void> {
  await telemetry.sink.emit({
    capability: "campaign_image",
    protocol: "responses",
    provider: "openai",
    model: "gpt-5.5",
    durationMs: 4321,
    usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
    usageMeta: { imageGenerationTool: true },
    status: "success",
    ...overrides,
  });
}

function prepareParams(
  overrides: Partial<Parameters<typeof prepareLabRun>[0]> = {},
): Parameters<typeof prepareLabRun>[0] {
  return {
    client: client as unknown as SupabaseClient,
    experimentId: EXPERIMENT_ID,
    variantId: VARIANT_ID,
    scenarioVersionId: SCENARIO_ID,
    repetitionIndex: 1,
    supersedesRunId: null,
    operationId: OPERATION_ID,
    actorId: ACTOR_ID,
    scenario: { id: SCENARIO_ID, version: 1, contentHash: "c".repeat(64) },
    experiment: {
      modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
      params: LAB_PARAMS,
    },
    variant: {
      role: "candidate" as const,
      promptSnapshot: {
        name: PROMPT_NAME,
        content: CANDIDATE_CONTENT,
        contentHash: CANDIDATE_HASH,
        source: "override" as const,
      },
    },
    variants: {
      baseline: {
        name: PROMPT_NAME,
        content: BASELINE_CONTENT,
        contentHash: BASELINE_HASH,
        source: "official" as const,
      },
      candidate: {
        name: PROMPT_NAME,
        content: CANDIDATE_CONTENT,
        contentHash: CANDIDATE_HASH,
        source: "override" as const,
      },
    },
    ...overrides,
  };
}

function runParams(
  state: FakeInvokerState,
  overrides: Partial<Parameters<typeof runReservedLabRun>[0]> = {},
): Parameters<typeof runReservedLabRun>[0] {
  const promptLoader = createPromptLoader();
  return {
    client: client as unknown as SupabaseClient,
    experimentId: EXPERIMENT_ID,
    runId: RUN_ID,
    snapshot: executionSnapshot(),
    actorId: ACTOR_ID,
    scenario: {
      imagesDataUrls: { "images/produto.jpg": "data:image/jpeg;base64,AAAA" },
      logoDataUrl: null,
      brief: createBrief(),
      context: createContext(),
    },
    experiment: { params: LAB_PARAMS },
    gateway: createFakeInvoker(state),
    sink: new LabTelemetrySink(),
    promptLoader,
    imageService: new ImageGenerationService(createNoopImageProvider(), promptLoader),
    ...overrides,
  };
}

function executeParams(
  state: FakeInvokerState,
  overrides: Partial<Parameters<typeof executeLabRun>[0]> = {},
): Parameters<typeof executeLabRun>[0] {
  const promptLoader = createPromptLoader();
  return {
    ...prepareParams(),
    scenario: {
      id: SCENARIO_ID,
      version: 1,
      contentHash: "c".repeat(64),
      imagesDataUrls: { "images/produto.jpg": "data:image/jpeg;base64,AAAA" },
      logoDataUrl: null,
      brief: createBrief(),
      context: createContext(),
    },
    gateway: createFakeInvoker(state),
    sink: new LabTelemetrySink(),
    promptLoader,
    imageService: new ImageGenerationService(createNoopImageProvider(), promptLoader),
    ...overrides,
  };
}

function newInvokerState(): FakeInvokerState {
  return { calls: 0, requests: [], hasFallbackCalls: 0 };
}

function labRunUpdates(): Array<Record<string, unknown>> {
  return client.appliedUpdates
    .filter((update) => update.table === "lab_runs")
    .map((update) => update.values);
}

beforeEach(() => {
  client = new FakeSupabaseClient();
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue(FULL_COST);
  mockPersistOutputArtifact.mockResolvedValue({
    artifactId: "artifact-1",
    storagePath: `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`,
    checksum: "d".repeat(64),
    bytes: 128,
  });
});

describe("reserveLabRun — reserva atômica antes de qualquer chamada paga", () => {
  it("chama lab_reserve_run com os 8 parâmetros p_* e snapshot não vazio", async () => {
    const result = await reserveLabRun(reservationParams(client));

    expect(client.rpcCalls).toHaveLength(1);
    const call = client.rpcCalls[0];
    expect(call.fn).toBe("lab_reserve_run");
    expect(Object.keys(call.args).sort()).toEqual(
      [
        "p_actor_id",
        "p_experiment_id",
        "p_operation_id",
        "p_repetition_index",
        "p_scenario_version_id",
        "p_snapshot",
        "p_supersedes_run_id",
        "p_variant_id",
      ].sort(),
    );
    expect(call.args.p_snapshot).toEqual(VALID_SNAPSHOT);
    expect(JSON.stringify(call.args.p_snapshot)).not.toBe("{}");
    expect(call.args.p_operation_id).toBe(OPERATION_ID);
    expect(call.args.p_actor_id).toBe(ACTOR_ID);
    expect(result).toEqual({ runId: RUN_ID, runSequence: 1, idempotent: false });
  });

  it("usa o run_sequence devolvido pela RPC, nunca um valor calculado", async () => {
    client.rpcResult = {
      data: { success: true, idempotent: false, run_id: RUN_ID, run_sequence: 7 },
      error: null,
    };

    const result = await reserveLabRun(reservationParams(client));

    expect(result.runSequence).toBe(7);
    expect(client.rpcCalls[0].args).not.toHaveProperty("p_run_sequence");
  });

  it("runSequence é null quando a RPC não devolve a sequência", async () => {
    client.rpcResult = { data: { success: true, idempotent: false, run_id: RUN_ID }, error: null };

    const result = await reserveLabRun(reservationParams(client));

    expect(result.runSequence).toBeNull();
  });

  it("reserva idempotente devolve o run existente", async () => {
    client.rpcResult = { data: { success: true, idempotent: true, run_id: RUN_ID }, error: null };

    const result = await reserveLabRun(reservationParams(client));

    expect(result).toEqual({ runId: RUN_ID, runSequence: null, idempotent: true });
  });

  it("snapshot incompleto é recusado antes de qualquer I/O", async () => {
    const params = reservationParams(client);
    params.snapshot = { ...VALID_SNAPSHOT, prompt: { ...VALID_SNAPSHOT.prompt, content: "" } };

    await expect(reserveLabRun(params)).rejects.toThrow("missing_snapshot");
    expect(client.rpcCalls).toHaveLength(0);
  });

  for (const code of LAB_RESERVATION_ERROR_CODES) {
    it(`mapeia o erro ${code} para LabReservationError`, async () => {
      client.rpcResult = { data: null, error: { message: `P0001: ${code}` } };

      await expect(reserveLabRun(reservationParams(client))).rejects.toMatchObject({
        name: "LabReservationError",
        code,
      });
    });
  }

  it("erro desconhecido vira lab_reservation_failed", async () => {
    client.rpcResult = { data: null, error: { message: "connection reset" } };

    const rejection = await reserveLabRun(reservationParams(client)).catch((err: unknown) => err);

    expect(rejection).toBeInstanceOf(LabReservationError);
    expect((rejection as LabReservationError).code).toBe("lab_reservation_failed");
  });
});

describe("markRunRunning / finalizeLabRun — transições do run", () => {
  it("markRunRunning grava status running, started_at e attempts", async () => {
    await markRunRunning({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      startedAt: "2026-09-16T10:00:00.000Z",
    });

    expect(client.updateCalls).toHaveLength(1);
    expect(client.updateCalls[0].table).toBe("lab_runs");
    expect(client.updateCalls[0].values).toMatchObject({
      status: "running",
      started_at: "2026-09-16T10:00:00.000Z",
      attempts: 1,
    });
  });

  it("finalizeLabRun grava status/finished_at e as evidências do resultado", async () => {
    await finalizeLabRun({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      status: "succeeded",
      latencyMs: 8123,
      usage: { totalTokens: 120 },
      estimatedCostUsd: 0.0421,
      costDetail: { estimatedCostUsd: 0.0421, costSource: "pricing_table" },
      calls: [{ capability: "campaign_image" }],
      technicalValidation: { decodable: true },
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
      capability: "campaign_image",
      attempts: 1,
      finishedAt: "2026-09-16T10:00:10.000Z",
    });

    expect(client.updateCalls[0].values).toMatchObject({
      status: "succeeded",
      finished_at: "2026-09-16T10:00:10.000Z",
      latency_ms: 8123,
      estimated_cost_usd: 0.0421,
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
      capability: "campaign_image",
      attempts: 1,
    });
  });

  it("finalizeLabRun sanitiza a mensagem de erro antes de gravar", async () => {
    await finalizeLabRun({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      status: "failed",
      errorType: "provider_error",
      errorMessage: "falha com Bearer sk-abc123456789 na chamada",
    });

    const written = client.updateCalls[0].values.error_message as string;
    expect(written).not.toContain("sk-");
    expect(written).toContain("[redacted]");
  });

  it("nenhuma transição grava a coluna snapshot (imutabilidade)", async () => {
    await markRunRunning({ client: client as unknown as SupabaseClient, runId: RUN_ID });
    await finalizeLabRun({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      status: "failed",
      errorType: "provider_error",
      errorMessage: "erro",
    });

    for (const call of client.updateCalls) {
      expect(call.values).not.toHaveProperty("snapshot");
    }
  });

  it("isRunTerminal reconhece apenas os estados terminais", () => {
    const terminal: LabRunStatus[] = ["succeeded", "failed", "cancelled", "timeout"];
    const active: LabRunStatus[] = ["pending", "running"];

    for (const status of terminal) expect(isRunTerminal(status)).toBe(true);
    for (const status of active) expect(isRunTerminal(status)).toBe(false);
  });
});

describe("reconcileStaleRuns — runs órfãos em pending E running", () => {
  const NOW = new Date("2026-09-16T12:00:00.000Z");
  const OLD = "2026-09-16T10:00:00.000Z";
  const RECENT = "2026-09-16T11:59:00.000Z";

  it("marca pending e running antigos como failed com orphan_run_timeout", async () => {
    client.selectRows = [
      { id: "old-pending", status: "pending", started_at: null, created_at: OLD },
      { id: "old-running", status: "running", started_at: OLD, created_at: OLD },
    ];

    const result = await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now: NOW });

    expect(result.reconciled).toBe(2);
    // Dois ramos do coalesce: um update para `running`, um para `pending`.
    expect(client.appliedUpdates).toHaveLength(2);
    for (const update of client.appliedUpdates) {
      expect(update.values).toMatchObject({
        status: "failed",
        error_type: "orphan_run_timeout",
        finished_at: NOW.toISOString(),
      });
      const idFilter = update.filters.find((filter) => filter.column === "id");
      expect(idFilter?.value).toEqual(["old-pending", "old-running"]);
    }
    // O cutoff é reaplicado no próprio update (não apenas no select).
    const runningUpdate = client.appliedUpdates.find((update) =>
      update.filters.some((filter) => filter.column === "status" && filter.value === "running"),
    );
    const pendingUpdate = client.appliedUpdates.find((update) =>
      update.filters.some((filter) => filter.column === "status" && filter.value === "pending"),
    );
    expect(
      runningUpdate?.filters.some((filter) => filter.column === "started_at" && filter.op === "lt"),
    ).toBe(true);
    expect(
      pendingUpdate?.filters.some((filter) => filter.column === "created_at" && filter.op === "lt"),
    ).toBe(true);
  });

  it("ignora runs recentes (dentro da janela de inatividade)", async () => {
    client.selectRows = [
      { id: "recent-pending", status: "pending", started_at: null, created_at: RECENT },
      { id: "recent-running", status: "running", started_at: RECENT, created_at: RECENT },
    ];

    const result = await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now: NOW });

    expect(result.reconciled).toBe(0);
    expect(client.appliedUpdates).toHaveLength(0);
  });

  it("ignora runs já terminais (o filtro de status ativo os exclui)", async () => {
    client.selectRows = [
      { id: "old-succeeded", status: "succeeded", started_at: OLD, created_at: OLD },
      { id: "old-failed", status: "failed", started_at: OLD, created_at: OLD },
    ];

    const result = await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now: NOW });

    expect(result.reconciled).toBe(0);
    expect(client.appliedUpdates).toHaveLength(0);
    expect(client.selectCalls[0].columns).toContain("status");
  });

  it("respeita staleMs customizado (janela maior ignora o run antigo)", async () => {
    client.selectRows = [
      { id: "old-running", status: "running", started_at: OLD, created_at: OLD },
    ];

    const result = await reconcileStaleRuns({
      client: client as unknown as SupabaseClient,
      now: NOW,
      staleMs: 3 * 60 * 60 * 1000,
    });

    expect(result.reconciled).toBe(0);
  });

  it("cobre os dois estados ativos na consulta", async () => {
    client.selectRows = [];

    await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now: NOW });

    const statusFilter = client.appliedSelects[0].filters.find(
      (filter) => filter.column === "status",
    );
    expect(statusFilter?.value).toEqual(["pending", "running"]);
  });
});


describe("prepareLabRun — snapshot antes da reserva", () => {
  it("monta o snapshot completo e faz exatamente 1 chamada de RPC", async () => {
    const result = await prepareLabRun(prepareParams());

    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0].fn).toBe("lab_reserve_run");
    expect(result.runId).toBe(RUN_ID);
    expect(result.idempotent).toBe(false);
    expect(JSON.stringify(result.snapshot)).not.toBe("{}");
    expect(result.snapshot.runType).toBe("lab");
    expect(result.snapshot.prompt.contentHash).toBe(CANDIDATE_HASH);
    expect(client.rpcCalls[0].args.p_snapshot).toEqual(result.snapshot);
  });

  it("recusa cenário divergente do reservado antes de qualquer I/O", async () => {
    const params = prepareParams({
      scenario: { id: "99999999-9999-4999-8999-999999999999", version: 1, contentHash: "c".repeat(64) },
    });

    await expect(prepareLabRun(params)).rejects.toThrow(LAB_RUN_SCENARIO_MISMATCH);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("propaga LabReservationError sem montar execução", async () => {
    client.rpcResult = { data: null, error: { message: "budget_exceeded" } };

    await expect(prepareLabRun(prepareParams())).rejects.toMatchObject({
      name: "LabReservationError",
      code: "budget_exceeded",
    });
  });
});

describe("runReservedLabRun — caminho feliz (1 chamada paga por run)", () => {
  it("invoca campaign_image exatamente 1 vez e finaliza succeeded com as evidências", async () => {
    const state = newInvokerState();
    const sink = new LabTelemetrySink();
    const events: LabRunEvent[] = [];

    const result = await runReservedLabRun(
      runParams(state, { sink, onEvent: (event: LabRunEvent) => events.push(event) }),
    );

    expect(result).toEqual({ runId: RUN_ID, status: "succeeded" });
    expect(state.calls).toBe(1);
    expect(state.hasFallbackCalls).toBe(0);
    expect(sink.entries).toHaveLength(1);

    const finalUpdate = labRunUpdates().find((values) => values.status === "succeeded");
    expect(finalUpdate).toBeDefined();
    expect(finalUpdate).toMatchObject({
      status: "succeeded",
      attempts: 1,
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
      capability: "campaign_image",
      estimated_cost_usd: FULL_COST.estimatedCostUsd,
    });
    expect(finalUpdate?.cost_detail).toEqual(FULL_COST);
    expect(typeof finalUpdate?.latency_ms).toBe("number");
    expect(finalUpdate?.usage).toEqual({ promptTokens: 10, completionTokens: 2, totalTokens: 12 });
    expect(Array.isArray(finalUpdate?.calls)).toBe(true);
    expect((finalUpdate?.calls as unknown[]).length).toBe(1);
    expect(finalUpdate?.technical_validation).toMatchObject({ decodable: true, mimeType: "image/png" });
    expect(typeof finalUpdate?.finished_at).toBe("string");

    expect(events.map((event) => event.phase ?? event.type)).toEqual([
      "running",
      "prompt",
      "generation",
      "validation",
      "artifact",
      "done",
    ]);
  });

  it("envia o prompt real (candidata) e o request canônico de campaign_image", async () => {
    const state = newInvokerState();

    await runReservedLabRun(runParams(state));

    expect(state.requests).toHaveLength(1);
    const request = state.requests[0];
    expect(request.tools).toBe("image_generation");
    expect(request.size).toBe("1024x1024");
    expect(request.quality).toBe("auto");
    expect(request.productImagesDataUrls).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(request.identityImageUrl).toBeUndefined();
    expect(request.prompt).toContain(CANDIDATE_CONTENT);
  });

  it("persiste o artefato com MIME real e dimensões numa única operação", async () => {
    const state = newInvokerState();

    await runReservedLabRun(runParams(state));

    // MIME vem dos bytes (validação técnica), não de um default adivinhado, e as
    // dimensões entram no próprio insert — sem update separado de `lab_artifacts`.
    expect(mockPersistOutputArtifact).toHaveBeenCalledTimes(1);
    expect(mockPersistOutputArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "image/png", width: 8, height: 8 }),
    );

    const artifactUpdates = client.appliedUpdates.filter((update) => update.table === "lab_artifacts");
    expect(artifactUpdates).toHaveLength(0);

    for (const values of labRunUpdates()) {
      expect(values).not.toHaveProperty("snapshot");
    }
  });
});

describe("runReservedLabRun — falhas encerram o run em estado terminal", () => {
  it("erro do provider finaliza failed com erro sanitizado e 1 envelope", async () => {
    const state = newInvokerState();
    state.failWith = new Error("falha do provider com Bearer sk-abc123456789");

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    expect(state.calls).toBe(1);
    const finalUpdate = labRunUpdates().find((values) => values.status === "failed");
    expect(finalUpdate).toMatchObject({ status: "failed", error_type: "provider_error" });
    expect(finalUpdate?.error_message).not.toContain("sk-");
    expect(finalUpdate?.error_message).toContain("[redacted]");
    expect(typeof finalUpdate?.finished_at).toBe("string");
  });

  it("falha de persistência do artefato finaliza failed com artifact_persistence_failed", async () => {
    const state = newInvokerState();
    mockPersistOutputArtifact.mockRejectedValue(new Error("upload down"));

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    expect(state.calls).toBe(1);
    expect(labRunUpdates().find((values) => values.status === "failed")).toMatchObject({
      status: "failed",
      error_type: ARTIFACT_PERSISTENCE_FAILED,
    });
  });

  it("imageBase64 ausente finaliza failed com missing_image_payload", async () => {
    const state = newInvokerState();
    state.omitImage = true;

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    expect(labRunUpdates().find((values) => values.status === "failed")).toMatchObject({
      status: "failed",
      error_type: "missing_image_payload",
    });
  });

  it("prompt servido divergente do snapshot recusa antes de qualquer chamada paga", async () => {
    const state = newInvokerState();
    const wrongLoader = createPromptLoader("conteudo diferente do snapshot");

    const result = await runReservedLabRun(
      runParams(state, {
        promptLoader: wrongLoader,
        imageService: new ImageGenerationService(createNoopImageProvider(), wrongLoader),
      }),
    );

    expect(result.status).toBe("failed");
    expect(state.calls).toBe(0);
    expect(labRunUpdates().find((values) => values.status === "failed")).toMatchObject({
      error_type: "prompt_snapshot_mismatch",
    });
  });

  it("garante estado terminal no finally quando a transição do catch falha", async () => {
    const state = newInvokerState();
    state.failWith = new Error("provider boom");
    // markRunRunning ok (CAS 1 linha) -> finalize do catch CAS-miss (0 linhas) ->
    // finalize do finally ok.
    client.updateResults = [
      { data: [{ id: RUN_ID }], error: null },
      { data: [], error: null },
      { data: [{ id: RUN_ID }], error: null },
    ];

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    const updates = labRunUpdates();
    expect(updates[updates.length - 1]).toMatchObject({
      status: "failed",
      error_type: LAB_RUN_ABORTED,
    });
  });

  it("erro de reserva não dispara nenhuma invocação nem transição de run", async () => {
    const state = newInvokerState();
    client.rpcResult = { data: null, error: { message: "budget_exceeded" } };

    const rejection = await executeLabRun(executeParams(state)).catch((err: unknown) => err);

    expect(rejection).toBeInstanceOf(LabReservationError);
    expect((rejection as LabReservationError).code).toBe("budget_exceeded");
    expect(state.calls).toBe(0);
    expect(labRunUpdates()).toHaveLength(0);
  });
});

describe("correções de revisão — evidência, sanitização, MIME real e CAS", () => {
  it("o evento de erro (NDJSON) é sanitizado, sem token nem URL", async () => {
    const state = newInvokerState();
    state.failWith = new Error("falha com Bearer sk-abc123456789 em https://api.exemplo.com/v1");
    const events: LabRunEvent[] = [];

    const result = await runReservedLabRun(
      runParams(state, { onEvent: (event) => events.push(event) }),
    );

    expect(result.status).toBe("failed");
    const errorEvent = events.find((event) => event.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.message).not.toContain("sk-");
    expect(errorEvent?.message).toContain("[redacted]");
    expect(errorEvent?.message).not.toContain("https://api.exemplo.com");
  });

  const failureScenarios: Array<{ label: string; setup: (state: FakeInvokerState) => void }> = [
    {
      label: "erro do provider",
      setup: (state) => {
        state.failWith = new Error("provider boom");
      },
    },
    {
      label: "imagem ausente",
      setup: (state) => {
        state.omitImage = true;
      },
    },
    {
      label: "falha de persistência do artefato",
      setup: () => {
        mockPersistOutputArtifact.mockRejectedValue(new Error("upload down"));
      },
    },
  ];

  for (const { label, setup } of failureScenarios) {
    it(`preserva calls/custo/usage/provider/attempts na falha (${label})`, async () => {
      const state = newInvokerState();
      setup(state);

      const result = await runReservedLabRun(runParams(state));

      expect(result.status).toBe("failed");
      const finalUpdate = labRunUpdates().find((values) => values.status === "failed");
      expect(finalUpdate).toBeDefined();
      expect((finalUpdate?.calls as unknown[]).length).toBe(1);
      expect(finalUpdate?.estimated_cost_usd).toBe(FULL_COST.estimatedCostUsd);
      expect(finalUpdate?.cost_detail).toMatchObject({ costSource: "pricing_table" });
      expect(finalUpdate?.usage).toMatchObject({ totalTokens: 12 });
      expect(finalUpdate?.provider).toBe("openai");
      expect(finalUpdate?.model).toBe("gpt-5.5");
      expect(finalUpdate?.protocol).toBe("responses");
      expect(finalUpdate?.attempts).toBe(1);
    });
  }

  it("recusa MIME real fora da allowlist sem persistir o artefato", async () => {
    const state = newInvokerState();
    state.imageBuffer = Buffer.from("isto-nao-e-uma-imagem");
    state.mimeType = "image/gif";

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    expect(state.calls).toBe(1);
    expect(mockPersistOutputArtifact).not.toHaveBeenCalled();
    expect(labRunUpdates().find((values) => values.status === "failed")).toMatchObject({
      error_type: UNSUPPORTED_ARTIFACT_MIME_TYPE,
    });
  });

  it("markRunRunning recusa quando nenhuma linha é afetada (CAS)", async () => {
    client.updateResults = [{ data: [], error: null }];

    await expect(
      markRunRunning({ client: client as unknown as SupabaseClient, runId: RUN_ID }),
    ).rejects.toThrow(LAB_RUN_TRANSITION_FAILED);
  });

  it("finalizeLabRun recusa quando o run já não está ativo (CAS)", async () => {
    client.updateResults = [{ data: [], error: null }];

    await expect(
      finalizeLabRun({
        client: client as unknown as SupabaseClient,
        runId: RUN_ID,
        status: "succeeded",
      }),
    ).rejects.toThrow(LAB_RUN_TRANSITION_FAILED);
  });

  it("reconciliação conta apenas as linhas efetivamente alteradas", async () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    const old = "2026-09-16T10:00:00.000Z";
    client.selectRows = [
      { id: "old-pending", status: "pending", started_at: null, created_at: old },
      { id: "old-running", status: "running", started_at: old, created_at: old },
    ];
    // Entre o select e o update, um dos runs terminou: só 1 linha é alterada.
    client.updateResults = [
      { data: [{ id: "old-running" }], error: null },
      { data: [], error: null },
    ];

    const result = await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now });

    expect(result.reconciled).toBe(1);
  });

  it("não reconcilia run promovido a running recente entre o select e o update", async () => {
    const now = new Date("2026-09-16T12:00:00.000Z");
    const old = "2026-09-16T10:00:00.000Z";
    // O select enxerga o run como `pending` antigo...
    client.selectRows = [{ id: "raced", status: "pending", started_at: null, created_at: old }];
    // ...mas no update ele já é `running` com `started_at` recente: o cutoff
    // reaplicado no próprio update exclui o run (0 linhas alteradas).
    client.updateResults = [
      { data: [], error: null },
      { data: [], error: null },
    ];

    const result = await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now });

    expect(result.reconciled).toBe(0);
  });
});

describe("executeLabRun — composição", () => {
  it("executa o run reservado e devolve succeeded não idempotente", async () => {
    const state = newInvokerState();

    const result = await executeLabRun(executeParams(state));

    expect(result).toEqual({ runId: RUN_ID, status: "succeeded", idempotent: false });
    expect(state.calls).toBe(1);
  });

  it("reserva idempotente devolve pending e NÃO executa", async () => {
    const state = newInvokerState();
    client.rpcResult = { data: { success: true, idempotent: true, run_id: RUN_ID }, error: null };

    const result = await executeLabRun(executeParams(state));

    expect(result).toEqual({ runId: RUN_ID, status: "pending", idempotent: true });
    expect(state.calls).toBe(0);
    expect(client.updateCalls.filter((call) => call.table === "lab_runs")).toHaveLength(0);
  });
});
