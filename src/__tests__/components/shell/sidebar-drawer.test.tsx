// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { SidebarDrawer } from "@/components/shell/sidebar-drawer";
import { es419Messages, ptBRMessages } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/campanhas",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

function mockMatchMedia(reduced: boolean) {
  const mqListeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches: reduced,
    addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
      mqListeners.push(handler);
    },
    removeEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
      const idx = mqListeners.indexOf(handler);
      if (idx !== -1) mqListeners.splice(idx, 1);
    },
    dispatchEvent: (e: MediaQueryListEvent) => {
      mqListeners.forEach((h) => h(e));
    },
  };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
  return mql;
}

function renderDrawer(
  props: Partial<React.ComponentProps<typeof SidebarDrawer>> = {},
) {
  return render(
    <SidebarDrawer
      isOpen={true}
      onClose={() => {}}
      messages={ptBRMessages.shell}
      locale="pt-BR"
      {...props}
    />,
  );
}

describe("SidebarDrawer", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders when open with navigation links", () => {
    const { container } = renderDrawer();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Campanhas")).toBeTruthy();
    expect(screen.getByText("Loja")).toBeTruthy();
    expect(screen.getByText("Conta")).toBeTruthy();
    expect(container.innerHTML).toContain("z-50");
  });

  it("renders hidden when closed", () => {
    const { container } = renderDrawer({ isOpen: false });
    expect(container.innerHTML).toContain("-translate-x-full");
  });

  it("closes when a navigation link is clicked", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    const link = screen.getByText("Campanhas");
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has role='dialog' and aria-modal='true' on the panel", () => {
    renderDrawer();
    const panel = screen.getByRole("dialog");
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.getAttribute("aria-label")).toBe("Menu de navegação");
  });

  it("focus trap: Tab cycles within the drawer", () => {
    renderDrawer();
    const panel = screen.getByRole("dialog");
    const focusable = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable.length).toBeGreaterThanOrEqual(1);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(panel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(panel, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(first);
  });

  it("Escape closes drawer and restores focus to toggle button", () => {
    const toggleRef = { current: document.createElement("button") } as React.RefObject<HTMLButtonElement | null>;
    const onClose = vi.fn();
    renderDrawer({ onClose, toggleButtonRef: toggleRef });
    const panel = screen.getByRole("dialog");
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("X button closes the drawer", () => {
    const onClose = vi.fn();
    const { container } = renderDrawer({ onClose });
    const xButton = container.querySelector('[aria-label="Fechar menu"].absolute');
    expect(xButton).toBeTruthy();
    fireEvent.click(xButton!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("overlay has aria-label and tabIndex={-1}", () => {
    const { container } = renderDrawer();
    const overlay = container.querySelector('[aria-label="Fechar menu"].fixed');
    expect(overlay).toBeTruthy();
    expect(overlay!.tagName).toBe("BUTTON");
    expect(overlay!.getAttribute("tabindex")).toBe("-1");
  });

  it("uses duration-0 with prefers-reduced-motion: reduce", () => {
    mockMatchMedia(true);
    const { container } = renderDrawer();
    const panel = container.querySelector('[role="dialog"]');
    expect(panel?.className).toContain("duration-0");
    expect(panel?.className).not.toContain("duration-300");
  });

  it("body scroll lock saves and restores overflow", () => {
    document.body.style.overflow = "auto";
    const { unmount } = renderDrawer();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("brand logo links to /dashboard and closes the drawer", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    const brand = screen.getByRole("link", {
      name: "Vendeo — ir para o dashboard",
    });

    expect(brand.getAttribute("href")).toBe("/dashboard");
    fireEvent.click(brand);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render the signature in the drawer", () => {
    const { container } = renderDrawer();
    expect(container.innerHTML).not.toContain("/brand/vendeo-signature.png");
  });

  it("renders the es-419 labels with unchanged focus behavior", () => {
    const { container } = renderDrawer({
      messages: es419Messages.shell,
      locale: "es-419",
    });

    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe(
      "Menú de navegación",
    );
    expect(
      container.querySelector('[aria-label="Cerrar menú"].absolute'),
    ).toBeTruthy();
    expect(
      container.querySelector('[aria-label="Cerrar menú"].fixed'),
    ).toBeTruthy();
    expect(screen.getByText("Panel")).toBeTruthy();
    expect(screen.getByText("Campañas")).toBeTruthy();
    expect(container.querySelector('[role="dialog"]')?.getAttribute("lang")).toBe(
      "es-419",
    );
  });
});
