import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
  createServerClient: vi.fn(),
}));

const mockRequireSameOrigin = vi.fn();
vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: (...args: unknown[]) => mockRequireSameOrigin(...args),
}));

async function postAccessRequest(body: unknown, origin = "http://localhost") {
  const { POST } = await import("../route");
  const req = new NextRequest(
    new Request("http://localhost/api/access-requests", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        origin,
        host: "localhost",
      },
    }),
  );
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSameOrigin.mockImplementation(() => {});
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle,
    insert: mockInsert,
  };
  mockFrom.mockReturnValue(chain);
});

describe("POST /api/access-requests", () => {
  it("200 { ok: true } e insere para email novo", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    const res = await postAccessRequest({
      email: "loja@example.com",
      store_name: "Minha Loja",
      segment: "padaria-confeitaria-doces",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockInsert).toHaveBeenCalledWith({
      email: "loja@example.com",
      name: null,
      store_name: "Minha Loja",
      segment: "padaria-confeitaria-doces",
      whatsapp: null,
      source: "landing",
    });
  });

  it("normaliza email para minúsculas antes do insert", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    await postAccessRequest({ email: "  Loja@Test.COM  " });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "loja@test.com" }),
    );
  });

  it("200 { ok: true } idêntico para email duplicado — sem insert", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "req-1" },
      error: null,
    });

    const res = await postAccessRequest({ email: "loja@example.com" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("400 genérico para email inválido — não consulta DB", async () => {
    const res = await postAccessRequest({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Dados inválidos" });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("400 genérico para body não-JSON", async () => {
    const { POST } = await import("../route");
    const req = new NextRequest(
      new Request("http://localhost/api/access-requests", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "text/plain", origin: "http://localhost", host: "localhost" },
      }),
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Dados inválidos" });
  });

  it("500 quando o insert falha no banco", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: { message: "db down" } });

    const res = await postAccessRequest({ email: "loja@example.com" });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erro ao registrar solicitação" });
  });

  it("403 quando requireSameOrigin falha", async () => {
    mockRequireSameOrigin.mockImplementation(() => {
      throw new ForbiddenError("Cross-origin request denied");
    });

    const res = await postAccessRequest({ email: "loja@example.com" });

    expect(res.status).toBe(403);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});
