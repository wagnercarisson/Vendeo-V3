// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListCampaigns = vi.fn();
const mockGetCurrentStore = vi.fn();
const mockRedirect = vi.fn();
const mockRequirePageUser = vi.fn().mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });

const NEXT_CONTROL = new Error("NEXT_CONTROL");
const redirectFn = vi.fn(() => { throw NEXT_CONTROL; });

vi.mock("next/navigation", () => ({
  redirect: redirectFn,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CampanhasPage (Server Component)", () => {
  it("calls redirect('/loja') when getCurrentStore returns null", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampanhasPage } = await import("@/app/(app)/campanhas/page");

    await expect(CampanhasPage()).rejects.toThrow("NEXT_CONTROL");
    expect(redirectFn).toHaveBeenCalledWith("/loja");
  });

  it("calls listCampaigns with store id when store exists", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockListCampaigns.mockResolvedValue([]);

    const { default: CampanhasPage } = await import("@/app/(app)/campanhas/page");

    await CampanhasPage();
    expect(mockListCampaigns).toHaveBeenCalledWith("store-456");
  });

  it("renders without error when campaigns load", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-123" });
    mockListCampaigns.mockResolvedValue([{
      id: "c1",
      productName: "Test",
      status: "ready",
      createdAt: "2026-01-01T00:00:00Z",
      thumbnailUrl: null,
      storagePath: "s/c1.jpg",
    }]);

    const { default: CampanhasPage } = await import("@/app/(app)/campanhas/page");

    const result = await CampanhasPage();
    expect(result).toBeDefined();
  });
});

describe("Middleware matcher", () => {
  it("config.matcher includes /campanhas/:path*", async () => {
    const mod = await import("@/middleware");
    expect(mod.config.matcher).toContain("/campanhas/:path*");
  });
});
