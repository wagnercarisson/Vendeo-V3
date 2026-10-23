// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockChatCreate,
  mockResponsesCreate,
  mockRecord,
  mockResolveAiCost,
} = vi.hoisted(() => ({
  mockChatCreate: vi.fn(),
  mockResponsesCreate: vi.fn(),
  mockRecord: vi.fn(),
  mockResolveAiCost: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: { completions: { create: mockChatCreate } },
      responses: { create: mockResponsesCreate },
    };
  }),
}));

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    record = mockRecord;
    startRun = vi.fn();
  },
}));

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

import { ChatCompletionsAdapter } from "../adapters/chat-completions";
import { ResponsesAdapter } from "../adapters/responses";
import { AiGateway } from "../gateway";
import { DefaultAiTelemetrySink } from "../telemetry-sink";
import type { AiModelConfig, AiModelResolver } from "../model-resolver";
import type {
  AiAdapter,
  AiAdapterRegistry,
  AiCredentialProvenance,
  AiTelemetryContext,
} from "../types";

const chatConfig = {
  capability: "brand_profile_vision",
  segment: "vision",
  primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
} as unknown as AiModelConfig;

const responsesConfig = {
  capability: "brand_profile_vision",
  segment: "vision",
  primary: { provider: "openai", model: "gpt-6-luna", protocol: "responses" },
} as unknown as AiModelConfig;

function makeResolver(config: AiModelConfig): AiModelResolver {
  return {
    resolve: vi.fn(async () => config),
    listCapabilities: vi.fn(() => [config.capability]),
  };
}

function makeRegistry(adapter: AiAdapter): AiAdapterRegistry {
  return { get: vi.fn(() => adapter) };
}

function makeTelemetry(runType: "brand_profile" | "campaign_delivery" = "brand_profile"): AiTelemetryContext {
  const context = {
    operationRunId: "run-credential-scope",
    operationRunType: runType,
    traceId: "trace-credential-scope",
    storeId: "store-credential-scope",
    attemptNumber: 0,
  } as const;
  return {
    ...context,
    sink: new DefaultAiTelemetrySink(context, { record: mockRecord } as never),
  };
}

function lastEvent() {
  const calls = mockRecord.mock.calls;
  return calls[calls.length - 1]?.[0] as { metadata?: Record<string, unknown>; status?: string };
}

const chatSuccess = {
  choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const responsesSuccess = {
  output_text: "{}",
  usage: { input_tokens: 10, output_tokens: 5 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  process.env.OPENAI_API_KEY = "sk-test";
  delete process.env.VENDEO_VS_VALIDATION_OPENAI_API_KEY;
  mockResolveAiCost.mockResolvedValue({
    estimatedCostUsd: 0.001,
    costSource: "pricing_table",
  });
  mockChatCreate.mockResolvedValue(chatSuccess);
  mockResponsesCreate.mockResolvedValue(responsesSuccess);
});

describe("proveniência não inventada", () => {
  it("falha antes da resolução da credencial não registra credencial_scope", async () => {
    const unknownProviderConfig = {
      capability: "brand_profile_vision",
      segment: "vision",
      primary: {
        provider: "unknown-provider",
        model: "gpt-4o",
        protocol: "chat-completions",
      },
    } as unknown as AiModelConfig;
    const gateway = new AiGateway(
      makeResolver(unknownProviderConfig),
      makeRegistry(new ChatCompletionsAdapter()),
    );

    await expect(
      gateway.invoke(
        "brand_profile_vision",
        { prompt: "analise", metadata: { credential_scope: "normal" } },
        makeTelemetry(),
      ),
    ).rejects.toThrow(/provider desconhecido/);

    expect(lastEvent().status).toBe("failed");
    expect(lastEvent().metadata).not.toHaveProperty("credential_scope");
  });

  it("resolvedor customizado sem escopo não infere normal", async () => {
    const adapter = new ResponsesAdapter(() => "sk-custom", {}, undefined);
    const gateway = new AiGateway(makeResolver(responsesConfig), makeRegistry(adapter));

    await gateway.invoke(
      "brand_profile_vision",
      { prompt: "analise", metadata: { credential_scope: "normal" } },
      makeTelemetry(),
    );

    expect(lastEvent().status).toBe("success");
    expect(lastEvent().metadata).not.toHaveProperty("credential_scope");
  });

  it("fora de brand_profile preserva a metadata de caller", async () => {
    const gateway = new AiGateway(makeResolver(chatConfig), makeRegistry(new ChatCompletionsAdapter()));

    await gateway.invoke(
      "brand_profile_vision",
      { prompt: "analise", metadata: { credential_scope: "normal" } },
      makeTelemetry("campaign_delivery"),
    );

    expect(lastEvent().metadata?.credential_scope).toBe("normal");
  });

  it("proveniência interna vence metadata de caller", async () => {
    const adapter: AiAdapter = {
      protocol: "chat-completions",
      async invoke(_request, _target, provenance?: AiCredentialProvenance) {
        if (provenance) provenance.scope = "validation";
        return { content: "{}", model: "gpt-4o" };
      },
    };
    const gateway = new AiGateway(makeResolver(chatConfig), makeRegistry(adapter));

    await gateway.invoke(
      "brand_profile_vision",
      { prompt: "analise", metadata: { credential_scope: "normal" } },
      makeTelemetry(),
    );

    expect(lastEvent().metadata?.credential_scope).toBe("validation");
  });
});

describe("validação dedicada permanece explícita", () => {
  it("ResponsesAdapter com escopo validation registra validation", async () => {
    const provenance: AiCredentialProvenance = {};
    const adapter = new ResponsesAdapter(
      () => "sk-dedicated-validation",
      { maxRetries: 0 },
      "validation",
    );

    await adapter.invoke(
      { prompt: "valide" },
      { provider: "openai", model: "gpt-6-luna", protocol: "responses" },
      provenance,
    );

    expect(provenance.scope).toBe("validation");
  });

  it("ResponsesAdapter sem escopo explícito não registra valor", async () => {
    const provenance: AiCredentialProvenance = {};
    const adapter = new ResponsesAdapter(() => "sk-custom");

    await adapter.invoke(
      { prompt: "valide" },
      { provider: "openai", model: "gpt-6-luna", protocol: "responses" },
      provenance,
    );

    expect(provenance.scope).toBeUndefined();
  });
});
