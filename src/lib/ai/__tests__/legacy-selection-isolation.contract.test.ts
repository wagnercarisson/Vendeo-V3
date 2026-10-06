import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  ALL_CAPABILITIES,
  LEGACY_SELECTION_CAPABILITIES,
  MODEL_REGISTRY,
} from "../model-registry";
import { buildAiModelSelectionView } from "../ai-model-selection-view";

type ViewDependencies = Parameters<typeof buildAiModelSelectionView>[0];

const emptyDependencies: ViewDependencies = {
  catalogService: {
    getActiveCatalogRows: async () => [],
    getCatalogMap: async () => new Map(),
  },
  selectionService: { getSelectionMap: async () => new Map() },
  pricingService: async () => [],
};

describe("legacy selection isolation — nova capacidade não vaza (F56.1 D-07/D-11)", () => {
  it("oferece EXATAMENTE as 11 capacidades legadas", async () => {
    const view = await buildAiModelSelectionView(emptyDependencies);
    expect(view.capabilities).toHaveLength(11);
    expect(view.capabilities.map((item) => item.capability).sort()).toEqual(
      [...LEGACY_SELECTION_CAPABILITIES].sort(),
    );
  });

  it("NÃO oferece campaign_product_image (não itera ALL_CAPABILITIES)", async () => {
    const view = await buildAiModelSelectionView(emptyDependencies);
    expect(view.capabilities.map((item) => item.capability)).not.toContain(
      "campaign_product_image",
    );
    expect(view.capabilities).toHaveLength(LEGACY_SELECTION_CAPABILITIES.length);
    // Guarda anti-regressão: se a view voltar a iterar `ALL_CAPABILITIES`,
    // este teste falha (12 ≠ 11).
    expect(view.capabilities.length).not.toBe(ALL_CAPABILITIES.length);
  });

  it("nenhum alvo da seleção legada referencia os modelos novos gpt-image-2.5-*", async () => {
    const view = await buildAiModelSelectionView(emptyDependencies);
    const models = view.capabilities.flatMap((item) =>
      [item.current.primary, item.current.fallback, item.default.primary, item.default.fallback]
        .filter((target) => target !== null)
        .map((target) => target!.model),
    );
    expect(models).not.toContain("gpt-image-2.5-flare");
    expect(models).not.toContain("gpt-image-2.5-sunburst");
  });

  it("a capacidade nova segue declarada em ALL_CAPABILITIES/MODEL_REGISTRY (D-11)", () => {
    expect(ALL_CAPABILITIES).toHaveLength(12);
    expect(ALL_CAPABILITIES).toContain("campaign_product_image");
    expect(MODEL_REGISTRY.campaign_product_image).toBeDefined();
  });
});
