// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendedBadge } from "@/components/ui/recommended-badge";

describe("RecommendedBadge", () => {
  it("renders the visible text 'Recomendado'", () => {
    render(<RecommendedBadge />);
    const badge = screen.getByText("Recomendado");
    expect(badge).toBeInTheDocument();
    expect(badge).toBeVisible();
  });

  it("communicates the state by text, not by color only", () => {
    render(<RecommendedBadge />);
    // The accessible name is the literal text — not a color token.
    expect(screen.getByText("Recomendado").textContent).toBe("Recomendado");
  });
});
