import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockInsertSingle = vi.fn();
const mockFrom = vi.fn();
const mockNotify = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/access-requests/admin-notice", () => ({
  notifyAdminOfAccessRequest: (...args: unknown[]) => mockNotify(...args),
  isRetryableAdminNoticeStatus: (status: unknown) =>
    typeof status === "string" &&
    ["pending", "failed", "unconfirmed", "suppressed", "sending"].includes(status),
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
  mockNotify.mockResolvedValue({
    status: "sent",
    providerMessageId: "email-1",
    errorCode: null,
    persisted: true,
  });
  mockInsertSingle.mockResolvedValue({
    data: { id: "req-new" },
    error: null,
  });
  mockInsert.mockReturnValue({
    select: vi.fn(() => ({ single: mockInsertSingle })),
  });
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

    const res = await postAccessRequest({
      email: "loja@example.com",
      store_name: "Minha Loja",
      segment: "padaria-confeitaria-doces",
      privacy_notice_version: "v1.3",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockInsert).toHaveBeenCalledWith({
      email: "loja@example.com",
      name: null,
      store_name: "Minha Loja",
      segment: "padaria-confeitaria-doces",
      whatsapp: null,
      privacy_notice_version: "v1.3",
      source: "landing",
      admin_notice_status: "pending",
    });
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith("req-new");
  });

  it("normaliza email para minúsculas antes do insert", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await postAccessRequest({ email: "  Loja@Test.COM  ", privacy_notice_version: "v1.3" });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "loja@test.com" }),
    );
  });

  it("200 { ok: true } idêntico para email duplicado — sem insert", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "req-1" },
      error: null,
    });

    const res = await postAccessRequest({ email: "loja@example.com", privacy_notice_version: "v1.3" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("Teste 12: approved prévio em access_requests NÃO bloqueia/duplica (histórico, não autorização) (D4)", async () => {
    // Registro prévio com status "approved" — tratado como histórico, não autorização.
    mockMaybeSingle.mockResolvedValue({
      data: { id: "req-approved-1" },
      error: null,
    });

    const res = await postAccessRequest({ email: "loja@example.com", privacy_notice_version: "v1.3" });

    // Resposta idêntica ao sucesso (anti-enumeração) — o approved NÃO cria autorização
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // Não duplica o registro (histórico preservado)
    expect(mockInsert).not.toHaveBeenCalled();
    // A consulta filtra por pending/approved — o approved é reconhecido como existente,
    // mas NÃO gera nenhum bloqueio de novo acesso (signup é independente)
    expect(mockFrom).toHaveBeenCalledWith("access_requests");
  });

  it("400 genérico para email inválido — não consulta DB", async () => {
    const res = await postAccessRequest({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Dados inválidos" });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("400 para aviso de privacidade não vigente", async () => {
    const res = await postAccessRequest({
      email: "loja@example.com",
      privacy_notice_version: "v1.4",
    });

    expect(res.status).toBe(400);
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

  it("duplicata com aviso já enviado NÃO cria nem reenvia aviso", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "req-1", admin_notice_status: "sent" },
      error: null,
    });

    const res = await postAccessRequest({
      email: "loja@example.com",
      privacy_notice_version: "v1.3",
    });

    expect(res.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("duplicata com aviso falho retoma o MESMO aviso (sem novo registro)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "req-1", admin_notice_status: "failed" },
      error: null,
    });

    const res = await postAccessRequest({
      email: "loja@example.com",
      privacy_notice_version: "v1.3",
    });

    expect(res.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith("req-1");
  });

  it("falha do aviso após persistência NÃO muda a resposta pública de sucesso", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockNotify.mockRejectedValue(new Error("resend down"));

    const res = await postAccessRequest({
      email: "loja@example.com",
      privacy_notice_version: "v1.3",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockNotify).toHaveBeenCalledWith("req-new");
  });

  it("insert confirmado sem id não tenta aviso e mantém resposta pública", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsertSingle.mockResolvedValue({ data: null, error: null });

    const res = await postAccessRequest({
      email: "loja@example.com",
      privacy_notice_version: "v1.3",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("500 quando o insert falha no banco", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: "db down" },
    });

    const res = await postAccessRequest({ email: "loja@example.com", privacy_notice_version: "v1.3" });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erro ao registrar solicitação" });
    expect(mockNotify).not.toHaveBeenCalled();
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
