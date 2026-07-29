import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock("server-only", () => ({}));

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

const mockResolve = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/auth/csrf', () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock('@/lib/auth/require-user', () => ({
  requireUser: vi.fn(() => Promise.resolve({ userId: '00000000-0000-0000-0000-000000000001' })),
  requireApiUser: vi.fn(),
  UnauthorizedError: class extends Error {},
}));

vi.mock('@/lib/store-response', () => ({
  buildStoreResponse: vi.fn(),
}));

vi.mock('@/lib/legal/document-versions', () => ({
  getCurrentVersion: vi.fn(async () => ({ version: 'v1.0', effectiveAt: '2026-07-23T00:00:00Z', summary: null })),
}));

vi.mock('@/lib/cnpj/validate', () => ({
  validateCnpj: vi.fn((raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "12345678000195") return { normalized: "12345678000195" };
    if (digits === "22345678000195") return { normalized: "22345678000195" };
    if (digits === "3345678000190") return { normalized: "3345678000190" };
    if (digits === "11111111111111") return new Error("CNPJ inv\u00e1lido");
    return new Error("CNPJ inv\u00e1lido");
  }),
}));

vi.mock('@/lib/cnpj/mask', () => ({
  maskCnpj: vi.fn(() => "**.***.***/0001-**"),
}));

vi.mock('@/lib/cnpj/hash', () => ({
  hashCnpjRoot: vi.fn(() => "mocked_hash_64chars"),
}));

vi.mock('@/lib/cnpj/similarity', () => ({
  compareBusinessName: vi.fn(() => ({ bestScore: 1, nameToLegal: 1, nameToFantasy: null, label: "match" })),
}));

vi.mock('@/lib/cnpj/lookup-providers/brasil-api', () => {
  return { BrasilApiProvider: class { lookup = vi.fn() } };
});

vi.mock('@/lib/cnpj/lookup-providers/cnpja', () => {
  return { CnpjaProvider: class { lookup = vi.fn() } };
});

vi.mock('@/lib/cnpj/verification-service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/cnpj/verification-service')>();
  return {
    ...original,
    CnpjVerificationService: class {
      resolve = mockResolve;
    },
  };
});

vi.mock('@/lib/cnpj/lookup-providers/types', () => ({}));

import { POST } from "../route";

process.env.CNPJ_PEPPER = "test_pepper_hex_64_chars";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/store", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": "127.0.0.1", "user-agent": "test" },
  });
}

const sampleLookupResolved = {
  status: "resolved",
  data: {
    cnpj_normalized: "12345678000195",
    razao_social: "MINHA LOJA LTDA",
    nome_fantasia: "Minha Loja",
    situacao_cadastral: "ATIVA",
    cep: "01234567",
    logradouro: "Rua Exemplo",
    numero: "123",
    complemento: null,
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cnae_principal: "4781-4/00",
    cnae_descricao: null,
    data_situacao: "2020-01-01",
    data_abertura: "2010-05-10",
    porte: "ME",
  },
};

describe("POST /api/store — CNPJ onboarding with verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates store with APPROVE verification and grant onboarding", async () => {
    mockResolve.mockResolvedValue(sampleLookupResolved);
    mockRpc.mockResolvedValueOnce({
      data: {
        store: [{ id: "store-1", name: "Minha Loja", segment: "moda-calcados-acessorios" }],
        onboardingGranted: true,
        verificationStatus: "approved",
      },
      error: null,
    });

    const res = await POST(createRequest({
      name: "Minha Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("store-1");
    expect(body.onboardingGranted).toBe(true);
    expect(body.verificationStatus).toBe("approved");
  });

  it("creates store with REVIEW and no grant", async () => {
    mockResolve.mockResolvedValue({
      status: "resolved",
      data: {
        ...sampleLookupResolved.data,
        razao_social: "RAZAO COMPLETAMENTE DIFERENTE LTDA",
        nome_fantasia: null,
      },
    });
    mockRpc.mockResolvedValueOnce({
      data: {
        store: [{ id: "store-2", name: "Loja Review", segment: "moda-calcados-acessorios" }],
        onboardingGranted: false,
        verificationStatus: "review",
      },
      error: null,
    });

    const res = await POST(createRequest({
      name: "Nome Completamente Diferente",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.onboardingGranted).toBe(false);
    expect(body.verificationStatus).toBe("review");
  });

  it("blocks store creation when CNPJ not found", async () => {
    mockResolve.mockResolvedValue({ status: "not_found" });

    const res = await POST(createRequest({
      name: "Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("não foi encontrado na Receita Federal");
  });

  it("creates store with DEFER when lookup unavailable", async () => {
    mockResolve.mockResolvedValue({ status: "unavailable" });
    mockRpc.mockResolvedValueOnce({
      data: {
        store: [{ id: "store-3", name: "Loja Defer", segment: "moda-calcados-acessorios" }],
        onboardingGranted: false,
        verificationStatus: "defer",
      },
      error: null,
    });

    const res = await POST(createRequest({
      name: "Loja Defer",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.onboardingGranted).toBe(false);
    expect(body.verificationStatus).toBe("defer");
  });

  it("creates store with rejected status for inactive CNPJ", async () => {
    mockResolve.mockResolvedValue({
      status: "resolved",
      data: {
        ...sampleLookupResolved.data,
        razao_social: "EMPRESA BAIXADA LTDA",
        situacao_cadastral: "BAIXADA",
      },
    });
    mockRpc.mockResolvedValueOnce({
      data: {
        store: [{ id: "store-4", name: "Loja Inativa", segment: "moda-calcados-acessorios" }],
        onboardingGranted: false,
        verificationStatus: "rejected",
      },
      error: null,
    });

    const res = await POST(createRequest({
      name: "Loja Inativa",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.onboardingGranted).toBe(false);
    expect(body.verificationStatus).toBe("rejected");
  });

  it("returns 400 for invalid CNPJ", async () => {
    const res = await POST(createRequest({
      name: "Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "11.111.111/0001-11",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when CNPJ is missing", async () => {
    const res = await POST(createRequest({
      name: "Loja",
      segment: "moda-calcados-acessorios",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(400);
  });

  it("returns 409 with cnpj_already_registered when CNPJ index conflicts", async () => {
    mockResolve.mockResolvedValue(sampleLookupResolved);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "idx_stores_cnpj_normalized"',
        details: 'Key (cnpj_normalized)=(12345678000195) already exists.',
      },
    });

    const res = await POST(createRequest({
      name: "Outra Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("CNPJ já está cadastrado");
    expect(body.code).toBe("cnpj_already_registered");
  });

  it("returns 409 with user-already-has-store when user_id key conflicts", async () => {
    mockResolve.mockResolvedValue(sampleLookupResolved);
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "stores_user_id_key"',
        details: 'Key (user_id)=(00000000-0000-0000-0000-000000000001) already exists.',
      },
    });

    const res = await POST(createRequest({
      name: "Outra Loja",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Usuário já possui uma loja");
  });

  it("persists CNPJ, razao_social and nome_fantasia atomically via RPC", async () => {
    mockResolve.mockResolvedValue(sampleLookupResolved);
    mockRpc.mockResolvedValueOnce({
      data: {
        store: [{ id: "store-atomic", name: "Loja Atomica", segment: "moda-calcados-acessorios", cnpj_normalized: "12345678000195", razao_social: "MINHA LOJA LTDA", nome_fantasia: "Minha Loja" }],
        onboardingGranted: true,
        verificationStatus: "approved",
      },
      error: null,
    });

    const res = await POST(createRequest({
      name: "Loja Atomica",
      segment: "moda-calcados-acessorios",
      cnpj: "12.345.678/0001-95",
      razaoSocial: "MINHA LOJA LTDA",
      nomeFantasia: "Minha Loja",
      acceptedTerms: true,
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("store-atomic");

    // Verify all three fiscal fields are passed in a single RPC call
    expect(mockRpc).toHaveBeenCalledWith("create_store_with_cnpj", expect.objectContaining({
      p_cnpj_normalized: "12345678000195",
      p_razao_social: "MINHA LOJA LTDA",
      p_nome_fantasia: "Minha Loja",
    }));
  });
});
