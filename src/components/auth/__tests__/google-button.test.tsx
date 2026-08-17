// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignInWithOAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  })),
}));

vi.mock("@/lib/supabase/site-url", () => ({
  getSiteUrl: () => "https://vendeo.app",
}));

import { GoogleButton } from "../google-button";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Teste 9 - GoogleButton (D15)", () => {
  it("renderiza label 'Continuar com Google' + aria-label + ícone G oficial", () => {
    render(<GoogleButton />);
    const button = screen.getByRole("button", {
      name: "Continuar com Google",
    });
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  });

  it("chama signInWithOAuth com provider google, redirectTo /auth/callback e scopes 'openid email profile'", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    render(<GoogleButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1));

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://vendeo.app/auth/callback",
        scopes: "openid email profile",
      },
    });
  });

  it("NÃO inclui captchaToken na chamada (D15/D3 — OAuth não passa por Turnstile)", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    render(<GoogleButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1));

    const callArg = mockSignInWithOAuth.mock.calls[0][0];
    expect(callArg.options).not.toHaveProperty("captchaToken");
  });

  it("desabilita o botão e mostra spinner durante o loading", async () => {
    mockSignInWithOAuth.mockImplementation(() => new Promise(() => {}));

    render(<GoogleButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("mostra mensagem genérica (não enumera) quando o OAuth retorna erro", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: new Error("oauth_error") });

    render(<GoogleButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível concluir. Tente novamente."),
      ).toBeInTheDocument(),
    );
  });
});