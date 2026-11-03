// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

const mockRequirePageUser = vi.fn();
const mockGetAllEntries = vi.fn();
const mockGetLatestAnnouncement = vi.fn();
const mockGetUiRenderContext = vi.fn();

const { mockClientProps } = vi.hoisted(() => ({
  mockClientProps: { value: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/changelog/get-changelog", () => ({
  getAllEntries: mockGetAllEntries,
  getLatestAnnouncement: mockGetLatestAnnouncement,
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: mockGetUiRenderContext,
}));

vi.mock("@/app/(app)/novidades/novidades-client", () => ({
  NovidadesClient: (props: Record<string, unknown>) => {
    mockClientProps.value = props;
    return null;
  },
}));

const entries = [
  {
    frontmatter: {
      id: "entry-feature",
      title: "Título editorial em português",
      date: "2026-07-31",
      milestone: "v1.5",
      category: "feature",
      importance: "major",
      announcement: "card",
    },
    body: "## O que mudou\n\nCorpo editorial preservado.",
    slug: "2026-07-31-entry-feature",
  },
  {
    frontmatter: {
      id: "entry-improvement",
      title: "Melhoria editorial",
      date: "2026-07-30",
      category: "improvement",
      importance: "minor",
      announcement: "none",
    },
    body: "## O que mudou\n\nOutro corpo editorial.",
    slug: "2026-07-30-entry-improvement",
  },
];

const ptUi = {
  ok: true,
  locale: "pt-BR",
  preference: { uiLocale: "pt-BR", source: "explicit", version: 1 },
};

const esUi = {
  ok: true,
  locale: "es-419",
  preference: { uiLocale: "es-419", source: "explicit", version: 2 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockClientProps.value = null;
  mockRequirePageUser.mockResolvedValue({
    userId: "user-123",
    claims: { sub: "user-123" },
  });
  mockGetAllEntries.mockResolvedValue(entries);
  mockGetLatestAnnouncement.mockResolvedValue(entries[0]);
  mockGetUiRenderContext.mockResolvedValue(ptUi);
});

async function renderPage() {
  const { default: NovidadesPage } = await import(
    "@/app/(app)/novidades/page"
  );
  return renderToString(await NovidadesPage());
}

describe("NovidadesPage", () => {
  it("renderiza pt-BR com textos atuais e preserva editorial", async () => {
    const html = await renderPage();

    expect(mockRequirePageUser).toHaveBeenCalled();
    expect(mockGetAllEntries).toHaveBeenCalled();
    expect(mockGetLatestAnnouncement).toHaveBeenCalled();

    expect(html).toContain("Novidades");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Nova funcionalidade");
    expect(html).toContain("Melhoria");
    expect(html).toContain("Importante");
    expect(html).toContain("31/07/2026");
    expect(html).toContain("Título editorial em português");
    expect(html).toContain("Corpo editorial preservado.");
    expect(html).not.toContain('lang="es-419"');
    expect(mockClientProps.value).toEqual({
      latestEntryId: "entry-feature",
      latestAnnouncementId: "entry-feature",
    });
  });

  it("renderiza es-419 com interface traduzida e editorial em pt-BR", async () => {
    mockGetUiRenderContext.mockResolvedValue(esUi);

    const html = await renderPage();

    expect(html).toContain("Novedades");
    expect(html).toContain("Panel");
    expect(html).toContain("Nueva funcionalidad");
    expect(html).toContain("Mejora");
    expect(html).toContain("Importante");
    expect(html).toContain('lang="es-419"');
    expect(html).toContain('lang="pt-BR"');
    expect(html).toContain('lang=""');
    expect(html).toContain("Título editorial em português");
    expect(html).toContain("Corpo editorial preservado.");
    expect(html).toContain("31/07/2026");
    expect(html).not.toContain("Nova funcionalidade");
  });

  it("renderiza estado vazio em es-419 sem criar ações novas", async () => {
    mockGetUiRenderContext.mockResolvedValue(esUi);
    mockGetAllEntries.mockResolvedValue([]);
    mockGetLatestAnnouncement.mockResolvedValue(null);

    const html = await renderPage();

    expect(html).toContain("Aún no hay novedades");
    expect(html).toContain("Cuando Vendeo lance algo nuevo, lo verás aquí.");
    expect(html).not.toContain("Nueva funcionalidad");
    expect(mockClientProps.value).toEqual({
      latestEntryId: null,
      latestAnnouncementId: undefined,
    });
  });

  it("mantém o estado vazio pt-BR atual", async () => {
    mockGetAllEntries.mockResolvedValue([]);
    mockGetLatestAnnouncement.mockResolvedValue(null);

    const html = await renderPage();

    expect(html).toContain("Nenhuma novidade por enquanto");
    expect(html).toContain("Quando o Vendeo lançar algo novo, você verá aqui.");
    expect(html).not.toContain('lang="es-419"');
  });
});
