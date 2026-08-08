import { vi, describe, it, expect } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import { COST_SOURCES, OPERATION_RUN_TYPES } from "../types";
import type { AiCostEvent, CostSource } from "../types";
import type { GenerationEventType } from "@/lib/visual-signature/types";

describe("tipos centrais (contrato F38.1)", () => {
  it("COST_SOURCES contém exatamente os 5 valores de D4", () => {
    expect(COST_SOURCES).toEqual([
      "provider_reported",
      "pricing_table",
      "fallback_static",
      "manual_unknown",
      "not_available",
    ]);
  });

  it("OPERATION_RUN_TYPES contém os 4 domínios de D1", () => {
    expect(OPERATION_RUN_TYPES).toEqual([
      "campaign_delivery",
      "visual_signature",
      "brand_profile",
      "theme",
    ]);
  });

  it("AiCostEvent sem cost compila (delivery) e com tokens + not_available compila (D4)", () => {
    const delivery: AiCostEvent = {
      operationRunId: "11111111-1111-4111-8111-111111111111",
      operationRunType: "campaign_delivery",
      traceId: "trace-delivery",
      storeId: "store-1",
      generationType: "campaign_pipeline",
      provider: "openai",
      model: "gpt-4o",
      attemptNumber: 1,
      durationMs: 5200,
      status: "success",
    };

    const notAvailable: AiCostEvent = {
      ...delivery,
      generationType: "campaign_copy",
      tokens: { promptTokens: 120, completionTokens: 40 },
      cost: { estimatedCostUsd: null, costSource: "not_available" },
    };

    expect(delivery.cost).toBeUndefined();
    expect(delivery.tokens).toBeUndefined();
    expect(notAvailable.cost?.costSource).toBe("not_available");
    expect(notAvailable.cost?.estimatedCostUsd).toBeNull();
    expect(notAvailable.tokens?.promptTokens).toBe(120);
  });

  it("GenerationEventType aceita os 12 valores da migration (D5)", () => {
    const types: GenerationEventType[] = [
      "campaign_pipeline",
      "campaign_copy",
      "campaign_input_validation",
      "campaign_image",
      "campaign_image_review",
      "visual_signature",
      "visual_signature_image",
      "visual_signature_validation",
      "brand_profile_without_logo",
      "brand_profile_with_logo",
      "brand_profile_vision",
      "brand_profile_text",
    ];
    expect(types).toHaveLength(12);
    // Os 6 tipos novos call-level existem (D5)
    expect(types).toContain("campaign_input_validation");
    expect(types).toContain("campaign_image_review");
    expect(types).toContain("visual_signature_image");
    expect(types).toContain("visual_signature_validation");
    expect(types).toContain("brand_profile_vision");
    expect(types).toContain("brand_profile_text");
  });
});
