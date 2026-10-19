// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ProductActivationRequestSchema } from "../activation/schemas";

const base = {
  mode: "test_stores" as const,
  reason: "janela aprovada",
  operationId: "11111111-1111-4111-8111-111111111111",
};

describe("F56.2e - contrato da acao de ativacao", () => {
  it("aceita modos validos sem confirm", () => {
    for (const mode of ["off", "test_stores"] as const) {
      expect(ProductActivationRequestSchema.safeParse({ ...base, mode }).success).toBe(true);
    }
  });

  it("exige confirm ALL_STORES apenas para all_stores", () => {
    expect(
      ProductActivationRequestSchema.safeParse({ ...base, mode: "all_stores" }).success,
    ).toBe(false);
    expect(
      ProductActivationRequestSchema.safeParse({
        ...base,
        mode: "all_stores",
        confirm: "ALL_STORES",
      }).success,
    ).toBe(true);
  });

  it("rejeita confirm em outros modos e campos desconhecidos", () => {
    expect(
      ProductActivationRequestSchema.safeParse({
        ...base,
        confirm: "ALL_STORES",
      }).success,
    ).toBe(false);
    expect(
      ProductActivationRequestSchema.safeParse({ ...base, extra: true }).success,
    ).toBe(false);
  });

  it("exige motivo e operationId UUID", () => {
    expect(
      ProductActivationRequestSchema.safeParse({ ...base, reason: " " }).success,
    ).toBe(false);
    expect(
      ProductActivationRequestSchema.safeParse({ ...base, operationId: "op" }).success,
    ).toBe(false);
  });
});
