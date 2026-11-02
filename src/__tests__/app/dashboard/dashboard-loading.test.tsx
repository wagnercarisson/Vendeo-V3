// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

const mockRequirePageUser = vi
  .fn()
  .mockResolvedValue({ userId: "user-1", claims: { sub: "user-1" } });
const mockGetUiRenderContext = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/i18n/server", () => ({
  getUiRenderContext: mockGetUiRenderContext,
}));

async function renderLoading(): Promise<string> {
  const { default: DashboardLoading } = await import(
    "@/app/(app)/dashboard/loading"
  );
  return renderToString(await DashboardLoading());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePageUser.mockResolvedValue({
    userId: "user-1",
    claims: { sub: "user-1" },
  });
});

describe("DashboardLoading", () => {
  it("em pt-BR anuncia o status localizado sem lang es-419", async () => {
    mockGetUiRenderContext.mockResolvedValue({
      ok: true,
      locale: "pt-BR",
      preference: { uiLocale: "pt-BR", source: "explicit", version: 1 },
    });

    const html = await renderLoading();

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Carregando dashboard"');
    expect(html).not.toContain('lang="es-419"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("em es-419 anuncia o status em espanhol e declara lang na raiz", async () => {
    mockGetUiRenderContext.mockResolvedValue({
      ok: true,
      locale: "es-419",
      preference: { uiLocale: "es-419", source: "explicit", version: 2 },
    });

    const html = await renderLoading();

    expect(html).toContain('lang="es-419"');
    expect(html).toContain('aria-label="Cargando el panel"');
  });

  it("respeita a ordem final header → créditos → campanhas → novidades", async () => {
    mockGetUiRenderContext.mockResolvedValue({
      ok: true,
      locale: "pt-BR",
      preference: { uiLocale: "pt-BR", source: "explicit", version: 1 },
    });

    const html = await renderLoading();

    const header = html.indexOf("h-8 w-56");
    const credits = html.indexOf("h-32");
    const campaigns = html.indexOf("h-6 w-48");
    const news = html.indexOf("h-40");

    expect(header).toBeGreaterThan(-1);
    expect(credits).toBeGreaterThan(header);
    expect(campaigns).toBeGreaterThan(credits);
    expect(news).toBeGreaterThan(campaigns);
  });

  it("mostra três CardSkeleton na área de campanhas e nenhum StatsSkeleton", async () => {
    mockGetUiRenderContext.mockResolvedValue({
      ok: true,
      locale: "pt-BR",
      preference: { uiLocale: "pt-BR", source: "explicit", version: 1 },
    });

    const html = await renderLoading();

    expect(html.match(/aspect-square/g)?.length).toBe(3);
    expect(html).not.toContain("96px");
    expect(html).not.toContain("lg:grid-cols-4");
  });

  it("usa as mesmas classes de grid e placements do desktop", async () => {
    mockGetUiRenderContext.mockResolvedValue({
      ok: true,
      locale: "pt-BR",
      preference: { uiLocale: "pt-BR", source: "explicit", version: 1 },
    });

    const html = await renderLoading();

    expect(html).toContain("grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8");
    expect(html).toContain("lg:col-start-3");
    expect(html).toContain("lg:row-start-1");
    expect(html).toContain("lg:row-start-2");
    expect(html).toContain("lg:col-span-2");
    expect(html).toContain("lg:col-start-1");
  });
});
