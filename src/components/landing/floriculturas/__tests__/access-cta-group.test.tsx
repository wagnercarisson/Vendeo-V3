// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessCtaGroup } from "../access-cta-group";

/**
 * `AccessCtaGroup` — composição explícita por estado da flag.
 *
 * Cadastro fechado: primário verde + link institucional lado a lado no desktop.
 * Cadastro aberto: Google + e-mail lado a lado (mesma largura) e link
 * institucional abaixo, centralizado. Nenhum seletor descendente amplo (`[&_a]`).
 */

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: () => <button type="button">Continuar com Google</button>,
}));

const hasBroadSelector = (el: Element) =>
  Array.from(el.querySelectorAll("*")).some((node) =>
    (node.getAttribute("class") ?? "").includes("[&_a]"),
  );

describe("AccessCtaGroup — cadastro fechado (composição aprovada)", () => {
  it("mantém primário e institucional lado a lado no desktop", () => {
    const { container } = render(<AccessCtaGroup publicSignupEnabled={false} />);
    const group = container.querySelector("[data-access-cta-group]")!;

    expect(group.className).toContain("sm:flex-row");
    expect(screen.getByRole("link", { name: "Solicitar acesso free" })).toHaveAttribute(
      "href",
      "/#acesso",
    );
    expect(screen.getByRole("link", { name: "Conheça o Vendeo" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(hasBroadSelector(group)).toBe(false);
  });

  it("mantém a composição centralizada no encerramento", () => {
    const { container } = render(
      <AccessCtaGroup publicSignupEnabled={false} align="center" />,
    );

    expect(
      container.querySelector("[data-access-cta-group]")!.className,
    ).toContain("sm:justify-center");
  });
});

describe("AccessCtaGroup — cadastro aberto", () => {
  it("coloca Google e e-mail no mesmo conjunto e o institucional abaixo", () => {
    const { container } = render(<AccessCtaGroup publicSignupEnabled align="center" />);

    const group = container.querySelector("[data-access-cta-group]")!;
    expect(group.getAttribute("data-signup-state")).toBe("enabled");

    const acquisition = container.querySelector("[data-acquisition-layout]")!;
    expect(acquisition.getAttribute("data-acquisition-layout")).toBe("inline");
    expect(acquisition.className).toContain("sm:grid-cols-2");

    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar com email" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.getByRole("link", { name: "Conheça o Vendeo" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("mantém o link institucional centralizado abaixo do par", () => {
    render(<AccessCtaGroup publicSignupEnabled />);

    const link = screen.getByRole("link", { name: "Conheça o Vendeo" });
    const wrapper = link.parentElement!;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toContain("justify-center");
  });

  it("não usa seletor descendente amplo", () => {
    const { container } = render(<AccessCtaGroup publicSignupEnabled />);

    expect(hasBroadSelector(container)).toBe(false);
  });
});
