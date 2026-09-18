// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendedBadge } from "@/components/ui/recommended-badge";
import { RECOMMENDED_LABEL } from "@/lib/store-onboarding/field-guidance";

describe("RecommendedBadge", () => {
  it("renders the visible text from the single-source RECOMMENDED_LABEL", () => {
    render(<RecommendedBadge />);
    const badge = screen.getByText(RECOMMENDED_LABEL);
    expect(badge).toBeInTheDocument();
    expect(badge).toBeVisible();
  });

  it("communicates the state by text, not by color only", () => {
    render(<RecommendedBadge />);
    // The accessible name is the canonical label — not a color token.
    expect(screen.getByText(RECOMMENDED_LABEL).textContent).toBe(RECOMMENDED_LABEL);
  });
});
