// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListCampaigns = vi.fn();
const mockGetCurrentStore = vi.fn();
const mockRedirect = vi.fn();
const mockRequirePageUser = vi.fn().mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
const mockParseCampaignListSearchParams = vi.fn();

const NEXT_CONTROL = new Error("NEXT_CONTROL");
const redirectFn = vi.fn(() => { throw NEXT_CONTROL; });

const defaultValidated = {
  page: 1,
  pageSize: 10,
  q: undefined,
  status: ["ready", "error"] as const,
  dateFrom: undefined,
  dateTo: undefined,
  sortBy: "created_at" as const,
  sortOrder: "desc" as const,
};

vi.mock("next/navigation", () => ({
  redirect: redirectFn,
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/campaign/list", () => ({
  listCampaigns: mockListCampaigns,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/campaign/search-params", () => ({
  parseCampaignListSearchParams: mockParseCampaignListSearchParams,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockParseCampaignListSearchParams.mockReturnValue(defaultValidated);
});

describe("CampanhasPage (Server Component)", () => {
  it("renders empty state 'Configure sua loja' when getCurrentStore returns null (no redirect)", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampanhasPage } = await import("@/app/(app)/campanhas/page");

    const result = await CampanhasPage({ searchParams: Promise.resolve({}) });
    expect(result).toBeDefined();
    expect(redirectFn).not.toHaveBeenCalled();
  });

  it("calls listCampaigns with store id and defaults when store exists", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockListCampaigns.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });

    const { default: CampanhasPage } = await import("@/app/(app)/campanhas/page");

    await CampanhasPage({ searchParams: Promise.resolve({}) });
    expect(mockListCampaigns).toHaveBeenCalledWith("store-456", {
      page: 1,
      pageSize: 10,
      search: undefined,
      status: ["ready", "error"],
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: "created_at",
      sortOrder: "desc",
    });
  });

  it("renders without error when campaigns load", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-123" });
    mockListCampaigns.mockResolvedValue({
      items: [{
        id: "c1",
        productName: "Test",
        status: "ready",
        createdAt: "2026-01-01T00:00:00Z",
        thumbnailUrl: null,
        storagePath: "s/c1.jpg",
      }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    const { default: CampanhasPage } = await import("@/app/(app)/campanhas/page");

    const result = await CampanhasPage({ searchParams: Promise.resolve({}) });
    expect(result).toBeDefined();
  });
});

describe("Middleware matcher", () => {
  it("config.matcher includes /campanhas/:path*", async () => {
    const mod = await import("@/middleware");
    expect(mod.config.matcher).toContain("/campanhas/:path*");
  });
});
