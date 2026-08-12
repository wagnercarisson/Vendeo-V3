import { describe, it, expect } from "vitest";
import { AiOperationRunsQuerySchema } from "@/lib/admin/schemas";

describe("AiOperationRunsQuerySchema (D4 — query de GET /api/admin/ai-operation-runs)", () => {
  it("aceita { page: 2, pageSize: 25 } sem período (janela default 90d)", () => {
    const result = AiOperationRunsQuerySchema.safeParse({ page: 2, pageSize: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(25);
      expect(result.data.periodStart).toBeUndefined();
      expect(result.data.periodEnd).toBeUndefined();
    }
  });

  it("aceita período de 30 dias (dentro da janela)", () => {
    const result = AiOperationRunsQuerySchema.safeParse({
      periodStart: "2026-07-01T00:00:00.000Z",
      periodEnd: "2026-07-31T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita período maior que 365 dias (janela excedente → 400)", () => {
    const result = AiOperationRunsQuerySchema.safeParse({
      periodStart: "2025-01-01T00:00:00.000Z",
      periodEnd: "2026-08-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("365")),
      ).toBe(true);
    }
  });

  it("aceita segment 'test' e rejeita segment inválido", () => {
    expect(
      AiOperationRunsQuerySchema.safeParse({ segment: "test" }).success,
    ).toBe(true);
    expect(
      AiOperationRunsQuerySchema.safeParse({ segment: "invalid" }).success,
    ).toBe(false);
  });

  it("aplica defaults de paginação e coerce page/pageSize de strings", () => {
    const defaults = AiOperationRunsQuerySchema.safeParse({});
    expect(defaults.success).toBe(true);
    if (defaults.success) {
      expect(defaults.data.page).toBe(1);
      expect(defaults.data.pageSize).toBe(25);
    }

    const coerced = AiOperationRunsQuerySchema.safeParse({
      page: "2",
      pageSize: "50",
    });
    expect(coerced.success).toBe(true);
    if (coerced.success) {
      expect(coerced.data.page).toBe(2);
      expect(coerced.data.pageSize).toBe(50);
    }
  });

  it("rejeita uuid inválido em storeId/operationRunId e pageSize acima de 100", () => {
    expect(
      AiOperationRunsQuerySchema.safeParse({ storeId: "nao-e-um-uuid" }).success,
    ).toBe(false);
    expect(
      AiOperationRunsQuerySchema.safeParse({
        operationRunId: "nao-e-um-uuid",
      }).success,
    ).toBe(false);
    expect(
      AiOperationRunsQuerySchema.safeParse({ pageSize: 101 }).success,
    ).toBe(false);
  });
});
