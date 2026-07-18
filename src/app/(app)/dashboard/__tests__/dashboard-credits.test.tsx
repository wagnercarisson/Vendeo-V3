// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

const mockRequirePageUser = vi
  .fn()
  .mockResolvedValue({
    userId: "user-123",
    claims: { sub: "user-123" },
  });
const mockGetUserOnboardingState = vi.fn();
const mockGetCurrentStore = vi.fn();
const mockCountCampaigns = vi.fn();
const mockCountReadyCampaigns = vi.fn();
const mockGetRecentCampaigns = vi.fn();
const mockGetBalance = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/onboarding/state", () => ({
  getUserOnboardingState: mockGetUserOnboardingState,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/campaign/metrics", () => ({
  countCampaigns: mockCountCampaigns,
  countReadyCampaigns: mockCountReadyCampaigns,
  getRecentCampaigns: mockGetRecentCampaigns,
}));

vi.mock("@/lib/credit/credit-service", () => {
  class MockCreditService {
    getBalance = mockGetBalance;
  }
  return { CreditService: MockCreditService };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => <a href={href} className={className}>{children}</a>,
}));

function setupStoreWithCampaigns(balance: number = 10) {
  mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja Teste" });
  mockGetBalance.mockResolvedValue(balance);
  mockCountCampaigns.mockResolvedValue(5);
  mockCountReadyCampaigns.mockResolvedValue(3);
  mockGetRecentCampaigns.mockResolvedValue([
    { id: "c1", productName: "Tênis", status: "ready", createdAt: "2026-07-02T10:00:00Z" },
  ]);
  mockGetUserOnboardingState.mockResolvedValue("has_store_with_campaigns");
}

describe("Dashboard — Credit Badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows balance badge in metrics grid when has_store_with_campaigns", async () => {
    setupStoreWithCampaigns(10);

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("10");
    expect(html).toContain("Créditos");
  });

  it("shows balance badge in empty state when has_store_no_campaigns", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja Teste" });
    mockGetBalance.mockResolvedValue(5);
    mockGetUserOnboardingState.mockResolvedValue("has_store_no_campaigns");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("5 créditos");
  });

  it("does not show balance badge when no_store", async () => {
    mockGetUserOnboardingState.mockResolvedValue("no_store");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).not.toContain("Créditos");
  });
});
