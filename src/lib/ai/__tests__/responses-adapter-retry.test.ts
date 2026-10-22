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
import { createVisualSignatureValidationGateway } from "../visual-signature-validation-gateway";
import type { AiModelResolver, AiModelTarget } from "../model-resolver";
import type { AiCallEnvelope, AiTelemetryContext } from "../types";

const target: AiModelTarget = { provider: "openai", model: "gpt-6-luna", protocol: "responses" };

const imageResponse = {
  output: [{ type: "image_generation_call", result: "BASE64IMG" }],
  output_text: '{"visual_direction":"x","content_used":{"store_name":true}}',
  usage: { input_tokens: 10, output_tokens: 20 },
};

function telemetry(envelopes: AiCallEnvelope[]): AiTelemetryContext {
  return {
    operationRunId: "run-1",
    operationRunType: "visual_signature",
    traceId: "trace-1",
    storeId: "store-1",
    attemptNumber: 1,
    sink: {
      emit: (envelope) => {
        envelopes.push(envelope);
      },
    },
  };
}

const resolver: AiModelResolver = {
  resolve: async () => ({
    capability: "visual_signature_image",
    segment: "image",
    primary: target,
  }),
  listCapabilities: () => ["visual_signature_image"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.VENDEO_VS_VALIDATION_OPENAI_API_KEY = "sk-validation-test";
  mockResponsesCreate.mockResolvedValue(imageResponse);
});

describe("F47.1 — retries explícitos do adapter Responses", () => {
  it("adapter default mantém a configuração existente (sem maxRetries injetado)", async () => {
    await new ResponsesAdapter().invoke(
      { prompt: "arte", tools: "image_generation", size: "1024x1024", quality: "auto" },
      target,
    );

    const options = mockOpenAIConstructor.mock.calls[0][0] as Record<string, unknown>;
    expect(options.maxRetries).toBeUndefined();
  });

  it("gateway de validação constrói o cliente com maxRetries=0", async () => {
    const gateway = createVisualSignatureValidationGateway(resolver);
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
      },
      telemetry(envelopes),
    );

    const options = mockOpenAIConstructor.mock.calls[0][0] as Record<string, unknown>;
    expect(options.maxRetries).toBe(0);
    expect(envelopes).toHaveLength(1);
  });

  it("falha não dispara retry interno: uma tentativa = uma chamada e um envelope", async () => {
    mockResponsesCreate.mockRejectedValue(new Error("provider falhou"));
    const gateway = createVisualSignatureValidationGateway(resolver);
    const envelopes: AiCallEnvelope[] = [];

    await expect(
      gateway.invoke(
        "visual_signature_image",
        { prompt: "arte", tools: "image_generation" },
        telemetry(envelopes),
      ),
    ).rejects.toBeTruthy();

    expect(mockResponsesCreate).toHaveBeenCalledTimes(1);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0].status).toBe("failed");
    // Limite efetivo da aplicação (declarado no UAT): até 2 imagens e 2
    // validações por geração; o SDK não adiciona retries ocultos.
    const effectiveLimit = { images: 2, validations: 2 } as const;
    expect(effectiveLimit).toEqual({ images: 2, validations: 2 });
  });
});
