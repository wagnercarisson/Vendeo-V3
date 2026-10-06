import { AiGateway } from "./gateway";
import type {
  AiCapability,
  AiModelConfig,
  AiModelResolver,
  AiModelTarget,
} from "./model-resolver";
import type { AiAdapter, AiAdapterRegistry, AiProtocol } from "./types";
import { UpstreamImagesAdapter } from "./adapters/upstream-images";
import {
  assertEligibleModelPair,
  type ImageModelPair,
  type ImageModelPairConfig,
} from "./image-model-pair";

/**
 * Runtime do **novo fluxo** de imagem Produto 1:1 (F56.1, D-20/D-21).
 *
 * Precedente de composição isolada: `src/lib/lab/bench/gateway/runtime.ts`.
 * Compõe uma instância **própria** de `AiGateway` para a capacidade
 * `campaign_product_image`, com um `AiAdapterRegistry` que registra o adapter
 * `UpstreamImagesAdapter` **apenas** para o protocolo `images`.
 *
 * ## Isolamento (D-07/D-20)
 *
 * O `defaultAdapterRegistry`, o `ImagesAdapter` legado, `createBenchGateway` e o
 * `PersistedModelResolver` **não são alterados** nem consultados. O resolver
 * deste runtime mapeia o **par configurado** (principal/fallback) para targets do
 * novo fluxo com protocolo `images`, sem consultar `ai_model_selection`.
 *
 * ## Fronteira (D-25)
 *
 * Este arquivo entrega apenas o **componente** de composição. A **ativação** e a
 * **orquestração real** (aplicar a política de tentativas sobre geração, snapshot
 * no início de campanha, não-débito de falha técnica) são da **F56.2**.
 */

/** Capacidade exclusiva do novo fluxo (D-11). */
const NEW_FLOW_CAPABILITY = "campaign_product_image" as const;
/** Provider do novo fluxo — os modelos elegíveis são `gpt-image-*` (D-02). */
const NEW_FLOW_PROVIDER = "openai" as const;
/** Protocolo de wire do novo fluxo. */
const NEW_FLOW_PROTOCOL = "images" as const;

/** Erro determinístico de capacidade não suportada pelo runtime do novo fluxo. */
export class NewFlowUnsupportedCapabilityError extends Error {
  readonly code = "new_flow_unsupported_capability" as const;

  constructor(capability: AiCapability) {
    super(`[new-flow-images] capacidade não suportada pelo runtime do novo fluxo: "${capability}"`);
    this.name = "NewFlowUnsupportedCapabilityError";
  }
}

function toTarget(pair: ImageModelPair): AiModelTarget {
  return {
    provider: NEW_FLOW_PROVIDER,
    model: pair.model,
    protocol: NEW_FLOW_PROTOCOL,
  };
}

/**
 * Resolver do novo fluxo: mapeia o par configurado (principal/fallback) para
 * targets `images`, validando cada par contra o catálogo elegível fechado
 * (fail-closed, D-02/D-06). Não consulta a seleção legada.
 */
export class NewFlowImageModelResolver implements AiModelResolver {
  constructor(private readonly pair: ImageModelPairConfig) {
    assertEligibleModelPair(pair.primary);
    assertEligibleModelPair(pair.fallback);
  }

  async resolve(capability: AiCapability): Promise<AiModelConfig> {
    if (capability !== NEW_FLOW_CAPABILITY) {
      throw new NewFlowUnsupportedCapabilityError(capability);
    }
    return {
      capability: NEW_FLOW_CAPABILITY,
      segment: "image",
      primary: toTarget(this.pair.primary),
      fallback: toTarget(this.pair.fallback),
    };
  }

  listCapabilities(): AiCapability[] {
    return [NEW_FLOW_CAPABILITY];
  }
}

/**
 * Registry do novo fluxo: registra o `UpstreamImagesAdapter` **apenas** para o
 * protocolo `images`. Não reutiliza nem altera o registry padrão.
 */
export function createNewFlowAdapterRegistry(): AiAdapterRegistry {
  const upstreamImages: AiAdapter = new UpstreamImagesAdapter();
  return {
    get: (protocol: AiProtocol) => (protocol === "images" ? upstreamImages : undefined),
  };
}

/**
 * Factory usada pelo orquestrador/orquestração futura (F56.2): compõe o gateway
 * do novo fluxo para `campaign_product_image` com o par configurado. O gateway
 * permanece **sem retry e sem fallback automático** (a decisão é do orquestrador).
 */
export function createNewFlowImageGateway(pair: ImageModelPairConfig): AiGateway {
  return new AiGateway(new NewFlowImageModelResolver(pair), createNewFlowAdapterRegistry());
}
