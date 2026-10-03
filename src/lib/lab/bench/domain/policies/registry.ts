import { BENCH_CONFIG_REGISTRY } from "../config-registry";
import { formato11Policy } from "./formato-1-1";
import { destaquePolicy } from "./destaque";
import { exclusivoPolicy } from "./exclusivo";
import { ofertaPolicy } from "./oferta";
import { pecaUnicaPolicy } from "./peca-unica";
import { produtoPolicy } from "./produto";
import { temaNenhumPolicy } from "./tema-nenhum";
import type { BenchPromptPolicy } from "./types";

/**
 * Registry das **políticas versionadas** de prompt da bancada (F48.2.4, D1/D2).
 *
 * Módulo **puro** — sem I/O, sem `process.env`, sem provider e sem client
 * Supabase. Mapeia dimensão → valor → política habilitada.
 *
 * Somente as três intenções em `produto` + `1:1` + peça única + tema neutro
 * estão habilitadas; demais valores continuam desabilitados no config-registry.
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

/** Mapa dimensão → valor → política habilitada (`pipeline` não tem política). */
export type BenchPromptPolicyRegistry = Readonly<
  Partial<Record<BenchPromptPolicyDimension, Readonly<Record<string, BenchPromptPolicy>>>>
>;

export const BENCH_PROMPT_POLICY_REGISTRY: BenchPromptPolicyRegistry = {
  intencao: { oferta: ofertaPolicy, destaque: destaquePolicy, exclusivo: exclusivoPolicy },
  formato: { "1:1": formato11Policy },
  tipoConteudo: { produto: produtoPolicy },
  estrutura: { "peca-unica": pecaUnicaPolicy },
  tema: { nenhum: temaNenhumPolicy },
};

/**
 * Validação fail-fast do registry de políticas (padrão `validateRegistry`): cada
 * dimensão do recorte precisa ter política, com `id`/`version` presentes,
 * `dimension` coerente e `value` igual ao valor habilitado no `config-registry`.
 */
export function validateBenchPromptPolicyRegistry(
  registry: BenchPromptPolicyRegistry = BENCH_PROMPT_POLICY_REGISTRY,
): void {
  for (const dimension of PROMPT_POLICY_DIMENSIONS) {
    for (const entry of BENCH_CONFIG_REGISTRY[dimension].filter((item) => item.enabled)) {
      const policy = registry[dimension]?.[entry.id];
      if (!policy) {
        throw new Error(`[bench-prompt-policy-registry] dimensão habilitada sem política: ${dimension}=${entry.id}`);
      }
      if (!policy.id || !policy.version || policy.dimension !== dimension || policy.value !== entry.id) {
        throw new Error(`[bench-prompt-policy-registry] política inválida em ${dimension}=${entry.id}`);
      }
    }
  }
}

// Validação no carregamento (fail-fast em registry inválido).
validateBenchPromptPolicyRegistry();
