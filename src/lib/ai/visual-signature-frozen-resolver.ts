import type { AiCapability, AiModelConfig, AiModelResolver } from "./model-resolver";
import type { VisualSignatureModelConfigSnapshot } from "./visual-signature-model-config-service";

/**
 * F47.1 (D4) — resolver CONGELADO por operação.
 *
 * Para `visual_signature_image`, devolve sempre o alvo congelado do snapshot
 * (orquestrador + protocolo `responses`). Todas as demais capacidades são
 * delegadas ao resolver padrão, preservando `campaign_image`,
 * `visual_signature_validation`, etc.
 *
 * O alvo/cópia são congelados: uma alteração administrativa depois da leitura
 * NÃO pode mudar o alvo no meio da operação (inclusive no retry).
 */
export function createFrozenVisualSignatureResolver(params: {
  snapshot: VisualSignatureModelConfigSnapshot;
  fallbackResolver: AiModelResolver;
}): AiModelResolver {
  const { snapshot, fallbackResolver } = params;

  if (snapshot.mode === "legacy") {
    return fallbackResolver;
  }

  const frozenTarget = Object.freeze({
    provider: "openai" as const,
    model: snapshot.orchestratorModel,
    protocol: "responses" as const,
  });

  const frozenConfig: AiModelConfig = Object.freeze({
    capability: "visual_signature_image" as const,
    segment: "image" as const,
    primary: frozenTarget,
  });

  return {
    async resolve(capability: AiCapability): Promise<AiModelConfig> {
      if (capability === "visual_signature_image") return frozenConfig;
      return fallbackResolver.resolve(capability);
    },
    listCapabilities(): AiCapability[] {
      return fallbackResolver.listCapabilities();
    },
  };
}
