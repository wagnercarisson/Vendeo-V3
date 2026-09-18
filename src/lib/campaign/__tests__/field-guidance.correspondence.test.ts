import { describe, it, expect } from "vitest";
import { inferIntent } from "@/components/flow/use-campaign-form";
import type { CampaignIntent } from "@/lib/campaign/types";
import { formatCurrencyBRL } from "@/lib/formatters";
import { priceFeedbackMessage } from "../field-guidance";

/**
 * Espelho LITERAL da expressão real de `availableOptions` do `IntentSelector`
 * em `src/components/flow/campaign-input-form.tsx` (bloco
 * `availableOptions={...}`). Mantido aqui apenas para provar que o feedback
 * dinâmico não promete um intent fora das opções reais — a fonte da verdade
 * continua sendo o componente (D9/D14, T-49-06).
 */
function availableOptionsFor(
  originalPriceCents: number,
  discountedPriceCents: number | undefined,
): CampaignIntent[] {
  const inferred = inferIntent(originalPriceCents, discountedPriceCents);
  if (inferred === "offer") return ["offer"];
  if (
    discountedPriceCents !== undefined &&
    (discountedPriceCents ?? 0) > 0
  ) {
    return ["offer", "spotlight"];
  }
  return ["spotlight", "exclusive"];
}

/**
 * Intents que a mensagem afirma que a campanha poderá assumir. O estado
 * "só preço anterior" é uma orientação neutra e não promete intent algum.
 */
function promisedIntents(message: string): CampaignIntent[] {
  if (message.includes("será apresentada como oferta")) return ["offer"];
  if (message.includes("escolher entre Oferta e Destaque")) {
    return ["offer", "spotlight"];
  }
  if (message.includes("será de Destaque ou Exclusividade")) {
    return ["spotlight", "exclusive"];
  }
  return [];
}

describe("campaign field-guidance — correspondência com inferIntent/availableOptions (F49, D9/D14)", () => {
  it("dois preços: oferta, opções só de oferta e feedback com os valores formatados", () => {
    const original = 10000;
    const discounted = 8000;
    const options = availableOptionsFor(original, discounted);
    const feedback = priceFeedbackMessage(original, discounted);

    expect(inferIntent(original, discounted)).toBe("offer");
    expect(options).toEqual(["offer"]);
    expect(feedback).toContain("oferta");
    expect(feedback).toContain(formatCurrencyBRL(original));
    expect(feedback).toContain(formatCurrencyBRL(discounted));
  });

  it("só preço de venda: spotlight, opções Oferta+Destaque e feedback citando ambos", () => {
    const options = availableOptionsFor(0, 8000);
    const feedback = priceFeedbackMessage(0, 8000);

    expect(inferIntent(0, 8000)).toBe("spotlight");
    expect(options).toEqual(["offer", "spotlight"]);
    expect(feedback).toContain("Oferta e Destaque");
  });

  it("só preço anterior: caminho sem preço preservado, opções Destaque+Exclusividade e feedback neutro", () => {
    const options = availableOptionsFor(10000, undefined);
    const feedback = priceFeedbackMessage(10000, undefined);

    expect(inferIntent(10000, undefined)).toBe("exclusive");
    expect(options).toEqual(["spotlight", "exclusive"]);
    expect(feedback).toBe("Informe o preço de venda para completar a oferta.");
    expect(feedback).not.toContain("Sem preço");
    expect(feedback).not.toContain("Destaque ou Exclusividade");
  });

  it("nenhum preço: exclusive, opções Destaque+Exclusividade e feedback citando ambos", () => {
    const options = availableOptionsFor(0, undefined);
    const feedback = priceFeedbackMessage(0, undefined);

    expect(inferIntent(0, undefined)).toBe("exclusive");
    expect(options).toEqual(["spotlight", "exclusive"]);
    expect(feedback).toContain("Destaque ou Exclusividade");
  });

  it("nenhuma mensagem promete intent fora das opções reais em nenhum dos 4 estados", () => {
    const states = [
      { original: 10000, discounted: 8000 },
      { original: 0, discounted: 8000 },
      { original: 10000, discounted: undefined },
      { original: 0, discounted: undefined },
    ] as const;

    for (const { original, discounted } of states) {
      const options = availableOptionsFor(original, discounted);
      const promised = promisedIntents(
        priceFeedbackMessage(original, discounted),
      );
      for (const intent of promised) {
        expect(options).toContain(intent);
      }
    }
  });

  it("o estado neutro (só preço anterior) não promete intent algum", () => {
    expect(promisedIntents(priceFeedbackMessage(10000, undefined))).toEqual([]);
  });
});
