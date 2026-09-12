/**
 * AI Model Resolver — seam de resolução de modelo por capacidade (F46, D1.1).
 *
 * Define os tipos do registry (`AiCapability` / `AiProtocol` / `AiModelTarget` /
 * `AiModelConfig`) e a interface **assíncrona** `AiModelResolver`. O `AiGateway`
 * (46-02) depende **apenas** desta interface e a recebe **por construtor**; o
 * `ModelRegistry` em código é a implementação inicial (`async resolve`).
 *
 * O contrato nasce assíncrono para que o Change B (F47) possa injetar um
 * `PersistedModelResolver` (seleção persistida + cache por request) **sem
 * reabrir o gateway**.
 */

/** Union das 11 capacidades de IA (D1). */
export type AiCapability =
  | "campaign_copy"
  | "campaign_correction_analysis"
  | "brand_profile_text"
  | "campaign_spec"
  | "campaign_input_validation"
  | "campaign_image_review"
  | "brand_profile_vision"
  | "visual_signature_validation"
  | "campaign_image"
  | "campaign_image_edit"
  | "visual_signature_image";

/** Protocolo de wire de cada alvo (primary e fallback declaram o próprio). */
export type AiProtocol = "chat-completions" | "responses" | "images" | "gemini";

/** Segmento da capacidade. */
export type AiSegment = "text" | "vision" | "image";

/** Alvo de modelo — provider + modelo + protocolo (cada alvo é independente). */
export interface AiModelTarget {
  provider: string;
  model: string;
  protocol: AiProtocol;
}

/** Configuração completa de uma capacidade no registry. */
export interface AiModelConfig {
  capability: AiCapability;
  segment: AiSegment;
  primary: AiModelTarget;
  fallback?: AiModelTarget;
}

/**
 * Seam de resolução de modelo. O gateway consome apenas esta interface.
 * Assíncrona por design (D1.1) — o resolver persistido da F47 é compatível.
 */
export interface AiModelResolver {
  resolve(capability: AiCapability): Promise<AiModelConfig>;
  listCapabilities(): AiCapability[];
}
