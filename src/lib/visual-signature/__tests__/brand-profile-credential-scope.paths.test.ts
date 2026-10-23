// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSupabaseFrom,
  mockChatCreate,
  mockRecord,
  mockResolveAiCost,
  mockProbeColors,
  mockFetch,
} = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockChatCreate: vi.fn(),
  mockRecord: vi.fn(),
  mockResolveAiCost: vi.fn(),
  mockProbeColors: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock("@/lib/image-generation/prompt-loader", () => ({
  PromptLoader: class {
    load = vi.fn(() => "prompt");
  },
}));

vi.mock("@/lib/brand-assets/color-probe", () => ({
  probeColors: mockProbeColors,
  findClosestProbeCluster: vi.fn(() => null),
}));

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: { completions: { create: mockChatCreate } },
      responses: { create: vi.fn() },
    };
  }),
}));

import { BrandTextOnlyInferenceService } from "@/lib/brand-assets/text-only-inference-service";
import { BrandProfilerWithoutLogoService } from "@/lib/visual-signature/brand-profiler";
import { ChatCompletionsAdapter } from "@/lib/ai/adapters/chat-completions";
import { AiGateway } from "@/lib/ai/gateway";
import { DefaultAiTelemetrySink } from "@/lib/ai/telemetry-sink";
import type { AiModelConfig, AiModelResolver } from "@/lib/ai/model-resolver";
import type { AiTelemetryContext } from "@/lib/ai/types";

function makeChain(result: unknown) {
  const resolvable = Promise.resolve(result);
  const chain: any = Object.assign(() => resolvable, {
    then: resolvable.then.bind(resolvable),
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  });
  return chain;
}

function resolverFor(capability: "brand_profile_vision" | "brand_profile_text"): AiModelResolver {
  const config = {
    capability,
    segment: capability === "brand_profile_vision" ? "vision" : "text",
    primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
  } as AiModelConfig;
  return {
    resolve: vi.fn(async () => config),
    listCapabilities: vi.fn(() => [capability]),
  };
}

function makeGateway(capability: "brand_profile_vision" | "brand_profile_text" = "brand_profile_vision") {
  return new AiGateway(resolverFor(capability), {
    get: () => new ChatCompletionsAdapter(),
  });
}

function makeTelemetry(): AiTelemetryContext {
  const context = {
    operationRunId: "run-path",
    operationRunType: "brand_profile" as const,
    traceId: "trace-path",
    storeId: "store-path",
    attemptNumber: 0,
  };
  return {
    ...context,
    sink: new DefaultAiTelemetrySink(context, { record: mockRecord } as never),
  };
}

function lastEvent() {
  const calls = mockRecord.mock.calls;
  return calls[calls.length - 1]?.[0] as {
    operationRunType?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  };
}

const profileInput = {
  storeId: "store-path",
  storeName: "Calce Bem",
  segment: "moda-calcados-acessorios",
  subsegment: null,
  tone_of_voice: "jovem",
  positioning: "Jovem",
  short_description: "Calçados",
  slogan: null,
  city: "São Paulo",
  state: "SP",
  brandColor: "#FF6B4A",
  artDirectorOutput: {
    creative_description: "Calçados jovens",
    suggested_colors: ["#FF6B4A", "#0A1438"],
    visual_direction: "Jovem",
    elements_used: ["nome da loja"],
  },
  visualSignatureId: "vs-path",
  assetUrl: "https://example.com/assinatura.png",
  referenceCardUrl: null,
  intendedPalette: {
    primary: "#0A1438",
    accent: "#FF6B4A",
    background: "#F7F5EF",
    support: ["#D9E7FF"],
  },
  previousBrandColors: [],
};

const chatSuccess = {
  choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(0),
  });
  mockSupabaseFrom.mockImplementation(() => makeChain({ data: [], error: null }));
  mockProbeColors.mockResolvedValue(null);
  mockResolveAiCost.mockResolvedValue({ estimatedCostUsd: 0.001, costSource: "pricing_table" });
  mockChatCreate.mockResolvedValue(chatSuccess);
});

describe("caminho real de aprovação da assinatura visual", () => {
  it("gera o evento brand_profile_vision no contexto brand_profile com sucesso", async () => {
    const service = new BrandProfilerWithoutLogoService(makeGateway());
    const telemetry = makeTelemetry();

    const result = await service.generate(profileInput, telemetry);

    expect(result.success).toBe(true);
    expect(mockSupabaseFrom).toHaveBeenCalledWith("store_brand_profiles");
    expect(lastEvent().operationRunType).toBe("brand_profile");
    expect(lastEvent().status).toBe("success");
    expect(lastEvent().metadata?.credential_scope).toBe("normal");
  });

  it("persiste evento final de falha no contexto brand_profile", async () => {
    mockChatCreate.mockRejectedValue(new Error("provider rejection"));
    const service = new BrandProfilerWithoutLogoService(makeGateway());
    const telemetry = makeTelemetry();

    await expect(service.generate(profileInput, telemetry)).rejects.toThrow("provider rejection");

    expect(lastEvent().operationRunType).toBe("brand_profile");
    expect(lastEvent().status).toBe("failed");
    expect(lastEvent().metadata?.credential_scope).toBe("normal");
  });
});

describe("caminho real de realinhamento da assinatura visual", () => {
  it("gera o evento no modo regenerate com sucesso", async () => {
    const service = new BrandProfilerWithoutLogoService(makeGateway());
    const telemetry = makeTelemetry();

    const result = await service.generate(
      { ...profileInput, mode: "regenerate" as const },
      telemetry,
    );

    expect(result.success).toBe(true);
    expect(lastEvent().operationRunType).toBe("brand_profile");
    expect(lastEvent().status).toBe("success");
    expect(lastEvent().metadata?.credential_scope).toBe("normal");
  });

  it("persiste evento final de falha no modo regenerate", async () => {
    mockChatCreate.mockRejectedValue(new Error("provider rejection"));
    const service = new BrandProfilerWithoutLogoService(makeGateway());
    const telemetry = makeTelemetry();

    await expect(
      service.generate({ ...profileInput, mode: "regenerate" as const }, telemetry),
    ).rejects.toThrow("provider rejection");

    expect(lastEvent().operationRunType).toBe("brand_profile");
    expect(lastEvent().status).toBe("failed");
    expect(lastEvent().metadata?.credential_scope).toBe("normal");
  });
});

describe("caminho real de brand_profile_text", () => {
  it("gera evento final de sucesso no contexto brand_profile", async () => {
    const service = new BrandTextOnlyInferenceService(makeGateway("brand_profile_text"));
    const telemetry = makeTelemetry();

    await service.infer(
      {
        storeName: "Calce Bem",
        segment: "moda-calcados-acessorios",
        subsegment: null,
        toneOfVoice: "jovem",
        positioning: "Jovem",
        shortDescription: "Calçados",
        slogan: null,
        city: "São Paulo",
        state: "SP",
      },
      30000,
      undefined,
      telemetry,
    );

    expect(lastEvent().operationRunType).toBe("brand_profile");
    expect(lastEvent().status).toBe("success");
    expect(lastEvent().metadata?.credential_scope).toBe("normal");
  });

  it("gera evento final de falha no contexto brand_profile", async () => {
    mockChatCreate.mockRejectedValue(new Error("provider rejection"));
    const service = new BrandTextOnlyInferenceService(makeGateway("brand_profile_text"));
    const telemetry = makeTelemetry();

    await expect(
      service.infer(
        {
          storeName: "Calce Bem",
          segment: "moda-calcados-acessorios",
          subsegment: null,
          toneOfVoice: "jovem",
          positioning: "Jovem",
          shortDescription: "Calçados",
          slogan: null,
          city: "São Paulo",
          state: "SP",
        },
        30000,
        undefined,
        telemetry,
      ),
    ).rejects.toThrow("provider rejection");

    expect(lastEvent().operationRunType).toBe("brand_profile");
    expect(lastEvent().status).toBe("failed");
    expect(lastEvent().metadata?.credential_scope).toBe("normal");
  });
});
