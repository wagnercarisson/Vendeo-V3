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
