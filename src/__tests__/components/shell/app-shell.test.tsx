// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { es419Messages, ptBRMessages } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

const mockedUsePathname = vi.mocked(usePathname);

beforeEach(() => {
  mockedUsePathname.mockReturnValue("/dashboard");
});

function renderShell(
  children: React.ReactNode,
  overrides: Partial<React.ComponentProps<typeof AppShell>> = {},
) {
  return renderToString(
    <AppShell
      user={{ claims: { email: "test@test.com" } }}
      locale="pt-BR"
      commonMessages={ptBRMessages.common}
      shellMessages={ptBRMessages.shell}
      {...overrides}
    >
      {children}
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("renders sidebar, topbar and children", () => {
    const html = renderShell(<p>Conteúdo</p>);
    expect(html).toContain("Dashboard");
    expect(html).toContain("Campanhas");
    expect(html).toContain("Nova Campanha");
    expect(html).toContain("Vendeo");
    expect(html).toContain("<p>Conteúdo</p>");
  });

  it("tolerates store = null (no store dependency)", () => {
    const html = renderShell(<p>Dashboard</p>, {
      user: { claims: { email: "storeless@test.com" } },
    });
    expect(html).toContain("Dashboard");
    expect(html).toContain("storeless@test.com");
  });

  it("main has responsive padding px-4 py-6 sm:px-6", () => {
    expect(renderShell(<p>Conteúdo</p>)).toContain("px-4 py-6 sm:px-6");
  });

  it("wrapper uses min-h-dvh and not h-screen (document scroll)", () => {
    const html = renderShell(<p>Conteúdo</p>);
    expect(html).toContain("min-h-dvh");
    expect(html).not.toContain("h-screen");
  });

  it("main has no internal scroll (localized: snippet around px-4 py-6 sm:px-6 has no overflow-auto)", () => {
    const html = renderShell(<p>Conteúdo</p>);
    const marker = "px-4 py-6 sm:px-6";
    const markerIndex = html.indexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    const mainSnippet = html.slice(markerIndex - 200, markerIndex + 200);
    expect(mainSnippet).not.toContain("overflow-auto");
  });

  it("layout: sidebar sticky with own scroll, topbar sticky, min-w-0 guards", () => {
    const html = renderShell(<p>Conteúdo</p>);
    expect(html).toContain("sticky top-0");
    expect(html).toContain("h-dvh");
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain("sticky top-0 z-30");
    expect(html).toContain("min-w-0");
    expect(html).toContain("min-h-0 min-w-0");
  });

  it("renders the desktop brand link and keeps the nav non-shrinking", () => {
    const html = renderShell(<p>Conteúdo</p>);
    expect(html).toContain('aria-label="Vendeo — ir para o dashboard"');
    expect(html).toContain('src="/landing/vendeo-logo-dark.webp"');
    expect(html).toContain("flex-col");
    expect(html).toContain("md:flex");
    expect(html).toContain("shrink-0");
  });

  it("renders exactly one signature, only in the desktop sidebar", () => {
    const html = renderShell(<p>Conteúdo</p>);
    const signatureCount = (
      html.match(/<img src="\/brand\/vendeo-signature\.png"/g) ?? []
    ).length;

    expect(signatureCount).toBe(1);
    expect(html).toContain('data-signature-visible="false"');
  });

  it("keeps the mobile symbol in the topbar and the logo in the drawer", () => {
    const html = renderShell(<p>Conteúdo</p>);
    const symbolCount = (
      html.match(/<img src="\/icons\/icon-512x512\.png"/g) ?? []
    ).length;
    const logoCount = (
      html.match(/<img src="\/landing\/vendeo-logo-dark\.webp"/g) ?? []
    ).length;

    expect(symbolCount).toBe(1);
    expect(logoCount).toBe(2);
  });

  it("forces pt-BR on /admin even when the server locale is es-419", () => {
    mockedUsePathname.mockReturnValue("/admin");
    const html = renderShell(<p>Conteúdo</p>, {
      locale: "es-419",
      commonMessagesEs: es419Messages.common,
      shellMessagesEs: es419Messages.shell,
    });
    expect(html).toContain('data-effective-locale="pt-BR"');
  });

  it("keeps es-419 on non-admin routes", () => {
    mockedUsePathname.mockReturnValue("/dashboard");
    const html = renderShell(<p>Conteúdo</p>, {
      locale: "es-419",
      commonMessagesEs: es419Messages.common,
      shellMessagesEs: es419Messages.shell,
    });
    expect(html).toContain('data-effective-locale="es-419"');
  });
});
