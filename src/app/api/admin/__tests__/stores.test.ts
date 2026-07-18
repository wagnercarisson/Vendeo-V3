import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/auth/errors";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
  },
}));

async function postStore(body: Record<string, unknown>) {
  const { POST } = await import("../stores/route");
  const req = new NextRequest(
    new Request("http://localhost/api/admin/stores", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("POST /api/admin/stores", () => {
  it("returns 201 when user has no store", async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: "store-1",
        name: "Loja Teste",
        segment: "moda",
        balance: 5,
      },
      error: null,
    });

    const res = await postStore({
      userId: "00000000-0000-0000-0000-000000000001",
      storeName: "Loja Teste",
      segment: "moda",
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("store-1");
    expect(body.balance).toBe(5);
  });

  it("returns 409 when user already has a store", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "usuario_ja_possui_loja" },
    });

    const res = await postStore({
      userId: "00000000-0000-0000-0000-000000000001",
      storeName: "Loja Teste",
      segment: "moda",
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Usuário já possui uma loja");
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const res = await postStore({
      userId: "00000000-0000-0000-0000-000000000001",
      storeName: "Loja Teste",
      segment: "moda",
    });

    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await postStore({
      userId: "00000000-0000-0000-0000-000000000001",
      storeName: "Loja Teste",
      segment: "moda",
    });

    expect(res.status).toBe(403);
  });
});
