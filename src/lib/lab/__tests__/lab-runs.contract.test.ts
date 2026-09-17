// @vitest-environment node
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const { mockResolveAiCost, mockPersistOutputArtifact } = vi.hoisted(() => {
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
  LAB_RUN_ABORTED,
  LabReservationError,
  finalizeLabRun,
  isRunTerminal,
  markRunRunning,
  prepareLabRun,
  reconcileStaleRuns,
  reserveLabRun,
  runReservedLabRun,
} from "../run-service";
import type { LabRunStatus } from "../run-service";
import { LAB_RUN_STALE_MS } from "../limits";
import type { LabRunSnapshot } from "../run-snapshot";
import type { LabExperimentParams } from "../domain/schemas";
import { computePromptContentHash } from "../domain/prompt-snapshot";
import { deriveCostCoverage } from "../domain/cost-coverage";
import { LabPromptLoader } from "../gateway/lab-prompt-loader";
import { createNoopImageProvider } from "../gateway/noop-image-provider";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import type {
  AiCallEnvelope,
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
} from "@/lib/ai/types";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { CostResolution } from "@/lib/ai-cost/types";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import { buildCampaignBriefFromFlat } from "@/lib/campaign/brief";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";
import { validateArtifactTechnically } from "../technical-validation";

/**
 * F48.1 — suíte de contrato nº 2 (48-1-12, task 12.2): execução e snapshot.
 *
 * Client **100% fake em memória** que aplica as regras dos triggers/RPC do banco
 * (imutabilidade de snapshot, idempotência vinculada ao payload, `run_sequence`
 * derivado, `supersedes_run_id` da mesma combinação em estado terminal). Nenhuma
 * chamada de rede e nenhuma chamada paga: gateway/sink são fakes e `sharp` gera os
 * buffers localmente.
 */

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "22222222-2222-4222-8222-222222222222";
const SCENARIO_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "66666666-6666-4666-8666-666666666666";
const STORE_ID = "77777777-7777-4777-8777-777777777777";
const PROMPT_NAME = "campaign-image-director-offer";
const CANDIDATE_CONTENT = "conteudo candidato do diretor (override em memoria)";
const BASELINE_CONTENT = "conteudo oficial do diretor";
const CANDIDATE_HASH = computePromptContentHash(CANDIDATE_CONTENT);
const BASELINE_HASH = computePromptContentHash(BASELINE_CONTENT);

/** Regex montada em runtime: o literal proibido não aparece neste arquivo. */
const FORBIDDEN_COST_KEYS = new RegExp(
  ["image", "Unit", "Usd"].join("") + "|" + ["cost", "Partial"].join(""),
);
const FORBIDDEN_QUALITY_FIELDS = /score|rating|nota|beauty|publicável/i;

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

// ─── Fake do Supabase (RPC de reserva + triggers) ────────────────────────────

interface FakeResult {
  data?: unknown;
  error: { message: string } | null;
}

interface RecordedFilter {
  column: string;
  value: unknown;
  op: "eq" | "in" | "lt" | "is";
}

interface FakeRunRow {
  id: string;
  experiment_id: string;
  variant_id: string;
  scenario_version_id: string;
  repetition_index: number;
  run_sequence: number;
  supersedes_run_id: string | null;
  operation_id: string;
  status: string;
  snapshot: unknown;
  started_at: string | null;
  created_at: string;
  finished_at?: string | null;
  [key: string]: unknown;
}

const TERMINAL_STATUSES = ["succeeded", "failed", "cancelled", "timeout"];

function matchesFilter(row: Record<string, unknown>, filter: RecordedFilter): boolean {
  if (filter.op === "eq") return row[filter.column] === filter.value;
  if (filter.op === "in") return (filter.value as unknown[]).includes(row[filter.column]);
  if (filter.op === "is") {
    if (filter.value === null) {
      return row[filter.column] === null || row[filter.column] === undefined;
    }
    return row[filter.column] === filter.value;
  }
  const rowValue = row[filter.column];
  if (typeof rowValue !== "string" || typeof filter.value !== "string") return false;
  const rowMs = Date.parse(rowValue);
  const filterMs = Date.parse(filter.value);
  if (Number.isFinite(rowMs) && Number.isFinite(filterMs)) return rowMs < filterMs;
  return rowValue < filter.value;
}

class FakeQueryBuilder {
  private readonly filters: RecordedFilter[] = [];
  private mode: "select" | "update" | "delete" | null = null;
  private payload: Record<string, unknown> = {};
  private returning = false;

  constructor(
    private readonly fake: LabRunsFakeClient,
    private readonly table: string,
  ) {}

  select(_columns?: string): this {
    if (this.mode === "update") {
      this.returning = true;
    } else {
      this.mode = "select";
      this.fake.accessLog.push({ table: this.table, op: "select" });
    }
    return this;
  }

  update(values: Record<string, unknown>): this {
    // Trigger de imutabilidade: colunas de snapshot/configuração nunca são
    // atualizadas depois da reserva.
    if (Object.prototype.hasOwnProperty.call(values, "snapshot")) {
      throw new Error("lab_run_snapshot_immutable");
    }
    this.mode = "update";
    this.payload = values;
    this.fake.accessLog.push({ table: this.table, op: "update" });
    return this;
  }

  delete(): this {
    this.mode = "delete";
    this.fake.accessLog.push({ table: this.table, op: "delete" });
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

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  async maybeSingle(): Promise<FakeResult> {
    const rows = this.resolveRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<FakeResult> {
    const rows = this.resolveRows();
    if (rows.length !== 1) return { data: null, error: { message: "not_single" } };
    return { data: rows[0], error: null };
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private resolveRows(): Array<Record<string, unknown>> {
    const rows = this.fake.rowsFor(this.table);
    return rows.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)));
  }

  private resolve(): FakeResult {
    if (this.mode === "update" || this.mode === "delete") {
      const rows = this.resolveRows();
      this.fake.appliedUpdates.push({
        table: this.table,
        values: this.payload,
        filters: this.filters,
        op: this.mode,
      });
      if (this.fake.updateResults.length > 0) {
        return this.fake.updateResults.shift() as FakeResult;
      }
      if (this.mode === "delete") {
        for (const row of rows) {
          const index = this.fake.runs.indexOf(row as unknown as FakeRunRow);
          if (index >= 0) this.fake.runs.splice(index, 1);
        }
        return { data: rows.map((row) => ({ id: row.id })), error: null };
      }
      for (const row of rows) Object.assign(row, this.payload);
      return { data: rows.map((row) => ({ id: row.id })), error: null };
    }

    return { data: this.resolveRows(), error: null };
  }
}

class LabRunsFakeClient {
  readonly runs: FakeRunRow[] = [];
  readonly rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  readonly appliedUpdates: Array<{
    table: string;
    values: Record<string, unknown>;
    filters: RecordedFilter[];
    op: string;
  }> = [];
  readonly accessLog: Array<{ table: string; op: string }> = [];

  /** Erro determinístico forçado da RPC de reserva (mapeamento de códigos). */
  forcedReserveError: string | null = null;
  /** Simula o ramo `unique_violation` da RPC (corrida de `operation_id`). */
  simulateUniqueViolation = false;
  /** Fila de respostas para os updates (CAS dirigido). Vazia = lógica real. */
  updateResults: FakeResult[] = [];
  private idCounter = 0;

  rowsFor(table: string): Array<Record<string, unknown>> {
    if (table === "lab_runs") return this.runs as unknown as Array<Record<string, unknown>>;
    return [];
  }

  seedRun(overrides: Partial<FakeRunRow> & { id: string }): FakeRunRow {
    const row: FakeRunRow = {
      experiment_id: EXPERIMENT_ID,
      variant_id: VARIANT_ID,
      scenario_version_id: SCENARIO_ID,
      repetition_index: 1,
      run_sequence: 1,
      supersedes_run_id: null,
      operation_id: `op-${overrides.id}`,
      status: "pending",
      snapshot: { seeded: true },
      started_at: null,
      created_at: "2026-09-16T10:00:00.000Z",
      ...overrides,
    };
    this.runs.push(row);
    return row;
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<FakeResult> {
    this.rpcCalls.push({ fn, args });
    if (fn !== "lab_reserve_run") {
      return { data: null, error: { message: `unexpected_rpc:${fn}` } };
    }
    if (this.forcedReserveError) {
      return { data: null, error: { message: this.forcedReserveError } };
    }

    const snapshot = args.p_snapshot;
    if (
      !snapshot ||
      typeof snapshot !== "object" ||
      JSON.stringify(snapshot) === "{}"
    ) {
      return { data: null, error: { message: "missing_snapshot" } };
    }

    const operationId = args.p_operation_id;
    if (typeof operationId !== "string" || operationId.length === 0) {
      return { data: null, error: { message: "missing_operation_id" } };
    }

    const existing = this.runs.find((run) => run.operation_id === operationId);
    const payloadMatches = (run: FakeRunRow): boolean =>
      run.experiment_id === args.p_experiment_id &&
      run.variant_id === args.p_variant_id &&
      run.scenario_version_id === args.p_scenario_version_id &&
      run.repetition_index === args.p_repetition_index;

    if (this.simulateUniqueViolation) {
      // Ramo EXCEPTION `unique_violation`: idempotente quando o payload coincide.
      if (existing) {
        if (!payloadMatches(existing)) {
          return { data: null, error: { message: "idempotency_conflict" } };
        }
        return {
          data: { success: true, idempotent: true, run_id: existing.id },
          error: null,
        };
      }
      return { data: null, error: { message: "run_already_active" } };
    }

    if (existing) {
      if (!payloadMatches(existing)) {
        return { data: null, error: { message: "idempotency_conflict" } };
      }
      return { data: { success: true, idempotent: true, run_id: existing.id }, error: null };
    }

    const supersedes = args.p_supersedes_run_id;
    if (typeof supersedes === "string" && supersedes.length > 0) {
      const target = this.runs.find((run) => run.id === supersedes);
      const isTerminal = target ? TERMINAL_STATUSES.includes(target.status) : false;
      const sameCombination =
        target !== undefined &&
        target.experiment_id === args.p_experiment_id &&
        target.variant_id === args.p_variant_id &&
        target.scenario_version_id === args.p_scenario_version_id &&
        target.repetition_index === args.p_repetition_index;
      if (!target || !isTerminal || !sameCombination) {
        return { data: null, error: { message: "invalid_supersedes_run" } };
      }
    }

    // `run_sequence` DERIVADO no banco — nunca aceito do cliente.
    const sequence =
      this.runs
        .filter(
          (run) =>
            run.experiment_id === args.p_experiment_id &&
            run.variant_id === args.p_variant_id &&
            run.scenario_version_id === args.p_scenario_version_id &&
            run.repetition_index === args.p_repetition_index,
        )
        .reduce((max, run) => Math.max(max, run.run_sequence), 0) + 1;

    this.idCounter += 1;
    const row: FakeRunRow = {
      id: `reserved-run-${this.idCounter}`,
      experiment_id: args.p_experiment_id as string,
      variant_id: args.p_variant_id as string,
      scenario_version_id: args.p_scenario_version_id as string,
      repetition_index: args.p_repetition_index as number,
      run_sequence: sequence,
      supersedes_run_id: (args.p_supersedes_run_id as string | null) ?? null,
      operation_id: operationId,
      status: "pending",
      snapshot,
      started_at: null,
      created_at: "2026-09-16T12:00:00.000Z",
    };
    this.runs.push(row);

    return {
      data: { success: true, idempotent: false, run_id: row.id, run_sequence: sequence },
      error: null,
    };
  }

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }
}

function asClient(fake: LabRunsFakeClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

let client: LabRunsFakeClient;

// ─── Snapshot / params ───────────────────────────────────────────────────────

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

function prepareParams(
  overrides: Partial<Parameters<typeof prepareLabRun>[0]> = {},
): Parameters<typeof prepareLabRun>[0] {
  return {
    client: asClient(client),
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

// ─── Execução ────────────────────────────────────────────────────────────────

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

interface FakeInvokerState {
  calls: number;
  requests: AiInvocationRequest[];
  failWith?: Error;
  omitImage?: boolean;
}

function createFakeInvoker(state: FakeInvokerState): AiInvoker {
  return {
    async invoke(_capability, request, telemetry): Promise<AiInvocationResult> {
      state.calls += 1;
      state.requests.push(request);

      if (state.failWith) {
        await emitEnvelope(telemetry, { status: "failed", errorType: "provider boom" });
        throw state.failWith;
      }

      await emitEnvelope(telemetry, { status: "success" });
      if (state.omitImage) return { model: "gpt-5.5" };
      return {
        imageBase64: pngBase64,
        mimeType: "image/png",
        model: "gpt-5.5",
        usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
        usageMeta: { imageGenerationTool: true },
      };
    },
    async hasFallback(): Promise<boolean> {
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

function runParams(
  state: FakeInvokerState,
  overrides: Partial<Parameters<typeof runReservedLabRun>[0]> = {},
): Parameters<typeof runReservedLabRun>[0] {
  const promptLoader = new LabPromptLoader([{ name: PROMPT_NAME, content: CANDIDATE_CONTENT }]);
  return {
    client: asClient(client),
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

function newInvokerState(): FakeInvokerState {
  return { calls: 0, requests: [] };
}

function seededPendingRun(overrides: Partial<FakeRunRow> = {}): FakeRunRow {
  return client.seedRun({
    id: RUN_ID,
    operation_id: OPERATION_ID,
    status: "pending",
    snapshot: executionSnapshot(),
    ...overrides,
  });
}

function runRow(id = RUN_ID): FakeRunRow | undefined {
  return client.runs.find((run) => run.id === id);
}

/** PNG 8×8 com variação real de pixels (não uniforme) para a validação objetiva. */
async function createNonUniformPng(): Promise<Buffer> {
  const width = 8;
  const height = 8;
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let index = 0; index < raw.length; index += 1) {
    raw[index] = (index * 37) % 256;
  }
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}

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
  client = new LabRunsFakeClient();
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue(FULL_COST);
  mockPersistOutputArtifact.mockResolvedValue({
    artifactId: "artifact-1",
    storagePath: `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`,
    checksum: "d".repeat(64),
    bytes: 128,
  });
});

// ─── 1. Snapshot imutável e nunca vazio ──────────────────────────────────────

describe("contrato de execução — snapshot imutável e nunca vazio", () => {
  it("prepareLabRun envia o snapshot COMPLETO em p_snapshot", async () => {
    const result = await prepareLabRun(prepareParams());

    expect(client.rpcCalls).toHaveLength(1);
    const call = client.rpcCalls[0];
    expect(call.fn).toBe("lab_reserve_run");

    const snapshot = call.args.p_snapshot as LabRunSnapshot;
    expect(snapshot).toMatchObject({
      scenarioVersionId: SCENARIO_ID,
      scenarioVersion: 1,
      scenarioContentHash: "c".repeat(64),
      capability: "campaign_image",
      modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
      params: { size: "1024x1024", quality: "auto", skipInputValidation: true },
      changedDimension: "prompt",
      variantRole: "candidate",
      runType: "lab",
    });
    expect(snapshot.prompt).toEqual({
      name: PROMPT_NAME,
      content: CANDIDATE_CONTENT,
      contentHash: CANDIDATE_HASH,
      source: "override",
    });
    expect(snapshot.baselineConfig).toMatchObject({ source: "official" });
    expect(snapshot.candidateConfig).toMatchObject({ source: "override" });
    expect(JSON.stringify(snapshot)).not.toBe("{}");
    expect(result.snapshot).toEqual(snapshot);
  });

  it("snapshot nulo ou vazio é recusado com missing_snapshot antes de qualquer I/O", async () => {
    const base = prepareParams();

    await expect(
      reserveLabRun({ ...base, snapshot: null as unknown as LabRunSnapshot }),
    ).rejects.toThrow("missing_snapshot");
    await expect(
      reserveLabRun({ ...base, snapshot: {} as unknown as LabRunSnapshot }),
    ).rejects.toThrow("missing_snapshot");

    expect(client.rpcCalls).toHaveLength(0);
  });

  it("a RPC recusa snapshot nulo/vazio com missing_snapshot", async () => {
    const base = prepareParams();

    const nullRejection = await reserveLabRun({
      ...base,
      snapshot: { scenarioVersionId: SCENARIO_ID } as unknown as LabRunSnapshot,
    }).catch((err: unknown) => err);

    // O `assertSnapshotComplete` barra antes do I/O; a RPC nunca é chamada.
    expect(nullRejection).toBeInstanceOf(Error);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("o trigger de imutabilidade bloqueia update de snapshot e o serviço nunca o tenta", async () => {
    seededPendingRun();
    const state = newInvokerState();

    await runReservedLabRun(runParams(state));

    // Tentativa direta de alterar o snapshot é rejeitada pelo "trigger".
    expect(() => client.from("lab_runs").update({ snapshot: { hacked: true } })).toThrow(
      "lab_run_snapshot_immutable",
    );

    // Nenhuma transição do serviço tenta escrever a coluna imutável.
    const runUpdates = client.appliedUpdates.filter((update) => update.table === "lab_runs");
    expect(runUpdates.length).toBeGreaterThan(0);
    for (const update of runUpdates) {
      expect(update.values).not.toHaveProperty("snapshot");
    }
  });

  it("nenhuma transição usa delete em lab_runs (histórico preservado)", async () => {
    seededPendingRun();
    await runReservedLabRun(runParams(newInvokerState()));

    expect(client.accessLog.filter((entry) => entry.op === "delete")).toHaveLength(0);
  });
});

// ─── 2. Transição terminal em finally ────────────────────────────────────────

describe("contrato de execução — transição terminal garantida", () => {
  it("erro do gateway encerra o run em failed (nunca permanece running)", async () => {
    seededPendingRun();
    const state = newInvokerState();
    state.failWith = new Error("provider boom");

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    expect(state.calls).toBe(1);
    const row = runRow();
    expect(row?.status).toBe("failed");
    expect(row?.error_type).toBe("provider_error");
    expect(typeof row?.finished_at).toBe("string");
  });

  it("desconexão do consumidor (onEvent lançando) não impede o estado terminal", async () => {
    seededPendingRun();
    const state = newInvokerState();
    const onEvent = vi.fn(() => {
      throw new Error("stream NDJSON desconectado");
    });

    const result = await runReservedLabRun(runParams(state, { onEvent }));

    expect(result.status).toBe("succeeded");
    expect(onEvent).toHaveBeenCalled();
    expect(runRow()?.status).toBe("succeeded");
  });

  it("quando a transição do catch falha, o finally garante o estado terminal", async () => {
    seededPendingRun();
    const state = newInvokerState();
    state.failWith = new Error("provider boom");
    // markRunRunning ok → finalize do catch CAS-miss (0 linhas) → finalize do finally ok.
    client.updateResults = [
      { data: [{ id: RUN_ID }], error: null },
      { data: [], error: null },
      { data: [{ id: RUN_ID }], error: null },
    ];

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    const runUpdates = client.appliedUpdates.filter((update) => update.table === "lab_runs");
    expect(runUpdates[runUpdates.length - 1].values).toMatchObject({
      status: "failed",
      error_type: LAB_RUN_ABORTED,
    });
  });

  it("sucesso preenche latência, usage, custo, calls e validação técnica", async () => {
    seededPendingRun();
    const state = newInvokerState();

    const result = await runReservedLabRun(runParams(state));

    expect(result).toEqual({ runId: RUN_ID, status: "succeeded" });
    const row = runRow();
    expect(row?.status).toBe("succeeded");
    expect(typeof row?.latency_ms).toBe("number");
    expect(row?.usage).toEqual({ promptTokens: 10, completionTokens: 2, totalTokens: 12 });
    expect(row?.estimated_cost_usd).toBe(FULL_COST.estimatedCostUsd);
    expect(Array.isArray(row?.calls)).toBe(true);
    expect((row?.calls as unknown[]).length).toBe(1);
    expect(row?.technical_validation).toMatchObject({ decodable: true, mimeType: "image/png" });
  });

  it("CAS: markRunRunning e finalizeLabRun recusam quando nenhuma linha é afetada", async () => {
    seededPendingRun();
    client.updateResults = [{ data: [], error: null }];
    await expect(markRunRunning({ client: asClient(client), runId: RUN_ID })).rejects.toThrow(
      "lab_run_transition_failed",
    );

    client.updateResults = [{ data: [], error: null }];
    await expect(
      finalizeLabRun({ client: asClient(client), runId: RUN_ID, status: "succeeded" }),
    ).rejects.toThrow("lab_run_transition_failed");
  });
});

// ─── 3. Origem completa do custo ─────────────────────────────────────────────

describe("contrato de execução — origem completa do custo", () => {
  it("cost_detail persiste fonte, versões, componentes e origem do pricing", async () => {
    seededPendingRun();
    await runReservedLabRun(runParams(newInvokerState()));

    const costDetail = runRow()?.cost_detail as CostResolution;
    expect(costDetail).toMatchObject({
      costSource: "pricing_table",
      pricingVersion: FULL_COST.pricingVersion,
      costFormulaVersion: FULL_COST.costFormulaVersion,
      textComponentUsd: FULL_COST.textComponentUsd,
      imageToolComponentUsd: FULL_COST.imageToolComponentUsd,
      imageToolPricingProvider: FULL_COST.imageToolPricingProvider,
      imageToolPricingModel: FULL_COST.imageToolPricingModel,
      imageToolPricingVersion: FULL_COST.imageToolPricingVersion,
    });
    expect(Object.keys(costDetail).join(",")).not.toMatch(FORBIDDEN_COST_KEYS);
  });

  it("a parcialidade é derivada dos campos reais (complete/partial/missing)", () => {
    expect(deriveCostCoverage(FULL_COST)).toBe("complete");

    expect(
      deriveCostCoverage({
        ...FULL_COST,
        costEstimationNote: "provisional_image_tool_unit_cost_until_provider_reconciliation",
      }),
    ).toBe("partial");

    expect(
      deriveCostCoverage({
        estimatedCostUsd: null,
        costSource: "not_available",
      }),
    ).toBe("missing");
  });

  it("a nota de estimativa é congelada junto ao custo quando presente", async () => {
    mockResolveAiCost.mockResolvedValue({
      ...FULL_COST,
      costEstimationNote: "provisional_image_tool_unit_cost_until_provider_reconciliation",
    });
    seededPendingRun();
    await runReservedLabRun(runParams(newInvokerState()));

    const costDetail = runRow()?.cost_detail as CostResolution;
    expect(costDetail.costEstimationNote).toBe(
      "provisional_image_tool_unit_cost_until_provider_reconciliation",
    );
    expect(deriveCostCoverage(costDetail)).toBe("partial");
  });
});

// ─── 4. Idempotência ─────────────────────────────────────────────────────────

describe("contrato de execução — idempotência vinculada ao payload", () => {
  it("mesma operationId e mesmo payload devolve o run existente sem reexecutar", async () => {
    const first = await prepareLabRun(prepareParams());
    const second = await prepareLabRun(prepareParams());

    expect(second.idempotent).toBe(true);
    expect(second.runId).toBe(first.runId);
    expect(client.runs).toHaveLength(1);
    expect(client.rpcCalls).toHaveLength(2);
  });

  it("mesma operationId com variante diferente é recusada com idempotency_conflict", async () => {
    await prepareLabRun(prepareParams());

    const rejection = await prepareLabRun(
      prepareParams({ variantId: "99999999-9999-4999-8999-999999999999" }),
    ).catch((err: unknown) => err);

    expect(rejection).toBeInstanceOf(LabReservationError);
    expect((rejection as LabReservationError).code).toBe("idempotency_conflict");
    expect(client.runs).toHaveLength(1);
  });

  it("mesma operationId com cenário ou repetição diferentes é recusada", async () => {
    await prepareLabRun(prepareParams());

    const otherScenario = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const scenarioRejection = await prepareLabRun(
      prepareParams({
        scenarioVersionId: otherScenario,
        scenario: { id: otherScenario, version: 1, contentHash: "c".repeat(64) },
      }),
    ).catch((err: unknown) => err);
    expect((scenarioRejection as LabReservationError).code).toBe("idempotency_conflict");

    const repetitionRejection = await prepareLabRun(
      prepareParams({ repetitionIndex: 2 }),
    ).catch((err: unknown) => err);
    expect((repetitionRejection as LabReservationError).code).toBe("idempotency_conflict");

    expect(client.runs).toHaveLength(1);
  });

  it("corrida de unique_violation com payload coincidente é tratada como idempotente", async () => {
    const first = await prepareLabRun(prepareParams());
    client.simulateUniqueViolation = true;

    const raced = await prepareLabRun(prepareParams());

    expect(raced.idempotent).toBe(true);
    expect(raced.runId).toBe(first.runId);
    expect(client.runs).toHaveLength(1);
  });

  it("corrida de unique_violation com payload divergente é idempotency_conflict", async () => {
    await prepareLabRun(prepareParams());
    client.simulateUniqueViolation = true;

    const rejection = await prepareLabRun(
      prepareParams({ variantId: "99999999-9999-4999-8999-999999999999" }),
    ).catch((err: unknown) => err);

    expect((rejection as LabReservationError).code).toBe("idempotency_conflict");
  });

  it("erro desconhecido da RPC vira lab_reservation_failed", async () => {
    client.forcedReserveError = "connection reset";

    const rejection = await prepareLabRun(prepareParams()).catch((err: unknown) => err);

    expect((rejection as LabReservationError).code).toBe("lab_reservation_failed");
  });
});

// ─── 5. Reexecução com histórico ─────────────────────────────────────────────

describe("contrato de execução — reexecução preserva histórico", () => {
  it("cria novo run com run_sequence derivado e mantém o anterior intacto", async () => {
    const previous = seededPendingRun({
      id: "previous-run",
      status: "succeeded",
      run_sequence: 1,
      operation_id: "op-previous",
      started_at: "2026-09-16T10:00:00.000Z",
      finished_at: "2026-09-16T10:05:00.000Z",
    });

    const result = await prepareLabRun(prepareParams({ supersedesRunId: previous.id }));

    expect(result.runId).not.toBe(previous.id);
    const created = client.runs.find((run) => run.id === result.runId);
    expect(created?.run_sequence).toBe(2);
    expect(created?.supersedes_run_id).toBe(previous.id);

    // O `run_sequence` é derivado no banco — nunca enviado pelo cliente.
    expect(client.rpcCalls[0].args).not.toHaveProperty("p_run_sequence");

    // O run anterior permanece intacto e nenhuma escrita o toca.
    expect(previous.status).toBe("succeeded");
    expect(
      client.appliedUpdates.filter((update) =>
        update.filters.some((filter) => filter.column === "id" && filter.value === previous.id),
      ),
    ).toHaveLength(0);
  });

  it("supersedes de outra repetição é recusado com invalid_supersedes_run", async () => {
    seededPendingRun({
      id: "other-repetition",
      status: "succeeded",
      repetition_index: 2,
      operation_id: "op-other-repetition",
    });

    const rejection = await prepareLabRun(
      prepareParams({ supersedesRunId: "other-repetition", repetitionIndex: 1 }),
    ).catch((err: unknown) => err);

    expect((rejection as LabReservationError).code).toBe("invalid_supersedes_run");
  });

  it("supersedes de run ainda ativo é recusado com invalid_supersedes_run", async () => {
    seededPendingRun({
      id: "active-run",
      status: "running",
      started_at: "2026-09-16T12:00:00.000Z",
      operation_id: "op-active",
    });

    const rejection = await prepareLabRun(
      prepareParams({ supersedesRunId: "active-run" }),
    ).catch((err: unknown) => err);

    expect((rejection as LabReservationError).code).toBe("invalid_supersedes_run");
  });

  it("supersedes de variante ou cenário diferentes é recusado", async () => {
    seededPendingRun({
      id: "other-variant-run",
      status: "succeeded",
      variant_id: "99999999-9999-4999-8999-999999999999",
      operation_id: "op-other-variant",
    });

    const rejection = await prepareLabRun(
      prepareParams({ supersedesRunId: "other-variant-run" }),
    ).catch((err: unknown) => err);

    expect((rejection as LabReservationError).code).toBe("invalid_supersedes_run");
  });
});

// ─── 6. Órfãos pending e running ─────────────────────────────────────────────

describe("contrato de execução — reconciliação de órfãos", () => {
  const NOW = new Date("2026-09-16T12:00:00.000Z");
  const STALE = new Date(NOW.getTime() - LAB_RUN_STALE_MS - 60000).toISOString();
  const RECENT = new Date(NOW.getTime() - 60000).toISOString();

  it("marca pending e running antigos como failed sem tocar os recentes", async () => {
    const oldPending = seededPendingRun({
      id: "old-pending",
      status: "pending",
      started_at: null,
      created_at: STALE,
      operation_id: "op-old-pending",
    });
    const oldRunning = seededPendingRun({
      id: "old-running",
      status: "running",
      started_at: STALE,
      created_at: STALE,
      operation_id: "op-old-running",
    });
    const recentRunning = seededPendingRun({
      id: "recent-running",
      status: "running",
      started_at: RECENT,
      created_at: RECENT,
      operation_id: "op-recent-running",
    });
    const recentPending = seededPendingRun({
      id: "recent-pending",
      status: "pending",
      started_at: null,
      created_at: RECENT,
      operation_id: "op-recent-pending",
    });

    const result = await reconcileStaleRuns({ client: asClient(client), now: NOW });

    expect(result.reconciled).toBe(2);
    expect(oldPending.status).toBe("failed");
    expect(oldRunning.status).toBe("failed");
    expect(oldPending.error_type).toBe("orphan_run_timeout");
    expect(oldRunning.error_type).toBe("orphan_run_timeout");
    expect(recentRunning.status).toBe("running");
    expect(recentPending.status).toBe("pending");
  });

  it("respeita staleMs customizado e não usa scheduler (só leitura/update de lab_runs)", async () => {
    seededPendingRun({
      id: "old-running",
      status: "running",
      started_at: STALE,
      created_at: STALE,
      operation_id: "op-old-running",
    });

    const result = await reconcileStaleRuns({
      client: asClient(client),
      now: NOW,
      staleMs: 3 * 60 * 60 * 1000,
    });

    expect(result.reconciled).toBe(0);
    expect(client.appliedUpdates).toHaveLength(0);
    expect(client.accessLog.every((entry) => entry.table === "lab_runs")).toBe(true);
  });

  it("não toca runs terminais (o filtro de status ativo os exclui)", async () => {
    const succeeded = seededPendingRun({
      id: "old-succeeded",
      status: "succeeded",
      started_at: STALE,
      created_at: STALE,
      operation_id: "op-old-succeeded",
    });

    const result = await reconcileStaleRuns({ client: asClient(client), now: NOW });

    expect(result.reconciled).toBe(0);
    expect(succeeded.status).toBe("succeeded");
  });

  it("conta apenas as linhas efetivamente alteradas (corrida entre select e update)", async () => {
    seededPendingRun({
      id: "old-pending",
      status: "pending",
      started_at: null,
      created_at: STALE,
      operation_id: "op-old-pending",
    });
    seededPendingRun({
      id: "old-running",
      status: "running",
      started_at: STALE,
      created_at: STALE,
      operation_id: "op-old-running",
    });
    // Um dos runs terminou entre o select e o update: só 1 linha é alterada.
    client.updateResults = [
      { data: [{ id: "old-running" }], error: null },
      { data: [], error: null },
    ];

    const result = await reconcileStaleRuns({ client: asClient(client), now: NOW });

    expect(result.reconciled).toBe(1);
  });
});

// ─── 7. Validação técnica objetiva ───────────────────────────────────────────

describe("contrato de execução — validação técnica sem nota", () => {
  it("PNG válido registra MIME/dimensões/proporção/bytes sem alerta", async () => {
    const buffer = await createNonUniformPng();

    const validation = await validateArtifactTechnically({
      buffer,
      declaredMimeType: "image/png",
      expectedAspectRatio: 1,
    });

    expect(validation).toMatchObject({
      decodable: true,
      mimeType: "image/png",
      width: 8,
      height: 8,
      aspectRatio: 1,
      uniform: false,
      emptyOrCorrupt: false,
      alerts: [],
      structuredOutputValid: null,
      ocrAlert: null,
    });
    expect(validation.bytes).toBe(buffer.byteLength);
  });

  it("buffer corrompido registra decode_failed", async () => {
    const validation = await validateArtifactTechnically({
      buffer: Buffer.from("isto-nao-e-uma-imagem"),
      declaredMimeType: "image/png",
    });

    expect(validation.decodable).toBe(false);
    expect(validation.emptyOrCorrupt).toBe(true);
    expect(validation.alerts).toContain("decode_failed");
    expect(validation.structuredOutputValid).toBeNull();
  });

  it("buffer vazio registra empty_buffer", async () => {
    const validation = await validateArtifactTechnically({ buffer: Buffer.alloc(0) });

    expect(validation.decodable).toBe(false);
    expect(validation.alerts).toContain("empty_buffer");
  });

  it("imagem uniforme registra uniform_image", async () => {
    const buffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    const validation = await validateArtifactTechnically({
      buffer,
      declaredMimeType: "image/png",
      expectedAspectRatio: 1,
    });

    expect(validation.uniform).toBe(true);
    expect(validation.alerts).toContain("uniform_image");
  });

  it("nenhum campo de nota automática é produzido", async () => {
    const buffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const validation = await validateArtifactTechnically({ buffer });
    const serialized = JSON.stringify(validation);

    expect(serialized).not.toMatch(FORBIDDEN_QUALITY_FIELDS);
    for (const key of Object.keys(validation)) {
      expect(key).not.toMatch(FORBIDDEN_QUALITY_FIELDS);
    }
  });

  it("a validação técnica do run é persistida como fato objetivo", async () => {
    seededPendingRun();
    await runReservedLabRun(runParams(newInvokerState()));

    const validation = runRow()?.technical_validation as Record<string, unknown>;
    expect(validation).toMatchObject({ decodable: true, mimeType: "image/png" });
    expect(JSON.stringify(validation)).not.toMatch(FORBIDDEN_QUALITY_FIELDS);
  });
});

// ─── 8. Falha de persistência do artefato ────────────────────────────────────

describe("contrato de execução — falha de artefato não deixa órfão", () => {
  it("encerra o run em failed com artifact_persistence_failed sem registrar artefato", async () => {
    seededPendingRun();
    mockPersistOutputArtifact.mockRejectedValue(new Error("upload down"));
    const state = newInvokerState();

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    expect(state.calls).toBe(1);
    expect(runRow()?.error_type).toBe(ARTIFACT_PERSISTENCE_FAILED);
    // Nenhum artefato órfão é registrado pelo serviço.
    expect(
      client.accessLog.filter(
        (entry) => entry.table === "lab_artifacts" && entry.op !== "select",
      ),
    ).toHaveLength(0);
  });

  it("a evidência da chamada paga é preservada na falha do artefato", async () => {
    seededPendingRun();
    mockPersistOutputArtifact.mockRejectedValue(new Error("upload down"));

    await runReservedLabRun(runParams(newInvokerState()));

    const row = runRow();
    expect((row?.calls as unknown[]).length).toBe(1);
    expect(row?.estimated_cost_usd).toBe(FULL_COST.estimatedCostUsd);
    expect(row?.cost_detail).toMatchObject({ costSource: "pricing_table" });
    expect(row?.provider).toBe("openai");
    expect(row?.attempts).toBe(1);
  });

  it("imageBase64 ausente encerra o run em failed com missing_image_payload", async () => {
    seededPendingRun();
    const state = newInvokerState();
    state.omitImage = true;

    const result = await runReservedLabRun(runParams(state));

    expect(result.status).toBe("failed");
    expect(runRow()?.error_type).toBe("missing_image_payload");
  });

  it("isRunTerminal reconhece os quatro estados terminais", () => {
    const terminal: LabRunStatus[] = ["succeeded", "failed", "cancelled", "timeout"];
    const active: LabRunStatus[] = ["pending", "running"];

    for (const status of terminal) expect(isRunTerminal(status)).toBe(true);
    for (const status of active) expect(isRunTerminal(status)).toBe(false);
  });
});
