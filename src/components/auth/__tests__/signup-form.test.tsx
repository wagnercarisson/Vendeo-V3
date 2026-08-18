// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignUp = vi.fn();
const mockReplace = vi.fn();

const captchaMock = vi.hoisted(() => ({
  onVerify: null as null | ((token: string | null) => void),
}));

vi.mock("@/components/auth/captcha-field", () => ({
  CaptchaField: ({
    onVerify,
  }: {
    onVerify: (token: string | null) => void;
  }) => {
    captchaMock.onVerify = onVerify;
    return null;
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      signUp: mockSignUp,
    },
  })),
}));

vi.mock("@/lib/supabase/site-url", () => ({
  getSiteUrl: () => "https://vendeo.test",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

// Modais legais renderizam null sem dependências externas.
vi.mock("@/components/legal/privacy-acknowledge-modal", () => ({
  PrivacyAcknowledgeModal: () => null,
}));
vi.mock("@/components/legal/communications-consent-modal", () => ({
  CommunicationsConsentModal: () => null,
}));

import { SignupForm } from "../signup-form";

function setCaptchaToken(token: string | null = "captcha-token") {
  act(() => {
    captchaMock.onVerify?.(token);
  });
}

function fillAndSubmit(
  email = "test@test.com",
  password = "password123",
  confirm = password,
) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole("button", { name: /Criar conta/i }));
}

function acknowledgePrivacy() {
  // Ciência da privacidade: marcada por padrão via checkbox "Li e declaro ciência".
  fireEvent.click(
    screen.getByLabelText(/Li e declaro ciência integral da Política de Privacidade/i),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  captchaMock.onVerify = null;
  window.sessionStorage.clear();
});

describe("SignupForm (Testes 2-8, tasks.md §13)", () => {
  it("Teste 2a: valida senha < 8 caracteres — mensagem PT-BR", async () => {
    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    acknowledgePrivacy();
    fillAndSubmit("test@test.com", "1234567");

    await waitFor(() => {
      expect(
        screen.getByText("A senha deve ter pelo menos 8 caracteres."),
      ).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("Teste 2b: valida senha !== confirmar senha — mensagem PT-BR", async () => {
    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    acknowledgePrivacy();
    fillAndSubmit("test@test.com", "password123", "password456");

    await waitFor(() => {
      expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("Teste 3a: bloqueia submit sem ciência da privacidade (modal)", async () => {
    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  it("Teste 3b: consentimento de comunicações é opcional (submete sem ele)", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    acknowledgePrivacy();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalled();
    });
  });

  it("Teste 4: chama signUp com emailRedirectTo /auth/confirm + captchaToken", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    acknowledgePrivacy();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
        options: {
          emailRedirectTo: "https://vendeo.test/auth/confirm",
          captchaToken: "captcha-token",
        },
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
  });

  it("Teste 5: anti-enumeração — email já registrado → mesma resposta /check-email", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: new Error("User already registered"),
    });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    acknowledgePrivacy();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
    });
    expect(
      screen.queryByText("Email já cadastrado"),
    ).not.toBeInTheDocument();
  });

  it("Teste 6: erro operacional/captcha → mensagem genérica (não revela conta)", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: new Error("captcha verification failed"),
    });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    acknowledgePrivacy();
    fillAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível concluir. Tente novamente."),
      ).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("Teste 7: captcha token ausente → bloqueio de cadastro (signUp não chamado)", async () => {
    render(<SignupForm captchaEnabled={true} />);
    acknowledgePrivacy();
    fillAndSubmit();

    await new Promise((r) => setTimeout(r, 50));
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("Teste 8: token inválido/expirado (erro Supabase) → mensagem genérica", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: new Error("token expired"),
    });

    render(<SignupForm captchaEnabled={true} />);
    setCaptchaToken();
    acknowledgePrivacy();
    fillAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível concluir. Tente novamente."),
      ).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("inclui links legais de Privacidade e Termos", () => {
    render(<SignupForm captchaEnabled={true} />);
    const privacyLinks = screen.getAllByRole("link", { name: /Política de Privacidade/i });
    for (const link of privacyLinks) {
      expect(link).toHaveAttribute("href", "/privacidade");
    }
    expect(screen.getByRole("link", { name: /Termos de Uso/i })).toHaveAttribute(
      "href",
      "/termos",
    );
  });

  it("captchaEnabled=false: submit sem token chama signUp com emailRedirectTo SEM captchaToken", async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    render(<SignupForm captchaEnabled={false} />);
    acknowledgePrivacy();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
        options: {
          emailRedirectTo: "https://vendeo.test/auth/confirm",
        },
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/check-email?type=signup");
  });

  it("captchaEnabled=false: CaptchaField NÃO é montado (onVerify permanece null)", () => {
    render(<SignupForm captchaEnabled={false} />);

    expect(captchaMock.onVerify).toBeNull();
  });
});