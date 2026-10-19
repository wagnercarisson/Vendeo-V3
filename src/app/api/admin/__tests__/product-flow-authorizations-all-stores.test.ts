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

function post(body: unknown) {
  return import("../product-flow-authorizations/route").then(({ POST }) =>
    POST(
      new NextRequest(
        new Request("http://localhost/api/admin/product-flow-authorizations", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("F56.2e - rota de autorizacao all_stores", () => {
  it("aceita all_stores + all_stores com envelope consistente", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: true, refused: false, stage: "all_stores", scope: "all_stores" },
      error: null,
    });
    const res = await post({
      stage: "all_stores",
      scope: "all_stores",
      reason: "abertura aprovada",
      operationId: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ granted: true, stage: "all_stores", scope: "all_stores" });
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_grant_product_flow_stage_authorization",
      expect.objectContaining({
        p_stage: "all_stores",
        p_scope: "all_stores",
        p_instance_identity: "127.0.0.1:56321",
      }),
    );
  });

  it("recusa envelope divergente com 502", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, granted: true, refused: false, stage: "test_stores", scope: "test_stores" },
      error: null,
    });
    const res = await post({
      stage: "all_stores",
      scope: "all_stores",
      reason: "divergente",
      operationId: "22222222-2222-4222-8222-222222222222",
    });
    expect(res.status).toBe(502);
  });
});

