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

  it("mantém o layout padrão empilhado (consumidores existentes)", () => {
    const { container } = render(<AcquisitionCta publicSignupEnabled />);
    const root = container.querySelector("[data-acquisition-layout]")!;

    expect(root.getAttribute("data-acquisition-layout")).toBe("stacked");
    expect(root.className).not.toContain("sm:flex-row");
    expect(container.querySelector(".max-w-sm")).not.toBeNull();
  });

  it("layout inline coloca as ações lado a lado com largura equivalente", () => {
    const { container } = render(
      <AcquisitionCta publicSignupEnabled layout="inline" />,
    );

    const root = container.querySelector("[data-acquisition-layout]")!;
    expect(root.className).toContain("sm:grid-cols-2");

    const googleWrapper = container.querySelector("[data-acquisition-layout] > div");
    expect(googleWrapper?.className).toContain("w-full");
    expect(
      screen.getByRole("link", { name: "Continuar com email" }).className,
    ).toContain("w-full");
    expect(container.querySelector(".max-w-sm")).toBeNull();
  });

  it("layout inline no cadastro fechado mantém a largura total no mobile", () => {
    render(<AcquisitionCta publicSignupEnabled={false} layout="inline" />);

    const link = screen.getByRole("link", { name: "Solicitar acesso free" });
    expect(link.className).toContain("w-full");
    expect(link.className).toContain("sm:w-auto");
  });
});
