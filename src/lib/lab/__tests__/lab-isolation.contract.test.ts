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
import { remainingUsd } from "@/lib/lab/domain/program-service";
import { prepareLabRun, runReservedLabRun } from "@/lib/lab/run-service";
import type { LabRunStatus } from "@/lib/lab/run-service";
import {
  ALLOWED_BUCKETS,
  ALLOWED_ENTRY_RE,
  ALLOWED_TABLES,
  FORBIDDEN_TARGETS,
  createRecordingClient,
  type Row,
} from "./recording-supabase-client";
import {
  BenchBrandingSnapshotSchema,
  BenchIdentityReferenceSchema,
} from "@/lib/lab/bench/domain/schemas";

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
const PROGRAM_ID = "88888888-8888-4888-8888-888888888888";

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
    programId: PROGRAM_ID,
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
    campaignIntent: "offer",
    programId: PROGRAM_ID,
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

// ─── (F48.2.1) Segurança financeira do programa ─────────────────────────────

describe("isolamento — segurança financeira do programa", () => {
  function prepareParams(client: SupabaseClient) {
    return {
      client,
      experimentId: EXPERIMENT_ID,
      variantId: VARIANT_ID,
      scenarioVersionId: SCENARIO_VERSION_ID,
      repetitionIndex: 1,
      supersedesRunId: null,
      operationId: OPERATION_ID,
      actorId: ACTOR_ID,
      programId: PROGRAM_ID,
      scenario: { id: SCENARIO_VERSION_ID, version: 1, contentHash: SCENARIO_HASH },
      experiment: { modelTarget: TARGET, params: LAB_PARAMS },
      variant: { role: "candidate" as const, promptSnapshot: candidateSnapshot() },
      variants: { baseline: baselineSnapshot(), candidate: candidateSnapshot() },
    };
  }

  it("sem programa autorizado a reserva recusa antes de qualquer chamada paga", async () => {
    const recording = createRecordingClient(seedCatalog());
    const state: FakeInvokerState = { calls: 0 };
    recording.state.rpcResults.lab_reserve_run = {
      data: null,
      error: { message: "program_not_authorized" },
    };

    await expect(
      runOneIsolatedRun({ client: recording.client, state }),
    ).rejects.toMatchObject({ code: "program_not_authorized" });

    // Nenhuma chamada paga e nenhuma escrita produtiva.
    expect(state.calls).toBe(0);
    expect(recording.accessLog.filter((entry) => entry.includes("generation_events"))).toEqual([]);
    expect(recording.accessLog.filter((entry) => entry.includes("ai_model_selection"))).toEqual([]);
    expect(recording.accessLog.filter((entry) => entry.startsWith("write:ai_model_catalog"))).toEqual(
      [],
    );
  });

  function seedProgramRun(status: string): ReturnType<typeof createRecordingClient> {
    const recording = createRecordingClient(seedCatalog());
    recording.state.tables.lab_experiments = [
      { id: EXPERIMENT_ID, status: "ready", program_id: PROGRAM_ID },
    ];
    recording.state.tables.lab_prompt_programs = [
      {
        id: PROGRAM_ID,
        status,
        budget_usd: 100,
        budget_authorized_at: "2026-01-01T00:00:00.000Z",
        budget_reserved_usd: 0,
        budget_consumed_usd: 0,
      },
    ];
    return recording;
  }

  it("programa `closed` recusa a reserva antes de qualquer chamada paga", async () => {
    const recording = seedProgramRun("closed");
    const state: FakeInvokerState = { calls: 0 };

    await expect(runOneIsolatedRun({ client: recording.client, state })).rejects.toMatchObject({
      code: "program_not_authorized",
    });

    expect(state.calls).toBe(0);
    expect(recording.state.tables.lab_runs ?? []).toHaveLength(0);
    // Terminalidade: a recusa nunca reautoriza o programa encerrado.
    expect(recording.state.tables.lab_prompt_programs[0].status).toBe("closed");
  });

  it("programa `draft` recusa a reserva antes de qualquer chamada paga", async () => {
    const recording = seedProgramRun("draft");
    const state: FakeInvokerState = { calls: 0 };

    await expect(runOneIsolatedRun({ client: recording.client, state })).rejects.toMatchObject({
      code: "program_not_authorized",
    });

    expect(state.calls).toBe(0);
    expect(recording.state.tables.lab_runs ?? []).toHaveLength(0);
  });

  it("programa `authorized` reserva e executa normalmente", async () => {
    const recording = seedProgramRun("authorized");
    const state: FakeInvokerState = { calls: 0 };

    const run = await runOneIsolatedRun({ client: recording.client, state });

    expect(run.status).toBe("succeeded");
    expect(state.calls).toBe(1);
    expect(recording.accessLog.filter((entry) => !ALLOWED_ENTRY_RE.test(entry))).toEqual([]);
  });

  it("reserva idempotente devolve o run existente sem nova chamada paga", async () => {
    const recording = createRecordingClient(seedCatalog());
    recording.state.rpcResults.lab_reserve_run = {
      data: { run_id: RUN_ID, run_sequence: 1, idempotent: true },
      error: null,
    };

    const prepared = await prepareLabRun(prepareParams(recording.client));

    expect(prepared.idempotent).toBe(true);
    expect(prepared.runId).toBe(RUN_ID);
    // A reserva idempotente não abre nenhuma superfície fora da allowlist.
    expect(recording.accessLog.filter((entry) => !ALLOWED_ENTRY_RE.test(entry))).toEqual([]);
  });

  it("o saldo do programa é budget_usd - consumido - reservado", () => {
    expect(
      remainingUsd({ budget_usd: 10, budget_consumed_usd: 3, budget_reserved_usd: 2 }),
    ).toBe(5);
    expect(
      remainingUsd({ budget_usd: null, budget_consumed_usd: 0, budget_reserved_usd: 0 }),
    ).toBeNull();
  });
});

// ─── (11.2.6) `prompts/` permanece intocado ─────────────────────────────────

describe("isolamento — prompts oficiais permanecem intactos", () => {
  it("montar a variante candidata não escreve no arquivo oficial", () => {
    const officialPath = path.resolve(process.cwd(), "prompts/campaign-image-director-offer.md");
    const before = readFileSync(officialPath);

    const snapshot = buildCandidatePromptSnapshot({
      campaignIntent: "offer",
      promptName: PROMPT_NAME,
      promptContent: CANDIDATE_CONTENT,
    });

    const after = readFileSync(officialPath);

    expect(snapshot.source).toBe("override");
    expect(after.equals(before)).toBe(true);
  });
});

// ─── (F48.2.2) Fronteira da bancada de geração ───────────────────────────────

describe("isolamento — fronteira da bancada de geração (F48.2.2)", () => {
  interface LooseTableBuilder {
    select: (...args: unknown[]) => unknown;
    insert: (payload: unknown) => unknown;
    update: (payload: unknown) => unknown;
    delete: () => unknown;
  }

  interface LooseStorageBucket {
    createSignedUrl: (storagePath: string, ttl: number) => unknown;
    upload: (storagePath: string, body: unknown, options?: unknown) => unknown;
    remove: (paths: string[]) => unknown;
    list: (path?: string, options?: unknown) => unknown;
  }

  interface LooseClient {
    from: (table: string) => LooseTableBuilder;
    storage: { from: (bucket: string) => LooseStorageBucket };
  }

  function looseClient(): LooseClient {
    return createRecordingClient().client as unknown as LooseClient;
  }

  it("permite leitura das tabelas de loja/branding local e proíbe escrita (read-only)", () => {
    const client = looseClient();
    for (const table of [
      "stores",
      "store_brand_profiles",
      "store_brand_assets",
      "store_visual_signatures",
    ]) {
      expect(() => client.from(table).select("*"), `leitura ${table}`).not.toThrow();
      expect(() => client.from(table).insert({}), `insert ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}:insert`),
      );
      expect(() => client.from(table).update({}), `update ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}:update`),
      );
      expect(() => client.from(table).delete(), `delete ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}:delete`),
      );
    }
  });

  it("permite somente createSignedUrl nos buckets de branding (upload/remove/list lançam)", () => {
    const client = looseClient();
    for (const bucket of ["store-logos", "store-brand-assets", "visual-signatures"]) {
      expect(
        () => client.storage.from(bucket).createSignedUrl(`${bucket}/asset.png`, 60),
        `createSignedUrl ${bucket}`,
      ).not.toThrow();
      expect(() => client.storage.from(bucket).upload("asset.png", {})).toThrow(
        new RegExp(`forbidden_production_access:storage:${bucket}:upload`),
      );
      expect(() => client.storage.from(bucket).remove(["asset.png"])).toThrow(
        new RegExp(`forbidden_production_access:storage:${bucket}:remove`),
      );
      expect(() => client.storage.from(bucket).list()).toThrow(
        new RegExp(`forbidden_production_access:storage:${bucket}:list`),
      );
    }
  });

  it("bucket produtivo (campaign-images) e tabelas produtivas fazem o teste falhar", () => {
    const client = looseClient();
    expect(() => client.storage.from("campaign-images").createSignedUrl("x", 60)).toThrow(
      /forbidden_production_access:storage:campaign-images/,
    );
    expect(() => client.storage.from("campaign-images").upload("x", {})).toThrow(
      /forbidden_production_access:storage:campaign-images/,
    );
    for (const table of [
      "campaigns",
      "campaign_art_versions",
      "generation_events",
      "ai_model_selection",
      "admin_audit_log",
      "credit_transactions",
      "credit_balances",
    ]) {
      expect(() => client.from(table), `tabela produtiva ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}`),
      );
    }
  });

  it("ALLOWED_ENTRY_RE casa as leituras dos buckets de branding e das tabelas locais", () => {
    const entries = [
      "from:stores",
      "from:store_brand_profiles",
      "from:store_brand_assets",
      "from:store_visual_signatures",
      "from:lab_bench_runs",
      "from:lab_bench_artifacts",
      "storage.createSignedUrl:store-logos:store-logos/logo.png",
      "storage.createSignedUrl:store-brand-assets:store-brand-assets/asset.png",
      "storage.createSignedUrl:visual-signatures:visual-signatures/sig.png",
      "rpc:lab_bench_reserve_run",
    ];
    for (const entry of entries) {
      expect(ALLOWED_ENTRY_RE.test(entry), entry).toBe(true);
    }
  });

  // ─── (F48.2.3) Fronteira da importação ─────────────────────────────────────

  it("a única tabela de escrita aditiva é a auditoria local de importação (D11)", () => {
    const client = looseClient();
    // A auditoria local da importação é o único destino de escrita aditivo.
    expect(() => client.from("lab_bench_store_imports").select("*")).not.toThrow();
    expect(() => client.from("lab_bench_store_imports").insert({})).not.toThrow();
    expect(() => client.from("lab_bench_store_imports").update({})).not.toThrow();
    // Loja/branding permanecem estritamente somente leitura no runtime.
    for (const table of [
      "stores",
      "store_brand_profiles",
      "store_brand_assets",
      "store_visual_signatures",
    ]) {
      expect(() => client.from(table).insert({}), `insert ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}:insert`),
      );
      expect(() => client.from(table).update({}), `update ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}:update`),
      );
      expect(() => client.from(table).delete(), `delete ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}:delete`),
      );
    }
  });

  it("o runtime não abre conexão remota: alvos fora da allowlist local fazem o teste falhar", () => {
    const client = looseClient();
    // Nenhuma origem remota é acessível pelo runtime da bancada.
    expect(() => client.from("remote_stores")).toThrow(/forbidden_production_access:remote_stores/);
    expect(() => client.storage.from("remote-store-logos")).toThrow(
      /forbidden_production_access:storage:remote-store-logos/,
    );
    expect(() => client.from("lab_bench_remote_source")).toThrow(
      /forbidden_production_access:lab_bench_remote_source/,
    );
  });

  it("ALLOWED_ENTRY_RE reconhece a auditoria local de importação", () => {
    expect(ALLOWED_TABLES.has("lab_bench_store_imports")).toBe(true);
    expect(ALLOWED_ENTRY_RE.test("from:lab_bench_store_imports")).toBe(true);
  });
});

// ─── (F48.2.4) Identidade canônica, produção intocada e local-only ───────────

describe("isolamento — identidade canônica e produção intocada (F48.2.4)", () => {
  function minimalBrandingSnapshot(): Record<string, unknown> {
    return {
      storeId: STORE_ID,
      storeName: "Loja Teste",
      segment: "outros",
      subsegment: null,
      toneOfVoice: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
      typographyDirection: null,
      safeColorTokens: {},
      brandColorsChosen: [],
      inferredPrimaryColor: null,
      storeBrandColor: null,
      brandColor: "#22C55E",
      logoColorsDetected: [],
      visualStyle: null,
      visualTone: null,
      brandPersonality: null,
      campaignGuidelines: null,
      campaignBrief: null,
      profileSource: null,
      profileStatus: null,
      logoUrl: null,
      signatureUrl: null,
      identityState: "logo",
      identityReference: {
        kind: "logo",
        variantType: null,
        storagePath: "store-logos/logo.png",
      },
      identityReason: "logo_resolved",
      assets: [],
    };
  }

  it("o descritor de identidade aceita apenas { kind, variantType, storagePath } — nunca URL assinada", () => {
    expect(
      BenchIdentityReferenceSchema.safeParse({
        kind: "logo",
        variantType: null,
        storagePath: "store-logos/logo.png",
      }).success,
    ).toBe(true);

    // `.strict()` recusa qualquer URL assinada/token embutido no descritor.
    expect(
      BenchIdentityReferenceSchema.safeParse({
        kind: "logo",
        variantType: null,
        storagePath: "store-logos/logo.png",
        signedUrl: "https://projeto.supabase.co/storage/v1/object/sign/store-logos/logo.png",
      }).success,
    ).toBe(false);
  });

  it("o snapshot de branding não persiste URL assinada (identityReference strict)", () => {
    expect(BenchBrandingSnapshotSchema.safeParse(minimalBrandingSnapshot()).success).toBe(true);

    const withSignedUrl = {
      ...minimalBrandingSnapshot(),
      identityReference: {
        kind: "logo",
        variantType: null,
        storagePath: "store-logos/logo.png",
        signedUrl: "https://projeto.supabase.co/storage/v1/object/sign/store-logos/logo.png",
      },
    };
    expect(BenchBrandingSnapshotSchema.safeParse(withSignedUrl).success).toBe(false);
  });

  it("o runtime não abre conexão remota (alvos remotos lançam)", () => {
    const client = createRecordingClient().client as unknown as {
      from: (table: string) => unknown;
      storage: { from: (bucket: string) => unknown };
    };
    expect(() => client.from("remote_stores")).toThrow(/forbidden_production_access:remote_stores/);
    expect(() => client.storage.from("remote-store-logos")).toThrow(
      /forbidden_production_access:storage:remote-store-logos/,
    );
  });

  it("nenhuma escrita em tabelas produtivas e o bucket campaign-images nunca é reutilizado", () => {
    const client = createRecordingClient().client as unknown as {
      from: (table: string) => { insert: (payload: unknown) => unknown };
      storage: {
        from: (bucket: string) => { createSignedUrl: (p: string, ttl: number) => unknown };
      };
    };
    for (const table of [
      "campaigns",
      "campaign_art_versions",
      "generation_events",
      "ai_model_selection",
      "admin_audit_log",
      "credit_transactions",
    ]) {
      expect(() => client.from(table).insert({}), `escrita ${table}`).toThrow(
        new RegExp(`forbidden_production_access:${table}`),
      );
    }
    expect(() => client.storage.from("campaign-images").createSignedUrl("x", 60)).toThrow(
      /forbidden_production_access:storage:campaign-images/,
    );
    expect(ALLOWED_BUCKETS.has("campaign-images")).toBe(false);
    expect(ALLOWED_ENTRY_RE.test("storage.from:campaign-images")).toBe(false);
  });

  it("FORBIDDEN_TARGETS preserva todos os alvos produtivos (nenhuma regra afrouxada)", () => {
    for (const target of [
      "campaigns",
      "campaign_images",
      "generation_events",
      "ai_model_selection",
      "admin_audit_log",
      "credit_",
      "campaign-images",
    ]) {
      expect(FORBIDDEN_TARGETS).toContain(target);
    }
  });
});
