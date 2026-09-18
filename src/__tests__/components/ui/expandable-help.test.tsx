// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { ExpandableHelp } from "@/components/ui/expandable-help";

describe("ExpandableHelp", () => {
  it("starts collapsed with aria-expanded=false and region present but hidden", () => {
    render(
      <ExpandableHelp summary="Como funciona?">Conteúdo de ajuda</ExpandableHelp>,
    );
    const trigger = screen.getByRole("button", { name: /Como funciona\?/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const region = screen.getByText("Conteúdo de ajuda");
    expect(region).toHaveAttribute("hidden");
    expect(region).not.toBeVisible();
  });

  it("aria-controls references a region that exists in both states", () => {
    render(
      <ExpandableHelp summary="Ajuda" id="ajuda-region">
        Conteúdo
      </ExpandableHelp>,
    );
    const trigger = screen.getByRole("button", { name: /Ajuda/ });
    expect(trigger).toHaveAttribute("aria-controls", "ajuda-region");

    const region = screen.getByText("Conteúdo");
    expect(region).toHaveAttribute("id", "ajuda-region");

    fireEvent.click(trigger);
    // Same element remains in the DOM after expanding.
    expect(screen.getByText("Conteúdo")).toHaveAttribute("id", "ajuda-region");
  });

  it("expands on activation and collapses again on a second activation", () => {
    render(<ExpandableHelp summary="Ajuda">Conteúdo</ExpandableHelp>);
    const trigger = screen.getByRole("button", { name: /Ajuda/ });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Conteúdo")).toBeVisible();
    expect(screen.getByText("Conteúdo")).not.toHaveAttribute("hidden");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Conteúdo")).not.toBeVisible();
    expect(screen.getByText("Conteúdo")).toHaveAttribute("hidden");
  });

  it("is keyboard operable (focusable native button; Enter/Space activation)", () => {
    render(<ExpandableHelp summary="Ajuda teclado">Conteúdo teclado</ExpandableHelp>);
    const trigger = screen.getByRole("button", { name: /Ajuda teclado/ });

    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    // Native <button type="button"> receives Enter/Space activation from the
    // browser; jsdom does not synthesize it, so assert the control is a real
    // focusable button and that its activation (click) toggles the state.
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("type", "button");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("has a >= 44px touch target and visible focus ring on the trigger", () => {
    render(<ExpandableHelp summary="Ajuda">Conteúdo</ExpandableHelp>);
    const trigger = screen.getByRole("button", { name: /Ajuda/ });
    expect(trigger.className).toContain("min-h-[44px]");
    expect(trigger.className).toContain("focus-visible:ring-2");
  });
});
