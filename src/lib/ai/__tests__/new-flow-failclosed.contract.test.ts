import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { AiNewFlowConfigRequiredError, PersistedModelResolver } from "../persisted-model-resolver";
import { MODEL_REGISTRY, ModelRegistry } from "../model-registry";
import type { AiModelResolver } from "../model-resolver";

function resolver(): PersistedModelResolver {
  return new PersistedModelResolver({
    registry: new ModelRegistry(),
    selectionService: { getSelectionMap: async () => new Map() },
    catalogService: { getCatalogMap: async () => new Map() },
  });
}

describe("PersistedModelResolver — barreira fail-closed do novo fluxo (F56.1 D-06/D-08)", () => {
  it("resolve('campaign_product_image') sem config rejeita com código determinístico", async () => {
    await expect(resolver().resolve("campaign_product_image")).rejects.toMatchObject({
      code: "new_flow_image_model_pair_config_required",
    });
  });

  it("resolveWithSource da nova capacidade nunca retorna source 'default'", async () => {
    await expect(resolver().resolveWithSource("campaign_product_image")).rejects.toMatchObject({
      code: "new_flow_image_model_pair_config_required",
    });
  });

  it("nunca devolve o default gpt-image-2 do registry para a nova capacidade", async () => {
    let returnedDefault = false;
    try {
      const config = await resolver().resolve("campaign_product_image");
      returnedDefault = config.primary.model === "gpt-image-2";
    } catch {
      // falha fechada esperada
    }
    expect(returnedDefault).toBe(false);
  });

  it("um AiModelResolver genérico que delega ao persistido também falha fechado", async () => {
    const generic: AiModelResolver = resolver();
    await expect(generic.resolve("campaign_product_image")).rejects.toBeInstanceOf(
      AiNewFlowConfigRequiredError,
    );
  });

  it("REGRESSÃO: capacidade legada sem seleção continua fail-open (source default)", async () => {
    const result = await resolver().resolveWithSource("campaign_image");
    expect(result.source).toBe("default");
    expect(result.config).toEqual(MODEL_REGISTRY.campaign_image);
  });
});
