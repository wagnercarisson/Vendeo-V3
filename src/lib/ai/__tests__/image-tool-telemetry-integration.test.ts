// @vitest-environment node
// F46-05 (reabertura): teste INTEGRADO adapter → gateway → sink → estimador.
// Garante que uma imagem bem-sucedida SEM usage chega ao estimador com
// `imageGenerationTool: true` (o marcador não pode depender da presença de usage).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

const { mockResponsesCreate, mockResolveAiCost, mockRecord } = vi.hoisted(() => ({
  mockResponsesCreate: vi.fn(),
  mockResolveAiCost: vi.fn(),
  mockRecord: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return { responses: { create: mockResponsesCreate } };
  }),
}));

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    record = mockRecord;
    startRun = vi.fn();
  },
}));

import { AiGateway } from "../gateway";
import { ModelRegistry } from "../model-registry";
import { ResponsesAdapter } from "../adapters/responses";
import { DefaultAiTelemetrySink } from "../telemetry-sink";
import type { AiAdapterRegistry, AiTelemetryContext } from "../types";

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue({ estimatedCostUsd: 0.065, costSource: "pricing_table" });
  mockRecord.mockResolvedValue(undefined);
});

describe("Integração adapter → gateway → sink → estimador (F46-05)", () => {
  it("campaign_image com imagem e SEM usage chega ao estimador com imageGenerationTool=true", async () => {
    mockResponsesCreate.mockResolvedValue({
      output: [{ type: "image_generation_call", result: "BASE64IMG" }],
      output_text: "",
      // sem `usage`
    });

    const adapters: AiAdapterRegistry = {
      get: (protocol) => (protocol === "responses" ? new ResponsesAdapter() : undefined),
    };
    const gateway = new AiGateway(new ModelRegistry(), adapters);

    const sink = new DefaultAiTelemetrySink({
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: "store-1",
      attemptNumber: 0,
    });
    const telemetry: AiTelemetryContext = {
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: "store-1",
      attemptNumber: 0,
      sink,
    };

    const result = await gateway.invoke(
      "campaign_image",
      { prompt: "gerar arte", tools: "image_generation", size: "1024x1024", quality: "high" },
      telemetry,
    );

    expect(result.imageBase64).toBe("BASE64IMG");
    expect(result.usage).toBeUndefined();
    expect(mockResolveAiCost).toHaveBeenCalledTimes(1);
    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-5.5",
        usage: undefined,
        imageGenerationTool: true,
        generationType: "campaign_image",
      }),
    );
    expect(mockRecord).toHaveBeenCalledTimes(1);
  });
});
