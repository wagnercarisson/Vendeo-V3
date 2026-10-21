// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

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

vi.mock("../access-request-form", () => ({
  AccessRequestForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <form data-testid="access-request-form">
      <button type="button" onClick={onSuccess}>
        Simular envio
      </button>
    </form>
  ),
}));

import { AccessRequestSection } from "../access-request-section";
import { HeroSection } from "../hero-section";
import { TransformationSection } from "../transformation-section";
import { IdentityControlSection } from "../identity-control-section";
import { OfferSection } from "../offer-section";

/**
 * Renders the full set of acquisition-CTA blocks (hero, transformação,
 * identidade, oferta) plus the reduced flag-gated form section, so both flag
 * modes are asserted end to end. The acquisition CTA was removed from the FAQ
 * block (it moved to the end of the transformation and to the identity block).
 */
function renderAcquisitionTree(publicSignupEnabled: boolean) {
  return render(
    <>
      <HeroSection publicSignupEnabled={publicSignupEnabled} />
      <TransformationSection publicSignupEnabled={publicSignupEnabled} />
      <IdentityControlSection publicSignupEnabled={publicSignupEnabled} />
      <OfferSection publicSignupEnabled={publicSignupEnabled} />
      <AccessRequestSection publicSignupEnabled={publicSignupEnabled} />
    </>,
  );
}

describe("Teste 10a - AccessRequestSection flag off", () => {
  it("renderiza o formulário de acesso antecipado no #acesso", () => {
    const { container } = render(<AccessRequestSection publicSignupEnabled={false} />);
    expect(screen.getByTestId("access-request-form")).toBeInTheDocument();
    expect(screen.getByText("Solicite seu acesso free")).toBeInTheDocument();
    expect(container.querySelector("#acesso")).not.toBeNull();
  });

  it("NÃO renderiza CTA de aquisição (Google/email) — isso pertence aos blocos de CTA", () => {
    render(<AccessRequestSection publicSignupEnabled={false} />);
    expect(
      screen.queryByRole("button", { name: "Continuar com Google" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Continuar com email/ }),
    ).not.toBeInTheDocument();
  });

  it("confirmação explica que a resposta chegará por e-mail", () => {
    render(<AccessRequestSection publicSignupEnabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Simular envio" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /receberá um convite por e-mail no endereço informado/i,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/caixa de spam/i);
    expect(screen.queryByTestId("access-request-form")).not.toBeInTheDocument();
  });
});

describe("Teste 10b - AccessRequestSection flag on", () => {
  it("não renderiza o formulário quando a flag está ligada", () => {
    render(<AccessRequestSection publicSignupEnabled={true} />);
    expect(screen.queryByTestId("access-request-form")).not.toBeInTheDocument();
    expect(screen.queryByText("Solicite seu acesso free")).not.toBeInTheDocument();
  });
});

describe("Teste 10c - CTAs de aquisição nos dois modos da flag (hero, transformação, identidade e oferta)", () => {
  it("flag off: hero, transformação, identidade e oferta renderizam 'Solicitar acesso free' → #acesso e o formulário presente", () => {
    const { container } = renderAcquisitionTree(false);

    const ctas = screen.getAllByRole("link", { name: "Solicitar acesso free" });
    expect(ctas).toHaveLength(4);
    ctas.forEach((cta) => expect(cta).toHaveAttribute("href", "#acesso"));

    expect(screen.getByTestId("access-request-form")).toBeInTheDocument();
    expect(container.querySelector("#acesso")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Continuar com Google" }),
    ).not.toBeInTheDocument();
  });

  it("flag on: hero, transformação, identidade e oferta renderizam Google + 'Continuar com email' → /signup e sem formulário", () => {
    renderAcquisitionTree(true);

    const google = screen.getAllByRole("button", { name: "Continuar com Google" });
    expect(google).toHaveLength(4);
    google.forEach((button) => expect(button).toHaveAttribute("data-variant", "solid"));

    const emailLinks = screen.getAllByRole("link", { name: "Continuar com email" });
    expect(emailLinks).toHaveLength(4);
    emailLinks.forEach((link) => expect(link).toHaveAttribute("href", "/signup"));

    expect(screen.queryByTestId("access-request-form")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Solicitar acesso free" }),
    ).not.toBeInTheDocument();
  });

  it("'Entrar' é ação secundária: nunca é o CTA de aquisição nem aponta para /login", () => {
    renderAcquisitionTree(false);

    // Os blocos de aquisição não renderizam a ação secundária "Entrar"…
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
    // …e nenhum CTA de aquisição aponta para /login (ação secundária de login).
    screen
      .getAllByRole("link", { name: "Solicitar acesso free" })
      .forEach((cta) => expect(cta).not.toHaveAttribute("href", "/login"));
  });
});
