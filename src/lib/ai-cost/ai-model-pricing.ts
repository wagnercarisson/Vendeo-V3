import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { UsageTokenPricing } from "./types";

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
export interface ModelPricing extends UsageTokenPricing {
  imageUnitCostUsd?: number;
}

/**
 * Resultado ESTRITO de leitura de pricing (pré-chamada). Preserva a distinção
 * entre linha ausente/incompleta comprovada e falha de leitura, sem alterar o
 * comportamento fail-open de `getModelPricing`.
 */
export type ModelPricingReadResult =
  | {
      readonly kind: "found";
      readonly pricing: ModelPricing;
      readonly versionId: string;
    }
  | {
      readonly kind: "code_default";
      readonly pricing: ModelPricing;
    }
  | { readonly kind: "row_missing" }
  | { readonly kind: "read_failed"; readonly reason: string };

type ModelPricingReadInternal =
  | {
      readonly kind: "found";
      readonly pricing: ModelPricing;
      readonly versionId: string;
    }
  | {
      readonly kind: "code_default";
      readonly pricing: ModelPricing;
    }
  | { readonly kind: "row_missing" }
  | {
      readonly kind: "read_failed";
      readonly reason: string;
      readonly log: unknown;
    };

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
  image_input_token_usd_per_1m?: number | null;
  image_cached_input_token_usd_per_1m?: number | null;
}

/**
 * Colunas do select legado (D8). Mantidas como constante para garantir que a
 * leitura SEM qualidade continue selecionando exatamente as mesmas dimensões de
 * preço do fluxo legado (F56.1 — D-08, isolamento). O filtro adicional
 * `quality IS NULL` (ver `getModelPricing`) NÃO altera o conjunto de colunas —
 * apenas desambigua a coluna aditiva `quality` para selecionar a linha vigente
 * legada (a migration F56.1 admite uma linha vigente NULL e outra com valor para
 * o mesmo `(provider, model)`).
 */
const LEGACY_PRICING_COLUMNS =
  "id, provider, model, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m";

/**
 * Quick 261026 — colunas do caminho COM qualidade (Produto 1:1). Adiciona as
 * dimensões explícitas de entrada/cache de imagem, sem alterar o select legado.
 * A migration de pricing correspondente já fornece essas colunas no ambiente.
 */
const QUALITY_PRICING_COLUMNS =
  `${LEGACY_PRICING_COLUMNS}, quality, image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m`;

/**
 * Mapper linha → ModelPricing (snake→camel). Valida "ao menos uma dimensão"
 * (espelha o CHECK chk_ai_model_pricing_at_least_one_price): linha com todas as
 * dimensões nulas → null (linha inválida — nunca retorna um ModelPricing vazio).
 */
function mapRowToModelPricing(row: PricingRow): ModelPricing | null {
  const pricing: ModelPricing = {};
  if (row.input_token_usd_per_1m != null) pricing.inputCostUsd = Number(row.input_token_usd_per_1m);
  if (row.output_token_usd_per_1m != null) pricing.outputCostUsd = Number(row.output_token_usd_per_1m);
  if (row.cached_input_token_usd_per_1m != null) pricing.cachedInputCostUsd = Number(row.cached_input_token_usd_per_1m);
  if (row.image_unit_usd != null) pricing.imageUnitCostUsd = Number(row.image_unit_usd);
  if (row.image_token_usd_per_1m != null) pricing.imageTokenUsdPer1M = Number(row.image_token_usd_per_1m);
  if (row.image_input_token_usd_per_1m != null) {
    pricing.imageInputTokenUsdPer1M = Number(row.image_input_token_usd_per_1m);
  }
  if (row.image_cached_input_token_usd_per_1m != null) {
    pricing.imageCachedInputTokenUsdPer1M = Number(row.image_cached_input_token_usd_per_1m);
  }
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
    quality,
  }: {
    provider: string;
    model: string;
    quality?: string;
  }): Promise<{ pricing: ModelPricing; versionId: string } | null> {
    const result = await this.loadModelPricing({ provider, model, quality });
    switch (result.kind) {
      case "found":
        return { pricing: result.pricing, versionId: result.versionId };
      case "code_default":
        return { pricing: result.pricing, versionId: "code_default" };
      case "row_missing":
        return null;
      case "read_failed":
        if (result.reason === "pricing_read_exception") {
          console.error(
            "[ai-model-pricing] getModelPricing exception (best-effort):",
            result.log,
          );
        } else {
          console.error(
            "[ai-model-pricing] getModelPricing error (best-effort):",
            result.log,
          );
        }
        return null;
    }
  }

  /**
   * Leitura ESTRITA para o preflight pré-chamada: distingue linha ausente /
   * `code_default` / cobertura incompleta (comprovadas) de falha de leitura.
   * O caminho legado `getModelPricing` permanece fail-open e intocado.
   */
  async readModelPricing({
    provider,
    model,
    quality,
  }: {
    provider: string;
    model: string;
    quality?: string;
  }): Promise<ModelPricingReadResult> {
    const result = await this.loadModelPricing({ provider, model, quality });
    if (result.kind === "read_failed") {
      return { kind: "read_failed", reason: result.reason };
    }
    return result;
  }

  private async loadModelPricing({
    provider,
    model,
    quality,
  }: {
    provider: string;
    model: string;
    quality?: string;
  }): Promise<ModelPricingReadInternal> {
    try {
      // F56.1 (D-08): `quality` é uma dimensão ADITIVA.
      //   - Omitido → comportamento legado preservado: seleciona as colunas legadas
      //     (inclui o bootstrap de código `code_default`) e filtra `quality IS NULL`
      //     para escolher a linha vigente legada. O filtro é NECESSÁRIO: a migration
      //     F56.1 admite DUAS linhas vigentes para o mesmo `(provider, model)` (uma
      //     com `quality IS NULL` e outra com `quality` preenchida); sem ele, o
      //     `maybeSingle()` pode retornar erro de cardinalidade (PGRST116) e o
      //     bootstrap `code_default` seria perdido.
      //   - Informado → seleciona `quality`, filtra `.eq("quality", quality)` e NUNCA
      //     usa `DEFAULT_AI_MODEL_PRICING` (o custo por qualidade precisa ser explícito
      //     — D-09/D-10): sem linha vigente de qualidade, retorna null (cobertura missing).
      const columns: string =
        quality === undefined ? LEGACY_PRICING_COLUMNS : QUALITY_PRICING_COLUMNS;

      const vigenteQuery = this.client
        .from("ai_model_pricing")
        .select(columns)
        .eq("provider", provider)
        .eq("model", model)
        .is("effective_until", null); // vigente = effective_until IS NULL (não existe coluna is_current — D8)

      const response =
        quality === undefined
          ? await vigenteQuery.is("quality", null).maybeSingle() // desambigua a linha legada (quality IS NULL)
          : await vigenteQuery.eq("quality", quality).maybeSingle();
      // `quality` é uma coluna nova (F56.1, ainda fora dos tipos gerados do Supabase):
      // o parser de select do client não a reconhece, então o cast é feito via `unknown`.
      const data = response.data as unknown as PricingRow | null;
      const error = response.error;

      if (error) {
        return {
          kind: "read_failed",
          reason: "pricing_read_failed",
          log: error.message,
        };
      }

      if (data) {
        const pricing = mapRowToModelPricing(data);
        if (!pricing) return { kind: "row_missing" }; // linha inválida (violação defensiva do CHECK at_least_one_price)
        return { kind: "found", pricing, versionId: data.id };
      }

      // Sem linha vigente:
      //   - com qualidade → null (sem inventar valor — D-09/D-10).
      //   - sem qualidade → bootstrap de código (D8, fail-open do fluxo legado).
      if (quality !== undefined) return { kind: "row_missing" };
      const defaultPricing = DEFAULT_AI_MODEL_PRICING[normalizeModel(model)];
      if (!defaultPricing || Object.keys(defaultPricing).length === 0) {
        return { kind: "row_missing" };
      }
      return { kind: "code_default", pricing: defaultPricing };
    } catch (err) {
      return {
        kind: "read_failed",
        reason: "pricing_read_exception",
        log: err,
      };
    }
  }
}

const serviceSingleton = new AiModelPricingService();

/** Wrapper singleton — importável pelo resolvedor (vi.mockável em testes). */
export async function getModelPricing(params: {
  provider: string;
  model: string;
  quality?: string;
}): Promise<{ pricing: ModelPricing; versionId: string } | null> {
  return serviceSingleton.getModelPricing(params);
}
