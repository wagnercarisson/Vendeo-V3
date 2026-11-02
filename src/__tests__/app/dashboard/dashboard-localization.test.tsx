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

const okPtBr = {
  ok: true as const,
  locale: "pt-BR" as const,
  preference: { uiLocale: "pt-BR" as const, source: "explicit" as const, version: 1 },
};

const okEs419 = {
  ok: true as const,
  locale: "es-419" as const,
  preference: { uiLocale: "es-419" as const, source: "explicit" as const, version: 2 },
};

const timeoutPtBr = {
  ok: false as const,
  locale: "pt-BR" as const,
  errorCode: "preferences_read_timeout" as const,
};

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

function setupStore(localeContext: typeof okPtBr | typeof okEs419 | typeof timeoutPtBr) {
  mockGetCurrentStore.mockResolvedValue({
    id: "store-1",
    name: "Loja Teste",
    verification_status: "unverified",
  });
  mockGetUiRenderContext.mockResolvedValue(localeContext);
  mockGetStoreMarketSettings.mockResolvedValue({
    timeZone: "America/Sao_Paulo",
  });
  mockLoadCampaignSection.mockResolvedValue({
    ok: true,
    data: { count: 1, items: ITEMS },
  });
  mockLoadCreditSection.mockResolvedValue({ ok: false });
  mockGetLatestAnnouncement.mockResolvedValue(ENTRY);
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

describe("DashboardPage — localização e lang", () => {
  it("renderiza em pt-BR sem região es-419", async () => {
    setupStore(okPtBr);

    const html = await renderPage();

    expect(html).toContain("Campanhas disponíveis");
    expect(html).toContain("Saldo indisponível");
    expect(html).toContain("Ver detalhes");
    expect(html).toContain("Ver novidades");
    expect(html).toContain("Fechar anúncio");
    expect(html).not.toContain('lang="es-419"');
  });

  it("renderiza em es-419 com textos do namespace e região lang", async () => {
    setupStore(okEs419);

    const html = await renderPage();

    expect(html).toContain('<div lang="es-419"');
    expect(html).toContain("Campañas disponibles");
    expect(html).toContain("Saldo no disponible");
    expect(html).toContain("Ver detalles");
    expect(html).toContain("Ver novedades");
    expect(html).toContain('aria-label="Cerrar anuncio"');
    expect(html).toContain("¿Qué tal crear tu próxima campaña?");
    expect(html).toContain("Crear campaña");
    expect(html).toContain(
      "Abre una campaña para ver el contenido completo y descargarlo para publicar.",
    );
    expect(html).not.toContain("Saldo indisponível");
  });

  it("marca o nome da loja e o nome do produto com lang vazio", async () => {
    setupStore(okEs419);

    const html = await renderPage();

    expect(html).toContain(', <span lang="">Loja Teste</span>');
    expect(html).toMatch(/<span lang=""[^>]*>Tênis Runner Pro<\/span>/);
  });

  it("mantém o título e o trecho editorial em pt-BR, sem aplicar aos rótulos/ações", async () => {
    setupStore(okEs419);

    const html = await renderPage();

    expect(html).toContain("Melhorias de outubro");
    expect(html).toContain("Lançamos um painel operacional mais claro e direto.");
    expect(html.match(/lang="pt-BR"/g)?.length).toBe(2);
    expect(html).toContain("Ver novedades");
  });

  it("falha conhecida (timeout) renderiza em pt-BR sem espanhol", async () => {
    setupStore(timeoutPtBr);

    const html = await renderPage();

    expect(html).toContain("Campanhas disponíveis");
    expect(html).toContain("Saldo indisponível");
    expect(html).not.toContain("Campañas disponibles");
    expect(html).not.toContain('lang="es-419"');
  });
});
