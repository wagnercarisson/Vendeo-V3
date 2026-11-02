// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

const mockRequirePageUser = vi
  .fn()
  .mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
const mockGetCurrentStore = vi.fn();
const mockGetUiRenderContext = vi.fn();
const mockGetStoreMarketSettings = vi.fn();
const mockLoadCampaignSection = vi.fn();
const mockLoadCreditSection = vi.fn();
const mockGetLatestAnnouncement = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: mockGetUiRenderContext,
}));

vi.mock("@/lib/market-preferences/store-market-settings-service", () => ({
  getStoreMarketSettings: mockGetStoreMarketSettings,
}));

vi.mock("@/lib/dashboard/sections", () => ({
  loadCampaignSection: mockLoadCampaignSection,
  loadCreditSection: mockLoadCreditSection,
}));

vi.mock("@/lib/changelog/get-changelog", () => ({
  getLatestAnnouncement: mockGetLatestAnnouncement,
}));

vi.mock("@/lib/store-readiness", () => ({
  getStoreReadiness: vi.fn().mockResolvedValue({ ready: true, missing: [] }),
}));

vi.mock("@/components/readiness/readiness-check-banner", () => ({
  ReadinessCheckBanner: () => null,
}));

vi.mock("@/components/verification/verification-banners", () => ({
  VerificationBanners: () => null,
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
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

const ITEMS = [
  {
    id: "c1",
    productName: "Tênis Runner Pro",
    createdAt: "2026-07-02T10:00:00Z",
    thumbnailUrl: null,
  },
];

const ENTRY = {
  frontmatter: {
    id: "entry-1",
    title: "Melhorias de outubro",
    date: "2026-10-19",
    category: "improvement" as const,
    importance: "minor" as const,
    announcement: "card" as const,
  },
  body: "Lançamos um painel operacional mais claro e direto.",
  slug: "melhorias-de-outubro",
};

async function renderPage(): Promise<string> {
  const { default: DashboardPage } = await import(
    "@/app/(app)/dashboard/page"
  );
  return renderToString(await DashboardPage());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePageUser.mockResolvedValue({
    userId: "user-123",
    claims: { sub: "user-123" },
  });
  mockGetCurrentStore.mockResolvedValue({
    id: "store-1",
    name: "Loja Teste",
    verification_status: "unverified",
  });
  mockGetUiRenderContext.mockResolvedValue({
    ok: true,
    locale: "pt-BR",
    preference: { uiLocale: "pt-BR", source: "explicit", version: 1 },
  });
  mockGetStoreMarketSettings.mockResolvedValue({
    timeZone: "America/Sao_Paulo",
  });
  mockLoadCampaignSection.mockResolvedValue({
    ok: true,
    data: { count: 1, items: ITEMS },
  });
  mockLoadCreditSection.mockResolvedValue({
    ok: true,
    data: { state: "available", availableBalance: 7 },
  });
  mockGetLatestAnnouncement.mockResolvedValue(ENTRY);
});

describe("DashboardPage — ordem responsive e placements", () => {
  it("preserva a ordem mobile créditos → campanhas → novidades por order classes", async () => {
    const html = await renderPage();

    expect(html).toContain("order-1");
    expect(html).toContain("order-2");
    expect(html).toContain("order-3");
    expect(html.indexOf("credits-title")).toBeGreaterThan(-1);
    expect(html.indexOf("campaigns-title")).toBeGreaterThan(-1);
    expect(html.indexOf('aria-label="Novidades"')).toBeGreaterThan(-1);
  });

  it("usa placements explícitos do desktop", async () => {
    const html = await renderPage();

    expect(html).toContain("lg:col-start-3");
    expect(html).toContain("lg:row-start-1");
    expect(html).toContain("lg:col-span-2");
    expect(html).toContain("lg:col-start-1");
    expect(html).toContain("lg:flex");
    expect(html).toContain("lg:flex-col");
    expect(html).toContain("lg:gap-6");
    expect(html).toContain("lg:grid-cols-3");
  });

  it("usa order apenas para preservar a ordem mobile do wrapper", async () => {
    const html = await renderPage();

    expect(html).toContain("order-1");
    expect(html).toContain("order-2");
    expect(html).toContain("order-3");
    expect(html).not.toContain('style="order');
  });

  it("não expõe métricas técnicas nem recomendação", async () => {
    const html = await renderPage();

    expect(html).not.toContain("Taxa de Sucesso");
    expect(html).not.toContain("Total de Campanhas");
    expect(html).not.toContain("Campanhas Prontas");
    expect(html).not.toContain("Próximo passo");
    expect(html).not.toContain("Recomenda");
  });

  it("mantém todos os links com alvo de 44 px ou cartão e foco visível", async () => {
    const html = await renderPage();
    const anchors = html.match(/<a [^>]*>/g) ?? [];

    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(
        anchor.includes("min-h-[44px]") ||
          anchor.includes("group block") ||
          anchor.includes("group flex"),
      ).toBe(true);
      expect(anchor).toContain("focus-visible:ring-2");
    }
  });
});
