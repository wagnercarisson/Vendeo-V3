/**
 * F56.2b2c (B2.3) — Classificador PURO de preservação da homologação.
 *
 * Distingue os EFEITOS ESPERADOS das PRÓPRIAS PROVAS (fixtures efetivamente
 * confirmadas) de ALTERAÇÕES EXTERNAS. A restauração só prossegue quando o estado
 * atual corresponde EXATAMENTE ao esperado em TODOS os campos que serão restaurados;
 * qualquer divergência ⇒ ABORTA (nunca sobrescreve estado externo).
 *
 * Espelhado em `supabase/proofs/lib/preservation.mjs`.
 */
export type PreservationVerdict = { ok: true } | { ok: false; reason: string };

export interface PreservationState {
  readonly spent_usd: number | string | null;
  readonly cap_usd: number | string | null;
  readonly cap_set_by: string | null;
  readonly cap_reason: string | null;
  readonly cap_operation_id: string | null;
  readonly cap_set_at: string | Date | null;
  readonly blocked_reason: string | null;
  readonly blocked_at: string | Date | null;
}

export interface PreservationInput {
  readonly current: PreservationState;
  readonly expected: PreservationState;
  readonly epsilon?: number;
}

function norm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function classifyPreservation(input: PreservationInput): PreservationVerdict {
  const epsilon = input.epsilon ?? 1e-9;
  const curSpent = Number(input.current.spent_usd);
  const expSpent = Number(input.expected.spent_usd);
  if (!Number.isFinite(curSpent) || !Number.isFinite(expSpent)) {
    return { ok: false, reason: "spent_not_finite" };
  }
  if (Math.abs(curSpent - expSpent) > epsilon) {
    return { ok: false, reason: "spent_divergence" };
  }
  const curCap = numOrNull(input.current.cap_usd);
  const expCap = numOrNull(input.expected.cap_usd);
  if (curCap === null || expCap === null) {
    if (curCap !== expCap) return { ok: false, reason: "cap_usd_divergence" };
  } else if (!Number.isFinite(curCap) || !Number.isFinite(expCap) || Math.abs(curCap - expCap) > epsilon) {
    return { ok: false, reason: "cap_usd_divergence" };
  }
  const fields: Array<keyof PreservationState> = [
    "cap_set_by",
    "cap_reason",
    "cap_operation_id",
    "cap_set_at",
    "blocked_reason",
    "blocked_at",
  ];
  for (const field of fields) {
    if (norm(input.current[field]) !== norm(input.expected[field])) {
      return { ok: false, reason: `${field}_divergence` };
    }
  }
  return { ok: true };
}
