import { resolveBenchConfig } from "../config-registry";
import type { BenchConfig } from "../schemas";
import { generalIntegrityPolicy } from "./general-integrity";
import {
  BENCH_PROMPT_POLICY_REGISTRY,
  PROMPT_POLICY_DIMENSIONS,
  type BenchPromptPolicyRegistry,
} from "./registry";
import type { BenchPromptContribution } from "./types";

/**
 * Resolução explícita e **fail-closed** das políticas de dimensão (F48.2.4, D2),
 * mais a política geral versionada e independente de dimensão (F48.2.5, D4).
 *
 * Módulo **puro** — sem I/O, sem `process.env`, sem provider e sem client
 * Supabase. Percorre as dimensões do recorte (`intencao`, `formato`,
 * `tipoConteudo`, `estrutura`, `tema`) e resolve a política habilitada de cada uma
 * pelo registry. Se uma dimensão habilitada **não** possuir política implementada,
 * a resolução lança `bench_policy_not_implemented` **antes** de qualquer chamada
 * paga (sem fallback/improvisação).
 *
 * Os valores habilitados/desabilitados são validados antes por
 * `resolveBenchConfig` (autoridade do `config-registry`): uma combinação
 * desabilitada (Destaque, Exclusivo, 9:16, serviço, informativo, tema, carrossel)
 * falha deterministicamente **antes** de produzir qualquer contribuição.
 */

export type BenchPromptPolicyErrorCode = "bench_policy_not_implemented";

/**
 * Lançado quando uma dimensão habilitada no `config-registry` não possui política
 * implementada no registry de políticas (`bench_policy_not_implemented`).
 * Fail-closed: a composição não prossegue, sem fallback.
 */
export class BenchPromptPolicyError extends Error {
  readonly code: BenchPromptPolicyErrorCode = "bench_policy_not_implemented";
  readonly dimension: string;
  readonly value: string;

  constructor(params: { dimension: string; value: string }) {
    super(`bench_policy_not_implemented:${params.dimension}=${params.value}`);
    this.name = "BenchPromptPolicyError";
    this.dimension = params.dimension;
    this.value = params.value;
  }
}

/** Contribuições resolvidas + versões por dimensão e da política geral (preflight). */
export interface ResolvedBenchPromptPolicies {
  readonly contributions: readonly BenchPromptContribution[];
  readonly versions: Readonly<Record<string, string>>;
}

/**
 * Resolve as políticas habilitadas a partir da configuração multidimensional e
 * inclui exatamente uma vez a política geral de integridade textual.
 * A configuração é validada pelo `config-registry` (valores desconhecidos/
 * desabilitados falham ali); dimensões habilitadas sem política falham aqui com
 * `bench_policy_not_implemented`. Determinístico: mesma entrada ⇒ mesma saída.
 *
 * O parâmetro opcional `registry` permite compor registries em testes.
 */
export function resolveBenchPromptPolicies(
  config: BenchConfig,
  registry: BenchPromptPolicyRegistry = BENCH_PROMPT_POLICY_REGISTRY,
): ResolvedBenchPromptPolicies {
  // Autoridade dos valores: recusa valor desconhecido/desabilitado antes de
  // resolver qualquer política.
  const resolved = resolveBenchConfig(config);

  const contributions: BenchPromptContribution[] = [];
  const versions: Record<string, string> = {};

  for (const dimension of PROMPT_POLICY_DIMENSIONS) {
    const value = resolved[dimension];
    const policy = registry[dimension];
    if (!policy || policy.value !== value) {
      throw new BenchPromptPolicyError({ dimension, value });
    }
    versions[dimension] = policy.version;
    contributions.push(...policy.contributions({ config: resolved }));
  }

  // Política linguística geral, independente das dimensões configuráveis. Tem
  // versão própria para invalidar o preflight sem criar uma nova dimensão.
  contributions.push(...generalIntegrityPolicy.contributions());
  versions.geral = generalIntegrityPolicy.version;

  return { contributions, versions };
}
