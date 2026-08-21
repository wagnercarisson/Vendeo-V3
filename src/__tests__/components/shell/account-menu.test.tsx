// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { AccountMenu } from "@/components/shell/account-menu";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

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

describe("AccountMenu", () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows user email", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    expect(screen.getByText("user@vendeo.tech")).toBeTruthy();
  });

  it("trigger has aria-label='Menu da conta'", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toBe("Menu da conta");
  });

  it("email span is hidden on mobile via responsive class (hidden sm:inline-block)", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    const email = screen.getByText("user@vendeo.tech");
    expect(email.className).toContain("hidden");
    expect(email.className).toContain("sm:inline-block");
  });

  it("shows fallback when email unavailable", () => {
    render(<AccountMenu user={{ claims: { sub: "abc-123-def" } }} />);
    expect(screen.getByText("abc-123-")).toBeTruthy();
  });

  it("shows Configurações and Sair when dropdown is open", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByText("Configurações")).toBeTruthy();
    expect(screen.getByText("Sair")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Configurações/ });
    expect(link.getAttribute("href")).toBe("/conta");
  });

  it("trigger has aria-haspopup='true'", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-haspopup")).toBe("true");
  });

  it("aria-expanded toggles between true and false", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("Escape closes the menu", () => {
    render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByText("Configurações")).toBeTruthy();
    const dropdown = screen.getByText("Configurações").closest("div");
    fireEvent.keyDown(dropdown || document, { key: "Escape" });
    expect(screen.queryByText("Configurações")).toBeNull();
  });

  it("prefers-reduced-motion: reduce removes transition from chevron", () => {
    mockMatchMedia(true);
    const { container } = render(<AccountMenu user={{ claims: { email: "user@vendeo.tech" } }} />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    const chevron = container.querySelector(".lucide-chevron-down");
    expect(chevron?.className).not.toContain("duration-200");
  });
});
