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

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/onboarding/state", () => ({
  getUserOnboardingState: mockGetUserOnboardingState,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashboardPage (Server Component)", () => {
  it("renders empty state 'Configure sua loja' with CTA /loja when no_store", async () => {
    mockGetUserOnboardingState.mockResolvedValue("no_store");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const result = await DashboardPage();
    const html = renderToString(result);

    expect(html).toContain("Configure sua loja");
    expect(html).toContain("/loja");
    expect(html).toContain("Configurar loja");
  });

  it("renders empty state 'Crie sua primeira campanha' with CTA /campanhas/nova when has_store_no_campaigns", async () => {
    mockGetUserOnboardingState.mockResolvedValue("has_store_no_campaigns");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const result = await DashboardPage();
    const html = renderToString(result);

    expect(html).toContain("Crie sua primeira campanha");
    expect(html).toContain("/campanhas/nova");
    expect(html).toContain("Criar campanha");
  });

  it("renders placeholder 'Seu dashboard está sendo preparado' without CTA when has_store_with_campaigns", async () => {
    mockGetUserOnboardingState.mockResolvedValue("has_store_with_campaigns");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const result = await DashboardPage();
    const html = renderToString(result);

    expect(html).toContain("Seu dashboard está sendo preparado");
    expect(html).not.toContain("Configurar loja");
    expect(html).not.toContain("Criar campanha");
  });

  it("renders PageHeader with title 'Dashboard' in all states", async () => {
    for (const state of [
      "no_store",
      "has_store_no_campaigns",
      "has_store_with_campaigns",
    ]) {
      mockGetUserOnboardingState.mockResolvedValue(state);

      const { default: DashboardPage } = await import(
        "@/app/(app)/dashboard/page"
      );
      const result = await DashboardPage();
      const html = renderToString(result);
      expect(html).toContain("Dashboard");
    }
  });

  it("calls getUserOnboardingState with user.userId", async () => {
    mockGetUserOnboardingState.mockResolvedValue("no_store");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    await DashboardPage();

    expect(mockGetUserOnboardingState).toHaveBeenCalledWith("user-123");
  });

  it("propagates error when getUserOnboardingState throws", async () => {
    mockGetUserOnboardingState.mockRejectedValue(new Error("DB error"));

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );

    await expect(DashboardPage()).rejects.toThrow("DB error");
  });
});
