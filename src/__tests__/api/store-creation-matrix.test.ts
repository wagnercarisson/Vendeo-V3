// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireUser, mockSupabaseFrom, mockSupabaseRpc, mockValidateCnpj } = vi.hoisted(() => ({
  mockRequireUser: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockSupabaseRpc: vi.fn(),
  mockValidateCnpj: vi.fn((raw: string) => ({ normalized: "12345678000195" }) as { normalized: string } | Error),
}));

const mockFromChain = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  upsert: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ error: null }) })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getClaims: vi.fn() },
    from: mockFromChain,
  })),
  supabaseAdmin: { from: mockFromChain, rpc: mockSupabaseRpc },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(async () => mockRequireUser()),
  UnauthorizedError: class extends Error {
    constructor(m = "Unauthorized") {
      super(m);
      this.name = "UnauthorizedError";
    }
  },
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock("@/lib/constants", () => ({
  STORE_SEGMENTS: [
    { value: "variedades", label: "Variedades" },
    { value: "outros", label: "Outros" },
  ],
  STORE_SUBSEGMENTS: {},
}));

vi.mock("@/lib/store-response", () => ({
  buildStoreResponse: vi.fn(async (s: any) => s),
}));

vi.mock("@/lib/legal/document-versions", () => ({
  getCurrentVersion: vi.fn(async () => ({ version: "v1.0", effectiveAt: "2026-07-23T00:00:00Z", summary: null })),
  getVersionHistory: vi.fn(),
  isVersionCurrent: vi.fn(),
}));

vi.mock("@/lib/cnpj/validate", () => ({
  validateCnpj: mockValidateCnpj,
}));

vi.mock("@/lib/cnpj/mask", () => ({
  maskCnpj: vi.fn(() => "**.***.***/0001-**"),
}));

vi.mock("@/lib/cnpj/hash", () => ({
  hashCnpjRoot: vi.fn(() => "mocked_hash_64chars"),
}));

vi.mock("@/lib/cnpj/similarity", () => ({
  compareBusinessName: vi.fn(() => ({ bestScore: 1, nameToLegal: 1, nameToFantasy: null, label: "match" })),
}));

vi.mock("@/lib/cnpj/lookup-providers/brasil-api", () => ({
  BrasilApiProvider: class {
    async lookup() {
      return {
        status: "resolved",
        data: {
          cnpj_normalized: "12345678000195",
          razao_social: "Minha Loja LTDA",
          nome_fantasia: "Minha Loja",
          situacao_cadastral: "ATIVA",
          cep: null,
          logradouro: null,
          numero: null,
          complemento: null,
          bairro: null,
          cidade: null,
          uf: null,
          cnae_principal: null,
          cnae_descricao: null,
          data_situacao: null,
          data_abertura: null,
          porte: null,
        },
      };
    }
  },
}));

vi.mock("@/lib/cnpj/lookup-providers/cnpja", () => ({
  CnpjaProvider: class {
    async lookup() {
      return { status: "unavailable" };
    }
  },
}));

process.env.CNPJ_PEPPER = "test_pepper_hex_64_chars_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6";

function createReq(method: string, body: unknown, origin = "http://localhost"): NextRequest {
  return new NextRequest("http://localhost/api/store", {
    method,
    headers: { origin, host: "localhost", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type RpcResult = { data: unknown; error: unknown };

/** Roteia mockSupabaseRpc por nome de função (create_store_draft vs create_store_with_cnpj). */
function routeRpcBy(handlers: Record<string, () => RpcResult | Promise<RpcResult>>) {
  mockSupabaseRpc.mockImplementation((rpcName: string) => {
    const handler = handlers[rpcName];
    if (!handler) return Promise.resolve({ data: null, error: null });
    return Promise.resolve(handler());
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/store — modo verified/fiscal (com CNPJ)", () => {
  it("returns 201 calling create_store_with_cnpj with cnpjMasked present", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    let capturedName = "";
    let capturedParams: Record<string, unknown> = {};
    mockSupabaseRpc.mockImplementation((rpcName: string, params: any) => {
      capturedName = rpcName;
      capturedParams = params;
      return Promise.resolve({
        data: {
          store: [{ id: "store-1", name: "Minha Loja", user_id: "user-123", cnpj_normalized: "12345678000195" }],
          onboardingGranted: true,
        },
        error: null,
      });
    });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", cnpj: "12.345.678/0001-95", acceptedTerms: true }));
    expect(res.status).toBe(201);
    expect(capturedName).toBe("create_store_with_cnpj");
    expect(capturedParams?.p_cnpj_normalized).toBe("12345678000195");
    expect(capturedParams?.p_user_id).toBe("user-123");

    const data = await res.json();
    expect(data.cnpjMasked).toBe("**.***.***/0001-**");
    expect(data.onboardingGranted).toBe(true);
  });

  it("returns 409 on duplicate store (UNIQUE violation)", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockSupabaseRpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Outra Loja", segment: "variedades", cnpj: "12.345.678/0001-95", acceptedTerms: true }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("Usu\u00e1rio j\u00e1 possui uma loja");
  });

  it("returns 400 for invalid CNPJ", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockValidateCnpj.mockReturnValueOnce(new Error("CNPJ inv\u00e1lido"));

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", cnpj: "12.345.678/0001-00", acceptedTerms: true }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("CNPJ inv\u00e1lido");
  });
});

describe("POST /api/store — modo draft (sem CNPJ)", () => {
  it("returns 201 with onboardingGranted:false calling create_store_draft without p_cnpj_normalized", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    let capturedName = "";
    let capturedParams: Record<string, unknown> = {};
    mockSupabaseRpc.mockImplementation((rpcName: string, params: any) => {
      capturedName = rpcName;
      capturedParams = params;
      return Promise.resolve({
        data: { store: [{ id: "store-1", name: "Minha Loja", user_id: "user-123" }], onboardingGranted: false },
        error: null,
      });
    });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", acceptedTerms: true }));
    expect(res.status).toBe(201);
    expect(capturedName).toBe("create_store_draft");
    expect(capturedParams?.p_cnpj_normalized).toBeUndefined();
    expect(capturedParams?.p_user_id).toBe("user-123");

    const data = await res.json();
    expect(data.onboardingGranted).toBe(false);
  });

  it("never calls grant RPCs in draft mode (F36-DRAFT-CREATE-03 gate)", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockSupabaseRpc.mockResolvedValue({
      data: { store: [{ id: "store-1", name: "Minha Loja", user_id: "user-123" }], onboardingGranted: false },
      error: null,
    });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", acceptedTerms: true }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.onboardingGranted).toBe(false);

    const rpcCalls = mockSupabaseRpc.mock.calls.map((call) => call[0] as string);
    expect(rpcCalls).toContain("create_store_draft");
    expect(rpcCalls).not.toContain("try_grant_onboarding_entitlement");
    expect(rpcCalls).not.toContain("grant_credits");
  });

  it("returns 409 in draft mode when user already has a store (23505/stores_user_id_key)", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockSupabaseRpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "stores_user_id_key"' },
    });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", acceptedTerms: true }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("Usu\u00e1rio j\u00e1 possui uma loja");
  });

  it("returns 400 in draft mode when segment 'outros' has no subsegment", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "outros", acceptedTerms: true }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Subsegmento obrigat\u00f3rio para segmento outros");
  });
});

describe("POST /api/store — validações compartilhadas", () => {
  it("returns 400 when acceptedTerms missing", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name missing", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { segment: "variedades", acceptedTerms: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name is invalid (too short)", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "a", segment: "variedades", acceptedTerms: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when segment is invalid", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "nao-existe", acceptedTerms: true }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUser.mockRejectedValue(new UnauthorizedError());

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", acceptedTerms: true }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });
});

describe("POST /api/store — ownership (body user_id ignorado)", () => {
  it("ignores user_id in body (uses claims.sub) — verified mode", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    let capturedParams: Record<string, unknown> = {};
    mockSupabaseRpc.mockImplementation((_rpcName: string, params: any) => {
      capturedParams = params;
      return Promise.resolve({ data: { id: "store-1", user_id: "user-123" }, error: null });
    });

    const { POST } = await import("@/app/api/store/route");
    await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", cnpj: "12.345.678/0001-95", acceptedTerms: true, user_id: "hacker-id" }));
    expect(capturedParams?.p_user_id).toBe("user-123");
  });

  it("ignores user_id in body (uses claims.sub) — draft mode", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    let capturedName = "";
    let capturedParams: Record<string, unknown> = {};
    mockSupabaseRpc.mockImplementation((rpcName: string, params: any) => {
      capturedName = rpcName;
      capturedParams = params;
      return Promise.resolve({
        data: { store: [{ id: "store-1", name: "Minha Loja", user_id: "user-123" }], onboardingGranted: false },
        error: null,
      });
    });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", acceptedTerms: true, user_id: "hacker-id" }));
    expect(res.status).toBe(201);
    expect(capturedName).toBe("create_store_draft");
    expect(capturedParams?.p_user_id).toBe("user-123");
  });
});

describe("POST /api/store — encadeamento draft → fiscal (F36-DRAFT-CREATE-04)", () => {
  it("readiness becomes ready after update-cnpj (mocked) removes cadastro_fiscal from missing", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });

    let fiscalAttached = false;
    routeRpcBy({
      create_store_draft: () => ({
        data: { store: [{ id: "store-1", name: "Minha Loja", user_id: "user-123" }], onboardingGranted: false },
        error: null,
      }),
      update_store_cnpj: () => {
        fiscalAttached = true;
        return { data: { id: "store-1" }, error: null };
      },
      check_store_readiness: () => {
        if (fiscalAttached) {
          return { data: { ready: true, missing: [] }, error: null };
        }
        return {
          data: {
            ready: false,
            missing: [{ item: "cadastro_fiscal", reason: "CNPJ, razão social e nome fantasia são obrigatórios" }],
          },
          error: null,
        };
      },
    });

    // (a) cria loja draft (201)
    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", acceptedTerms: true }));
    expect(res.status).toBe(201);

    // Antes do fiscal: loja draft reporta cadastro_fiscal pendente
    const { getStoreReadiness } = await import("@/lib/store-readiness");
    const { supabaseAdmin } = await import("@/lib/supabase/server");
    const before = await getStoreReadiness("store-1");
    expect(before.ready).toBe(false);
    expect(before.missing.map((m) => m.item)).toContain("cadastro_fiscal");

    // (b) update-cnpj via RPC update_store_cnpj (mock — o que a rota update-cnpj executa)
    const upd = await (supabaseAdmin as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }).rpc(
      "update_store_cnpj",
      {
        p_store_id: "store-1",
        p_cnpj_normalized: "12345678000195",
        p_cnpj_root_hash: "mocked_hash_64chars",
        p_razao_social: "Minha Loja LTDA",
        p_nome_fantasia: "Minha Loja",
        p_cnpj_official_data: null,
        p_verification_status: "approved",
        p_verification_data: null,
        p_cnpj_validation_score: null,
        p_verification_reasons: null,
      }
    );
    expect(upd.error).toBeNull();

    // (c) após anexar CNPJ, readiness ready com missing sem cadastro_fiscal
    const after = await getStoreReadiness("store-1");
    expect(after.ready).toBe(true);
    expect(after.missing.some((m) => m.item === "cadastro_fiscal")).toBe(false);
  });
});
