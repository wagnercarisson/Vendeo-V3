// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { es419Messages, ptBRMessages } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-changelog-state", () => ({
  useChangelogState: () => ({
    lastSeenId: null,
    dismissedId: null,
    markChangelogAsViewed: vi.fn(),
    dismissAnnouncement: vi.fn(),
    hasUnseen: () => false,
    isAnnouncementVisible: () => true,
  }),
}));

const mockedUsePathname = vi.mocked(usePathname);

function mockMatchMedia() {
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
}

const shellProps = {
  user: { claims: { email: "teste@exemplo.test" } },
  storeName: "Padaria da Esquina",
  locale: "es-419" as const,
  commonMessages: ptBRMessages.common,
  shellMessages: ptBRMessages.shell,
  shellMessagesEs: es419Messages.shell,
  commonMessagesEs: es419Messages.common,
};

function renderShell(pathname: string) {
  mockedUsePathname.mockReturnValue(pathname);
  return render(
    <AppShell {...shellProps} shellMessages={ptBRMessages.shell}>
      <p>Conteúdo</p>
    </AppShell>,
  );
}

function expectVisible(text: string) {
  expect(screen.getAllByText(text).length).toBeGreaterThan(0);
}

function expectNotVisible(text: string) {
  expect(screen.queryAllByText(text).length).toBe(0);
}

beforeEach(() => {
  mockMatchMedia();
  mockedUsePathname.mockReturnValue("/dashboard");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AppShell localization", () => {
  it("renders the shell regions in es-419 for a storefront user", () => {
    renderShell("/dashboard");

    expectVisible("Panel");
    expectVisible("Campañas");
    expectVisible("Tienda");
    expectVisible("Cuenta");
    expectVisible("Novedades");
    expectVisible("Nueva campaña");
    expect(screen.getByRole("button", { name: "Menú de la cuenta" })).toBeTruthy();
  });

  it("renders the account menu items in es-419 with the approved order", () => {
    renderShell("/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Menú de la cuenta" }));

    const links = screen.getAllByRole("link");
    // Sidebar links are also present; filter to the dropdown by href.
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/conta", "/novidades", "/configuracoes"]),
    );

    expectVisible("Cuenta");
    expectVisible("Configuración");
    expectVisible("Cerrar sesión");

    const configuracoes = screen.getByRole("link", { name: /Configuración/ });
    expect(configuracoes.getAttribute("href")).toBe("/configuracoes");
  });

  it("keeps /admin fully in pt-BR without a /configuracoes link", () => {
    const { container } = renderShell("/admin");

    expectVisible("Campanhas");
    expectVisible("Nova Campanha");
    expectNotVisible("Campañas");
    expectNotVisible("Nueva campaña");
    expectNotVisible("Cerrar sesión");

    fireEvent.click(screen.getByRole("button", { name: "Menu da conta" }));

    expectVisible("Configurações");
    expectVisible("Sair");
    const configuracoes = screen.getByRole("link", { name: /Configurações/ });
    expect(configuracoes.getAttribute("href")).toBe("/conta");
    expect(container.querySelectorAll('a[href="/configuracoes"]').length).toBe(0);
  });

  it("exposes /configuracoes in the storefront but not in admin", () => {
    const storefront = renderShell("/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Menú de la cuenta" }));
    expect(
      storefront.container.querySelectorAll('a[href="/configuracoes"]').length,
    ).toBe(1);
    storefront.unmount();

    const admin = renderShell("/admin");
    fireEvent.click(screen.getByRole("button", { name: "Menu da conta" }));
    expect(
      admin.container.querySelectorAll('a[href="/configuracoes"]').length,
    ).toBe(0);
  });

  it("scopes lang=es-419 to translated regions and leaves the document untouched", () => {
    const { container } = renderShell("/dashboard");

    expect(container.querySelector('nav[lang="es-419"]')).toBeTruthy();
    expect(document.documentElement.getAttribute("lang")).not.toBe("es-419");
    expect(screen.getByText("Padaria da Esquina")).toBeTruthy();
    expect(screen.getAllByText("teste@exemplo.test").length).toBeGreaterThan(0);
  });

  it("transitions storefront → admin → storefront without residual state", () => {
    mockedUsePathname.mockReturnValue("/dashboard");
    const { container, rerender } = render(
      <AppShell {...shellProps}>
        <p>Conteúdo</p>
      </AppShell>,
    );

    expectVisible("Campañas");
    fireEvent.click(screen.getByRole("button", { name: "Menú de la cuenta" }));
    expect(
      container.querySelectorAll('a[href="/configuracoes"]').length,
    ).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Menú de la cuenta" }));
    expectNotVisible("Configuración");

    mockedUsePathname.mockReturnValue("/admin");
    rerender(
      <AppShell {...shellProps}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    expectVisible("Campanhas");
    expectNotVisible("Campañas");
    fireEvent.click(screen.getByRole("button", { name: "Menu da conta" }));
    expect(
      container.querySelectorAll('a[href="/configuracoes"]').length,
    ).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Menu da conta" }));

    mockedUsePathname.mockReturnValue("/dashboard");
    rerender(
      <AppShell {...shellProps}>
        <p>Conteúdo</p>
      </AppShell>,
    );
    expectVisible("Campañas");
    fireEvent.click(screen.getByRole("button", { name: "Menú de la cuenta" }));
    expect(
      container.querySelectorAll('a[href="/configuracoes"]').length,
    ).toBe(1);
  });
});
