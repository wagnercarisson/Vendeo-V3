// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { validateDiscountedPrice, validateBadge } from "../use-campaign-form";

describe("validateDiscountedPrice", () => {
  it("returns error when campaignIntent is 'offer' and value is 0", () => {
    expect(validateDiscountedPrice(0, { campaignIntent: "offer" })).toBe(
      "Preço com desconto é obrigatório para ofertas"
    );
  });

  it("returns null when campaignIntent is 'spotlight' regardless of value", () => {
    expect(validateDiscountedPrice(0, { campaignIntent: "spotlight" })).toBeNull();
  });

  it("returns error when campaignIntent is 'offer' and value is undefined", () => {
    expect(validateDiscountedPrice(undefined, { campaignIntent: "offer" })).toBe(
      "Preço com desconto é obrigatório para ofertas"
    );
  });
});

describe("validateBadge", () => {
  it("returns error when badge is empty and campaignIntent is 'offer'", () => {
    expect(validateBadge("", { campaignIntent: "offer" })).toBe(
      "Selecione um badge promocional"
    );
  });

  it("returns null when badge is empty and campaignIntent is 'spotlight'", () => {
    expect(validateBadge("", { campaignIntent: "spotlight" })).toBeNull();
  });

  it("returns error when badge is empty and campaignIntent is undefined (legacy)", () => {
    expect(validateBadge("", undefined)).toBe("Selecione um badge promocional");
  });

  it("returns error when badge does not belong to the intent's list", () => {
    expect(validateBadge("Promoção", { campaignIntent: "spotlight" })).toBe(
      "Badge inválido para esta intenção comercial"
    );
  });

  it("returns null when badge belongs to the intent's list", () => {
    expect(validateBadge("Destaque da Semana", { campaignIntent: "spotlight" })).toBeNull();
  });
});
