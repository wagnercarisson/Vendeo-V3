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

async function putParameter(body: Record<string, unknown>) {
  const { PUT } = await import("../route");
  return PUT(
    new NextRequest(
      new Request("http://localhost/api/admin/economic-parameters", {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
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

describe("PUT /api/admin/economic-parameters (D2 — RPC admin_set_economic_parameter)", () => {
  it("200 via RPC + audit quando admin autenticado (payload correto)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        key: "usd_brl_rate",
        value: 5.2,
        audit_id: "audit-1",
        updated_at: "2026-08-10T12:00:00.000Z",
        idempotent: false,
      },
      error: null,
    });

    const res = await putParameter({
      key: "usd_brl_rate",
      value: 5.2,
      reason: "Calibração beta",
      operationId: "00000000-0000-4000-8000-000000000099",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parameter).toEqual({ key: "usd_brl_rate", value: 5.2 });
    expect(body.auditId).toBe("audit-1");
    expect(body.updatedAt).toBe("2026-08-10T12:00:00.000Z");
    expect(body.idempotent).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith("admin_set_economic_parameter", {
      p_actor_id: "admin-1",
      p_key: "usd_brl_rate",
      p_value: 5.2,
      p_reason: "Calibração beta",
      p_operation_id: "00000000-0000-4000-8000-000000000099",
    });
  });

  it("400 zod — sem reason; key inválido; value <= 0", async () => {
    const cases = [
      { key: "usd_brl_rate", value: 5.2 },
      { key: "invalid", value: 5.2, reason: "x" },
      { key: "usd_brl_rate", value: 0, reason: "x" },
      { key: "usd_brl_rate", value: -1, reason: "x" },
    ];
    for (const body of cases) {
      const res = await putParameter(body);
      expect(res.status).toBe(400);
      const parsed = await res.json();
      expect(parsed.error).toBe("Dados inválidos");
    }
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("400 zod — reason vazio (min 1)", async () => {
    const res = await putParameter({
      key: "credit_value_brl",
      value: 1.5,
      reason: "",
    });
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("403 sem admin (requireAdmin lança ForbiddenError)", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const res = await putParameter({
      key: "usd_brl_rate",
      value: 5.2,
      reason: "x",
    });
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("500 erro do RPC (economic_parameter_update_failed)", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "rpc down" },
    });
    const res = await putParameter({
      key: "usd_brl_rate",
      value: 5.2,
      reason: "x",
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("economic_parameter_update_failed");
  });

  it("200 idempotência — mesmo operation_id repetido → idempotent: true repassado", async () => {
    mockRpc.mockResolvedValue({
      data: {
        key: "usd_brl_rate",
        value: 5.2,
        audit_id: "audit-1",
        updated_at: "2026-08-10T12:00:00.000Z",
        idempotent: true,
      },
      error: null,
    });

    const res = await putParameter({
      key: "usd_brl_rate",
      value: 5.2,
      reason: "retry",
      operationId: "00000000-0000-4000-8000-000000000099",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
  });
});
