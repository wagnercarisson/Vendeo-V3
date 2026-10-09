// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

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
});

describe("Teste 10b - AccessRequestSection flag on", () => {
  it("não renderiza o formulário quando a flag está ligada", () => {
    render(<AccessRequestSection publicSignupEnabled={true} />);
    expect(screen.queryByTestId("access-request-form")).not.toBeInTheDocument();
    expect(screen.queryByText("Solicite seu acesso free")).not.toBeInTheDocument();
  });
});
