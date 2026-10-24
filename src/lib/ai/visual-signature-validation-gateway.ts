import { readValidationApiKey, readVisualSignatureApiKey } from "./api-keys";
import { ResponsesAdapter } from "./adapters/responses";
import { AiGateway } from "./gateway";
import type { AiModelResolver, AiProtocol } from "./model-resolver";
import type { AiAdapter, AiAdapterRegistry } from "./types";
import type { VisualSignatureEnvironment } from "@/lib/visual-signature/local-validation/environment-contract";

/**
 * F47.1 (D5/D6/D12) — gateway de validação local da Assinatura Visual.
 *
 * Registry RESTRITO ao protocolo `responses` com uma única instância de
 * `ResponsesAdapter` que:
 * - lê SOMENTE a credencial dedicada (`readValidationApiKey`, sem fallback);
 * - configura `maxRetries: 0` (sem retry oculto do SDK).
 *
 * Qualquer capacidade resolvida para outro protocolo falha fechado (o registry
 * não devolve adapter e o gateway lança erro de capability). O resolver
 * recebido é responsável pelo congelamento do alvo de `visual_signature_image`.
 */
export function createVisualSignatureValidationGateway(
  resolver: AiModelResolver,
  environment: VisualSignatureEnvironment = "local_validation",
): AiGateway {
  const resolveApiKey =
    environment === "production"
      ? (provider: Parameters<typeof readVisualSignatureApiKey>[0]) =>
          readVisualSignatureApiKey(provider, environment)
      : readValidationApiKey;
  const responsesAdapter = new ResponsesAdapter(
    resolveApiKey,
    { maxRetries: 0 },
    environment === "production" ? "normal" : "validation",
  );
  const adapters: AiAdapterRegistry = {
    get(protocol: AiProtocol): AiAdapter | undefined {
      return protocol === "responses" ? responsesAdapter : undefined;
    },
  };
  return new AiGateway(resolver, adapters);
}
