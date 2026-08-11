import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockGetAll = vi.fn();
class MockEconomicParameterUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao ler parâmetros econômicos");
    this.name = "EconomicParameterUnavailableError";
  }
}
vi.mock("@/lib/economic/economic-parameter-service", () => ({
  EconomicParameterService: vi.fn(function () {
    return { getAll: mockGetAll };
  }),
  EconomicParameterUnavailableError: MockEconomicParameterUnavailableError,
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc },
}));

async function getParameters(
  url = "http://localhost/api/admin/economic-parameters",
) {
  const { GET } = await import("../route");
  return GET(new NextRequest(url));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("GET /api/admin/economic-parameters (D2 — lista resolvida via EconomicParameterService.getAll)", () => {
  it("200 com parameters (key/value/source) quando admin autenticado", async () => {
    mockGetAll.mockResolvedValue([
      { key: "usd_brl_rate", value: 5.2, source: "table" },
      { key: "credit_value_brl", value: 1.0, source: "fallback" },
    ]);

    const res = await getParameters();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parameters).toHaveLength(2);
    expect(body.parameters[0]).toEqual({
      key: "usd_brl_rate",
      value: 5.2,
      source: "table",
    });
    expect(body.parameters[1]).toEqual({
      key: "credit_value_brl",
      value: 1.0,
      source: "fallback",
    });
    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });

  it("403 sem admin (requireAdmin lança ForbiddenError)", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const res = await getParameters();
    expect(res.status).toBe(403);
    expect(mockGetAll).not.toHaveBeenCalled();
  });

  it("503 fail-closed quando o service lança EconomicParameterUnavailableError", async () => {
    mockGetAll.mockRejectedValue(
      new MockEconomicParameterUnavailableError("db down"),
    );
    const res = await getParameters();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("economic_parameters_unavailable");
  });
});
