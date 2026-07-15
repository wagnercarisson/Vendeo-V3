// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Topbar } from "@/components/shell/topbar";

beforeEach(() => {
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

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
});
