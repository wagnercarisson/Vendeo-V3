import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: (...args: unknown[]) => mockFrom(...args),
  },
  createServerClient: vi.fn(),
}));

const mockRequireSameOrigin = vi.fn();
vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: (...args: unknown[]) => mockRequireSameOrigin(...args),
}));

async function postReview(id: string, body: unknown) {
  const { POST } = await import("../[id]/route");
  const req = new NextRequest(
    new Request(`http://localhost/api/admin/access-requests/${id}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        origin: "http://localhost",
        host: "localhost",
      },
    }),
  );
  return POST(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockRequireSameOrigin.mockImplementation(() => {});
});

describe("POST /api/admin/access-requests/[id]", () => {
  it("approve chama RPC admin_review_access_request com p_action approve e retorna success", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, status: "approved", email: "loja@example.com" },
      error: null,
    });

    const res = await postReview("req-1", { action: "approve" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      status: "approved",
    });
    expect(mockRpc).toHaveBeenCalledWith("admin_review_access_request", {
      p_request_id: "req-1",
      p_action: "approve",
      p_actor_id: "admin-1",
      p_notes: null,
    });
  });

  it("reject chama RPC com p_action reject e retorna status rejected", async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, status: "rejected", email: "loja@example.com" },
      error: null,
    });

    const res = await postReview("req-1", { action: "reject", notes: "Fora do segmento" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, status: "rejected" });
    expect(mockRpc).toHaveBeenCalledWith("admin_review_access_request", {
      p_request_id: "req-1",
      p_action: "reject",
      p_actor_id: "admin-1",
      p_notes: "Fora do segmento",
    });
  });

  it("400 com action inválida — antes de chamar o RPC", async () => {
    const res = await postReview("req-1", { action: "maybe" });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("404 quando o RPC reporta request_not_found", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'request_not_found' },
    });

    const res = await postReview("req-1", { action: "approve" });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: "Solicitação não encontrada ou já revisada",
    });
  });

  it("404 quando o RPC reporta already_reviewed", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'already_reviewed' },
    });

    const res = await postReview("req-1", { action: "reject" });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: "Solicitação não encontrada ou já revisada",
    });
  });

  it("500 para erro genérico do RPC", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "db down" },
    });

    const res = await postReview("req-1", { action: "approve" });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Erro ao revisar solicitação",
    });
  });

  it("403 quando requireAdmin falha", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await postReview("req-1", { action: "approve" });

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("NÃO insere diretamente em admin_audit_log (auditoria só via RPC)", async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });

    await postReview("req-1", { action: "approve" });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
