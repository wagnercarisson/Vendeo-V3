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
import { DeferredAiTelemetrySink } from "@/lib/ai";
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

describe("VisualSignatureValidator — auditoria por chamada (F47.1)", () => {
  it("validação dedicada leva credential_scope/retry ao request", async () => {
    const invoke = vi.fn().mockResolvedValue({
      content: '{"valid":true}',
      model: "gpt-6-luna",
    });
    const validator = new VisualSignatureValidator({
      invoke,
      hasFallback: vi.fn().mockResolvedValue(false),
    } as never);

    await validator.validate({
      imageBase64: Buffer.alloc(2048, 1).toString("base64"),
      storeName: "Loja Teste",
      telemetry: makeTelemetry(),
      credentialScope: "validation",
      retryUsed: true,
      retryPromptVariant: "simplified",
    });

    const request = invoke.mock.calls[0][1];
    expect(request.metadata).toEqual({
      credential_scope: "validation",
      retry_used: true,
      retry_prompt_variant: "simplified",
    });
  });

  it("validação legada permanece sem metadata adicional", async () => {
    const invoke = vi.fn().mockResolvedValue({
      content: '{"valid":true}',
      model: "gpt-5.5",
    });
    const validator = new VisualSignatureValidator({
      invoke,
      hasFallback: vi.fn().mockResolvedValue(false),
    } as never);

    await validator.validate({
      imageBase64: Buffer.alloc(2048, 1).toString("base64"),
      storeName: "Loja Teste",
      telemetry: makeTelemetry(),
    });

    expect(invoke.mock.calls[0][1]).not.toHaveProperty("metadata");
  });
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

describe("AiImageGenerator � F47.1 configura��o dedicada x legado", () => {
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
        retry_used: false,
        retry_prompt_variant: "full",
        credential_scope: "validation",
      },
    });
    expect(validateSpy.mock.calls[0][0]).toMatchObject({
      credentialScope: "validation",
      retryUsed: false,
      retryPromptVariant: "full",
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

  it("produção classifica a chave compartilhada como normal em imagem e validação", async () => {
    const validateSpy = vi.spyOn(VisualSignatureValidator.prototype, "validate").mockResolvedValue({ valid: true });
    const invoke = vi.fn().mockResolvedValue({ imageBase64: "aGVsbG8=", model: "gpt-6-luna" });
    await makeGenerator(invoke).generate({
      ...BASE_PARAMS,
      attempt: 0,
      telemetry: makeTelemetry(),
      visualSignatureConfig: { ...DEDICATED, environment: "production" },
    });

    expect(invoke.mock.calls[0][1].metadata.credential_scope).toBe("normal");
    expect(validateSpy.mock.calls[0][0].credentialScope).toBe("normal");
    validateSpy.mockRestore();
  });

  it("sem snapshot mant�m o request legado byte-compat�vel", async () => {
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

describe("AiImageGenerator - F47.1 parsing/proveniencia por tentativa", () => {
  function makeTelemetryWithSink() {
    const sink = new DeferredAiTelemetrySink(() => {});
    const telemetry: AiTelemetryContext = {
      ...makeTelemetry(),
      sink,
    };
    return { telemetry, sink };
  }

  function makeEmittingInvoker(content?: string) {
    return {
      invoke: vi.fn().mockImplementation(async (_capability, _request, telemetry) => {
        telemetry.sink.emit({
          capability: "visual_signature_image",
          protocol: "responses",
          status: "success",
          provider: "openai",
          model: "gpt-5.5",
          durationMs: 1,
          usageMeta: {
            providerUsageSource: "responses.image_generation",
            responsesModel: "gpt-5.5",
            imageGenerationTool: true,
          },
        } as never);
        return {
          imageBase64: "aGVsbG8=",
          model: "gpt-5.5",
          content,
        };
      }),
      hasFallback: vi.fn().mockResolvedValue(false),
    };
  }

  async function generateWithContent(content: string | undefined, attempt = 0) {
    const validateSpy = vi
      .spyOn(VisualSignatureValidator.prototype, "validate")
      .mockResolvedValue({ valid: true });
    const { telemetry, sink } = makeTelemetryWithSink();
    const generator = new AiImageGenerator({
      promptLoader: { load: () => "prompt" } as never,
      invoker: makeEmittingInvoker(content) as never,
    });
    const result = await generator.generate({
      ...BASE_PARAMS,
      attempt,
      simplifiedPrompt: attempt > 0,
      telemetry,
    });
    validateSpy.mockRestore();
    return { result, sink };
  }

  it("JSON valido: assinatura e envelope recebem parsed_json/model", async () => {
    const { result, sink } = await generateWithContent(
      JSON.stringify({
        visual_direction: "Minimalista",
        content_used: { store_name: true, city: false, state: false, slogan: false },
      }),
    );

    expect(result.creativeIntent?.metadata.creative_intent_parse_status).toBe("parsed_json");
    expect(result.creativeIntent?.metadata.creative_intent_source).toBe("model");
    expect(result.metadata?.creative_intent_parse_status).toBe("parsed_json");
    expect(result.metadata?.creative_intent_source).toBe("model");
    const envelope = sink.pending.find((item) => item.capability === "visual_signature_image");
    expect(envelope?.metadata).toMatchObject({
      creative_intent_parse_status: "parsed_json",
      creative_intent_source: "model",
      content_used_present: true,
    });
  });

  it("JSON ausente: fallback explicito na assinatura e no envelope; nunca modelo", async () => {
    const { result, sink } = await generateWithContent("sem json");
    expect(result.creativeIntent?.metadata).toMatchObject({
      creative_intent_parse_status: "no_json",
      creative_intent_fallback_applied: true,
      creative_intent_fallback_reason: "missing_json",
      creative_intent_source: "fallback",
    });
    expect(result.metadata?.creative_intent_source).toBe("fallback");
    const envelope = sink.pending.find((item) => item.capability === "visual_signature_image");
    expect(envelope?.metadata).toMatchObject({
      creative_intent_parse_status: "no_json",
      creative_intent_source: "fallback",
    });
  });

  it("retry com JSON ausente mantem proveniencia separada e nao sobrescreve com not_attempted", async () => {
    const { result, sink } = await generateWithContent(undefined, 1);
    expect(result.tier).toBe("image_retry");
    expect(result.creativeIntent?.metadata.creative_intent_parse_status).toBe("no_json");
    expect(result.creativeIntent?.metadata.creative_intent_source).toBe("fallback");
    const envelope = sink.pending.find((item) => item.capability === "visual_signature_image");
    expect(envelope?.metadata).toMatchObject({
      creative_intent_parse_status: "no_json",
      creative_intent_source: "fallback",
    });
    expect(envelope?.metadata?.creative_intent_parse_status).not.toBe("not_attempted");
  });

  it("array ou indicador invalido em content_used vira fallback invalid_content_used", async () => {
    const arrayResult = await generateWithContent(
      JSON.stringify({ visual_direction: "x", content_used: [] }),
    );
    expect(arrayResult.result.creativeIntent?.metadata).toMatchObject({
      creative_intent_parse_status: "incomplete_json",
      creative_intent_fallback_reason: "invalid_content_used",
      creative_intent_source: "fallback",
    });

    const invalidIndicator = await generateWithContent(
      JSON.stringify({ visual_direction: "x", content_used: { store_name: "sim" } }),
    );
    expect(invalidIndicator.result.creativeIntent?.metadata).toMatchObject({
      creative_intent_parse_status: "incomplete_json",
      creative_intent_fallback_reason: "invalid_content_used",
      creative_intent_source: "fallback",
    });
  });

  it("direcao vazia vira fallback missing_visual_direction", async () => {
    const { result } = await generateWithContent(
      JSON.stringify({ visual_direction: "   ", content_used: { store_name: true } }),
    );
    expect(result.creativeIntent?.metadata).toMatchObject({
      creative_intent_parse_status: "incomplete_json",
      creative_intent_fallback_reason: "missing_visual_direction",
      creative_intent_source: "fallback",
    });
  });
});
