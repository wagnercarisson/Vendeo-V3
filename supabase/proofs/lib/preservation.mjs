// F56.2b2c (B2.3) — Classificador PURO de preservação da homologação.
//
// Distingue os EFEITOS ESPERADOS DAS PRÓPRIAS PROVAS (fixtures) de ALTERAÇÕES
// EXTERNAS (concorrência/gasto ocorrido durante o teste). A restauração só pode
// prosseguir quando o estado atual corresponde EXATAMENTE ao esperado; caso
// contrário, ABORTA (nunca sobrescreve gasto externo).
//
// Função pura (sem I/O) — testável localmente e reutilizada pelo script de provas.

/**
 * @param {object} input
 * @param {number} input.currentSpentUsd   acumulado ATUAL no singleton
 * @param {number} input.expectedSpentUsd  acumulado ESPERADO (snapshot + fixtures das provas)
 * @param {string|null} input.currentBlockedReason  bloqueio ATUAL
 * @param {string|null} input.expectedBlockedReason bloqueio ESPERADO (normalmente null)
 * @param {number} [input.epsilon] tolerância numérica (default 1e-9)
 * @returns {{ok:true} | {ok:false, reason:string}}
 */
export function classifyPreservation(input) {
  const epsilon = input.epsilon ?? 1e-9;
  const current = Number(input.currentSpentUsd);
  const expected = Number(input.expectedSpentUsd);
  if (!Number.isFinite(current) || !Number.isFinite(expected)) {
    return { ok: false, reason: "spent_not_finite" };
  }
  if (Math.abs(current - expected) > epsilon) {
    return { ok: false, reason: "spent_divergence" };
  }
  const currentBlocked = input.currentBlockedReason ?? null;
  const expectedBlocked = input.expectedBlockedReason ?? null;
  if (currentBlocked !== expectedBlocked) {
    return { ok: false, reason: "blocked_divergence" };
  }
  return { ok: true };
}
