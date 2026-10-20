// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import { AccessRequestActions } from "../access-request-actions";

describe("AccessRequestActions — estado do convite", () => {
  it("lease ativo em invite_status=sending desabilita o reenvio", () => {
    const future = new Date(Date.now() + 60_000).toISOString();

    render(
      <AccessRequestActions
        requestId="req-1"
        status="approved"
        inviteStatus="sending"
        inviteLockedUntil={future}
      />,
    );

    const button = screen.getByRole("button", { name: "Enviando..." });
    expect(button).toBeDisabled();
  });

  it("lease vencido permite reenviar (não fica preso em Enviando)", () => {
    const past = new Date(Date.now() - 60_000).toISOString();

    render(
      <AccessRequestActions
        requestId="req-1"
        status="approved"
        inviteStatus="sending"
        inviteLockedUntil={past}
      />,
    );

    expect(screen.getByRole("button", { name: "Reenviar convite" })).toBeEnabled();
  });

  it("convite nunca enviado oferece 'Enviar convite'", () => {
    render(
      <AccessRequestActions
        requestId="req-1"
        status="approved"
        inviteStatus="not_sent"
      />,
    );

    expect(screen.getByRole("button", { name: "Enviar convite" })).toBeEnabled();
  });

  it("falha exibe o motivo via title e mantém reenvio disponível", () => {
    render(
      <AccessRequestActions
        requestId="req-1"
        status="approved"
        inviteStatus="failed"
        inviteError="email_not_configured:VENDEO_EMAIL_ENABLED"
      />,
    );

    const button = screen.getByRole("button", { name: "Reenviar convite" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("title", "email_not_configured:VENDEO_EMAIL_ENABLED");
  });

  it("solicitação pendente mostra aprovar/recusar, não reenvio", () => {
    render(<AccessRequestActions requestId="req-1" status="pending" />);

    expect(screen.getByRole("button", { name: "Aprovar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Recusar" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /convite/i })).not.toBeInTheDocument();
  });
});
