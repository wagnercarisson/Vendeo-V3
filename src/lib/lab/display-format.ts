/**
 * Formatação de exibição do Laboratório de IA (F48.2.1).
 *
 * **Somente apresentação.** Os cálculos internos (estimativa, teto, saldo)
 * permanecem com precisão total (6 casas em `estimate.ts`); a UI exibe valores
 * monetários arredondados para {@link DISPLAY_USD_DECIMALS} casas — ex.:
 * `US$ 2.81`, `US$ 8.42`. Módulo **puro** (sem `server-only`, sem I/O), importável
 * por componentes cliente e por testes.
 */

/** Casas decimais exibidas na UI para valores monetários. */
export const DISPLAY_USD_DECIMALS = 2;

/** `US$ 2.81` — valor monetário arredondado para exibição (nunca cálculo). */
export function formatUsdDisplay(value: number): string {
  return `US$ ${value.toFixed(DISPLAY_USD_DECIMALS)}`;
}
