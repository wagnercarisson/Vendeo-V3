// @vitest-environment node
// F46-04 (reabertura): regressão de attemptNumber por tentativa na validação de
// assinatura visual (visual_signature_validation) — image_direct (attempt 0) e
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

describe("AiImageGenerator — attemptNumber por tentativa (F46-04)", () => {
  it("validator recebe telemetria com attemptNumber 0 e 1 (image_direct/image_retry)", async () => {
    const validateSpy = vi
      .spyOn(VisualSignatureValidator.prototype, "validate")
      .mockResolvedValue({ valid: true });

    const generator = new AiImageGenerator({
      promptLoader: { load: () => "prompt" } as never,
      // Seam determinístico: evita o `defaultAiGateway` (que consultaria o
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

// ── F47.3: consumo do snapshot da configuração dedicada ──────────────────────
import type { AiInvocationRequest } from "@/lib/ai";
import type { VisualSignatureGenerationConfig } from "../model-config";

const IMAGE_BASE64 = Buffer.alloc(2048, 1).toString("base64");

const DEDICATED_CONFIG: VisualSignatureGenerationConfig = {
  orchestratorModel: "gpt-6-luna",
  imageModel: "gpt-image-2.5-sunburst",
  imageQuality: "medium",
  imagePreset: "sunburst_medium",
  configVersionId: "11111111-1111-4111-8111-111111111111",
};

function makeRecordingInvoker() {
  const calls: Array<{ capability: string; request: AiInvocationRequest }> = [];
  const invoke = vi.fn(async (capability: string, request: AiInvocationRequest) => {
    calls.push({ capability, request });
    if (capability === "visual_signature_validation") {
      return { content: '{"valid": true}', model: "gpt-6-luna" };
    }
    return { imageBase64: IMAGE_BASE64, model: "gpt-6-luna", content: undefined };
  });
  return {
    invoker: { invoke, hasFallback: vi.fn().mockResolvedValue(false) } as never,
    calls,
  };
}

function makeGenerator(invoker: never) {
  return new AiImageGenerator({
    promptLoader: { load: () => "prompt" } as never,
    invoker,
  });
}

describe("AiImageGenerator — configuração dedicada (F47.3)", () => {
  it("com config: request carrega qualidade/modelos e metadata registra a configuração", async () => {
    const { invoker, calls } = makeRecordingInvoker();

    const result = await makeGenerator(invoker).generate({
      ...BASE_PARAMS,
      attempt: 0,
      telemetry: makeTelemetry(),
      generationConfig: DEDICATED_CONFIG,
    });

    const imageCall = calls.find((call) => call.capability === "visual_signature_image");
    expect(imageCall).toBeDefined();
    expect(imageCall!.request).toEqual({
      prompt: expect.any(String),
      tools: "image_generation",
      size: "1024x1024",
      quality: "medium",
      signal: undefined,
      timeout: expect.any(Number),
      orchestratorModel: "gpt-6-luna",
      imageGenerationModel: "gpt-image-2.5-sunburst",
    });

    const metadata = result.metadata;
    expect(metadata).toMatchObject({
      generation_tier: "image_direct",
      model: "gpt-6-luna",
      orchestrator_model: "gpt-6-luna",
      image_model: "gpt-image-2.5-sunburst",
      image_quality: "medium",
      visual_signature_config_version_id: DEDICATED_CONFIG.configVersionId,
    });
  });

  it("a validação (visual_signature_validation) NÃO recebe os overrides", async () => {
    const { invoker, calls } = makeRecordingInvoker();

    await makeGenerator(invoker).generate({
      ...BASE_PARAMS,
      attempt: 0,
      telemetry: makeTelemetry(),
      generationConfig: DEDICATED_CONFIG,
    });

    const validationCall = calls.find(
      (call) => call.capability === "visual_signature_validation",
    );
    expect(validationCall).toBeDefined();
    expect(validationCall!.request).not.toHaveProperty("orchestratorModel");
    expect(validationCall!.request).not.toHaveProperty("imageGenerationModel");
    expect(validationCall!.request).not.toHaveProperty("quality");
  });

  it.each([
    ["ausente", undefined],
    ["null", null],
  ])("sem config (%s): request legado e metadata null/auto", async (_label, generationConfig) => {
    const { invoker, calls } = makeRecordingInvoker();

    const result = await makeGenerator(invoker).generate({
      ...BASE_PARAMS,
      attempt: 0,
      telemetry: makeTelemetry(),
      generationConfig: generationConfig as VisualSignatureGenerationConfig | null | undefined,
    });

    const imageCall = calls.find((call) => call.capability === "visual_signature_image");
    expect(imageCall!.request).toEqual({
      prompt: expect.any(String),
      tools: "image_generation",
      size: "1024x1024",
      quality: "auto",
      signal: undefined,
      timeout: expect.any(Number),
    });
    expect(imageCall!.request).not.toHaveProperty("orchestratorModel");
    expect(imageCall!.request).not.toHaveProperty("imageGenerationModel");

    expect(result.metadata).toMatchObject({
      generation_tier: "image_direct",
      model: "gpt-6-luna",
      image_model: null,
      image_quality: "auto",
      visual_signature_config_version_id: null,
    });
  });
});
