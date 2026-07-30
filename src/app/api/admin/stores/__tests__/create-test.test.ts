import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { mockRpc, mockValidateCnpj, mockHashCnpjRoot } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockValidateCnpj: vi.fn((raw: string) => {
    if (raw.replace(/\D/g, "") === "12345678000195") return { normalized: "12345678000195" };
    return new Error("CNPJ inválido");
  }),
  mockHashCnpjRoot: vi.fn((root: string) => `hashed_${root}`),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: vi.fn(() => Promise.resolve({ userId: "admin-1" })),
}));

vi.mock("@/lib/auth/api-handler", () => ({
  apiHandler: vi.fn((handler) => handler),
}));

vi.mock("@/lib/cnpj/validate", () => ({
  validateCnpj: mockValidateCnpj,
}));

vi.mock("@/lib/cnpj/hash", () => ({
  hashCnpjRoot: mockHashCnpjRoot,
}));

import { POST } from "../create-test/route";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/stores/create-test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/stores/create-test", () => {
  it("creates test store successfully", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: "test-store-1", name: "Loja Teste", is_test_store: true }] },
      error: null,
    });

    const res = await POST(createRequest({
      userId: "user-1",
      name: "Loja Teste",
      segment: "outros",
      cnpj: "12.345.678/0001-95",
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockHashCnpjRoot).toHaveBeenCalledWith("12345678");
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_create_test_store",
      expect.objectContaining({
        p_cnpj_normalized: "12345678000195",
        p_cnpj_root_hash: "hashed_12345678",
      }),
    );
  });

  it("rejects without userId", async () => {
    const res = await POST(createRequest({
      name: "Loja",
      segment: "outros",
      cnpj: "12.345.678/0001-95",
    }));

    expect(res.status).toBe(400);
  });

  it("rejects invalid CNPJ", async () => {
    const res = await POST(createRequest({
      userId: "user-1",
      name: "Loja",
      segment: "outros",
      cnpj: "11.111.111/0001-11",
    }));

    expect(res.status).toBe(400);
  });
});
