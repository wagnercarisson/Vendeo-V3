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

async function getCampaignErrors(url = "http://localhost/api/admin/campaigns/errors") {
  const { GET } = await import("../campaigns/errors/route");
  const req = new NextRequest(new Request(url));
  return GET(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("GET /api/admin/campaigns/errors", () => {
  it("returns paginated error campaigns with store context", async () => {
    const chain = buildChain();
    chain.range.mockResolvedValue({
      data: [{
        id: "camp-1", product_name: "Produto Teste", store_id: "store-1",
        stores: { name: "Loja Teste" },
        error_message: "Falha na geração de imagem",
        created_at: "2026-07-18T10:00:00Z",
        updated_at: "2026-07-18T11:00:00Z", status: "error",
      }],
      error: null, count: 1,
    });
    mockFrom.mockReturnValue(chain);

    const res = await getCampaignErrors();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.data[0].campaignId).toBe("camp-1");
    expect(body.data[0].storeName).toBe("Loja Teste");
    expect(body.data[0].errorMessage).toBe("Falha na geração de imagem");
  });

  it("returns empty list when no error campaigns exist", async () => {
    const chain = buildChain();
    chain.range.mockResolvedValue({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    const res = await getCampaignErrors();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns 403 when user is not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await getCampaignErrors();
    expect(res.status).toBe(403);
  });
});
