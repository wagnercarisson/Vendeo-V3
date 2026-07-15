// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => <a href={href} className={className} {...props}>{children}</a>,
}));

function setupStoreWithCampaigns() {
  mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja Teste" });
  mockCountCampaigns.mockResolvedValue(5);
  mockCountReadyCampaigns.mockResolvedValue(3);
  mockGetRecentCampaigns.mockResolvedValue([
    { id: "c1", productName: "Tênis Runner Pro", status: "ready", createdAt: "2026-07-02T10:00:00Z" },
    { id: "c2", productName: "Café Gourmet", status: "ready", createdAt: "2026-07-01T10:00:00Z" },
    { id: "c3", productName: "Sofá 3 Lugares", status: "error", createdAt: "2026-06-30T10:00:00Z" },
  ]);
  mockGetUserOnboardingState.mockResolvedValue("has_store_with_campaigns");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DashboardPage — F19 states preserved", () => {
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

  it("renders PageHeader with title 'Dashboard' in preserved states", async () => {
    for (const state of ["no_store", "has_store_no_campaigns"]) {
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

describe("DashboardPage — greeting with mocked Date", () => {
  it('shows "Bom dia, Loja Teste" at 10h', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 10, 0, 0));
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Bom dia, Loja Teste");
  });

  it('shows "Boa tarde, Loja Teste" at 14h', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 14, 0, 0));
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Boa tarde, Loja Teste");
  });

  it('shows "Boa noite, Loja Teste" at 21h', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 21, 0, 0));
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Boa noite, Loja Teste");
  });
});

describe("DashboardPage — metrics grid", () => {
  it("renders 3 metric cards with correct values", async () => {
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Total de Campanhas");
    expect(html).toContain("Campanhas Prontas");
    expect(html).toContain("Taxa de Sucesso");
    expect(html).toContain("5");
    expect(html).toContain("3");
    expect(html).toMatch(/60.*%/);
  });

  it("has responsive grid classes", async () => {
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("grid-cols-1");
    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("gap-4");
  });

  it("Abrir link has min-h-[44px]", async () => {
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("min-h-[44px]");
  });
});

describe("DashboardPage — recent campaigns", () => {
  it("renders campaign items with product name and Abrir link", async () => {
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Campanhas Recentes");
    expect(html).toContain("Tênis Runner Pro");
    expect(html).toContain("Café Gourmet");
    expect(html).toContain("Sofá 3 Lugares");
    expect(html).toContain("Ver todas as campanhas →");
    expect(html).toContain('/campanhas/c1"');
    expect(html).toContain("/campanhas");
  });

  it("does not include old placeholder text", async () => {
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).not.toContain("Seu dashboard está sendo preparado");
  });
});

describe("DashboardPage — next-step card", () => {
  it("shows 'Revise sua última campanha' with CTA to latest", async () => {
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Próximo passo");
    expect(html).toContain("Revise sua última campanha");
    expect(html).toContain("Tênis Runner Pro");
    expect(html).toContain("Abrir campanha");
    expect(html).toContain('/campanhas/c1"');
  });

  it("shows 'Criar nova campanha' fallback when list is empty", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja Teste" });
    mockCountCampaigns.mockResolvedValue(0);
    mockCountReadyCampaigns.mockResolvedValue(0);
    mockGetRecentCampaigns.mockResolvedValue([]);
    mockGetUserOnboardingState.mockResolvedValue("has_store_with_campaigns");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Criar nova campanha");
    expect(html).not.toContain("Revise sua última campanha");
  });
});

describe("DashboardPage — edge cases", () => {
  it("renders without crashing when recent list is empty", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja Teste" });
    mockCountCampaigns.mockResolvedValue(3);
    mockCountReadyCampaigns.mockResolvedValue(3);
    mockGetRecentCampaigns.mockResolvedValue([]);
    mockGetUserOnboardingState.mockResolvedValue("has_store_with_campaigns");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );

    await expect(DashboardPage()).resolves.not.toThrow();
  });

  it("displays 0% success rate", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja Teste" });
    mockCountCampaigns.mockResolvedValue(0);
    mockCountReadyCampaigns.mockResolvedValue(0);
    mockGetRecentCampaigns.mockResolvedValue([]);
    mockGetUserOnboardingState.mockResolvedValue("has_store_with_campaigns");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toMatch(/0.*%/);
  });

  it("displays 100% success rate", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja Teste" });
    mockCountCampaigns.mockResolvedValue(3);
    mockCountReadyCampaigns.mockResolvedValue(3);
    mockGetRecentCampaigns.mockResolvedValue([
      { id: "c1", productName: "Produto", status: "ready", createdAt: "2026-07-02T10:00:00Z" },
    ]);
    mockGetUserOnboardingState.mockResolvedValue("has_store_with_campaigns");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toMatch(/100.*%/);
  });

  it("handles null store with fallback EmptyState", async () => {
    mockGetCurrentStore.mockResolvedValue(null);
    mockGetUserOnboardingState.mockResolvedValue("has_store_with_campaigns");

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Configure sua loja");
  });

  it("renders 'Nova campanha' secondary link", async () => {
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Nova campanha →");
    expect(html).toContain("/campanhas/nova");
  });
});

describe("DashboardPage — store config link", () => {
  it("renders discreet 'Configurar loja' link", async () => {
    setupStoreWithCampaigns();

    const { default: DashboardPage } = await import(
      "@/app/(app)/dashboard/page"
    );
    const html = renderToString(await DashboardPage());

    expect(html).toContain("Configurar loja");
    expect(html).toContain("/loja");
  });
});
