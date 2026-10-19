// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { rpc: mockRpc } }));
vi.mock("@/lib/product-1-1/authorization/instance-identity", () => ({
  resolveCanonicalInstanceIdentity: () => "127.0.0.1:56321",
}));
const mockReadState = vi.fn();
vi.mock("@/lib/product-1-1/activation/activation-state", () => ({
  readProductActivationState: (...args: unknown[]) => mockReadState(...args),
}));

function post(body: unknown) {
  return import("../product-1-1-activation/route").then(({ POST }) =>
    POST(
      new NextRequest(
        new Request("http://localhost/api/admin/product-1-1-activation", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

const base = {
  reason: "janela aprovada",
  operationId: "11111111-1111-4111-8111-111111111111",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("F56.2e - rota de ativacao", () => {
  it("exige confirm ALL_STORES para all_stores e nao chama a RPC sem ele", async () => {
    const res = await post({ ...base, mode: "all_stores" });
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("devolve currentMode relido, mesmo quando o replay retorna modo historico", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: true,
        mode: "all_stores",
        result: { mode: "all_stores" },
      },
      error: null,
    });
    mockReadState.mockResolvedValue({
      mode: "test_stores",
      flags: { testStores: true, allStores: false, testStoresStatus: "valid", allStoresStatus: "valid" },
      authorizations: { testStores: "test_stores", allStores: "off" },
      instanceIdentity: "127.0.0.1:56321",
    });

    const res = await post({ ...base, mode: "all_stores", confirm: "ALL_STORES" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.mode).toBe("all_stores");
    expect(body.currentMode).toBe("test_stores");
    expect(mockReadState).toHaveBeenCalledTimes(1);
  });

  it("mapeia conflito para 409", async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, conflict: true },
      error: null,
    });
    const res = await post({ ...base, mode: "test_stores" });
    expect(res.status).toBe(409);
  });
});

