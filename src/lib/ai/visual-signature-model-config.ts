/**
 * F47.1 — Registry PURO da configuração dedicada da Assinatura Visual.
 *
 * Fonte única em código para os dois orquestradores e os quatro presets de
 * imagem da VS (design D3). Este módulo NÃO faz I/O, NÃO lê env e NÃO importa
 * `server-only`: é consumido tanto pelo runtime quanto por scripts e testes.
 *
 * Não contém preço, default de modelo nem credencial. O default da capacidade
 * `visual_signature_image` permanece em `model-registry.ts` (gpt-5.5/responses).
 */

/** Orquestradores aceitos para a Assinatura Visual (2). */
export const VISUAL_SIGNATURE_ORCHESTRATORS = ["gpt-5.5", "gpt-6-luna"] as const;

export type VisualSignatureOrchestrator = (typeof VISUAL_SIGNATURE_ORCHESTRATORS)[number];

/**
 * Presets fechados (4). Cada preset deriva modelo + qualidade no servidor;
 * o corpo do ator NUNCA informa modelo/qualidade. `image-2-low` não existe.
 */
export const VISUAL_SIGNATURE_IMAGE_PRESETS = {
  flare_low: { model: "gpt-image-2.5-flare", quality: "low" },
  flare_medium: { model: "gpt-image-2.5-flare", quality: "medium" },
  sunburst_low: { model: "gpt-image-2.5-sunburst", quality: "low" },
  sunburst_medium: { model: "gpt-image-2.5-sunburst", quality: "medium" },
} as const;

export type VisualSignatureImagePreset = keyof typeof VISUAL_SIGNATURE_IMAGE_PRESETS;

export type VisualSignatureImageModel =
  (typeof VISUAL_SIGNATURE_IMAGE_PRESETS)[VisualSignatureImagePreset]["model"];

export type VisualSignatureImageQuality =
  (typeof VISUAL_SIGNATURE_IMAGE_PRESETS)[VisualSignatureImagePreset]["quality"];

/** Reasoning fixo nesta fase (não é um terceiro seletor). */
export const VISUAL_SIGNATURE_REASONING_EFFORT = "low" as const;

export type VisualSignatureReasoningEffort = typeof VISUAL_SIGNATURE_REASONING_EFFORT;

/** Escopo de ambiente persistido na linha singleton. */
export const VISUAL_SIGNATURE_ENVIRONMENT_SCOPE = "local_validation" as const;

/** Chave singleton da configuração dedicada. */
export const VISUAL_SIGNATURE_CONFIG_SCOPE = "visual_signature" as const;

/** Códigos tipados de recusa da tuple de configuração. */
export type VisualSignatureConfigErrorCode =
  | "invalid_orchestrator"
  | "invalid_preset"
  | "invalid_image_quality"
  | "invalid_reasoning"
  | "preset_tuple_mismatch";

export class VisualSignatureConfigError extends Error {
  constructor(readonly code: VisualSignatureConfigErrorCode) {
    super(code);
    this.name = "VisualSignatureConfigError";
  }
}

/** Tuple completa validada pela RPC/CHECK. */
export interface VisualSignatureConfigTuple {
  orchestratorModel: string;
  imagePreset: string;
  imageModel: string;
  imageQuality: string;
  reasoningEffort: string;
}

export interface ResolvedVisualSignaturePreset {
  preset: VisualSignatureImagePreset;
  model: VisualSignatureImageModel;
  quality: VisualSignatureImageQuality;
}

function isOrchestrator(value: string): value is VisualSignatureOrchestrator {
  return (VISUAL_SIGNATURE_ORCHESTRATORS as readonly string[]).includes(value);
}

function isPreset(value: string): value is VisualSignatureImagePreset {
  return Object.prototype.hasOwnProperty.call(VISUAL_SIGNATURE_IMAGE_PRESETS, value);
}

function isImageQuality(value: string): value is VisualSignatureImageQuality {
  return value === "low" || value === "medium";
}

/**
 * Deriva modelo + qualidade a partir do preset fechado. Preset desconhecido
 * (incluindo `image-2-low`) falha com `invalid_preset` — nunca há fallback.
 */
export function resolveVisualSignaturePreset(preset: string): ResolvedVisualSignaturePreset {
  if (!isPreset(preset)) {
    throw new VisualSignatureConfigError("invalid_preset");
  }
  const mapping = VISUAL_SIGNATURE_IMAGE_PRESETS[preset];
  return { preset, model: mapping.model, quality: mapping.quality };
}

/**
 * Valida a tuple completa (orquestrador, preset, modelo, qualidade, reasoning).
 * Recusa orquestrador fora do conjunto, preset fora dos quatro, qualidade
 * inválida, reasoning diferente de `low` e qualquer divergência
 * preset → modelo/qualidade.
 */
export function assertVisualSignatureConfigTuple(
  tuple: VisualSignatureConfigTuple,
): void {
  if (!isOrchestrator(tuple.orchestratorModel)) {
    throw new VisualSignatureConfigError("invalid_orchestrator");
  }
  if (!isPreset(tuple.imagePreset)) {
    throw new VisualSignatureConfigError("invalid_preset");
  }
  if (!isImageQuality(tuple.imageQuality)) {
    throw new VisualSignatureConfigError("invalid_image_quality");
  }
  if (tuple.reasoningEffort !== VISUAL_SIGNATURE_REASONING_EFFORT) {
    throw new VisualSignatureConfigError("invalid_reasoning");
  }

  const expected = VISUAL_SIGNATURE_IMAGE_PRESETS[tuple.imagePreset];
  if (tuple.imageModel !== expected.model || tuple.imageQuality !== expected.quality) {
    throw new VisualSignatureConfigError("preset_tuple_mismatch");
  }
}
