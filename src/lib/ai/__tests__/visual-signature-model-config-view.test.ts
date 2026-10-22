// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

vi.mock("server-only", () => ({}));

import { buildVisualSignatureModelConfigView } from "../visual-signature-model-config-view";
import { MODEL_REGISTRY } from "../model-registry";
import type { AiModelSelectionViewModel } from "../ai-model-selection-view";
import type { VisualSignatureModelConfigRow } from "../visual-signature-model-config-service";
import type { VisualSignatureImagePricingResult } from "@/lib/ai-cost/visual-signature-pricing";

const ROW: VisualSignatureModelConfigRow = {
  scope: "visual_signature",
  environment_scope: "local_validation",
  instance_identity: "127.0.0.1:57781",
  orchestrator_model: "gpt-6-luna",
  image_preset: "sunburst_medium",
  image_model: "gpt-image-2.5-sunburst",
  image_quality: "medium",
  reasoning_effort: "low",
  config_version_id: "11111111-1111-4111-8111-111111111111",
  reason: "decisão local",
  updated_by: "22222222-2222-4222-8222-222222222222",
  updated_at: "2026-10-22T12:00:00.000Z",
};

function selectionView(configured: boolean): AiModelSelectionViewModel {
  const primary = {
    provider: "openai" as const,
    model: "gpt-5.5",
    protocol: "responses" as const,
    catalogStatus: "active" as const,
  };
  return {
    catalog: [],
    selections: [],
    defaults: MODEL_REGISTRY,
    capabilities: [
      {
        capability: "visual_signature_image",
        segment: "image",
        source: configured ? "selection" : "default",
        current: { primary, fallback: null },
        default: { primary, fallback: null },
        configured: configured ? { primary, fallback: null } : null,
        selection: null,
      },
    ],
  };
}

function pricing(status: "complete" | "partial" | "missing"): VisualSignatureImagePricingResult {
  return {
    status,
    preset: "sunburst_medium",
    model: "gpt-image-2.5-sunburst",
    quality: "medium",
    provider: "openai",
    rates: status === "missing" ? {} : { imageTokenUsdPer1M: 8 },
    toolRates: {},
    pricingVersion: status === "missing" ? null : "pricing-v1",
    missingRates: status === "complete" ? [] : ["image.imageTokenUsdPer1M"],
    historicalReferenceUsd: 0.044,
  };
}

describe("F47.1 — view model admin da Assinatura Visual", () => {
  it("expõe 2 orquestradores, 4 presets e as 8 combinações", async () => {
    const view = await buildVisualSignatureModelConfigView({
      configReader: async () => null,
      selectionViewBuilder: async () => selectionView(false),
      pricingResolver: async () => pricing("complete"),
    });

    expect(view.orchestrators).toEqual(["gpt-5.5", "gpt-6-luna"]);
    expect(view.presets.map((item) => item.preset)).toEqual([
      "flare_low",
      "flare_medium",
      "sunburst_low",
      "sunburst_medium",
    ]);
    expect(view.combinations).toHaveLength(8);
    expect(view.combinations[0]).toMatchObject({
      orchestratorModel: "gpt-5.5",
      imagePreset: "flare_low",
      model: "gpt-image-2.5-flare",
      quality: "low",
    });
  });

  it("configuração presente expõe versão, autor, data, motivo e reasoning fixo", async () => {
    const view = await buildVisualSignatureModelConfigView({
      configReader: async () => ROW,
      selectionViewBuilder: async () => selectionView(true),
      pricingResolver: async () => pricing("complete"),
      consumptionResolver: () => ({
        optedIn: false,
        effective: false,
        reason: "opt_in_disabled",
      }),
    });

    expect(view.configured).toBe(true);
    expect(view.current).toMatchObject({
      orchestratorModel: "gpt-6-luna",
      imagePreset: "sunburst_medium",
      imageModel: "gpt-image-2.5-sunburst",
      imageQuality: "medium",
      reasoningEffort: "low",
      configVersionId: ROW.config_version_id,
      updatedBy: ROW.updated_by,
      updatedAt: ROW.updated_at,
      reason: "decisão local",
    });
    expect(view.inherited.origin).toBe("human_decision");
    expect(view.consumption).toEqual({
      optedIn: false,
      effective: false,
      reason: "opt_in_disabled",
    });
  });

  it("configuração ausente mantém a seleção herdada visível", async () => {
    const view = await buildVisualSignatureModelConfigView({
      configReader: async () => null,
      selectionViewBuilder: async () => selectionView(false),
      pricingResolver: async () => pricing("complete"),
      consumptionResolver: () => ({
        optedIn: false,
        effective: false,
        reason: "not_configured",
      }),
    });

    expect(view.configured).toBe(false);
    expect(view.consumption.reason).toBe("not_configured");
    expect(view.current).toBeNull();
    expect(view.inherited).toEqual({
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
      origin: "default",
      catalogStatus: "active",
      eligible: true,
    });
  });

  it("preserva pricing partial/missing sem inventar tarifa", async () => {
    const view = await buildVisualSignatureModelConfigView({
      configReader: async () => null,
      selectionViewBuilder: async () => selectionView(false),
      pricingResolver: async (preset) =>
        preset === "flare_low" ? pricing("partial") : pricing("missing"),
    });

    expect(view.pricingByPreset.flare_low.status).toBe("partial");
    expect(view.pricingByPreset.flare_low.missingRates).toContain("image.imageTokenUsdPer1M");
    expect(view.pricingByPreset.sunburst_medium.status).toBe("missing");
    expect(view.pricingByPreset.sunburst_medium.pricingVersion).toBeNull();
  });

  it("falha de leitura não expõe erro bruto e não escreve", async () => {
    const configReader = vi.fn().mockRejectedValue(new Error("relation does not exist"));
    const view = await buildVisualSignatureModelConfigView({
      configReader,
      selectionViewBuilder: async () => selectionView(false),
      pricingResolver: async () => pricing("complete"),
    });

    expect(view.configured).toBe(false);
    expect(view.readError).toBe("Não foi possível ler a configuração da Assinatura Visual.");
    expect(view.readError).not.toContain("relation");
    expect(configReader).toHaveBeenCalledTimes(1);
  });
});
