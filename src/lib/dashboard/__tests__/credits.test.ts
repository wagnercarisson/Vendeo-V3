// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetBalanceBreakdown = vi.fn();
const mockCreateServerClient = vi.fn();
const mockLoadEligibleCampaignOverview = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
  supabaseAdmin: {},
}));

vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: class {
    getBalanceBreakdown = mockGetBalanceBreakdown;
  },
}));

vi.mock("@/lib/dashboard/campaigns", () => ({
  loadEligibleCampaignOverview: mockLoadEligibleCampaignOverview,
}));

vi.mock("@/lib/dashboard/credits", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/dashboard/credits")
  >();
  return {
    ...actual,
    loadDashboardCreditState: vi.fn(actual.loadDashboardCreditState),
  };
});

interface MockedCreditsModule {
  loadDashboardCreditState: ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateServerClient.mockResolvedValue({ from: vi.fn() });
});

describe("loadDashboardCreditState", () => {
  it("returns available when availableBalance > 0", async () => {
    mockGetBalanceBreakdown.mockResolvedValue({ availableBalance: 7 });

    const { loadDashboardCreditState } = await import(
      "@/lib/dashboard/credits"
    );
    const state = await loadDashboardCreditState("store-1");

    expect(mockGetBalanceBreakdown).toHaveBeenCalledWith("store-1", {
      throwOnError: true,
    });
    expect(state).toEqual({ state: "available", availableBalance: 7 });
  });

  it("returns zero when availableBalance === 0", async () => {
    mockGetBalanceBreakdown.mockResolvedValue({ availableBalance: 0 });

    const { loadDashboardCreditState } = await import(
      "@/lib/dashboard/credits"
    );
    const state = await loadDashboardCreditState("store-1");

    expect(state).toEqual({ state: "zero", availableBalance: 0 });
  });

  it("returns unavailable on read failure and never zero", async () => {
    mockGetBalanceBreakdown.mockRejectedValue(new Error("db down"));

    const { loadDashboardCreditState } = await import(
      "@/lib/dashboard/credits"
    );
    const state = await loadDashboardCreditState("store-1");

    expect(state).toEqual({ state: "unavailable" });
    expect(state).not.toHaveProperty("availableBalance");
    expect((state as { state: string }).state).not.toBe("zero");
  });
});

describe("section wrappers", () => {
  it("loadCreditSection returns { ok: true, data } on success", async () => {
    const creditsModule = (await import(
      "@/lib/dashboard/credits"
    )) as unknown as MockedCreditsModule;
    creditsModule.loadDashboardCreditState.mockResolvedValue({
      state: "available",
      availableBalance: 4,
    });

    const { loadCreditSection } = await import("@/lib/dashboard/sections");
    const result = await loadCreditSection("store-1");

    expect(result).toEqual({
      ok: true,
      data: { state: "available", availableBalance: 4 },
    });
  });

  it("loadCreditSection returns { ok: false } when the read rejects", async () => {
    const creditsModule = (await import(
      "@/lib/dashboard/credits"
    )) as unknown as MockedCreditsModule;
    creditsModule.loadDashboardCreditState.mockRejectedValue(
      new Error("unexpected"),
    );

    const { loadCreditSection } = await import("@/lib/dashboard/sections");
    const result = await loadCreditSection("store-1");

    expect(result).toEqual({ ok: false });
    expect(result).not.toHaveProperty("data");
  });

  it("loadCampaignSection returns { ok: true, data } on success", async () => {
    mockLoadEligibleCampaignOverview.mockResolvedValue({
      count: 2,
      items: [],
    });

    const { loadCampaignSection } = await import("@/lib/dashboard/sections");
    const result = await loadCampaignSection("store-1");

    expect(result).toEqual({ ok: true, data: { count: 2, items: [] } });
  });

  it("loadCampaignSection returns { ok: false } when the read rejects", async () => {
    mockLoadEligibleCampaignOverview.mockRejectedValue(new Error("db down"));

    const { loadCampaignSection } = await import("@/lib/dashboard/sections");
    const result = await loadCampaignSection("store-1");

    expect(result).toEqual({ ok: false });
    expect(result).not.toHaveProperty("data");
  });
});
