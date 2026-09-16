import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockResolveAiCost, mockRecord } = vi.hoisted(() => ({
  mockResolveAiCost: vi.fn(),
  mockRecord: vi.fn(),
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

import { estimateLabCampaignImageCost } from "../lab-cost-estimate";
import type { CostResolution } from "@/lib/ai-cost/types";

/**
 * F48.1 (D11/D14/DV-2) — estimativa de custo do laboratório em modo leitura.
 */

const FULL_COST: CostResolution = {
  estimatedCostUsd: 0.0421,
  costSource: "pricing_table",
  pricingVersion: "11111111-1111-4111-8111-111111111111",
  costFormulaVersion: "responses_image_generation_v2",
  textComponentUsd: 0.0121,
  imageToolComponentUsd: 0.03,
  imageToolPricingProvider: "openai",
  imageToolPricingModel: "responses:image_generation",
  imageToolPricingVersion: "22222222-2222-4222-8222-222222222222",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue(FULL_COST);
  mockRecord.mockResolvedValue(undefined);
});

describe("estimateLabCampaignImageCost — leitura pura, sem consumo", () => {
  it("chama resolveAiCost com imageGenerationTool e generationType campaign_image, sem usage", async () => {
    const cost = await estimateLabCampaignImageCost({ provider: "openai", model: "gpt-5.5" });

    expect(mockResolveAiCost).toHaveBeenCalledTimes(1);
    expect(mockResolveAiCost).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-5.5",
      imageGenerationTool: true,
      generationType: "campaign_image",
    });

    // `usage` nunca é enviado: é estimativa de plano, não consumo real.
    const callArg = mockResolveAiCost.mock.calls[0][0] as Record<string, unknown>;
    expect("usage" in callArg).toBe(false);
    expect("manualCostUsd" in callArg).toBe(false);
    expect("providerReportedCostUsd" in callArg).toBe(false);
  });

  it("devolve a CostResolution do resolvedor sem alterar nenhum campo", async () => {
    const cost = await estimateLabCampaignImageCost({ provider: "gemini", model: "gemini-3-pro" });

    expect(cost).toEqual(FULL_COST);
    expect(cost.costSource).toBe("pricing_table");
    expect(cost.imageToolComponentUsd).toBe(0.03);
  });

  it("nunca aciona o tracker de custos (nenhum generation_event)", async () => {
    await estimateLabCampaignImageCost({ provider: "openai", model: "gpt-5.5" });

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("propaga a CostResolution de indisponibilidade sem lançar", async () => {
    const unavailable: CostResolution = { estimatedCostUsd: null, costSource: "not_available" };
    mockResolveAiCost.mockResolvedValue(unavailable);

    const cost = await estimateLabCampaignImageCost({ provider: "openai", model: "gpt-5.5" });

    expect(cost).toEqual(unavailable);
    expect(cost.estimatedCostUsd).toBeNull();
  });
});
