// @vitest-environment node
// F46-04 (reabertura): regressÃ£o de attemptNumber por tentativa na validaÃ§Ã£o de
// assinatura visual (visual_signature_validation) â€” image_direct (attempt 0) e
// image_retry (attempt 1) devem persistir attempts distintos no envelope.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

const { mockResponsesCreate, mockUpload } = vi.hoisted(() => ({
  mockResponsesCreate: vi.fn(),
  mockUpload: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function () {
    return { responses: { create: mockResponsesCreate } };
  }),
}));

vi.mock("../persistence", () => ({
  uploadToStorage: mockUpload,
  persistSignature: vi.fn(),
}));

import { AiImageGenerator, VisualSignatureValidator } from "../ai-image-generator";
import type { AiTelemetryContext } from "@/lib/ai";

function makeTelemetry(): AiTelemetryContext {
  return {
    operationRunId: "run-1",
    operationRunType: "visual_signature",
    traceId: "trace-1",
    storeId: "store-1",
    attemptNumber: 0,
    sink: { emit: () => {} },
  };
}

const BASE_PARAMS = {
  storeId: "store-1",
  storeName: "Loja Teste",
  segment: "outros",
  brandColor: "#000000",
  tone: "profissional",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResponsesCreate.mockResolvedValue({
    output: [{ type: "image_generation_call", result: "aGVsbG8=" }],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
  });
  mockUpload.mockResolvedValue({ storagePath: "p", assetUrl: "u" });
});

describe("AiImageGenerator â€” attemptNumber por tentativa (F46-04)", () => {
  it("validator recebe telemetria com attemptNumber 0 e 1 (image_direct/image_retry)", async () => {
    const validateSpy = vi
      .spyOn(VisualSignatureValidator.prototype, "validate")
      .mockResolvedValue({ valid: true });

    const generator = new AiImageGenerator({
      promptLoader: { load: () => "prompt" } as never,
      // Seam determinÃ­stico: evita o `defaultAiGateway` (que consultaria o
      // `defaultAiModelResolver`/Supabase). O teste verifica apenas a telemetria
      // repassada ao validador.
      invoker: {
        invoke: vi.fn().mockResolvedValue({ imageBase64: "aGVsbG8=", model: "gpt-image-2" }),
        hasFallback: vi.fn().mockResolvedValue(false),
      } as never,
    });

    await generator.generate({
      ...BASE_PARAMS,
      attempt: 0,
      telemetry: makeTelemetry(),
    });
    await generator.generate({
      ...BASE_PARAMS,
      attempt: 1,
      simplifiedPrompt: true,
      telemetry: makeTelemetry(),
    });

    const seen = validateSpy.mock.calls.map((call) => call[0].telemetry?.attemptNumber);
    expect(seen).toEqual([0, 1]);

    validateSpy.mockRestore();
  });
});

describe("AiImageGenerator — F47.1 configuração dedicada x legado", () => {
  const DEDICATED = {
    mode: "dedicated" as const,
    orchestratorModel: "gpt-6-luna" as const,
    imagePreset: "sunburst_medium" as const,
    imageModel: "gpt-image-2.5-sunburst",
    imageQuality: "medium" as const,
    reasoningEffort: "low" as const,
    configVersionId: "11111111-1111-1111-1111-111111111111",
    instanceIdentity: "127.0.0.1:57781",
  };

  function makeGenerator(invoke: ReturnType<typeof vi.fn>) {
    return new AiImageGenerator({
      promptLoader: { load: () => "prompt" } as never,
      invoker: { invoke, hasFallback: vi.fn().mockResolvedValue(false) } as never,
    });
  }

  it("com snapshot dedicado envia modelo/qualidade/reasoning/metadata e persiste metadados", async () => {
    const validateSpy = vi
      .spyOn(VisualSignatureValidator.prototype, "validate")
      .mockResolvedValue({ valid: true });
    const invoke = vi.fn().mockResolvedValue({ imageBase64: "aGVsbG8=", model: "gpt-6-luna" });

    const result = await makeGenerator(invoke).generate({
      ...BASE_PARAMS,
      attempt: 0,
      telemetry: makeTelemetry(),
      visualSignatureConfig: DEDICATED,
    });

    const request = invoke.mock.calls[0][1];
    expect(request).toMatchObject({
      quality: "medium",
      imageGenerationModel: "gpt-image-2.5-sunburst",
      reasoningEffort: "low",
      metadata: {
        config_version_id: DEDICATED.configVersionId,
        visual_signature_preset: "sunburst_medium",
        responses_model: "gpt-6-luna",
        image_model: "gpt-image-2.5-sunburst",
        image_quality: "medium",
        reasoning_effort: "low",
      },
    });
    expect(result.metadata).toMatchObject({
      model: "gpt-6-luna",
      responses_model: "gpt-6-luna",
      image_model: "gpt-image-2.5-sunburst",
      image_quality: "medium",
      visual_signature_preset: "sunburst_medium",
      reasoning_effort: "low",
      config_version_id: DEDICATED.configVersionId,
    });

    validateSpy.mockRestore();
  });

  it("sem snapshot mantém o request legado byte-compatível", async () => {
    const validateSpy = vi
      .spyOn(VisualSignatureValidator.prototype, "validate")
      .mockResolvedValue({ valid: true });
    const invoke = vi.fn().mockResolvedValue({ imageBase64: "aGVsbG8=", model: "gpt-5.5" });

    const result = await makeGenerator(invoke).generate({
      ...BASE_PARAMS,
      attempt: 0,
      telemetry: makeTelemetry(),
    });

    const request = invoke.mock.calls[0][1];
    expect(request.quality).toBe("auto");
    expect(request).not.toHaveProperty("imageGenerationModel");
    expect(request).not.toHaveProperty("reasoningEffort");
    expect(request).not.toHaveProperty("metadata");
    expect(result.metadata).not.toHaveProperty("config_version_id");
    expect(result.metadata).not.toHaveProperty("image_model");

    validateSpy.mockRestore();
  });
});
