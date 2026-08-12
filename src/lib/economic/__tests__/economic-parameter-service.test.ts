import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import {
  EconomicParameterService,
  EconomicParameterUnavailableError,
} from "../economic-parameter-service";
import { ECONOMIC_PARAMETER_KEYS } from "../types";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

const mockAdminClient = { from: mockFrom };

let service: EconomicParameterService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new EconomicParameterService(mockAdminClient as any);

  mockFrom.mockImplementation((table: string) => {
    if (table === "economic_parameters") return { select: mockSelect };
    return {};
  });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
});

function mockGetParameterResult(
  result: {
    data: { key: string; value: string | number } | null;
    error: { message: string } | null;
  },
) {
  mockMaybeSingle.mockResolvedValue(result);
}

describe("EconomicParameterService.getParameter", () => {
  it("linha existente → source table (valor NUMERIC normalizado)", async () => {
    mockGetParameterResult({
      data: { key: "usd_brl_rate", value: "5.0" },
      error: null,
    });

    const result = await service.getParameter("usd_brl_rate");

    expect(result).toEqual({
      key: "usd_brl_rate",
      value: 5,
      source: "table",
    });
    expect(mockFrom).toHaveBeenCalledWith("economic_parameters");
    expect(mockSelect).toHaveBeenCalledWith("key, value");
    expect(mockEq).toHaveBeenCalledWith("key", "usd_brl_rate");
    expect(mockMaybeSingle).toHaveBeenCalled();
  });

  it("linha inexistente → fail-open fallback 1.00 com log", async () => {
    mockGetParameterResult({ data: null, error: null });

    const result = await service.getParameter("credit_value_brl");

    expect(result).toEqual({
      key: "credit_value_brl",
      value: 1,
      source: "fallback",
    });
  });

  it("erro real de leitura → fail-closed EconomicParameterUnavailableError", async () => {
    mockGetParameterResult({
      data: null,
      error: { message: "connection refused" },
    });

    await expect(service.getParameter("usd_brl_rate")).rejects.toThrow(
      EconomicParameterUnavailableError,
    );
    await expect(service.getParameter("usd_brl_rate")).rejects.toThrow(
      "connection refused",
    );
  });

  it("value <= 0 na resposta → defesa: log + fallback 1.00 (nunca propaga inválido)", async () => {
    mockGetParameterResult({
      data: { key: "usd_brl_rate", value: "0" },
      error: null,
    });

    const result = await service.getParameter("usd_brl_rate");

    expect(result).toEqual({
      key: "usd_brl_rate",
      value: 1,
      source: "fallback",
    });
  });

  it("value não-finito na resposta → defesa: fallback 1.00", async () => {
    mockGetParameterResult({
      data: { key: "usd_brl_rate", value: "NaN" },
      error: null,
    });

    const result = await service.getParameter("usd_brl_rate");

    expect(result).toEqual({
      key: "usd_brl_rate",
      value: 1,
      source: "fallback",
    });
  });

  it("não expõe métodos de escrita", () => {
    expect((service as any).setParameter).toBeUndefined();
    expect((service as any).updateParameter).toBeUndefined();
  });
});

describe("EconomicParameterService.getAll", () => {
  beforeEach(() => {
    mockSelect.mockReturnValue({ eq: mockEq });
  });

  function mockGetAllResult(
    result: {
      data: Array<{ key: string; value: string | number }> | null;
      error: { message: string } | null;
    },
  ) {
    mockSelect.mockResolvedValue(result);
  }

  it("mescla tabela + fallback — 1 linha no banco → 2 resoluções com source correto", async () => {
    mockGetAllResult({
      data: [{ key: "usd_brl_rate", value: "5.0" }],
      error: null,
    });

    const result = await service.getAll();

    expect(result).toHaveLength(ECONOMIC_PARAMETER_KEYS.length);
    expect(result[0]).toEqual({
      key: "usd_brl_rate",
      value: 5,
      source: "table",
    });
    expect(result[1]).toEqual({
      key: "credit_value_brl",
      value: 1,
      source: "fallback",
    });
  });

  it("ordem preservada = ECONOMIC_PARAMETER_KEYS (mesmo com linhas fora de ordem)", async () => {
    mockGetAllResult({
      data: [
        { key: "credit_value_brl", value: "2.5" },
        { key: "usd_brl_rate", value: "5.2" },
      ],
      error: null,
    });

    const result = await service.getAll();

    expect(result.map((r) => r.key)).toEqual([...ECONOMIC_PARAMETER_KEYS]);
    expect(result[0].value).toBe(5.2);
    expect(result[1].value).toBe(2.5);
  });

  it("erro real de leitura → fail-closed EconomicParameterUnavailableError", async () => {
    mockGetAllResult({ data: null, error: { message: "connection refused" } });

    await expect(service.getAll()).rejects.toThrow(
      EconomicParameterUnavailableError,
    );
  });

  it("value <= 0 na resposta do getAll → defesa: fallback 1.00", async () => {
    mockGetAllResult({
      data: [
        { key: "usd_brl_rate", value: "5.0" },
        { key: "credit_value_brl", value: "-1" },
      ],
      error: null,
    });

    const result = await service.getAll();

    expect(result[1]).toEqual({
      key: "credit_value_brl",
      value: 1,
      source: "fallback",
    });
  });
});
