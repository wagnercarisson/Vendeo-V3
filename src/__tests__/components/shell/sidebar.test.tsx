// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { Sidebar } from "@/components/shell/sidebar";
import { es419Messages, ptBRMessages } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/campanhas"),
}));

vi.mock("@/hooks/use-changelog-state", () => ({
  useChangelogState: () => ({
    lastSeenId: null,
    dismissedId: null,
    markChangelogAsViewed: vi.fn(),
    dismissAnnouncement: vi.fn(),
    hasUnseen: () => true,
    isAnnouncementVisible: () => true,
  }),
}));

describe("Sidebar", () => {
  it("renders the five pt-BR navigation links", () => {
    const html = renderToString(
      <Sidebar messages={ptBRMessages.shell} locale="pt-BR" />,
    );
    expect(html).toContain("Dashboard");
    expect(html).toContain("Campanhas");
    expect(html).toContain("Loja");
    expect(html).toContain("Conta");
    expect(html).toContain("Novidades");
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/campanhas"');
    expect(html).toContain('href="/loja"');
    expect(html).toContain('href="/conta"');
    expect(html).toContain('href="/novidades"');
  });

  it("renders the five es-419 navigation links with unchanged hrefs", () => {
    const html = renderToString(
      <Sidebar messages={es419Messages.shell} locale="es-419" />,
    );
    expect(html).toContain("Panel");
    expect(html).toContain("Campañas");
    expect(html).toContain("Tienda");
    expect(html).toContain("Cuenta");
    expect(html).toContain("Novedades");
    expect(html).toContain('aria-label="Navegación principal"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/campanhas"');
    expect(html).toContain('href="/loja"');
    expect(html).toContain('href="/conta"');
    expect(html).toContain('href="/novidades"');
  });

  it("declares lang=es-419 on the nav only for es-419", () => {
    const esHtml = renderToString(
      <Sidebar messages={es419Messages.shell} locale="es-419" />,
    );
    expect(esHtml).toContain('lang="es-419"');

    const ptHtml = renderToString(
      <Sidebar messages={ptBRMessages.shell} locale="pt-BR" />,
    );
    expect(ptHtml).not.toContain('lang="es-419"');
  });

  it("never renders a /configuracoes link", () => {
    const html = renderToString(
      <Sidebar messages={ptBRMessages.shell} locale="pt-BR" />,
    );
    expect(html).not.toContain('href="/configuracoes"');
  });

  it("highlights active route with accent class", () => {
    const html = renderToString(
      <Sidebar messages={ptBRMessages.shell} locale="pt-BR" />,
    );
    expect(html).toContain("bg-accent-green/10");
    const campanhasIndex = html.indexOf("Campanhas");
    const activeClassIndex = html.lastIndexOf("bg-accent-green/10", campanhasIndex);
    expect(activeClassIndex).not.toBe(-1);
  });

  it("renders the localized badge labels in pt-BR", () => {
    const html = renderToString(
      <Sidebar
        messages={ptBRMessages.shell}
        locale="pt-BR"
        latestEntryId="fase-34-store-readiness"
      />,
    );
    expect(html).toContain('aria-label="Novidades disponíveis"');
    expect(html).toContain('title="Ver novidades"');
  });

  it("renders the localized badge labels in es-419", () => {
    const html = renderToString(
      <Sidebar
        messages={es419Messages.shell}
        locale="es-419"
        latestEntryId="fase-34-store-readiness"
      />,
    );
    expect(html).toContain('aria-label="Novedades disponibles"');
    expect(html).toContain('title="Ver novedades"');
  });
});
