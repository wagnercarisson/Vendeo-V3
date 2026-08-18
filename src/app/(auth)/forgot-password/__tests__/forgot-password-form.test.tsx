// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResetPasswordForEmail = vi.fn();
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
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  })),
}));

vi.mock("@/lib/supabase/site-url", () => ({
  getSiteUrl: () => "http://localhost:3000",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

import { ForgotPasswordForm } from "../forgot-password-form";

function setCaptchaToken(token: string | null = "captcha-token") {
  act(() => {
    captchaMock.onVerify?.(token);
  });
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "test@test.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  captchaMock.onVerify = null;
});

describe("ForgotPasswordForm", () => {
  it("renders email input and submit button", () => {
    render(<ForgotPasswordForm captchaEnabled={true} />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redefinir senha" })).toBeInTheDocument();
  });

  it("bloqueia o submit sem captchaToken — resetPasswordForEmail NÃO é chamado", async () => {
    render(<ForgotPasswordForm captchaEnabled={true} />);

    fillAndSubmit();

    await waitFor(() => {
      expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("calls resetPasswordForEmail com captchaToken e redireciona a /check-email", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    render(<ForgotPasswordForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith("test@test.com", {
        redirectTo: "http://localhost:3000/auth/confirm",
        captchaToken: "captcha-token",
      });
    });

    expect(mockReplace).toHaveBeenCalledWith("/check-email?type=recovery");
  });

  it("redirects even when API returns error (anti-enumeration)", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: new Error("Email not found") });

    render(<ForgotPasswordForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/check-email?type=recovery");
    });
  });

  it("disables button during loading", async () => {
    mockResetPasswordForEmail.mockImplementation(() => new Promise(() => {}));

    render(<ForgotPasswordForm captchaEnabled={true} />);
    setCaptchaToken();
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  it("captchaEnabled=false: submit sem token chama resetPasswordForEmail SEM captchaToken", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    render(<ForgotPasswordForm captchaEnabled={false} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith("test@test.com", {
        redirectTo: "http://localhost:3000/auth/confirm",
      });
    });
    expect(mockReplace).toHaveBeenCalledWith("/check-email?type=recovery");
  });

  it("captchaEnabled=false: CaptchaField NÃO é montado (onVerify permanece null)", () => {
    render(<ForgotPasswordForm captchaEnabled={false} />);

    expect(captchaMock.onVerify).toBeNull();
  });
});