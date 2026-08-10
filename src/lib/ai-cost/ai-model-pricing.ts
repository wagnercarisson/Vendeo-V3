import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Bootstrap de preços em código (D8) — espelha EXATAMENTE os 7 seeds da migration
 * 38-1-01 (Bloco 6). Fonte de verdade quando a tabela `ai_model_pricing` não tem
 * linha vigente para o provider+model (fail-open: a geração nunca é bloqueada por
 * preço — D8/D7).
 *
 * Modelos só de imagem (gpt-image-2, dall-e-3) carregam apenas `imageUnitCostUsd` —
 * NÃO inventar `inputCostUsd`/`outputCostUsd` = 0 (espelha o CHECK
 * chk_ai_model_pricing_at_least_one_price).
 */
export interface ModelPricing {
  inputCostUsd?: number;
  outputCostUsd?: number;
  cachedInputCostUsd?: number;
  imageUnitCostUsd?: number;
  imageTokenUsdPer1M?: number;
}

/** Bootstrap 7 seeds (D8): valores verificáveis da migration, não canonizados. */
export const DEFAULT_AI_MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { inputCostUsd: 2.5, outputCostUsd: 10.0 },
  "gpt-4o-mini": { inputCostUsd: 0.15, outputCostUsd: 0.6 },
  "gpt-5.5": { inputCostUsd: 5.0, cachedInputCostUsd: 0.5, outputCostUsd: 30.0 },
  "gpt-image-2": { imageUnitCostUsd: 0.04 },
  "dall-e-3": { imageUnitCostUsd: 0.04 },
  "gemini-2.0-flash": { inputCostUsd: 0.1, outputCostUsd: 0.4 },
  "gemini-3.1-flash-lite": { inputCostUsd: 0.1, outputCostUsd: 0.4 },
  // F38.1 fechamento — tool image_generation da Responses API (OpenAI). Valor
  // PROVISÓRIO calibrado (2026-08-09, UATs dashboard/Costs CSV) — não é custo real.
  // Fonte preferida é a linha na tabela ai_model_pricing (source_note documenta o
  // ajuste); este bootstrap é o fail-open (D8). Providers futuros: provider +
  // model "image_generation:<caminho>".
  "responses:image_generation": { imageUnitCostUsd: 0.065 },
};

/**
 * Strip de sufixo de data — cópia local (evita dependência circular com
 * cost-estimator.ts, que mantém a própria cópia).
 *   gpt-5.5-2026-04-23 → gpt-5.5
 */
function normalizeModel(model: string): string {
  return model.replace(/(-\d{4}-\d{2}-\d{2})+$/g, "");
}

interface PricingRow {
  id: string;
  input_token_usd_per_1m: number | null;
  output_token_usd_per_1m: number | null;
  cached_input_token_usd_per_1m: number | null;
  image_unit_usd: number | null;
  image_token_usd_per_1m: number | null;
}

/**
 * Mapper linha → ModelPricing (snake→camel). Valida "ao menos uma dimensão"
 * (espelha o CHECK chk_ai_model_pricing_at_least_one_price): linha com todas as
 * 5 dimensões nulas → null (linha inválida — nunca retorna um ModelPricing vazio).
 */
function mapRowToModelPricing(row: PricingRow): ModelPricing | null {
  const pricing: ModelPricing = {};
  if (row.input_token_usd_per_1m != null) pricing.inputCostUsd = Number(row.input_token_usd_per_1m);
  if (row.output_token_usd_per_1m != null) pricing.outputCostUsd = Number(row.output_token_usd_per_1m);
  if (row.cached_input_token_usd_per_1m != null) pricing.cachedInputCostUsd = Number(row.cached_input_token_usd_per_1m);
  if (row.image_unit_usd != null) pricing.imageUnitCostUsd = Number(row.image_unit_usd);
  if (row.image_token_usd_per_1m != null) pricing.imageTokenUsdPer1M = Number(row.image_token_usd_per_1m);
  if (Object.keys(pricing).length === 0) return null;
  return pricing;
}

/**
 * Serviço de leitura de preços (D8) — client injetável (padrão credit-service).
 * `versionId` = uuid da linha vigente usada | fallback de código (D2).
 * NUNCA lança: qualquer falha de leitura é logada e tratada como "sem linha"
 * (fail-open).
 */
export class AiModelPricingService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async getModelPricing({
    provider,
    model,
  }: {
    provider: string;
    model: string;
  }): Promise<{ pricing: ModelPricing; versionId: string } | null> {
    try {
      const { data, error } = await this.client
        .from("ai_model_pricing")
        .select(
          "id, provider, model, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m",
        )
        .eq("provider", provider)
        .eq("model", model)
        .is("effective_until", null) // vigente = effective_until IS NULL (não existe coluna is_current — D8)
        .maybeSingle();

      if (error) {
        console.error("[ai-model-pricing] getModelPricing error (best-effort):", error.message);
        return null;
      }

      if (data) {
        const pricing = mapRowToModelPricing(data as PricingRow);
        if (!pricing) return null; // linha inválida (violação defensiva do CHECK at_least_one_price)
        return { pricing, versionId: data.id };
      }

      // Sem linha vigente → bootstrap de código (D8)
      const defaultPricing = DEFAULT_AI_MODEL_PRICING[normalizeModel(model)];
      if (!defaultPricing || Object.keys(defaultPricing).length === 0) return null;
      return { pricing: defaultPricing, versionId: "code_default" };
    } catch (err) {
      console.error("[ai-model-pricing] getModelPricing exception (best-effort):", err);
      return null;
    }
  }
}

const serviceSingleton = new AiModelPricingService();

/** Wrapper singleton — importável pelo resolvedor (vi.mockável em testes). */
export async function getModelPricing(params: {
  provider: string;
  model: string;
}): Promise<{ pricing: ModelPricing; versionId: string } | null> {
  return serviceSingleton.getModelPricing(params);
}
