import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { mockRpc, mockHashCnpjRoot } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
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

// Validador real: contrato canônico de 14 caracteres + DV oficial.
vi.mock("@/lib/cnpj/validate", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/cnpj/validate")>();
  return { validateCnpj: original.validateCnpj };
});

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

  it("creates test store with canonical alphanumeric CNPJ and root hash", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: "test-store-2", name: "Loja Alfa", is_test_store: true }] },
      error: null,
    });

    const res = await POST(createRequest({
      userId: "user-1",
      name: "Loja Alfa",
      segment: "outros",
      cnpj: "12.ABC.345/01DE-35",
    }));

    expect(res.status).toBe(200);
    expect(mockHashCnpjRoot).toHaveBeenCalledWith("12ABC345");
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_create_test_store",
      expect.objectContaining({
        p_cnpj_normalized: "12ABC34501DE35",
        p_cnpj_root_hash: "hashed_12ABC345",
      }),
    );
  });

  it("rejects unknown characters without calling the RPC", async () => {
    const res = await POST(createRequest({
      userId: "user-1",
      name: "Loja Emoji",
      segment: "outros",
      cnpj: "12.ABC.345/01DE-35😀",
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CNPJ inválido");
    expect(mockRpc).not.toHaveBeenCalled();
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
