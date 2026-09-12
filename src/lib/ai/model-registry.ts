import type {
  AiCapability,
  AiModelConfig,
  AiModelResolver,
  AiModelTarget,
  AiProtocol,
  AiProvider,
  AiSegment,
} from "./model-resolver";

/**
 * Registry de modelos em código (F46, D1) — fonte única da verdade por
 * **capacidade**, com defaults idênticos ao comportamento efetivo pré-F46.
 *
 * O `protocol` é obrigatório em **cada alvo** (primary e fallback): cada alvo é
 * independente (ex.: `campaign_copy` tem primary `chat-completions` e fallback
 * `gemini`; `campaign_image` usa `responses` e `campaign_image_edit` usa `images`).
 *
 * NÃO importa SDKs de provider e NÃO lê env-var de modelo (D5/D8).
 */

/**
 * Allowlist de modelos conhecidos/testados (base para a seleção do Change B).
 * Estruturada por **provider → modelo → protocolos** de wire aceitos. Validada
 * por **capacidade + provider + modelo + protocolo** (nunca apenas por
 * segmento) — assim combinações trocadas (ex.: provider `gemini` com modelo
 * `gpt-4o`, ou provider `openai` com modelo `gemini-*`) são rejeitadas.
 */
export const MODEL_ALLOWLIST: Record<AiProvider, Record<string, readonly AiProtocol[]>> = {
  openai: {
    "gpt-4o": ["chat-completions"],
    "gpt-4o-mini": ["chat-completions", "responses"],
    "gpt-5.5": ["responses"],
    "gpt-image-2": ["images"],
  },
  gemini: {
    "gemini-3.1-flash-lite": ["gemini"],
    "gemini-2.0-flash": ["gemini"],
  },
};

/** Protocolos aceitos por capacidade (cobre primary e fallback). */
export const CAPABILITY_PROTOCOLS: Record<AiCapability, readonly AiProtocol[]> = {
  campaign_copy: ["chat-completions", "gemini"],
  campaign_correction_analysis: ["chat-completions"],
  brand_profile_text: ["chat-completions"],
  campaign_spec: ["chat-completions"],
  campaign_input_validation: ["chat-completions"],
  campaign_image_review: ["chat-completions"],
  brand_profile_vision: ["chat-completions"],
  visual_signature_validation: ["responses"],
  campaign_image: ["responses"],
  campaign_image_edit: ["images"],
  visual_signature_image: ["responses"],
};

/** Segmento canônico de cada capacidade (fonte única — validação fail-fast). */
export const CAPABILITY_SEGMENTS: Record<AiCapability, AiSegment> = {
  campaign_copy: "text",
  campaign_correction_analysis: "text",
  brand_profile_text: "text",
  campaign_spec: "text",
  campaign_input_validation: "vision",
  campaign_image_review: "vision",
  brand_profile_vision: "vision",
  visual_signature_validation: "vision",
  campaign_image: "image",
  campaign_image_edit: "image",
  visual_signature_image: "image",
};

/** Conjunto canônico das 11 capacidades (validação de mapas injetados). */
export const ALL_CAPABILITIES = Object.keys(CAPABILITY_SEGMENTS) as AiCapability[];

/**
 * Registry inicial — defaults idênticos aos valores efetivos pré-F46 (design
 * D1 :66-78). Nenhum modelo muda nesta fase.
 */
export const MODEL_REGISTRY: Record<AiCapability, AiModelConfig> = {
  campaign_copy: {
    capability: "campaign_copy",
    segment: "text",
    primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
    fallback: { provider: "gemini", model: "gemini-3.1-flash-lite", protocol: "gemini" },
  },
  campaign_correction_analysis: {
    capability: "campaign_correction_analysis",
    segment: "text",
    primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
  },
  brand_profile_text: {
    capability: "brand_profile_text",
    segment: "text",
    primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
  },
  campaign_spec: {
    capability: "campaign_spec",
    segment: "text",
    primary: { provider: "openai", model: "gpt-4o-mini", protocol: "chat-completions" },
  },
  campaign_input_validation: {
    capability: "campaign_input_validation",
    segment: "vision",
    primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
  },
  campaign_image_review: {
    capability: "campaign_image_review",
    segment: "vision",
    primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
  },
  brand_profile_vision: {
    capability: "brand_profile_vision",
    segment: "vision",
    primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
  },
  visual_signature_validation: {
    capability: "visual_signature_validation",
    segment: "vision",
    primary: { provider: "openai", model: "gpt-4o-mini", protocol: "responses" },
  },
  campaign_image: {
    capability: "campaign_image",
    segment: "image",
    primary: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
  },
  campaign_image_edit: {
    capability: "campaign_image_edit",
    segment: "image",
    primary: { provider: "openai", model: "gpt-image-2", protocol: "images" },
  },
  visual_signature_image: {
    capability: "visual_signature_image",
    segment: "image",
    primary: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
  },
};

function assertValidTarget(
  capability: AiCapability,
  target: AiModelTarget,
  role: "primary" | "fallback",
): void {
  const providerModels = MODEL_ALLOWLIST[target.provider];
  if (!providerModels) {
    throw new Error(
      `[model-registry] ${capability}.${role}: provider "${target.provider}" fora da allowlist`,
    );
  }
  const allowedProtocols = providerModels[target.model];
  if (!allowedProtocols) {
    throw new Error(
      `[model-registry] ${capability}.${role}: modelo "${target.model}" fora da allowlist do provider "${target.provider}"`,
    );
  }
  if (!allowedProtocols.includes(target.protocol)) {
    throw new Error(
      `[model-registry] ${capability}.${role}: protocolo "${target.protocol}" incompatível com o modelo "${target.model}"`,
    );
  }
  if (!CAPABILITY_PROTOCOLS[capability].includes(target.protocol)) {
    throw new Error(
      `[model-registry] ${capability}.${role}: protocolo "${target.protocol}" incompatível com a capacidade`,
    );
  }
}

/**
 * Valida uma configuração de capacidade: capacidade conhecida, `segment`
 * canônico da capacidade, alvos na allowlist (provider + modelo + protocolo),
 * protocolo compatível com a capacidade e `primary` ≠ `fallback` (mesmo
 * `provider` + `model` é rejeitado — D1).
 */
export function validateModelConfig(config: AiModelConfig): void {
  if (!CAPABILITY_PROTOCOLS[config.capability]) {
    throw new Error(`[model-registry] capacidade desconhecida: "${config.capability}"`);
  }
  if (config.segment !== CAPABILITY_SEGMENTS[config.capability]) {
    throw new Error(
      `[model-registry] ${config.capability}: segmento "${config.segment}" incompatível com a capacidade (esperado "${CAPABILITY_SEGMENTS[config.capability]}")`,
    );
  }
  assertValidTarget(config.capability, config.primary, "primary");
  if (config.fallback) {
    assertValidTarget(config.capability, config.fallback, "fallback");
    if (
      config.primary.provider === config.fallback.provider &&
      config.primary.model === config.fallback.model
    ) {
      throw new Error(
        `[model-registry] ${config.capability}: primary e fallback devem ser alvos distintos`,
      );
    }
  }
}

/**
 * Valida um mapa completo de registry (fail-fast): exatamente as 11
 * capacidades, cada chave corresponde a `config.capability` e cada
 * configuração passa por `validateModelConfig`. Rejeita mapas injetados
 * estruturalmente inconsistentes (chave trocada, capacidade ausente/extra).
 */
export function validateRegistry(registry: Record<string, AiModelConfig>): void {
  const keys = Object.keys(registry);
  const missing = ALL_CAPABILITIES.filter((capability) => !keys.includes(capability));
  if (missing.length > 0) {
    throw new Error(`[model-registry] registry sem capacidades obrigatórias: ${missing.join(", ")}`);
  }
  const extra = keys.filter((key) => !ALL_CAPABILITIES.includes(key as AiCapability));
  if (extra.length > 0) {
    throw new Error(`[model-registry] registry com capacidades desconhecidas: ${extra.join(", ")}`);
  }
  for (const key of keys as AiCapability[]) {
    const config = registry[key];
    if (config.capability !== key) {
      throw new Error(
        `[model-registry] registry: chave "${key}" não corresponde a config.capability "${config.capability}"`,
      );
    }
    validateModelConfig(config);
  }
}

// Validação no carregamento do registry default (fail-fast em configuração inválida).
validateRegistry(MODEL_REGISTRY);

/**
 * Implementação inicial de `AiModelResolver` — resolve do mapa em memória.
 * `async resolve()` (o `await` é trivial hoje; o contrato prepara o resolver
 * persistido da F47). Valida o mapa no construtor (fail-fast).
 */
export class ModelRegistry implements AiModelResolver {
  constructor(private readonly registry: Record<AiCapability, AiModelConfig> = MODEL_REGISTRY) {
    validateRegistry(registry);
  }

  async resolve(capability: AiCapability): Promise<AiModelConfig> {
    const config = this.registry[capability];
    if (!config) {
      throw new Error(`[model-registry] capacidade desconhecida: "${capability}"`);
    }
    return config;
  }

  listCapabilities(): AiCapability[] {
    return Object.keys(this.registry) as AiCapability[];
  }
}
