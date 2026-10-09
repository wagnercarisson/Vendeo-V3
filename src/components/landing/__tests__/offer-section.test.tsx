// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

/**
 * Offer block copy/behavior test, rendered in BOTH flag modes.
 *
 * `OfferSection` is a pure server component that requires the
 * `publicSignupEnabled` prop, so every render passes it explicitly — it is
 * never rendered without that prop here. The main message is verbatim; the
 * credit mechanics live only in the secondary `[data-offer-mechanics]`
 * disclosure and never in the prominent message.
 */

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: ({
    variant,
    fullWidth,
  }: {
    variant?: string;
    fullWidth?: boolean;
  }) => (
    <button
      type="button"
      data-variant={variant}
      data-fullwidth={String(fullWidth)}
    >
      Continuar com Google
    </button>
  ),
}));

import { OfferSection } from "../offer-section";

const MAIN_MESSAGE =
  "Experimente o Vendeo em sua loja: 28 dias gratuitos e até 20 créditos.";

function getMechanics(container: HTMLElement): HTMLElement {
  const element = container.querySelector("[data-offer-mechanics]");
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

describe("OfferSection — flag off", () => {
  it("renderiza a mensagem principal verbatim com a mecânica só na divulgação secundária", () => {
    const { container } = render(<OfferSection publicSignupEnabled={false} />);

    const mainMessage = screen.getByText(MAIN_MESSAGE);
    expect(mainMessage).toBeInTheDocument();

    const mechanics = getMechanics(container);
    expect(mainMessage.contains(mechanics)).toBe(false);
    expect(mainMessage.textContent ?? "").not.toMatch(
      /dias 7, 14 e 21|configuração inicial|máximo/i,
    );

    // Mechanics: plain language, never the internal term "onboarding".
    expect(mechanics.textContent ?? "").toMatch(/dias 7, 14 e 21/);
    expect(mechanics.textContent ?? "").toMatch(/máximo/);
    expect(mechanics.textContent ?? "").toMatch(/configuração inicial/);
    expect(mechanics.textContent ?? "").toMatch(/não inicia o período/);
    expect(mechanics.textContent ?? "").toMatch(/vencem ao final do período/);
    expect(mechanics.textContent ?? "").not.toMatch(/onboarding/i);
  });

  it("não promete uso ilimitado nem 20 campanhas", () => {
    const { container } = render(<OfferSection publicSignupEnabled={false} />);
    expect(container.textContent ?? "").not.toMatch(/ilimitado/i);
    expect(container.textContent ?? "").not.toMatch(/20 campanhas/i);
  });

  it("flag off: CTA 'Solicitar acesso free' → #acesso com texto escuro sobre verde (D-19)", () => {
    render(<OfferSection publicSignupEnabled={false} />);

    const cta = screen.getByRole("link", { name: "Solicitar acesso free" });
    expect(cta).toHaveAttribute("href", "#acesso");
    expect(cta.className).toContain("text-bg-deep");
    expect(cta.className).not.toContain("text-white");
    expect(
      screen.queryByRole("button", { name: "Continuar com Google" }),
    ).not.toBeInTheDocument();
  });
});

describe("OfferSection — flag on", () => {
  it("flag on: CTA Google (solid) + 'Continuar com email' → /signup, sem 'Solicitar acesso free'", () => {
    const { container } = render(<OfferSection publicSignupEnabled={true} />);

    const google = screen.getByRole("button", { name: "Continuar com Google" });
    expect(google).toHaveAttribute("data-variant", "solid");
    expect(google).toHaveAttribute("data-fullwidth", "true");

    expect(
      screen.getByRole("link", { name: "Continuar com email" }),
    ).toHaveAttribute("href", "/signup");
    expect(
      screen.queryByRole("link", { name: "Solicitar acesso free" }),
    ).not.toBeInTheDocument();

    // Mechanics and main message are mode-independent.
    expect(screen.getByText(MAIN_MESSAGE)).toBeInTheDocument();
    expect(getMechanics(container).textContent ?? "").toMatch(/não inicia o período/);
  });
});
