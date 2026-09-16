/**
 * Constantes de limite do domínio do Laboratório de IA (F48.1, D14).
 *
 * Fonte única dos limites do laboratório: domínio, API, UI e banco devem
 * referenciar estas constantes em vez de repetir literais. Módulo **puro** —
 * sem dependências e sem `server-only`, para ser importável por UI, serviços e
 * testes.
 */

/** Rejeita um experimento com mais cenários do que este valor. */
export const MAX_SCENARIOS_PER_EXPERIMENT = 3 as const;

/** Rejeita `repetitions` acima deste valor (1..3). */
export const MAX_REPETITIONS = 3 as const;

/** Teto absoluto de execuções (budget) por experimento. */
export const MAX_RUNS_PER_EXPERIMENT = 12 as const;

/** Default de `max_runs` na criação do experimento (nunca acima do teto). */
export const DEFAULT_MAX_RUNS_PER_EXPERIMENT = 6 as const;

/** No máximo um run ativo em todo o laboratório (exclusão mútua global). */
export const MAX_CONCURRENT_LAB_RUNS = 1 as const;

/** Idade a partir da qual um run `pending`/`running` é considerado órfão (15 min). */
export const LAB_RUN_STALE_MS = 900000 as const;

/** Idade mínima (em dias) para o cleanup manual de artefatos elegíveis. */
export const LAB_ARTIFACT_RETENTION_DAYS = 30 as const;
