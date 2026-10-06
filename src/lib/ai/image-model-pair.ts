/**
 * Contrato do par modelo + qualidade do novo fluxo Produto 1:1 (F56.1).
 *
 * Infraestrutura **preparatória**: define a lista elegível **fechada** (D-02), a
 * escolha inicial registrada como **decisão humana** (D-03) e a validação
 * **fail-closed** do par (D-06). Nenhuma chamada a provider, banco ou crédito —
 * apenas contrato/tipos e validação pura.
 *
 * O tipo de origem NÃO inclui `"default"`: ausência de configuração é erro, não
 * uma origem válida (D-12).
 */

/** Qualidades de imagem elegíveis (já testadas na bancada, D-02). */
export type ImageQuality = "low" | "medium";

/** Lista FECHADA e congelada (runtime) dos modelos de imagem elegíveis (D-02). */
export const ELIGIBLE_IMAGE_MODELS = Object.freeze([
  "gpt-image-2",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
] as const);

/** Lista FECHADA e congelada (runtime) das qualidades elegíveis (D-02). */
export const ELIGIBLE_IMAGE_QUALITIES = Object.freeze(["low", "medium"] as const);

export type EligibleImageModel = (typeof ELIGIBLE_IMAGE_MODELS)[number];
export type EligibleImageQuality = (typeof ELIGIBLE_IMAGE_QUALITIES)[number];

/** Um par modelo + qualidade. */
export interface ImageModelPair {
  model: string;
  quality: ImageQuality;
}

/** Par principal + par fallback do novo fluxo. */
export interface ImageModelPairConfig {
  primary: ImageModelPair;
  fallback: ImageModelPair;
}

/**
 * Origens válidas da configuração. `"default"` NÃO existe (D-12): a resolução
 * fail-closed trata ausência como erro, nunca como origem.
 */
export type ImagePairConfigOrigin = "human_decision" | "selection";

/** Código determinístico de rejeição de par fora do catálogo elegível (D-06). */
export const IMAGE_MODEL_PAIR_NOT_ELIGIBLE = "image_model_pair_not_eligible" as const;

/** Campo do par que violou a lista elegível. */
export type ImageModelPairField = "model" | "quality";

/** Erro tipado e determinístico ao validar um par fora do catálogo (D-06). */
export class ImageModelPairNotEligibleError extends Error {
  readonly code = IMAGE_MODEL_PAIR_NOT_ELIGIBLE;
  readonly field: ImageModelPairField;
  readonly pair: ImageModelPair;

  constructor(pair: ImageModelPair, field: ImageModelPairField) {
    super(`${IMAGE_MODEL_PAIR_NOT_ELIGIBLE}:${field}`);
    this.name = "ImageModelPairNotEligibleError";
    this.field = field;
    this.pair = pair;
  }
}

/** `true` quando o modelo pertence à lista elegível fechada (D-02). */
export function isEligibleImageModel(model: string): model is EligibleImageModel {
  return (ELIGIBLE_IMAGE_MODELS as readonly string[]).includes(model);
}

/** `true` quando a qualidade pertence à lista elegível fechada (D-02). */
export function isEligibleImageQuality(quality: string): quality is EligibleImageQuality {
  return (ELIGIBLE_IMAGE_QUALITIES as readonly string[]).includes(quality);
}

/**
 * Valida um par contra a lista elegível; lança erro determinístico quando o
 * modelo ou a qualidade estão fora do catálogo (fail-closed, D-06).
 */
export function assertEligibleModelPair(pair: ImageModelPair): ImageModelPair {
  if (!isEligibleImageModel(pair.model)) {
    throw new ImageModelPairNotEligibleError(pair, "model");
  }
  if (!isEligibleImageQuality(pair.quality)) {
    throw new ImageModelPairNotEligibleError(pair, "quality");
  }
  return pair;
}

/**
 * Escolha inicial aprovada pelo responsável (D-03): principal
 * `gpt-image-2.5-sunburst / medium`, fallback `gpt-image-2 / medium`.
 *
 * Registrada como **decisão humana expressa** e **não** como configuração ativa
 * em produção: `active`/`production` são literalmente `false` no tipo.
 */
export interface InitialImageModelPair extends ImageModelPairConfig {
  origin: "human_decision";
  active: false;
  production: false;
}

export const INITIAL_IMAGE_MODEL_PAIR: InitialImageModelPair = Object.freeze({
  primary: Object.freeze({ model: "gpt-image-2.5-sunburst", quality: "medium" as const }),
  fallback: Object.freeze({ model: "gpt-image-2", quality: "medium" as const }),
  origin: "human_decision" as const,
  active: false,
  production: false,
});
