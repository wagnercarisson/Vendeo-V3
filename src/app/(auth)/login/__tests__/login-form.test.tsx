// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignInWithPassword = vi.fn();
const mockReplace = vi.fn();

// Mock controlável do CaptchaField: expõe o callback onVerify para os testes
// simularem a resolução (token) ou ausência de desafio Turnstile.
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
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

import { LoginForm } from "../login-form";

function setCaptchaToken(token: string | null = "captcha-token") {
  act(() => {
    captchaMock.onVerify?.(token);
  });
}

function fillAndSubmit(email = "test@test.com", password = "password123") {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  captchaMock.onVerify = null;
});

describe("LoginForm", () => {
  it("includes link to /forgot-password", () => {
    render(<LoginForm redirect="/" />);
    const link = screen.getByRole("link", { name: "Esqueci minha senha" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("renders email input, password input and submit button", () => {
    render(<LoginForm redirect="/" />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("bloqueia o submit sem captchaToken — signInWithPassword NÃO é chamado", async () => {
    render(<LoginForm redirect="/" />);

    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("calls signInWithPassword com options.captchaToken e redireciona no sucesso", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    render(<LoginForm redirect="/store" />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
        options: { captchaToken: "captcha-token" },
      });
    });

    expect(mockReplace).toHaveBeenCalledWith("/store");
  });

  it("redirects to /dashboard on success when redirect is '/' (sanitizer default)", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    // login/page.tsx: sanitizeRedirectPath("") retorna "/" — esse é o valor real
    // recebido pelo form quando não há ?redirect= (bug crítico pós-login).
    render(<LoginForm redirect="/" />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects to /dashboard on success when redirect is empty (defensive)", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    render(<LoginForm redirect="" />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("keeps provided redirect value on success", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    render(<LoginForm redirect="/campanhas" />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/campanhas");
    });
  });

  it("shows error message on failed login", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: new Error("Invalid credentials"),
    });

    render(<LoginForm redirect="/" />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText("Email ou senha inválidos")).toBeInTheDocument();
    });
  });

  it("disables button and shows loading state during submission", async () => {
    mockSignInWithPassword.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    render(<LoginForm redirect="/" />);
    setCaptchaToken();
    fillAndSubmit();

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("reseta o token após o submit — próximo submit sem novo token é bloqueado", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    });

    render(<LoginForm redirect="/" />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    });

    // T-42-08b: token resetado pós-submit — novo submit sem novo desafio não
    // chama a API (a chamada anterior foi single-use).
    fillAndSubmit();
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});