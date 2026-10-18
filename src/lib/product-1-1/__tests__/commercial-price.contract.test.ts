// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  isOfferMissingDiscountedPrice,
  positiveCentsOrUndefined,
  positivePriceTextBRL,
} from "../commercial-price";
import { buildCommercialFrame } from "@/lib/copy/mapper";
import { NewFlowGenerateImageRequestSchema } from "@/lib/image-generation/schema";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";

function newFlowBody(commercial: Record<string, unknown>) {
  return {
    storeId: STORE,
    productName: "Produto",
    campaignIntent: "spotlight",
    backgroundDirection: "studio",
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    productImageDataUrl: "data:image/png;base64,AAAA",
    ...commercial,
  };
}

describe("quick 261017-cdi — representação de preço (zero/ausente = ausência)", () => {
  it("positivePriceTextBRL: só preço POSITIVO vira texto; zero/ausente/negativo ⇒ null", () => {
    expect(positivePriceTextBRL(1990)).toBe("R$ 19,90");
    expect(positivePriceTextBRL(10000)).toBe("R$ 100,00");
    expect(positivePriceTextBRL(0)).toBeNull();
    expect(positivePriceTextBRL(undefined)).toBeNull();
    expect(positivePriceTextBRL(null)).toBeNull();
    expect(positivePriceTextBRL(-5)).toBeNull();
    expect(positivePriceTextBRL(Number.NaN)).toBeNull();
  });

  it("positiveCentsOrUndefined: só positivo; zero/ausente ⇒ undefined", () => {
    expect(positiveCentsOrUndefined(1990)).toBe(1990);
    expect(positiveCentsOrUndefined(0)).toBeUndefined();
    expect(positiveCentsOrUndefined(undefined)).toBeUndefined();
    expect(positiveCentsOrUndefined(null)).toBeUndefined();
    expect(positiveCentsOrUndefined(-5)).toBeUndefined();
  });

  it("isOfferMissingDiscountedPrice: paridade legada (oferta exige preço promocional)", () => {
    expect(isOfferMissingDiscountedPrice("offer", undefined)).toBe(true);
    expect(isOfferMissingDiscountedPrice("offer", 0)).toBe(true);
    expect(isOfferMissingDiscountedPrice("offer", 1990)).toBe(false);
    expect(isOfferMissingDiscountedPrice("spotlight", undefined)).toBe(false);
    expect(isOfferMissingDiscountedPrice("exclusive", undefined)).toBe(false);
  });

  it("COPY (commercialFrame): sem preço artificial — zero/ausente ⇒ sem R$", () => {
    expect(buildCommercialFrame("spotlight", { discountedPriceCents: undefined })).toBe(
      "Destaque do produto",
    );
    // Defensivo: mesmo se `0` chegasse, não vira "R$ 0,00".
    expect(buildCommercialFrame("spotlight", { discountedPriceCents: 0 })).toBe(
      "Destaque do produto",
    );
    expect(buildCommercialFrame("offer", {})).toBe("Oferta");
    expect(buildCommercialFrame("spotlight", { discountedPriceCents: 1990 })).toBe(
      "Destaque — R$ 19,90",
    );
  });
});

describe("quick 261017-cdi — contrato da API: tipos/negativos/malformados são RECUSADOS", () => {
  it("Destaque sem preço e com original 0 ⇒ VÁLIDO (ausência)", () => {
    expect(NewFlowGenerateImageRequestSchema.safeParse(newFlowBody({})).success).toBe(true);
    expect(
      NewFlowGenerateImageRequestSchema.safeParse(newFlowBody({ originalPriceCents: 0 })).success,
    ).toBe(true);
  });

  it.each([
    ["originalPriceCents negativo", { originalPriceCents: -1 }],
    ["discountedPriceCents zero", { discountedPriceCents: 0 }],
    ["discountedPriceCents negativo", { discountedPriceCents: -500 }],
    ["originalPriceCents null", { originalPriceCents: null }],
    ["discountedPriceCents null", { discountedPriceCents: null }],
    ["originalPriceCents fracionário", { originalPriceCents: 19.9 }],
    ["originalPriceCents string", { originalPriceCents: "1000" }],
    ["discountedPriceCents string", { discountedPriceCents: "1990" }],
  ])("recusa %s (não converte silenciosamente em ausência)", (_label, commercial) => {
    const result = NewFlowGenerateImageRequestSchema.safeParse(newFlowBody(commercial));
    expect(result.success).toBe(false);
  });

  it("Oferta sem promoção passa no SCHEMA (a regra é do servidor/rota, paridade legada)", () => {
    const body = { ...newFlowBody({}), campaignIntent: "offer" };
    expect(NewFlowGenerateImageRequestSchema.safeParse(body).success).toBe(true);
  });
});
