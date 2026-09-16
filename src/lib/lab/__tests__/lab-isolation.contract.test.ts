// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

const { mockRecord, mockResolveAiCost } = vi.hoisted(() => {
  // O `ImageGenerationService` importa `@/lib/ai` (gateway default) → sink padrão
  // → tracker → supabase/server. Sem env, lança na importação.
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
import { buildCampaignBriefFromFlat } from "@/lib/campaign/brief";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import { createExperiment } from "@/lib/lab/domain/experiment-service";
import {
  PROMPT_UNDER_TEST,
  buildCandidatePromptSnapshot,
  computePromptContentHash,
} from "@/lib/lab/domain/prompt-snapshot";
import type { CreateLabExperimentInput, LabExperimentParams } from "@/lib/lab/domain/schemas";
import { LabPromptLoader } from "@/lib/lab/gateway/lab-prompt-loader";
import { createNoopImageProvider } from "@/lib/lab/gateway/noop-image-provider";
import { prepareLabRun, runReservedLabRun } from "@/lib/lab/run-service";
import type { LabRunStatus } from "@/lib/lab/run-service";

/**
 * Suíte de contrato nº 1 (48-1-11, task 11.2) — **isolamento absoluto da produção**.
 *
 * Executa o caminho real de criação de experimento e de um run completo contra um
 * **client gravador**: um `Proxy` sobre um client fake em memória que registra cada
 * `from(table)`/`storage.from(bucket)`/`rpc(name)` e **lança**
 * `forbidden_production_access:<alvo>` para qualquer alvo fora da allowlist do
 * laboratório. O teste falha — de forma explícita — se qualquer superfície
 * produtiva for tocada.
 *
 * Nenhuma chamada de rede e nenhuma chamada paga: gateway/`AiInvoker` fake,
 * `LabTelemetrySink` real com `resolveAiCost` mockado e `AiCostTracker` mockado
 * (prova de que nenhuma telemetria produtiva é persistida).
 */

// ─── Identificadores (UUIDs válidos — o path do artefato os exige) ───────────

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "22222222-2222-4222-8222-222222222222";
const SCENARIO_VERSION_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "66666666-6666-4666-8666-666666666666";
const STORE_ID = "77777777-7777-4777-8777-777777777777";

const SCENARIO_HASH = "c".repeat(64);
const PROMPT_NAME = PROMPT_UNDER_TEST;
const CANDIDATE_CONTENT = "# Diretor de arte (candidata)\n\nInstrucoes enxutas e claras.";
const CANDIDATE_HASH = computePromptContentHash(CANDIDATE_CONTENT);

const TARGET = { provider: "openai", model: "gpt-5.5", protocol: "responses" } as const;
const LAB_PARAMS: LabExperimentParams = {
  size: "1024x1024",
  quality: "auto",
  skipInputValidation: true,
};

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

// ─── Client fake em memória ──────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface MemoryState {
  tables: Record<string, Row[]>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  updateCalls: Array<{ table: string; values: Row }>;
  insertCalls: Array<{ table: string; payload: Row | Row[] }>;
  idSeq: number;
  /** Resultados configuráveis por nome de RPC (default: handlers do laboratório). */
  rpcResults: Record<string, { data?: unknown; error?: { message: string } | null }>;
}

type QueryResult = { data: unknown; error: unknown };

class MemoryBuilder implements PromiseLike<QueryResult> {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
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

  gt(column: string, value: unknown): this {
    this.filters.push((row) => String(row[column] ?? "") > String(value));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
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

    let result = this.matched();
    for (const { column, ascending } of [...this.orders].reverse()) {
      result = [...result].sort((left, right) => {
        const a = String(left[column] ?? "");
        const b = String(right[column] ?? "");
        return ascending ? a.localeCompare(b) : b.localeCompare(a);
      });
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount);
    return { data: result, error: null };
  }
}

interface MemoryStorageOps {
  upload: (storagePath: string, body: unknown, options?: unknown) => Promise<unknown>;
  remove: (paths: string[]) => Promise<unknown>;
  createSignedUrl: (storagePath: string, ttl: number) => Promise<unknown>;
}

interface MemoryClient {
  from: (table: string) => MemoryBuilder;
  rpc: (name: string, args: Record<string, unknown>) => Promise<QueryResult>;
  storage: { from: (bucket: string) => MemoryStorageOps };
}

/**
 * Client fake em memória. Os handlers de RPC espelham o efeito mínimo das RPCs do
 * laboratório (inserir o run `pending` na reserva e devolver o id), sem nenhuma
 * chamada de rede.
 */
function createMemoryClient(state: MemoryState): MemoryClient {
  return {
    from(table: string) {
      return new MemoryBuilder(state, table);
    },
    rpc(name: string, args: Record<string, unknown>) {
      state.rpcCalls.push({ fn: name, args });
      const configured = state.rpcResults[name];
      if (configured) return Promise.resolve(configured as QueryResult);

      if (name === "lab_create_experiment") {
        return Promise.resolve({ data: { experiment_id: EXPERIMENT_ID }, error: null });
      }
      if (name === "lab_reserve_run") {
        const runs = state.tables.lab_runs ?? (state.tables.lab_runs = []);
        runs.push({
          id: RUN_ID,
          experiment_id: args.p_experiment_id,
          variant_id: args.p_variant_id,
          status: "pending",
          snapshot: args.p_snapshot,
        });
        return Promise.resolve({
          data: { run_id: RUN_ID, run_sequence: 1, idempotent: false },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected_rpc:${name}` } });
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

// ─── Client gravador (allowlist + detector de acesso produtivo) ──────────────

/** Tabelas `lab_*` permitidas + o catálogo da F47 (somente leitura). */
const ALLOWED_TABLES = new Set([
  "lab_scenarios",
  "lab_scenario_versions",
  "lab_experiments",
  "lab_experiment_variants",
  "lab_experiment_scenarios",
  "lab_runs",
  "lab_artifacts",
  "lab_human_evaluations",
  "ai_model_catalog",
]);

/** Bucket próprio do laboratório (nunca `campaign-images`). */
const ALLOWED_BUCKETS = new Set(["lab-artifacts"]);

/** RPCs do laboratório. */
const ALLOWED_RPCS = new Set(["lab_reserve_run", "lab_create_experiment"]);

/** Leitura permitida, escrita proibida. */
const READ_ONLY_TABLES = new Set(["ai_model_catalog"]);

const ALLOWED_ENTRY_RE =
  /^(?:from:(?:lab_scenarios|lab_scenario_versions|lab_experiments|lab_experiment_variants|lab_experiment_scenarios|lab_runs|lab_artifacts|lab_human_evaluations|ai_model_catalog)|rpc:(?:lab_reserve_run|lab_create_experiment)|storage\.from:lab-artifacts|storage\.(?:upload|remove|createSignedUrl):lab-artifacts)/;

/** Alvos produtivos que jamais podem aparecer no `accessLog`. */
const FORBIDDEN_TARGETS = [
  "campaigns",
  "campaign_art_versions",
  "generation_events",
  "ai_model_selection",
  "admin_audit_log",
  "credit_transactions",
  "campaign-images",
];

interface RecordingClient {
  client: SupabaseClient;
  accessLog: string[];
  state: MemoryState;
}

function forbiddenProductionAccess(target: string): Error {
  return new Error(`forbidden_production_access:${target}`);
}

/** Envolve o catálogo para permitir somente `select` (qualquer escrita lança). */
function wrapReadOnlyTable(builder: object, table: string, accessLog: string[]): object {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "insert" || prop === "update" || prop === "delete") {
        const operation = String(prop);
        return () => {
          accessLog.push(`write:${table}:${operation}`);
          throw forbiddenProductionAccess(`${table}:${operation}`);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * Client gravador: registra cada alvo acessado e **lança** quando ele está fora da
 * allowlist do laboratório. É o detector que faz o teste falhar ao tocar produção.
 */
function createRecordingClient(seed: Record<string, Row[]> = {}): RecordingClient {
  const state: MemoryState = {
    tables: seed,
    rpcCalls: [],
    updateCalls: [],
    insertCalls: [],
    idSeq: 0,
    rpcResults: {},
  };
  const accessLog: string[] = [];
  const memory = createMemoryClient(state);

  const client = new Proxy(memory, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          accessLog.push(`from:${table}`);
          if (!ALLOWED_TABLES.has(table)) throw forbiddenProductionAccess(table);
          const builder = target.from(table);
          return READ_ONLY_TABLES.has(table) ? wrapReadOnlyTable(builder, table, accessLog) : builder;
        };
      }

      if (prop === "rpc") {
        return (name: string, args: Record<string, unknown>) => {
          accessLog.push(`rpc:${name}`);
          if (!ALLOWED_RPCS.has(name)) throw forbiddenProductionAccess(`rpc:${name}`);
          return target.rpc(name, args);
        };
      }

      if (prop === "storage") {
        return {
          from: (bucket: string) => {
            accessLog.push(`storage.from:${bucket}`);
            if (!ALLOWED_BUCKETS.has(bucket)) throw forbiddenProductionAccess(`storage:${bucket}`);
            const ops = target.storage.from(bucket);
            return {
              upload: (storagePath: string, body: unknown, options?: unknown) => {
                accessLog.push(`storage.upload:${bucket}:${storagePath}`);
                return ops.upload(storagePath, body, options);
              },
              remove: (paths: string[]) => {
                accessLog.push(`storage.remove:${bucket}`);
                return ops.remove(paths);
              },
              createSignedUrl: (storagePath: string, ttl: number) => {
                accessLog.push(`storage.createSignedUrl:${bucket}:${storagePath}`);
                return ops.createSignedUrl(storagePath, ttl);
              },
            };
          },
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as SupabaseClient;

  return { client, accessLog, state };
}

// ─── Cenário/domínio de apoio (brief + contexto + gateway fake) ──────────────

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
  failWith?: Error;
}

function createFakeInvoker(state: FakeInvokerState): AiInvoker {
  return {
    async invoke(_capability, _request, telemetry: AiTelemetryContext): Promise<AiInvocationResult> {
      state.calls += 1;
      await telemetry.sink.emit({
        capability: "campaign_image",
        protocol: "responses",
        provider: "openai",
        model: "gpt-5.5",
        durationMs: 4321,
        usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
        usageMeta: { imageGenerationTool: true },
        status: state.failWith ? "failed" : "success",
        ...(state.failWith ? { errorType: state.failWith.message } : {}),
      });

      if (state.failWith) throw state.failWith;

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
    content: "conteudo oficial do diretor",
    contentHash: computePromptContentHash("conteudo oficial do diretor"),
    source: "official" as const,
  };
}

/** Executa o caminho real: snapshot → reserva atômica → run com gateway fake. */
async function runOneIsolatedRun(params: {
  client: SupabaseClient;
  state: FakeInvokerState;
}): Promise<{ sink: LabTelemetrySink; status: LabRunStatus }> {
  const promptLoader = new LabPromptLoader([{ name: PROMPT_NAME, content: CANDIDATE_CONTENT }]);

  const prepared = await prepareLabRun({
    client: params.client,
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
  });

  const sink = new LabTelemetrySink();
  const executed = await runReservedLabRun({
    client: params.client,
    experimentId: EXPERIMENT_ID,
    runId: prepared.runId,
    snapshot: prepared.snapshot,
    actorId: ACTOR_ID,
    scenario: {
      imagesDataUrls: { "images/produto.jpg": "data:image/jpeg;base64,dGVzdA==" },
      logoDataUrl: null,
      brief: createBrief(),
      context: createContext(),
    },
    experiment: { params: LAB_PARAMS },
    gateway: createFakeInvoker(params.state),
    sink,
    promptLoader,
    imageService: new ImageGenerationService(createNoopImageProvider(), promptLoader),
  });

  return { sink, status: executed.status };
}

/** Seed mínimo: linha ativa do catálogo F47 para `campaign_image`. */
function seedCatalog(): Record<string, Row[]> {
  return {
    ai_model_catalog: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        capability: "campaign_image",
        provider: TARGET.provider,
        model: TARGET.model,
        protocol: TARGET.protocol,
        status: "active",
      },
    ],
  };
}

function validExperimentInput(): CreateLabExperimentInput {
  return {
    name: "Prompt enxuto vs atual",
    objective: "Reduzir redundancia sem perder fidelidade",
    hypothesis: "Um prompt mais curto mantem a qualidade da arte",
    changedDimension: "prompt",
    modelTarget: { ...TARGET },
    params: { ...LAB_PARAMS },
    repetitions: 1,
    maxRuns: 6,
    scenarioVersionIds: [SCENARIO_VERSION_ID],
    baseline: { promptName: PROMPT_NAME },
    candidate: { promptName: PROMPT_NAME, promptContent: CANDIDATE_CONTENT },
  } as CreateLabExperimentInput;
}

// ─── (11.2.1) Somente alvos da allowlist ─────────────────────────────────────

describe("isolamento — um run toca somente `lab_*` + `lab-artifacts`", () => {
  it("criação + preparação + execução só acessam alvos da allowlist", async () => {
    const recording = createRecordingClient(seedCatalog());
    const state: FakeInvokerState = { calls: 0 };

    await createExperiment(validExperimentInput(), { actorId: ACTOR_ID, client: recording.client });
    const run = await runOneIsolatedRun({ client: recording.client, state });

    expect(run.status).toBe("succeeded");
    expect(state.calls).toBe(1);

    // As duas RPCs do laboratório foram exercitadas.
    expect(recording.accessLog).toContain("rpc:lab_create_experiment");
    expect(recording.accessLog).toContain("rpc:lab_reserve_run");
    expect(recording.accessLog).toContain("storage.from:lab-artifacts");

    // Nenhum alvo fora da allowlist foi acessado (o gravador lançaria antes).
    expect(recording.accessLog.filter((entry) => !ALLOWED_ENTRY_RE.test(entry))).toEqual([]);

    for (const target of FORBIDDEN_TARGETS) {
      expect(
        recording.accessLog.filter((entry) => entry.includes(target)),
        `nenhum acesso a ${target}`,
      ).toEqual([]);
    }

    // O catálogo é usado apenas como allowlist de leitura.
    expect(recording.accessLog.filter((entry) => entry.startsWith("write:ai_model_catalog"))).toEqual(
      [],
    );
    expect(recording.accessLog).toContain("from:ai_model_catalog");
  });

  it("o detector do próprio teste falha ao tocar qualquer alvo produtivo", () => {
    const recording = createRecordingClient();
    const loose = recording.client as unknown as {
      from: (table: string) => { insert: (payload: unknown) => unknown };
      storage: { from: (bucket: string) => unknown };
      rpc: (name: string, args: unknown) => unknown;
    };

    expect(() => loose.from("generation_events")).toThrow(
      /forbidden_production_access:generation_events/,
    );
    expect(() => loose.from("campaigns")).toThrow(/forbidden_production_access:campaigns/);
    expect(() => loose.from("ai_model_selection")).toThrow(
      /forbidden_production_access:ai_model_selection/,
    );
    expect(() => loose.storage.from("campaign-images")).toThrow(
      /forbidden_production_access:storage:campaign-images/,
    );
    expect(() => loose.rpc("approve_campaign_art_version", {})).toThrow(
      /forbidden_production_access:rpc:approve_campaign_art_version/,
    );
    // Catálogo: leitura permitida, escrita proibida.
    expect(() => loose.from("ai_model_catalog").insert({})).toThrow(
      /forbidden_production_access:ai_model_catalog:insert/,
    );
  });
});

// ─── (11.2.3) Nenhum crédito consumido ───────────────────────────────────────

describe("isolamento — nenhum crédito de lojista é consumido", () => {
  it("o accessLog não contém nenhuma tabela/operação de crédito", async () => {
    const recording = createRecordingClient(seedCatalog());
    const state: FakeInvokerState = { calls: 0 };

    await runOneIsolatedRun({ client: recording.client, state });

    expect(recording.accessLog.filter((entry) => /credit/i.test(entry))).toEqual([]);
    expect(recording.accessLog.filter((entry) => entry.includes("credit_"))).toEqual([]);
  });
});

// ─── (11.2.4) Nenhum `generation_events`; custo calculado em leitura ─────────

describe("isolamento — telemetria do laboratório não persiste custo", () => {
  it("AiCostTracker.record tem zero chamadas e o sink acumula custo em leitura", async () => {
    const recording = createRecordingClient(seedCatalog());
    const state: FakeInvokerState = { calls: 0 };

    const { sink, status } = await runOneIsolatedRun({ client: recording.client, state });

    expect(status).toBe("succeeded");
    expect(state.calls).toBe(1);

    // Nenhuma telemetria produtiva: o tracker nunca é acionado.
    expect(mockRecord).not.toHaveBeenCalled();

    // O custo é calculado em leitura e acumulado no sink (sem persistir evento).
    expect(sink.entries).toHaveLength(1);
    expect(sink.costSummary).not.toBeNull();
    expect(sink.costSummary?.estimatedCostUsd).toBe(FULL_COST.estimatedCostUsd);

    // `generation_events` jamais aparece no acesso — nem o tracker o gravaria.
    expect(recording.accessLog.filter((entry) => entry.includes("generation_events"))).toEqual([]);
    expect(recording.state.insertCalls.filter((call) => call.table === "generation_events")).toEqual(
      [],
    );
  });
});

// ─── (11.2.5) Nenhum secret persistido ──────────────────────────────────────

const SECRET_RE = /sk-|AIza|api[_-]?key|Bearer\s/;

describe("isolamento — nenhum secret em snapshot/calls/erro persistido", () => {
  it("snapshot e updates de `lab_runs` de um run bem-sucedido não carregam chave/token/URL", async () => {
    const recording = createRecordingClient(seedCatalog());
    const state: FakeInvokerState = { calls: 0 };

    await runOneIsolatedRun({ client: recording.client, state });

    const reservation = recording.state.rpcCalls.find((call) => call.fn === "lab_reserve_run");
    const persistedSnapshot = reservation?.args.p_snapshot;
    const runUpdates = recording.state.updateCalls
      .filter((call) => call.table === "lab_runs")
      .map((call) => call.values);

    expect(persistedSnapshot).toBeTruthy();
    expect(runUpdates.length).toBeGreaterThan(0);
    expect(JSON.stringify({ persistedSnapshot, runUpdates })).not.toMatch(SECRET_RE);
  });

  it("erro de provider com chave fake é sanitizado antes de persistir", async () => {
    const recording = createRecordingClient(seedCatalog());
    const state: FakeInvokerState = {
      calls: 0,
      failWith: new Error("falha do provider com chave sk-LEAK123"),
    };

    const { status } = await runOneIsolatedRun({ client: recording.client, state });

    expect(status).toBe("failed");
    expect(state.calls).toBe(1);

    const runUpdates = recording.state.updateCalls.filter((call) => call.table === "lab_runs");
    const failedUpdate = runUpdates.find((call) => call.values.status === "failed");
    expect(failedUpdate).toBeDefined();

    const errorMessage = String(failedUpdate?.values.error_message ?? "");
    expect(errorMessage).not.toContain("sk-");
    expect(errorMessage).toContain("[redacted-key]");

    // Nada do que foi persistido (calls/custo/erro) carrega a chave fake.
    expect(JSON.stringify(runUpdates)).not.toMatch(SECRET_RE);
  });
});

// ─── (11.2.6) `prompts/` permanece intocado ─────────────────────────────────

describe("isolamento — prompts oficiais permanecem intactos", () => {
  it("montar a variante candidata não escreve no arquivo oficial", () => {
    const officialPath = path.resolve(process.cwd(), "prompts/campaign-image-director-offer.md");
    const before = readFileSync(officialPath);

    const snapshot = buildCandidatePromptSnapshot({
      promptName: PROMPT_NAME,
      promptContent: CANDIDATE_CONTENT,
    });

    const after = readFileSync(officialPath);

    expect(snapshot.source).toBe("override");
    expect(after.equals(before)).toBe(true);
  });
});
