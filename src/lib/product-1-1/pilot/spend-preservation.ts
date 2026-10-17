/**
 * F56.2b2c (B2.3) — Classificador PURO de preservação da homologação.
 *
 * Distingue os EFEITOS ESPERADOS das PRÓPRIAS PROVAS (fixtures) de ALTERAÇÕES
 * EXTERNAS (concorrência/gasto durante o teste). A restauração só prossegue quando o
 * estado atual corresponde EXATAMENTE ao esperado; caso contrário, ABORTA (nunca
 * sobrescreve gasto externo). Espelhado em `supabase/proofs/lib/preservation.mjs`.
 */
export type PreservationVerdict = { ok: true } | { ok: false; reason: string };

export interface PreservationInput {
  readonly currentSpentUsd: number;
  readonly expectedSpentUsd: number;
  readonly currentBlockedReason: string | null;
  readonly expectedBlockedReason: string | null;
  readonly epsilon?: number;
}

export function classifyPreservation(input: PreservationInput): PreservationVerdict {
  const epsilon = input.epsilon ?? 1e-9;
  const current = Number(input.currentSpentUsd);
  const expected = Number(input.expectedSpentUsd);
  if (!Number.isFinite(current) || !Number.isFinite(expected)) {
    return { ok: false, reason: "spent_not_finite" };
  }
  if (Math.abs(current - expected) > epsilon) {
    return { ok: false, reason: "spent_divergence" };
  }
  if ((input.currentBlockedReason ?? null) !== (input.expectedBlockedReason ?? null)) {
    return { ok: false, reason: "blocked_divergence" };
  }
  return { ok: true };
}
