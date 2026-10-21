import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const STORE_ID = "00000000-0000-4000-a000-000000000001";

const {
  mockFrom,
  mockUpdate,
  mockUpdateEq,
  mockUpsert,
  mockUpsertSingle,
  mockResolve,
} = vi.hoisted(() => {
  const mockUpdateEq = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
  const mockUpsertSingle = vi.fn();
  const mockUpsert = vi.fn(() => ({
    select: () => ({ single: mockUpsertSingle }),
  }));
  const mockResolve = vi.fn();
  const mockFrom = vi.fn((table: string) => {
    if (table === "stores") return { update: mockUpdate };
    if (table === "store_billing_info") return { upsert: mockUpsert };
    return {};
  });
  return { mockFrom, mockUpdate, mockUpdateEq, mockUpsert, mockUpsertSingle, mockResolve };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireAuthorizedStore: vi.fn(async (storeId: string) => ({
    userId: "00000000-0000-4000-a000-000000000000",
    storeId,
    store: {
      id: storeId,
      name: "Minha Loja",
      cnpj_normalized: "12ABC34501DE35",
    },
  })),
  StoreNotFoundError: class extends Error {},
}));

vi.mock("@/lib/auth/require-user", () => ({
  UnauthorizedError: class extends Error {},
}));

vi.mock("@/lib/auth/api-handler", () => ({
  apiHandler: vi.fn((handler) => handler),
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock("@/lib/cnpj/verification-service", () => ({
  CnpjVerificationService: class {
    resolve = mockResolve;
  },
  createSupabaseLookupCache: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock("@/lib/cnpj/lookup-providers/brasil-api", () => ({ BrasilApiProvider: vi.fn() }));
vi.mock("@/lib/cnpj/lookup-providers/cnpja", () => ({ CnpjaProvider: vi.fn() }));

vi.mock("@/lib/cnpj/similarity", () => ({
  compareBusinessName: vi.fn(() => ({ bestScore: 1, nameToLegal: 1, nameToFantasy: null, label: "match" })),
}));

vi.mock("@/lib/billing/cnpj-address-mapper", () => ({
  getPreFillFromCnpj: vi.fn(() => ({})),
}));

import { POST } from "../route";

function createRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/store/${STORE_ID}/reconsult-cnpj`, {
    method: "POST",
    headers: { "x-forwarded-for": "127.0.0.1", "user-agent": "test" },
  });
}

function context() {
  return { params: Promise.resolve({ id: STORE_ID }) };
}

const resolvedActive = {
  status: "resolved" as const,
  data: {
    cnpj_normalized: "12ABC34501DE35",
    razao_social: "EMPRESA ALFA LTDA",
    nome_fantasia: "Alfa",
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateEq.mockResolvedValue({ error: null });
  mockUpsertSingle.mockResolvedValue({ data: {}, error: null });
  mockResolve.mockResolvedValue(resolvedActive);
});

describe("POST /api/store/[id]/reconsult-cnpj", () => {
  it("returns 503 without writing when format is unsupported", async () => {
    mockResolve.mockResolvedValue({ status: "unsupported_format" });

    const res = await POST(createRequest(), context());

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.lookupStatus).toBe("unsupported_format");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 503 without writing when lookup is unavailable", async () => {
    mockResolve.mockResolvedValue({ status: "unavailable" });

    const res = await POST(createRequest(), context());

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.lookupStatus).toBe("unavailable");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 without writing when CNPJ is not found", async () => {
    mockResolve.mockResolvedValue({ status: "not_found" });

    const res = await POST(createRequest(), context());

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates official data when resolved and situation is active", async () => {
    const res = await POST(createRequest(), context());

    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith("12ABC34501DE35");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      razao_social: "EMPRESA ALFA LTDA",
    }));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 422 without writing when resolved situation is not active", async () => {
    mockResolve.mockResolvedValue({
      status: "resolved",
      data: { ...resolvedActive.data, situacao_cadastral: "BAIXADA" },
    });

    const res = await POST(createRequest(), context());

    expect(res.status).toBe(422);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
