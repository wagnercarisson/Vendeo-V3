/**
 * F60.7 C2 — total exibido para a campanha conjunta.
 *
 * O contrato financeiro aprovado é de DUAS reservas de UM crédito (uma por
 * identidade). Este helper é apenas de apresentação/validação de UI; NÃO
 * altera reserva, RPC, `campaign_generation` ou pricing.
 */
export const TWO_FORMAT_CAMPAIGN_CREDITS = 2 as const;

export function twoFormatRequiredCredits(): number {
  return TWO_FORMAT_CAMPAIGN_CREDITS;
}
