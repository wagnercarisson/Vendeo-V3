import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import {
  OperationCostService,
  OperationCostUnavailableError,
  DEFAULT_OPERATION_COSTS,
} from "../operation-cost-service";
import { OPERATION_KEYS } from "../types";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

const mockAdminClient = { from: mockFrom };

let service: OperationCostService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new OperationCostService(mockAdminClient as any);

  mockFrom.mockImplementation((table: string) => {
    if (table === "credit_operation_costs") return { select: mockSelect };
    return {};
  });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
});

function mockGetCostResult(
  result: { data: { cost_credits: number; enabled: boolean } | null; error: { message: string } | null },
) {
  mockMaybeSingle.mockResolvedValue(result);
}

describe("OperationCostService.getCost", () => {
  it("linha existente → source table", async () => {
    mockGetCostResult({
      data: { cost_credits: 2, enabled: true },
      error: null,
    });

    const result = await service.getCost("campaign_generation");

    expect(result).toEqual({
      operationKey: "campaign_generation",
      costCredits: 2,
      enabled: true,
      source: "table",
    });
    expect(mockFrom).toHaveBeenCalledWith("credit_operation_costs");
    expect(mockSelect).toHaveBeenCalledWith("cost_credits, enabled");
    expect(mockEq).toHaveBeenCalledWith("operation_key", "campaign_generation");
  });

  it("linha inexistente → fail-open fallback", async () => {
    mockGetCostResult({ data: null, error: null });

    const result = await service.getCost("campaign_generation");

    expect(result).toEqual({
      operationKey: "campaign_generation",
      costCredits: 1,
      enabled: true,
      source: "fallback",
    });
    expect(result.costCredits).toBe(
      DEFAULT_OPERATION_COSTS.campaign_generation.costCredits,
    );
  });

  it("erro de leitura → fail-closed OperationCostUnavailableError", async () => {
    mockGetCostResult({
      data: null,
      error: { message: "connection refused" },
    });

    await expect(service.getCost("campaign_generation")).rejects.toThrow(
      OperationCostUnavailableError,
    );
    await expect(service.getCost("campaign_generation")).rejects.toThrow(
      "connection refused",
    );
  });

  it("todas as chaves do enum resolvem com source table", async () => {
    for (const key of OPERATION_KEYS) {
      mockGetCostResult({
        data: { cost_credits: 1, enabled: true },
        error: null,
      });

      const result = await service.getCost(key);

      expect(result).toEqual({
        operationKey: key,
        costCredits: 1,
        enabled: true,
        source: "table",
      });
    }
  });

  it("enabled=false retorna resolução com enabled false (não lança)", async () => {
    mockGetCostResult({
      data: { cost_credits: 1, enabled: false },
      error: null,
    });

    const result = await service.getCost("visual_signature_generation");

    expect(result).toEqual({
      operationKey: "visual_signature_generation",
      costCredits: 1,
      enabled: false,
      source: "table",
    });
  });

  it("não expõe métodos de escrita", () => {
    expect((service as any).updateCost).toBeUndefined();
    expect((service as any).setCost).toBeUndefined();
  });
});
