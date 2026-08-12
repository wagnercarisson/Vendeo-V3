/**
 * Parâmetros Econômicos (D1/D2) — F38.2.
 *
 * Chaves versionadas dos parâmetros econômicos configuráveis por admin.
 * Sem restrição de runtime — importável por zod/UI/route tests (D1: módulo
 * compartilhado, sem camada de servidor).
 *
 * Semântica (D1):
 * - `usd_brl_rate`: 1 USD = R$ X — converte o custo estimado do provider (D1)
 * - `credit_value_brl`: 1 crédito = R$ Y — estima a receita operacional interna (D1)
 * - Default/fallback de AMBOS: **1.00** (conservador — D1)
 */
export const ECONOMIC_PARAMETER_KEYS = [
  "usd_brl_rate",
  "credit_value_brl",
] as const;

export type EconomicParameterKey = (typeof ECONOMIC_PARAMETER_KEYS)[number];

/**
 * Resolução de um parâmetro econômico (D2):
 * `source: "table"` = valor da tabela `economic_parameters`;
 * `source: "fallback"` = linha inexistente → default seguro 1.00 (fail-open).
 */
export interface EconomicParameterResolution {
  key: EconomicParameterKey;
  value: number;
  source: "table" | "fallback";
}
