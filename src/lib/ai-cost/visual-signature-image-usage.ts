/**
 * Estimativa versionada de CONSUMO de tokens da imagem da Assinatura Visual.
 *
 * Esta tabela NÃO é tarifa e NÃO é cobrança: são parâmetros de consumo
 * (tokens) aprovados para as novas gerações da Assinatura Visual, aplicados
 * somente quando a operação usa a configuração dedicada válida e o par
 * modelo+qualidade+tamanho está coberto abaixo.
 *
 * Fonte de tarifas: `ai_model_pricing` (via `visual-signature-image-cost.ts`).
 * A próxima atualização periódica de tarifas deve abastecer a mesma base, não
 * criar uma segunda fonte de preços.
 *
 * Regras de isolamento:
 * - tabela fechada por `modelo|qualidade|tamanho`; combinação/tamanho não
 *   coberto retorna `null` e NUNCA herda a estimativa de outra opção;
 * - nenhum valor de tarifa (USD/M) vive aqui — apenas tokens estimados;
 * - histórico não é recalculado: a versão acompanha cada nova chamada.
 */

/** Versão inicial aprovada da estimativa (2026-10-26). */
export const VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION = "vs-image-usage-v1" as const;

/** Data de aprovação dos parâmetros de consumo. */
export const VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT = "2026-10-26" as const;

/** Único tamanho coberto pela versão inicial. */
export const VISUAL_SIGNATURE_IMAGE_USAGE_SIZE = "1024x1024" as const;

/**
 * Origem dos parâmetros: observação manual na plataforma OpenAI (uma execução
 * por combinação), seguida de arredondamento e margem adicional aprovados pelo
 * usuário. Não são tokens medidos automaticamente nem média estatística
 * representativa, e não representam garantia ou teto de cobrança.
 */
export const VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN =
  "manual_observation_openai_platform_with_rounding_and_margin" as const;

/** Versão da fórmula de custo (auditabilidade). */
export const VISUAL_SIGNATURE_IMAGE_COST_FORMULA_VERSION =
  "visual_signature_image_usage_estimate_v1" as const;

/** Nota persistida quando todos os componentes foram calculados. */
export const VISUAL_SIGNATURE_IMAGE_ESTIMATE_COMPLETE_NOTE =
  "visual_signature_image_usage_estimated_vs-image-usage-v1" as const;

/** Nota persistida quando falta tarifa/uso/estimativa (custo parcial/desconhecido). */
export const VISUAL_SIGNATURE_IMAGE_ESTIMATE_PARTIAL_NOTE =
  "visual_signature_image_usage_estimate_partial" as const;

/** Alvo da estimativa: modelo/qualidade/tamanho efetivamente enviados. */
export interface VisualSignatureImageUsageTarget {
  imageModel: string;
  imageQuality: string;
  size: string;
  /** Versão congelada da configuração dedicada na operação (auditoria). */
  configVersionId?: string | null;
}

export type VisualSignatureImageEstimateCoverage = "complete" | "partial" | "unknown";

/**
 * Auditoria separada do consumo estimado da imagem — persistida SOMENTE no
 * metadata JSONB existente (não cria coluna/tabela).
 */
export interface VisualSignatureImageUsageAudit {
  origin: typeof VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN;
  estimated: true;
  estimateVersion: typeof VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION;
  approvedAt: typeof VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT;
  model: string;
  quality: string;
  size: string;
  configVersionId: string | null;
  /** Tokens estimados de entrada textual (null quando a combinação não é coberta). */
  inputTextTokens: number | null;
  /** Tokens estimados de saída de imagem (null quando a combinação não é coberta). */
  outputImageTokens: number | null;
  imagePricingVersion: string | null;
  orchestratorPricingVersion: string | null;
  /** Tarifa textual da imagem efetivamente usada (USD/M). */
  imageInputTextUsdPer1M: number | null;
  /** Tarifa de imagem efetivamente usada (USD/M). */
  imageOutputImageUsdPer1M: number | null;
  imageComponentUsd: number | null;
  textComponentUsd: number | null;
  coverage: VisualSignatureImageEstimateCoverage;
  missing: string[];
  /** Breakdown real disponível no usage? (auditoria de leitura, não estimativa). */
  usageBreakdown: "detailed" | "aggregate" | "absent";
}

/** Parâmetros aprovados de uma combinação coberta. */
export interface VisualSignatureImageUsageEstimate {
  model: string;
  quality: string;
  size: string;
  /** Tokens estimados de entrada TEXTUAL da imagem. */
  inputTextTokens: number;
  /** Tokens estimados de saída de IMAGEM. */
  outputImageTokens: number;
  version: typeof VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION;
  approvedAt: typeof VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT;
  origin: typeof VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN;
}

const ESTIMATES: readonly VisualSignatureImageUsageEstimate[] = Object.freeze([
  Object.freeze({
    model: "gpt-image-2.5-flare",
    quality: "low",
    size: VISUAL_SIGNATURE_IMAGE_USAGE_SIZE,
    inputTextTokens: 350,
    outputImageTokens: 250,
    version: VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION,
    approvedAt: VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT,
    origin: VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN,
  }),
  Object.freeze({
    model: "gpt-image-2.5-flare",
    quality: "medium",
    size: VISUAL_SIGNATURE_IMAGE_USAGE_SIZE,
    inputTextTokens: 350,
    outputImageTokens: 500,
    version: VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION,
    approvedAt: VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT,
    origin: VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN,
  }),
  Object.freeze({
    model: "gpt-image-2.5-sunburst",
    quality: "low",
    size: VISUAL_SIGNATURE_IMAGE_USAGE_SIZE,
    inputTextTokens: 400,
    outputImageTokens: 250,
    version: VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION,
    approvedAt: VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT,
    origin: VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN,
  }),
  Object.freeze({
    model: "gpt-image-2.5-sunburst",
    quality: "medium",
    size: VISUAL_SIGNATURE_IMAGE_USAGE_SIZE,
    inputTextTokens: 400,
    outputImageTokens: 500,
    version: VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION,
    approvedAt: VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT,
    origin: VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN,
  }),
]);

/**
 * Lookup exato por modelo+qualidade+tamanho. Retorna `null` para qualquer
 * combinação/tamanho fora da tabela — sem fallback para outra opção.
 */
export function getVisualSignatureImageUsageEstimate(
  target: Pick<VisualSignatureImageUsageTarget, "imageModel" | "imageQuality" | "size">,
): VisualSignatureImageUsageEstimate | null {
  return (
    ESTIMATES.find(
      (estimate) =>
        estimate.model === target.imageModel &&
        estimate.quality === target.imageQuality &&
        estimate.size === target.size,
    ) ?? null
  );
}
