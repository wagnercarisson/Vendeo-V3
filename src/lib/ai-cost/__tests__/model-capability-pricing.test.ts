import { describe, expect, it, vi } from "vitest";
import { getModelCapabilityPricing } from "../model-capability-pricing";
import { resolveAiCost } from "../cost-estimator";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const target = (capability: string, provider = "openai", model = "gpt-4o", protocol: "chat-completions" | "responses" | "images" = "chat-completions") => ({ capability, target: { provider: provider as "openai", model, protocol } });

function clientWith(rows: unknown[]) {
  const select = vi.fn().mockReturnThis();
  const inFilter = vi.fn().mockReturnThis();
  const is = vi.fn().mockResolvedValue({ data: rows, error: null });
  return { client: { from: vi.fn(() => ({ select, in: inFilter, is })) }, select, inFilter, is };
}

describe("capacity-aware model pricing", () => {
  it("faz uma consulta bulk e sinaliza tokens ausentes sem bloquear seleção", async () => {
    const { client, inFilter } = clientWith([]);
    const [status] = await getModelCapabilityPricing([target("campaign_copy", "openai", "custom-model")], client as never);
    expect(status.missingComponents).toEqual(["input_tokens", "output_tokens"]);
    expect(status.pricingCoverage).toBe("missing");
    expect(status.selectionAllowed).toBe(true);
    expect(inFilter).toHaveBeenCalledTimes(2);
  });

  it("usa bootstrap quando completo e não sinaliza modelo textual", async () => {
    const { client } = clientWith([]);
    const [status] = await getModelCapabilityPricing([target("campaign_copy")], client as never);
    expect(status.pricingCoverage).toBe("complete");
    expect(status.missingComponents).toEqual([]);
    expect(status.components.every((component) => component.source === "bootstrap")).toBe(true);
  });

  it("exige modelo e tool para Responses image_generation", async () => {
    const { client } = clientWith([
      { provider: "openai", model: "gpt-5.5", input_token_usd_per_1m: 5, output_token_usd_per_1m: 30, image_unit_usd: null, image_token_usd_per_1m: null },
      { provider: "openai", model: "responses:image_generation", input_token_usd_per_1m: null, output_token_usd_per_1m: null, image_unit_usd: null, image_token_usd_per_1m: null },
    ]);
    const [status] = await getModelCapabilityPricing([target("campaign_image", "openai", "gpt-5.5", "responses")], client as never);
    expect(status.missingComponents).toEqual(["image_generation_tool_unit"]);
    expect(status.pricingCoverage).toBe("partial");
  });

  it("exige image_unit para campaign_image_edit", async () => {
    const { client } = clientWith([{ provider: "openai", model: "custom-edit", input_token_usd_per_1m: 1, output_token_usd_per_1m: 1, image_unit_usd: null, image_token_usd_per_1m: null }]);
    const [status] = await getModelCapabilityPricing([target("campaign_image_edit", "openai", "custom-edit", "images")], client as never);
    expect(status.missingComponents).toEqual(["image_unit"]);
  });

  it("normaliza modelos versionados e avalia múltiplas combinações em uma leitura", async () => {
    const { client, inFilter } = clientWith([
      { provider: "openai", model: "gpt-4o", input_token_usd_per_1m: 2.5, output_token_usd_per_1m: 10, image_unit_usd: null, image_token_usd_per_1m: null },
    ]);
    const statuses = await getModelCapabilityPricing([
      target("campaign_copy", "openai", "gpt-4o-2024-08-06"),
      target("brand_profile_text", "openai", "gpt-4o"),
    ], client as never);
    expect(statuses).toHaveLength(2);
    expect(statuses.every((status) => status.pricingCoverage === "complete")).toBe(true);
    expect(inFilter).toHaveBeenCalledTimes(2);
  });

  it("preserva a cadeia existente de resolveAiCost para custo reportado", async () => {
    const result = await resolveAiCost({ provider: "openai", model: "gpt-4o", providerReportedCostUsd: 0.42 });
    expect(result.costSource).toBe("provider_reported");
    expect(result.estimatedCostUsd).toBe(0.42);
  });
});
