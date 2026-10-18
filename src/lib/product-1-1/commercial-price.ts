/**
 * Quick 261017-cdi — Representação de preço do NOVO fluxo (Produto 1:1).
 *
 * Regra: **zero/ausente = ausência** de preço (nunca "R$ 0,00", nunca gratuidade).
 * Apenas preço POSITIVO vira valor monetário no briefing e no contexto de copy.
 *
 * A validação de tipos/negativos/malformados pertence ao CONTRATO da API
 * (`GenerateImageRequestSchema`/`NewFlowGenerateImageRequestSchema`): valores
 * negativos, não-inteiros, de tipo errado ou `null` são RECUSADOS (400) e nunca
 * chegam aqui — por isso estas funções são apenas normalizadores defensivos.
 */

/** Texto monetário SOMENTE para centavos positivos; caso contrário `null`. */
export function positivePriceTextBRL(cents: number | null | undefined): string | null {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) {
    return null;
  }
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/** Centavos SOMENTE quando positivos; caso contrário `undefined` (ausência). */
export function positiveCentsOrUndefined(
  cents: number | null | undefined,
): number | undefined {
  return typeof cents === "number" && Number.isFinite(cents) && cents > 0
    ? cents
    : undefined;
}

/**
 * Paridade com a regra LEGADA: Oferta exige preço promocional (`discountedPriceCents`)
 * presente e positivo. `!discounted` cobre ausente/`0`; negativos/não-inteiros já
 * foram recusados pelo schema (positivo). NÃO cria regra nova.
 */
export function isOfferMissingDiscountedPrice(
  intent: string | undefined,
  discountedPriceCents: number | undefined,
): boolean {
  return intent === "offer" && !discountedPriceCents;
}
