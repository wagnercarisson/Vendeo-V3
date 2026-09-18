/**
 * Conteúdo de orientação dos campos da campanha (F49, D8/D9/D10/D11/D14) —
 * labels/hints/exemplos de descrição do produto, preços (labels, hints e as 3
 * regras reais de intenção), feedback dinâmico de preço e informações
 * obrigatórias na arte.
 *
 * Módulo puro: sem JSX, sem runtime de UI, sem ambiente de servidor, sem
 * imports de side-effect. Fonte única das strings consumidas pelo formulário de
 * campanha e pelos testes — nenhuma cópia divergente.
 *
 * O feedback dinâmico espelha a classificação real de `inferIntent` e das
 * `availableOptions`, sem importar módulo client (fence D9/D14). Nenhuma
 * validação nova é criada aqui; nenhum estado é mutado (T-49-06, Elevation of
 * Privilege).
 */

import { formatCurrencyBRL } from "@/lib/formatters";

/** Label da descrição do produto (D8) — campo `fields.description`. */
export const PRODUCT_DESCRIPTION_LABEL = "Descrição do produto";

/** Microcopy da descrição do produto (D8). */
export const PRODUCT_DESCRIPTION_HINT =
  "Descreva características, benefícios ou formas de uso que ajudam a apresentar o produto na comunicação da campanha.";

/** Placeholder real de produto (D8). */
export const PRODUCT_DESCRIPTION_PLACEHOLDER =
  "Ex.: Tênis leve para corrida e uso diário, com solado antiderrapante.";

/** Label do preço anterior/original (D9) — chave `originalPriceCents`. */
export const ORIGINAL_PRICE_LABEL = "Preço anterior (original)";

/** Label do preço de venda/final (D9) — chave `discountedPriceCents`. */
export const DISCOUNTED_PRICE_LABEL = "Preço de venda (final)";

/** Hint do preço anterior (D9) — valor "de" riscado. */
export const ORIGINAL_PRICE_HINT =
  "Valor “de” que aparece riscado na campanha, antes do desconto.";

/** Hint do preço de venda (D9) — valor que o cliente paga. */
export const DISCOUNTED_PRICE_HINT =
  "Valor que o cliente realmente paga pela oferta.";

/** Título da ajuda expansível de preços (D9). */
export const PRICE_HELP_TITLE = "Como os preços mudam a campanha?";

/** As 3 regras reais de intenção preservadas na ajuda expansível (D9). */
export const PRICE_HELP_RULES: readonly string[] = [
  "Preço anterior + preço de venda = Oferta",
  "Somente preço de venda = Oferta ou Destaque",
  "Sem nenhum preço preenchido = Destaque ou Exclusividade",
];

/** Label das informações obrigatórias na arte (D10). */
export const MANDATORY_ARTWORK_LABEL = "Informações obrigatórias na arte";

/** Microcopy positiva das informações obrigatórias na arte (D10). */
export const MANDATORY_ARTWORK_HINT =
  "Informe características, detalhes ou restrições que precisam aparecer na imagem. Use preferencialmente uma linha para cada item.";

/** Placeholder multi-linha com exemplo real, incluindo uma restrição (D10). */
export const MANDATORY_ARTWORK_PLACEHOLDER =
  "Intensidade 8\nTorra clássica\nVenda proibida para menores";

/**
 * Feedback dinâmico de preço (D9) — função pura derivada dos valores
 * preenchidos, espelhando exatamente a classificação real de `inferIntent`:
 * 4 estados, incluindo o intermediário "só preço anterior" com mensagem neutra
 * (nunca "Sem preço...").
 */
export function priceFeedbackMessage(
  originalPriceCents: number,
  discountedPriceCents: number | undefined | null,
): string {
  const hasOriginal = originalPriceCents > 0;
  const hasDiscounted = (discountedPriceCents ?? 0) > 0;

  if (hasOriginal && hasDiscounted) {
    return (
      "A campanha será apresentada como oferta: de " +
      formatCurrencyBRL(originalPriceCents) +
      " por " +
      formatCurrencyBRL(discountedPriceCents as number) +
      "."
    );
  }
  if (hasDiscounted) {
    return "Com apenas o preço de venda, você poderá escolher entre Oferta e Destaque.";
  }
  if (hasOriginal) {
    return "Informe o preço de venda para completar a oferta.";
  }
  return "Sem preço, a campanha será de Destaque ou Exclusividade.";
}
