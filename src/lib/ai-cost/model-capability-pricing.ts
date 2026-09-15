import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AiCapability, AiModelTarget } from "@/lib/ai/model-resolver";
import { DEFAULT_AI_MODEL_PRICING, type ModelPricing } from "./ai-model-pricing";

export interface CapacityPricingTarget {
  capability: AiCapability | string;
  target: AiModelTarget;
}

export type PricingComponent =
  | "input_tokens"
  | "output_tokens"
  | "image_generation_tool_unit"
  | "image_unit";

export interface CapacityPricingComponentStatus {
  component: PricingComponent;
  provider: string;
  model: string;
  available: boolean;
  source: "table" | "bootstrap" | "missing";
}

export interface CapacityPricingStatus {
  capability: string;
  target: AiModelTarget;
  components: CapacityPricingComponentStatus[];
  missingComponents: PricingComponent[];
  pricingCoverage: "complete" | "partial" | "missing";
  selectionAllowed: true;
}

interface PricingRow {
  provider: string;
  model: string;
  input_token_usd_per_1m: number | string | null;
  output_token_usd_per_1m: number | string | null;
  image_unit_usd: number | string | null;
  image_token_usd_per_1m: number | string | null;
}

function normalizeModel(model: string): string {
  return model.replace(/(-\d{4}-\d{2}-\d{2})+$/g, "");
}

function rowPricing(row: PricingRow): ModelPricing {
  return {
    ...(row.input_token_usd_per_1m != null ? { inputCostUsd: Number(row.input_token_usd_per_1m) } : {}),
    ...(row.output_token_usd_per_1m != null ? { outputCostUsd: Number(row.output_token_usd_per_1m) } : {}),
    ...(row.image_unit_usd != null ? { imageUnitCostUsd: Number(row.image_unit_usd) } : {}),
    ...(row.image_token_usd_per_1m != null ? { imageTokenUsdPer1M: Number(row.image_token_usd_per_1m) } : {}),
  };
}

function requiredComponents(capability: string): PricingComponent[] {
  if (capability === "campaign_image" || capability === "visual_signature_image") {
    return ["input_tokens", "output_tokens", "image_generation_tool_unit"];
  }
  if (capability === "campaign_image_edit") return ["image_unit"];
  return ["input_tokens", "output_tokens"];
}

function componentStatus(
  component: PricingComponent,
  provider: string,
  model: string,
  pricing: ModelPricing | null,
  source: "table" | "bootstrap" | "missing",
): CapacityPricingComponentStatus {
  const available = component === "input_tokens"
    ? pricing?.inputCostUsd != null
    : component === "output_tokens"
      ? pricing?.outputCostUsd != null
      : component === "image_generation_tool_unit" || component === "image_unit"
        ? pricing?.imageUnitCostUsd != null
        : false;
  return { component, provider, model, available, source: available ? source : "missing" };
}

function pricingFor(
  provider: string,
  model: string,
  rows: Map<string, { pricing: ModelPricing; source: "table" | "bootstrap" }>,
): { pricing: ModelPricing | null; source: "table" | "bootstrap" | "missing" } {
  const key = `${provider}|${normalizeModel(model)}`;
  const row = rows.get(key);
  if (row) return row;
  const bootstrap = DEFAULT_AI_MODEL_PRICING[normalizeModel(model)];
  return bootstrap ? { pricing: bootstrap, source: "bootstrap" } : { pricing: null, source: "missing" };
}

/**
 * Bulk, capacity-aware pricing visibility for the admin surface. It never
 * blocks a selection and never participates in resolveAiCost.
 */
export async function getModelCapabilityPricing(
  targets: CapacityPricingTarget[],
  client: SupabaseClient = supabaseAdmin,
): Promise<CapacityPricingStatus[]> {
  const requested = new Map<string, { provider: string; model: string }>();
  for (const target of targets) {
    requested.set(`${target.target.provider}|${normalizeModel(target.target.model)}`, { provider: target.target.provider, model: normalizeModel(target.target.model) });
    if (target.capability === "campaign_image" || target.capability === "visual_signature_image") {
      requested.set(`${target.target.provider}|responses:image_generation`, { provider: target.target.provider, model: "responses:image_generation" });
    }
  }

  const providers = [...new Set([...requested.values()].map((item) => item.provider))];
  const models = [...new Set([...requested.values()].map((item) => item.model))];
  const pricingRows = new Map<string, { pricing: ModelPricing; source: "table" | "bootstrap" }>();
  if (providers.length > 0) {
    try {
      const { data, error } = await client
        .from("ai_model_pricing")
        .select("provider, model, input_token_usd_per_1m, output_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m")
        .in("provider", providers)
        .in("model", models)
        .is("effective_until", null);
      if (!error) {
        for (const row of (data ?? []) as PricingRow[]) {
          pricingRows.set(`${row.provider}|${normalizeModel(row.model)}`, { pricing: rowPricing(row), source: "table" });
        }
      }
    } catch {
      // Missing storage is represented by bootstrap/missing components below.
    }
  }

  return targets.map((target) => {
    const components: CapacityPricingComponentStatus[] = [];
    const required = requiredComponents(target.capability);
    const modelPricing = pricingFor(target.target.provider, target.target.model, pricingRows);
    for (const component of required) {
      const sourcePricing = component === "image_generation_tool_unit"
        ? pricingFor(target.target.provider, "responses:image_generation", pricingRows)
        : modelPricing;
      components.push(componentStatus(component, target.target.provider, component === "image_generation_tool_unit" ? "responses:image_generation" : target.target.model, sourcePricing.pricing, sourcePricing.source));
    }
    const missingComponents = components.filter((component) => !component.available).map((component) => component.component);
    return {
      capability: target.capability,
      target: target.target,
      components,
      missingComponents,
      pricingCoverage: missingComponents.length === 0 ? "complete" : missingComponents.length === components.length ? "missing" : "partial",
      selectionAllowed: true as const,
    };
  });
}
