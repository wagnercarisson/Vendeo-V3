// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResponsesCreate, mockOpenAIConstructor } = vi.hoisted(() => ({
  mockResponsesCreate: vi.fn(),
  mockOpenAIConstructor: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function (options: unknown) {
    mockOpenAIConstructor(options);
    return { responses: { create: mockResponsesCreate } };
  }),
}));

import { ResponsesAdapter } from "../adapters/responses";
import { AiGateway } from "../gateway";
import type { AiModelResolver, AiModelTarget } from "../model-resolver";
import type { AiCallEnvelope, AiTelemetryContext } from "../types";

const target: AiModelTarget = { provider: "openai", model: "gpt-6-luna", protocol: "responses" };

const imageResponse = {
  output: [{ type: "image_generation_call", result: "BASE64IMG" }],
  output_text: '{"visual_direction":"x","content_used":{"store_name":true}}',
  usage: { input_tokens: 10, output_tokens: 20 },
};

function makeTelemetry(envelopes: AiCallEnvelope[]): AiTelemetryContext {
  return {
    operationRunId: "run-1",
    operationRunType: "visual_signature",
    traceId: "trace-1",
    storeId: "store-1",
    attemptNumber: 0,
    sink: { emit: (envelope) => envelopes.push(envelope) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "sk-test";
  mockResponsesCreate.mockResolvedValue(imageResponse);
});

describe("F47.1 — wire aditivo da tool image_generation", () => {
  it("payload legado permanece byte-compatível (sem model, quality auto, sem reasoning)", async () => {
    await new ResponsesAdapter().invoke(
      { prompt: "arte", tools: "image_generation", size: "1024x1024", quality: "auto" },
      target,
    );

    const params = mockResponsesCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(params.tools).toEqual([
      { type: "image_generation", size: "1024x1024", quality: "auto" },
    ]);
    expect(params).not.toHaveProperty("reasoning");
  });

  it("preset Sunburst Medium envia model/quality explícitos e reasoning low", async () => {
    const result = await new ResponsesAdapter().invoke(
      {
        prompt: "arte",
        tools: "image_generation",
        size: "1024x1024",
        quality: "medium",
        imageGenerationModel: "gpt-image-2.5-sunburst",
        reasoningEffort: "low",
      },
      target,
    );

    const params = mockResponsesCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(params.tools).toEqual([
      {
        type: "image_generation",
        model: "gpt-image-2.5-sunburst",
        size: "1024x1024",
        quality: "medium",
      },
    ]);
    expect(params.tool_choice).toEqual({ type: "image_generation" });
    expect(params.reasoning).toEqual({ effort: "low" });
    expect(result.usageMeta?.responsesModel).toBe("gpt-6-luna");
    expect(result.usageMeta?.imageGenerationModel).toBe("gpt-image-2.5-sunburst");
    expect(result.model).toBe("gpt-6-luna");
  });

  it("legado mantém usageMeta sem imageGenerationModel", async () => {
    const result = await new ResponsesAdapter().invoke(
      { prompt: "arte", tools: "image_generation", size: "1024x1024", quality: "auto" },
      target,
    );
    expect(result.usageMeta?.responsesModel).toBe("gpt-6-luna");
    expect(result.usageMeta?.imageGenerationModel).toBeUndefined();
  });
});

describe("F47.1 — metadata no envelope (sem forjar campos canônicos)", () => {
  it("propaga metadata e um único envelope por tentativa", async () => {
    const resolver: AiModelResolver = {
      resolve: async () => ({
        capability: "visual_signature_image",
        segment: "image",
        primary: target,
      }),
      listCapabilities: () => ["visual_signature_image"],
    };
    const gateway = new AiGateway(resolver, { get: () => new ResponsesAdapter() });
    const envelopes: AiCallEnvelope[] = [];

    await gateway.invoke(
      "visual_signature_image",
      {
        prompt: "arte",
        tools: "image_generation",
        size: "1024x1024",
        quality: "medium",
        imageGenerationModel: "gpt-image-2.5-sunburst",
        reasoningEffort: "low",
        metadata: {
          config_version_id: "version-1",
          visual_signature_preset: "sunburst_medium",
          // Tentativas de forjar campos canônicos — devem ser descartadas.
          capability: "campaign_copy",
          model: "forged-model",
          status: "failed",
          provider: "gemini",
          usageMeta: { forged: true },
        },
      },
      makeTelemetry(envelopes),
    );

    expect(envelopes).toHaveLength(1);
    const envelope = envelopes[0];
    expect(envelope.capability).toBe("visual_signature_image");
    expect(envelope.status).toBe("success");
    expect(envelope.model).toBe("gpt-6-luna");
    expect(envelope.metadata).toEqual({
      config_version_id: "version-1",
      visual_signature_preset: "sunburst_medium",
    });
  });
});
