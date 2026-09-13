import "server-only";
import { EconomicParameterService } from "./economic-parameter-service";

export interface EconomicSnapshot {
  usdBrlRateAtGeneration: number | null;
  creditValueBrlAtGeneration: number | null;
}

/**
 * F38.2.1 (D3) / F46: resolve o snapshot econômico **UMA vez por run**
 * (best-effort) — valores vigentes naquele momento. APENAS valores; o tracker
 * define a origem `captured_at_generation` na gravação. Falha → log + null —
 * NUNCA bloqueia a geração.
 *
 * Helper único reutilizado por todos os callers que alimentam o
 * `AiTelemetryContext`/sink (evita que um caminho recém-instrumentado persista
 * `null` e caia no "parâmetro atual (fallback)" da apuração).
 */
export async function resolveEconomicSnapshot(
  logPrefix = "[economic-snapshot]"
): Promise<EconomicSnapshot> {
  try {
    const service = new EconomicParameterService();
    const [usd, credit] = await Promise.all([
      service.getParameter("usd_brl_rate"),
      service.getParameter("credit_value_brl"),
    ]);
    return {
      usdBrlRateAtGeneration: usd.value,
      creditValueBrlAtGeneration: credit.value,
    };
  } catch (err) {
    console.error(
      `${logPrefix} snapshot econômico indisponível (best-effort):`,
      err instanceof Error ? err.message : String(err)
    );
    return { usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null };
  }
}
