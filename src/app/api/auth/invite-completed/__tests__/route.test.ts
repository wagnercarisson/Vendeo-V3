import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireSameOrigin = vi.fn();
vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: (...args: unknown[]) => mockRequireSameOrigin(...args),
}));

const mockRequireApiUser = vi.fn();
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: (...args: unknown[]) => mockRequireApiUser(...args),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function setupUpdate(data: unknown[] | null, error: unknown = null) {
  const select = vi.fn().mockResolvedValue({ data, error });
  const is = vi.fn().mockReturnValue({ select });
  const eq2 = vi.fn().mockReturnValue({ is });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  mockFrom.mockReturnValue({ update });
  return { update, eq1, eq2, is, select };
}

async function post() {
  const { POST } = await import("../route");
  const req = new NextRequest("http://localhost/api/auth/invite-completed", {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost", "Content-Type": "application/json" },
    body: "{}",
  });
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSameOrigin.mockImplementation(() => {});
  mockRequireApiUser.mockResolvedValue({ userId: "user-1", claims: { sub: "user-1" } });
});

describe("POST /api/auth/invite-completed", () => {
  it("marca password_set_at somente do próprio convite aprovado", async () => {
    const { eq1, eq2, is } = setupUpdate([{ id: "req-1" }]);

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, marked: true });
    expect(mockFrom).toHaveBeenCalledWith("access_requests");
    expect(eq1).toHaveBeenCalledWith("invited_user_id", "user-1");
    expect(eq2).toHaveBeenCalledWith("status", "approved");
    expect(is).toHaveBeenCalledWith("password_set_at", null);
  });

  it("idempotente: já concluído → marked=false", async () => {
    setupUpdate([]);

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, marked: false });
  });

  it("exige mesma origem", async () => {
    mockRequireSameOrigin.mockImplementation(() => {
      throw new ForbiddenError("Cross-origin request denied");
    });

    const res = await post();

    expect(res.status).toBe(403);
    expect(mockRequireApiUser).not.toHaveBeenCalled();
  });

  it("exige sessão autenticada", async () => {
    mockRequireApiUser.mockRejectedValue(new UnauthorizedError());

    const res = await post();

    expect(res.status).toBe(401);
  });

  it("erro de persistência → 500 explícito", async () => {
    setupUpdate(null, { message: "db down" });

    const res = await post();

    expect(res.status).toBe(500);
  });
});
