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

// Validador real: allowlist + DV oficial. Evita mock com replace(/\D/g, "")
// que aceitaria entradas que a produção rejeita.
vi.mock('@/lib/cnpj/validate', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/cnpj/validate')>();
  return { validateCnpj: original.validateCnpj };
});

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

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12345678000195"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("resolved");
    expect(body.data.razao_social).toBe("EMPRESA EXEMPLO LTDA");
    expect(body.message).toBeDefined();
  });

  it("returns not_found for inexistent CNPJ", async () => {
    mockResolve.mockResolvedValue({ status: "not_found" });

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12345678000195"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("not_found");
    expect(body.message).toContain("não encontrado");
  });

  it("returns unavailable when API is down", async () => {
    mockResolve.mockResolvedValue({ status: "unavailable" });

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12345678000195"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("unavailable");
    expect(body.message).toContain("Não foi possível");
  });

  it("resolves alphanumeric CNPJ using the canonical value", async () => {
    mockResolve.mockResolvedValue({
      status: "resolved",
      data: {
        cnpj_normalized: "12ABC34501DE35",
        razao_social: "EMPRESA ALFA LTDA",
        nome_fantasia: null,
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

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12.abc.345/01de-35"));

    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith("12ABC34501DE35");
    const body = await res.json();
    expect(body.status).toBe("resolved");
    expect(body.data.cnpj_normalized).toBe("12ABC34501DE35");
  });

  it("returns 200 unsupported_format when rejection is definitive", async () => {
    mockResolve.mockResolvedValue({ status: "unsupported_format" });

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12.ABC.345/01DE-35"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("unsupported_format");
    expect(body.message).toBe(
      "A consulta cadastral ainda não suporta este formato de CNPJ. Tente novamente mais tarde."
    );
  });

  it("returns unavailable when unsupported_format is mixed with unavailability", async () => {
    // O serviço agrega mistura como unavailable; a rota apenas a preserva.
    mockResolve.mockResolvedValue({ status: "unavailable" });

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12.ABC.345/01DE-35"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("unavailable");
  });

  it("returns 400 for unknown characters without calling resolve", async () => {
    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12.ABC.345/01DE-35😀"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("CNPJ inválido");
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("returns 400 for known numeric sequence without calling resolve", async () => {
    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=00000000000000"));

    expect(res.status).toBe(400);
    expect(mockResolve).not.toHaveBeenCalled();
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

    const res = await GET(createRequest("http://localhost/api/cnpj/lookup?cnpj=12345678000195"));

    expect(res.status).toBe(401);
  });
});
