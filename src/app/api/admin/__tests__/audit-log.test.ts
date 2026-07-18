import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function buildChain() {
  const range = vi.fn();
  const order = vi.fn().mockReturnValue({ range });
  const eq = vi.fn().mockImplementation(() => ({ eq, order }));
  const select = vi.fn().mockReturnValue({ eq, order });
  return { select, eq, order, range };
}

async function getAuditLog(url = "http://localhost/api/admin/audit-log") {
  const { GET } = await import("../audit-log/route");
  const req = new NextRequest(new Request(url));
  return GET(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("GET /api/admin/audit-log", () => {
  it("returns paginated audit log entries ordered by created_at DESC", async () => {
    const chain = buildChain();
    chain.range.mockResolvedValue({
      data: [{
        id: "log-1", actor_id: "admin-1", action: "credit_grant",
        target_type: "store", target_id: "store-1", reason: "Créditos de teste",
        operation_id: null, metadata: { amount: 10 },
        created_at: "2026-07-18T12:00:00Z",
      }],
      error: null, count: 1,
    });
    mockFrom.mockReturnValue(chain);

    const res = await getAuditLog();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].action).toBe("credit_grant");
    expect(body.total).toBe(1);
  });

  it("returns 403 when user is not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await getAuditLog();
    expect(res.status).toBe(403);
  });

  it("applies filters when provided", async () => {
    const chain = buildChain();
    chain.range.mockResolvedValue({
      data: [{
        id: "log-2", actor_id: "admin-1", action: "store_create_invite",
        target_type: "user", target_id: "user-1", reason: "Criação de loja via admin",
        operation_id: null, metadata: {},
        created_at: "2026-07-18T13:00:00Z",
      }],
      error: null, count: 1,
    });
    mockFrom.mockReturnValue(chain);

    const res = await getAuditLog(
      "http://localhost/api/admin/audit-log?action=store_create_invite&targetType=user",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].action).toBe("store_create_invite");
  });
});
