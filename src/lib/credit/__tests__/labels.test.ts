import { describe, it, expect } from "vitest";
import { getLabel } from "@/lib/labels";
import { CREDIT_TYPE_LABELS, CREDIT_TYPE_BADGE } from "@/lib/credit/labels";

describe("CREDIT_TYPE_LABELS", () => {
  const knownTypes = [
    "bonus_onboarding",
    "bonus_monthly",
    "admin_grant",
    "purchase",
    "deduction",
    "refund",
    "adjustment",
  ];

  it.each(knownTypes)("cobre tipo: %s", (type) => {
    expect(CREDIT_TYPE_LABELS).toHaveProperty(type);
    expect(CREDIT_TYPE_LABELS[type]).toBeTruthy();
  });

  it("getLabel retorna label conhecido", () => {
    expect(getLabel(CREDIT_TYPE_LABELS, "bonus_onboarding")).toBe("Bônus de Boas-Vindas");
    expect(getLabel(CREDIT_TYPE_LABELS, "adjustment")).toBe("Ajuste");
    expect(getLabel(CREDIT_TYPE_LABELS, "deduction")).toBe("Geração");
  });

  it("getLabel retorna fallback para tipo desconhecido", () => {
    expect(getLabel(CREDIT_TYPE_LABELS, "unknown_type")).toBe("Unknown Type");
  });
});

describe("CREDIT_TYPE_BADGE", () => {
  it.each(["bonus_onboarding", "bonus_monthly", "admin_grant", "purchase", "refund", "adjustment"])(
    "badge ready para: %s",
    (type) => {
      expect(CREDIT_TYPE_BADGE[type]).toBe("ready");
    },
  );

  it("badge error para deduction", () => {
    expect(CREDIT_TYPE_BADGE["deduction"]).toBe("error");
  });

  it("retorna undefined para tipo desconhecido", () => {
    expect(CREDIT_TYPE_BADGE["unknown"]).toBeUndefined();
  });
});
