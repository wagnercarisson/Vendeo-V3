import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const STORE_UUID = "00000000-0000-4000-a000-000000000001";

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

const mockResolve = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: mockRpc, from: mockFrom },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(() => Promise.resolve({ userId: "00000000-0000-4000-a000-000000000000" })),
  UnauthorizedError: class extends Error {},
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async () => ({ id: STORE_UUID, name: "Minha Loja" })),
}));

vi.mock("@/lib/cnpj/validate", () => ({
  validateCnpj: vi.fn((raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "12345678000195" || digits === "22345678000195") {
      return { normalized: digits };
    }
    return new Error("CNPJ inválido");
  }),
}));

vi.mock("@/lib/cnpj/hash", () => ({
  hashCnpjRoot: vi.fn(() => "mocked_hash_64chars"),
}));

vi.mock("@/lib/cnpj/verification-service", () => ({
  CnpjVerificationService: vi.fn(),
  createSupabaseLookupCache: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock("@/lib/cnpj/lookup-providers/brasil-api", () => ({ BrasilApiProvider: vi.fn() }));
vi.mock("@/lib/cnpj/lookup-providers/cnpja", () => ({ CnpjaProvider: vi.fn() }));

vi.mock("@/lib/cnpj/similarity", () => ({
  compareBusinessName: vi.fn(() => ({ bestScore: 1, nameToLegal: 1, nameToFantasy: null, label: "match" })),
}));

const mockEvaluateFreemium = vi.fn();
vi.mock("@/lib/freemium/freemium-risk-service", () => ({
  evaluateFreemiumEligibility: mockEvaluateFreemium,
}));

process.env.CNPJ_PEPPER = "test_pepper_hex_64_chars";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/store/update-cnpj", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": "127.0.0.1", "user-agent": "test" },
  });
}

function mockFromNoDuplicate() {
  const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ neq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) }));
  mockFrom.mockReturnValue({ select: mockSelect });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockReset();
  mockFrom.mockReset();
  mockResolve.mockReset();
  mockEvaluateFreemium.mockReset();
  mockFromNoDuplicate();
  // Default: lookup resolve resolved with official data
  vi.mocked(CnpjVerificationService).prototype.resolve = mockResolve;
  mockResolve.mockResolvedValue({ status: "resolved", data: { razao_social: "OFICIAL LTDA", nome_fantasia: "Fantasia Oficial", situacao_cadastral: "ATIVA" } });
});

import { CnpjVerificationService } from "@/lib/cnpj/verification-service";

describe("POST /api/store/update-cnpj", () => {
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
    // Deve usar razao_social oficial, não o input do cliente
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_store_id: STORE_UUID,
      p_cnpj_normalized: "12345678000195",
      p_razao_social: "OFICIAL LTDA",
      p_nome_fantasia: "Fantasia Oficial",
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
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_store_id: STORE_UUID,
      p_cnpj_normalized: "12345678000195",
    }));
  });

  it("uses official razao_social from CnpjVerificationService when resolved", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Input Manual Ltda",
      nomeFantasia: "Input Manual",
    }));

    expect(res.status).toBe(200);
    // Verifica que razao_social oficial sobrescreveu input manual
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_razao_social: "OFICIAL LTDA",
      p_nome_fantasia: "Fantasia Oficial",
    }));
  });

  it("returns 400 when CNPJ not found in external API", async () => {
    mockResolve.mockResolvedValue({ status: "not_found" });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 503 when API is unavailable for normal store", async () => {
    mockResolve.mockResolvedValue({ status: "unavailable" });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("allows continuation when API unavailable for test store", async () => {
    mockResolve.mockResolvedValue({ status: "unavailable" });
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Test Store",
      is_test_store: true,
    } as import("@/lib/store").Store);
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_verification_status: "defer",
    }));
  });

  it("calculates cnpj_validation_score when resolved", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_cnpj_validation_score: expect.objectContaining({ name_match: true }),
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
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Esta loja já possui CNPJ cadastrado");
  });

  it("returns 409 with cnpj_already_registered when CNPJ index conflicts", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "idx_stores_cnpj_normalized"',
        details: 'Key (cnpj_normalized)=(12345678000195) already exists.',
      },
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("CNPJ já está cadastrado");
    expect(body.code).toBe("cnpj_already_registered");
  });

  it("blocks duplicate CNPJ at app level before RPC", async () => {
    // Mock duplicate check to return existing store
    mockFrom.mockReset();
    const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ neq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "other-store-id" }, error: null }) })) })) }));
    mockFrom.mockReturnValue({ select: mockSelect });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("cnpj_already_registered");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("passes verification params to RPC when resolved", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_verification_status: expect.any(String),
      p_cnpj_official_data: expect.objectContaining({ razao_social: "OFICIAL LTDA" }),
    }));
  });

  it("rejects invalid CNPJ format via schema validation", async () => {
    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "123",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(400);
  });

  it("returns 500 for unknown RPC errors instead of leaking raw SQL", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "some_random_internal_error" },
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("some_random_internal_error");
  });

  it("does NOT call evaluateFreemiumEligibility", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    });

    const { POST } = await import("../route");
    await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(mockEvaluateFreemium).not.toHaveBeenCalled();
  });

  it("returns 403 when storeId does not match user store", async () => {
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: "00000000-0000-4000-a000-000000000099",
      name: "Outra",
    } as import("@/lib/store").Store);

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(403);
  });
});
