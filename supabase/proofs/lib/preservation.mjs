// F56.2b2c (B2.3) — Classificador PURO de preservação (espelho de
// `src/lib/product-1-1/pilot/spend-preservation.ts`). Compara TODOS os campos que
// serão restaurados; qualquer divergência ⇒ ABORTA (não sobrescreve estado externo).

function norm(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function numOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function classifyPreservation(input) {
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
  for (const field of ["cap_set_by", "cap_reason", "cap_operation_id", "cap_set_at", "blocked_reason", "blocked_at"]) {
    if (norm(input.current[field]) !== norm(input.expected[field])) {
      return { ok: false, reason: `${field}_divergence` };
    }
  }
  return { ok: true };
}
