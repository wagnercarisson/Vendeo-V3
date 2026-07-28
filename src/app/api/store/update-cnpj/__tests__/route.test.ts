import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const STORE_UUID = "00000000-0000-4000-a000-000000000001";

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(() => Promise.resolve({ userId: "00000000-0000-4000-a000-000000000000" })),
  UnauthorizedError: class extends Error {},
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async () => ({ id: STORE_UUID, name: "Minha Loja" })),
}));

vi.mock("@/lib/cnpj/hash", () => ({
  hashCnpjRoot: vi.fn(() => "mocked_hash_64chars"),
}));

process.env.CNPJ_PEPPER = "test_pepper_hex_64_chars";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/store/update-cnpj", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": "127.0.0.1", "user-agent": "test" },
  });
}

describe("POST /api/store/update-cnpj", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockReset();
  });

  it("updates CNPJ for legacy store without granting credits", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: STORE_UUID, cnpj_normalized: "12345678000195" }] },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "ABC Comércio Ltda",
      nomeFantasia: "ABC Store",
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_store_id: STORE_UUID,
      p_cnpj_normalized: "12345678000195",
    }));
  });

  it("inserts consumed entitlement without granting credits", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
    }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_store_id: STORE_UUID,
      p_cnpj_normalized: "12345678000195",
    }));
  });

  it("blocks CNPJ overwrite when store already has CNPJ", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "cnpj_already_set" },
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "22345678000195",
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Esta loja já possui CNPJ cadastrado");
  });

  it("rejects invalid CNPJ format via schema validation", async () => {
    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "123",
    }));

    expect(res.status).toBe(400);
  });

  it("returns 403 when storeId does not match user store", async () => {
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({ id: "00000000-0000-4000-a000-000000000099", name: "Outra" });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
    }));

    expect(res.status).toBe(403);
  });
});
