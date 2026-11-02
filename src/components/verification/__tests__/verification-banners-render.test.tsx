// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { VerificationBanners } from "../verification-banners";

const ES_MESSAGES = {
  review: "Tus créditos de bienvenida están en verificación de registro.",
  approved: "¡Tus créditos de bienvenida fueron liberados!",
  dismiss: "Cerrar",
};

describe("VerificationBanners render", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders the default pt-BR review message", () => {
    render(<VerificationBanners verificationStatus="review" />);

    expect(
      screen.getByText("Seus créditos de boas-vindas estão em verificação cadastral."),
    ).toBeInTheDocument();
  });

  it("renders the localized es-419 review message", () => {
    render(<VerificationBanners verificationStatus="review" messages={ES_MESSAGES} />);

    expect(screen.getByText(ES_MESSAGES.review)).toBeInTheDocument();
    expect(
      screen.queryByText("Seus créditos de boas-vindas estão em verificação cadastral."),
    ).not.toBeInTheDocument();
  });

  it("renders the default approved message and close label", () => {
    render(<VerificationBanners verificationStatus="approved" />);

    expect(
      screen.getByText("Seus créditos de boas-vindas foram liberados!"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("renders the localized es-419 approved message and close label", () => {
    render(<VerificationBanners verificationStatus="approved" messages={ES_MESSAGES} />);

    expect(screen.getByText(ES_MESSAGES.approved)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });
});
