import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentStore = vi.fn();
const mockCountCampaigns = vi.fn();

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/onboarding/count", () => ({
  countCampaigns: mockCountCampaigns,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserOnboardingState", () => {
  it("returns 'no_store' when getCurrentStore returns null", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { getUserOnboardingState } = await import(
      "@/lib/onboarding/state"
    );

    const result = await getUserOnboardingState("user-123");

    expect(result).toBe("no_store");
    expect(mockCountCampaigns).not.toHaveBeenCalled();
  });

  it("returns 'has_store_no_campaigns' when store exists and count is 0", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockCountCampaigns.mockResolvedValue(0);

    const { getUserOnboardingState } = await import(
      "@/lib/onboarding/state"
    );

    const result = await getUserOnboardingState("user-123");

    expect(result).toBe("has_store_no_campaigns");
    expect(mockCountCampaigns).toHaveBeenCalledWith("store-456");
  });

  it("returns 'has_store_with_campaigns' when store exists and count > 0", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockCountCampaigns.mockResolvedValue(5);

    const { getUserOnboardingState } = await import(
      "@/lib/onboarding/state"
    );

    const result = await getUserOnboardingState("user-123");

    expect(result).toBe("has_store_with_campaigns");
    expect(mockCountCampaigns).toHaveBeenCalledWith("store-456");
  });
});
