import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockResolveAiCost } = vi.hoisted(() => ({ mockResolveAiCost: vi.fn() }));

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

import { createLabGateway, createLabTelemetryContext, runLabCampaignImage } from "../runtime";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import type { AiModelConfig, AiModelResolver, AiModelTarget } from "@/lib/ai/model-resolver";
import type { AiAdapter, AiAdapterRegistry, AiInvocationRequest, AiInvocationResult } from "@/lib/ai/types";

/**
 * F48.1 (D6/D7/D14/T-48-1-31) — runtime single-shot do laboratório.
 *
 * Prova, com fakes e sem rede: exatamente **1 envelope por run** no sucesso e na
 * falha, nenhuma segunda invocação, nenhuma consulta de fallback e nenhum acesso
 * ao índice `@/lib/ai`.
 */

const FIXED_TARGET: AiModelTarget = {
  provider: "openai",
  model: "gpt-5.5",
  protocol: "responses",
};

const FALLBACK_CONFIG: AiModelConfig = {
  capability: "campaign_image",
  segment: "image",
  primary: { provider: "gemini", model: "gemini-2.5-flash", protocol: "gemini" },
  fallback: { provider: "openai", model: "gpt-image-2", protocol: "images" },
};

function createFallbackResolver(): AiModelResolver {
  return {
    async resolve() {
      return FALLBACK_CONFIG;
    },
    listCapabilities() {
      return ["campaign_image"];
    },
  };
}

interface FakeAdapterHarness {
  adapter: AiAdapter;
  calls: AiInvocationRequest[];
}

function createFakeAdapter(
  handler: (request: AiInvocationRequest) => Promise<AiInvocationResult>,
): FakeAdapterHarness {
  const calls: AiInvocationRequest[] = [];
  const adapter: AiAdapter = {
    protocol: "responses",
    async invoke(request) {
      calls.push(request);
      return handler(request);
    },
  };
  return { adapter, calls };
}

function createAdapters(adapter: AiAdapter): AiAdapterRegistry {
  return {
    get(protocol) {
      return protocol === adapter.protocol ? adapter : undefined;
    },
  };
}

const SCENARIO_IMAGES = ["data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"];

function createRequest(): AiInvocationRequest {
  return {
    prompt: "prompt do diretor montado pelo caminho real",
    productImagesDataUrls: SCENARIO_IMAGES,
    tools: "image_generation",
    size: "1024x1024",
    quality: "auto",
  };
}

function createHarness(handler: (request: AiInvocationRequest) => Promise<AiInvocationResult>) {
  const { adapter, calls } = createFakeAdapter(handler);
  const gateway = createLabGateway({
    fixedTarget: FIXED_TARGET,
    fallbackResolver: createFallbackResolver(),
    adapters: createAdapters(adapter),
  });
  const sink = new LabTelemetrySink();
  const telemetry = createLabTelemetryContext({
    sink,
    operationRunId: "run-lab-1",
    traceId: "trace-lab-1",
    storeId: "store-lab-1",
  });
  return { gateway, sink, telemetry, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue({
    estimatedCostUsd: 0.0421,
    costSource: "pricing_table",
    textComponentUsd: 0.0121,
    imageToolComponentUsd: 0.03,
  });
});

describe("runtime do laboratório — 1 envelope por run (F48.1, D7/D14)", () => {
  it("sucesso: exatamente 1 chamada do adapter e 1 envelope no sink", async () => {
    const { gateway, sink, telemetry, calls } = createHarness(async () => ({
      imageBase64: "Z2VyYWRv",
      mimeType: "image/png",
      model: "gpt-5.5",
      usage: { totalTokens: 120 },
      usageMeta: { imageGenerationTool: true },
    }));

    const result = await runLabCampaignImage({
      gateway,
      request: createRequest(),
      telemetry,
    });

    expect(calls).toHaveLength(1);
    expect(sink.entries).toHaveLength(1);
    expect(result.imageBase64).toBe("Z2VyYWRv");
    expect(result.mimeType).toBe("image/png");
    expect(sink.entries[0].status).toBe("success");
    expect(sink.entries[0].capability).toBe("campaign_image");
    expect(sink.entries[0].provider).toBe("openai");
    expect(sink.entries[0].model).toBe("gpt-5.5");
    expect(sink.entries[0].protocol).toBe("responses");
  });

  it("falha por capability: 1 envelope failed e NENHUMA segunda invocação", async () => {
    const { gateway, sink, telemetry, calls } = createHarness(async () => {
      throw new Error("model_not_found: capability indisponível");
    });

    await expect(
      runLabCampaignImage({ gateway, request: createRequest(), telemetry }),
    ).rejects.toThrow();

    expect(calls).toHaveLength(1);
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].status).toBe("failed");
    expect(sink.entries[0].errorType).toBe("capability");
  });

  it("falha de rede: 1 envelope failed, sem retry", async () => {
    const { gateway, sink, telemetry, calls } = createHarness(async () => {
      throw new Error("ECONNRESET");
    });

    await expect(
      runLabCampaignImage({ gateway, request: createRequest(), telemetry }),
    ).rejects.toThrow();

    expect(calls).toHaveLength(1);
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].errorType).toBe("network");
  });

  it("o alvo fixo tem precedência sobre o fallback do resolver padrão", async () => {
    const { gateway, sink, telemetry } = createHarness(async () => ({
      imageBase64: "Z2VyYWRv",
      mimeType: "image/png",
      model: "gpt-5.5",
    }));

    await runLabCampaignImage({ gateway, request: createRequest(), telemetry });

    expect(sink.entries[0].provider).toBe(FIXED_TARGET.provider);
    expect(sink.entries[0].protocol).toBe(FIXED_TARGET.protocol);
  });

  it("o request repassado ao adapter contém tools e as imagens do cenário", async () => {
    const { gateway, telemetry, calls } = createHarness(async () => ({
      imageBase64: "Z2VyYWRv",
      mimeType: "image/png",
      model: "gpt-5.5",
    }));

    await runLabCampaignImage({ gateway, request: createRequest(), telemetry });

    expect(calls[0].tools).toBe("image_generation");
    expect(calls[0].productImagesDataUrls).toEqual(SCENARIO_IMAGES);
    expect(calls[0].size).toBe("1024x1024");
  });

  it("createLabTelemetryContext usa campaign_delivery e injeta o sink", () => {
    const sink = new LabTelemetrySink();

    const telemetry = createLabTelemetryContext({
      sink,
      operationRunId: "run-lab-2",
      traceId: "trace-lab-2",
      storeId: "store-lab-2",
      userId: "user-1",
    });

    expect(telemetry.operationRunType).toBe("campaign_delivery");
    expect(telemetry.sink).toBe(sink);
    expect(telemetry.operationRunId).toBe("run-lab-2");
    expect(telemetry.traceId).toBe("trace-lab-2");
    expect(telemetry.storeId).toBe("store-lab-2");
    expect(telemetry.userId).toBe("user-1");
  });
});
