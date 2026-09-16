import type {
  AiCapability,
  AiModelConfig,
  AiModelResolver,
  AiModelTarget,
} from "@/lib/ai/model-resolver";

/**
 * Resolver de modelo do Laboratório de IA (F48.1, D6/D18).
 *
 * O laboratório compõe uma instância **paralela** de gateway (nunca reabre o
 * gateway de produção) com este resolver injetado:
 *
 *  - `campaign_image` (a única capacidade invocada no run) recebe o **alvo fixo
 *    do experimento** — provider/model/protocolo congelados, **precedência
 *    absoluta** sobre qualquer seleção produtiva;
 *  - qualquer outra capacidade delega ao resolver padrão em **modo leitura**.
 *
 * O módulo **não** conhece a seleção persistida de modelos nem o catálogo nem
 * qualquer persistência: a única fonte do alvo em escopo é o `fixedTarget`
 * injetado. A seleção produtiva permanece inalterada (T-48-1-33).
 */

/** Código determinístico de alvo fixo inválido (provider/model/protocolo vazios). */
export const INVALID_FIXED_TARGET = "invalid_fixed_target";

export interface LabModelResolverParams {
  /** Alvo fixo e idêntico para as duas variantes do experimento. */
  fixedTarget: AiModelTarget;
  /** Resolver padrão consultado apenas fora do escopo (delegação read-only). */
  fallbackResolver: AiModelResolver;
}

export class LabModelResolver implements AiModelResolver {
  constructor(private readonly params: LabModelResolverParams) {}

  async resolve(capability: AiCapability): Promise<AiModelConfig> {
    if (capability !== "campaign_image") {
      return this.params.fallbackResolver.resolve(capability);
    }

    const target = this.params.fixedTarget;
    if (!target?.provider || !target?.model || !target?.protocol) {
      throw new Error(INVALID_FIXED_TARGET);
    }

    return {
      capability: "campaign_image",
      segment: "image",
      primary: {
        provider: target.provider,
        model: target.model,
        protocol: target.protocol,
      },
      // Sem alvo alternativo: o laboratório garante uma única chamada por run.
      fallback: undefined,
    };
  }

  listCapabilities(): AiCapability[] {
    return this.params.fallbackResolver.listCapabilities();
  }
}
