// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const okPtBr = {
  ok: true as const,
  locale: "pt-BR" as const,
  preference: { uiLocale: "pt-BR" as const, source: "explicit" as const, version: 1 },
};

const ITEMS = [
  {
    id: "c1",
    productName: "Tênis Runner Pro",
    createdAt: "2026-07-02T10:00:00Z",
    thumbnailUrl: "https://cdn.test/c1.jpg",
  },
  {
    id: "c2",
    productName: "Café Gourmet",
    createdAt: "2026-07-01T10:00:00Z",
    thumbnailUrl: null,
  },
  {
    id: "c3",
    productName: "Sofá 3 Lugares",
    createdAt: "2026-06-30T10:00:00Z",
    thumbnailUrl: "https://cdn.test/c3.jpg",
  },
];

function setupStore() {
  mockGetCurrentStore.mockResolvedValue({
    id: "store-1",
    name: "Loja Teste",
    verification_status: "unverified",
  });
  mockGetUiRenderContext.mockResolvedValue(okPtBr);
  mockGetStoreMarketSettings.mockResolvedValue({
    timeZone: "America/Sao_Paulo",
  });
  mockLoadCampaignSection.mockResolvedValue({
    ok: true,
    data: { count: 3, items: ITEMS },
  });
  mockLoadCreditSection.mockResolvedValue({
    ok: true,
    data: { state: "available", availableBalance: 7 },
  });
  mockGetLatestAnnouncement.mockResolvedValue(null);
}

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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DashboardPage — no_store", () => {
  it("renderiza boas-vindas e CTA /loja sem consultar créditos, campanhas, fuso ou anúncio", async () => {
    mockGetCurrentStore.mockResolvedValue(null);
    mockGetUiRenderContext.mockResolvedValue(okPtBr);

    const html = await renderPage();

    expect(html).toContain("Bem-vindo ao Vendeo");
    expect(html).toContain("Sua loja ainda não está configurada");
    expect(html).toContain('href="/loja"');
    expect(html).toContain("Configurar loja");
    expect(html).not.toContain("credits-title");
    expect(html).not.toContain("campaigns-title");

    expect(mockLoadCampaignSection).not.toHaveBeenCalled();
    expect(mockLoadCreditSection).not.toHaveBeenCalled();
    expect(mockGetStoreMarketSettings).not.toHaveBeenCalled();
    expect(mockGetLatestAnnouncement).not.toHaveBeenCalled();
  });
});

describe("DashboardPage — estados operacionais", () => {
  it("no_eligible_campaigns mostra o EmptyState com CTA /campanhas/nova e sem cartões", async () => {
    setupStore();
    mockLoadCampaignSection.mockResolvedValue({
      ok: true,
      data: { count: 0, items: [] },
    });

    const html = await renderPage();

    expect(html).toContain("Nenhuma campanha disponível");
    expect(html).toContain('href="/campanhas/nova"');
    expect(html).toContain("Criar campanha");
    expect(html).not.toContain("Nova campanha");
    expect(html).not.toContain('href="/campanhas/c');
    expect(html).toContain("0 campanhas disponíveis");
  });

  it("has_eligible_campaigns renderiza até 3 cartões com contagem correta", async () => {
    setupStore();

    const html = await renderPage();

    expect(html).toContain("Campanhas disponíveis");
    expect(html.match(/href="\/campanhas\/c/g)?.length).toBe(3);
    expect(html).toContain("3 campanhas disponíveis");
    expect(html).toContain("Nova campanha");
    expect(html).toContain("Ver todas as campanhas");
  });

  it("respeita o limite de 3 cartões mesmo quando a contagem total é maior", async () => {
    setupStore();
    mockLoadCampaignSection.mockResolvedValue({
      ok: true,
      data: { count: 9, items: ITEMS },
    });

    const html = await renderPage();

    expect(html.match(/href="\/campanhas\/c/g)?.length).toBe(3);
    expect(html).toContain("9 campanhas disponíveis");
  });
});

describe("DashboardPage — falhas parciais", () => {
  it("falha de campanhas exibe painel role=status e mantém créditos", async () => {
    setupStore();
    mockLoadCampaignSection.mockResolvedValue({ ok: false });

    const html = await renderPage();

    expect(html).toContain('role="status"');
    expect(html).toContain("Não foi possível carregar as campanhas");
    expect(html).toContain('href="/campanhas"');
    expect(html).not.toContain("0 campanhas disponíveis");
    expect(html).not.toContain("sr-only");
    expect(html).toContain("Créditos disponíveis");
    expect(html).toContain("Ver detalhes");
  });

  it("falha de créditos exibe saldo indisponível e mantém campanhas", async () => {
    setupStore();
    mockLoadCreditSection.mockResolvedValue({ ok: false });

    const html = await renderPage();

    expect(html).toContain("Saldo indisponível");
    expect(html).toContain('href="/conta"');
    expect(html).toContain("Campanhas disponíveis");
    expect(html).not.toContain("0 créditos");
  });

  it("anúncio sem trecho textual ainda renderiza título, data e ações", async () => {
    setupStore();
    mockGetLatestAnnouncement.mockResolvedValue({
      frontmatter: {
        id: "entry-1",
        title: "Melhorias de outubro",
        date: "2026-10-19",
        category: "improvement",
        importance: "minor",
        announcement: "card",
      },
      body: "## O que mudou",
      slug: "melhorias-de-outubro",
    });

    const html = await renderPage();

    expect(html).toContain("Melhorias de outubro");
    expect(html).toContain("19/10/2026");
    expect(html).toContain('href="/novidades"');
    expect(html).toContain("Ver novidades");
    expect(html).toContain("Fechar anúncio");
  });
});

describe("DashboardPage — créditos", () => {
  it("disponível mostra o valor e a unidade", async () => {
    setupStore();

    const html = await renderPage();

    expect(html).toContain(">7<");
    expect(html).toContain("créditos");
  });

  it("zero renderiza a string completa uma única vez", async () => {
    setupStore();
    mockLoadCreditSection.mockResolvedValue({
      ok: true,
      data: { state: "zero", availableBalance: 0 },
    });

    const html = await renderPage();

    expect(html.split("0 créditos").length - 1).toBe(1);
    expect(html).not.toContain("Saldo indisponível");
  });
});

describe("DashboardPage — sem métricas técnicas ou recomendação", () => {
  it("não contém taxa, totais, campanhas prontas nem próximo passo", async () => {
    setupStore();

    const html = await renderPage();

    expect(html).not.toContain("Taxa de Sucesso");
    expect(html).not.toContain("Total de Campanhas");
    expect(html).not.toContain("Campanhas Prontas");
    expect(html).not.toContain("Próximo passo");
    expect(html).not.toContain("Recomenda");
  });

  it("expõe os destinos operacionais esperados", async () => {
    setupStore();

    const html = await renderPage();

    expect(html).toContain('href="/campanhas"');
    expect(html).toContain('href="/campanhas/c1"');
    expect(html).toContain('href="/conta"');
    expect(html).toContain('href="/loja"');
    expect(html).toContain('href="/campanhas/nova"');
  });
});
