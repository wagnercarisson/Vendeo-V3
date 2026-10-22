import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const STORE_UUID = "00000000-0000-4000-a000-000000000001";

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

const mockResolve = vi.fn();

// F50.4 — resultados roteados por nome de RPC (policy_context × update_store_cnpj).
let policyContextResult: { data: unknown; error: unknown } = { data: null, error: null };
let updateCnpjResult: { data: unknown; error: unknown } = { data: null, error: null };

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

// Usa o validador real (allowlist + DV oficial) em vez de reimplementar a
// normalização com replace(/\D/g, "") — que esconderia regressões alfanuméricas.
vi.mock("@/lib/cnpj/validate", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/cnpj/validate")>();
  return { validateCnpj: original.validateCnpj };
});

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
  // Cadeia fluente: suporta a query de duplicata (select→eq→neq→maybeSingle)
  // E a query de entitlement (select→eq→eq→maybeSingle) usada pelo motor.
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockReset();
  mockFrom.mockReset();
  mockResolve.mockReset();
  mockEvaluateFreemium.mockReset();
  policyContextResult = { data: null, error: null };
  updateCnpjResult = { data: null, error: null };
  mockRpc.mockImplementation((rpcName: string) => {
    if (rpcName === "trial_offer_policy_context") return Promise.resolve(policyContextResult);
    if (rpcName === "update_store_cnpj") return Promise.resolve(updateCnpjResult);
    return Promise.resolve({ data: { completed: false, status: "not_ready" }, error: null });
  });
  mockFromNoDuplicate();
  // Default: lookup resolve resolved with official data
  vi.mocked(CnpjVerificationService).prototype.resolve = mockResolve;
  mockResolve.mockResolvedValue({ status: "resolved", data: { razao_social: "OFICIAL LTDA", nome_fantasia: "Fantasia Oficial", situacao_cadastral: "ATIVA" } });
});

import { CnpjVerificationService } from "@/lib/cnpj/verification-service";
import { hashCnpjRoot } from "@/lib/cnpj/hash";

describe("POST /api/store/update-cnpj", () => {
  it("updates CNPJ for legacy store without granting credits", async () => {
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID, cnpj_normalized: "12345678000195" }] },
      error: null,
    };

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
    // Regressão numérica: raiz/hash inalterados.
    expect(hashCnpjRoot).toHaveBeenCalledWith("12345678");
  });

  it("inserts consumed entitlement without granting credits", async () => {
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

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
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

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
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_verification_status: "defer",
      p_verification_reasons: ["api_unavailable"],
    }));
  });

  it("calculates cnpj_validation_score when resolved", async () => {
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

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
    updateCnpjResult = {
      data: null,
      error: { message: "cnpj_already_set" },
    };

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "11222333000181",
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Esta loja já possui CNPJ cadastrado");
  });

  it("is idempotent when store already has the SAME CNPJ (no-op success, no RPC)", async () => {
    // Loja já possui exatamente este CNPJ → re-save é no-op (fix 409
    // cnpj_already_set no re-save do onboarding com hasExistingCnpj dessincronizado).
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Loja Marise",
      cnpj_normalized: "12345678000195",
    } as import("@/lib/store").Store);

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Nenhuma consulta externa/RPC: nada a fazer, CNPJ já persistido.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("persiste CNPJ alfanumérico canônico e hasheia a raiz canônica", async () => {
    const chain = mockFromNoDuplicate();
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12.ABC.345/01DE-35",
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(200);
    // Raiz das posições 1–8 do canônico (letras maiúsculas, sem pontuação).
    expect(hashCnpjRoot).toHaveBeenCalledWith("12ABC345");
    // Duplicidade compara o canônico, nunca a entrada mascarada.
    expect(chain.eq).toHaveBeenCalledWith("cnpj_normalized", "12ABC34501DE35");
    expect(mockResolve).toHaveBeenCalledWith("12ABC34501DE35");
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_cnpj_normalized: "12ABC34501DE35",
      p_cnpj_root_hash: "mocked_hash_64chars",
    }));
  });

  it("retorna 503 sem persistir quando o formato não é suportado (loja normal)", async () => {
    mockResolve.mockResolvedValue({ status: "unsupported_format" });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12.ABC.345/01DE-35",
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("permite defer com api_unsupported_format em test store", async () => {
    mockResolve.mockResolvedValue({ status: "unsupported_format" });
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Test Store",
      is_test_store: true,
    } as import("@/lib/store").Store);
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12.ABC.345/01DE-35",
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_cnpj_normalized: "12ABC34501DE35",
      p_verification_status: "defer",
      p_verification_reasons: ["api_unsupported_format"],
    }));
  });

  it("rejeita caractere desconhecido sem canonicalizar silenciosamente", async () => {
    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12.ABC.345/01DE-35😀",
      razaoSocial: "Razao Social Ltda",
    }));

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("returns 409 with cnpj_already_registered when CNPJ index conflicts", async () => {
    updateCnpjResult = {
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "idx_stores_cnpj_normalized"',
        details: 'Key (cnpj_normalized)=(12345678000195) already exists.',
      },
    };

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
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

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
    updateCnpjResult = {
      data: null,
      error: { message: "some_random_internal_error" },
    };

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

  it("Teste 26 (D7a): keeps store unverified when city/state absent — motor NOT called, no auto-approval", async () => {
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

    const { POST } = await import("../route");
    await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    // D7: sem city/state no store → motor NÃO é chamado
    expect(mockEvaluateFreemium).not.toHaveBeenCalled();
    // Nome similar (score 1) NÃO auto-aprova mais: loja permanece unverified
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_verification_status: "unverified",
      p_verification_data: expect.objectContaining({ score: 0 }),
    }));
  });

  it("Teste 26 (D7b): review situacao_nao_ativa when INAPTA/SUSPENSA despite name score >= 0.8 — NOT approved", async () => {
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Minha Loja",
      city: "São Paulo",
      state: "SP",
      segment: "moda-calcados-acessorios",
    } as import("@/lib/store").Store);
    mockEvaluateFreemium.mockReturnValue({
      decision: "review",
      reasons: ["situacao_nao_ativa"],
      score: 30,
      signals: { situacaoCadastral: "INAPTA" },
    });
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(mockEvaluateFreemium).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      // Situação não-ativa → review, NUNCA approved (mesmo com nome similar ≥ 0.8)
      p_verification_status: "review",
      p_verification_reasons: ["situacao_nao_ativa"],
      // Nome continua como métrica de apoio, não decisão
      p_cnpj_validation_score: expect.objectContaining({ name_match: true }),
    }));
  });

  it("Teste 26 (D7c): review segmento_cnae_divergente when CNAE incompatible — never reject, never approved", async () => {
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Minha Loja",
      city: "São Paulo",
      state: "SP",
      segment: "variedades-utilidades",
    } as import("@/lib/store").Store);
    mockEvaluateFreemium.mockReturnValue({
      decision: "review",
      reasons: ["segmento_cnae_divergente"],
      score: 40,
      signals: { cnaeCompatible: "incompatible" },
    });
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_verification_status: "review",
      p_verification_reasons: ["segmento_cnae_divergente"],
    }));
  });

  it("Teste 26 (D7d): approves via motor when all signals ok — decision from motor, not name score", async () => {
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Minha Loja",
      city: "São Paulo",
      state: "SP",
      segment: "moda-calcados-acessorios",
    } as import("@/lib/store").Store);
    mockEvaluateFreemium.mockReturnValue({
      decision: "approved",
      reasons: [],
      score: 100,
      signals: { cnaeCompatible: "compatible" },
    });
    updateCnpjResult = {
      data: { store: [{ id: STORE_UUID }] },
      error: null,
    };

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(mockEvaluateFreemium).toHaveBeenCalledWith(expect.objectContaining({
      city: "São Paulo",
      state: "SP",
      lookupOutcome: "resolved",
      rootEligible: true,
    }));
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_verification_status: "approved",
    }));
  });

  it("F50.4: coorte per_cnpj com raiz inelegível e beneficiário elegível passa o contexto ao motor", async () => {
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Minha Loja",
      city: "São Paulo",
      state: "SP",
      segment: "moda-calcados-acessorios",
    } as import("@/lib/store").Store);
    policyContextResult = {
      data: {
        policy_cohort: "per_cnpj_f50_4",
        beneficiary_eligible: true,
        beneficiary_ambiguous: false,
        root_eligible: false,
      },
      error: null,
    };
    updateCnpjResult = { data: { store: [{ id: STORE_UUID }] }, error: null };
    mockEvaluateFreemium.mockReturnValue({
      decision: "approved",
      reasons: [],
      score: 100,
      signals: {},
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(mockEvaluateFreemium).toHaveBeenCalledWith(expect.objectContaining({
      policyCohort: "per_cnpj_f50_4",
      beneficiaryEligible: true,
      rootEligible: false,
    }));
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_verification_status: "approved",
    }));
  });

  it("F50.4: mesmo CNPJ na coorte per_cnpj rejeita e não expõe dados sensíveis", async () => {
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Minha Loja",
      city: "São Paulo",
      state: "SP",
      segment: "moda-calcados-acessorios",
    } as import("@/lib/store").Store);
    policyContextResult = {
      data: {
        policy_cohort: "per_cnpj_f50_4",
        beneficiary_eligible: false,
        beneficiary_ambiguous: false,
        root_eligible: true,
      },
      error: null,
    };
    updateCnpjResult = { data: { store: [{ id: STORE_UUID }] }, error: null };
    mockEvaluateFreemium.mockReturnValue({
      decision: "reject",
      reasons: ["beneficiary_already_used"],
      score: 20,
      signals: {},
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("beneficiary_cnpj_normalized");
    expect(serialized).not.toContain("root_hash");
    expect(mockRpc).toHaveBeenCalledWith("update_store_cnpj", expect.objectContaining({
      p_verification_status: "reject",
      p_verification_reasons: ["beneficiary_already_used"],
    }));
  });

  it("F50.4: RPC de contexto indisponível → fallback legado por root_hash sem quebrar a atualização", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getCurrentStore } = await import("@/lib/auth/store-ownership");
    vi.mocked(getCurrentStore).mockResolvedValueOnce({
      id: STORE_UUID,
      name: "Minha Loja",
      city: "São Paulo",
      state: "SP",
      segment: "moda-calcados-acessorios",
    } as import("@/lib/store").Store);
    policyContextResult = { data: null, error: { message: "rpc unavailable" } };
    updateCnpjResult = { data: { store: [{ id: STORE_UUID }] }, error: null };
    mockEvaluateFreemium.mockReturnValue({
      decision: "approved",
      reasons: [],
      score: 100,
      signals: {},
    });

    const { POST } = await import("../route");
    const res = await POST(createRequest({
      storeId: STORE_UUID,
      cnpjNormalized: "12345678000195",
      razaoSocial: "Razao",
    }));

    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledWith("trial_offer_policy_context_unavailable");
    expect(mockEvaluateFreemium).toHaveBeenCalledWith(expect.objectContaining({
      rootEligible: true,
    }));
    expect(mockEvaluateFreemium.mock.calls[0][0].policyCohort).toBeUndefined();
    warn.mockRestore();
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
