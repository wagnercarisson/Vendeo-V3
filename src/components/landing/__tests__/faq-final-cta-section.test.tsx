// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: () => <button type="button">Continuar com Google</button>,
}));

import { FaqFinalCtaSection } from "../faq-final-cta-section";

describe("FaqFinalCtaSection", () => {
  it("renders the FAQ collapsed by default", () => {
    const { container } = render(
      <FaqFinalCtaSection publicSignupEnabled={false} />,
    );

    const details = Array.from(container.querySelectorAll("details"));
    expect(details.length).toBeGreaterThanOrEqual(4);
    details.forEach((item) => {
      expect(item.hasAttribute("open")).toBe(false);
    });
  });

  it("preserves the approved FAQ questions", () => {
    render(<FaqFinalCtaSection publicSignupEnabled={false} />);

    expect(
      screen.getByText("Para quem o Vendeo foi desenvolvido?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Preciso informar cartão de crédito?"),
    ).toBeInTheDocument();
  });
});
