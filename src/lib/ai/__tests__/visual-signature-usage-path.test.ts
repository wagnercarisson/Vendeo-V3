// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

const { mockGetModelPricing, mockRecord } = vi.hoisted(() => ({
  mockGetModelPricing: vi.fn(),
  mockRecord: vi.fn(),
}));

vi.mock("@/lib/ai-cost/ai-model-pricing", () => ({
  getModelPricing: mockGetModelPricing,
}));

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    record = mockRecord;
    startRun = vi.fn();
  },
}));

import { AiGateway } from "../gateway";
import { DefaultAiTelemetrySink } from "../telemetry-sink";
import { normalizeResponsesUsage } from "../adapters/responses";
import type { AiAdapter, AiCallEnvelope, AiTelemetryContext } from "../types";
import type { AiModelResolver, AiModelTarget } from "../model-resolver";

const target: AiModelTarget = {
  provider: "openai",
  model: "gpt-6-luna",
  protocol: "responses",
};

const resolver: AiModelResolver = {
  resolve: async () => ({
    capability: "visual_signature_image",
    segment: "image",
    primary: target,
  }),
  listCapabilities: () => ["visual_signature_image"],
};

const FULL_PRICING = {
  inputCostUsd: 5,
  outputCostUsd: 30,
  cachedInputCostUsd: 0.5,
  imageTokenUsdPer1M: 8,
};

function telemetry(): { context: AiTelemetryContext; events: unknown[] } {
  const events: unknown[] = [];
  const context = {
    operationRunId: "run-1",
    operationRunType: "visual_signature" as const,
    traceId: "trace-1",
    storeId: "store-1",
    attemptNumber: 1,
    sink: new DefaultAiTelemetrySink(
      {
        operationRunId: "run-1",
        operationRunType: "visual_signature",
        traceId: "trace-1",
        storeId: "store-1",
        attemptNumber: 1,
      },
      { record: mockRecord } as never,
    ),
  };
  return { context, events };
}

class FakeAdapter implements AiAdapter {
  readonly protocol = "responses" as const;
  lastRequest?: Record<string, unknown>;

  constructor(
    private readonly rawUsage: unknown,
    private readonly toolUsage?: unknown,
    private readonly providerReportedCostUsd?: number,
  ) {}

  async invoke(request: Parameters<AiAdapter["invoke"]>[0], model: AiModelTarget) {
    this.lastRequest = request as unknown as Record<string, unknown>;
    return {
      content: '{"visual_direction":"Minimalista","content_used":{"store_name":true}}',
      imageBase64: "BASE64",
      model: model.model,
      usage: normalizeResponsesUsage(this.rawUsage),
      providerReportedCostUsd: this.providerReportedCostUsd,
      usageMeta: {
        responsesModel: model.model,
        imageGenerationModel: request.imageGenerationModel,
        imageGenerationTool: true,
        ...(this.toolUsage
          ? {
              imageToolUsage: normalizeResponsesUsage(this.toolUsage),
              imageToolUsageSource: "tool_output" as const,
            }
          : { imageToolUsageSource: "absent" as const }),
      },
    };
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRecord.mockResolvedValue(undefined);
  mockGetModelPricing.mockResolvedValue({ pricing: FULL_PRICING, versionId: "price-1" });
});

const RAW_MAIN = {
  input_tokens: 1000,
  output_tokens: 500,
  input_tokens_details: {
    text_tokens: 800,
    image_tokens: 200,
    cached_tokens: 200,
    cached_tokens_details: { text_tokens: 200, image_tokens: 0 },
  },
  output_tokens_details: { text_tokens: 300, image_tokens: 200, reasoning_tokens: 100 },
};

const REQUEST_METADATA = {
  visual_signature_preset: "sunburst_medium" as const,
  config_version_id: "config-1",
  reasoning_effort: "low" as const,
  image_model: "gpt-image-2.5-sunburst",
  image_quality: "medium",
  retry_used: false,
  retry_prompt_variant: "full" as const,
  credential_scope: "validation" as const,
};

describe("F47.1 — percurso completo adapter → gateway → sink → estimador", () => {
  it("breakdown completo: modelos/qualidade/preset preservados e sem dupla contagem", async () => {
    const adapter = new FakeAdapter(RAW_MAIN);
    const gateway = new AiGateway(resolver, { get: () => adapter });
    const { context } = telemetry();

    await gateway.invoke(
      "visual_signature_image",
      {
        prompt: "arte",
        tools: "image_generation",
        quality: "medium",
        imageGenerationModel: "gpt-image-2.5-sunburst",
        reasoningEffort: "low",
        metadata: REQUEST_METADATA,
      },
      context,
    );

    expect(mockGetModelPricing).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
    expect(mockGetModelPricing).not.toHaveBeenCalledWith(
      expect.objectContaining({ model: "responses:image_generation" }),
    );

    const event = mockRecord.mock.calls[0][0];
    expect(event.generationType).toBe("visual_signature_image");
    expect(event.model).toBe("gpt-6-luna");
    expect(event.cost.costCoverage).toBe("complete");
    expect(event.cost.costSource).toBe("pricing_table");
    expect(event.cost.estimatedCostUsd).toBeCloseTo(0.0153, 8);
    expect(event.metadata).toMatchObject({
      responses_model: "gpt-6-luna",
      image_model: "gpt-image-2.5-sunburst",
      image_quality: "medium",
      visual_signature_preset: "sunburst_medium",
      reasoning_effort: "low",
      config_version_id: "config-1",
      attempt_number: 1,
      retry_used: false,
      retry_prompt_variant: "full",
      credential_scope: "validation",
      cost_coverage: "complete",
      cost_source: "pricing_table",
    });
  });

  it("tool usage separado é precificado uma vez, com cobertura completa", async () => {
    const adapter = new FakeAdapter(
      { input_tokens: 1000, output_tokens: 500 },
      { output_tokens: 196, output_tokens_details: { text_tokens: 0, image_tokens: 196 } },
    );
    const gateway = new AiGateway(resolver, { get: () => adapter });
    const { context } = telemetry();

    await gateway.invoke(
      "visual_signature_image",
      {
        prompt: "arte",
        tools: "image_generation",
        quality: "medium",
        imageGenerationModel: "gpt-image-2.5-sunburst",
        reasoningEffort: "low",
        metadata: REQUEST_METADATA,
      },
      context,
    );

    const event = mockRecord.mock.calls[0][0];
    expect(event.cost.costCoverage).toBe("complete");
    // 1000*5 + 500*30 + 196*8 = 0.021568
    expect(event.cost.estimatedCostUsd).toBeCloseTo(0.021568, 8);
    expect(event.metadata).toMatchObject({
      image_tool_usage_source: "tool_output",
      image_tool_usage: expect.objectContaining({ outputImageTokens: 196 }),
    });
  });

  it("tool usage ausente: cobertura parcial, sem inventar usage", async () => {
    const adapter = new FakeAdapter({ input_tokens: 1000, output_tokens: 500 });
    const gateway = new AiGateway(resolver, { get: () => adapter });
    const { context } = telemetry();

    await gateway.invoke(
      "visual_signature_image",
      {
        prompt: "arte",
        tools: "image_generation",
        quality: "medium",
        imageGenerationModel: "gpt-image-2.5-sunburst",
        reasoningEffort: "low",
        metadata: REQUEST_METADATA,
      },
      context,
    );

    const event = mockRecord.mock.calls[0][0];
    expect(event.cost.costCoverage).toBe("partial");
    expect(event.cost.costEstimationNote).toContain("image_inclusion_unproven");
    expect(event.metadata.image_tool_usage_source).toBe("absent");
    expect(event.metadata.image_tool_usage).toBeUndefined();
  });

  it("tarifa ausente: unknown/not_available, sem 0.065 e sem fallback_static", async () => {
    mockGetModelPricing.mockResolvedValue(null);
    const adapter = new FakeAdapter(RAW_MAIN);
    const gateway = new AiGateway(resolver, { get: () => adapter });
    const { context } = telemetry();

    await gateway.invoke(
      "visual_signature_image",
      {
        prompt: "arte",
        tools: "image_generation",
        quality: "medium",
        imageGenerationModel: "gpt-image-2.5-sunburst",
        reasoningEffort: "low",
        metadata: REQUEST_METADATA,
      },
      context,
    );

    const event = mockRecord.mock.calls[0][0];
    expect(event.cost.estimatedCostUsd).toBeNull();
    expect(event.cost.costSource).toBe("not_available");
    expect(event.cost.costCoverage).toBe("unknown");
    expect(event.metadata.cost_estimation_note).not.toContain("0.065");
    expect(event.cost.costSource).not.toBe("fallback_static");
  });

  it("custo reportado trafega separado da estimativa até o evento", async () => {
    const adapter = new FakeAdapter(RAW_MAIN, undefined, 0.5);
    const gateway = new AiGateway(resolver, { get: () => adapter });
    const { context } = telemetry();

    await gateway.invoke(
      "visual_signature_image",
      {
        prompt: "arte",
        tools: "image_generation",
        quality: "medium",
        imageGenerationModel: "gpt-image-2.5-sunburst",
        reasoningEffort: "low",
        metadata: REQUEST_METADATA,
      },
      context,
    );

    const event = mockRecord.mock.calls[0][0];
    expect(event.cost.providerReportedCostUsd).toBe(0.5);
    expect(event.cost.estimatedCostUsd).toBeCloseTo(0.0153, 8);
    expect(event.metadata.provider_reported_cost_usd).toBe(0.5);
  });
});
