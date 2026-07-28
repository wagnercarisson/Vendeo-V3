import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock("server-only", () => ({}));

const mockResolve = vi.fn();

vi.mock('@/lib/auth/require-user', () => ({
  requireApiUser: vi.fn(() => Promise.resolve({ userId: '00000000-0000-0000-0000-000000000001' })),
  UnauthorizedError: class extends Error {},
}));

vi.mock('@/lib/auth/api-handler', () => ({
  apiHandler: vi.fn((handler) => handler),
}));

vi.mock('@/lib/cnpj/validate', () => ({
  validateCnpj: vi.fn((raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "12345678000190") return { normalized: "12345678000190" };
    if (digits === "11111111111111") return new Error("CNPJ inv\u00e1lido");
    return new Error("CNPJ inv\u00e1lido");
  }),
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
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: vi.fn() },
  createServerClient: vi.fn(),
}));

import { GET } from "../route";

function createRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe("GET /api/cnpj/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns resolved with data for valid CNPJ", async () => {
    mockResolve.mockResolvedValue({
      status: "resolved",
      data: {
        razao_social: "EMPRESA EXEMPLO LTDA",
        nome_fantasia: "Empresa Exemplo",
        situacao_cadastral: "ATIVA",
        cep: "01234567",
        logradouro: "Rua Exemplo",
        numero: "123",
        bairro: "Centro",
        cidade: "São Paulo",
        uf: "SP",
        cnae_principal: "4781-4/00",
        data_situacao: "2020-01-01",
        data_abertura: "2010-05-10",
      },
    });

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12345678000190"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("resolved");
    expect(body.data.razao_social).toBe("EMPRESA EXEMPLO LTDA");
    expect(body.message).toBeDefined();
  });

  it("returns not_found for inexistent CNPJ", async () => {
    mockResolve.mockResolvedValue({ status: "not_found" });

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12345678000190"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("not_found");
    expect(body.message).toContain("não encontrado");
  });

  it("returns unavailable when API is down", async () => {
    mockResolve.mockResolvedValue({ status: "unavailable" });

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12345678000190"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("unavailable");
    expect(body.message).toContain("Não foi possível");
  });

  it("returns 400 for invalid CNPJ", async () => {
    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=11111111111111"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CNPJ inválido");
  });

  it("returns 401 when not authenticated", async () => {
    const { requireApiUser, UnauthorizedError } = await import("@/lib/auth/require-user");
    vi.mocked(requireApiUser).mockRejectedValueOnce(new UnauthorizedError());

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12345678000190"));

    expect(res.status).toBe(401);
  });
});
