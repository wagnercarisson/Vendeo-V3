import { describe, it, expect } from "vitest";
import { formatCurrencyBRL } from "@/lib/formatters";
import {
  priceFeedbackMessage,
  PRICE_HELP_RULES,
  PRICE_HELP_TITLE,
  PRODUCT_DESCRIPTION_LABEL,
  PRODUCT_DESCRIPTION_HINT,
  PRODUCT_DESCRIPTION_PLACEHOLDER,
  ORIGINAL_PRICE_LABEL,
  DISCOUNTED_PRICE_LABEL,
  ORIGINAL_PRICE_HINT,
  DISCOUNTED_PRICE_HINT,
  MANDATORY_ARTWORK_LABEL,
  MANDATORY_ARTWORK_HINT,
  MANDATORY_ARTWORK_PLACEHOLDER,
} from "../field-guidance";

describe("campaign field-guidance — feedback dinâmico de preço (F49, D9/D14)", () => {
  it("dois preços → oferta citando os valores formatados em BRL", () => {
    expect(priceFeedbackMessage(10000, 8000)).toBe(
      "A campanha será apresentada como oferta: de " +
        formatCurrencyBRL(10000) +
        " por " +
        formatCurrencyBRL(8000) +
        ".",
    );
  });

  it("só preço de venda → Oferta ou Destaque", () => {
    expect(priceFeedbackMessage(0, 8000)).toBe(
      "Com apenas o preço de venda, você poderá escolher entre Oferta e Destaque.",
    );
  });

  it("só preço anterior → mensagem neutra e nunca 'Sem preço'", () => {
    const message = priceFeedbackMessage(10000, undefined);
    expect(message).toBe(
      "Informe o preço de venda para completar a oferta.",
    );
    expect(message).not.toContain("Sem preço");
  });

  it("nenhum preço → Destaque ou Exclusividade", () => {
    expect(priceFeedbackMessage(0, undefined)).toBe(
      "Sem preço, a campanha será de Destaque ou Exclusividade.",
    );
  });

  it("trata discounted nulo e zero como ausente", () => {
    expect(priceFeedbackMessage(10000, null)).toBe(
      "Informe o preço de venda para completar a oferta.",
    );
    expect(priceFeedbackMessage(10000, 0)).toBe(
      "Informe o preço de venda para completar a oferta.",
    );
  });

  it("PRICE_HELP_RULES preserva exatamente as 3 regras reais", () => {
    expect(PRICE_HELP_RULES).toHaveLength(3);
    expect([...PRICE_HELP_RULES]).toEqual([
      "Preço anterior + preço de venda = Oferta",
      "Somente preço de venda = Oferta ou Destaque",
      "Sem nenhum preço preenchido = Destaque ou Exclusividade",
    ]);
    expect(PRICE_HELP_TITLE).toBe("Como os preços mudam a campanha?");
  });

  it("MANDATORY_ARTWORK_PLACEHOLDER tem 3 linhas de exemplo", () => {
    expect(MANDATORY_ARTWORK_PLACEHOLDER.split("\n")).toHaveLength(3);
  });

  it("todas as strings de label/hint são não vazias", () => {
    for (const text of [
      PRODUCT_DESCRIPTION_LABEL,
      PRODUCT_DESCRIPTION_HINT,
      PRODUCT_DESCRIPTION_PLACEHOLDER,
      ORIGINAL_PRICE_LABEL,
      DISCOUNTED_PRICE_LABEL,
      ORIGINAL_PRICE_HINT,
      DISCOUNTED_PRICE_HINT,
      MANDATORY_ARTWORK_LABEL,
      MANDATORY_ARTWORK_HINT,
      MANDATORY_ARTWORK_PLACEHOLDER,
    ]) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});
