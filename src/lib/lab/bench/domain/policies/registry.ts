import { BENCH_CONFIG_REGISTRY, type BenchRegistryDimension } from "../config-registry";
import { formato11Policy } from "./formato-1-1";
import { ofertaPolicy } from "./oferta";
import { pecaUnicaPolicy } from "./peca-unica";
import { produtoPolicy } from "./produto";
import { temaNenhumPolicy } from "./tema-nenhum";
import type { BenchPromptPolicy } from "./types";

/**
 * Registry das **políticas versionadas** de prompt da bancada (F48.2.4, D1/D2).
 *
 * Módulo **puro** — sem I/O, sem `process.env`, sem provider e sem client
 * Supabase. Mapeia cada dimensão do recorte para a política **habilitada**
 * correspondente. Habilitar combinações futuras = adicionar política + habilitar
 * o valor no registry de dimensões (`config-registry.ts`), **sem alterar o
 * núcleo** do compositor.
 *
 * Nesta fase, somente `oferta`, `1:1`, `produto`, `peca-unica` e `nenhum` estão
 * habilitadas; Destaque, Exclusivo, 9:16, serviço, informativo, temas e carrossel
 * permanecem desabilitados no `config-registry` (autoridade dos valores).
 */

/** Dimensões governadas por políticas de prompt (o `pipeline` não altera o texto). */
export const PROMPT_POLICY_DIMENSIONS = [
  "intencao",
  "formato",
  "tipoConteudo",
  "estrutura",
  "tema",
] as const;

export type BenchPromptPolicyDimension = (typeof PROMPT_POLICY_DIMENSIONS)[number];

/** Mapa dimensão → política habilitada (parcial: `pipeline` não tem política). */
export type BenchPromptPolicyRegistry = Readonly<
  Partial<Record<BenchPromptPolicyDimension, BenchPromptPolicy>>
>;

export const BENCH_PROMPT_POLICY_REGISTRY: BenchPromptPolicyRegistry = {
  intencao: ofertaPolicy,
  formato: formato11Policy,
  tipoConteudo: produtoPolicy,
  estrutura: pecaUnicaPolicy,
  tema: temaNenhumPolicy,
};

/** Valor habilitado de uma dimensão no registry de dimensões (autoridade). */
function enabledValue(dimension: BenchRegistryDimension): string | undefined {
  return BENCH_CONFIG_REGISTRY[dimension].find((entry) => entry.enabled)?.id;
}

/**
 * Validação fail-fast do registry de políticas (padrão `validateRegistry`): cada
 * dimensão do recorte precisa ter política, com `id`/`version` presentes,
 * `dimension` coerente e `value` igual ao valor habilitado no `config-registry`.
 */
export function validateBenchPromptPolicyRegistry(
  registry: BenchPromptPolicyRegistry = BENCH_PROMPT_POLICY_REGISTRY,
): void {
  for (const dimension of PROMPT_POLICY_DIMENSIONS) {
    const policy = registry[dimension];
    if (!policy) {
      throw new Error(
        `[bench-prompt-policy-registry] dimensão habilitada sem política: ${dimension}`,
      );
    }
    if (!policy.id || !policy.version) {
      throw new Error(
        `[bench-prompt-policy-registry] política sem id/versão em ${dimension}`,
      );
    }
    if (policy.dimension !== dimension) {
      throw new Error(
        `[bench-prompt-policy-registry] dimensão divergente em ${dimension}: ${policy.dimension}`,
      );
    }
    const enabled = enabledValue(dimension);
    if (enabled === undefined || policy.value !== enabled) {
      throw new Error(
        `[bench-prompt-policy-registry] política de ${dimension} não cobre o valor habilitado (${
          enabled ?? "nenhum"
        })`,
      );
    }
  }
}

// Validação no carregamento (fail-fast em registry inválido).
validateBenchPromptPolicyRegistry();
