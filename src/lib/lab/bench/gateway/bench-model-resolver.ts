import type { AiCapability, AiModelConfig, AiModelResolver } from "@/lib/ai/model-resolver";
import { resolveBenchPreset, type BenchPreset } from "../domain/preset-registry";

/**
 * Resolver de modelo do **harness da bancada** (F48.2.2, D8).
 *
 * Módulo **puro, sem persistência**: a única fonte do alvo é o **preset
 * habilitado** (`preset-registry.ts`, via `resolveBenchPreset`). A seleção
 * produtiva persistida **nunca** é consultada — o alvo vem exclusivamente do
 * preset (T-48-2-2-27).
 *
 * Invocação **single-shot**: `fallback: undefined` — sem alvo alternativo, sem
 * retry oculto e sem segunda chamada paga por geração (T-48-2-2-26). No primeiro
 * recorte apenas o caminho direto confirmado (`images`) está habilitado; presets
 * com protocolo não confirmado permanecem desabilitados no registry e são
 * recusados aqui (`preset_not_enabled`).
 */

/** Código determinístico de alvo de preset inválido (provider/model/protocolo vazios ou divergentes). */
export const INVALID_BENCH_TARGET = "invalid_bench_target";

export interface BenchPresetResolverParams {
  /** Preset habilitado (obtido por `resolveBenchPreset`). */
  preset: BenchPreset;
  /** Resolver padrão consultado apenas fora da capability do preset (delegação read-only). */
  fallbackResolver: AiModelResolver;
}

export class BenchPresetResolver implements AiModelResolver {
  constructor(private readonly params: BenchPresetResolverParams) {}

  async resolve(capability: AiCapability): Promise<AiModelConfig> {
    if (capability !== this.params.preset.capability) {
      return this.params.fallbackResolver.resolve(capability);
    }

    // O alvo vem EXCLUSIVAMENTE do preset habilitado. `resolveBenchPreset`
    // recusa preset inexistente/desabilitado com `preset_not_enabled` (nenhuma
    // leitura da seleção produtiva e nenhuma consulta ao catálogo em runtime).
    const resolved = resolveBenchPreset(this.params.preset.id);
    if (
      !resolved.provider ||
      !resolved.model ||
      !resolved.protocol ||
      resolved.provider !== this.params.preset.provider ||
      resolved.model !== this.params.preset.model ||
      resolved.protocol !== this.params.preset.protocol
    ) {
      throw new Error(INVALID_BENCH_TARGET);
    }

    return {
      capability: resolved.capability,
      segment: "image",
      primary: {
        provider: resolved.provider,
        model: resolved.model,
        protocol: resolved.protocol,
      },
      // Sem alvo alternativo: o harness garante uma única chamada por geração.
      fallback: undefined,
    };
  }

  listCapabilities(): AiCapability[] {
    return this.params.fallbackResolver.listCapabilities();
  }
}
