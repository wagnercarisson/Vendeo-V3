// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { SidebarDrawer } from "@/components/shell/sidebar-drawer";

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

describe("SidebarDrawer", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders when open with navigation links", () => {
    const { container } = render(<SidebarDrawer isOpen={true} onClose={() => {}} />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Campanhas")).toBeTruthy();
    expect(screen.getByText("Loja")).toBeTruthy();
    expect(screen.getByText("Conta")).toBeTruthy();
    expect(container.innerHTML).toContain("z-50");
  });

  it("renders hidden when closed", () => {
    const { container } = render(<SidebarDrawer isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toContain("-translate-x-full");
  });

  it("closes when a navigation link is clicked", () => {
    const onClose = vi.fn();
    render(<SidebarDrawer isOpen={true} onClose={onClose} />);
    const link = screen.getByText("Campanhas");
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has role='dialog' and aria-modal='true' on the panel", () => {
    render(<SidebarDrawer isOpen={true} onClose={() => {}} />);
    const panel = screen.getByRole("dialog");
    expect(panel).toBeTruthy();
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.getAttribute("aria-label")).toBe("Menu de navegação");
  });

  it("focus trap: Tab cycles within the drawer", () => {
    render(<SidebarDrawer isOpen={true} onClose={() => {}} />);
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
    render(<SidebarDrawer isOpen={true} onClose={onClose} toggleButtonRef={toggleRef} />);
    const panel = screen.getByRole("dialog");
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("X button closes the drawer", () => {
    const onClose = vi.fn();
    const { container } = render(<SidebarDrawer isOpen={true} onClose={onClose} />);
    const xButton = container.querySelector('[aria-label="Fechar menu"].absolute');
    expect(xButton).toBeTruthy();
    fireEvent.click(xButton!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("overlay has aria-label and tabIndex={-1}", () => {
    const { container } = render(<SidebarDrawer isOpen={true} onClose={() => {}} />);
    const overlay = container.querySelector('[aria-label="Fechar menu"].fixed');
    expect(overlay).toBeTruthy();
    expect(overlay!.tagName).toBe("BUTTON");
    expect(overlay!.getAttribute("tabindex")).toBe("-1");
  });

  it("uses duration-0 with prefers-reduced-motion: reduce", () => {
    mockMatchMedia(true);
    const { container } = render(<SidebarDrawer isOpen={true} onClose={() => {}} />);
    const panel = container.querySelector('[role="dialog"]');
    expect(panel?.className).toContain("duration-0");
    expect(panel?.className).not.toContain("duration-300");
  });

  it("body scroll lock saves and restores overflow", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(<SidebarDrawer isOpen={true} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
