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

// Fila de respostas para leituras SEQUENCIAIS da feature flag (getAllCosts
// resolve as duas flags uma após a outra). Cada chamada consome o próximo item.
type FlagResult = { data: { enabled: boolean } | null; error: { message: string } | null };
let flagQueue: FlagResult[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  flagQueue = [];
  service = new OperationCostService(mockAdminClient as any);

  mockFrom.mockImplementation((table: string) => {
    if (table === "credit_operation_costs") return { select: mockSelect };
    if (table === "feature_flags") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: () => {
              const next = flagQueue.shift();
              if (!next) {
                return Promise.resolve({
                  data: null,
                  error: { message: "no flag mock configured" },
                });
              }
              return Promise.resolve(
                next.error
                  ? { data: null, error: next.error }
                  : { data: next.data, error: null },
              );
            },
          })),
        })),
      };
    }
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

// Controla a leitura da feature flag (enabled da geração).
function mockFlagResult(
  data: { enabled: boolean } | null,
  error: { message: string } | null = null,
) {
  flagQueue.push({ data, error });
}

describe("OperationCostService.getCost", () => {
  it("linha existente → source table + enabled da flag (true)", async () => {
    mockGetCostResult({
      data: { cost_credits: 2, enabled: true },
      error: null,
    });
    mockFlagResult({ enabled: true });

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

  it("linha inexistente → fail-open fallback (custo default; enabled da flag)", async () => {
    mockGetCostResult({ data: null, error: null });
    mockFlagResult({ enabled: true });

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
    mockFlagResult({ enabled: true });

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
      mockFlagResult({ enabled: true });

      const result = await service.getCost(key);

      expect(result).toEqual({
        operationKey: key,
        costCredits: 1,
        enabled: true,
        source: "table",
      });
    }
  });

  it("flag false → resolução com enabled false (não lança)", async () => {
    mockGetCostResult({
      data: { cost_credits: 1, enabled: true },
      error: null,
    });
    mockFlagResult({ enabled: false });

    const result = await service.getCost("visual_signature_generation");

    expect(result).toEqual({
      operationKey: "visual_signature_generation",
      costCredits: 1,
      enabled: false,
      source: "table",
    });
  });

  it("erro de leitura da flag → enabled true (F38 D5 fail-open — nunca desliga geração)", async () => {
    mockGetCostResult({
      data: { cost_credits: 2, enabled: true },
      error: null,
    });
    mockFlagResult(null, { message: "db unavailable" });

    const result = await service.getCost("campaign_generation");

    expect(result.enabled).toBe(true);
    expect(result.source).toBe("table");
  });

  it("não expõe métodos de escrita", () => {
    expect((service as any).updateCost).toBeUndefined();
    expect((service as any).setCost).toBeUndefined();
  });
});

describe("OperationCostService.getAllCosts", () => {
  const mockIn = vi.fn();

  beforeEach(() => {
    mockSelect.mockReturnValue({ eq: mockEq, in: mockIn });
  });

  function mockGetAllCostsResult(
    result: {
      data:
        | Array<{
            operation_key: string;
            cost_credits: number;
            enabled: boolean;
            updated_by: string | null;
            updated_at: string | null;
          }>
        | null;
      error: { message: string } | null;
    },
  ) {
    mockIn.mockResolvedValue(result);
  }

  it("merge tabela+fallback — todas as chaves do enum, enabled mapeado das flags", async () => {
    mockGetAllCostsResult({
      data: [
        {
          operation_key: "campaign_generation",
          cost_credits: 2,
          enabled: true,
          updated_by: "admin-1",
          updated_at: "2026-08-07T12:00:00.000Z",
        },
      ],
      error: null,
    });
    mockFlagResult({ enabled: true });
    mockFlagResult({ enabled: false });

    const result = await service.getAllCosts();

    expect(result).toHaveLength(OPERATION_KEYS.length);
    expect(result[0]).toEqual({
      operationKey: "campaign_generation",
      costCredits: 2,
      enabled: true,
      updatedByUserId: "admin-1",
      updatedAt: "2026-08-07T12:00:00.000Z",
      source: "table",
    });
    // visual_signature_generation: custo fallback + flag false
    expect(result[1]).toEqual({
      operationKey: "visual_signature_generation",
      costCredits: 1,
      enabled: false,
      updatedByUserId: null,
      updatedAt: null,
      source: "fallback",
    });
  });

  it("erro de leitura → fail-closed", async () => {
    mockGetAllCostsResult({
      data: null,
      error: { message: "connection refused" },
    });
    mockFlagResult({ enabled: true });

    await expect(service.getAllCosts()).rejects.toThrow(
      OperationCostUnavailableError,
    );
  });

  it("erro de leitura das flags → enabled true (fail-open)", async () => {
    mockGetAllCostsResult({
      data: [
        {
          operation_key: "campaign_generation",
          cost_credits: 2,
          enabled: true,
          updated_by: null,
          updated_at: null,
        },
      ],
      error: null,
    });
    mockFlagResult(null, { message: "db unavailable" });
    mockFlagResult(null, { message: "db unavailable" });

    const result = await service.getAllCosts();

    expect(result.every((r) => r.enabled === true)).toBe(true);
  });

  it("ordem preservada = OPERATION_KEYS", async () => {
    mockGetAllCostsResult({
      data: [
        {
          operation_key: "visual_signature_generation",
          cost_credits: 3,
          enabled: false,
          updated_by: null,
          updated_at: "2026-08-07T12:00:00.000Z",
        },
        {
          operation_key: "campaign_generation",
          cost_credits: 2,
          enabled: true,
          updated_by: null,
          updated_at: "2026-08-07T12:00:00.000Z",
        },
      ],
      error: null,
    });
    mockFlagResult({ enabled: true });
    mockFlagResult({ enabled: true });

    const result = await service.getAllCosts();
    expect(result.map((r) => r.operationKey)).toEqual([...OPERATION_KEYS]);
  });
});