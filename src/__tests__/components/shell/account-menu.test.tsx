// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { AccountMenu } from "@/components/shell/account-menu";
import { es419Messages, ptBRMessages } from "@/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/store-onboarding/draft-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-onboarding/draft-store")>();
  return { ...actual, clearAllDrafts: vi.fn(actual.clearAllDrafts) };
});

function mockMatchMedia(reduced: boolean) {
  const mql = {
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
  return mql;
}

function renderMenu(
  overrides: Partial<React.ComponentProps<typeof AccountMenu>> = {},
) {
  return render(
    <AccountMenu
      user={{ claims: { email: "user@vendeo.tech" } }}
      messages={ptBRMessages.shell}
      {...overrides}
    />,
  );
}

describe("AccountMenu", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows user email", () => {
    renderMenu();
    expect(screen.getByText("user@vendeo.tech")).toBeTruthy();
  });

  it("trigger has aria-label='Menu da conta'", () => {
    renderMenu();
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toBe("Menu da conta");
  });

  it("email span is hidden on mobile via responsive class (hidden sm:inline-block)", () => {
    renderMenu();
    const email = screen.getByText("user@vendeo.tech");
    expect(email.className).toContain("hidden");
    expect(email.className).toContain("sm:inline-block");
  });

  it("shows fallback when email unavailable", () => {
    const { unmount } = renderMenu({ user: { claims: { sub: "abc-123-def" } } });
    expect(screen.getByText("abc-123-")).toBeTruthy();
    unmount();

    renderMenu({
      user: { claims: {} },
      messages: es419Messages.shell,
      locale: "es-419",
      lang: "es-419",
    });
    expect(screen.getByText("Usuario").getAttribute("lang")).toBe("es-419");
  });

  it("shows the approved storefront order: Conta, Novidades, Configurações, Sair", () => {
    renderMenu();
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/conta",
      "/novidades",
      "/configuracoes",
    ]);
    expect(screen.getByText("Conta")).toBeTruthy();
    expect(screen.getByText("Novidades")).toBeTruthy();
    expect(screen.getByText("Configurações")).toBeTruthy();
    expect(screen.getByText("Sair")).toBeTruthy();

    const conta = screen.getByRole("link", { name: /Conta/ });
    expect(conta.getAttribute("href")).toBe("/conta");
    const configuracoes = screen.getByRole("link", { name: /Configurações/ });
    expect(configuracoes.getAttribute("href")).toBe("/configuracoes");
  });

  it("keeps the legacy admin menu: Configurações → /conta, Novidades, Sair", () => {
    const { container } = renderMenu({ isAdmin: true });
    fireEvent.click(screen.getByRole("button"));

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/conta",
      "/novidades",
    ]);
    expect(container.querySelectorAll('a[href="/configuracoes"]').length).toBe(0);
    const configuracoes = screen.getByRole("link", { name: /Configurações/ });
    expect(configuracoes.getAttribute("href")).toBe("/conta");
    expect(screen.getByText("Sair")).toBeTruthy();
  });

  it("trigger has aria-haspopup='true'", () => {
    renderMenu();
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-haspopup")).toBe("true");
  });

  it("aria-expanded toggles between true and false", () => {
    renderMenu();
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("Escape closes the menu", () => {
    renderMenu();
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByText("Configurações")).toBeTruthy();
    const dropdown = screen.getByText("Configurações").closest("div");
    fireEvent.keyDown(dropdown || document, { key: "Escape" });
    expect(screen.queryByText("Configurações")).toBeNull();
  });

  it("prefers-reduced-motion: reduce removes transition from chevron", () => {
    mockMatchMedia(true);
    const { container } = renderMenu();
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    const chevron = container.querySelector(".lucide-chevron-down");
    expect(chevron?.className).not.toContain("duration-200");
  });

  it("renders es-419 labels and scopes lang to translated items only", () => {
    const { container } = renderMenu({
      messages: es419Messages.shell,
      locale: "es-419",
      lang: "es-419",
    });

    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toBe("Menú de la cuenta");
    expect(trigger.getAttribute("lang")).toBe("es-419");

    fireEvent.click(trigger);

    expect(screen.getByText("Cuenta")).toBeTruthy();
    expect(screen.getByText("Novedades")).toBeTruthy();
    expect(screen.getByText("Configuración")).toBeTruthy();
    expect(screen.getByText("Cerrar sesión")).toBeTruthy();

    const linkConta = screen.getByRole("link", { name: /Cuenta/ });
    const linkNovidades = screen.getByRole("link", { name: /Novedades/ });
    const linkConfiguracoes = screen.getByRole("link", { name: /Configuración/ });
    expect(linkConta.getAttribute("lang")).toBe("es-419");
    expect(linkConta.getAttribute("href")).toBe("/conta");
    expect(linkNovidades.getAttribute("lang")).toBe("es-419");
    expect(linkNovidades.getAttribute("href")).toBe("/novidades");
    expect(linkConfiguracoes.getAttribute("lang")).toBe("es-419");
    expect(linkConfiguracoes.getAttribute("href")).toBe("/configuracoes");

    const logoutWrapper = container
      .querySelector('form[action="/auth/signout"]')
      ?.parentElement;
    expect(logoutWrapper?.getAttribute("lang")).toBe("es-419");

    const triggerEmail = screen
      .getAllByText("user@vendeo.tech")
      .find((el) => el.tagName === "SPAN");
    expect(triggerEmail).toBeTruthy();
    expect(triggerEmail?.getAttribute("lang")).not.toBe("es-419");

    const header = screen
      .getAllByText("user@vendeo.tech")
      .find((el) => el.tagName === "DIV");
    expect(header).toBeTruthy();
    expect(header?.getAttribute("lang")).not.toBe("es-419");
  });
});
