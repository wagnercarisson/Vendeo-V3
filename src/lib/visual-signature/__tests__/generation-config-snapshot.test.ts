// @vitest-environment node
// F47.3 — a configuração dedicada da Assinatura Visual é resolvida UMA vez por
// operação e o MESMO objeto é reutilizado em todas as tentativas/tonalidades.
// Nenhum banco/rede/provider: Supabase, tracker, gerador e resolução são mocks.
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockResolveVisualSignatureConfig,
  mockGenerate,
  mockStartRun,
  mockGetActiveVisualSignature,
} = vi.hoisted(() => ({
  mockResolveVisualSignatureConfig: vi.fn(),
  mockGenerate: vi.fn(),
  mockStartRun: vi.fn(),
  mockGetActiveVisualSignature: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => {
  const makeChain = (result: unknown) => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      update: () => chain,
      insert: () => chain,
      single: async () => result,
      maybeSingle: async () => result,
    };
    return chain;
  };
  const supabaseAdmin = {
    from: (table: string) =>
      makeChain(
        table === "stores"
          ? {
              data: {
                id: "550e8400-e29b-41d4-a716-446655440000",
                name: "Loja Teste",
                segment: "outros",
                brand_color: "#000000",
              },
              error: null,
            }
          : table === "store_visual_signatures"
            ? { data: { id: "sig-1", store_id: "550e8400-e29b-41d4-a716-446655440000" }, error: null }
            : { data: null, error: null },
      ),
  };
  return { supabaseAdmin };
});

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(async () => ({ userId: "u1" })),
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async () => undefined),
}));

vi.mock("@/lib/visual-signature/model-config", () => ({
  resolveVisualSignatureGenerationConfig: (...args: unknown[]) =>
    mockResolveVisualSignatureConfig(...args),
  VisualSignatureModelConfigError: class extends Error {},
}));

vi.mock("@/lib/visual-signature/ai-image-generator", () => ({
  VisualSignatureValidator: class {},
  AiImageGenerator: class {
    generate = mockGenerate;
  },
}));

vi.mock("@/lib/visual-signature/persistence", () => ({
  getActiveVisualSignature: (...args: unknown[]) => mockGetActiveVisualSignature(...args),
  getSignedVisualSignatureUrl: vi.fn(async () => null),
}));

vi.mock("@/lib/ai-cost", () => {
  class AiCostTracker {
    startRun(type: string) {
      return mockStartRun(type);
    }
    async record() {}
  }
  return { AiCostTracker };
});

vi.mock("@/lib/ai", () => ({
  createDefaultTelemetryContext: (params: Record<string, unknown>) => ({
    ...params,
    sink: params.sink ?? { emit: () => {} },
  }),
  defaultAiModelResolver: {
    resolve: vi.fn(async () => ({ primary: { model: "legacy-image-model" } })),
  },
}));

vi.mock("@/lib/economic/economic-snapshot", () => ({
  resolveEconomicSnapshot: vi.fn(async () => ({
    usdBrlRateAtGeneration: 5.2,
    creditValueBrlAtGeneration: 2.0,
  })),
}));

import { generateVariations, generateAutomatic } from "../server-actions";
import type { VisualSignatureGenerationConfig } from "../model-config";

const STORE_ID = "550e8400-e29b-41d4-a716-446655440000";

const DEDICATED_CONFIG: VisualSignatureGenerationConfig = {
  orchestratorModel: "gpt-6-luna",
  imageModel: "gpt-image-2.5-sunburst",
  imageQuality: "medium",
  imagePreset: "sunburst_medium",
  configVersionId: "11111111-1111-4111-8111-111111111111",
};

const SUCCESS_RESULT = {
  tier: "image_direct" as const,
  assetUrl: "https://example.com/vs.png",
  storagePath: "test/vs.png",
  mimeType: "image/png" as const,
  metadata: { generation_tier: "image_direct" as const },
  prompt: "prompt",
};

const FAILURE_MESSAGE = "Configuração de modelos da assinatura visual indisponível. Tente novamente.";

let runSeq = 0;

beforeEach(() => {
  vi.clearAllMocks();
  runSeq = 0;
  mockStartRun.mockImplementation((_type: string) => {
    runSeq += 1;
    return { operationRunId: `run-${runSeq}`, traceId: `trace-${runSeq}` };
  });
  mockGetActiveVisualSignature.mockResolvedValue(null);
  // Padrão das variações: attempt 0 falha (força retry), attempt 1 sucede.
  mockGenerate.mockImplementation(async (params: { attempt?: number }) => {
    if (params.attempt === 0) throw new Error("boom");
    return SUCCESS_RESULT;
  });
});

describe("generateVariations — resolução única do snapshot (F47.3)", () => {
  it("resolve uma vez e reutiliza o MESMO objeto em todas as tentativas/tonalidades", async () => {
    mockResolveVisualSignatureConfig.mockResolvedValue({
      source: "dedicated",
      config: DEDICATED_CONFIG,
    });

    const result = await generateVariations(STORE_ID);

    expect(result.success).toBe(true);
    expect(mockResolveVisualSignatureConfig).toHaveBeenCalledTimes(1);
    // 3 tonalidades × 2 tentativas
    expect(mockGenerate).toHaveBeenCalledTimes(6);
    for (const call of mockGenerate.mock.calls) {
      expect(call[0].generationConfig).toBe(DEDICATED_CONFIG);
    }
  });

  it("legado: generationConfig null em todas as chamadas e resolução única", async () => {
    mockResolveVisualSignatureConfig.mockResolvedValue({ source: "legacy", config: null });

    const result = await generateVariations(STORE_ID);

    expect(result.success).toBe(true);
    expect(mockResolveVisualSignatureConfig).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledTimes(6);
    for (const call of mockGenerate.mock.calls) {
      expect(call[0].generationConfig).toBeNull();
    }
  });

  it("falha de resolução: retorno explícito sem gerar e sem criar run", async () => {
    mockResolveVisualSignatureConfig.mockRejectedValue(new Error("boom"));

    const result = await generateVariations(STORE_ID);

    expect(result).toEqual({ success: false, error: FAILURE_MESSAGE });
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockStartRun).not.toHaveBeenCalled();
  });
});

describe("generateAutomatic — resolução única do snapshot (F47.3)", () => {
  it("sucesso na tentativa 1 usa o snapshot dedicado resolvido uma vez", async () => {
    mockResolveVisualSignatureConfig.mockResolvedValue({
      source: "dedicated",
      config: DEDICATED_CONFIG,
    });
    mockGenerate.mockResolvedValue(SUCCESS_RESULT);

    const result = await generateAutomatic(STORE_ID);

    expect(result.success).toBe(true);
    expect(mockResolveVisualSignatureConfig).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0][0].generationConfig).toBe(DEDICATED_CONFIG);
  });

  it("retry reutiliza o MESMO objeto (resolução única)", async () => {
    mockResolveVisualSignatureConfig.mockResolvedValue({
      source: "dedicated",
      config: DEDICATED_CONFIG,
    });
    mockGenerate.mockImplementation(async (params: { attempt?: number }) => {
      if (params.attempt === 0) throw new Error("boom");
      return SUCCESS_RESULT;
    });

    const result = await generateAutomatic(STORE_ID);

    expect(result.success).toBe(true);
    expect(mockResolveVisualSignatureConfig).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[0][0].generationConfig).toBe(DEDICATED_CONFIG);
    expect(mockGenerate.mock.calls[1][0].generationConfig).toBe(DEDICATED_CONFIG);
  });

  it("falha de resolução: retorno explícito sem gerar e sem criar run", async () => {
    mockResolveVisualSignatureConfig.mockRejectedValue(new Error("boom"));

    const result = await generateAutomatic(STORE_ID);

    expect(result).toEqual({ success: false, error: FAILURE_MESSAGE });
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockStartRun).not.toHaveBeenCalled();
  });
});
