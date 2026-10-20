import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRequireSameOrigin = vi.fn();
vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: (...args: unknown[]) => mockRequireSameOrigin(...args),
}));

const mockSendAccessInvite = vi.fn();
vi.mock("@/lib/access-requests/invite", () => ({
  sendAccessInvite: (...args: unknown[]) => mockSendAccessInvite(...args),
}));

async function postInvite(id: string) {
  const { POST } = await import("../route");
  const req = new NextRequest(
    new Request(`http://localhost/api/admin/access-requests/${id}/invite`, {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost" },
    }),
  );
  return POST(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockRequireSameOrigin.mockImplementation(() => {});
  mockSendAccessInvite.mockResolvedValue({
    ok: true,
    outcome: {
      status: "sent",
      providerMessageId: "msg-1",
      sentAt: "2026-10-20T12:00:00.000Z",
      error: null,
    },
  });
});

describe("POST /api/admin/access-requests/[id]/invite", () => {
  it("reenvia convite de solicitação aprovada", async () => {
    const res = await postInvite("req-1");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      invite: { status: "sent", providerMessageId: "msg-1" },
    });
    expect(mockSendAccessInvite).toHaveBeenCalledWith({
      requestId: "req-1",
      actorId: "admin-1",
      trigger: "resend",
    });
  });

  it("404 quando a solicitação não existe", async () => {
    mockSendAccessInvite.mockResolvedValue({
      ok: false,
      reason: "not_found",
      outcome: { status: "skipped", providerMessageId: null, sentAt: null, error: null },
    });

    const res = await postInvite("req-x");

    expect(res.status).toBe(404);
  });

  it("409 quando a solicitação não está aprovada", async () => {
    mockSendAccessInvite.mockResolvedValue({
      ok: false,
      reason: "not_approved",
      outcome: { status: "skipped", providerMessageId: null, sentAt: null, error: null },
    });

    const res = await postInvite("req-1");

    expect(res.status).toBe(409);
  });

  it("409 quando já existe envio em andamento (lease)", async () => {
    mockSendAccessInvite.mockResolvedValue({
      ok: false,
      reason: "locked",
      outcome: { status: "skipped", providerMessageId: null, sentAt: null, error: null },
    });

    const res = await postInvite("req-1");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Já existe um envio de convite em andamento. Aguarde.",
    });
  });
});
