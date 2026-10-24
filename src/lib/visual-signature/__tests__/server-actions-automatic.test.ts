// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

const h = vi.hoisted(() => ({
  generate: vi.fn(),
  readMetadata: vi.fn(),
  updatePayloads: [] as Array<Record<string, unknown>>,
  updateError: null as null | { message: string },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn().mockResolvedValue({ userId: "user-1" }),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../persistence", () => ({
  getActiveVisualSignature: vi.fn().mockResolvedValue(null),
  getSignedVisualSignatureUrl: vi.fn().mockResolvedValue("url"),
  persistSignature: vi.fn(),
}));
vi.mock("../ai-image-generator", () => ({
  AiImageGenerator: class {
    generate = h.generate;
  },
}));
vi.mock("@/lib/ai-cost", () => ({
  AiCostTracker: class {
    startRun() {
      return { operationRunId: "run-1", traceId: "trace-1" };
    }
  },
}));
vi.mock("@/lib/economic/economic-snapshot", () => ({
  resolveEconomicSnapshot: vi.fn().mockResolvedValue({
    usdBrlRateAtGeneration: null,
    creditValueBrlAtGeneration: null,
  }),
}));
vi.mock("@/lib/ai", () => ({
  defaultAiGateway: {},
  defaultAiModelResolver: {
    resolve: vi.fn().mockResolvedValue({ primary: { model: "gpt-5.5" } }),
  },
  createFrozenVisualSignatureResolver: vi.fn(),
  createVisualSignatureValidationGateway: vi.fn(),
  loadVisualSignatureModelConfigSnapshot: vi
    .fn()
    .mockResolvedValue({ mode: "legacy" }),
  DeferredAiTelemetrySink: class {
    enrichLastIfMissing() {}
    enrichLast() {}
    async flush() {}
  },
  createDefaultTelemetryContext: vi.fn((params) => ({
    ...params,
    sink: new (class {
      emit() {}
    })(),
  })),
}));

const store = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Loja Teste",
  segment: "moda",
  brand_color: "#112233",
  tone_of_voice: "profissional",
};

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "stores") {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: store, error: null }) }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => h.readMetadata(),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          h.updatePayloads.push(payload);
          return {
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    ...payload,
                    id: "sig-1",
                    store_id: "11111111-1111-4111-8111-111111111111",
                    storage_path: "p",
                    asset_url: null,
                    type: "ai_generated",
                    generation_mode: "automatic",
                    prompt: "prompt",
                    metadata: payload.metadata,
                    created_at: "2026-10-22T00:00:00.000Z",
                    updated_at: "2026-10-22T00:00:00.000Z",
                  },
                  error: h.updateError,
                }),
              }),
            }),
          };
        },
      };
    }),
  },
}));

import { generateAutomatic } from "../server-actions";
import { loadVisualSignatureModelConfigSnapshot } from "@/lib/ai";

const creativeIntent = {
  output: {
    visual_direction: "Minimalista",
    content_used: { store_name: true, city: false, state: false, slogan: false },
  },
  metadata: {
    creative_intent_parse_status: "parsed_json",
    creative_intent_fallback_applied: false,
    creative_intent_fallback_reason: null,
    creative_intent_source: "model",
    creative_intent_schema_version: "vs-intent-v1",
    intended_palette_status: "absent",
    content_used_present: true,
  },
};

function generatorResult(overrides: Record<string, unknown> = {}) {
  return {
    tier: "image_direct",
    assetUrl: "https://example.test/asset.png",
    storagePath: "11111111-1111-4111-8111-111111111111/asset.png",
    mimeType: "image/png",
    prompt: "prompt",
    aiResponseMessage: '{"visual_direction":"Minimalista"}',
    metadata: { generation_tier: "image_direct", model: "gpt-5.5" },
    creativeIntent,
    ...overrides,
  };
}

beforeEach(() => {
  h.generate.mockReset();
  h.readMetadata.mockReset();
  h.updatePayloads.length = 0;
  h.updateError = null;
  h.readMetadata.mockResolvedValue({
    data: { metadata: { existing_key: "keep-me" } },
    error: null,
  });
});

describe("F47.1 - generateAutomatic persiste proveniencia", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("VENDEO_VS_SMOKE_NO_RETRY não remove retry do legado", async () => {
    vi.stubEnv("VENDEO_VS_SMOKE_NO_RETRY", "1");
    vi.mocked(loadVisualSignatureModelConfigSnapshot).mockResolvedValueOnce({ mode: "legacy" });
    h.generate
      .mockRejectedValueOnce(new Error("first attempt failed"))
      .mockResolvedValueOnce(generatorResult());

    const result = await generateAutomatic("11111111-1111-4111-8111-111111111111");

    expect(result.success).toBe(true);
    expect(h.generate).toHaveBeenCalledTimes(2);
  });

  it("VENDEO_VS_SMOKE_NO_RETRY remove retry somente no caminho dedicado", async () => {
    vi.stubEnv("VENDEO_VS_SMOKE_NO_RETRY", "1");
    vi.mocked(loadVisualSignatureModelConfigSnapshot).mockResolvedValueOnce({
      mode: "dedicated",
      orchestratorModel: "gpt-6-luna",
      imagePreset: "sunburst_medium",
      imageModel: "gpt-image-2.5-sunburst",
      imageQuality: "medium",
      reasoningEffort: "low",
      configVersionId: "11111111-1111-1111-1111-111111111111",
      instanceIdentity: "127.0.0.1:57781",
    });
    h.generate.mockRejectedValueOnce(new Error("first attempt failed"));

    const result = await generateAutomatic("11111111-1111-4111-8111-111111111111");

    expect(result.success).toBe(false);
    expect(h.generate).toHaveBeenCalledTimes(1);
  });

  it("preserva metadata existente, incorpora metadata do gerador e grava output parseado", async () => {
    h.generate.mockResolvedValue(generatorResult());

    const result = await generateAutomatic("11111111-1111-4111-8111-111111111111");

    expect(result.success).toBe(true);
    expect(h.updatePayloads).toHaveLength(1);
    expect(h.updatePayloads[0]).toMatchObject({
      status: "active",
      metadata: {
        existing_key: "keep-me",
        generation_tier: "image_direct",
        model: "gpt-5.5",
        creative_intent_parse_status: "parsed_json",
        creative_intent_source: "model",
        artDirectorOutput: {
          visual_direction: "Minimalista",
          content_used: {
            store_name: true,
            city: false,
            state: false,
            slogan: false,
          },
        },
      },
    });
  });

  it("retry persiste proveniencia fallback sem inventar direcao do modelo", async () => {
    h.generate
      .mockRejectedValueOnce(new Error("first attempt failed"))
      .mockResolvedValueOnce(
        generatorResult({
          tier: "image_retry",
          creativeIntent: {
            output: {
              visual_direction: "Personalizada",
              content_used: {
                store_name: true,
                city: false,
                state: false,
                slogan: false,
              },
            },
            metadata: {
              creative_intent_parse_status: "no_json",
              creative_intent_fallback_applied: true,
              creative_intent_fallback_reason: "missing_json",
              creative_intent_source: "fallback",
              creative_intent_schema_version: "vs-intent-v1",
              intended_palette_status: "absent",
              content_used_present: false,
            },
          },
        }),
      );

    const result = await generateAutomatic("11111111-1111-4111-8111-111111111111");

    expect(result.success).toBe(true);
    expect(h.updatePayloads).toHaveLength(1);
    expect(h.updatePayloads[0].metadata).toMatchObject({
      existing_key: "keep-me",
      creative_intent_parse_status: "no_json",
      creative_intent_source: "fallback",
      artDirectorOutput: { visual_direction: "Personalizada" },
    });
  });

  it("erro de leitura do metadata aborta sem sobrescrever como vazio", async () => {
    h.generate.mockResolvedValue(generatorResult());
    h.readMetadata.mockResolvedValue({
      data: null,
      error: { message: "read failed" },
    });

    const result = await generateAutomatic("11111111-1111-4111-8111-111111111111");

    expect(result.success).toBe(false);
    expect(h.updatePayloads).toHaveLength(0);
  });

  it("erro de update nÃ£o Ã© mascarado", async () => {
    h.generate.mockResolvedValue(generatorResult());
    h.updateError = { message: "update failed" };

    const result = await generateAutomatic("11111111-1111-4111-8111-111111111111");

    expect(result.success).toBe(false);
    expect(h.updatePayloads).toHaveLength(1);
  });
});




