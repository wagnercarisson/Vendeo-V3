// @vitest-environment node
/**
 * F47.1 — integração cross-entry-point com fakes.
 *
 * Nenhum provider, banco remoto ou crédito é acionado. O objetivo é provar que
 * a configuração congelada chega aos três entry points e que o retry reutiliza
 * o mesmo snapshot, enquanto uma nova geração relê a configuração vigente.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

const h = vi.hoisted(() => ({
  generate: vi.fn(),
  load: vi.fn(),
  readMetadata: vi.fn(),
  updatePayloads: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn().mockResolvedValue({ userId: "user-1" }),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/lib/visual-signature/persistence", () => ({
  getActiveVisualSignature: vi.fn().mockResolvedValue(null),
  getSignedVisualSignatureUrl: vi.fn().mockResolvedValue("url"),
  persistSignature: vi.fn(),
}));
vi.mock("../../src/lib/visual-signature/ai-image-generator", () => ({
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
  createFrozenVisualSignatureResolver: vi.fn(() => ({})),
  createVisualSignatureValidationGateway: vi.fn(() => ({})),
  loadVisualSignatureModelConfigSnapshot: h.load,
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
          eq: () => ({ maybeSingle: async () => h.readMetadata() }),
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
                    store_id: store.id,
                    storage_path: "p",
                    asset_url: null,
                    type: "ai_generated",
                    generation_mode: "automatic",
                    prompt: "prompt",
                    metadata: payload.metadata,
                    created_at: "2026-10-22T00:00:00.000Z",
                    updated_at: "2026-10-22T00:00:00.000Z",
                  },
                  error: null,
                }),
              }),
            }),
          };
        },
      };
    }),
  },
}));

import { generateAutomatic, generateVariations } from "../../src/lib/visual-signature/server-actions";
import { createFrozenVisualSignatureResolver } from "../../src/lib/ai/visual-signature-frozen-resolver";
import type { AiModelResolver } from "../../src/lib/ai/model-resolver";
import type { VisualSignatureModelConfigSnapshot } from "../../src/lib/ai/visual-signature-model-config-service";

const SNAPSHOT_A: VisualSignatureModelConfigSnapshot = {
  mode: "dedicated",
  orchestratorModel: "gpt-5.5",
  imagePreset: "sunburst_medium",
  imageModel: "gpt-image-2.5-sunburst",
  imageQuality: "medium",
  reasoningEffort: "low",
  configVersionId: "11111111-1111-4111-8111-111111111111",
  instanceIdentity: "127.0.0.1:57781",
};

const SNAPSHOT_B: VisualSignatureModelConfigSnapshot = {
  ...SNAPSHOT_A,
  orchestratorModel: "gpt-6-luna",
  configVersionId: "22222222-2222-4222-8222-222222222222",
};

function result(overrides: Record<string, unknown> = {}) {
  return {
    tier: "image_direct",
    assetUrl: "https://example.test/asset.png",
    storagePath: "p",
    mimeType: "image/png",
    prompt: "prompt",
    metadata: { generation_tier: "image_direct" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.updatePayloads.length = 0;
  h.readMetadata.mockResolvedValue({
    data: { metadata: { existing_key: "keep-me" } },
    error: null,
  });
});

describe("F47.1 — configuração congelada nos entry points", () => {
  it("generateVariations usa o mesmo snapshot nas 3 variações e no retry", async () => {
    let failFirst = true;
    h.generate.mockImplementation(async (params: { tone: string; attempt: number }) => {
      if (params.tone === "profissional" && params.attempt === 0 && failFirst) {
        failFirst = false;
        throw new Error("falha transitória fake");
      }
      return result({ tier: params.attempt > 0 ? "image_retry" : "image_direct" });
    });
    h.load.mockResolvedValueOnce(SNAPSHOT_A);

    const first = await generateVariations(store.id);

    expect(first.success).toBe(true);
    const calls = h.generate.mock.calls.map((call) => call[0]);
    expect(calls).toHaveLength(4); // profissional(0,1) + moderno + elegante
    expect(calls.every((call) => call.visualSignatureConfig === SNAPSHOT_A)).toBe(true);
    expect(calls.map((call) => call.attempt)).toEqual([0, 1, 0, 0]);

    h.generate.mockResolvedValue(result());
    h.load.mockResolvedValueOnce(SNAPSHOT_B);
    const second = await generateVariations(store.id);

    expect(second.success).toBe(true);
    const secondCalls = h.generate.mock.calls.slice(4).map((call) => call[0]);
    expect(secondCalls).toHaveLength(3);
    expect(secondCalls.every((call) => call.visualSignatureConfig === SNAPSHOT_B)).toBe(true);
    expect(h.load).toHaveBeenCalledTimes(2);
  });

  it("generateAutomatic reutiliza o snapshot no retry e relê em nova geração", async () => {
    let failFirst = true;
    h.generate.mockImplementation(async (params: { attempt: number }) => {
      if (params.attempt === 0 && failFirst) {
        failFirst = false;
        throw new Error("falha transitória fake");
      }
      return result({ tier: params.attempt > 0 ? "image_retry" : "image_direct" });
    });
    h.load.mockResolvedValueOnce(SNAPSHOT_A);

    const first = await generateAutomatic(store.id);
    expect(first.success).toBe(true);
    const firstCalls = h.generate.mock.calls.map((call) => call[0]);
    expect(firstCalls).toHaveLength(2);
    expect(firstCalls.every((call) => call.visualSignatureConfig === SNAPSHOT_A)).toBe(true);

    h.generate.mockResolvedValue(result());
    h.load.mockResolvedValueOnce(SNAPSHOT_B);
    const second = await generateAutomatic(store.id);

    expect(second.success).toBe(true);
    const secondCalls = h.generate.mock.calls.slice(2).map((call) => call[0]);
    expect(secondCalls).toHaveLength(1);
    expect(secondCalls[0].visualSignatureConfig).toBe(SNAPSHOT_B);
    expect(h.load).toHaveBeenCalledTimes(2);
  });

  it("a rota generate-without-logo recebe o snapshot antes das tentativas e o reusa no retry", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts",
      ),
      "utf8",
    );
    const loadAt = source.indexOf("loadVisualSignatureModelConfigSnapshot()");
    const firstService = source.indexOf("new StoreIdentityArtDirectorService");
    const retryGenerator = source.indexOf("new AiImageGenerator", firstService);
    const configPasses = source.match(/visualSignatureConfig,/g) ?? [];

    expect(loadAt).toBeGreaterThan(-1);
    expect(firstService).toBeGreaterThan(loadAt);
    expect(retryGenerator).toBeGreaterThan(firstService);
    expect(configPasses.length).toBeGreaterThanOrEqual(2);
  });

  it("outras capacidades delegam ao resolver padrão e não herdam o preset da VS", () => {
    const fallbackResolver: AiModelResolver = {
      resolve: async (capability) => ({
        capability,
        segment: "image",
        primary: { provider: "openai", model: "default-model", protocol: "responses" },
      }),
      listCapabilities: () => ["campaign_image", "campaign_image_edit", "campaign_product_image"],
    };
    const resolver = createFrozenVisualSignatureResolver({
      snapshot: SNAPSHOT_A,
      fallbackResolver,
    });

    return Promise.all([
      resolver.resolve("visual_signature_image").then((config) => {
        expect(config.primary.model).toBe("gpt-5.5");
      }),
      resolver.resolve("campaign_image").then((config) => {
        expect(config.primary.model).toBe("default-model");
      }),
      resolver.resolve("campaign_image_edit").then((config) => {
        expect(config.primary.model).toBe("default-model");
      }),
      resolver.resolve("campaign_product_image").then((config) => {
        expect(config.primary.model).toBe("default-model");
      }),
      resolver.resolve("visual_signature_validation").then((config) => {
        expect(config.primary.model).toBe("default-model");
      }),
    ]);
  });
});
