// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PUBLIC_ACCESS_COPY, PUBLIC_OFFER_COPY } from "../public-offer-copy";

/**
 * Offer block copy/behavior test, rendered in BOTH flag modes.
 *
 * `OfferSection` is a pure server component that requires the
 * `publicSignupEnabled` prop, so every render passes it explicitly. The texts
 * come from the single public copy source; the credit mechanics live only in
 * the secondary `[data-offer-mechanics]` disclosure.
 */

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: ({
    variant,
    fullWidth,
    label,
  }: {
    variant?: string;
    fullWidth?: boolean;
    label?: string;
  }) => (
    <button
      type="button"
      data-variant={variant}
      data-fullwidth={String(fullWidth)}
    >
      {label ?? "Continuar com Google"}
    </button>
  ),
}));

import { OfferSection } from "../offer-section";

function getMechanics(container: HTMLElement): HTMLElement {
  const element = container.querySelector("[data-offer-mechanics]");
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

describe("OfferSection — flag off", () => {
  it("renderiza a comunicação aprovada com a mecânica só no expansível", () => {
    const { container } = render(<OfferSection publicSignupEnabled={false} />);

    expect(screen.getByText(PUBLIC_OFFER_COPY.heading)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_OFFER_COPY.summary)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_OFFER_COPY.complement)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_ACCESS_COPY.closedSupport)).toBeInTheDocument();

    const mechanics = getMechanics(container);
    expect(mechanics).toHaveTextContent(PUBLIC_OFFER_COPY.detailsLabel);
    expect(mechanics.textContent ?? "").toMatch(/dias 7, 14 e 21/);
    expect(mechanics.textContent ?? "").toMatch(/processamento diário/);
    expect(mechanics.textContent ?? "").toMatch(/máximo/);
    expect(mechanics.textContent ?? "").toMatch(/configuração inicial/);
    expect(mechanics.textContent ?? "").toMatch(/não inicia o período/);
    expect(mechanics.textContent ?? "").toMatch(/vencem ao final do período/);
    expect(mechanics.textContent ?? "").not.toMatch(/raiz de CNPJ/i);
    expect(mechanics.textContent ?? "").not.toMatch(/onboarding/i);

    // The prominent message never carries the mechanics.
    expect(screen.getByText(PUBLIC_OFFER_COPY.summary).textContent ?? "").not.toMatch(
      /dias 7, 14 e 21|processamento diário|máximo/i,
    );
  });

  it("não promete uso ilimitado nem 20 campanhas", () => {
    const { container } = render(<OfferSection publicSignupEnabled={false} />);
    expect(container.textContent ?? "").not.toMatch(/ilimitado/i);
    expect(container.textContent ?? "").not.toMatch(/20 campanhas/i);
  });

  it("CTA 'Solicitar acesso gratuito' → #acesso com texto escuro sobre verde (D-19)", () => {
    render(<OfferSection publicSignupEnabled={false} />);

    const cta = screen.getByRole("link", { name: PUBLIC_ACCESS_COPY.closedCta });
    expect(cta).toHaveAttribute("href", "#acesso");
    expect(cta.className).toContain("text-bg-deep");
    expect(cta.className).not.toContain("text-white");
    expect(
      screen.queryByRole("button", { name: PUBLIC_ACCESS_COPY.google }),
    ).not.toBeInTheDocument();
  });
});

describe("OfferSection — flag on", () => {
  it("preserva Google + e-mail e oculta CTA, apoio e nota fechada", () => {
    const { container } = render(<OfferSection publicSignupEnabled />);

    const google = screen.getByRole("button", { name: PUBLIC_ACCESS_COPY.google });
    expect(google).toHaveAttribute("data-variant", "solid");
    expect(google).toHaveAttribute("data-fullwidth", "true");

    expect(
      screen.getByRole("link", { name: PUBLIC_ACCESS_COPY.email }),
    ).toHaveAttribute("href", "/signup");
    expect(
      screen.queryByRole("link", { name: PUBLIC_ACCESS_COPY.closedCta }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(PUBLIC_ACCESS_COPY.closedSupport),
    ).not.toBeInTheDocument();

    expect(screen.getByText(PUBLIC_OFFER_COPY.summary)).toBeInTheDocument();
    expect(screen.getByText(PUBLIC_OFFER_COPY.complement)).toBeInTheDocument();

    const mechanics = getMechanics(container);
    expect(mechanics.textContent ?? "").not.toMatch(/não inicia o período/);
  });
});
