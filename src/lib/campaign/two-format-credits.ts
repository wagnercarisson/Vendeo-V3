/**
 * F60.7 C2 — total exibido para a campanha conjunta.
 *
 * O contrato financeiro aprovado é de DUAS reservas de UM crédito (uma por
 * identidade). Este helper é apenas de apresentação/validação de UI; NÃO
 * altera reserva, RPC, `campaign_generation` ou pricing.
 */
export const TWO_FORMAT_CAMPAIGN_CREDITS = 2 as const;

export type PresentedCreditsFormat = "1:1" | "9:16" | "1:1+9:16";

export function twoFormatRequiredCredits(): number {
  return TWO_FORMAT_CAMPAIGN_CREDITS;
}

/**
 * Custo APRESENTADO ao usuário para o formato efetivo.
 *
 * - conjunto (`1:1+9:16`) ⇒ 2 créditos;
 * - individuais (`1:1`/`9:16`) ⇒ custo individual já carregado de
 *   `campaign_generation`;
 * - custo individual desconhecido ⇒ `undefined` (o chamador mantém o gate).
 *
 * É estritamente apresentação: não substitui `costStatus`, `enabled` nem o
 * saldo. Os consumidores continuam bloqueando carregando/indisponível/
 * operação desativada/saldo desconhecido ANTES de usar este valor.
 */
export function resolvePresentedCredits(
  format: PresentedCreditsFormat | null | undefined,
  individualCredits: number | null | undefined,
): number | undefined {
  if (format === "1:1+9:16") return TWO_FORMAT_CAMPAIGN_CREDITS;
  return individualCredits ?? undefined;
}
