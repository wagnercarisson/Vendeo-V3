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
}));

vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: function MockCreditService() {
    return {
      getBalance: vi.fn().mockResolvedValue(50),
      getHistory: vi.fn().mockResolvedValue([
        {
          id: "tx-1",
          storeId: "store-1",
          type: "admin_grant",
          amount: 10,
          balanceBefore: 40,
          balanceAfter: 50,
          createdAt: "2026-07-18T12:00:00Z",
        },
      ]),
    };
  },
}));

function mockStoreQuery(returnData: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: returnData, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, maybeSingle };
}

function mockCampaignQuery(returnData: unknown) {
  const limit = vi.fn().mockResolvedValue({ data: returnData, error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, order, limit };
}

async function getUsers(url = "http://localhost/api/admin/users") {
  const { GET } = await import("../users/route");
  const req = new NextRequest(new Request(url));
  return GET(req);
}

async function getUserDetail(id: string) {
  const { GET } = await import("../users/[id]/route");
  const req = new NextRequest(
    new Request(`http://localhost/api/admin/users/${id}`),
  );
  return GET(req, { params: { id } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("GET /api/admin/users", () => {
  it("returns paginated user list with consolidated data", async () => {
    mockRpc.mockResolvedValue({
      data: {
        data: [
          {
            userId: "user-1", email: "user@test.com", storeId: "store-1",
            storeName: "Loja Teste", segment: "moda", balance: 50,
            totalCampaigns: 10, errorCampaigns: 1,
            lastCampaignAt: "2026-07-17T10:00:00Z",
            createdAt: "2026-07-01T08:00:00Z",
          },
        ],
        total: 1,
      },
      error: null,
    });

    const res = await getUsers();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].email).toBe("user@test.com");
    expect(body.data[0].balance).toBe(50);
  });

  it("filters by search parameter", async () => {
    mockRpc.mockResolvedValue({ data: { data: [], total: 0 }, error: null });

    const res = await getUsers("http://localhost/api/admin/users?search=joao");
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_get_users_summary", {
      p_search: "joao", p_page: 1, p_page_size: 20,
    });
  });

  it("returns 403 when user is not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await getUsers();
    expect(res.status).toBe(403);
  });

  it("filters by store kind (production)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        data: [{
          userId: "user-1", email: "prod@test.com", storeId: "store-1",
          storeName: "Loja Produção", segment: "moda", balance: 50,
          totalCampaigns: 10, errorCampaigns: 1,
          createdAt: "2026-07-01T08:00:00Z",
        }],
        total: 1,
      },
      error: null,
    });

    const res = await getUsers("http://localhost/api/admin/users?kind=production");
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_get_users_summary", {
      p_search: null, p_page: 1, p_page_size: 20, p_store_kind: "production",
    });
  });

  it("filters by store kind (test)", async () => {
    mockRpc.mockResolvedValue({
      data: {
        data: [{
          userId: "user-2", email: "test@test.com", storeId: "store-2",
          storeName: "Loja Teste", segment: "moda", balance: 10,
          totalCampaigns: 3, errorCampaigns: 0,
          createdAt: "2026-07-01T08:00:00Z",
        }],
        total: 1,
      },
      error: null,
    });

    const res = await getUsers("http://localhost/api/admin/users?kind=test");
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_get_users_summary", {
      p_search: null, p_page: 1, p_page_size: 20, p_store_kind: "test",
    });
  });

  it("defaults to kind=all when no kind param", async () => {
    mockRpc.mockResolvedValue({ data: { data: [], total: 0 }, error: null });

    const res = await getUsers("http://localhost/api/admin/users");
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_get_users_summary", {
      p_search: null, p_page: 1, p_page_size: 20, p_store_kind: "all",
    });
  });
});

describe("GET /api/admin/users/[id]", () => {
  it("returns consolidated user detail with balance and history when store exists", async () => {
    const mockData = { id: "store-1", name: "Loja Teste", segment: "moda", user_id: "user-1" };

    const storeChain = mockStoreQuery(mockData);
    const campChain = mockCampaignQuery([]);
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return storeChain;
      return campChain;
    });

    const res = await getUserDetail("user-1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-1");
    expect(body.store.id).toBe("store-1");
    expect(body.balance).toBe(50);
    expect(body.history).toHaveLength(1);
  });

  it("returns minimal data when user has no store", async () => {
    const storeChain = mockStoreQuery(null);
    mockFrom.mockReturnValue(storeChain);

    const res = await getUserDetail("user-2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.store).toBeNull();
    expect(body.balance).toBe(0);
    expect(body.history).toHaveLength(0);
  });
});
