// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AcquisitionCta } from "../acquisition-cta";

/**
 * `AcquisitionCta` — prop opcional `accessHref`.
 *
 * Default `#acesso` preserva byte a byte o comportamento da home. Páginas
 * públicas independentes (`/floriculturas`) passam `/#acesso`, porque a âncora
 * só existe na home. Nenhum outro comportamento do componente muda.
 */

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: () => <button type="button">Continuar com Google</button>,
}));

describe("AcquisitionCta — destino do acesso no beta fechado", () => {
  it("mantém o default #acesso quando a prop não é fornecida", () => {
    render(<AcquisitionCta publicSignupEnabled={false} />);

    expect(screen.getByRole("link", { name: "Solicitar acesso free" })).toHaveAttribute(
      "href",
      "#acesso",
    );
  });

  it("usa accessHref fornecido (página independente)", () => {
    render(<AcquisitionCta publicSignupEnabled={false} accessHref="/#acesso" />);

    expect(screen.getByRole("link", { name: "Solicitar acesso free" })).toHaveAttribute(
      "href",
      "/#acesso",
    );
  });

  it("com signup público, mantém Google + e-mail e não renderiza a âncora", () => {
    render(<AcquisitionCta publicSignupEnabled accessHref="/#acesso" />);

    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar com email" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(
      screen.queryByRole("link", { name: "Solicitar acesso free" }),
    ).toBeNull();
  });
});
