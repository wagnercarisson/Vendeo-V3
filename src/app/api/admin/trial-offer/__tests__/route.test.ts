import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest(
    new Request("http://localhost/api/admin/trial-offer", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        host: "localhost",
        ...headers,
      },
    }),
  );
}

async function put(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const { PUT } = await import("../route");
  return PUT(request(body, headers));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("F50.2 admin trial offer route", () => {
  it("exige motivo e não chama a RPC sem ele", async () => {
    const response = await put({ enabled: true, reason: "" });
    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("chama admin_set_trial_offer_enabled com o admin e devolve o marco", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: false,
        enabled: true,
        launch_at: "2026-10-20T12:00:00.000Z",
      },
      error: null,
    });

    const response = await put({
      enabled: true,
      reason: "Liberar oferta",
      operationId: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_set_trial_offer_enabled", {
      p_enabled: true,
      p_actor_id: "admin-1",
      p_reason: "Liberar oferta",
      p_operation_id: "11111111-1111-4111-8111-111111111111",
    });
    const body = await response.json();
    expect(body.enabled).toBe(true);
    expect(body.launchAt).toBe("2026-10-20T12:00:00.000Z");
  });

  it("recusa CSRF sem origin", async () => {
    const response = await put(
      { enabled: true, reason: "Liberar oferta" },
      { origin: "" },
    );
    expect(response.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("mapeia conflito de conteúdo do mesmo operation_id para 409", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "operation_id_conflict" },
    });

    const response = await put({
      enabled: true,
      reason: "Outro motivo",
      operationId: "11111111-1111-4111-8111-111111111111",
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("operation_id_conflict");
  });
});
