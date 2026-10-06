import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  assertEligibleModelPair,
  type ImageModelPair,
  type ImageModelPairConfig,
} from "@/lib/ai/image-model-pair";
import { AiModelPricingService, type ModelPricing } from "./ai-model-pricing";
import type {
  ImagePairCapacityPricingStatus,
  ImagePairPricingComponent,
  ImagePairPricingComponentStatus,
  ImagePairPricingCoverage,
  ImagePairTargetPricingStatus,
} from "./types";

/**
 * Pricing ciente de qualidade do novo fluxo Produto 1:1 (F56.1).
 *
 * Infraestrutura **preparatória**: cobertura `complete`/`partial`/`missing` por
 * par `modelo + qualidade` (D-09) e regra **fail-closed** de execução (D-10/D-24),
 * sem tocar a cadeia legada de `resolveAiCost` (o `cost-estimator.ts` não é
 * importado nem alterado aqui). Nenhuma chamada a provider, banco ou crédito real:
 * testes usam fakes em memória.
 *
 * Fail-closed (D-09/D-10): a ausência de pricing NUNCA é mascarada por valor
 * inventado nem tratada como completa. A dimensão de qualidade não usa o bootstrap
 * de código `DEFAULT_AI_MODEL_PRICING` — o preço por qualidade precisa ser explícito.
 */

/** Provider dos modelos elegíveis do novo fluxo (D-02 — todos OpenAI). */
const IMAGE_PAIR_PROVIDER = "openai";

/** Componentes de custo obrigatórios de um par de imagem do novo fluxo (D-09). */
const REQUIRED_IMAGE_COMPONENTS: readonly ImagePairPricingComponent[] = ["image_unit"];

/** Código determinístico de execução bloqueada por cobertura incompleta (D-10/D-24). */
export const IMAGE_PAIR_PRICING_INCOMPLETE = "image_pair_pricing_incomplete" as const;

/** Erro tipado e determinístico: cobertura incompleta → par não executável (D-10/D-24). */
export class ImagePairPricingIncompleteError extends Error {
  readonly code = IMAGE_PAIR_PRICING_INCOMPLETE;
  readonly coverage: ImagePairCapacityPricingStatus;

  constructor(coverage: ImagePairCapacityPricingStatus) {
    super(IMAGE_PAIR_PRICING_INCOMPLETE);
    this.name = "ImagePairPricingIncompleteError";
    this.coverage = coverage;
  }
}

/** Origem registrada do preço de uma tentativa (D-22). */
export type ImagePairCostSource = "pricing_table" | "code_default" | "provider_reported";

/** Custo resolvido de uma tentativa (par `modelo + qualidade`) — D-22. */
export interface ImagePairAttemptCost {
  model: string;
  quality: string;
  costUsd: number | null;
  versionId: string;
  costSource: ImagePairCostSource;
}

/** Custo resolvido dos dois pares da configuração (D-22). */
export interface ImagePairCostResolution {
  primary: ImagePairAttemptCost;
  fallback: ImagePairAttemptCost;
}

interface PricingReadResult {
  pricing: ModelPricing;
  versionId: string;
}

function imageUnitAvailable(pricing: ModelPricing | null): boolean {
  return pricing?.imageUnitCostUsd != null;
}

/**
 * Serviço de pricing do par (client injetável `SupabaseClient = supabaseAdmin`,
 * `now()`/TTL injetáveis para testes). O cache é curto e apenas memoiza a leitura
 * vigente por `modelo + qualidade`; não altera o fluxo legado.
 */
export class ImagePairPricingService {
  private readonly pricing: AiModelPricingService;
  private readonly cache = new Map<string, { expiresAt: number; result: PricingReadResult | null }>();

  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = 30_000,
  ) {
    this.pricing = new AiModelPricingService(client);
  }

  /** Invalida o cache curto de leitura de pricing do par. */
  invalidateCache(): void {
    this.cache.clear();
  }

  private async readPricing(pair: ImageModelPair): Promise<PricingReadResult | null> {
    const key = `${IMAGE_PAIR_PROVIDER}|${pair.model}|${pair.quality}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.result;

    const result = await this.pricing.getModelPricing({
      provider: IMAGE_PAIR_PROVIDER,
      model: pair.model,
      quality: pair.quality,
    });
    this.cache.set(key, { expiresAt: this.now() + this.ttlMs, result });
    return result;
  }

  /**
   * Cobertura de um par `modelo + qualidade`. Ausência nunca é mascarada: os
   * componentes ausentes são explicitados e não há valor inventado (D-09).
   */
  async resolveTargetCoverage(pair: ImageModelPair): Promise<ImagePairTargetPricingStatus> {
    assertEligibleModelPair(pair);

    const result = await this.readPricing(pair);
    const available = imageUnitAvailable(result?.pricing ?? null);
    const components: ImagePairPricingComponentStatus[] = REQUIRED_IMAGE_COMPONENTS.map((component) => ({
      component,
      provider: IMAGE_PAIR_PROVIDER,
      model: pair.model,
      quality: pair.quality,
      available,
      source: available ? "table" : "missing",
    }));

    const missingComponents = components
      .filter((component) => !component.available)
      .map((component) => component.component);

    const pricingCoverage: ImagePairPricingCoverage =
      result === null
        ? "missing"
        : missingComponents.length === 0
          ? "complete"
          : missingComponents.length === components.length
            ? "missing"
            : "partial";

    return { model: pair.model, quality: pair.quality, components, missingComponents, pricingCoverage };
  }

  /**
   * Cobertura do par principal + fallback, com os componentes ausentes explicitados
   * (D-09). `partial` no agregado = apenas um dos pares está completo.
   */
  async resolveCoverage(config: ImageModelPairConfig): Promise<ImagePairCapacityPricingStatus> {
    const primary = await this.resolveTargetCoverage(config.primary);
    const fallback = await this.resolveTargetCoverage(config.fallback);

    const missingComponents = [...new Set([...primary.missingComponents, ...fallback.missingComponents])];
    const pricingCoverage: ImagePairPricingCoverage =
      primary.pricingCoverage === "complete" && fallback.pricingCoverage === "complete"
        ? "complete"
        : primary.pricingCoverage === "missing" && fallback.pricingCoverage === "missing"
          ? "missing"
          : "partial";

    return { primary, fallback, missingComponents, pricingCoverage };
  }

  /**
   * Fail-closed (D-10/D-24): exige cobertura `complete` para o principal E o
   * fallback. Cobertura `partial`/`missing` lança erro determinístico e NÃO
   * executa o par nem inventa custo.
   */
  async assertExecutable(config: ImageModelPairConfig): Promise<ImagePairCapacityPricingStatus> {
    const coverage = await this.resolveCoverage(config);
    if (coverage.primary.pricingCoverage !== "complete" || coverage.fallback.pricingCoverage !== "complete") {
      throw new ImagePairPricingIncompleteError(coverage);
    }
    return coverage;
  }

  /**
   * Custo por tentativa do par `modelo + qualidade` com `versionId` e origem do
   * preço, quando a configuração é completa (D-22). Sem alterar a cadeia legada.
   */
  async resolveCost(config: ImageModelPairConfig): Promise<ImagePairCostResolution> {
    const coverage = await this.assertExecutable(config);
    return {
      primary: await this.attemptCost(config.primary, coverage),
      fallback: await this.attemptCost(config.fallback, coverage),
    };
  }

  private async attemptCost(
    pair: ImageModelPair,
    coverage: ImagePairCapacityPricingStatus,
  ): Promise<ImagePairAttemptCost> {
    const result = await this.readPricing(pair);
    if (result === null) throw new ImagePairPricingIncompleteError(coverage);
    return {
      model: pair.model,
      quality: pair.quality,
      costUsd: result.pricing.imageUnitCostUsd ?? null,
      versionId: result.versionId,
      costSource: result.versionId === "code_default" ? "code_default" : "pricing_table",
    };
  }
}

let defaultService: ImagePairPricingService | null = null;

/** Serviço singleton do novo fluxo (client default `supabaseAdmin`). */
export function getImagePairPricingService(): ImagePairPricingService {
  defaultService ??= new ImagePairPricingService();
  return defaultService;
}

/** Cobertura `complete`/`partial`/`missing` do par principal + fallback (D-09). */
export async function resolveImagePairCoverage(
  pair: ImageModelPairConfig,
  service: ImagePairPricingService = getImagePairPricingService(),
): Promise<ImagePairCapacityPricingStatus> {
  return service.resolveCoverage(pair);
}

/** Fail-closed: exige `complete` para principal E fallback (D-10/D-24). */
export async function assertImagePairExecutable(
  pair: ImageModelPairConfig,
  service: ImagePairPricingService = getImagePairPricingService(),
): Promise<ImagePairCapacityPricingStatus> {
  return service.assertExecutable(pair);
}

/** Custo por tentativa (modelo+qualidade) com versão/origem, quando completo (D-22). */
export async function resolveImagePairCost(
  pair: ImageModelPairConfig,
  service: ImagePairPricingService = getImagePairPricingService(),
): Promise<ImagePairCostResolution> {
  return service.resolveCost(pair);
}

/** Invalida o cache curto do singleton. */
export function invalidateImagePairPricingCache(): void {
  getImagePairPricingService().invalidateCache();
}
