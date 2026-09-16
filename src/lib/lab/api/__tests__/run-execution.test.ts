import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPrepareLabRun,
  mockRunReservedLabRun,
  mockLoadScenarioFixture,
  mockMapBrief,
  mockMapContext,
  mockCreateDefaultLabRuntime,
  mockPromptLoaderCtor,
  mockCreateNoopImageProvider,
  mockImageServiceCtor,
  mockSinkCtor,
} = vi.hoisted(() => ({
  mockPrepareLabRun: vi.fn(),
  mockRunReservedLabRun: vi.fn(),
  mockLoadScenarioFixture: vi.fn(),
  mockMapBrief: vi.fn(),
  mockMapContext: vi.fn(),
  mockCreateDefaultLabRuntime: vi.fn(),
  mockPromptLoaderCtor: vi.fn(),
  mockCreateNoopImageProvider: vi.fn(),
  mockImageServiceCtor: vi.fn(),
  mockSinkCtor: vi.fn(),
}));

vi.mock("@/lib/lab/run-service", () => {
  class LabReservationError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "LabReservationError";
      this.code = code;
    }
  }
  return {
    LabReservationError,
    prepareLabRun: (...args: unknown[]) => mockPrepareLabRun(...args),
    runReservedLabRun: (...args: unknown[]) => mockRunReservedLabRun(...args),
  };
});

vi.mock("@/lib/lab/scenarios/service", () => ({
  loadScenarioFixture: (...args: unknown[]) => mockLoadScenarioFixture(...args),
}));

vi.mock("@/lib/lab/scenarios/mapper", () => ({
  mapScenarioToCampaignBrief: (...args: unknown[]) => mockMapBrief(...args),
  mapScenarioToResolvedContext: (...args: unknown[]) => mockMapContext(...args),
}));

vi.mock("@/lib/lab/gateway/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lab/gateway/runtime")>();
  return {
    ...actual,
    createDefaultLabRuntime: (...args: unknown[]) => mockCreateDefaultLabRuntime(...args),
  };
});

vi.mock("@/lib/lab/gateway/lab-prompt-loader", () => ({
  LabPromptLoader: class {
    constructor(...args: unknown[]) {
      mockPromptLoaderCtor(...args);
    }
    load(): string {
      return "";
    }
  },
}));

vi.mock("@/lib/lab/gateway/noop-image-provider", () => ({
  createNoopImageProvider: () => mockCreateNoopImageProvider(),
}));

vi.mock("@/lib/image-generation/services/image-generation-service", () => ({
  ImageGenerationService: class {
    constructor(...args: unknown[]) {
      mockImageServiceCtor(...args);
    }
    buildDirectorPrompt(): string {
      return "";
    }
  },
}));

vi.mock("@/lib/ai/lab-telemetry-sink", () => ({
  LabTelemetrySink: class {
    constructor(...args: unknown[]) {
      mockSinkCtor(...args);
    }
  },
}));

import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import { LabReservationError } from "@/lib/lab/run-service";
import { createLabTelemetryContext } from "@/lib/lab/gateway/runtime";
import type { LabRunExecuteRequest } from "@/lib/admin/schemas";
import { prepareExperimentRun, runPreparedExperimentRun } from "../run-execution";
import type { LabRunExecutionContext } from "../run-execution";
import { createFakeSupabaseClient } from "./fake-supabase-client";
import type { FakeRow } from "./fake-supabase-client";

/**
 * F48.1 (D7/D8/D11) — wiring de execução do run.
 * Todas as dependências pesadas são mockadas: nenhuma chamada de rede nem paga.
 */

const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";
const SCENARIO_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const BASELINE_VARIANT = "77777777-7777-4777-8777-777777777777";
const CANDIDATE_VARIANT = "88888888-8888-4888-8888-888888888888";
const OPERATION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const TARGET = { provider: "openai", model: "gpt-5.5", protocol: "responses" } as const;
const PARAMS = { size: "1024x1024", quality: "high", skipInputValidation: true } as const;

const BASELINE_SNAPSHOT = {
  name: "campaign-image-director-offer",
  content: "prompt oficial",
  contentHash: "hash-baseline",
  source: "official",
} as const;

const CANDIDATE_SNAPSHOT = {
  name: "campaign-image-director-offer",
  content: "prompt candidata",
  contentHash: "hash-candidate",
  source: "override",
} as const;

const INPUT: LabRunExecuteRequest = {
  variantId: BASELINE_VARIANT,
  scenarioVersionId: SCENARIO_VERSION_ID,
  repetitionIndex: 1,
  supersedesRunId: null,
  confirmed: true,
  operationId: OPERATION_ID,
};

function tables(overrides: Partial<Record<string, FakeRow[]>> = {}): Record<string, FakeRow[]> {
  return {
    lab_experiments: [
      {
        id: EXPERIMENT_ID,
        model_target: TARGET,
        params: PARAMS,
        status: "ready",
      },
    ],
    lab_experiment_variants: [
      {
        id: BASELINE_VARIANT,
        experiment_id: EXPERIMENT_ID,
        role: "baseline",
        prompt_snapshot: BASELINE_SNAPSHOT,
      },
      {
        id: CANDIDATE_VARIANT,
        experiment_id: EXPERIMENT_ID,
        role: "candidate",
        prompt_snapshot: CANDIDATE_SNAPSHOT,
      },
    ],
    lab_experiment_scenarios: [
      { id: "link-1", experiment_id: EXPERIMENT_ID, scenario_version_id: SCENARIO_VERSION_ID },
    ],
    lab_scenario_versions: [
      {
        id: SCENARIO_VERSION_ID,
        scenario_id: SCENARIO_ID,
        version: 3,
        content_hash: "scenario-hash",
      },
    ],
    lab_scenarios: [{ id: SCENARIO_ID, slug: "produto-oferta-preco" }],
    ...overrides,
  };
}

const BRIEF_SENTINEL = { product: { name: "Produto" } } as unknown;
const CONTEXT_SENTINEL = { campaignInput: {} } as unknown;
const GATEWAY_SENTINEL = { invoke: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadScenarioFixture.mockResolvedValue({
    content: { slug: "produto-oferta-preco" },
    contentHash: "scenario-hash",
    fixturePath: "fixtures/lab/scenarios/produto-oferta-preco",
    imagesDataUrls: { "images/produto.jpg": "data:image/png;base64,AAA" },
    logoDataUrl: null,
  });
  mockMapBrief.mockReturnValue(BRIEF_SENTINEL);
  mockMapContext.mockReturnValue(CONTEXT_SENTINEL);
  mockPrepareLabRun.mockResolvedValue({
    runId: "run-1",
    snapshot: { runType: "lab" },
    idempotent: false,
  });
  mockCreateDefaultLabRuntime.mockResolvedValue({ gateway: GATEWAY_SENTINEL });
  mockCreateNoopImageProvider.mockReturnValue({ name: "lab-noop-image-provider" });
  mockRunReservedLabRun.mockResolvedValue({ runId: "run-1", status: "succeeded" });
});

describe("prepareExperimentRun", () => {
  it("mapeia o cenário para brief/contexto e reserva com os identificadores exatos", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const prepared = await prepareExperimentRun({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      actorId: "admin-1",
      input: INPUT,
    });

    expect(mockLoadScenarioFixture).toHaveBeenCalledWith("produto-oferta-preco");
    expect(mockMapBrief).toHaveBeenCalledWith(
      { slug: "produto-oferta-preco" },
      { "images/produto.jpg": "data:image/png;base64,AAA" },
    );
    expect(mockMapContext).toHaveBeenCalledWith(
      { slug: "produto-oferta-preco" },
      { "images/produto.jpg": "data:image/png;base64,AAA" },
      null,
    );

    expect(mockPrepareLabRun).toHaveBeenCalledTimes(1);
    expect(mockPrepareLabRun.mock.calls[0][0]).toMatchObject({
      experimentId: EXPERIMENT_ID,
      variantId: BASELINE_VARIANT,
      scenarioVersionId: SCENARIO_VERSION_ID,
      repetitionIndex: 1,
      supersedesRunId: null,
      operationId: OPERATION_ID,
      actorId: "admin-1",
      scenario: { id: SCENARIO_VERSION_ID, version: 3, contentHash: "scenario-hash" },
      experiment: { modelTarget: TARGET, params: PARAMS },
    });

    expect(prepared.runId).toBe("run-1");
    expect(prepared.idempotent).toBe(false);
    expect(prepared.executionContext.scenario.brief).toBe(BRIEF_SENTINEL);
    expect(prepared.executionContext.scenario.context).toBe(CONTEXT_SENTINEL);
    expect(prepared.executionContext.variant.role).toBe("baseline");
    expect(prepared.executionContext.variants.candidate.source).toBe("override");
  });

  it("propaga o erro de reserva sem iniciar nenhuma execução", async () => {
    mockPrepareLabRun.mockRejectedValue(new LabReservationError("budget_exceeded"));
    const fake = createFakeSupabaseClient({ tables: tables() });

    await expect(
      prepareExperimentRun({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        actorId: "admin-1",
        input: INPUT,
      }),
    ).rejects.toMatchObject({ code: "budget_exceeded" });

    expect(mockCreateDefaultLabRuntime).not.toHaveBeenCalled();
    expect(mockRunReservedLabRun).not.toHaveBeenCalled();
  });

  it("recusa variante que não pertence ao experimento antes de qualquer I/O pago", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    await expect(
      prepareExperimentRun({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        actorId: "admin-1",
        input: { ...INPUT, variantId: "99999999-9999-4999-8999-999999999999" },
      }),
    ).rejects.toMatchObject({ code: "variant_not_in_experiment" });

    expect(mockPrepareLabRun).not.toHaveBeenCalled();
  });

  it("recusa cenário não vinculado ao experimento", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables({ lab_experiment_scenarios: [] }),
    });

    await expect(
      prepareExperimentRun({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        actorId: "admin-1",
        input: INPUT,
      }),
    ).rejects.toMatchObject({ code: "scenario_not_in_experiment" });

    expect(mockPrepareLabRun).not.toHaveBeenCalled();
  });

  it("recusa experimento inexistente", async () => {
    const fake = createFakeSupabaseClient({ tables: tables({ lab_experiments: [] }) });

    await expect(
      prepareExperimentRun({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        actorId: "admin-1",
        input: INPUT,
      }),
    ).rejects.toMatchObject({ code: "experiment_not_found" });
  });
});

describe("runPreparedExperimentRun", () => {
  const executionContext: LabRunExecutionContext = {
    scenario: {
      imagesDataUrls: { "images/produto.jpg": "data:image/png;base64,AAA" },
      logoDataUrl: null,
      brief: BRIEF_SENTINEL as never,
      context: CONTEXT_SENTINEL as never,
    },
    experiment: { modelTarget: TARGET, params: PARAMS },
    variant: { role: "baseline", promptSnapshot: BASELINE_SNAPSHOT },
    variants: { baseline: BASELINE_SNAPSHOT, candidate: CANDIDATE_SNAPSHOT },
  };

  it("compõe o loader com o snapshot da variante, usa o provider no-op e executa o run reservado", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const result = await runPreparedExperimentRun({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      runId: "run-1",
      snapshot: { runType: "lab" } as never,
      actorId: "admin-1",
      executionContext,
    });

    expect(mockCreateDefaultLabRuntime).toHaveBeenCalledWith({ fixedTarget: TARGET });
    expect(mockPromptLoaderCtor).toHaveBeenCalledWith([
      { name: BASELINE_SNAPSHOT.name, content: BASELINE_SNAPSHOT.content },
    ]);
    expect(mockCreateNoopImageProvider).toHaveBeenCalledTimes(1);
    expect(mockImageServiceCtor).toHaveBeenCalledTimes(1);
    expect(mockImageServiceCtor.mock.calls[0][0]).toEqual({
      name: "lab-noop-image-provider",
    });

    expect(mockRunReservedLabRun).toHaveBeenCalledTimes(1);
    const runParams = mockRunReservedLabRun.mock.calls[0][0] as Record<string, unknown>;
    expect(runParams).toMatchObject({
      experimentId: EXPERIMENT_ID,
      runId: "run-1",
      actorId: "admin-1",
      gateway: GATEWAY_SENTINEL,
      experiment: { params: PARAMS },
      scenario: executionContext.scenario,
    });
    expect(runParams.sink).toBeInstanceOf(LabTelemetrySink);
    expect(result).toEqual({ runId: "run-1", status: "succeeded" });
  });

  it("o contexto econômico do run é campaign_delivery (contrato do harness)", () => {
    const telemetry = createLabTelemetryContext({
      sink: new LabTelemetrySink(),
      operationRunId: "run-1",
      traceId: "run-1",
      storeId: EXPERIMENT_ID,
      userId: "admin-1",
    });

    expect(telemetry.operationRunType).toBe("campaign_delivery");
  });
});
