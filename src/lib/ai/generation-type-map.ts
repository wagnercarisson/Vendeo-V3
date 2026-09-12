import type { GenerationEventType } from "@/lib/visual-signature/types";
import type { AiCapability } from "./model-resolver";

/**
 * Mapa canônico capability → generationType persistido (F46, D10).
 *
 * É o **único** ponto que traduz uma capacidade do registry para um literal
 * válido do CHECK `chk_generation_events_type`. `campaign_image_edit` não possui
 * literal próprio no enum: pertence à mesma etapa de imagem do fallback
 * (`campaign_image`). A capacidade/protocolo originais permanecem no `metadata`
 * do evento (o sink grava `capability`/`protocol`).
 */
export const CAPABILITY_GENERATION_TYPE: Record<AiCapability, GenerationEventType> = {
  campaign_copy: "campaign_copy",
  campaign_correction_analysis: "campaign_correction_analysis",
  brand_profile_text: "brand_profile_text",
  campaign_spec: "campaign_spec",
  campaign_input_validation: "campaign_input_validation",
  campaign_image_review: "campaign_image_review",
  brand_profile_vision: "brand_profile_vision",
  visual_signature_validation: "visual_signature_validation",
  campaign_image: "campaign_image",
  campaign_image_edit: "campaign_image",
  visual_signature_image: "visual_signature_image",
};
