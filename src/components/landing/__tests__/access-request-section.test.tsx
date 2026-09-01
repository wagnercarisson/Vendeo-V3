// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/auth/google-button", () => ({
  GoogleButton: ({ variant, fullWidth }: { variant?: string; fullWidth?: boolean }) => (
    <button type="button" data-variant={variant} data-fullwidth={String(fullWidth)}>
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

vi.mock("./novidades-link", () => ({
  NovidadesLink: () => <span data-testid="novidades-link" />,
}));

import { AccessRequestSection } from "../access-request-section";

const emptyEntries = [] as never[];

describe("Teste 10a - AccessRequestSection flag off", () => {
  it("renderiza badge Beta fechado + CTA Solicitar acesso free", () => {
    render(<AccessRequestSection entries={emptyEntries} publicSignupEnabled={false} />);
    expect(
      screen.getByText(/Beta fechado — acesso liberado por convite/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Solicitar acesso free" }),
    ).toBeInTheDocument();
  });

  it("renderiza o formulário de acesso antecipado e NÃO o GoogleButton", () => {
    render(<AccessRequestSection entries={emptyEntries} publicSignupEnabled={false} />);
    expect(screen.getByTestId("access-request-form")).toBeInTheDocument();
    expect(screen.getByText("Solicite seu acesso free")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continuar com Google" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Continuar com email/ })).not.toBeInTheDocument();
  });
});

describe("Teste 10b - AccessRequestSection flag on", () => {
  it("renderiza GoogleButton como CTA principal e NÃO o formulário", () => {
    render(<AccessRequestSection entries={emptyEntries} publicSignupEnabled={true} />);
    const googleBtn = screen.getByRole("button", { name: "Continuar com Google" });
    expect(googleBtn).toBeInTheDocument();
    expect(googleBtn).toHaveAttribute("data-variant", "solid");
    expect(googleBtn).toHaveAttribute("data-fullwidth", "true");
    expect(screen.queryByTestId("access-request-form")).not.toBeInTheDocument();
  });

  it("renderiza CTA secundário 'Continuar com email' apontando para /signup", () => {
    render(<AccessRequestSection entries={emptyEntries} publicSignupEnabled={true} />);
    const emailLink = screen.getByRole("link", { name: /Continuar com email/ });
    expect(emailLink).toHaveAttribute("href", "/signup");
  });

  it("NÃO renderiza CTA 'Criar conta grátis' (contrato Google principal + email secundário)", () => {
    render(<AccessRequestSection entries={emptyEntries} publicSignupEnabled={true} />);
    expect(screen.queryByRole("link", { name: /Criar conta/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Criar conta/i)).not.toBeInTheDocument();
  });

  it("exibe subcopy 'Leva 2 minutos'", () => {
    render(<AccessRequestSection entries={emptyEntries} publicSignupEnabled={true} />);
    expect(screen.getByText(/Leva 2 minutos/)).toBeInTheDocument();
  });
});