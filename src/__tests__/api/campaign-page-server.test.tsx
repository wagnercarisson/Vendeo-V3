// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCampaignForDisplay = vi.fn();
const mockGetCurrentStore = vi.fn();
const mockGenerateSignedPreviewUrl = vi.fn();
const mockMapCampaignToProps = vi.fn();
const mockNotFound = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@/lib/campaign/display", () => ({
  getCampaignForDisplay: mockGetCampaignForDisplay,
  generateSignedPreviewUrl: mockGenerateSignedPreviewUrl,
  mapCampaignToProps: mockMapCampaignToProps,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: vi.fn().mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } }),
}));

const NEXT_CONTROL = new Error("NEXT_CONTROL");
const notFoundFn = vi.fn(() => { throw NEXT_CONTROL; });
const redirectFn = vi.fn(() => { throw NEXT_CONTROL; });

vi.mock("next/navigation", () => ({
  notFound: notFoundFn,
  redirect: redirectFn,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CampaignPage (Server Component)", () => {
  it("calls notFound() when getCampaignForDisplay returns null", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-123" });
    mockGetCampaignForDisplay.mockResolvedValue(null);

    const { default: CampaignPage } = await import("@/app/campanha/[id]/page");
    const params = Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" });

    await expect(CampaignPage({ params })).rejects.toThrow("NEXT_CONTROL");
    expect(notFoundFn).toHaveBeenCalled();
  });

  it("calls redirect('/store') when getCurrentStore returns null", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampaignPage } = await import("@/app/campanha/[id]/page");
    const params = Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" });

    await expect(CampaignPage({ params })).rejects.toThrow("NEXT_CONTROL");
    expect(redirectFn).toHaveBeenCalledWith("/store");
  });
});
