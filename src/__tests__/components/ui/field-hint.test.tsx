// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldHint } from "@/components/ui/field-hint";

describe("FieldHint", () => {
  it("applies the provided id to the <p> and renders its content", () => {
    render(<FieldHint id="x-hint">Texto de ajuda</FieldHint>);
    const hint = screen.getByText("Texto de ajuda");
    expect(hint.tagName).toBe("P");
    expect(hint).toHaveAttribute("id", "x-hint");
  });

  it("uses text-text-secondary by default (not text-text-muted)", () => {
    render(<FieldHint id="x-hint">Padrão</FieldHint>);
    const hint = screen.getByText("Padrão");
    expect(hint.className).toContain("text-text-secondary");
    expect(hint.className).not.toContain("text-text-muted");
  });

  it("resolves tone='amber' to text-accent-amber without a competing color class", () => {
    render(
      <FieldHint id="x-hint" tone="amber">
        Orientação neutra
      </FieldHint>,
    );
    const hint = screen.getByText("Orientação neutra");
    expect(hint.className).toContain("text-accent-amber");
    expect(hint.className).not.toContain("text-text-secondary");
  });

  it("merges an extra className without dropping the tone class", () => {
    render(
      <FieldHint id="x-hint" className="mb-2">
        Extra
      </FieldHint>,
    );
    const hint = screen.getByText("Extra");
    expect(hint.className).toContain("mb-2");
    expect(hint.className).toContain("text-text-secondary");
  });
});
