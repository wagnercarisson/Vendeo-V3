// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Topbar } from "@/components/shell/topbar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { es419Messages, ptBRMessages, formatMessage } from "@/lib/i18n";

beforeEach(() => {
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

function setLocation(pathname: string) {
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      href: `https://beta.vendeo.tech${pathname}`,
      pathname,
      reload,
      assign: vi.fn(),
      replace: vi.fn(),
    },
  });
  return { reload };
}

function renderTopbar(
  overrides: Partial<React.ComponentProps<typeof Topbar>> = {},
) {
  return render(
    <Topbar
      user={{ claims: { email: "test@test.com" } }}
      onToggleMenu={() => {}}
      isDrawerOpen={false}
      messages={ptBRMessages.shell}
      {...overrides}
    />,
  );
}

describe("Topbar", () => {
  it("renders CTA Nova Campanha", () => {
    const { container } = renderTopbar();
    expect(screen.getByText("Nova Campanha")).toBeTruthy();
    expect(container.innerHTML).toContain('href="/campanhas/nova"');
  });

  it("renders Vendeo branding", () => {
    renderTopbar();
    expect(screen.getByText("Vendeo")).toBeTruthy();
  });

  it("hamburger has min-h-[44px] and min-w-[44px]", () => {
    renderTopbar();
    const hamburger = screen.getByLabelText("Abrir menu de navegação");
    expect(hamburger.className).toContain("min-h-[44px]");
    expect(hamburger.className).toContain("min-w-[44px]");
  });

  it("hamburger has shrink-0 so it never gets squashed on mobile", () => {
    renderTopbar();
    const hamburger = screen.getByLabelText("Abrir menu de navegação");
    expect(hamburger.className).toContain("shrink-0");
  });

  it("CTA Nova Campanha has min-h-[44px]", () => {
    renderTopbar();
    const cta = screen.getByText("Nova Campanha").closest("a");
    expect(cta?.className).toContain("min-h-[44px]");
  });

  it("CTA Nova Campanha is compact on mobile (aria-label + hidden sm:inline text)", () => {
    renderTopbar();
    const cta = screen.getByText("Nova Campanha").closest("a");
    expect(cta?.getAttribute("aria-label")).toBe("Criar nova campanha");
    expect(cta?.className).toContain("min-w-[44px]");
    expect(cta?.className).toContain("justify-center");
    const text = screen.getByText("Nova Campanha");
    expect(text.className).toContain("hidden");
    expect(text.className).toContain("sm:inline");
  });

  it("right container (CTA + account) has shrink-0", () => {
    renderTopbar();
    const cta = screen.getByText("Nova Campanha").closest("a");
    const container = cta?.parentElement;
    expect(container?.className).toContain("shrink-0");
  });

  it("account menu trigger has min-h-[44px]", () => {
    renderTopbar();
    const trigger = screen.getByText("test@test.com").closest("button");
    expect(trigger?.className).toContain("min-h-[44px]");
  });

  it("CTA em /campanhas/nova previne default e faz reload", () => {
    const { reload } = setLocation("/campanhas/nova");
    const preventDefaultSpy = vi.spyOn(Event.prototype, "preventDefault");
    renderTopbar();
    const cta = screen.getByText("Nova Campanha").closest("a");
    expect(cta).not.toBeNull();
    fireEvent.click(cta!);
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    preventDefaultSpy.mockRestore();
  });

  it("CTA em outra rota nao previne default (SPA preservado)", () => {
    const { reload } = setLocation("/dashboard");
    const preventDefaultSpy = vi.spyOn(Event.prototype, "preventDefault");
    renderTopbar();
    const cta = screen.getByText("Nova Campanha").closest("a");
    expect(cta).not.toBeNull();
    fireEvent.click(cta!);
    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    preventDefaultSpy.mockRestore();
  });

  it("renders the intermediate-band symbol as a /dashboard link", () => {
    renderTopbar();
    const brand = screen.getByLabelText("Vendeo — ir para o dashboard");
    const image = brand.querySelector("img");

    expect(brand.getAttribute("href")).toBe("/dashboard");
    expect(brand.className).toContain("hidden");
    expect(brand.className).toContain("sm:inline-flex");
    expect(brand.className).toContain("md:hidden");
    expect(brand.className).toContain("min-h-[44px]");
    expect(brand.className).toContain("min-w-[44px]");
    expect(image?.getAttribute("src")).toBe("/icons/icon-512x512.png");
    expect(image?.className).toContain("h-9");
    expect(image?.className).toContain("w-9");
  });

  it("keeps the symbol only in the 640-767px band", () => {
    renderTopbar();
    const brand = screen.getByLabelText("Vendeo — ir para o dashboard");

    // <640: hidden; 640-767: sm:inline-flex; >=768: md:hidden.
    expect(brand.className).toContain("hidden");
    expect(brand.className).toContain("sm:inline-flex");
    expect(brand.className).toContain("md:hidden");
  });

  it("sits between the hamburger and the store name", () => {
    const storeName = "Mercado Central da Vila Nova Esperança";
    renderTopbar({ storeName });
    const hamburger = screen.getByLabelText("Abrir menu de navegação");
    const brand = screen.getByLabelText("Vendeo — ir para o dashboard");
    const name = screen.getByText(storeName);

    expect(hamburger.nextElementSibling).toBe(brand);
    expect(brand.nextElementSibling).toBe(name);
    expect(name.className).toContain("truncate");
  });

  it("preserves notifications", () => {
    renderTopbar();

    expect(screen.getByRole("link", { name: /Notifica/ })).toBeTruthy();
  });

  it("renders es-419 labels with unchanged hrefs and untranslated store name", () => {
    renderTopbar({
      messages: es419Messages.shell,
      locale: "es-419",
      lang: "es-419",
      storeName: "Padaria da Esquina",
    });

    expect(screen.getByText("Nueva campaña")).toBeTruthy();
    const cta = screen.getByText("Nueva campaña").closest("a");
    expect(cta?.getAttribute("aria-label")).toBe("Crear nueva campaña");
    expect(cta?.getAttribute("href")).toBe("/campanhas/nova");
    expect(cta?.getAttribute("lang")).toBe("es-419");

    const hamburger = screen.getByLabelText("Abrir menú de navegación");
    expect(hamburger.getAttribute("lang")).toBe("es-419");
    expect(hamburger.className).toContain("min-h-[44px]");
    expect(hamburger.className).toContain("min-w-[44px]");

    expect(screen.getByText("Padaria da Esquina")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Menú de la cuenta" })).toBeTruthy();
  });
});

describe("NotificationBell", () => {
  it("uses messages.label when there is no unread count", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 0 }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell messages={ptBRMessages.shell.notifications} />);

    const link = screen.getByRole("link", { name: "Notificações" });
    expect(link.getAttribute("href")).toBe("/conta#notificacoes");
    expect(link.className).toContain("min-h-[44px]");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/read");

    vi.unstubAllGlobals();
  });

  it("interpolates the unread count and keeps the 9+ cap", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 3 }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationBell messages={ptBRMessages.shell.notifications} />);

    expect(
      await screen.findByRole("link", {
        name: formatMessage(ptBRMessages.shell.notifications.unread, { count: 3 }),
      }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("renders es-419 labels", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 0 }) }),
    );

    render(
      <NotificationBell
        messages={es419Messages.shell.notifications}
        lang="es-419"
      />,
    );

    const link = screen.getByRole("link", { name: "Notificaciones" });
    expect(link.getAttribute("lang")).toBe("es-419");

    vi.unstubAllGlobals();
  });
});
