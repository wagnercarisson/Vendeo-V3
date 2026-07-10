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

describe("MyCampaignsPage (Server Component)", () => {
  it("calls redirect('/store') when getCurrentStore returns null", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: MyCampaignsPage } = await import("@/app/minhas-campanhas/page");

    await expect(MyCampaignsPage()).rejects.toThrow("NEXT_CONTROL");
    expect(redirectFn).toHaveBeenCalledWith("/store");
  });

  it("calls listCampaigns with store id when store exists", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockListCampaigns.mockResolvedValue([]);

    const { default: MyCampaignsPage } = await import("@/app/minhas-campanhas/page");

    await MyCampaignsPage();
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

    const { default: MyCampaignsPage } = await import("@/app/minhas-campanhas/page");

    const result = await MyCampaignsPage();
    expect(result).toBeDefined();
  });
});

describe("CampaignPreviewPage redirect", () => {
  it("redirects authenticated+store to /minhas-campanhas", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-123" });

    const { default: CampaignPreviewPage } = await import("@/app/campaign/preview/page");

    await expect(CampaignPreviewPage()).rejects.toThrow("NEXT_CONTROL");
    expect(redirectFn).toHaveBeenCalledWith("/minhas-campanhas");
  });

  it("redirects to /store when no store", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampaignPreviewPage } = await import("@/app/campaign/preview/page");

    await expect(CampaignPreviewPage()).rejects.toThrow("NEXT_CONTROL");
    expect(redirectFn).toHaveBeenCalledWith("/store");
  });

  it("redirects to /login when not authenticated", async () => {
    const loginError = new Error("redirect:/login");
    mockRequirePageUser.mockRejectedValue(loginError);

    const { default: CampaignPreviewPage } = await import("@/app/campaign/preview/page");

    await expect(CampaignPreviewPage()).rejects.toThrow("redirect:/login");
  });
});

describe("Middleware matcher", () => {
  it("config.matcher includes /minhas-campanhas", async () => {
    const mod = await import("@/middleware");
    expect(mod.config.matcher).toContain("/minhas-campanhas");
  });
});
