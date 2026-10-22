// @vitest-environment node
/**
 * F47.1 — regressões de contrato dos planos 02–04.
 *
 * Zero provider/banco remoto: os testes usam funções puras, schemas e mocks.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetModelPricing } = vi.hoisted(() => ({
  mockGetModelPricing: vi.fn(),
}));

vi.mock("@/lib/ai-cost/ai-model-pricing", () => ({
  getModelPricing: mockGetModelPricing,
}));

import { parseCreativeIntent } from "../../src/lib/visual-signature/creative-intent";
import { computeVisualSignatureCost } from "../../src/lib/ai-cost/visual-signature-usage";
import { resolveAiCost } from "../../src/lib/ai-cost/cost-estimator";
import { resolveLocalSupabaseEndpoints } from "../../src/lib/visual-signature/local-validation/environment-contract";
import {
  VisualSignatureModelConfigResetSchema,
  VisualSignatureModelConfigUpdateSchema,
} from "../../src/lib/admin/schemas";
import { CAPABILITY_GENERATION_TYPE } from "../../src/lib/ai/generation-type-map";
import { LEGACY_SELECTION_CAPABILITIES } from "../../src/lib/ai/model-registry";

beforeEach(() => {
  mockGetModelPricing.mockReset();
  mockGetModelPricing.mockResolvedValue(null);
  vi.unstubAllEnvs();
});

describe("F47.1 — isolamento e parsing", () => {
  it("recusa URL Supabase de produção mesmo com identidade aparentemente válida", () => {
    expect(() =>
      resolveLocalSupabaseEndpoints("https://abcdefghijklmnop.supabase.co"),
    ).toThrow();
  });

  it("mantém parsing e fallback separados: ausência de JSON nunca vira direção do modelo", () => {
    const parsed = parseCreativeIntent("sem json");
    expect(parsed.metadata.creative_intent_parse_status).toBe("no_json");
    expect(parsed.metadata.creative_intent_fallback_applied).toBe(true);
    expect(parsed.metadata.creative_intent_source).toBe("fallback");
    expect(parsed.output.visual_direction).toBe("Personalizada");
  });

  it("preserva as capacidades legadas e o mapa de geração de campanhas", () => {
    expect(LEGACY_SELECTION_CAPABILITIES).toContain("visual_signature_image");
    expect(LEGACY_SELECTION_CAPABILITIES).toContain("campaign_image");
    expect(LEGACY_SELECTION_CAPABILITIES).toContain("campaign_image_edit");
    expect(CAPABILITY_GENERATION_TYPE.campaign_image).toBe("campaign_image");
    expect(CAPABILITY_GENERATION_TYPE.campaign_image_edit).toBe("campaign_image");
    expect(CAPABILITY_GENERATION_TYPE.campaign_product_image).toBe("campaign_image");
    expect(CAPABILITY_GENERATION_TYPE.visual_signature_validation).toBe(
      "visual_signature_validation",
    );
  });
});

describe("F47.1 — custo sem dupla contagem", () => {
  it("reasoning/cache/imagem são precificados uma única vez no breakdown completo", () => {
    const result = computeVisualSignatureCost({
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        cachedInputTokens: 200,
        inputTextTokens: 800,
        inputImageTokens: 200,
        cachedTextTokens: 100,
        cachedImageTokens: 100,
        outputTextTokens: 300,
        outputImageTokens: 200,
        reasoningTokens: 100,
      },
      orchestratorRates: {
        inputTextUsdPer1M: 5,
        cachedTextUsdPer1M: 0.5,
        outputTextUsdPer1M: 30,
      },
      imageRates: {
        inputImageUsdPer1M: 8,
        outputImageUsdPer1M: 30,
        cachedImageUsdPer1M: 1,
      },
    });

    expect(result.costCoverage).toBe("complete");
    expect(result.components.reasoning).toBeUndefined();
    expect(result.components.input_text?.tokens).toBe(700);
    expect(result.components.cached_text?.tokens).toBe(100);
    expect(result.components.output_text?.tokens).toBe(300);
    expect(result.components.output_image?.tokens).toBe(200);
  });

  it("caminho com preset não usa 0.065 nem fallback_static quando falta pricing", async () => {
    vi.stubEnv("VENDEO_AI_FALLBACK_COST_USD", "0.15");

    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-6-luna",
      usage: { promptTokens: 1000, completionTokens: 500 },
      generationType: "visual_signature_image",
      visualSignaturePreset: "sunburst_medium",
      imageGenerationModel: "gpt-image-2.5-sunburst",
      imageQuality: "medium",
    });

    expect(result.costSource).not.toBe("fallback_static");
    expect(result.estimatedCostUsd).not.toBe(0.065);
    expect(result.costCoverage).not.toBe("complete");
  });
});

describe("F47.1 — admin e retries", () => {
  it("schema admin aceita somente orquestrador/preset/motivo/operationId", () => {
    const valid = {
      orchestratorModel: "gpt-6-luna",
      imagePreset: "sunburst_medium",
      reason: "decisão local",
      operationId: "11111111-1111-4111-8111-111111111111",
    };
    expect(VisualSignatureModelConfigUpdateSchema.safeParse(valid).success).toBe(true);
    expect(
      VisualSignatureModelConfigUpdateSchema.safeParse({
        ...valid,
        imageModel: "forged",
        imageQuality: "high",
        reasoningEffort: "high",
      }).success,
    ).toBe(false);
    expect(
      VisualSignatureModelConfigResetSchema.safeParse({ reason: "", operationId: valid.operationId })
        .success,
    ).toBe(false);
  });

  it("gateway de validação e adapter provam maxRetries=0 e default intacto", () => {
    const gatewaySource = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/ai/visual-signature-validation-gateway.ts",
      ),
      "utf8",
    );
    const adapterSource = readFileSync(
      path.resolve(process.cwd(), "src/lib/ai/adapters/responses.ts"),
      "utf8",
    );
    expect(gatewaySource).toMatch(/maxRetries:\s*0/);
    expect(adapterSource).toMatch(/maxRetries\?: number/);
    expect(adapterSource).toMatch(/\.\.\.this\.clientOptions/);
  });
});
