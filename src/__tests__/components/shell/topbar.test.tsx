// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Topbar } from "@/components/shell/topbar";

beforeEach(() => {
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

function renderTopbar(pathname: string) {
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

describe("Topbar", () => {
  it("renders CTA Nova Campanha", () => {
    const { container } = render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    expect(screen.getByText("Nova Campanha")).toBeTruthy();
    expect(container.innerHTML).toContain('href="/campanhas/nova"');
  });

  it("renders Vendeo branding", () => {
    const { container } = render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    expect(screen.getByText("Vendeo")).toBeTruthy();
  });

  it("hamburger has min-h-[44px] and min-w-[44px]", () => {
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const hamburger = screen.getByLabelText("Abrir menu de navegação");
    expect(hamburger.className).toContain("min-h-[44px]");
    expect(hamburger.className).toContain("min-w-[44px]");
  });

  it("hamburger has shrink-0 so it never gets squashed on mobile", () => {
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const hamburger = screen.getByLabelText("Abrir menu de navegação");
    expect(hamburger.className).toContain("shrink-0");
  });

  it("CTA Nova Campanha has min-h-[44px]", () => {
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const cta = screen.getByText("Nova Campanha").closest("a");
    expect(cta?.className).toContain("min-h-[44px]");
  });

  it("CTA Nova Campanha is compact on mobile (aria-label + hidden sm:inline text)", () => {
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const cta = screen.getByText("Nova Campanha").closest("a");
    expect(cta?.getAttribute("aria-label")).toBe("Criar nova campanha");
    expect(cta?.className).toContain("min-w-[44px]");
    expect(cta?.className).toContain("justify-center");
    const text = screen.getByText("Nova Campanha");
    expect(text.className).toContain("hidden");
    expect(text.className).toContain("sm:inline");
  });

  it("right container (CTA + account) has shrink-0", () => {
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const cta = screen.getByText("Nova Campanha").closest("a");
    const container = cta?.parentElement;
    expect(container?.className).toContain("shrink-0");
  });

  it("account menu trigger has min-h-[44px]", () => {
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const trigger = screen.getByText("test@test.com").closest("button");
    expect(trigger?.className).toContain("min-h-[44px]");
  });

  it("CTA em /campanhas/nova previne default e faz reload", () => {
    const { reload } = renderTopbar("/campanhas/nova");
    const preventDefaultSpy = vi.spyOn(Event.prototype, "preventDefault");
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const cta = screen.getByText("Nova Campanha").closest("a");
    expect(cta).not.toBeNull();
    fireEvent.click(cta!);
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    preventDefaultSpy.mockRestore();
  });

  it("CTA em outra rota nao previne default (SPA preservado)", () => {
    const { reload } = renderTopbar("/dashboard");
    const preventDefaultSpy = vi.spyOn(Event.prototype, "preventDefault");
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const cta = screen.getByText("Nova Campanha").closest("a");
    expect(cta).not.toBeNull();
    fireEvent.click(cta!);
    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    preventDefaultSpy.mockRestore();
  });

  it("renders the intermediate-band symbol as a /dashboard link", () => {
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
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
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const brand = screen.getByLabelText("Vendeo — ir para o dashboard");

    // <640: hidden; 640-767: sm:inline-flex; >=768: md:hidden.
    expect(brand.className).toContain("hidden");
    expect(brand.className).toContain("sm:inline-flex");
    expect(brand.className).toContain("md:hidden");
  });

  it("sits between the hamburger and the store name", () => {
    const storeName = "Mercado Central da Vila Nova Esperança";
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        storeName={storeName}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );
    const hamburger = screen.getByLabelText("Abrir menu de navegação");
    const brand = screen.getByLabelText("Vendeo — ir para o dashboard");
    const name = screen.getByText(storeName);

    expect(hamburger.nextElementSibling).toBe(brand);
    expect(brand.nextElementSibling).toBe(name);
    expect(name.className).toContain("truncate");
  });

  it("preserves notifications", () => {
    render(
      <Topbar
        user={{ claims: { email: "test@test.com" } }}
        onToggleMenu={() => {}}
        isDrawerOpen={false}
      />,
    );

    expect(screen.getByRole("link", { name: /Notifica/ })).toBeTruthy();
  });
});
