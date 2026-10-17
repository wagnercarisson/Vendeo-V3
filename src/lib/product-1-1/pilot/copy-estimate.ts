/**
 * Quick gpt6-luna — estimativa CONSERVADORA da copy (opção 2), pura e sem
 * dependência de servidor/env. Derivada do pricing do ALVO efetivamente
 * resolvido; usada pelo serviço de gasto do piloto.
 */

/** LIMITE DE SAÍDA da NOSSA copy (tokens) — preservado (não é a capacidade do modelo). */
export const PILOT_COPY_MAX_OUTPUT_TOKENS = 1000;

/**
 * Premissa **CONSERVADORA de ENTRADA** (tokens) — **SUPOSIÇÃO documentada**, NÃO
 * um limite garantido. Dimensiona apenas a estimativa do piloto.
 */
export const PILOT_COPY_CONSERVATIVE_INPUT_TOKENS = 2000;

export interface PilotCopyPricing {
  readonly inputUsdPer1M: number;
  readonly outputUsdPer1M: number;
}

/**
 * Estimativa conservadora (USD) do alvo de copy a partir do SEU pricing.
 * `null` quando ausente/inválido (o piloto BLOQUEIA — nunca US$ 0).
 */
export function computeCopyEstimate(
  pricing: PilotCopyPricing | null | undefined,
): number | null {
  if (!pricing) return null;
  const { inputUsdPer1M, outputUsdPer1M } = pricing;
  if (
    !Number.isFinite(inputUsdPer1M) ||
    !Number.isFinite(outputUsdPer1M) ||
    inputUsdPer1M <= 0 ||
    outputUsdPer1M <= 0
  ) {
    return null;
  }
  return (
    (PILOT_COPY_CONSERVATIVE_INPUT_TOKENS * inputUsdPer1M +
      PILOT_COPY_MAX_OUTPUT_TOKENS * outputUsdPer1M) /
    1_000_000
  );
}
